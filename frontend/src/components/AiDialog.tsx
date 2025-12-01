import { useEffect, useRef, useState, useDeferredValue, useCallback } from 'react';
import { X, Send, Loader, StopCircle, Clock, History, Trash2, Cpu, CheckCircle2, Circle, PlayCircle, PauseCircle, Minimize2, Maximize2 } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import { getAvailableEngines, executeAI } from '../api';
import type { AIEngine, AIEngineInfo, Todo } from '../types';

interface LogEntry {
  time: number;
  type: 'stdout' | 'stderr' | 'complete';
  content: string;
  sessionId: string;
  _uniqueId?: string;  // 客户端生成的唯一ID
}

interface HistoryRecord {
  id: string;
  prompt: string;
  timestamp: number;
  success: boolean;
  duration: number;
  engine?: AIEngine;
}

interface Props {
  projectName: string;
  onClose?: () => void;
  todoId?: number | null;  // 可选：关联的任务 ID
  initialPrompt?: string;  // 可选：初始提示词
  embedded?: boolean;      // 是否为嵌入模式
  sessionId?: string | null;  // 可选：外部提供的会话 ID（用于诊断等场景）
  minimized?: boolean;     // 是否最小化
  onMinimize?: () => void; // 最小化回调
  onMaximize?: () => void; // 最大化回调
}

export default function AiDialog({ projectName, onClose, todoId, initialPrompt, embedded = false, sessionId: externalSessionId, minimized = false, onMinimize, onMaximize }: Props) {
  // 组件实例唯一ID，防止多个实例之间的 key 冲突
  const instanceId = useRef(`instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`).current;

  // 🔍 调试日志 - 验证修复代码已加载
  useEffect(() => {
    console.log('🔧 [AiDialog] 组件初始化 - KEY修复版本已加载');
    console.log('🔧 [AiDialog] instanceId:', instanceId);
  }, [instanceId]);

  const [prompt, setPrompt] = useState(initialPrompt || '');
  // 使用 deferred value 来优化输入性能，避免每次按键都触发整个组件重渲染
  const deferredPrompt = useDeferredValue(prompt);

  const [output, setOutput] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null); // 对话 ID（跨引擎）
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null); // 当前引擎的会话 ID
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState<AIEngine>('claude-code');
  const [availableEngines, setAvailableEngines] = useState<AIEngineInfo[]>([]);
  const [currentTodo, setCurrentTodo] = useState<Todo | null>(null); // 当前关联的任务
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  // 日志计数器，用于生成唯一 key
  const logCounter = useRef<number>(0);

  // 当 initialPrompt 变化时更新 prompt
  useEffect(() => {
    if (initialPrompt) {
      setPrompt(initialPrompt);
    }
  }, [initialPrompt]);

  // 加载关联的任务详情
  useEffect(() => {
    if (todoId) {
      loadTodoDetails();
    } else {
      setCurrentTodo(null);
    }
  }, [todoId]);

  const loadTodoDetails = async () => {
    if (!todoId) return;
    try {
      const response = await fetch(`/api/todos/${todoId}`);
      const data = await response.json();
      if (data.success) {
        setCurrentTodo(data.data);
      }
    } catch (error) {
      console.error('加载任务详情失败:', error);
    }
  };

  const updateTodoStatus = async (newStatus: string) => {
    if (!todoId) return;
    try {
      const response = await fetch(`/api/todos/${todoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await response.json();
      if (data.success) {
        setCurrentTodo(data.data);
        // 可选: 显示成功提示
      }
    } catch (error) {
      console.error('更新任务状态失败:', error);
      alert('更新任务状态失败，请重试');
    }
  };

  // 加载可用引擎
  useEffect(() => {
    loadEngines();
  }, []);

  // 加载历史记录
  useEffect(() => {
    loadHistory();
  }, [projectName, selectedEngine]);

  // 监听引擎切换 - 重新建立 SSE 连接
  useEffect(() => {
    if (conversationId && currentSessionId) {
      // 计算新引擎的 sessionId
      const newSessionId = `${selectedEngine}-${conversationId}`;

      if (newSessionId !== currentSessionId) {
        console.log(`[前端] 🔄 引擎切换: ${currentSessionId} -> ${newSessionId}`);

        // 关闭旧的 SSE 连接
        if (eventSourceRef.current) {
          console.log('[前端] 关闭旧的 SSE 连接');
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // 更新 sessionId
        setCurrentSessionId(newSessionId);

        // 如果有正在运行的任务，重新建立 SSE 连接
        if (isRunning) {
          setupSSEConnection(newSessionId);
        }
      }
    }
  }, [selectedEngine, conversationId]);

  // 自动滚动
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // 组件卸载时清理 SSE 连接
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        console.log('组件卸载，关闭 SSE 连接');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  const loadEngines = async () => {
    try {
      const engines = await getAvailableEngines();
      setAvailableEngines(engines);
      // 设置默认引擎
      const defaultEngine = engines.find(e => e.isDefault);
      if (defaultEngine) {
        setSelectedEngine(defaultEngine.name);
      }
    } catch (error) {
      console.error('加载引擎列表失败:', error);
    }
  };

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectName}/ai/history?engine=${selectedEngine}`);
      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error('加载历史失败:', error);
    }
  }, [projectName, selectedEngine]);

  // 建立 SSE 连接
  const setupSSEConnection = useCallback((sessionId: string) => {
    console.log(`[前端] 📡 建立 SSE 连接: ${sessionId}`);

    // 关闭之前的连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // 连接 SSE 流
    const eventSource = new EventSource(
      `/api/projects/${projectName}/ai/stream/${sessionId}`
    );

    // 增强的去重逻辑：使用 Set 跟踪最近的消息指纹
    const recentMessages = new Set<string>();
    const MAX_RECENT_MESSAGES = 50; // 跟踪最近 50 条消息
    const recentMessageQueue: string[] = [];
    let messageIndex = 0;

    eventSource.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data);

        if (log.type === 'complete') {
          // 任务完成
          setIsRunning(false);
          eventSource.close();
          loadHistory(); // 刷新历史记录
          // 自动将焦点回到输入框
          setTimeout(() => {
            inputRef.current?.focus();
          }, 0);
        } else {
          // 生成消息指纹（类型 + 内容的前 200 字符）
          const fingerprint = `${log.type}-${log.content?.substring(0, 200) || ''}`;

          // 检查是否为重复消息
          if (!recentMessages.has(fingerprint)) {
            messageIndex++;

            // 添加到去重集合
            recentMessages.add(fingerprint);
            recentMessageQueue.push(fingerprint);

            // 限制集合大小，移除最旧的消息
            if (recentMessageQueue.length > MAX_RECENT_MESSAGES) {
              const oldestFingerprint = recentMessageQueue.shift();
              if (oldestFingerprint) {
                recentMessages.delete(oldestFingerprint);
              }
            }

            // 为日志添加唯一 ID
            const logWithId = {
              ...log,
              _uniqueId: `${instanceId}-log-${logCounter.current++}`
            };

            setOutput(prev => {
              // 同时限制输出数组的总大小，防止内存溢出
              const newOutput = [...prev, logWithId];
              const MAX_OUTPUT_SIZE = 500; // 最多保留 500 条日志
              if (newOutput.length > MAX_OUTPUT_SIZE) {
                return newOutput.slice(-MAX_OUTPUT_SIZE);
              }
              return newOutput;
            });

            console.log(`✅ 消息 #${messageIndex}:`, log.content?.substring(0, 50));
          } else {
            console.warn(`⚠️ 重复消息已忽略:`, log.content?.substring(0, 50));
          }
        }
      } catch (error) {
        console.error('解析日志失败:', error);
      }
    };

    eventSource.onerror = () => {
      setIsRunning(false);
      eventSource.close();
    };

    eventSourceRef.current = eventSource;
  }, [projectName, loadHistory, instanceId]);

  // 当外部传入 sessionId 时，自动建立 SSE 连接（用于诊断等场景）
  useEffect(() => {
    if (externalSessionId) {
      console.log(`[前端] 🔧 接收到外部 sessionId: ${externalSessionId}`);
      setCurrentSessionId(externalSessionId);
      setIsRunning(true);
      setupSSEConnection(externalSessionId);
    }
  }, [externalSessionId, setupSSEConnection]);

  const handleExecute = useCallback(async () => {
    if (!prompt.trim() || isRunning) return;

    const currentPrompt = prompt.trim();
    setIsRunning(true);
    // 不清空输出，保持历史记录（除非是新会话）
    // setOutput([]);  // 注释掉这行
    setPrompt('');  // 立即清空输入框

    try {
      // 启动 AI 任务，传递 conversationId 和 todoId（如果有）
      const result = await executeAI(projectName, currentPrompt, selectedEngine, conversationId, todoId || null);

      // 更新对话 ID 和会话 ID
      const newConversationId = result.conversationId;
      const newSessionId = result.sessionId;

      if (!conversationId || newConversationId !== conversationId) {
        console.log(`[前端] 💾 保存新对话 ID: ${newConversationId}`);
        setConversationId(newConversationId);
      } else {
        console.log(`[前端] 🔄 继续现有对话: ${conversationId}`);
      }

      setCurrentSessionId(newSessionId);

      // 建立 SSE 连接
      setupSSEConnection(newSessionId);

    } catch (error) {
      alert(error instanceof Error ? error.message : '执行失败');
      setIsRunning(false);
      setPrompt(currentPrompt);  // 出错时恢复输入框内容
    }
  }, [prompt, isRunning, projectName, selectedEngine, conversationId, todoId, setupSSEConnection]);

  const handleTerminate = useCallback(async () => {
    if (!currentSessionId) return;

    try {
      await fetch(`/api/projects/${projectName}/ai/terminate/${currentSessionId}`, {
        method: 'POST'
      });

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      setIsRunning(false);
      // 终止后不清空 conversationId，允许继续对话
    } catch (error) {
      console.error('终止失败:', error);
    }
  }, [currentSessionId, projectName]);

  const handleNewConversation = useCallback(async () => {
    if (isRunning) {
      if (!confirm('当前有任务正在运行，确定要开始新对话吗？')) {
        return;
      }
      // 终止当前任务
      if (currentSessionId && eventSourceRef.current) {
        handleTerminate();
      }
    }

    // 清除服务器端的对话上下文
    if (conversationId) {
      try {
        await fetch(`/api/conversations/${conversationId}`, {
          method: 'DELETE'
        });
        console.log(`[前端] ✅ 已清除服务器端对话上下文: ${conversationId}`);
      } catch (error) {
        console.error('[前端] 清除对话上下文失败:', error);
      }
    }

    // 清空对话和会话，重置计数器
    logCounter.current = 0;
    setConversationId(null);
    setCurrentSessionId(null);
    setOutput([]);
    setPrompt('');
    console.log('[前端] 已清空对话，准备开始新对话');
  }, [isRunning, currentSessionId, conversationId, handleTerminate]);

  const handleClearHistory = useCallback(async () => {
    if (!confirm('确定要清空所有历史记录吗？')) return;

    try {
      await fetch(`/api/projects/${projectName}/ai/history`, {
        method: 'DELETE'
      });
      setHistory([]);
    } catch (error) {
      console.error('清空历史失败:', error);
    }
  }, [projectName]);

  const loadHistoryDetail = useCallback(async (recordId: string) => {
    try {
      console.log('[前端] 📖 加载历史记录详情');
      console.log('[前端]   - recordId:', recordId);
      console.log('[前端]   - engine:', selectedEngine);

      const response = await fetch(
        `/api/projects/${projectName}/ai/history/${recordId}?engine=${selectedEngine}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const record = await response.json();
      console.log('[前端]   - record:', record);
      console.log('[前端]   - logs 数量:', record.logs?.length || 0);

      // 重置计数器，为历史记录的每条日志添加唯一 ID
      logCounter.current = 0;
      const logsWithIds = (record.logs || []).map((log: any) => ({
        ...log,
        _uniqueId: `${instanceId}-log-${logCounter.current++}`
      }));

      // 显示历史输出
      setPrompt('');  // 清空输入框
      setOutput(logsWithIds);
      setShowHistory(false);

      console.log('[前端] ✅ 历史记录已加载');
    } catch (error) {
      console.error('[前端] ❌ 加载历史详情失败:', error);
      alert('加载历史记录失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  }, [projectName, selectedEngine, instanceId]);

  // 优化输入框事件处理
  const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleExecute();
    }
  }, [handleExecute]);

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}分${seconds % 60}秒`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  // 最小化浮动窗口
  const minimizedWidget = (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      minWidth: '280px',
      zIndex: 1000,
      border: '1px solid #e5e7eb',
      cursor: 'pointer',
      transition: 'all 0.2s'
    }}
    onClick={onMaximize}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.2)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
    }}
    >
      {/* AI 图标和状态 */}
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '8px',
        background: isRunning ? '#dbeafe' : '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {isRunning ? (
          <Loader size={20} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <Cpu size={20} color="#6b7280" />
        )}
      </div>

      {/* 信息区域 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          color: '#111827',
          marginBottom: '2px'
        }}>
          AI 编程助手
        </div>
        <div style={{
          fontSize: '12px',
          color: '#6b7280',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {isRunning ? (
            <>
              <span style={{ color: '#3b82f6' }}>● </span>
              正在工作中...
            </>
          ) : (
            `${projectName} - 就绪`
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
        {isRunning && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleTerminate();
            }}
            style={{
              padding: '6px',
              border: 'none',
              borderRadius: '6px',
              background: '#fee2e2',
              color: '#dc2626',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="终止任务"
          >
            <StopCircle size={16} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMaximize?.();
          }}
          style={{
            padding: '6px',
            border: 'none',
            borderRadius: '6px',
            background: '#f3f4f6',
            color: '#374151',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
          title="展开"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* 添加旋转动画的样式 */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  // 主内容容器
  const mainContent = (
    <div style={{
      background: 'white',
      borderRadius: embedded ? '0' : '12px',
      width: embedded ? '100%' : '90%',
      maxWidth: embedded ? '100%' : '1200px',
      height: embedded ? '100%' : '85vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* 头部 */}
      <div style={{
        padding: '20px 24px',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 4px 0' }}>
              AI 编程助手
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
              项目：{projectName}
              {conversationId && (
                <span style={{ marginLeft: '12px', padding: '2px 8px', background: '#dbeafe', color: '#1e40af', borderRadius: '4px', fontSize: '12px' }}>
                  🔗 对话中
                </span>
              )}
            </p>
          </div>

          {/* AI 引擎选择器 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: '#f3f4f6',
            borderRadius: '8px'
          }}>
              <Cpu size={16} color="#6b7280" />
              <select
                value={selectedEngine}
                onChange={(e) => {
                  const newEngine = e.target.value as AIEngine;
                  if (conversationId && isRunning) {
                    if (confirm('切换引擎将中断当前任务，是否继续？')) {
                      setSelectedEngine(newEngine);
                    }
                  } else {
                    setSelectedEngine(newEngine);
                  }
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  cursor: 'pointer',
                  outline: 'none'
                }}
                title={conversationId ? '可以在同一对话中切换引擎' : '选择 AI 引擎'}
              >
                {availableEngines.map((engine) => (
                  <option key={engine.name} value={engine.name}>
                    {engine.displayName}
                    {engine.isDefault ? ' (默认)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleNewConversation}
              disabled={isRunning}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                background: 'white',
                color: '#374151',
                fontSize: '14px',
                cursor: isRunning ? 'not-allowed' : 'pointer',
                opacity: isRunning ? 0.5 : 1
              }}
              title="清空当前对话，开始新会话"
            >
              <Send size={16} />
              新对话
            </button>

            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                background: showHistory ? '#f3f4f6' : 'white',
                color: '#374151',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <History size={16} />
              历史记录
            </button>

            {!embedded && onMinimize && (
              <button
                onClick={onMinimize}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#6b7280',
                  cursor: 'pointer'
                }}
                title="最小化到后台"
              >
                <Minimize2 size={20} />
              </button>
            )}

            {!embedded && onClose && (
              <button
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#6b7280',
                  cursor: 'pointer'
                }}
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* 关联任务信息卡片 */}
        {currentTodo && (
          <div style={{
            padding: '16px 24px',
            background: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            {/* 任务信息 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                  当前任务：
                </span>
                <h3 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  margin: 0,
                  color: '#111827',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {currentTodo.title}
                </h3>
              </div>
              {currentTodo.description && (
                <p style={{
                  fontSize: '13px',
                  color: '#6b7280',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {currentTodo.description}
                </p>
              )}
            </div>

            {/* 状态快捷按钮 */}
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              {currentTodo.status === 'pending' && (
                <button
                  onClick={() => updateTodoStatus('in_progress')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
                  title="开始这个任务"
                >
                  <PlayCircle size={14} />
                  开始任务
                </button>
              )}

              {currentTodo.status === 'in_progress' && (
                <>
                  <button
                    onClick={() => updateTodoStatus('pending')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#d97706'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#f59e0b'}
                    title="暂停任务"
                  >
                    <PauseCircle size={14} />
                    暂停
                  </button>
                  <button
                    onClick={() => updateTodoStatus('completed')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                    title="标记为已完成"
                  >
                    <CheckCircle2 size={14} />
                    完成
                  </button>
                </>
              )}

              {currentTodo.status === 'completed' && (
                <button
                  onClick={() => updateTodoStatus('pending')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#4b5563'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#6b7280'}
                  title="重新开启任务"
                >
                  <Circle size={14} />
                  重新开启
                </button>
              )}

              {/* 当前状态显示 */}
              <div style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '500',
                ...(currentTodo.status === 'pending' ? { background: '#fef3c7', color: '#92400e' } :
                   currentTodo.status === 'in_progress' ? { background: '#dbeafe', color: '#1e40af' } :
                   currentTodo.status === 'completed' ? { background: '#dcfce7', color: '#16a34a' } :
                   { background: '#f3f4f6', color: '#1f2937' })
              }}>
                {currentTodo.status === 'pending' ? '待处理' :
                 currentTodo.status === 'in_progress' ? '进行中' :
                 currentTodo.status === 'completed' ? '已完成' :
                 currentTodo.status === 'cancelled' ? '已取消' : currentTodo.status}
              </div>
            </div>
          </div>
        )}

        {/* 主体内容 */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 历史记录侧边栏 */}
          {showHistory && (
            <div style={{
              width: '300px',
              borderRight: '1px solid #e5e7eb',
              display: 'flex',
              flexDirection: 'column',
              background: '#f9fafb'
            }}>
              <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>
                  执行历史
                </h3>
                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    style={{
                      padding: '4px',
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {history.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: '#9ca3af',
                    fontSize: '14px'
                  }}>
                    暂无历史记录
                  </div>
                ) : (
                  history.map((record) => (
                    <div
                      key={record.id}
                      onClick={() => loadHistoryDetail(record.id)}
                      style={{
                        padding: '12px',
                        marginBottom: '8px',
                        background: 'white',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: '1px solid #e5e7eb',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      <div style={{
                        fontSize: '13px',
                        color: '#374151',
                        marginBottom: '6px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {record.prompt}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: '#9ca3af'
                      }}>
                        {/* 引擎标识 */}
                        {record.engine && (
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: record.engine === 'claude-code' ? '#dbeafe' : '#fef3c7',
                            color: record.engine === 'claude-code' ? '#1e40af' : '#92400e',
                            fontSize: '11px',
                            fontWeight: '500'
                          }}>
                            {record.engine === 'claude-code' ? 'Claude' : 'Codex'}
                          </span>
                        )}
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: record.success ? '#dcfce7' : '#fee2e2',
                          color: record.success ? '#16a34a' : '#dc2626'
                        }}>
                          {record.success ? '成功' : '失败'}
                        </span>
                        <Clock size={12} />
                        {formatDuration(record.duration)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 主工作区 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* 输出区域 */}
            <div
              ref={outputRef}
              style={{
                flex: 1,
                padding: '16px',
                overflowY: 'auto',
                background: '#1e1e1e',
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '13px',
                lineHeight: '1.6'
              }}
            >
              {output.length === 0 ? (
                <div style={{ color: '#888', textAlign: 'center', paddingTop: '40px' }}>
                  {isRunning ? '正在执行...' : '输入任务描述后点击"执行"按钮'}
                </div>
              ) : (
                output.map((log: any, index) => {
                  const key = log._uniqueId || `fallback-${index}`;
                  // 🔍 调试日志 - 验证 key 是否唯一
                  if (index === 0) {
                    console.log('🔧 [AiDialog] 渲染日志，第一条 key:', key);
                  }
                  return (
                    <div
                      key={key}
                      style={{
                        marginBottom: '16px',
                        padding: '12px',
                        background: log.type === 'stderr' ? '#3f1d1d' : 'transparent',
                        borderRadius: '8px',
                        borderLeft: log.type === 'stderr' ? '3px solid #f87171' : 'none'
                      }}
                    >
                      <MarkdownRenderer content={log.content} />
                    </div>
                  );
                })
              )}
            </div>

            {/* 输入区域 */}
            <div style={{
              padding: '16px',
              borderTop: '1px solid #e5e7eb',
              background: '#f9fafb'
            }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={handlePromptChange}
                  onKeyDown={handleKeyDown}
                  placeholder="输入你想让 AI 做的事情... (Cmd/Ctrl + Enter 执行)"
                  disabled={isRunning}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    minHeight: '80px',
                    maxHeight: '200px'
                  }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {isRunning ? (
                    <button
                      onClick={handleTerminate}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '12px 20px',
                        border: 'none',
                        borderRadius: '8px',
                        background: '#ef4444',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <StopCircle size={18} />
                      终止
                    </button>
                  ) : (
                    <button
                      onClick={handleExecute}
                      disabled={!prompt.trim()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '12px 20px',
                        border: 'none',
                        borderRadius: '8px',
                        background: prompt.trim() ? '#3b82f6' : '#e5e7eb',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: prompt.trim() ? 'pointer' : 'not-allowed',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Send size={18} />
                      执行
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );

  // 如果是最小化状态，只显示浮动窗口
  if (minimized) {
    return minimizedWidget;
  }

  // 根据模式返回不同的包装
  return embedded ? mainContent : (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      {mainContent}
    </div>
  );
}

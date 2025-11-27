import { useEffect, useRef, useState } from 'react';
import { X, Send, Loader, StopCircle, Clock, History, Trash2 } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

interface LogEntry {
  time: number;
  type: 'stdout' | 'stderr' | 'complete';
  content: string;
  sessionId: string;
}

interface HistoryRecord {
  id: string;
  prompt: string;
  timestamp: number;
  success: boolean;
  duration: number;
}

interface Props {
  projectName: string;
  onClose: () => void;
}

export default function AiDialog({ projectName, onClose }: Props) {
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState<LogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 加载历史记录
  useEffect(() => {
    loadHistory();
  }, [projectName]);

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

  const loadHistory = async () => {
    try {
      const response = await fetch(`/api/projects/${projectName}/ai/history`);
      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error('加载历史失败:', error);
    }
  };

  const handleExecute = async () => {
    if (!prompt.trim() || isRunning) return;

    const currentPrompt = prompt.trim();
    setIsRunning(true);
    setOutput([]);
    setPrompt('');  // 立即清空输入框

    // 关闭之前的 SSE 连接（如果存在）
    if (eventSourceRef.current) {
      console.log('关闭之前的 SSE 连接');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      // 启动 AI 任务
      const response = await fetch(`/api/projects/${projectName}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: currentPrompt })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '启动失败');
      }

      const result = await response.json();
      const newSessionId = result.sessionId;
      setSessionId(newSessionId);

      // 连接 SSE 流
      const eventSource = new EventSource(
        `/api/projects/${projectName}/ai/stream/${newSessionId}`
      );

      // 跟踪最后一条消息，用于简单去重
      let lastMessage = '';
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
            // 简单去重：只有当内容与上一条完全相同时才认为是重复
            const currentMessage = `${log.type}-${log.content}`;

            if (currentMessage !== lastMessage) {
              messageIndex++;
              lastMessage = currentMessage;
              setOutput(prev => [...prev, log]);
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

    } catch (error) {
      alert(error instanceof Error ? error.message : '执行失败');
      setIsRunning(false);
      setPrompt(currentPrompt);  // 出错时恢复输入框内容
    }
  };

  const handleTerminate = async () => {
    if (!sessionId) return;

    try {
      await fetch(`/api/projects/${projectName}/ai/terminate/${sessionId}`, {
        method: 'POST'
      });

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      setIsRunning(false);
      setSessionId(null);
    } catch (error) {
      console.error('终止失败:', error);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm('确定要清空所有历史记录吗？')) return;

    try {
      await fetch(`/api/projects/${projectName}/ai/history`, {
        method: 'DELETE'
      });
      setHistory([]);
    } catch (error) {
      console.error('清空历史失败:', error);
    }
  };

  const loadHistoryDetail = async (recordId: string) => {
    try {
      const response = await fetch(
        `/api/projects/${projectName}/ai/history/${recordId}`
      );
      const record = await response.json();

      // 只显示历史输出，不填充输入框
      // setPrompt(record.prompt);  // 移除这行，避免历史记录显示在输入框
      setPrompt('');  // 清空输入框
      setOutput(record.logs || []);
      setShowHistory(false);
    } catch (error) {
      console.error('加载历史详情失败:', error);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}分${seconds % 60}秒`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  return (
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
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '1200px',
        height: '85vh',
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
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '600', margin: '0 0 4px 0' }}>
              AI 编程助手
            </h2>
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
              项目：{projectName}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
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
          </div>
        </div>

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
                output.map((log, index) => (
                  <div
                    key={index}
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
                ))
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
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleExecute();
                    }
                  }}
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
    </div>
  );
}

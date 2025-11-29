import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Loader2, CheckCircle, AlertCircle, Settings as SettingsIcon, Cpu } from 'lucide-react';
import { createProjectWithAI, getAvailableEngines } from '../api';
import type { AIEngine, AIEngineInfo } from '../types';

interface ProjectCreationDialogProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProjectCreationDialog({ onClose, onSuccess }: ProjectCreationDialogProps) {
  const [description, setDescription] = useState('');
  const [projectName, setProjectName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [stack, setStack] = useState<string[]>([]);
  const [port, setPort] = useState('');
  const [autoStart, setAutoStart] = useState(true);
  const [autoInstall, setAutoInstall] = useState(true);
  const [selectedEngine, setSelectedEngine] = useState<AIEngine>('claude-code');
  const [availableEngines, setAvailableEngines] = useState<AIEngineInfo[]>([]);

  const [isCreating, setIsCreating] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 加载可用引擎
  useEffect(() => {
    loadEngines();
  }, []);

  useEffect(() => {
    return () => {
      // 组件卸载时关闭 SSE 连接
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    // 自动滚动到最新日志
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

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

  const handleCreate = async () => {
    if (!description.trim()) {
      alert('请输入项目描述');
      return;
    }

    setIsCreating(true);
    setLogs([]);
    setHasError(false);
    setErrorMessage('');

    try {
      // 构建请求参数
      const params: any = {
        description: description.trim(),
        engine: selectedEngine,
        preferences: {
          autoStart,
          autoInstall
        }
      };

      if (projectName.trim()) {
        params.projectName = projectName.trim();
      }

      if (stack.length > 0) {
        params.preferences.stack = stack;
      }

      if (port) {
        const portNum = parseInt(port);
        if (!isNaN(portNum)) {
          params.preferences.port = portNum;
        }
      }

      // 发起创建请求
      const response = await createProjectWithAI(params);

      // 连接 SSE 流
      const streamUrl = `/api/projects/create/stream/${response.sessionId}`;
      const eventSource = new EventSource(streamUrl);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'complete') {
            // 任务完成
            setIsComplete(true);
            setIsCreating(false);
            eventSource.close();

            if (data.success) {
              // 成功完成
              setTimeout(() => {
                onSuccess();
                onClose();
              }, 2000);
            } else {
              // 失败
              setHasError(true);
              setErrorMessage(data.error || '创建失败');
            }
          } else {
            // 添加到日志
            setLogs(prev => [...prev, data]);
          }
        } catch (error) {
          console.error('解析 SSE 数据失败:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE 连接错误:', error);
        setHasError(true);
        setErrorMessage('连接中断');
        setIsCreating(false);
        eventSource.close();
      };

    } catch (error) {
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : '创建失败');
      setIsCreating(false);
    }
  };

  const renderLogContent = (log: any) => {
    const content = log.content || '';
    
    // 渲染 markdown 格式的内容
    if (content.includes('**')) {
      // 简单的 markdown 渲染
      const parts = content.split(/(\*\*.*?\*\*)/g);
      return (
        <span>
          {parts.map((part: string, i: number) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            return <span key={i}>{part}</span>;
          })}
        </span>
      );
    }

    return content;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Sparkles size={24} color="#3b82f6" />
            <h2 style={{ fontSize: '20px', fontWeight: '600' }}>
              {isCreating ? '🚀 正在创建项目...' : '✨ AI 一句话创建项目'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isCreating && !isComplete}
            style={{
              border: 'none',
              background: 'none',
              cursor: isCreating && !isComplete ? 'not-allowed' : 'pointer',
              padding: '4px',
              opacity: isCreating && !isComplete ? 0.5 : 1
            }}
          >
            <X size={24} color="#6b7280" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {!isCreating ? (
            <>
              {/* 项目描述 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#374151'
                }}>
                  项目描述 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="例如：一个博客系统，使用React和Node.js，支持文章管理和评论功能"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    minHeight: '100px',
                    resize: 'vertical'
                  }}
                />
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  💡 描述得越详细，AI 生成的项目越符合你的需求
                </p>
              </div>

              {/* AI 引擎选择 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '8px',
                  color: '#374151'
                }}>
                  AI 引擎
                </label>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}>
                  <Cpu size={16} color="#6b7280" />
                  <select
                    value={selectedEngine}
                    onChange={(e) => setSelectedEngine(e.target.value as AIEngine)}
                    disabled={isCreating}
                    style={{
                      flex: 1,
                      border: 'none',
                      background: 'transparent',
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#374151',
                      cursor: isCreating ? 'not-allowed' : 'pointer',
                      outline: 'none'
                    }}
                  >
                    {availableEngines.map((engine) => (
                      <option key={engine.name} value={engine.name}>
                        {engine.displayName}
                        {engine.isDefault ? ' (默认)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                  选择用于生成项目的 AI 引擎
                </p>
              </div>

              {/* 高级选项开关 */}
              <div style={{ marginBottom: '20px' }}>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    background: 'white',
                    fontSize: '14px',
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                >
                  <SettingsIcon size={16} />
                  {showAdvanced ? '隐藏' : '显示'}高级选项
                </button>
              </div>

              {/* 高级选项 */}
              {showAdvanced && (
                <div style={{
                  padding: '16px',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}>
                  {/* 项目名称 */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      marginBottom: '8px',
                      color: '#374151'
                    }}>
                      项目名称（可选）
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="留空将从描述自动生成"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  {/* 技术栈提示 */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      marginBottom: '8px',
                      color: '#374151'
                    }}>
                      偏好技术栈（可选）
                    </label>
                    <input
                      type="text"
                      placeholder="例如：React, Node.js, TypeScript（用逗号分隔）"
                      onChange={(e) => {
                        const value = e.target.value;
                        setStack(value.split(',').map(s => s.trim()).filter(s => s));
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  {/* 端口 */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '14px',
                      fontWeight: '500',
                      marginBottom: '8px',
                      color: '#374151'
                    }}>
                      端口号（可选）
                    </label>
                    <input
                      type="number"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      placeholder="3000"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  {/* 自动选项 */}
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={autoInstall}
                        onChange={(e) => setAutoInstall(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      自动安装依赖
                    </label>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '14px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={autoStart}
                        onChange={(e) => setAutoStart(e.target.checked)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      自动启动项目
                    </label>
                  </div>
                </div>
              )}

              {/* 创建按钮 */}
              <button
                onClick={handleCreate}
                disabled={!description.trim()}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: 'none',
                  borderRadius: '8px',
                  background: description.trim() ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: description.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Sparkles size={20} />
                开始创建
              </button>
            </>
          ) : (
            <>
              {/* 创建进度 */}
              <div style={{
                padding: '20px',
                background: '#f9fafb',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  {isComplete ? (
                    hasError ? (
                      <>
                        <AlertCircle size={24} color="#ef4444" />
                        <span style={{ fontSize: '16px', fontWeight: '500', color: '#ef4444' }}>
                          创建失败
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={24} color="#10b981" />
                        <span style={{ fontSize: '16px', fontWeight: '500', color: '#10b981' }}>
                          创建成功！即将跳转...
                        </span>
                      </>
                    )
                  ) : (
                    <>
                      <Loader2 className="animate-spin" size={24} color="#3b82f6" />
                      <span style={{ fontSize: '16px', fontWeight: '500', color: '#3b82f6' }}>
                        AI 正在创建项目...
                      </span>
                    </>
                  )}
                </div>

                {errorMessage && (
                  <div style={{
                    padding: '12px',
                    background: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    color: '#991b1b',
                    fontSize: '14px'
                  }}>
                    {errorMessage}
                  </div>
                )}
              </div>

              {/* 日志输出 */}
              <div style={{
                background: '#1f2937',
                borderRadius: '8px',
                padding: '16px',
                maxHeight: '400px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                fontSize: '13px'
              }}>
                {logs.map((log, index) => (
                  <div
                    key={index}
                    style={{
                      marginBottom: '8px',
                      color: log.type === 'stderr' ? '#fca5a5' : '#e5e7eb',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}
                  >
                    {renderLogContent(log)}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

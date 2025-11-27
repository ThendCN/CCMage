import { useEffect, useRef, useState } from 'react';
import { X, Pause, Play, Trash2 } from 'lucide-react';

interface LogEntry {
  time: number;
  type: 'stdout' | 'stderr';
  content: string;
}

interface Props {
  projectName: string;
  onClose: () => void;
}

export default function LogViewer({ projectName, onClose }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [autoscroll, setAutoscroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // 连接 SSE
  useEffect(() => {
    const eventSource = new EventSource(
      `/api/projects/${projectName}/logs/stream`
    );

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (event) => {
      try {
        const log = JSON.parse(event.data);
        setLogs(prev => [...prev, log]);
      } catch (error) {
        console.error('解析日志失败:', error);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    eventSourceRef.current = eventSource;

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [projectName]); // 只依赖 projectName，不依赖 autoscroll

  // 自动滚动效果（独立于 SSE 连接）
  useEffect(() => {
    if (autoscroll && logContainerRef.current && logs.length > 0) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoscroll]);

  const handleClear = () => {
    setLogs([]);
  };

  const toggleAutoscroll = () => {
    setAutoscroll(!autoscroll);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour12: false });
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
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* 头部 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
              {projectName} - 运行日志
            </h2>
            <div style={{
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              background: isConnected ? '#dcfce7' : '#fee2e2',
              color: isConnected ? '#16a34a' : '#dc2626'
            }}>
              {isConnected ? '已连接' : '未连接'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={toggleAutoscroll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                background: autoscroll ? '#dcfce7' : 'white',
                color: autoscroll ? '#16a34a' : '#6b7280',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              {autoscroll ? <Pause size={16} /> : <Play size={16} />}
              {autoscroll ? '暂停滚动' : '开启滚动'}
            </button>

            <button
              onClick={handleClear}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                background: 'white',
                color: '#6b7280',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={16} />
              清空
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

        {/* 日志内容 */}
        <div
          ref={logContainerRef}
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
          {logs.length === 0 ? (
            <div style={{ color: '#888', textAlign: 'center', paddingTop: '40px' }}>
              等待日志输出...
            </div>
          ) : (
            logs.map((log, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  gap: '12px',
                  marginBottom: '2px',
                  color: log.type === 'stderr' ? '#f87171' : '#d4d4d4'
                }}
              >
                <span style={{ color: '#888', flexShrink: 0 }}>
                  {formatTime(log.time)}
                </span>
                <span style={{
                  color: log.type === 'stderr' ? '#fb923c' : '#10b981',
                  flexShrink: 0,
                  fontWeight: '600',
                  width: '60px'
                }}>
                  {log.type === 'stderr' ? 'ERROR' : 'INFO'}
                </span>
                <pre style={{
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}>
                  {log.content}
                </pre>
              </div>
            ))
          )}
        </div>

        {/* 底部统计 */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #e5e7eb',
          background: '#f9fafb',
          fontSize: '14px',
          color: '#6b7280'
        }}>
          共 {logs.length} 条日志
        </div>
      </div>
    </div>
  );
}

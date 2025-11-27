import { useState, useEffect } from 'react';
import { Folder, GitBranch, AlertCircle, CheckCircle, Package, ExternalLink, Code, FolderOpen, Play, Square, FileText, Bot, ListTodo, Search, Database } from 'lucide-react';
import { Project, ProjectStatus } from '../types';
import { executeAction, startProject, stopProject, getRunningStatus, analyzeProject, getProjectAnalysis } from '../api';
import LogViewer from './LogViewer';
import AiDialog from './AiDialog';
import { TodoManager } from './TodoManager';

interface Props {
  name: string;
  project: Project;
  status?: ProjectStatus;
  onAction: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function ProjectCard({ name, project, status, onAction, selectionMode, isSelected, onSelect }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [runningStatus, setRunningStatus] = useState<any>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [showTodos, setShowTodos] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 定时检查运行状态
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await getRunningStatus(name);
        setRunningStatus(status);
      } catch (error) {
        // 忽略错误，保持之前的状态
      }
    };

    checkStatus(); // 初始检查
    const interval = setInterval(checkStatus, 3000); // 每3秒检查一次

    return () => clearInterval(interval);
  }, [name]);

  // 获取分析结果
  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const data = await getProjectAnalysis(name);
        setAnalysis(data);
      } catch (error) {
        // 项目尚未分析
      }
    };
    fetchAnalysis();
  }, [name]);

  const statusColor = {
    active: '#10b981',
    production: '#3b82f6',
    archived: '#6b7280',
    stable: '#8b5cf6',
    reference: '#f59e0b',
    external: '#ec4899'
  }[project.status] || '#6b7280';

  const handleAction = async (action: string) => {
    setLoading(true);
    setMessage('');
    try {
      const result = await executeAction(name, { action });
      setMessage(result.message || '操作成功');
      onAction();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleStart = async () => {
    setIsStarting(true);
    setMessage('');
    try {
      const result = await startProject(name);
      setMessage('项目启动成功');
      // 立即检查状态
      setTimeout(async () => {
        const status = await getRunningStatus(name);
        setRunningStatus(status);
      }, 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '启动失败');
    } finally {
      setIsStarting(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleStop = async () => {
    setIsStopping(true);
    setMessage('');
    try {
      await stopProject(name);
      setMessage('项目已停止');
      setRunningStatus({ running: false });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '停止失败');
    } finally {
      setIsStopping(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setMessage('');
    try {
      await analyzeProject(name);
      setMessage('项目分析已启动...');
      // 轮询检查分析结果
      const checkAnalysis = setInterval(async () => {
        try {
          const data = await getProjectAnalysis(name);
          if (data && data.analysis_status !== 'analyzing') {
            setAnalysis(data);
            setIsAnalyzing(false);
            clearInterval(checkAnalysis);
            if (data.analysis_status === 'completed') {
              setMessage('分析完成！');
            } else {
              setMessage('分析失败: ' + data.analysis_error);
            }
          }
        } catch (error) {
          // 继续轮询
        }
      }, 2000);
      // 60秒后超时
      setTimeout(() => {
        clearInterval(checkAnalysis);
        setIsAnalyzing(false);
      }, 60000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '分析失败');
      setIsAnalyzing(false);
    } finally {
      setTimeout(() => setMessage(''), 5000);
    }
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      borderLeft: `4px solid ${statusColor}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      position: 'relative',
      border: isSelected ? '2px solid #3b82f6' : 'none'
    }}>
      {/* 选择复选框 */}
      {selectionMode && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 1
        }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            style={{
              width: '20px',
              height: '20px',
              cursor: 'pointer'
            }}
          />
        </div>
      )}

      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
              {name}
            </h3>
            {/* 运行状态指示器 */}
            {runningStatus?.running && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                background: '#dcfce7',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#16a34a'
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#16a34a',
                  animation: 'pulse 2s infinite'
                }} />
                <span>运行中</span>
              </div>
            )}
          </div>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            {project.description}
          </p>
        </div>
        <span style={{
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: '500',
          background: `${statusColor}20`,
          color: statusColor
        }}>
          {project.status}
        </span>
      </div>

      {/* 技术栈 */}
      {project.stack && project.stack.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {project.stack.map(tech => (
            <span key={tech} style={{
              padding: '2px 8px',
              background: '#f3f4f6',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#374151'
            }}>
              {tech}
            </span>
          ))}
        </div>
      )}

      {/* 状态信息 */}
      {status && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
          <StatusItem
            icon={<GitBranch size={16} />}
            label="Git"
            value={status.hasGit ? (status.gitBranch || 'N/A') : '未初始化'}
            color={status.hasGit ? '#10b981' : '#6b7280'}
          />
          <StatusItem
            icon={<AlertCircle size={16} />}
            label="未提交"
            value={status.uncommittedFiles > 0 ? `${status.uncommittedFiles} 个文件` : '无'}
            color={status.uncommittedFiles > 0 ? '#f59e0b' : '#10b981'}
          />
          <StatusItem
            icon={<Package size={16} />}
            label="依赖"
            value={status.dependenciesInstalled ? '已安装' : '未安装'}
            color={status.dependenciesInstalled ? '#10b981' : '#ef4444'}
          />
          {project.port && (
            <StatusItem
              icon={<Code size={16} />}
              label="端口"
              value={project.port.toString()}
              color="#3b82f6"
            />
          )}
          {analysis && analysis.analyzed && (
            <>
              {analysis.framework && (
                <StatusItem
                  icon={<Database size={16} />}
                  label="框架"
                  value={analysis.framework}
                  color="#8b5cf6"
                />
              )}
              {analysis.file_count > 0 && (
                <StatusItem
                  icon={<FileText size={16} />}
                  label="文件数"
                  value={analysis.file_count.toString()}
                  color="#6b7280"
                />
              )}
            </>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {/* 启动/停止按钮 */}
        {runningStatus?.running ? (
          <>
            <ActionButton
              icon={<Square size={16} />}
              label="停止"
              onClick={handleStop}
              disabled={isStopping}
              variant="danger"
            />
            <ActionButton
              icon={<FileText size={16} />}
              label="查看日志"
              onClick={() => setShowLogs(true)}
              variant="default"
            />
          </>
        ) : (
          <ActionButton
            icon={<Play size={16} />}
            label="启动"
            onClick={handleStart}
            disabled={isStarting}
            variant="success"
          />
        )}

        <ActionButton
          icon={<Bot size={16} />}
          label="AI 编程"
          onClick={() => setShowAi(true)}
          variant="ai"
        />

        <ActionButton
          icon={<ListTodo size={16} />}
          label="任务管理"
          onClick={() => setShowTodos(true)}
          variant="primary"
        />

        {!analysis?.analyzed && (
          <ActionButton
            icon={<Search size={16} />}
            label={isAnalyzing ? '分析中...' : '分析项目'}
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            variant="default"
          />
        )}

        <ActionButton
          icon={<FolderOpen size={16} />}
          label="打开目录"
          onClick={() => handleAction('open-directory')}
          disabled={loading}
        />
        <ActionButton
          icon={<Code size={16} />}
          label="VSCode"
          onClick={() => handleAction('open-vscode')}
          disabled={loading}
        />
        {status?.hasDependencies && !status?.dependenciesInstalled && (
          <ActionButton
            icon={<Package size={16} />}
            label="安装依赖"
            onClick={() => handleAction('install-deps')}
            disabled={loading}
            variant="primary"
          />
        )}
      </div>

      {/* 消息提示 */}
      {message && (
        <div style={{
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '14px',
          background: message.includes('失败') || message.includes('错误') ? '#fef2f2' : '#f0fdf4',
          color: message.includes('失败') || message.includes('错误') ? '#ef4444' : '#10b981'
        }}>
          {message}
        </div>
      )}

      {/* 日志查看器 */}
      {showLogs && (
        <LogViewer
          projectName={name}
          onClose={() => setShowLogs(false)}
        />
      )}

      {/* AI 编程对话框 */}
      {showAi && (
        <AiDialog
          projectName={name}
          onClose={() => setShowAi(false)}
        />
      )}

      {/* 任务管理器 */}
      {showTodos && (
        <TodoManager
          projectName={name}
          onClose={() => setShowTodos(false)}
        />
      )}
    </div>
  );
}

function StatusItem({ icon, label, value, color }: any) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ color: '#6b7280' }}>{label}:</span>
      <span style={{ fontWeight: '500', color }}>{value}</span>
    </div>
  );
}

function ActionButton({ icon, label, onClick, disabled, variant = 'default' }: any) {
  const variantStyles = {
    default: {
      border: '1px solid #e5e7eb',
      background: 'white',
      color: '#374151',
      hoverBackground: '#f9fafb'
    },
    primary: {
      border: 'none',
      background: '#3b82f6',
      color: 'white',
      hoverBackground: '#2563eb'
    },
    success: {
      border: 'none',
      background: '#10b981',
      color: 'white',
      hoverBackground: '#059669'
    },
    danger: {
      border: 'none',
      background: '#ef4444',
      color: 'white',
      hoverBackground: '#dc2626'
    },
    ai: {
      border: 'none',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      hoverBackground: 'linear-gradient(135deg, #5568d3 0%, #63408a 100%)'
    }
  };

  const style = variantStyles[variant] || variantStyles.default;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        border: style.border,
        borderRadius: '6px',
        background: style.background,
        color: style.color,
        fontSize: '14px',
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.background = style.hoverBackground;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = style.background;
      }}
    >
      {icon}
      {label}
    </button>
  );
}

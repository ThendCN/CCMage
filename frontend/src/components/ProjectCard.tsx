import { useState, useEffect } from 'react';
import { Folder, GitBranch, AlertCircle, Package, Code, FolderOpen, Play, Square, Settings, Brain, Loader } from 'lucide-react';
import { Project, ProjectStatus, ProjectAnalysis } from '../types';
import { executeAction, startProject, stopProject, getRunningStatus, analyzeProject, getProjectAnalysis } from '../api';

interface Props {
  name: string;
  project: Project;
  status?: ProjectStatus;
  onAction: () => void;
  onOpenDetail: (projectName: string) => void;
  onEdit?: (projectName: string, project: Project) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function ProjectCard({
  name,
  project,
  status,
  onAction,
  onOpenDetail,
  onEdit,
  selectionMode,
  isSelected,
  onSelect
}: Props) {
  const [runningStatus, setRunningStatus] = useState<any>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [message, setMessage] = useState('');
  const [analysisData, setAnalysisData] = useState<ProjectAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const statusColor = {
    active: '#10b981',
    production: '#3b82f6',
    archived: '#6b7280',
    stable: '#8b5cf6',
    reference: '#f59e0b',
    external: '#ec4899'
  }[project.status] || '#6b7280';

  // 定时检查运行状态
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await getRunningStatus(name);
        setRunningStatus(status);
      } catch (error) {
        // 忽略错误
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [name]);

  // 获取项目分析结果
  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const analysis = await getProjectAnalysis(name);
        setAnalysisData(analysis);

        // 如果正在分析，继续轮询
        if (analysis?.analysis_status === 'analyzing') {
          setIsAnalyzing(true);
        } else {
          setIsAnalyzing(false);
        }
      } catch (error) {
        // 忽略错误（项目可能还未分析）
      }
    };

    fetchAnalysis();

    // 如果正在分析，每 3 秒刷新一次
    const interval = setInterval(() => {
      if (isAnalyzing) {
        fetchAnalysis();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [name, isAnalyzing]);

  const handleAction = async (action: string) => {
    setMessage('');
    try {
      const result = await executeAction(name, { action });
      setMessage(result.message || '操作成功');
      onAction();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    } finally {
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleStart = async () => {
    setIsStarting(true);
    setMessage('');
    try {
      await startProject(name);
      setMessage('项目启动成功');
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
      setMessage('AI 分析已启动');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '启动分析失败');
      setIsAnalyzing(false);
    } finally {
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        borderLeft: `4px solid ${statusColor}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        border: isSelected ? '2px solid #3b82f6' : 'none',
        cursor: selectionMode ? 'default' : 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s'
      }}
      onClick={(e) => {
        if (!selectionMode && !(e.target as HTMLElement).closest('button')) {
          onOpenDetail(name);
        }
      }}
      onMouseEnter={(e) => {
        if (!selectionMode) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selectionMode) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
        }
      }}
    >
      {/* 选择复选框 */}
      {selectionMode && (
        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 1 }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onSelect}
            style={{ width: '20px', height: '20px', cursor: 'pointer' }}
          />
        </div>
      )}

      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>{name}</h3>
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
                  background: '#16a34a'
                }} />
                <span>运行中</span>
              </div>
            )}
            {analysisData?.analysis_status === 'analyzing' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                background: '#dbeafe',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#3b82f6'
              }}>
                <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} />
                <span>分析中...</span>
              </div>
            )}
            {analysisData?.analysis_status === 'completed' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                background: '#f0fdf4',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#16a34a'
              }}>
                <Brain size={12} />
                <span>已分析</span>
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

      {/* 快捷操作 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {runningStatus?.running ? (
          <QuickButton
            icon={<Square size={14} />}
            label="停止"
            onClick={handleStop}
            disabled={isStopping}
            color="#ef4444"
          />
        ) : (
          <QuickButton
            icon={<Play size={14} />}
            label="启动"
            onClick={handleStart}
            disabled={isStarting}
            color="#10b981"
          />
        )}
        <QuickButton
          icon={<FolderOpen size={14} />}
          label="目录"
          onClick={() => handleAction('open-directory')}
        />
        <QuickButton
          icon={<Code size={14} />}
          label="VSCode"
          onClick={() => handleAction('open-vscode')}
        />
        <QuickButton
          icon={isAnalyzing ? <Loader size={14} /> : <Brain size={14} />}
          label={analysisData?.analyzed ? '重新分析' : 'AI分析'}
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          color="#8b5cf6"
        />
        {onEdit && (
          <QuickButton
            icon={<Settings size={14} />}
            label="编辑"
            onClick={() => onEdit(name, project)}
            color="#3b82f6"
          />
        )}
      </div>

      {/* 消息提示 */}
      {message && (
        <div style={{
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '13px',
          background: message.includes('失败') || message.includes('错误') ? '#fef2f2' : '#f0fdf4',
          color: message.includes('失败') || message.includes('错误') ? '#ef4444' : '#10b981',
          border: `1px solid ${message.includes('失败') || message.includes('错误') ? '#fecaca' : '#bbf7d0'}`
        }}>
          {message}
        </div>
      )}
    </div>
  );
}

function QuickButton({ icon, label, onClick, disabled, color = '#6b7280' }: any) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 10px',
        border: 'none',
        borderRadius: '6px',
        background: '#f9fafb',
        color,
        fontSize: '13px',
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.2s'
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = '#f3f4f6';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#f9fafb';
      }}
    >
      {icon}
      {label}
    </button>
  );
}

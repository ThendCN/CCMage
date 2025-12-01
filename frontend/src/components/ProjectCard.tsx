import { useState, useEffect } from 'react';
import { Folder, GitBranch, AlertCircle, Package, Code, FolderOpen, Play, Square, Settings, Brain, Loader, AlertTriangle, Stethoscope, Globe } from 'lucide-react';
import { Project, ProjectStatus, ProjectAnalysis } from '../types';
import { executeAction, startProject, stopProject, analyzeProject, getProjectAnalysis, getFailedLogs, diagnoseProject } from '../api';
import AiDialog from './AiDialog';
import FrpcConfigDialog from './FrpcConfigDialog';

interface Props {
  name: string;
  project: Project;
  status?: ProjectStatus;
  runningStatus?: any;  // 从父组件接收运行状态
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
  runningStatus,
  onAction,
  onOpenDetail,
  onEdit,
  selectionMode,
  isSelected,
  onSelect
}: Props) {
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'warning'>('success');
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [analysisData, setAnalysisData] = useState<ProjectAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [showDiagnosis, setShowDiagnosis] = useState(false);
  const [diagnosisSessionId, setDiagnosisSessionId] = useState<string | null>(null);
  const [showFrpcDialog, setShowFrpcDialog] = useState(false);

  const statusColor = {
    active: '#10b981',
    production: '#3b82f6',
    archived: '#6b7280',
    stable: '#8b5cf6',
    reference: '#f59e0b',
    external: '#ec4899'
  }[project.status] || '#6b7280';

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
    setErrorDetails(null);
    try {
      const result = await startProject(name);

      // 检查是否有警告
      if (result.warning) {
        setMessage(result.warning);
        setMessageType('warning');
      } else if (result.configUpdated) {
        setMessage(`端口已自动调整为 ${result.newPort}，前端配置已同步更新`);
        setMessageType('success');
      } else if (result.linkedProjectStarted && result.linkedProjectName) {
        setMessage(`已启动项目及关联后端 ${result.linkedProjectName}`);
        setMessageType('success');
      } else {
        setMessage('项目启动成功');
        setMessageType('success');
      }

      setTimeout(async () => {
        const status = await getRunningStatus(name);
        setRunningStatus(status);
      }, 1000);

    } catch (error: any) {
      console.error('启动失败:', error);

      if (error.type === 'PORT_CONFLICT') {
        // 端口冲突
        setMessage(`端口 ${error.targetPort} 被占用${error.occupiedBy ? ` (${error.occupiedBy.name})` : ''}`);
        setMessageType('error');
        setErrorDetails({
          type: 'PORT_CONFLICT',
          ...error
        });
      } else if (error.type === 'STARTUP_FAILED') {
        // 启动失败
        setMessage(`启动失败: ${error.message || error.error}`);
        setMessageType('error');
        setErrorDetails({
          type: 'STARTUP_FAILED',
          logs: error.logs,
          exitCode: error.exitCode
        });
      } else {
        // 其他错误
        setMessage(error.message || '启动失败');
        setMessageType('error');
      }

      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    setIsStopping(true);
    setMessage('');
    try {
      // 检查是否有关联项目
      const hasLinkedProject = status?.dbPortConfig?.linkedProject;
      let stopLinked = false;
      
      if (hasLinkedProject) {
        // 询问用户是否同时停止关联项目
        stopLinked = confirm(
          `是否同时停止关联的后端项目 "${status.dbPortConfig.linkedProject}"？\n\n` +
          `点击"确定"将同时停止，点击"取消"仅停止当前项目。`
        );
      }
      
      const result = await stopProject(name, stopLinked);
      
      if (result.stoppedProjects && result.stoppedProjects.length > 1) {
        setMessage(`已停止 ${result.stoppedProjects.length} 个项目: ${result.stoppedProjects.join(', ')}`);
      } else {
        setMessage('项目已停止');
      }
      
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

  const handleDiagnose = async () => {
    setIsDiagnosing(true);
    setMessage('');
    try {
      const result = await diagnoseProject(name);
      setDiagnosisSessionId(result.sessionId);
      setShowDiagnosis(true);
      setMessage(`AI 诊断已启动 - 检测到 ${result.failedInfo.errorCount} 个错误`);
      setMessageType('success');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '启动诊断失败');
      setMessageType('error');
      setIsDiagnosing(false);
    } finally {
      setTimeout(() => setMessage(''), 5000);
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
            {/* 关联项目指示器 */}
            {status?.dbPortConfig?.linkedProject && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 8px',
                background: '#e0e7ff',
                borderRadius: '12px',
                fontSize: '11px',
                color: '#4f46e5'
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <span>{status.dbPortConfig.linkedProject}</span>
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

      {/* 端口配置信息 */}
      {(status?.portConfig || status?.dbPortConfig) && (
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          padding: '8px 12px',
          background: '#f9fafb',
          borderRadius: '6px',
          fontSize: '13px'
        }}>
          {/* 项目类型 */}
          {(status.portConfig?.detectedType || status.dbPortConfig?.projectType) && (
            <span style={{
              padding: '2px 8px',
              background: '#e0e7ff',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '500',
              color: '#4f46e5',
              textTransform: 'uppercase'
            }}>
              {status.portConfig?.detectedType || status.dbPortConfig?.projectType}
            </span>
          )}

          {/* 前端端口 */}
          {(status.portConfig?.frontendPort || status.dbPortConfig?.frontendPort) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#6b7280', fontSize: '11px' }}>前端:</span>
              <span style={{
                padding: '2px 6px',
                background: '#dcfce7',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: '500',
                color: '#16a34a',
                fontFamily: 'monospace'
              }}>
                :{status.portConfig?.frontendPort || status.dbPortConfig?.frontendPort}
              </span>
            </div>
          )}

          {/* 后端端口 */}
          {(status.portConfig?.backendPort || status.dbPortConfig?.backendPort) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#6b7280', fontSize: '11px' }}>后端:</span>
              <span style={{
                padding: '2px 6px',
                background: '#dbeafe',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: '500',
                color: '#2563eb',
                fontFamily: 'monospace'
              }}>
                :{status.portConfig?.backendPort || status.dbPortConfig?.backendPort}
              </span>
            </div>
          )}
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
        {errorDetails && (
          <QuickButton
            icon={isDiagnosing ? <Loader size={14} /> : <Stethoscope size={14} />}
            label="AI诊断"
            onClick={handleDiagnose}
            disabled={isDiagnosing}
            color="#ef4444"
            title="让 AI 分析启动失败原因"
          />
        )}
        {onEdit && (
          <QuickButton
            icon={<Settings size={14} />}
            label="编辑"
            onClick={() => onEdit(name, project)}
            color="#3b82f6"
          />
        )}
        {(project.frontend_port || project.backend_port) && (
          <QuickButton
            icon={<Globe size={14} />}
            label="穿透"
            onClick={() => setShowFrpcDialog(true)}
            color="#8b5cf6"
          />
        )}
      </div>

      {/* 消息提示 */}
      {message && (
        <div style={{
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '13px',
          background: messageType === 'error' ? '#fef2f2' : messageType === 'warning' ? '#fffbeb' : '#f0fdf4',
          color: messageType === 'error' ? '#ef4444' : messageType === 'warning' ? '#f59e0b' : '#10b981',
          border: `1px solid ${messageType === 'error' ? '#fecaca' : messageType === 'warning' ? '#fde68a' : '#bbf7d0'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {messageType === 'error' && <AlertCircle size={14} />}
            {messageType === 'warning' && <AlertTriangle size={14} />}
            <span>{message}</span>
          </div>
          {errorDetails && (
            <button
              onClick={() => setShowErrorDetails(true)}
              style={{
                padding: '2px 8px',
                background: 'rgba(0,0,0,0.05)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'inherit'
              }}
            >
              查看详情
            </button>
          )}
        </div>
      )}

      {/* 错误详情弹窗 */}
      {showErrorDetails && errorDetails && (
        <div
          onClick={() => setShowErrorDetails(false)}
          style={{
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
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              width: '90%'
            }}
          >
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                {errorDetails.type === 'PORT_CONFLICT' ? '端口冲突' : '启动失败'}
              </h3>
              <button
                onClick={() => setShowErrorDetails(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>

            {errorDetails.type === 'PORT_CONFLICT' ? (
              <div>
                <p style={{ marginBottom: '12px' }}>
                  端口 <strong>{errorDetails.targetPort}</strong> 已被占用
                </p>
                {errorDetails.occupiedBy && (
                  <div style={{
                    background: '#f9fafb',
                    padding: '12px',
                    borderRadius: '6px',
                    marginBottom: '12px'
                  }}>
                    <strong>占用进程:</strong>
                    <div style={{ marginTop: '8px', fontSize: '14px', fontFamily: 'monospace' }}>
                      <div>进程名: {errorDetails.occupiedBy.name}</div>
                      <div>PID: {errorDetails.occupiedBy.pid}</div>
                      <div>用户: {errorDetails.occupiedBy.user}</div>
                    </div>
                  </div>
                )}
                {errorDetails.suggestedPort && (
                  <p style={{ marginTop: '12px' }}>
                    建议使用端口: <strong>{errorDetails.suggestedPort}</strong>
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p style={{ marginBottom: '12px' }}>
                  {errorDetails.exitCode !== undefined && `退出码: ${errorDetails.exitCode}`}
                </p>
                {errorDetails.logs && errorDetails.logs.length > 0 && (
                  <div>
                    <strong>错误日志:</strong>
                    <div style={{
                      background: '#1f2937',
                      color: '#f9fafb',
                      padding: '12px',
                      borderRadius: '6px',
                      marginTop: '8px',
                      maxHeight: '400px',
                      overflow: 'auto',
                      fontSize: '13px',
                      fontFamily: 'monospace'
                    }}>
                      {errorDetails.logs.map((log: any, index: number) => (
                        <div key={index} style={{ marginBottom: '4px' }}>
                          <span style={{ color: log.type === 'stderr' ? '#fca5a5' : '#d1d5db' }}>
                            {log.content}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI 诊断对话框 */}
      {showDiagnosis && diagnosisSessionId && (
        <AiDialog
          projectName={name}
          onClose={() => {
            setShowDiagnosis(false);
            setIsDiagnosing(false);
            setDiagnosisSessionId(null);
          }}
          embedded={false}
        />
      )}

      {/* Frpc 配置对话框 */}
      {showFrpcDialog && (
        <FrpcConfigDialog
          projectName={name}
          frontendPort={project.frontend_port}
          backendPort={project.backend_port}
          onClose={() => setShowFrpcDialog(false)}
        />
      )}
    </div>
  );
}

function QuickButton({ icon, label, onClick, disabled, color = '#6b7280', title }: any) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={title}
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

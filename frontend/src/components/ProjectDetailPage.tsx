import { useState, useEffect } from 'react';
import { X, Folder, GitBranch, Package, Code, Play, Square, FolderOpen, Bot, Activity, Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { Project, ProjectStatus } from '../types';
import { executeAction, startProject, stopProject, getRunningStatus, getProjectAnalysis, analyzeProject, getFrpcConfig, getFrpcStatus } from '../api';
import AnalysisDialog from './AnalysisDialog';
import { FileExplorer } from './FileExplorer';
import { CodeEditor } from './CodeEditor';
import { TodoManager } from './TodoManager';
import LogViewer from './LogViewer';
import AiDialog from './AiDialog';
import AIStats from './AIStats';
import FrpcConfigDialog from './FrpcConfigDialog';

interface Props {
  name: string;
  project: Project;
  status?: ProjectStatus;
  onClose: () => void;
  onRefresh: () => void;
  onEdit?: () => void;  // 新增：编辑项目回调
}

type TabType = 'overview' | 'files' | 'todos' | 'logs' | 'ai' | 'analysis' | 'ai-stats';

export default function ProjectDetailPage({ name, project, status, onClose, onRefresh, onEdit }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [runningStatus, setRunningStatus] = useState<any>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [message, setMessage] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [frpcConfig, setFrpcConfig] = useState<any>(null);
  const [frpcStatus, setFrpcStatus] = useState<any>(null);
  const [showFrpcDialog, setShowFrpcDialog] = useState(false);

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

  // 加载分析结果
  useEffect(() => {
    const loadAnalysis = async () => {
      try {
        const data = await getProjectAnalysis(name);
        setAnalysis(data);
      } catch (error) {
        // 项目尚未分析
      }
    };
    loadAnalysis();
  }, [name]);

  // 加载 FRPC 配置
  useEffect(() => {
    const loadFrpcConfig = async () => {
      try {
        const config = await getFrpcConfig(name);
        setFrpcConfig(config);
        if (config && config.enabled) {
          const status = await getFrpcStatus(name);
          setFrpcStatus(status);
        }
      } catch (error) {
        // 项目可能没有配置 FRPC
        console.debug('加载 FRPC 配置失败:', error);
      }
    };
    loadFrpcConfig();
  }, [name]);

  const handleAction = async (action: string) => {
    setMessage('');
    try {
      const result = await executeAction(name, { action });
      setMessage(result.message || '操作成功');
      onRefresh();
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

  const tabs = [
    { id: 'overview', label: '概览', icon: <Activity size={16} /> },
    { id: 'files', label: '文件', icon: <FileText size={16} /> },
    { id: 'todos', label: '任务', icon: <Code size={16} /> },
    { id: 'logs', label: '日志', icon: <Folder size={16} /> },
    { id: 'ai', label: 'AI 编程', icon: <Bot size={16} /> },
    { id: 'ai-stats', label: 'AI 费用', icon: <Activity size={16} /> },
    { id: 'analysis', label: '项目分析', icon: <GitBranch size={16} /> },
  ] as const;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '16px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '1400px',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Folder size={32} color={statusColor} />
            <div>
              <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: '#111827' }}>
                {name}
              </h2>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>
                {project.description}
              </p>
            </div>
          </div>
          
          {/* 右侧按钮组 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* 编辑按钮 */}
            {onEdit && (
              <button
                onClick={onEdit}
                style={{
                  padding: '8px 16px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                编辑项目
              </button>
            )}
            
            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              style={{
                padding: '8px',
                background: 'transparent',
                border: 'none',
                borderRadius: '9999px',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left Sidebar */}
          <div style={{
            width: sidebarCollapsed ? '80px' : '280px',
            borderRight: '1px solid #e5e7eb',
            padding: sidebarCollapsed ? '16px 8px' : '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            overflowY: 'auto',
            transition: 'width 0.3s ease, padding 0.3s ease',
            position: 'relative'
          }}>
            {/* Toggle Button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '-12px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'white',
                border: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                zIndex: 10,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f9fafb';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }}
            >
              {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            {sidebarCollapsed ? (
              /* Collapsed View - Icons Only */
              <>
                {/* Status Icon */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                  paddingTop: '24px'
                }}>
                  <div
                    title="状态"
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: '#f3f4f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <Activity size={20} color="#6b7280" />
                  </div>

                  {/* Running Status Indicator */}
                  {runningStatus?.running && (
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      background: '#10b981',
                      animation: 'pulse 2s infinite'
                    }} />
                  )}

                  {/* Action Icons */}
                  {runningStatus?.running ? (
                    <div
                      title="停止服务"
                      onClick={handleStop}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        background: '#fef2f2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: isStopping ? 'not-allowed' : 'pointer',
                        opacity: isStopping ? 0.5 : 1
                      }}
                    >
                      <Square size={20} color="#ef4444" />
                    </div>
                  ) : (
                    <div
                      title="启动服务"
                      onClick={handleStart}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        background: '#dcfce7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: isStarting ? 'not-allowed' : 'pointer',
                        opacity: isStarting ? 0.5 : 1
                      }}
                    >
                      <Play size={20} color="#10b981" />
                    </div>
                  )}

                  <div
                    title="打开目录"
                    onClick={() => handleAction('open-directory')}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: '#f3f4f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <FolderOpen size={20} color="#6b7280" />
                  </div>

                  <div
                    title="VSCode"
                    onClick={() => handleAction('open-vscode')}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: '#f3f4f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <Code size={20} color="#6b7280" />
                  </div>

                  {status?.hasDependencies && !status?.dependenciesInstalled && (
                    <div
                      title="安装依赖"
                      onClick={() => handleAction('install-deps')}
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '8px',
                        background: '#dbeafe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <Package size={20} color="#3b82f6" />
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Expanded View - Full Content */
              <>
                {/* Status */}
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', marginBottom: '12px' }}>
                    状态
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <StatusItem
                      label="分类"
                      value={project.status}
                      color={statusColor}
                    />
                    {status && (
                      <>
                        <StatusItem
                          label="Git"
                          value={status.hasGit ? (status.gitBranch || 'N/A') : '未初始化'}
                          color={status.hasGit ? '#10b981' : '#6b7280'}
                        />
                        <StatusItem
                          label="未提交"
                          value={status.uncommittedFiles > 0 ? `${status.uncommittedFiles} 个` : '无'}
                          color={status.uncommittedFiles > 0 ? '#f59e0b' : '#10b981'}
                        />
                        <StatusItem
                          label="依赖"
                          value={status.dependenciesInstalled ? '已安装' : '未安装'}
                          color={status.dependenciesInstalled ? '#10b981' : '#ef4444'}
                        />
                      </>
                    )}
                    {runningStatus?.running && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        background: '#dcfce7',
                        borderRadius: '6px',
                        marginTop: '4px'
                      }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#16a34a',
                          animation: 'pulse 2s infinite'
                        }} />
                        <span style={{ fontSize: '14px', color: '#16a34a', fontWeight: '500' }}>
                          服务运行中
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tech Stack */}
                {project.stack && project.stack.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', marginBottom: '12px' }}>
                      技术栈
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {project.stack.map(tech => (
                        <span key={tech} style={{
                          padding: '4px 8px',
                          background: '#f3f4f6',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#374151'
                        }}>
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#6b7280', marginBottom: '12px' }}>
                    操作
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {runningStatus?.running ? (
                      <ActionButton
                        icon={<Square size={16} />}
                        label="停止服务"
                        onClick={handleStop}
                        disabled={isStopping}
                        variant="danger"
                        fullWidth
                      />
                    ) : (
                      <ActionButton
                        icon={<Play size={16} />}
                        label="启动服务"
                        onClick={handleStart}
                        disabled={isStarting}
                        variant="success"
                        fullWidth
                      />
                    )}
                    <ActionButton
                      icon={<FolderOpen size={16} />}
                      label="打开目录"
                      onClick={() => handleAction('open-directory')}
                      fullWidth
                    />
                    <ActionButton
                      icon={<Code size={16} />}
                      label="VSCode"
                      onClick={() => handleAction('open-vscode')}
                      fullWidth
                    />
                    {status?.hasDependencies && !status?.dependenciesInstalled && (
                      <ActionButton
                        icon={<Package size={16} />}
                        label="安装依赖"
                        onClick={() => handleAction('install-deps')}
                        variant="primary"
                        fullWidth
                      />
                    )}
                  </div>
                </div>

                {/* Message */}
                {message && (
                  <div style={{
                    padding: '12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    background: message.includes('失败') || message.includes('错误') ? '#fef2f2' : '#f0fdf4',
                    color: message.includes('失败') || message.includes('错误') ? '#ef4444' : '#10b981',
                    border: `1px solid ${message.includes('失败') || message.includes('错误') ? '#fecaca' : '#bbf7d0'}`
                  }}>
                    {message}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Tabs */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #e5e7eb',
              padding: '0 24px',
              gap: '4px'
            }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '12px 16px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                    borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.color = '#374151';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.color = '#6b7280';
                    }
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {activeTab === 'overview' && (
                <OverviewTab 
                  project={project} 
                  status={status} 
                  runningStatus={runningStatus}
                  frpcConfig={frpcConfig}
                  frpcStatus={frpcStatus}
                  onConfigureFrpc={() => setShowFrpcDialog(true)}
                />
              )}
              {activeTab === 'files' && (
                <div style={{ height: '100%', display: 'flex' }}>
                  {/* 文件树 */}
                  <div style={{
                    width: '300px',
                    borderRight: '1px solid #e5e7eb',
                    height: '100%',
                    overflow: 'hidden'
                  }}>
                    <FileExplorer
                      projectName={name}
                      onFileSelect={(filePath) => setSelectedFilePath(filePath)}
                    />
                  </div>
                  {/* 编辑器 */}
                  <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                    <CodeEditor
                      projectName={name}
                      filePath={selectedFilePath}
                    />
                  </div>
                </div>
              )}
              {activeTab === 'todos' && (
                <div style={{ height: '100%', position: 'relative' }}>
                  <TodoManager projectName={name} embedded />
                </div>
              )}
              {activeTab === 'logs' && (
                <div style={{ height: '100%', position: 'relative' }}>
                  {runningStatus?.running ? (
                    <LogViewer projectName={name} embedded />
                  ) : (
                    <div style={{ padding: '24px', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
                      <p style={{ color: '#6b7280', fontSize: '16px' }}>项目未运行，启动项目后可查看日志</p>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'ai' && (
                <div style={{ height: '100%', position: 'relative' }}>
                  <AiDialog projectName={name} embedded />
                </div>
              )}
              {activeTab === 'ai-stats' && (
                <div style={{ height: '100%', overflowY: 'auto' }}>
                  <AIStats projectName={name} />
                </div>
              )}
              {activeTab === 'analysis' && (
                <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>
                    项目分析
                  </h3>

                  {analysis?.analyzed ? (
                    <div>
                      <p style={{ color: '#6b7280', marginBottom: '16px' }}>
                        项目已分析，点击下方按钮查看完整的分析报告
                      </p>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          onClick={() => setShowAnalysisDialog(true)}
                          style={{
                            padding: '10px 20px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          查看分析报告
                        </button>
                        <button
                          onClick={handleAnalyze}
                          disabled={isAnalyzing}
                          style={{
                            padding: '10px 20px',
                            background: isAnalyzing ? '#9ca3af' : 'white',
                            color: isAnalyzing ? 'white' : '#374151',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Search size={16} />
                          {isAnalyzing ? '重新分析中...' : '重新分析'}
                        </button>
                      </div>

                      {/* 快速预览 */}
                      <div style={{
                        marginTop: '24px',
                        padding: '16px',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '16px'
                        }}>
                          {analysis.framework && (
                            <QuickInfo label="框架" value={analysis.framework} />
                          )}
                          {analysis.start_command && (
                            <QuickInfo label="启动命令" value={analysis.start_command} monospace />
                          )}
                          {analysis.port && (
                            <QuickInfo label="端口" value={analysis.port.toString()} />
                          )}
                          {analysis.file_count > 0 && (
                            <QuickInfo label="文件数" value={analysis.file_count.toString()} />
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ color: '#6b7280', marginBottom: '16px' }}>
                        {isAnalyzing
                          ? '正在分析项目...'
                          : '项目尚未分析，点击下方按钮开始分析'}
                      </p>
                      <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        style={{
                          padding: '10px 20px',
                          background: isAnalyzing ? '#9ca3af' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Search size={16} />
                        {isAnalyzing ? '分析中...' : '开始分析'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Dialog */}
      {showAnalysisDialog && analysis && (
        <AnalysisDialog
          projectName={name}
          analysis={analysis}
          onClose={() => setShowAnalysisDialog(false)}
          onApplied={() => {
            onRefresh();
            // 重新加载分析结果
            getProjectAnalysis(name).then(data => setAnalysis(data)).catch(() => {});
          }}
        />
      )}

      {/* FRPC Config Dialog */}
      {showFrpcDialog && (
        <FrpcConfigDialog
          projectName={name}
          onClose={() => setShowFrpcDialog(false)}
          onSuccess={async () => {
            setShowFrpcDialog(false);
            // 重新加载 FRPC 配置
            try {
              const config = await getFrpcConfig(name);
              setFrpcConfig(config);
              if (config && config.enabled) {
                const status = await getFrpcStatus(name);
                setFrpcStatus(status);
              }
            } catch (error) {
              console.error('重新加载 FRPC 配置失败:', error);
            }
          }}
        />
      )}
    </div>
  );
}

function OverviewTab({ project, status, runningStatus, frpcConfig, frpcStatus, onConfigureFrpc }: any) {
  return (
    <div style={{ padding: '24px', overflowY: 'auto', height: '100%' }}>
      <div style={{ maxWidth: '800px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>
          项目概览
        </h3>

        {/* 基本信息 */}
        <div style={{
          background: '#f9fafb',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '16px'
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#6b7280' }}>
            基本信息
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {status && (
              <>
                <InfoItem label="项目路径" value={status.path || 'N/A'} />
                <InfoItem label="Git 分支" value={status.gitBranch || '未初始化'} />
                <InfoItem label="未提交文件" value={status.uncommittedFiles?.toString() || '0'} />
                <InfoItem label="依赖状态" value={status.dependenciesInstalled ? '已安装' : '未安装'} />
              </>
            )}
            {runningStatus?.running && (
              <InfoItem label="进程状态" value="运行中" valueColor="#10b981" />
            )}
          </div>
        </div>

        {/* 端口配置 */}
        {(project.port || project.frontendPort || project.backendPort || status?.portConfig || status?.dbPortConfig) && (
          <div style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '16px'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#0369a1' }}>
              端口配置
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* 显示数据库中的配置 */}
              {status?.dbPortConfig?.projectType && (
                <InfoItem 
                  label="项目类型" 
                  value={{
                    'frontend': '纯前端',
                    'backend': '纯后端',
                    'fullstack': '全栈(前后端分离)',
                    'unknown': '未知'
                  }[status.dbPortConfig.projectType] || status.dbPortConfig.projectType}
                />
              )}
              {status?.dbPortConfig?.frontendPort && (
                <InfoItem 
                  label="前端端口" 
                  value={status.dbPortConfig.frontendPort.toString()}
                  valueColor="#16a34a"
                />
              )}
              {status?.dbPortConfig?.backendPort && (
                <InfoItem 
                  label="后端端口" 
                  value={status.dbPortConfig.backendPort.toString()}
                  valueColor="#2563eb"
                />
              )}
              {status?.dbPortConfig?.linkedProject && (
                <InfoItem 
                  label="关联项目" 
                  value={status.dbPortConfig.linkedProject}
                  valueColor="#7c3aed"
                />
              )}
              {/* 兼容旧的 port 字段 */}
              {project.port && !status?.dbPortConfig?.frontendPort && !status?.dbPortConfig?.backendPort && (
                <InfoItem 
                  label="端口(旧)" 
                  value={project.port.toString()}
                  valueColor="#6b7280"
                />
              )}
              {/* 显示实时检测的配置(如果有) */}
              {status?.portConfig && (
                <>
                  {status.portConfig.detectedType && (
                    <InfoItem 
                      label="检测到的框架" 
                      value={status.portConfig.detectedType}
                      valueColor="#8b5cf6"
                    />
                  )}
                  {status.portConfig.configPath && (
                    <InfoItem 
                      label="配置文件" 
                      value={status.portConfig.configPath}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* FRPC 内网穿透配置 */}
        {frpcConfig && frpcConfig.enabled && (
          <div style={{
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            padding: '20px',
            marginBottom: '16px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  内网穿透 (FRPC)
                </h4>
                <button
                  onClick={onConfigureFrpc}
                  style={{
                    padding: '4px 12px',
                    background: 'white',
                    color: '#92400e',
                    border: '1px solid #fcd34d',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#fef3c7'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v6m0 6v6M5.6 5.6l4.2 4.2m4.2 4.2l4.2 4.2M1 12h6m6 0h6M5.6 18.4l4.2-4.2m4.2-4.2l4.2-4.2"/>
                  </svg>
                  配置
                </button>
              </div>
              {frpcStatus?.running && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 12px',
                  background: '#dcfce7',
                  color: '#16a34a',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#16a34a'
                  }} />
                  运行中
                </span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <InfoItem
                label="协议"
                value={frpcConfig.protocol || 'http'}
              />
              {/* TCP 模式显示端口 */}
              {frpcConfig.protocol === 'tcp' && frpcStatus?.urls && frpcStatus.urls.length > 0 && (
                <>
                  {frpcStatus.urls.map((url: any, index: number) => (
                    <InfoItem
                      key={index}
                      label={url.type === 'frontend' ? '前端地址' : '后端地址'}
                      value={url.url}
                      valueColor={url.type === 'frontend' ? '#16a34a' : '#2563eb'}
                    />
                  ))}
                </>
              )}
              {/* HTTP/HTTPS 模式显示子域名 */}
              {frpcConfig.protocol !== 'tcp' && frpcConfig.frontend_enabled && frpcConfig.frontend_subdomain && (
                <InfoItem
                  label="前端域名"
                  value={frpcConfig.frontend_custom_domain || `${frpcConfig.frontend_subdomain}.example.com`}
                  valueColor="#16a34a"
                />
              )}
              {frpcConfig.protocol !== 'tcp' && frpcConfig.backend_enabled && frpcConfig.backend_subdomain && (
                <InfoItem
                  label="后端域名"
                  value={frpcConfig.backend_custom_domain || `${frpcConfig.backend_subdomain}.example.com`}
                  valueColor="#2563eb"
                />
              )}
              {frpcConfig.use_encryption && (
                <InfoItem
                  label="加密"
                  value="已启用"
                  valueColor="#10b981"
                />
              )}
              {frpcConfig.use_compression && (
                <InfoItem
                  label="压缩"
                  value="已启用"
                  valueColor="#10b981"
                />
              )}
            </div>
          </div>
        )}

        {/* FRPC 配置入口（未启用时显示） */}
        {!frpcConfig?.enabled && (
          <div style={{
            background: '#fffbeb',
            border: '1px dashed #fcd34d',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
                  内网穿透 (FRPC)
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  将本地项目暴露到公网，方便远程访问和协作
                </div>
              </div>
            </div>
            <button
              onClick={onConfigureFrpc}
              style={{
                padding: '8px 16px',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#d97706'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#f59e0b'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              启用 FRPC
            </button>
          </div>
        )}

        <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#111827' }}>
          描述
        </h4>
        <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.6' }}>
          {project.description || '暂无描述'}
        </p>
      </div>
    </div>
  );
}

function StatusItem({ label, value, color }: any) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
      <span style={{ color: '#6b7280' }}>{label}:</span>
      <span style={{ fontWeight: '500', color }}>{value}</span>
    </div>
  );
}

function InfoItem({ label, value, valueColor }: any) {
  return (
    <div>
      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
      <div style={{
        fontSize: '14px',
        fontWeight: '500',
        color: valueColor || '#111827',
        wordBreak: 'break-all'
      }}>
        {value}
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, disabled, variant = 'default', fullWidth }: any) {
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
        justifyContent: 'center',
        gap: '8px',
        padding: '10px 16px',
        border: style.border,
        borderRadius: '6px',
        background: style.background,
        color: style.color,
        fontSize: '14px',
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s',
        width: fullWidth ? '100%' : 'auto'
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

function QuickInfo({ label, value, monospace }: { label: string; value: string; monospace?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
      <div style={{
        fontSize: '14px',
        fontWeight: '500',
        color: '#111827',
        fontFamily: monospace ? 'monospace' : 'inherit',
        wordBreak: 'break-all'
      }}>
        {value}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { RefreshCw, Folder, Activity, Play, Square, CheckSquare, Square as SquareIcon, Settings as SettingsIcon, Search, Plus, Sparkles } from 'lucide-react';
import { ProjectsConfig, ProjectStatus } from './types';
import { fetchProjects, fetchBatchStatus, batchOperation, analyzeAllProjects, getAnalysisStats } from './api';
import ProjectCard from './components/ProjectCard';
import Settings from './components/Settings';
import ProjectConfigDialog from './components/ProjectConfigDialog';
import ProjectCreationDialog from './components/ProjectCreationDialog';
import ProjectDetailPage from './components/ProjectDetailPage';
import { TodoManager } from './components/TodoManager';
import LogViewer from './components/LogViewer';
import AiDialog from './components/AiDialog';

export default function App() {
  const [config, setConfig] = useState<ProjectsConfig | null>(null);
  const [statuses, setStatuses] = useState<Map<string, ProjectStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStats, setAnalysisStats] = useState<any>(null);
  const [showProjectConfig, setShowProjectConfig] = useState(false);
  const [projectConfigMode, setProjectConfigMode] = useState<'add' | 'edit'>('add');
  const [editingProject, setEditingProject] = useState<{ name: string; project: any } | null>(null);
  const [showProjectCreation, setShowProjectCreation] = useState(false);
  const [detailProjectName, setDetailProjectName] = useState<string | null>(null);
  const [showTodoManager, setShowTodoManager] = useState<string | null>(null);
  const [showLogViewer, setShowLogViewer] = useState<string | null>(null);
  const [showAiDialog, setShowAiDialog] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    loadAnalysisStats();

    // 监听从 ProjectDetailPage 发出的事件
    const handleOpenTodoManager = (e: CustomEvent) => {
      setShowTodoManager(e.detail.projectName);
    };
    const handleOpenLogViewer = (e: CustomEvent) => {
      setShowLogViewer(e.detail.projectName);
    };
    const handleOpenAiDialog = (e: CustomEvent) => {
      setShowAiDialog(e.detail.projectName);
    };

    window.addEventListener('openTodoManager' as any, handleOpenTodoManager as any);
    window.addEventListener('openLogViewer' as any, handleOpenLogViewer as any);
    window.addEventListener('openAiDialog' as any, handleOpenAiDialog as any);

    return () => {
      window.removeEventListener('openTodoManager' as any, handleOpenTodoManager as any);
      window.removeEventListener('openLogViewer' as any, handleOpenLogViewer as any);
      window.removeEventListener('openAiDialog' as any, handleOpenAiDialog as any);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchProjects();
      setConfig(data);

      // 批量获取活跃项目状态
      if (data.active && data.active.length > 0) {
        const statusList = await fetchBatchStatus(data.active);
        const statusMap = new Map<string, ProjectStatus>();
        statusList.forEach(status => {
          if (!status.error) {
            statusMap.set(status.name, status);
          }
        });
        setStatuses(statusMap);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysisStats = async () => {
    try {
      const stats = await getAnalysisStats();
      setAnalysisStats(stats);
    } catch (error) {
      console.error('加载分析统计失败:', error);
    }
  };

  const handleAnalyzeAll = async () => {
    if (!confirm('确定要批量分析所有项目吗？这可能需要一些时间。')) {
      return;
    }

    setIsAnalyzing(true);
    try {
      await analyzeAllProjects(false);
      alert('批量分析任务已启动！分析完成后会自动更新项目信息。');
      // 开始轮询分析状态
      const pollInterval = setInterval(async () => {
        const stats = await getAnalysisStats();
        setAnalysisStats(stats);
        if (stats.analyzing_count === 0) {
          clearInterval(pollInterval);
          setIsAnalyzing(false);
          alert('批量分析已完成！');
          await loadData();
        }
      }, 5000);
      // 5分钟后超时
      setTimeout(() => {
        clearInterval(pollInterval);
        setIsAnalyzing(false);
      }, 300000);
    } catch (error) {
      alert(error instanceof Error ? error.message : '启动批量分析失败');
      setIsAnalyzing(false);
    }
  };

  const toggleProjectSelection = (projectName: string) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectName)) {
      newSelected.delete(projectName);
    } else {
      newSelected.add(projectName);
    }
    setSelectedProjects(newSelected);
  };

  const handleBatchOperation = async (action: 'start' | 'stop' | 'restart') => {
    if (selectedProjects.size === 0) return;

    setBatchLoading(true);
    try {
      await batchOperation(action, Array.from(selectedProjects));
      alert(`成功${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'} ${selectedProjects.size} 个项目`);
      setSelectedProjects(new Set());
      setSelectionMode(false);
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '批量操作失败');
    } finally {
      setBatchLoading(false);
    }
  };

  if (loading || !config) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '12px',
        color: '#6b7280'
      }}>
        <RefreshCw className="animate-spin" size={24} />
        <span>加载中...</span>
      </div>
    );
  }

  // 过滤项目（合并本地项目和外部项目）
  const getFilteredProjects = () => {
    // 合并本地项目和外部项目
    const allProjects = { ...config.projects };
    if (config.external) {
      Object.entries(config.external).forEach(([name, project]) => {
        allProjects[name] = { ...project, status: 'external' as any };
      });
    }

    if (filter === 'all') return Object.entries(allProjects);
    if (filter === 'active') {
      return Object.entries(allProjects).filter(([name]) => config.active.includes(name));
    }
    if (filter === 'archived') {
      return Object.entries(allProjects).filter(([name]) => config.archived.includes(name));
    }
    if (filter === 'external') {
      return Object.entries(allProjects).filter(([, project]) => project.status === 'external');
    }
    return Object.entries(allProjects).filter(([, project]) => project.status === filter);
  };

  const filteredProjects = getFilteredProjects();

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      {/* Header */}
      <header style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '20px 40px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Folder size={28} color="#3b82f6" />
              <h1 style={{ fontSize: '24px', fontWeight: '600' }}>CCMage</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                <span>总计: {config.meta?.totalProjects || 0} 个</span>
                <span>|</span>
                <span>活跃: {config.meta?.activeProjects || 0} 个</span>
                {analysisStats && (
                  <>
                    <span>|</span>
                    <span>已分析: {analysisStats.analyzed_count || 0} 个</span>
                    {analysisStats.analyzing_count > 0 && (
                      <span style={{ color: '#f59e0b' }}>
                        (分析中: {analysisStats.analyzing_count})
                      </span>
                    )}
                  </>
                )}
              </div>
              <button
                onClick={handleAnalyzeAll}
                disabled={isAnalyzing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  background: isAnalyzing ? '#9ca3af' : '#8b5cf6',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                  opacity: isAnalyzing ? 0.7 : 1
                }}
              >
                <Search size={16} />
                {isAnalyzing ? '分析中...' : '批量分析'}
              </button>
              <button
                onClick={() => setShowProjectCreation(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)'
                }}
              >
                <Sparkles size={16} />
                AI 创建项目
              </button>
              <button
                onClick={() => {
                  setProjectConfigMode('add');
                  setEditingProject(null);
                  setShowProjectConfig(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#10b981',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} />
                手动添加项目
              </button>
              <button
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setSelectedProjects(new Set());
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  background: selectionMode ? '#3b82f6' : 'white',
                  color: selectionMode ? 'white' : '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <CheckSquare size={16} />
                {selectionMode ? '退出多选' : '批量操作'}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <SettingsIcon size={16} />
                设置
              </button>
              <button
                onClick={loadData}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={16} />
                刷新
              </button>
            </div>
          </div>

          {/* Filters */}
          <div style={{ marginTop: '20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { key: 'all', label: '全部' },
              { key: 'active', label: '活跃项目' },
              { key: 'production', label: '生产项目' },
              { key: 'external', label: '外部项目' },
              { key: 'archived', label: '归档项目' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: '6px 12px',
                  border: filter === key ? 'none' : '1px solid #e5e7eb',
                  borderRadius: '6px',
                  background: filter === key ? '#3b82f6' : 'white',
                  color: filter === key ? 'white' : '#374151',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ padding: '40px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* 批量操作工具栏 */}
        {selectionMode && selectedProjects.size > 0 && (
          <div style={{
            marginBottom: '24px',
            padding: '16px 20px',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              已选择 <strong style={{ color: '#3b82f6' }}>{selectedProjects.size}</strong> 个项目
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleBatchOperation('start')}
                disabled={batchLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#10b981',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: batchLoading ? 'not-allowed' : 'pointer',
                  opacity: batchLoading ? 0.5 : 1
                }}
              >
                <Play size={16} />
                批量启动
              </button>
              <button
                onClick={() => handleBatchOperation('stop')}
                disabled={batchLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: batchLoading ? 'not-allowed' : 'pointer',
                  opacity: batchLoading ? 0.5 : 1
                }}
              >
                <Square size={16} />
                批量停止
              </button>
              <button
                onClick={() => handleBatchOperation('restart')}
                disabled={batchLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: batchLoading ? 'not-allowed' : 'pointer',
                  opacity: batchLoading ? 0.5 : 1
                }}
              >
                <RefreshCw size={16} />
                批量重启
              </button>
            </div>
          </div>
        )}

        {filteredProjects.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#6b7280'
          }}>
            <Folder size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
            <p>暂无项目</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: '24px'
          }}>
            {filteredProjects.map(([name, project]) => (
              <ProjectCard
                key={name}
                name={name}
                project={project}
                status={statuses.get(name)}
                onAction={loadData}
                onOpenDetail={(projectName) => setDetailProjectName(projectName)}
                onEdit={(projectName, projectData) => {
                  setProjectConfigMode('edit');
                  setEditingProject({ name: projectName, project: projectData });
                  setShowProjectConfig(true);
                }}
                selectionMode={selectionMode}
                isSelected={selectedProjects.has(name)}
                onSelect={() => toggleProjectSelection(name)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        marginTop: '40px',
        padding: '20px',
        textAlign: 'center',
        color: '#9ca3af',
        fontSize: '14px'
      }}>
        <p>CCMage v1.2.0 - 专为 Vibe Coding 开发者打造 | 运行在端口 9999</p>
      </footer>

      {/* Settings Modal */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      {/* Project Config Dialog */}
      {showProjectConfig && (
        <ProjectConfigDialog
          mode={projectConfigMode}
          projectName={editingProject?.name}
          existingProject={editingProject?.project}
          onClose={() => {
            setShowProjectConfig(false);
            setEditingProject(null);
          }}
          onSuccess={() => {
            loadData();
            loadAnalysisStats();
          }}
        />
      )}

      {/* Project Creation Dialog (AI) */}
      {showProjectCreation && (
        <ProjectCreationDialog
          onClose={() => setShowProjectCreation(false)}
          onSuccess={() => {
            loadData();
            loadAnalysisStats();
          }}
        />
      )}

      {/* Project Detail Page */}
      {detailProjectName && config && (config.projects[detailProjectName] || config.external?.[detailProjectName]) && (
        <ProjectDetailPage
          name={detailProjectName}
          project={config.projects[detailProjectName] || config.external?.[detailProjectName]}
          status={statuses.get(detailProjectName)}
          onClose={() => setDetailProjectName(null)}
          onRefresh={loadData}
        />
      )}

      {/* Todo Manager Dialog */}
      {showTodoManager && (
        <TodoManager
          projectName={showTodoManager}
          onClose={() => setShowTodoManager(null)}
        />
      )}

      {/* Log Viewer Dialog */}
      {showLogViewer && (
        <LogViewer
          projectName={showLogViewer}
          onClose={() => setShowLogViewer(null)}
        />
      )}

      {/* AI Dialog */}
      {showAiDialog && (
        <AiDialog
          projectName={showAiDialog}
          onClose={() => setShowAiDialog(null)}
        />
      )}
    </div>
  );
}

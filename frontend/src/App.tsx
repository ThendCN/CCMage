import { useEffect, useState } from 'react';
import { RefreshCw, Folder, Activity, Play, Square, CheckSquare, Square as SquareIcon, Plus } from 'lucide-react';
import { ProjectsConfig, ProjectStatus, Project } from './types';
import { fetchProjects, fetchBatchStatus, batchOperation, addProject, updateProject, deleteProject } from './api';
import ProjectCard from './components/ProjectCard';
import ProjectConfigDialog from './components/ProjectConfigDialog';

export default function App() {
  const [config, setConfig] = useState<ProjectsConfig | null>(null);
  const [statuses, setStatuses] = useState<Map<string, ProjectStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<{ name: string; project: Project; isExternal: boolean } | undefined>(undefined);

  useEffect(() => {
    loadData();
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

  const handleSaveProject = async (name: string, project: Project, isExternal: boolean) => {
    try {
      if (editingProject) {
        await updateProject(name, project, isExternal);
        alert('项目更新成功');
      } else {
        await addProject(name, project, isExternal);
        alert('项目添加成功');
      }
      setEditingProject(undefined);
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '操作失败');
    }
  };

  const handleEditProject = (name: string) => {
    let project = config?.projects[name];
    let isExternal = false;
    if (!project && config?.external?.[name]) {
      project = config.external[name];
      isExternal = true;
    }
    if (project) {
      setEditingProject({ name, project, isExternal });
      setShowConfigDialog(true);
    }
  };

  const handleDeleteProject = async (name: string) => {
    try {
      await deleteProject(name);
      alert('项目删除成功');
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '删除失败');
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
              <h1 style={{ fontSize: '24px', fontWeight: '600' }}>项目管理系统</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '8px', color: '#6b7280', fontSize: '14px' }}>
                <span>总计: {config.meta?.totalProjects || 0} 个</span>
                <span>|</span>
                <span>活跃: {config.meta?.activeProjects || 0} 个</span>
              </div>
              <button
                onClick={() => {
                  setEditingProject(undefined);
                  setShowConfigDialog(true);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#3b82f6',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} />
                添加项目
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
                selectionMode={selectionMode}
                isSelected={selectedProjects.has(name)}
                onSelect={() => toggleProjectSelection(name)}
                onEdit={() => handleEditProject(name)}
                onDelete={() => handleDeleteProject(name)}
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
        <p>项目管理系统 v1.0.0 | 运行在端口 9999</p>
      </footer>

      {/* 项目配置对话框 */}
      <ProjectConfigDialog
        isOpen={showConfigDialog}
        onClose={() => {
          setShowConfigDialog(false);
          setEditingProject(undefined);
        }}
        onSave={handleSaveProject}
        editingProject={editingProject}
      />
    </div>
  );
}

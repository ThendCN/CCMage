import { useState, useEffect } from 'react';
import { X, FolderOpen, Plus, Save, Trash2 } from 'lucide-react';
import { addProject, updateProject, deleteProject, selectFolder } from '../api';

interface Props {
  mode: 'add' | 'edit';
  projectName?: string;
  existingProject?: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProjectConfigDialog({ mode, projectName, existingProject, onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState({
    name: projectName || '',
    path: '',
    description: '',
    status: 'active',
    port: '',
    stack: [] as string[],
    startCommand: '',
    isExternal: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    if (mode === 'edit' && existingProject) {
      setFormData({
        name: projectName || '',
        path: existingProject.path || '',
        description: existingProject.description || '',
        status: existingProject.status || 'active',
        port: existingProject.port?.toString() || '',
        stack: existingProject.stack || [],
        startCommand: existingProject.startCommand || '',
        isExternal: existingProject.isExternal || false
      });
    }
  }, [mode, projectName, existingProject]);

  const handleSelectFolder = async () => {
    setSelecting(true);
    setError('');
    try {
      const result = await selectFolder();
      if (result.success && result.detected) {
        setFormData(prev => ({
          ...prev,
          name: prev.name || result.detected.name,
          path: result.path,
          description: result.detected.description || prev.description,
          stack: result.detected.stack || prev.stack,
          port: result.detected.port?.toString() || prev.port
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '选择文件夹失败');
    } finally {
      setSelecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const project = {
        path: formData.path,
        description: formData.description,
        status: formData.status,
        port: formData.port ? parseInt(formData.port) : undefined,
        stack: formData.stack,
        startCommand: formData.startCommand || undefined
      };

      if (mode === 'add') {
        await addProject(formData.name, project, formData.isExternal);
      } else {
        await updateProject(formData.name, project, formData.isExternal);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`确定要删除项目 "${formData.name}" 吗？`)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      await deleteProject(formData.name);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    } finally {
      setLoading(false);
    }
  };

  const addStackItem = () => {
    const input = prompt('输入技术栈名称：');
    if (input && input.trim()) {
      setFormData(prev => ({
        ...prev,
        stack: [...prev.stack, input.trim()]
      }));
    }
  };

  const removeStackItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      stack: prev.stack.filter((_, i) => i !== index)
    }));
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
        padding: '24px',
        width: '600px',
        maxWidth: '90vw',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        {/* 标题栏 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: '600', margin: 0 }}>
            {mode === 'add' ? '添加项目' : '编辑项目'}
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div style={{
            padding: '12px',
            background: '#fef2f2',
            color: '#ef4444',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* 表单 */}
        <form onSubmit={handleSubmit}>
          {/* 项目名称 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              项目名称 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              disabled={mode === 'edit'}
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '14px',
                background: mode === 'edit' ? '#f9fafb' : 'white'
              }}
              placeholder="例如：my-project"
            />
          </div>

          {/* 项目路径 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              项目路径 *
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={formData.path}
                onChange={(e) => setFormData(prev => ({ ...prev, path: e.target.value }))}
                required
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                placeholder="项目文件夹路径"
              />
              <button
                type="button"
                onClick={handleSelectFolder}
                disabled={selecting}
                style={{
                  padding: '10px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#3b82f6',
                  color: 'white',
                  fontSize: '14px',
                  cursor: selecting ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FolderOpen size={16} />
                {selecting ? '选择中...' : '选择'}
              </button>
            </div>
          </div>

          {/* 项目描述 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              项目描述
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical'
              }}
              placeholder="简要描述项目功能..."
            />
          </div>

          {/* 项目状态 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              项目状态
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '14px',
                background: 'white'
              }}
            >
              <option value="active">活跃</option>
              <option value="production">生产环境</option>
              <option value="stable">稳定</option>
              <option value="archived">归档</option>
            </select>
          </div>

          {/* 端口号 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              端口号
            </label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '14px'
              }}
              placeholder="例如：3000"
            />
          </div>

          {/* 技术栈 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              技术栈
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              {formData.stack.map((tech, index) => (
                <span
                  key={index}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#f3f4f6',
                    borderRadius: '16px',
                    fontSize: '14px',
                    color: '#374151'
                  }}
                >
                  {tech}
                  <button
                    type="button"
                    onClick={() => removeStackItem(index)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#6b7280'
                    }}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={addStackItem}
              style={{
                padding: '8px 16px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                background: 'white',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={16} />
              添加技术栈
            </button>
          </div>

          {/* 启动命令 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151'
            }}>
              启动命令
            </label>
            <input
              type="text"
              value={formData.startCommand}
              onChange={(e) => setFormData(prev => ({ ...prev, startCommand: e.target.value }))}
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                fontSize: '14px'
              }}
              placeholder="例如：npm run dev"
            />
          </div>

          {/* 外部项目 */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={formData.isExternal}
                onChange={(e) => setFormData(prev => ({ ...prev, isExternal: e.target.checked }))}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ color: '#374151' }}>外部项目（使用绝对路径）</span>
            </label>
          </div>

          {/* 操作按钮 */}
          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}>
            {mode === 'edit' && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginRight: 'auto'
                }}
              >
                <Trash2 size={16} />
                删除项目
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 20px',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                background: 'white',
                color: '#374151',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '6px',
                background: loading ? '#9ca3af' : '#10b981',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Save size={16} />
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

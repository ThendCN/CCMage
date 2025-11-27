import { useState, useEffect } from 'react';
import { X, Save, FolderOpen } from 'lucide-react';
import { Project } from '../types';
import { selectFolder } from '../api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, project: Project, isExternal: boolean) => void;
  editingProject?: { name: string; project: Project; isExternal: boolean };
}

export default function ProjectConfigDialog({ isOpen, onClose, onSave, editingProject }: Props) {
  const [formData, setFormData] = useState({
    name: '',
    path: '',
    type: '',
    stack: '',
    status: 'active' as Project['status'],
    description: '',
    port: '',
    isExternal: false,
  });
  const [selectingFolder, setSelectingFolder] = useState(false);

  useEffect(() => {
    if (editingProject) {
      setFormData({
        name: editingProject.name,
        path: editingProject.project.path,
        type: editingProject.project.type || '',
        stack: editingProject.project.stack?.join(', ') || '',
        status: editingProject.project.status,
        description: editingProject.project.description || '',
        port: editingProject.project.port?.toString() || '',
        isExternal: editingProject.isExternal,
      });
    } else {
      // 重置表单
      setFormData({
        name: '',
        path: '',
        type: '',
        stack: '',
        status: 'active',
        description: '',
        port: '',
        isExternal: false,
      });
    }
  }, [editingProject, isOpen]);

  const handleSelectFolder = async () => {
    setSelectingFolder(true);
    try {
      const result = await selectFolder();
      if (result.success && result.path) {
        const detected = result.detected;

        // 自动填充所有识别到的信息
        setFormData({
          ...formData,
          path: result.path,
          // 如果没有手动设置过名称,使用检测到的名称
          name: formData.name || (detected?.name || ''),
          type: detected?.type || formData.type,
          stack: detected?.stack?.join(', ') || formData.stack,
          description: detected?.description || formData.description,
          port: detected?.port?.toString() || formData.port,
        });

        // 如果检测到信息,显示提示
        if (detected && (detected.type || detected.stack.length > 0)) {
          alert(`✅ 自动识别成功!\n\n项目类型: ${detected.type || '未知'}\n技术栈: ${detected.stack.join(', ') || '未知'}\n${detected.port ? `端口: ${detected.port}` : ''}`);
        }
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : '打开文件夹选择器失败');
    } finally {
      setSelectingFolder(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const project: Project = {
      path: formData.path,
      type: formData.type,
      status: formData.status,
      description: formData.description,
    };

    if (formData.stack) {
      project.stack = formData.stack.split(',').map(s => s.trim()).filter(s => s);
    }

    if (formData.port) {
      project.port = parseInt(formData.port);
    }

    onSave(formData.name, project, formData.isExternal);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '24px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#111827',
            margin: 0,
          }}>
            {editingProject ? '编辑项目' : '添加新项目'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              color: '#6b7280',
            }}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 项目名称 */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px',
              }}>
                项目名称 *
              </label>
              <input
                type="text"
                required
                disabled={!!editingProject}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="my-awesome-project"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
                唯一标识符,创建后不可修改
              </p>
            </div>

            {/* 项目路径 */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px',
              }}>
                项目路径 *
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  required
                  value={formData.path}
                  onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                  placeholder="/absolute/path/to/project 或 relative/path"
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={handleSelectFolder}
                  disabled={selectingFolder}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    background: selectingFolder ? '#f3f4f6' : 'white',
                    color: '#374151',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: selectingFolder ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  title="浏览文件夹"
                >
                  <FolderOpen size={16} />
                  {selectingFolder ? '选择中...' : '浏览'}
                </button>
              </div>
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
                点击"浏览"打开文件夹选择器,或手动输入路径
              </p>
            </div>

            {/* 项目类型 */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px',
              }}>
                项目类型
              </label>
              <input
                type="text"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                placeholder="Web App, Mobile App, Backend API, etc."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 技术栈 */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px',
              }}>
                技术栈
              </label>
              <input
                type="text"
                value={formData.stack}
                onChange={(e) => setFormData({ ...formData, stack: e.target.value })}
                placeholder="React, Node.js, TypeScript"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0 0' }}>
                用逗号分隔多个技术
              </p>
            </div>

            {/* 状态 */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px',
              }}>
                项目状态 *
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Project['status'] })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              >
                <option value="active">Active - 活跃开发中</option>
                <option value="production">Production - 生产环境</option>
                <option value="archived">Archived - 已归档</option>
                <option value="stable">Stable - 稳定维护</option>
                <option value="reference">Reference - 参考项目</option>
              </select>
            </div>

            {/* 端口 */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px',
              }}>
                端口号
              </label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                placeholder="3000"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 描述 */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '4px',
              }}>
                项目描述
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="简短描述这个项目..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* 外部项目选项 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="isExternal"
                checked={formData.isExternal}
                onChange={(e) => setFormData({ ...formData, isExternal: e.target.checked })}
                style={{ cursor: 'pointer' }}
              />
              <label htmlFor="isExternal" style={{
                fontSize: '14px',
                color: '#374151',
                cursor: 'pointer',
              }}>
                外部项目 (使用绝对路径)
              </label>
            </div>

            {/* 按钮 */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '8px',
            }}>
              <button
                type="submit"
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Save size={16} />
                {editingProject ? '保存更改' : '添加项目'}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

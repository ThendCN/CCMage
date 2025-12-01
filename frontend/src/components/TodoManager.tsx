import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle, Plus, X, Edit2, Trash2, Calendar, Bot, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import type { Todo, Label, TodoWithSubtasks } from '../types';
import AiDialog from './AiDialog';
import { decomposeTask, createDecomposedTasks } from '../api';

interface TodoManagerProps {
  projectName: string;
  onClose?: () => void;  // 改为可选
  embedded?: boolean;    // 是否为嵌入模式
}

export function TodoManager({ projectName, onClose, embedded = false }: TodoManagerProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ status?: string; priority?: string; type?: string }>({});
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [showEditTodo, setShowEditTodo] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(null);
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string>('');
  const [useAiDecompose, setUseAiDecompose] = useState(false);
  const [aiDecomposeLoading, setAiDecomposeLoading] = useState(false);
  const [expandedTodos, setExpandedTodos] = useState<Set<number>>(new Set()); // 折叠状态
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    type: 'task' as const,
    due_date: '',
    estimated_hours: undefined as number | undefined,
    labels: [] as string[]
  });

  // 将扁平 todos 列表转换为树状结构
  const buildTodoTree = (todoList: Todo[]): TodoWithSubtasks[] => {
    const todoMap = new Map<number, TodoWithSubtasks>();
    const roots: TodoWithSubtasks[] = [];

    // 创建映射
    todoList.forEach(todo => {
      todoMap.set(todo.id, { ...todo, subtasks: [] });
    });

    // 构建树状结构
    todoList.forEach(todo => {
      const todoNode = todoMap.get(todo.id)!;
      if (todo.parent_id) {
        const parent = todoMap.get(todo.parent_id);
        if (parent) {
          parent.subtasks!.push(todoNode);
        } else {
          // 父任务不存在，作为根节点
          roots.push(todoNode);
        }
      } else {
        // 没有父任务，是根节点
        roots.push(todoNode);
      }
    });

    // 按 order_index 排序
    roots.sort((a, b) => a.order_index - b.order_index);
    roots.forEach(root => {
      root.subtasks?.sort((a, b) => a.order_index - b.order_index);
    });

    return roots;
  };

  const todoTree = buildTodoTree(todos);

  useEffect(() => {
    loadTodos();
    loadLabels();
  }, [projectName, filter]);

  const loadTodos = async () => {
    try {
      const queryParams = new URLSearchParams();
      if (filter.status) queryParams.append('status', filter.status);
      if (filter.priority) queryParams.append('priority', filter.priority);
      if (filter.type) queryParams.append('type', filter.type);

      const response = await fetch(`/api/projects/${projectName}/todos?${queryParams}`);
      const data = await response.json();
      if (data.success) {
        setTodos(data.data);
      }
    } catch (error) {
      console.error('加载 Todos 失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLabels = async () => {
    try {
      const response = await fetch('/api/labels');
      const data = await response.json();
      if (data.success) {
        setLabels(data.data);
      }
    } catch (error) {
      console.error('加载标签失败:', error);
    }
  };

  const createTodo = async () => {
    try {
      const response = await fetch(`/api/projects/${projectName}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTodo)
      });
      const data = await response.json();
      if (data.success) {
        setTodos([data.data, ...todos]);
        setShowAddTodo(false);
        setNewTodo({
          title: '',
          description: '',
          priority: 'medium',
          type: 'task',
          due_date: '',
          estimated_hours: undefined,
          labels: []
        });
      }
    } catch (error) {
      console.error('创建 Todo 失败:', error);
    }
  };

  const updateTodo = async (id: number, updates: Partial<Todo>) => {
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      if (data.success) {
        setTodos(todos.map(t => t.id === id ? data.data : t));
      }
    } catch (error) {
      console.error('更新 Todo 失败:', error);
    }
  };

  const deleteTodo = async (id: number) => {
    if (!confirm('确定要删除这个 Todo 吗？')) return;

    try {
      const response = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setTodos(todos.filter(t => t.id !== id));
      }
    } catch (error) {
      console.error('删除 Todo 失败:', error);
    }
  };

  const handleEditTodo = (todo: Todo) => {
    setEditingTodo(todo);
    setShowEditTodo(true);
  };

  const handleUpdateTodo = async () => {
    if (!editingTodo || !editingTodo.title.trim()) {
      alert('请输入任务标题');
      return;
    }

    try {
      await updateTodo(editingTodo.id, {
        title: editingTodo.title,
        description: editingTodo.description,
        priority: editingTodo.priority,
        type: editingTodo.type,
        due_date: editingTodo.due_date,
        estimated_hours: editingTodo.estimated_hours,
        labels: editingTodo.labels
      });

      setShowEditTodo(false);
      setEditingTodo(null);
    } catch (error) {
      console.error('更新任务失败:', error);
      alert('更新任务失败，请重试');
    }
  };

  const handleAiCollaborate = (todoId: number) => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) return;

    // 生成初始提示词
    const prompt = `关于任务：${todo.title}\n\n${todo.description || ''}`;

    setSelectedTodoId(todoId);
    setAiInitialPrompt(prompt);
    setShowAiDialog(true);
  };

  const handleAiDecompose = async () => {
    if (!newTodo.title.trim()) {
      alert('请先输入任务标题');
      return;
    }

    setAiDecomposeLoading(true);
    try {
      // 使用标题和描述作为任务描述
      const description = newTodo.description
        ? `${newTodo.title}\n\n${newTodo.description}`
        : newTodo.title;

      const result = await decomposeTask(projectName, description);
      const sessionId = result.data.sessionId;

      // 使用 SSE 流监听拆分进度
      await new Promise<void>((resolve, reject) => {
        const eventSource = new EventSource(`/api/todos/decompose/stream/${sessionId}`);
        const timeout = setTimeout(() => {
          eventSource.close();
          reject(new Error('AI 拆分超时（30秒），请重试'));
        }, 30000); // 30 秒超时

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[AI拆分进度]', data.type, data.content?.substring(0, 50));

            if (data.type === 'completed') {
              clearTimeout(timeout);
              eventSource.close();
              resolve();
            } else if (data.type === 'failed') {
              clearTimeout(timeout);
              eventSource.close();
              reject(new Error(data.content || 'AI 拆分失败'));
            }
          } catch (error) {
            console.error('解析 SSE 消息失败:', error);
          }
        };

        eventSource.onerror = () => {
          clearTimeout(timeout);
          eventSource.close();
          reject(new Error('连接中断'));
        };
      });

      // 创建拆分的任务
      const createResult = await createDecomposedTasks(sessionId);
      if (createResult.success) {
        // 刷新任务列表
        await loadTodos();
        setShowAddTodo(false);
        setNewTodo({
          title: '',
          description: '',
          priority: 'medium',
          type: 'task',
          due_date: '',
          estimated_hours: undefined,
          labels: []
        });
        setUseAiDecompose(false);
        alert(`✅ AI 成功创建了主任务和 ${createResult.data.subtasks.length} 个子任务！`);
      }
    } catch (error) {
      console.error('AI 拆分失败:', error);
      alert(`AI 拆分失败: ${error instanceof Error ? error.message : '请重试或手动创建任务'}`);
    } finally {
      setAiDecomposeLoading(false);
    }
  };

  const toggleStatus = (todo: Todo) => {
    const statusFlow = {
      'pending': 'in_progress',
      'in_progress': 'completed',
      'completed': 'pending'
    } as const;
    updateTodo(todo.id, { status: statusFlow[todo.status as keyof typeof statusFlow] });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 style={{ width: '20px', height: '20px', color: '#10b981' }} />;
      case 'in_progress':
        return <Clock style={{ width: '20px', height: '20px', color: '#3b82f6' }} />;
      case 'cancelled':
        return <X style={{ width: '20px', height: '20px', color: '#9ca3af' }} />;
      default:
        return <Circle style={{ width: '20px', height: '20px', color: '#d1d5db' }} />;
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'urgent': return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
      case 'high': return { background: '#ffedd5', color: '#9a3412', border: '1px solid #fdba74' };
      case 'medium': return { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' };
      case 'low': return { background: '#f3f4f6', color: '#1f2937', border: '1px solid #d1d5db' };
      default: return { background: '#f3f4f6', color: '#1f2937', border: '1px solid #d1d5db' };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug': return '🐛';
      case 'feature': return '✨';
      case 'improvement': return '⚡';
      default: return '📋';
    }
  };

  const stats = {
    total: todos.length,
    pending: todos.filter(t => t.status === 'pending').length,
    in_progress: todos.filter(t => t.status === 'in_progress').length,
    completed: todos.filter(t => t.status === 'completed').length
  };

  if (loading) {
    return embedded ? (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        background: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>加载中...</div>
      </div>
    ) : (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50
      }}>
        <div style={{
          background: 'white',
          borderRadius: '8px',
          padding: '32px'
        }}>
          <div style={{ textAlign: 'center' }}>加载中...</div>
        </div>
      </div>
    );
  }

  // 主内容容器
  const mainContent = (
    <div style={{
      background: 'white',
      borderRadius: embedded ? '0' : '12px',
      boxShadow: embedded ? 'none' : '0 20px 25px -5px rgba(0,0,0,0.1)',
      width: '100%',
      height: embedded ? '100%' : 'auto',
      maxHeight: embedded ? '100%' : '90vh',
      maxWidth: embedded ? '100%' : '1200px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #e5e7eb', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>
              {projectName} - 任务管理
            </h2>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '14px' }}>
              <span style={{ color: '#6b7280' }}>总计: {stats.total}</span>
              <span style={{ color: '#d97706' }}>待处理: {stats.pending}</span>
              <span style={{ color: '#3b82f6' }}>进行中: {stats.in_progress}</span>
              <span style={{ color: '#10b981' }}>已完成: {stats.completed}</span>
            </div>
          </div>
          {!embedded && onClose && (
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
              <X style={{ width: '24px', height: '24px' }} />
            </button>
          )}
        </div>
      </div>

        {/* Filters & Actions */}
        <div style={{ borderBottom: '1px solid #e5e7eb', padding: '16px', background: '#f9fafb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowAddTodo(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
            >
              <Plus style={{ width: '16px', height: '16px' }} />
              新建任务
            </button>

            <select
              value={filter.status || ''}
              onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'white'
              }}
            >
              <option value="">所有状态</option>
              <option value="pending">待处理</option>
              <option value="in_progress">进行中</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>

            <select
              value={filter.priority || ''}
              onChange={(e) => setFilter({ ...filter, priority: e.target.value || undefined })}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'white'
              }}
            >
              <option value="">所有优先级</option>
              <option value="urgent">紧急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>

            <select
              value={filter.type || ''}
              onChange={(e) => setFilter({ ...filter, type: e.target.value || undefined })}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                background: 'white'
              }}
            >
              <option value="">所有类型</option>
              <option value="task">任务</option>
              <option value="bug">Bug</option>
              <option value="feature">新功能</option>
              <option value="improvement">改进</option>
            </select>
          </div>
        </div>

        {/* Todo List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {todos.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: '48px', paddingBottom: '48px', color: '#6b7280' }}>
              <AlertCircle style={{ width: '48px', height: '48px', margin: '0 auto 16px', color: '#9ca3af' }} />
              <p>暂无任务，点击"新建任务"开始吧！</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {todoTree.map((todo) => (
                <div
                  key={todo.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                    background: 'white',
                    transition: 'box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                    {/* 折叠/展开按钮（如果有子任务） */}
                    {todo.subtasks && todo.subtasks.length > 0 ? (
                      <button
                        onClick={() => {
                          const newExpanded = new Set(expandedTodos);
                          if (newExpanded.has(todo.id)) {
                            newExpanded.delete(todo.id);
                          } else {
                            newExpanded.add(todo.id);
                          }
                          setExpandedTodos(newExpanded);
                        }}
                        style={{
                          marginTop: '4px',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          color: '#6b7280'
                        }}
                      >
                        {expandedTodos.has(todo.id) ? (
                          <ChevronDown style={{ width: '20px', height: '20px' }} />
                        ) : (
                          <ChevronRight style={{ width: '20px', height: '20px' }} />
                        )}
                      </button>
                    ) : (
                      <div style={{ width: '20px' }} />
                    )}

                    {/* 状态图标 */}
                    <button
                      onClick={() => toggleStatus(todo)}
                      style={{
                        marginTop: '4px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'transform 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      {getStatusIcon(todo.status)}
                    </button>

                    {/* 任务内容 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '18px' }}>{getTypeIcon(todo.type)}</span>
                        <h3 style={{
                          fontWeight: '500',
                          margin: 0,
                          textDecoration: todo.status === 'completed' ? 'line-through' : 'none',
                          color: todo.status === 'completed' ? '#6b7280' : '#111827'
                        }}>
                          {todo.title}
                        </h3>
                        <span style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          borderRadius: '4px',
                          ...getPriorityStyle(todo.priority)
                        }}>
                          {todo.priority}
                        </span>
                        {todo.labels.map((label) => {
                          const labelObj = labels.find(l => l.name === label);
                          return (
                            <span
                              key={label}
                              style={{
                                padding: '4px 8px',
                                fontSize: '12px',
                                borderRadius: '4px',
                                backgroundColor: labelObj?.color + '20',
                                color: labelObj?.color || '#666'
                              }}
                            >
                              {label}
                            </span>
                          );
                        })}
                      </div>

                      {todo.description && (
                        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px', marginBottom: 0 }}>{todo.description}</p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', fontSize: '12px', color: '#6b7280' }}>
                        {todo.due_date && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar style={{ width: '12px', height: '12px' }} />
                            {new Date(todo.due_date).toLocaleDateString('zh-CN')}
                          </span>
                        )}
                        {todo.estimated_hours && (
                          <span>预估: {todo.estimated_hours}h</span>
                        )}
                        {todo.actual_hours && (
                          <span>实际: {todo.actual_hours}h</span>
                        )}
                        <span>创建于 {new Date(todo.created_at).toLocaleDateString('zh-CN')}</span>
                      </div>

                      {/* 子任务进度条 */}
                      {todo.subtasks && todo.subtasks.length > 0 && (
                        <div style={{ marginTop: '12px', padding: '8px 12px', background: '#f9fafb', borderRadius: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>
                            <span style={{ fontWeight: '500' }}>
                              子任务进度: {todo.subtasks.filter(s => s.status === 'completed').length}/{todo.subtasks.length}
                            </span>
                            <span>
                              {Math.round((todo.subtasks.filter(s => s.status === 'completed').length / todo.subtasks.length) * 100)}%
                            </span>
                          </div>
                          <div style={{ height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              background: 'linear-gradient(90deg, #10b981, #059669)',
                              width: `${(todo.subtasks.filter(s => s.status === 'completed').length / todo.subtasks.length) * 100}%`,
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>
                      )}

                      {/* 子任务列表（折叠展开） */}
                      {todo.subtasks && todo.subtasks.length > 0 && expandedTodos.has(todo.id) && (
                        <div style={{ marginTop: '12px', borderLeft: '2px solid #e5e7eb', paddingLeft: '16px' }}>
                          {todo.subtasks.map((subtask) => (
                            <div
                              key={subtask.id}
                              style={{
                                padding: '8px',
                                marginBottom: '4px',
                                background: '#fafafa',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              <button
                                onClick={() => toggleStatus(subtask)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 0,
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                              >
                                {subtask.status === 'completed' ? (
                                  <CheckCircle2 style={{ width: '16px', height: '16px', color: '#10b981' }} />
                                ) : (
                                  <Circle style={{ width: '16px', height: '16px', color: '#d1d5db' }} />
                                )}
                              </button>
                              <span style={{
                                flex: 1,
                                fontSize: '13px',
                                textDecoration: subtask.status === 'completed' ? 'line-through' : 'none',
                                color: subtask.status === 'completed' ? '#9ca3af' : '#374151'
                              }}>
                                {subtask.title}
                              </span>
                              {subtask.estimated_hours && (
                                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                                  {subtask.estimated_hours}h
                                </span>
                              )}
                              <button
                                onClick={() => handleEditTodo(subtask)}
                                style={{
                                  padding: '4px',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: '4px',
                                  color: '#3b82f6',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                title="编辑子任务"
                              >
                                <Edit2 style={{ width: '14px', height: '14px' }} />
                              </button>
                              <button
                                onClick={() => deleteTodo(subtask.id)}
                                style={{
                                  padding: '4px',
                                  background: 'transparent',
                                  border: 'none',
                                  borderRadius: '4px',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <Trash2 style={{ width: '14px', height: '14px' }} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 操作按钮（只在主任务显示） */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleAiCollaborate(todo.id)}
                        style={{
                          padding: '8px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#8b5cf6',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f5f3ff'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        title="AI 协作"
                      >
                        <Bot style={{ width: '16px', height: '16px' }} />
                      </button>
                      <button
                        onClick={() => handleEditTodo(todo)}
                        style={{
                          padding: '8px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#3b82f6',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        title="编辑任务"
                      >
                        <Edit2 style={{ width: '16px', height: '16px' }} />
                      </button>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        style={{
                          padding: '8px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#ef4444',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <Trash2 style={{ width: '16px', height: '16px' }} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Todo Dialog */}
        {showAddTodo && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '100%'
            }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>新建任务</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>标题</label>
                  <input
                    type="text"
                    value={newTodo.title}
                    onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    placeholder="输入任务标题"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>描述</label>
                  <textarea
                    value={newTodo.description}
                    onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      resize: 'vertical'
                    }}
                    rows={3}
                    placeholder="输入任务描述"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>优先级</label>
                    <select
                      value={newTodo.priority}
                      onChange={(e) => setNewTodo({ ...newTodo, priority: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: 'white'
                      }}
                    >
                      <option value="low">低</option>
                      <option value="medium">中</option>
                      <option value="high">高</option>
                      <option value="urgent">紧急</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>类型</label>
                    <select
                      value={newTodo.type}
                      onChange={(e) => setNewTodo({ ...newTodo, type: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: 'white'
                      }}
                    >
                      <option value="task">任务</option>
                      <option value="bug">Bug</option>
                      <option value="feature">新功能</option>
                      <option value="improvement">改进</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>预估工时</label>
                    <input
                      type="number"
                      value={newTodo.estimated_hours || ''}
                      onChange={(e) => setNewTodo({ ...newTodo, estimated_hours: parseFloat(e.target.value) || undefined })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                      min="0"
                      step="0.5"
                      placeholder="小时"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>截止日期</label>
                  <input
                    type="date"
                    value={newTodo.due_date}
                    onChange={(e) => setNewTodo({ ...newTodo, due_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                {/* AI 拆分选项 */}
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: '8px'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#166534'
                  }}>
                    <input
                      type="checkbox"
                      checked={useAiDecompose}
                      onChange={(e) => setUseAiDecompose(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <Sparkles style={{ width: '16px', height: '16px' }} />
                    使用 AI 智能拆分任务
                  </label>
                  {useAiDecompose && (
                    <p style={{
                      marginTop: '8px',
                      marginBottom: 0,
                      fontSize: '12px',
                      color: '#15803d',
                      lineHeight: 1.5
                    }}>
                      AI 将根据任务描述自动拆分为 3-8 个子任务，包含标题、描述、工时估算和优先级。
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                {useAiDecompose ? (
                  <button
                    onClick={handleAiDecompose}
                    disabled={!newTodo.title || aiDecomposeLoading}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '10px 16px',
                      background: !newTodo.title || aiDecomposeLoading ? '#9ca3af' : '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: !newTodo.title || aiDecomposeLoading ? 'not-allowed' : 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (newTodo.title && !aiDecomposeLoading) e.currentTarget.style.background = '#7c3aed';
                    }}
                    onMouseLeave={(e) => {
                      if (newTodo.title && !aiDecomposeLoading) e.currentTarget.style.background = '#8b5cf6';
                    }}
                  >
                    <Sparkles style={{ width: '16px', height: '16px' }} />
                    {aiDecomposeLoading ? 'AI 正在拆分...' : 'AI 智能拆分并创建'}
                  </button>
                ) : (
                  <button
                    onClick={createTodo}
                    disabled={!newTodo.title}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      background: !newTodo.title ? '#9ca3af' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: !newTodo.title ? 'not-allowed' : 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (newTodo.title) e.currentTarget.style.background = '#2563eb';
                    }}
                    onMouseLeave={(e) => {
                      if (newTodo.title) e.currentTarget.style.background = '#3b82f6';
                    }}
                  >
                    创建
                  </button>
                )}
                <button
                  onClick={() => setShowAddTodo(false)}
                  style={{
                    padding: '10px 16px',
                    background: 'white',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Todo Dialog */}
        {showEditTodo && editingTodo && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '100%'
            }}>
              <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '16px' }}>编辑任务</h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>标题</label>
                  <input
                    type="text"
                    value={editingTodo.title}
                    onChange={(e) => setEditingTodo({ ...editingTodo, title: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                    placeholder="输入任务标题"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>描述</label>
                  <textarea
                    value={editingTodo.description || ''}
                    onChange={(e) => setEditingTodo({ ...editingTodo, description: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      resize: 'vertical'
                    }}
                    rows={3}
                    placeholder="输入任务描述"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>优先级</label>
                    <select
                      value={editingTodo.priority}
                      onChange={(e) => setEditingTodo({ ...editingTodo, priority: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: 'white'
                      }}
                    >
                      <option value="low">低</option>
                      <option value="medium">中</option>
                      <option value="high">高</option>
                      <option value="urgent">紧急</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>类型</label>
                    <select
                      value={editingTodo.type}
                      onChange={(e) => setEditingTodo({ ...editingTodo, type: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        background: 'white'
                      }}
                    >
                      <option value="task">任务</option>
                      <option value="bug">Bug</option>
                      <option value="feature">新功能</option>
                      <option value="improvement">改进</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>预估工时</label>
                    <input
                      type="number"
                      value={editingTodo.estimated_hours || ''}
                      onChange={(e) => setEditingTodo({ ...editingTodo, estimated_hours: parseFloat(e.target.value) || undefined })}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px'
                      }}
                      min="0"
                      step="0.5"
                      placeholder="小时"
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>截止日期</label>
                  <input
                    type="date"
                    value={editingTodo.due_date || ''}
                    onChange={(e) => setEditingTodo({ ...editingTodo, due_date: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button
                  onClick={handleUpdateTodo}
                  disabled={!editingTodo.title}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    background: !editingTodo.title ? '#9ca3af' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: !editingTodo.title ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (editingTodo.title) e.currentTarget.style.background = '#2563eb';
                  }}
                  onMouseLeave={(e) => {
                    if (editingTodo.title) e.currentTarget.style.background = '#3b82f6';
                  }}
                >
                  更新
                </button>
                <button
                  onClick={() => {
                    setShowEditTodo(false);
                    setEditingTodo(null);
                  }}
                  style={{
                    padding: '10px 16px',
                    background: 'white',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI 协作对话框 */}
        {showAiDialog && (
          <AiDialog
            key={`ai-dialog-${selectedTodoId || 'general'}`}
            projectName={projectName}
            todoId={selectedTodoId}
            initialPrompt={aiInitialPrompt}
            onClose={() => {
              setShowAiDialog(false);
              setSelectedTodoId(null);
              setAiInitialPrompt('');
              // 关闭对话框时刷新任务列表,以同步可能的状态更新
              loadTodos();
            }}
          />
        )}
    </div>
  );

  // 根据模式返回不同的包装
  return embedded ? mainContent : (
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
      {mainContent}
    </div>
  );
}

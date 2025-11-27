import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Clock, AlertCircle, Plus, X, Edit2, Trash2, Calendar } from 'lucide-react';
import type { Todo, Label } from '../types';

interface TodoManagerProps {
  projectName: string;
  onClose: () => void;
}

export function TodoManager({ projectName, onClose }: TodoManagerProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ status?: string; priority?: string; type?: string }>({});
  const [showAddTodo, setShowAddTodo] = useState(false);
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    priority: 'medium' as const,
    type: 'task' as const,
    due_date: '',
    estimated_hours: undefined as number | undefined,
    labels: [] as string[]
  });

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
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'cancelled':
        return <X className="w-5 h-5 text-gray-400" />;
      default:
        return <Circle className="w-5 h-5 text-gray-300" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
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
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="text-center">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {projectName} - 任务管理
              </h2>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-gray-600">总计: {stats.total}</span>
                <span className="text-yellow-600">待处理: {stats.pending}</span>
                <span className="text-blue-600">进行中: {stats.in_progress}</span>
                <span className="text-green-600">已完成: {stats.completed}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="border-b p-4 bg-gray-50">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowAddTodo(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              新建任务
            </button>

            <select
              value={filter.status || ''}
              onChange={(e) => setFilter({ ...filter, status: e.target.value || undefined })}
              className="px-3 py-2 border rounded-lg"
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
              className="px-3 py-2 border rounded-lg"
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
              className="px-3 py-2 border rounded-lg"
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
        <div className="flex-1 overflow-y-auto p-6">
          {todos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>暂无任务，点击"新建任务"开始吧！</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleStatus(todo)}
                      className="mt-1 hover:scale-110 transition-transform"
                    >
                      {getStatusIcon(todo.status)}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg">{getTypeIcon(todo.type)}</span>
                        <h3 className={`font-medium ${todo.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {todo.title}
                        </h3>
                        <span className={`px-2 py-1 text-xs rounded border ${getPriorityColor(todo.priority)}`}>
                          {todo.priority}
                        </span>
                        {todo.labels.map((label) => {
                          const labelObj = labels.find(l => l.name === label);
                          return (
                            <span
                              key={label}
                              className="px-2 py-1 text-xs rounded"
                              style={{
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
                        <p className="text-sm text-gray-600 mt-2">{todo.description}</p>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {todo.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
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
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
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
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
              <h3 className="text-xl font-bold mb-4">新建任务</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">标题</label>
                  <input
                    type="text"
                    value={newTodo.title}
                    onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="输入任务标题"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">描述</label>
                  <textarea
                    value={newTodo.description}
                    onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                    placeholder="输入任务描述"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">优先级</label>
                    <select
                      value={newTodo.priority}
                      onChange={(e) => setNewTodo({ ...newTodo, priority: e.target.value as any })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="low">低</option>
                      <option value="medium">中</option>
                      <option value="high">高</option>
                      <option value="urgent">紧急</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">类型</label>
                    <select
                      value={newTodo.type}
                      onChange={(e) => setNewTodo({ ...newTodo, type: e.target.value as any })}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="task">任务</option>
                      <option value="bug">Bug</option>
                      <option value="feature">新功能</option>
                      <option value="improvement">改进</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">预估工时 (小时)</label>
                    <input
                      type="number"
                      value={newTodo.estimated_hours || ''}
                      onChange={(e) => setNewTodo({ ...newTodo, estimated_hours: parseFloat(e.target.value) || undefined })}
                      className="w-full px-3 py-2 border rounded-lg"
                      min="0"
                      step="0.5"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">截止日期</label>
                  <input
                    type="date"
                    value={newTodo.due_date}
                    onChange={(e) => setNewTodo({ ...newTodo, due_date: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={createTodo}
                  disabled={!newTodo.title}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  创建
                </button>
                <button
                  onClick={() => setShowAddTodo(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

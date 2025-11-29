import { ProjectsConfig, ProjectStatus, ActionRequest, ActionResponse, AIEngine, AIEngineInfo } from './types';

const API_BASE = '/api';

export async function fetchProjects(): Promise<ProjectsConfig> {
  const response = await fetch(`${API_BASE}/projects`);
  if (!response.ok) throw new Error('获取项目列表失败');
  return response.json();
}

export async function fetchProjectStatus(name: string): Promise<ProjectStatus> {
  const response = await fetch(`${API_BASE}/projects/${name}/status`);
  if (!response.ok) throw new Error(`获取项目 ${name} 状态失败`);
  return response.json();
}

export async function fetchBatchStatus(projectNames: string[]): Promise<ProjectStatus[]> {
  const response = await fetch(`${API_BASE}/projects/status/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectNames })
  });
  if (!response.ok) throw new Error('批量获取状态失败');
  return response.json();
}

export async function updateProjects(config: ProjectsConfig): Promise<void> {
  const response = await fetch(`${API_BASE}/projects`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!response.ok) throw new Error('更新配置失败');
}

export async function executeAction(
  name: string,
  action: ActionRequest
): Promise<ActionResponse> {
  const response = await fetch(`${API_BASE}/projects/${name}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action)
  });
  if (!response.ok) throw new Error('执行操作失败');
  return response.json();
}

// 进程管理 API
export async function startProject(name: string, command?: string): Promise<any> {
  const response = await fetch(`${API_BASE}/projects/${name}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '启动项目失败');
  }
  return response.json();
}

export async function stopProject(name: string): Promise<any> {
  const response = await fetch(`${API_BASE}/projects/${name}/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '停止项目失败');
  }
  return response.json();
}

export async function getRunningStatus(name: string): Promise<any> {
  const response = await fetch(`${API_BASE}/projects/${name}/running`);
  if (!response.ok) throw new Error('获取运行状态失败');
  return response.json();
}

export async function batchOperation(action: 'start' | 'stop' | 'restart', projectNames: string[]): Promise<any> {
  const response = await fetch(`${API_BASE}/projects/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, projectNames })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '批量操作失败');
  }
  return response.json();
}

// 项目分析 API
export async function getAnalysisStats(): Promise<any> {
  const response = await fetch(`${API_BASE}/analysis/stats`);
  if (!response.ok) throw new Error('获取分析统计失败');
  const result = await response.json();
  return result.data;
}

export async function getUnanalyzedProjects(): Promise<any[]> {
  const response = await fetch(`${API_BASE}/analysis/unanalyzed`);
  if (!response.ok) throw new Error('获取未分析项目失败');
  const result = await response.json();
  return result.data;
}

export async function analyzeAllProjects(force: boolean = false): Promise<any> {
  const response = await fetch(`${API_BASE}/analysis/analyze-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '启动批量分析失败');
  }
  return response.json();
}

export async function analyzeProject(name: string, force: boolean = false): Promise<any> {
  const response = await fetch(`${API_BASE}/projects/${name}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || `分析项目 ${name} 失败`);
  }
  return response.json();
}

export async function getProjectAnalysis(name: string): Promise<any> {
  const response = await fetch(`${API_BASE}/projects/${name}/analysis`);
  if (!response.ok) {
    if (response.status === 404) {
      return null; // 项目尚未分析
    }
    throw new Error(`获取项目 ${name} 分析结果失败`);
  }
  const result = await response.json();
  return result.data;
}

// 项目 CRUD API
export async function addProject(name: string, project: any, isExternal: boolean = false): Promise<any> {
  const response = await fetch(`${API_BASE}/projects/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, isExternal })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '添加项目失败');
  }
  return response.json();
}

export async function updateProject(name: string, project: any, isExternal: boolean = false): Promise<any> {
  const response = await fetch(`${API_BASE}/projects/${name}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, isExternal })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '更新项目失败');
  }
  return response.json();
}

export async function deleteProject(name: string): Promise<any> {
  const response = await fetch(`${API_BASE}/projects/${name}`, {
    method: 'DELETE'
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '删除项目失败');
  }
  return response.json();
}

export async function selectFolder(): Promise<any> {
  const response = await fetch(`${API_BASE}/select-folder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '选择文件夹失败');
  }
  return response.json();
}

// 项目创建 API (AI 一句话创建)
export async function createProjectWithAI(params: {
  description: string;
  projectName?: string;
  targetDir?: string;
  engine?: AIEngine;
  preferences?: {
    stack?: string[];
    port?: number;
    autoStart?: boolean;
    autoInstall?: boolean;
  };
}): Promise<any> {
  const response = await fetch(`${API_BASE}/projects/create-with-ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '创建项目失败');
  }
  return response.json();
}

export async function getProjectCreationStatus(sessionId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/projects/create/status/${sessionId}`);
  if (!response.ok) throw new Error('获取创建状态失败');
  return response.json();
}

// AI 引擎 API
export async function getAvailableEngines(): Promise<AIEngineInfo[]> {
  const response = await fetch(`${API_BASE}/ai/engines`);
  if (!response.ok) throw new Error('获取引擎列表失败');
  const result = await response.json();
  return result.engines;
}

export async function checkEngineAvailable(engine: AIEngine): Promise<boolean> {
  const response = await fetch(`${API_BASE}/ai/engines/${engine}/check`);
  if (!response.ok) return false;
  const result = await response.json();
  return result.available;
}

export async function executeAI(
  projectName: string,
  prompt: string,
  engine?: AIEngine,
  conversationId?: string | null,
  todoId?: number | null
): Promise<any> {
  const response = await fetch(`${API_BASE}/projects/${projectName}/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, engine, conversationId, todoId })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '执行 AI 任务失败');
  }
  return response.json();
}

export async function getAIHistory(projectName: string, engine?: AIEngine, limit: number = 10): Promise<any> {
  const params = new URLSearchParams();
  if (engine) params.append('engine', engine);
  params.append('limit', limit.toString());

  const response = await fetch(`${API_BASE}/projects/${projectName}/ai/history?${params}`);
  if (!response.ok) throw new Error('获取历史记录失败');
  return response.json();
}

export async function terminateAISession(projectName: string, sessionId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/projects/${projectName}/ai/terminate/${sessionId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '终止会话失败');
  }
  return response.json();
}

// ========== AI 任务增强功能 (v1.2.0 新增) ==========

/**
 * AI 任务拆分 - 将一句话描述拆分为子任务
 */
export async function decomposeTask(projectName: string, description: string): Promise<any> {
  const response = await fetch(`${API_BASE}/todos/decompose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectName, description })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'AI 任务拆分失败');
  }
  return response.json();
}

/**
 * 根据拆分结果创建任务
 */
export async function createDecomposedTasks(sessionId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/todos/decompose/${sessionId}/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '创建任务失败');
  }
  return response.json();
}

/**
 * 开启 AI 协作
 */
export async function collaborateOnTask(todoId: number, message: string): Promise<any> {
  const response = await fetch(`${API_BASE}/todos/${todoId}/collaborate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'AI 协作启动失败');
  }
  return response.json();
}

/**
 * 继续 AI 协作会话
 */
export async function continueCollaboration(sessionId: string, message: string): Promise<any> {
  const response = await fetch(`${API_BASE}/todos/collaborate/${sessionId}/continue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '继续协作失败');
  }
  return response.json();
}

/**
 * 终止 AI 协作会话
 */
export async function terminateCollaboration(sessionId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/todos/collaborate/${sessionId}/terminate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '终止协作失败');
  }
  return response.json();
}

/**
 * AI 任务验证
 */
export async function verifyTask(todoId: number): Promise<any> {
  const response = await fetch(`${API_BASE}/todos/${todoId}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'AI 任务验证失败');
  }
  return response.json();
}

/**
 * 获取任务的验证记录
 */
export async function getTaskVerifications(todoId: number): Promise<any> {
  const response = await fetch(`${API_BASE}/todos/${todoId}/verifications`);
  if (!response.ok) throw new Error('获取验证记录失败');
  return response.json();
}

/**
 * 获取任务的 AI 会话列表
 */
export async function getTaskAiSessions(todoId: number): Promise<any> {
  const response = await fetch(`${API_BASE}/todos/${todoId}/sessions`);
  if (!response.ok) throw new Error('获取 AI 会话失败');
  return response.json();
}

/**
 * 获取会话详情
 */
export async function getAiSessionDetail(sessionId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}`);
  if (!response.ok) throw new Error('获取会话详情失败');
  return response.json();
}

/**
 * 获取会话消息列表
 */
export async function getAiSessionMessages(sessionId: string, limit: number = 100): Promise<any> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/messages?limit=${limit}`);
  if (!response.ok) throw new Error('获取会话消息失败');
  return response.json();
}

/**
 * 获取会话运行状态
 */
export async function getAiSessionStatus(sessionId: string): Promise<any> {
  const response = await fetch(`${API_BASE}/sessions/${sessionId}/status`);
  if (!response.ok) throw new Error('获取会话状态失败');
  return response.json();
}

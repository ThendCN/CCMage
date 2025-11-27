import { ProjectsConfig, ProjectStatus, ActionRequest, ActionResponse } from './types';

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

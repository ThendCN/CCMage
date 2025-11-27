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

export interface Project {
  path: string;
  type: string;
  stack?: string[];
  status: 'active' | 'production' | 'archived' | 'stable' | 'reference';
  description: string;
  features?: string[];
  port?: number;
  version?: string;
  hasGit?: boolean;
  relatedProjects?: string[];
  ports?: {
    [key: string]: number;
  };
  lastUpdate?: string;
  frequency?: string;
}

export interface ProjectsConfig {
  active: string[];
  archived: string[];
  projects: {
    [key: string]: Project;
  };
  external?: {
    [key: string]: Project;
  };
  categories?: {
    [key: string]: string[];
  };
  meta?: {
    version: string;
    createdAt: string;
    totalProjects: number;
    activeProjects: number;
  };
}

export interface ProjectStatus {
  name: string;
  exists: boolean;
  hasGit: boolean;
  gitBranch: string | null;
  uncommittedFiles: number;
  hasDependencies: boolean;
  dependenciesInstalled: boolean;
  port: number | null;
}

export interface ActionRequest {
  action: 'open-directory' | 'open-vscode' | 'git-status' | 'install-deps';
  params?: any;
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  output?: string;
}

// ========== 项目管理类型 ==========

export interface Todo {
  id: number;
  project_name: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  type: 'task' | 'bug' | 'feature' | 'improvement';
  due_date?: string;
  completed_at?: string;
  estimated_hours?: number;
  actual_hours?: number;
  assignee?: string;
  labels: string[];
  parent_id?: number;
  order_index: number;
  created_at: string;
  updated_at: string;
  comment_count?: number;
  tracked_hours?: number;
}

export interface Milestone {
  id: number;
  project_name: string;
  title: string;
  description?: string;
  status: 'active' | 'completed' | 'cancelled';
  start_date?: string;
  due_date?: string;
  completed_at?: string;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: number;
  name: string;
  color: string;
  description?: string;
  created_at: string;
}

export interface TimeEntry {
  id: number;
  project_name: string;
  todo_id?: number;
  description?: string;
  duration: number;
  started_at: string;
  ended_at?: string;
  created_at: string;
}

export interface Comment {
  id: number;
  project_name: string;
  todo_id?: number;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectStats {
  name: string;
  description: string;
  status: string;
  total_todos: number;
  completed_todos: number;
  in_progress_todos: number;
  pending_todos: number;
  total_milestones: number;
  completed_milestones: number;
  total_hours: number;
}

export interface ActivityLog {
  id: number;
  project_name: string;
  action: string;
  entity_type?: string;
  entity_id?: number;
  details: any;
  created_at: string;
}

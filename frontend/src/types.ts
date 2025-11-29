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

// ========== 项目分析类型 ==========

export interface ProjectAnalysis {
  analyzed: boolean;
  analyzed_at?: string;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  analysis_error?: string;
  framework?: string;
  languages: string[];
  tech: string[];
  dependencies: {
    runtime?: {
      name: string;
      version: string;
      packageManager: string;
      systemDependencies?: string[];
    };
    startCommands?: {
      install?: string;
      dev?: string;
      build?: string;
      prod?: string;
    };
    port?: {
      default: number;
      envVar?: string;
      configFile?: string;
    };
    environmentVariables?: Array<{
      name: string;
      required: boolean;
      description: string;
      default?: string;
      example?: string;
    }>;
    services?: Array<{
      name: string;
      port: number;
      required: boolean;
    }>;
  };
  start_command?: string;
  port?: number;
  description?: string;
  architecture_notes?: string;
  main_features: string[];
  file_count?: number;
  loc?: number;
}

// ========== AI 引擎类型 ==========

export type AIEngine = 'claude-code' | 'codex';

export interface AIEngineInfo {
  name: AIEngine;
  displayName: string;
  isDefault: boolean;
}

export interface AISessionInfo {
  sessionId: string;
  projectName?: string;
  prompt: string;
  engine: AIEngine;
  startTime?: number;
  message?: string;
  streamUrl?: string;
}

// ========== AI 任务增强类型 (v1.2.0 新增) ==========

export interface AiSession {
  id: number;
  session_id: string;
  project_name: string;
  todo_id?: number;
  session_type: 'decompose' | 'collaborate' | 'verify';
  prompt: string;
  status: 'running' | 'completed' | 'failed' | 'terminated';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  total_cost_usd?: number;
  num_turns?: number;
  result_summary?: any;
  error_message?: string;
  created_at: string;
}

export interface AiMessage {
  id: number;
  session_id: string;
  message_type: 'assistant' | 'user' | 'system' | 'result';
  content: string;
  metadata?: any;
  timestamp: string;
}

export interface AiVerification {
  id: number;
  todo_id: number;
  session_id: string;
  verification_type: 'automatic' | 'manual';
  result: 'passed' | 'failed' | 'partial';
  confidence?: number;
  issues_found?: string[];
  suggestions?: string[];
  evidence?: {
    tests_passed?: boolean;
    code_quality?: string;
    coverage?: number;
    [key: string]: any;
  };
  verified_at: string;
  verified_by: string;
}

export interface TaskDecomposeResult {
  mainTask: {
    title: string;
    description: string;
    estimated_hours?: number;
    priority: 'low' | 'medium' | 'high' | 'urgent';
  };
  subtasks: Array<{
    title: string;
    description: string;
    estimated_hours?: number;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    order: number;
  }>;
}

export interface TodoWithSubtasks extends Todo {
  subtasks?: Todo[];
  verification?: AiVerification;
  aiSessions?: AiSession[];
}

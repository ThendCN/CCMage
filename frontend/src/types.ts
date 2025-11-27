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

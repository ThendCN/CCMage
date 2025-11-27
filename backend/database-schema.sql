-- ================================================================
-- Claude Code 项目管理系统 - 数据库模型设计
-- ================================================================
-- 数据库: SQLite 3
-- 设计原则: 简洁、高效、易扩展
-- ================================================================

-- 1. 项目表 (与 projects.json 同步)
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,           -- 项目名称（与配置文件对应）
  path TEXT NOT NULL,                  -- 项目路径
  tech TEXT,                           -- 技术栈（JSON 数组）
  status TEXT DEFAULT 'active',        -- active/production/archived
  port INTEGER,                        -- 端口号
  description TEXT,                    -- 项目描述
  start_command TEXT,                  -- 启动命令
  is_external BOOLEAN DEFAULT 0,       -- 是否外部项目
  -- 项目分析相关字段
  analyzed BOOLEAN DEFAULT 0,          -- 是否已分析
  analyzed_at DATETIME,                -- 分析时间
  analysis_status TEXT DEFAULT 'pending', -- pending/analyzing/completed/failed
  framework TEXT,                      -- 主要框架（如 React, Vue, Express）
  languages TEXT,                      -- 使用的语言（JSON 数组）
  dependencies TEXT,                   -- 依赖项摘要（JSON 对象）
  file_count INTEGER DEFAULT 0,        -- 文件数量
  loc INTEGER DEFAULT 0,               -- 代码行数
  readme_summary TEXT,                 -- README 摘要
  architecture_notes TEXT,             -- 架构说明（AI 分析）
  main_features TEXT,                  -- 主要功能（JSON 数组）
  analysis_error TEXT,                 -- 分析错误信息
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 待办事项表
CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,          -- 关联项目
  title TEXT NOT NULL,                 -- 标题
  description TEXT,                    -- 描述
  status TEXT DEFAULT 'pending',       -- pending/in_progress/completed/cancelled
  priority TEXT DEFAULT 'medium',      -- low/medium/high/urgent
  type TEXT DEFAULT 'task',            -- task/bug/feature/improvement
  due_date DATE,                       -- 截止日期
  completed_at DATETIME,               -- 完成时间
  estimated_hours REAL,                -- 预估工时
  actual_hours REAL,                   -- 实际工时
  assignee TEXT,                       -- 负责人
  labels TEXT,                         -- 标签（JSON 数组）
  parent_id INTEGER,                   -- 父任务 ID（支持子任务）
  order_index INTEGER DEFAULT 0,       -- 排序索引
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_name) REFERENCES projects(name) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES todos(id) ON DELETE CASCADE
);

-- 3. 里程碑表
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',        -- active/completed/cancelled
  start_date DATE,
  due_date DATE,
  completed_at DATETIME,
  progress INTEGER DEFAULT 0,          -- 进度 0-100
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_name) REFERENCES projects(name) ON DELETE CASCADE
);

-- 4. 标签表
CREATE TABLE IF NOT EXISTS labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3B82F6',        -- 颜色（HEX）
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. 时间追踪表
CREATE TABLE IF NOT EXISTS time_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  todo_id INTEGER,                     -- 关联的 todo（可选）
  description TEXT,
  duration REAL NOT NULL,              -- 持续时间（小时）
  started_at DATETIME NOT NULL,
  ended_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_name) REFERENCES projects(name) ON DELETE CASCADE,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE SET NULL
);

-- 6. 评论表
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  todo_id INTEGER,                     -- 关联的 todo
  content TEXT NOT NULL,
  author TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_name) REFERENCES projects(name) ON DELETE CASCADE,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
);

-- 7. 项目活动日志表（用于审计）
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_name TEXT NOT NULL,
  action TEXT NOT NULL,                -- 操作类型
  entity_type TEXT,                    -- 实体类型（todo/milestone/etc）
  entity_id INTEGER,                   -- 实体 ID
  details TEXT,                        -- 详细信息（JSON）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_name) REFERENCES projects(name) ON DELETE CASCADE
);

-- ================================================================
-- 索引优化
-- ================================================================

-- 项目名称索引
CREATE INDEX IF NOT EXISTS idx_todos_project ON todos(project_name);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_name);
CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_name);
CREATE INDEX IF NOT EXISTS idx_comments_project ON comments(project_name);

-- 状态索引（常用查询）
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);

-- 时间索引
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);
CREATE INDEX IF NOT EXISTS idx_time_entries_started_at ON time_entries(started_at);

-- 关联索引
CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_todo ON comments(todo_id);

-- ================================================================
-- 视图定义
-- ================================================================

-- 项目统计视图
CREATE VIEW IF NOT EXISTS project_stats AS
SELECT
  p.name,
  p.description,
  p.status,
  COUNT(DISTINCT t.id) as total_todos,
  SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) as completed_todos,
  SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_todos,
  SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending_todos,
  COUNT(DISTINCT m.id) as total_milestones,
  SUM(CASE WHEN m.status = 'completed' THEN 1 ELSE 0 END) as completed_milestones,
  COALESCE(SUM(te.duration), 0) as total_hours
FROM projects p
LEFT JOIN todos t ON p.name = t.project_name
LEFT JOIN milestones m ON p.name = m.project_name
LEFT JOIN time_entries te ON p.name = te.project_name
GROUP BY p.name;

-- 待办事项详情视图
CREATE VIEW IF NOT EXISTS todo_details AS
SELECT
  t.*,
  p.description as project_description,
  p.status as project_status,
  COUNT(DISTINCT c.id) as comment_count,
  COALESCE(SUM(te.duration), 0) as tracked_hours
FROM todos t
LEFT JOIN projects p ON t.project_name = p.name
LEFT JOIN comments c ON t.id = c.todo_id
LEFT JOIN time_entries te ON t.id = te.todo_id
GROUP BY t.id;

-- ================================================================
-- 触发器（自动更新时间戳）
-- ================================================================

CREATE TRIGGER IF NOT EXISTS update_projects_timestamp
AFTER UPDATE ON projects
BEGIN
  UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_todos_timestamp
AFTER UPDATE ON todos
BEGIN
  UPDATE todos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_milestones_timestamp
AFTER UPDATE ON milestones
BEGIN
  UPDATE milestones SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_comments_timestamp
AFTER UPDATE ON comments
BEGIN
  UPDATE comments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 自动记录完成时间
CREATE TRIGGER IF NOT EXISTS todos_completed_trigger
AFTER UPDATE OF status ON todos
WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
  UPDATE todos SET completed_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS milestones_completed_trigger
AFTER UPDATE OF status ON milestones
WHEN NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
  UPDATE milestones SET completed_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ================================================================
-- 初始数据
-- ================================================================

-- 默认标签
INSERT OR IGNORE INTO labels (name, color, description) VALUES
('bug', '#EF4444', '错误修复'),
('feature', '#10B981', '新功能'),
('improvement', '#3B82F6', '功能改进'),
('documentation', '#8B5CF6', '文档更新'),
('urgent', '#F59E0B', '紧急任务'),
('blocked', '#6B7280', '被阻塞');

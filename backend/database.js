const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// 数据库文件路径
const DB_PATH = path.join(__dirname, 'project-manager.db');
const SCHEMA_PATH = path.join(__dirname, 'database-schema.sql');

/**
 * 数据库管理类
 * 使用单例模式确保全局只有一个数据库连接
 */
class DatabaseManager {
  constructor() {
    if (DatabaseManager.instance) {
      return DatabaseManager.instance;
    }

    this.db = null;
    this.initialize();
    DatabaseManager.instance = this;
  }

  /**
   * 初始化数据库
   */
  initialize() {
    try {
      // 创建数据库连接
      this.db = new Database(DB_PATH, {
        verbose: process.env.NODE_ENV === 'development' ? console.log : null
      });

      // 启用外键约束
      this.db.pragma('foreign_keys = ON');

      // 执行数据库模式
      this.runSchema();

      console.log('✅ 数据库初始化成功:', DB_PATH);
    } catch (error) {
      console.error('❌ 数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行 SQL 模式文件和迁移
   */
  runSchema() {
    if (!fs.existsSync(SCHEMA_PATH)) {
      console.warn('⚠️  未找到数据库模式文件:', SCHEMA_PATH);
      return;
    }

    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    this.db.exec(schema);

    // 执行数据库迁移
    this.runMigrations();
  }

  /**
   * 数据库迁移管理
   * 使用 user_version 跟踪数据库版本
   */
  runMigrations() {
    const currentVersion = this.db.pragma('user_version', { simple: true });
    const targetVersion = 1; // 当前目标版本

    console.log(`📦 数据库版本: ${currentVersion} → ${targetVersion}`);

    if (currentVersion < targetVersion) {
      console.log('🔄 开始数据库迁移...');

      // 迁移到版本 1: 添加项目分析字段
      if (currentVersion < 1) {
        this.migrateToV1();
      }

      // 更新数据库版本
      this.db.pragma(`user_version = ${targetVersion}`);
      console.log('✅ 数据库迁移完成');
    }
  }

  /**
   * 迁移到版本 1: 添加项目分析相关字段
   */
  migrateToV1() {
    console.log('  ➤ 迁移到版本 1: 添加项目分析字段');

    try {
      // 检查是否已存在 analyzed 列
      const columns = this.db.pragma('table_info(projects)');
      const hasAnalyzedColumn = columns.some(col => col.name === 'analyzed');

      if (!hasAnalyzedColumn) {
        // 添加新列
        const alterStatements = [
          'ALTER TABLE projects ADD COLUMN analyzed BOOLEAN DEFAULT 0',
          'ALTER TABLE projects ADD COLUMN analyzed_at DATETIME',
          'ALTER TABLE projects ADD COLUMN analysis_status TEXT DEFAULT "pending"',
          'ALTER TABLE projects ADD COLUMN framework TEXT',
          'ALTER TABLE projects ADD COLUMN languages TEXT',
          'ALTER TABLE projects ADD COLUMN dependencies TEXT',
          'ALTER TABLE projects ADD COLUMN file_count INTEGER DEFAULT 0',
          'ALTER TABLE projects ADD COLUMN loc INTEGER DEFAULT 0',
          'ALTER TABLE projects ADD COLUMN readme_summary TEXT',
          'ALTER TABLE projects ADD COLUMN architecture_notes TEXT',
          'ALTER TABLE projects ADD COLUMN main_features TEXT',
          'ALTER TABLE projects ADD COLUMN analysis_error TEXT'
        ];

        for (const statement of alterStatements) {
          try {
            this.db.exec(statement);
          } catch (err) {
            // 忽略列已存在的错误
            if (!err.message.includes('duplicate column')) {
              throw err;
            }
          }
        }

        console.log('  ✓ 已添加项目分析字段');
      } else {
        console.log('  ✓ 项目分析字段已存在,跳过迁移');
      }
    } catch (error) {
      console.error('  ✗ 迁移失败:', error.message);
      throw error;
    }
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('📌 数据库连接已关闭');
    }
  }

  // ========== Projects ==========

  /**
   * 同步项目配置到数据库
   */
  syncProjectsFromConfig(projectsConfig) {
    const insert = this.db.prepare(`
      INSERT OR REPLACE INTO projects
      (name, path, tech, status, port, description, start_command, is_external)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const syncOne = this.db.transaction((name, project, isExternal) => {
      insert.run(
        name,
        project.path,
        JSON.stringify(project.tech || []),
        project.status || 'active',
        project.port || null,
        project.description || '',
        project.startCommand || null,
        isExternal ? 1 : 0
      );
    });

    // 同步 projects
    for (const [name, project] of Object.entries(projectsConfig.projects || {})) {
      syncOne(name, project, false);
    }

    // 同步 external
    for (const [name, project] of Object.entries(projectsConfig.external || {})) {
      syncOne(name, project, true);
    }
  }

  /**
   * 获取所有项目
   */
  getAllProjects() {
    return this.db.prepare('SELECT * FROM projects ORDER BY name').all();
  }

  /**
   * 获取单个项目
   */
  getProjectByName(name) {
    return this.db.prepare('SELECT * FROM projects WHERE name = ?').get(name);
  }

  /**
   * 获取活跃项目
   */
  getActiveProjects() {
    return this.db.prepare('SELECT * FROM projects WHERE status = "active" ORDER BY name').all();
  }

  /**
   * 获取归档项目
   */
  getArchivedProjects() {
    return this.db.prepare('SELECT * FROM projects WHERE status = "archived" ORDER BY name').all();
  }

  /**
   * 以 projects.json 格式获取所有项目（用于导出）
   */
  getProjectsForConfig() {
    const projects = this.getAllProjects();
    const config = {
      projects: {},
      external: {},
      active: [],
      archived: [],
      meta: {
        totalProjects: projects.length,
        activeProjects: 0,
        lastSync: new Date().toISOString()
      }
    };

    projects.forEach(p => {
      const projectData = {
        path: p.path,
        description: p.description || '',
        status: p.status,
        port: p.port || undefined,
        stack: p.tech ? JSON.parse(p.tech) : [],
        startCommand: p.start_command || undefined
      };

      // 分类到 projects 或 external
      if (p.is_external) {
        config.external[p.name] = projectData;
      } else {
        config.projects[p.name] = projectData;
      }

      // 添加到 active/archived 列表
      if (p.status === 'active') {
        config.active.push(p.name);
        config.meta.activeProjects++;
      } else if (p.status === 'archived') {
        config.archived.push(p.name);
      }
    });

    return config;
  }

  /**
   * 添加项目
   */
  addProject(name, project, isExternal = false) {
    const stmt = this.db.prepare(`
      INSERT INTO projects
      (name, path, tech, status, port, description, start_command, is_external)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    return stmt.run(
      name,
      project.path,
      JSON.stringify(project.stack || project.tech || []),
      project.status || 'active',
      project.port || null,
      project.description || '',
      project.startCommand || null,
      isExternal ? 1 : 0
    );
  }

  /**
   * 更新项目
   */
  updateProject(name, project, isExternal = false) {
    const stmt = this.db.prepare(`
      UPDATE projects
      SET path = ?,
          tech = ?,
          status = ?,
          port = ?,
          description = ?,
          start_command = ?,
          is_external = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `);

    return stmt.run(
      project.path,
      JSON.stringify(project.stack || project.tech || []),
      project.status || 'active',
      project.port || null,
      project.description || '',
      project.startCommand || null,
      isExternal ? 1 : 0,
      name
    );
  }

  /**
   * 删除项目
   */
  deleteProject(name) {
    return this.db.prepare('DELETE FROM projects WHERE name = ?').run(name);
  }

  /**
   * 获取项目统计
   */
  getProjectStats(projectName) {
    return this.db.prepare('SELECT * FROM project_stats WHERE name = ?').get(projectName);
  }

  /**
   * 更新项目分析状态
   */
  updateProjectAnalysisStatus(projectName, status, error = null) {
    const stmt = this.db.prepare(`
      UPDATE projects
      SET analysis_status = ?, analysis_error = ?, updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `);
    return stmt.run(status, error, projectName);
  }

  /**
   * 保存项目分析结果
   */
  saveProjectAnalysis(projectName, analysisData) {
    const stmt = this.db.prepare(`
      UPDATE projects
      SET analyzed = ?,
          analyzed_at = ?,
          analysis_status = ?,
          framework = ?,
          languages = ?,
          tech = ?,
          dependencies = ?,
          file_count = ?,
          loc = ?,
          readme_summary = ?,
          start_command = ?,
          port = ?,
          description = ?,
          architecture_notes = ?,
          main_features = ?,
          analysis_error = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `);

    return stmt.run(
      analysisData.analyzed ? 1 : 0,
      analysisData.analyzed_at || null,
      analysisData.analysis_status || 'completed',
      analysisData.framework || null,
      analysisData.languages || null,
      analysisData.tech || null,
      analysisData.dependencies || null,
      analysisData.file_count || 0,
      analysisData.loc || 0,
      analysisData.readme_summary || null,
      analysisData.start_command || null,
      analysisData.port || null,
      analysisData.description || null,
      analysisData.architecture_notes || null,
      analysisData.main_features || null,
      analysisData.analysis_error || null,
      projectName
    );
  }

  /**
   * 获取项目分析结果
   */
  getProjectAnalysis(projectName) {
    const project = this.db.prepare(`
      SELECT analyzed, analyzed_at, analysis_status, framework, languages,
             dependencies, file_count, loc, readme_summary, architecture_notes,
             main_features, analysis_error
      FROM projects
      WHERE name = ?
    `).get(projectName);

    if (!project) return null;

    // 解析 JSON 字段
    return {
      ...project,
      languages: JSON.parse(project.languages || '[]'),
      dependencies: JSON.parse(project.dependencies || '{}'),
      main_features: JSON.parse(project.main_features || '[]')
    };
  }

  /**
   * 获取所有未分析的项目
   */
  getUnanalyzedProjects() {
    return this.db.prepare(`
      SELECT name, path, is_external
      FROM projects
      WHERE analyzed = 0 OR analysis_status = 'failed'
      ORDER BY name
    `).all();
  }

  /**
   * 获取项目分析统计
   */
  getAnalysisStats() {
    return this.db.prepare(`
      SELECT
        COUNT(*) as total_projects,
        SUM(CASE WHEN analyzed = 1 THEN 1 ELSE 0 END) as analyzed_count,
        SUM(CASE WHEN analysis_status = 'analyzing' THEN 1 ELSE 0 END) as analyzing_count,
        SUM(CASE WHEN analysis_status = 'failed' THEN 1 ELSE 0 END) as failed_count
      FROM projects
    `).get();
  }

  // ========== Todos ==========

  /**
   * 创建 Todo
   */
  createTodo(todo) {
    const stmt = this.db.prepare(`
      INSERT INTO todos
      (project_name, title, description, status, priority, type, due_date,
       estimated_hours, assignee, labels, parent_id, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      todo.project_name,
      todo.title,
      todo.description || null,
      todo.status || 'pending',
      todo.priority || 'medium',
      todo.type || 'task',
      todo.due_date || null,
      todo.estimated_hours || null,
      todo.assignee || null,
      JSON.stringify(todo.labels || []),
      todo.parent_id || null,
      todo.order_index || 0
    );

    return { id: result.lastInsertRowid, ...todo };
  }

  /**
   * 获取项目的所有 Todos
   */
  getTodosByProject(projectName, filters = {}) {
    let query = 'SELECT * FROM todos WHERE project_name = ?';
    const params = [projectName];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.priority) {
      query += ' AND priority = ?';
      params.push(filters.priority);
    }

    if (filters.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }

    query += ' ORDER BY order_index, created_at DESC';

    const todos = this.db.prepare(query).all(...params);

    // 解析 JSON 字段
    return todos.map(todo => ({
      ...todo,
      labels: JSON.parse(todo.labels || '[]')
    }));
  }

  /**
   * 获取 Todo 详情
   */
  getTodoById(id) {
    const todo = this.db.prepare('SELECT * FROM todo_details WHERE id = ?').get(id);
    if (todo) {
      todo.labels = JSON.parse(todo.labels || '[]');
    }
    return todo;
  }

  /**
   * 更新 Todo
   */
  updateTodo(id, updates) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'labels' && Array.isArray(value)) {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;

    values.push(id);
    const stmt = this.db.prepare(`UPDATE todos SET ${fields.join(', ')} WHERE id = ?`);
    return stmt.run(...values);
  }

  /**
   * 删除 Todo
   */
  deleteTodo(id) {
    return this.db.prepare('DELETE FROM todos WHERE id = ?').run(id);
  }

  /**
   * 批量更新 Todo 排序
   */
  reorderTodos(todoIds) {
    const stmt = this.db.prepare('UPDATE todos SET order_index = ? WHERE id = ?');
    const reorder = this.db.transaction((ids) => {
      ids.forEach((id, index) => {
        stmt.run(index, id);
      });
    });
    reorder(todoIds);
  }

  // ========== Milestones ==========

  /**
   * 创建里程碑
   */
  createMilestone(milestone) {
    const stmt = this.db.prepare(`
      INSERT INTO milestones
      (project_name, title, description, status, start_date, due_date, progress)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      milestone.project_name,
      milestone.title,
      milestone.description || null,
      milestone.status || 'active',
      milestone.start_date || null,
      milestone.due_date || null,
      milestone.progress || 0
    );

    return { id: result.lastInsertRowid, ...milestone };
  }

  /**
   * 获取项目的里程碑
   */
  getMilestonesByProject(projectName) {
    return this.db.prepare(
      'SELECT * FROM milestones WHERE project_name = ? ORDER BY due_date'
    ).all(projectName);
  }

  /**
   * 更新里程碑
   */
  updateMilestone(id, updates) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return;

    values.push(id);
    return this.db.prepare(`UPDATE milestones SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  }

  /**
   * 删除里程碑
   */
  deleteMilestone(id) {
    return this.db.prepare('DELETE FROM milestones WHERE id = ?').run(id);
  }

  // ========== Labels ==========

  /**
   * 获取所有标签
   */
  getAllLabels() {
    return this.db.prepare('SELECT * FROM labels ORDER BY name').all();
  }

  /**
   * 创建标签
   */
  createLabel(label) {
    const stmt = this.db.prepare(`
      INSERT INTO labels (name, color, description)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(
      label.name,
      label.color || '#3B82F6',
      label.description || null
    );

    return { id: result.lastInsertRowid, ...label };
  }

  /**
   * 删除标签
   */
  deleteLabel(id) {
    return this.db.prepare('DELETE FROM labels WHERE id = ?').run(id);
  }

  // ========== Time Entries ==========

  /**
   * 创建时间记录
   */
  createTimeEntry(entry) {
    const stmt = this.db.prepare(`
      INSERT INTO time_entries
      (project_name, todo_id, description, duration, started_at, ended_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      entry.project_name,
      entry.todo_id || null,
      entry.description || null,
      entry.duration,
      entry.started_at,
      entry.ended_at || null
    );

    return { id: result.lastInsertRowid, ...entry };
  }

  /**
   * 获取项目的时间记录
   */
  getTimeEntriesByProject(projectName, startDate = null, endDate = null) {
    let query = 'SELECT * FROM time_entries WHERE project_name = ?';
    const params = [projectName];

    if (startDate) {
      query += ' AND started_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND started_at <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY started_at DESC';

    return this.db.prepare(query).all(...params);
  }

  /**
   * 获取 Todo 的时间记录
   */
  getTimeEntriesByTodo(todoId) {
    return this.db.prepare(
      'SELECT * FROM time_entries WHERE todo_id = ? ORDER BY started_at DESC'
    ).all(todoId);
  }

  /**
   * 删除时间记录
   */
  deleteTimeEntry(id) {
    return this.db.prepare('DELETE FROM time_entries WHERE id = ?').run(id);
  }

  // ========== Comments ==========

  /**
   * 创建评论
   */
  createComment(comment) {
    const stmt = this.db.prepare(`
      INSERT INTO comments (project_name, todo_id, content, author)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      comment.project_name,
      comment.todo_id || null,
      comment.content,
      comment.author || 'Anonymous'
    );

    return { id: result.lastInsertRowid, ...comment };
  }

  /**
   * 获取 Todo 的评论
   */
  getCommentsByTodo(todoId) {
    return this.db.prepare(
      'SELECT * FROM comments WHERE todo_id = ? ORDER BY created_at DESC'
    ).all(todoId);
  }

  /**
   * 删除评论
   */
  deleteComment(id) {
    return this.db.prepare('DELETE FROM comments WHERE id = ?').run(id);
  }

  // ========== Activity Logs ==========

  /**
   * 记录活动日志
   */
  logActivity(log) {
    const stmt = this.db.prepare(`
      INSERT INTO activity_logs (project_name, action, entity_type, entity_id, details)
      VALUES (?, ?, ?, ?, ?)
    `);

    return stmt.run(
      log.project_name,
      log.action,
      log.entity_type || null,
      log.entity_id || null,
      JSON.stringify(log.details || {})
    );
  }

  /**
   * 获取项目的活动日志
   */
  getActivityLogs(projectName, limit = 100) {
    return this.db.prepare(
      'SELECT * FROM activity_logs WHERE project_name = ? ORDER BY created_at DESC LIMIT ?'
    ).all(projectName, limit);
  }

  // ========== AI Sessions (v1.2.0 新增) ==========

  /**
   * 创建 AI 会话
   */
  createAiSession(session) {
    const stmt = this.db.prepare(`
      INSERT INTO ai_sessions (
        session_id, project_name, todo_id, session_type, prompt, status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      session.session_id,
      session.project_name,
      session.todo_id || null,
      session.session_type,
      session.prompt,
      session.status || 'running'
    );

    return { id: result.lastInsertRowid, ...session };
  }

  /**
   * 更新 AI 会话状态
   */
  updateAiSession(sessionId, updates) {
    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      fields.push(`${key} = ?`);
      // JSON 字段需要序列化
      if (key === 'result_summary' && typeof updates[key] === 'object') {
        values.push(JSON.stringify(updates[key]));
      } else {
        values.push(updates[key]);
      }
    });

    values.push(sessionId);

    return this.db.prepare(
      `UPDATE ai_sessions SET ${fields.join(', ')} WHERE session_id = ?`
    ).run(...values);
  }

  /**
   * 获取 AI 会话详情
   */
  getAiSession(sessionId) {
    const session = this.db.prepare('SELECT * FROM ai_sessions WHERE session_id = ?').get(sessionId);
    if (session && session.result_summary) {
      try {
        session.result_summary = JSON.parse(session.result_summary);
      } catch (e) {
        // 如果解析失败，保持原样
      }
    }
    return session;
  }

  /**
   * 获取 Todo 的所有 AI 会话
   */
  getAiSessionsByTodo(todoId) {
    const sessions = this.db.prepare(
      'SELECT * FROM ai_sessions WHERE todo_id = ? ORDER BY created_at DESC'
    ).all(todoId);

    return sessions.map(session => {
      if (session.result_summary) {
        try {
          session.result_summary = JSON.parse(session.result_summary);
        } catch (e) {
          // 忽略解析错误
        }
      }
      return session;
    });
  }

  /**
   * 获取项目的所有 AI 会话
   */
  getAiSessionsByProject(projectName, limit = 50) {
    const sessions = this.db.prepare(
      'SELECT * FROM ai_sessions WHERE project_name = ? ORDER BY created_at DESC LIMIT ?'
    ).all(projectName, limit);

    return sessions.map(session => {
      if (session.result_summary) {
        try {
          session.result_summary = JSON.parse(session.result_summary);
        } catch (e) {
          // 忽略解析错误
        }
      }
      return session;
    });
  }

  // ========== AI Messages ==========

  /**
   * 创建 AI 消息
   */
  createAiMessage(message) {
    const stmt = this.db.prepare(`
      INSERT INTO ai_messages (session_id, message_type, content, metadata)
      VALUES (?, ?, ?, ?)
    `);

    return stmt.run(
      message.session_id,
      message.message_type,
      message.content,
      message.metadata ? JSON.stringify(message.metadata) : null
    );
  }

  /**
   * 获取会话的所有消息
   */
  getAiMessages(sessionId, limit = 100) {
    const messages = this.db.prepare(
      'SELECT * FROM ai_messages WHERE session_id = ? ORDER BY timestamp ASC LIMIT ?'
    ).all(sessionId, limit);

    return messages.map(msg => {
      if (msg.metadata) {
        try {
          msg.metadata = JSON.parse(msg.metadata);
        } catch (e) {
          // 忽略解析错误
        }
      }
      return msg;
    });
  }

  /**
   * 批量创建 AI 消息
   */
  createAiMessagesBatch(messages) {
    const stmt = this.db.prepare(`
      INSERT INTO ai_messages (session_id, message_type, content, metadata)
      VALUES (?, ?, ?, ?)
    `);

    const insert = this.db.transaction((msgs) => {
      for (const msg of msgs) {
        stmt.run(
          msg.session_id,
          msg.message_type,
          msg.content,
          msg.metadata ? JSON.stringify(msg.metadata) : null
        );
      }
    });

    insert(messages);
  }

  // ========== AI Verifications ==========

  /**
   * 创建 AI 验证记录
   */
  createAiVerification(verification) {
    const stmt = this.db.prepare(`
      INSERT INTO ai_verifications (
        todo_id, session_id, verification_type, result, confidence,
        issues_found, suggestions, evidence, verified_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      verification.todo_id,
      verification.session_id,
      verification.verification_type || 'automatic',
      verification.result,
      verification.confidence || null,
      verification.issues_found ? JSON.stringify(verification.issues_found) : null,
      verification.suggestions ? JSON.stringify(verification.suggestions) : null,
      verification.evidence ? JSON.stringify(verification.evidence) : null,
      verification.verified_by || 'AI'
    );

    return { id: result.lastInsertRowid, ...verification };
  }

  /**
   * 获取 Todo 的所有验证记录
   */
  getAiVerifications(todoId) {
    const verifications = this.db.prepare(
      'SELECT * FROM ai_verifications WHERE todo_id = ? ORDER BY verified_at DESC'
    ).all(todoId);

    return verifications.map(v => {
      // 解析 JSON 字段
      ['issues_found', 'suggestions', 'evidence'].forEach(field => {
        if (v[field]) {
          try {
            v[field] = JSON.parse(v[field]);
          } catch (e) {
            // 忽略解析错误
          }
        }
      });
      return v;
    });
  }

  /**
   * 获取最新的验证记录
   */
  getLatestAiVerification(todoId) {
    const verification = this.db.prepare(
      'SELECT * FROM ai_verifications WHERE todo_id = ? ORDER BY verified_at DESC LIMIT 1'
    ).get(todoId);

    if (verification) {
      // 解析 JSON 字段
      ['issues_found', 'suggestions', 'evidence'].forEach(field => {
        if (verification[field]) {
          try {
            verification[field] = JSON.parse(verification[field]);
          } catch (e) {
            // 忽略解析错误
          }
        }
      });
    }

    return verification;
  }
}

// 创建并导出单例实例
const dbManager = new DatabaseManager();

// 优雅关闭
process.on('SIGINT', () => {
  dbManager.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  dbManager.close();
  process.exit(0);
});

module.exports = dbManager;

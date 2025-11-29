const db = require('./database');

/**
 * 注册项目管理相关的 API 路由
 */
function registerManagementRoutes(app) {
  // ========== Todos API ==========

  /**
   * 获取项目的所有 Todos
   * GET /api/projects/:name/todos?status=pending&priority=high&type=bug
   */
  app.get('/api/projects/:name/todos', (req, res) => {
    try {
      const { name } = req.params;
      const filters = {
        status: req.query.status,
        priority: req.query.priority,
        type: req.query.type
      };

      const todos = db.getTodosByProject(name, filters);
      res.json({ success: true, data: todos });
    } catch (error) {
      console.error('获取 Todos 失败:', error);
      res.status(500).json({ error: '获取 Todos 失败', message: error.message });
    }
  });

  /**
   * 获取单个 Todo 详情
   * GET /api/todos/:id
   */
  app.get('/api/todos/:id', (req, res) => {
    try {
      const { id } = req.params;
      const todo = db.getTodoById(parseInt(id));

      if (!todo) {
        return res.status(404).json({ error: 'Todo 不存在' });
      }

      res.json({ success: true, data: todo });
    } catch (error) {
      console.error('获取 Todo 详情失败:', error);
      res.status(500).json({ error: '获取 Todo 详情失败', message: error.message });
    }
  });

  /**
   * 创建 Todo
   * POST /api/projects/:name/todos
   */
  app.post('/api/projects/:name/todos', (req, res) => {
    try {
      const { name } = req.params;
      const todoData = {
        ...req.body,
        project_name: name
      };

      const todo = db.createTodo(todoData);

      // 记录活动日志
      db.logActivity({
        project_name: name,
        action: 'todo_created',
        entity_type: 'todo',
        entity_id: todo.id,
        details: { title: todo.title }
      });

      res.json({ success: true, data: todo });
    } catch (error) {
      console.error('创建 Todo 失败:', error);
      res.status(500).json({ error: '创建 Todo 失败', message: error.message });
    }
  });

  /**
   * 更新 Todo
   * PUT /api/todos/:id
   */
  app.put('/api/todos/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const result = db.updateTodo(parseInt(id), updates);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Todo 不存在' });
      }

      // 获取更新后的 Todo
      const todo = db.getTodoById(parseInt(id));

      // 记录活动日志
      if (todo) {
        db.logActivity({
          project_name: todo.project_name,
          action: 'todo_updated',
          entity_type: 'todo',
          entity_id: todo.id,
          details: updates
        });
      }

      res.json({ success: true, data: todo });
    } catch (error) {
      console.error('更新 Todo 失败:', error);
      res.status(500).json({ error: '更新 Todo 失败', message: error.message });
    }
  });

  /**
   * 删除 Todo
   * DELETE /api/todos/:id
   */
  app.delete('/api/todos/:id', (req, res) => {
    try {
      const { id } = req.params;

      // 先获取 Todo 信息用于日志
      const todo = db.getTodoById(parseInt(id));

      const result = db.deleteTodo(parseInt(id));

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Todo 不存在' });
      }

      // 记录活动日志
      if (todo) {
        db.logActivity({
          project_name: todo.project_name,
          action: 'todo_deleted',
          entity_type: 'todo',
          entity_id: parseInt(id),
          details: { title: todo.title }
        });
      }

      res.json({ success: true, message: 'Todo 已删除' });
    } catch (error) {
      console.error('删除 Todo 失败:', error);
      res.status(500).json({ error: '删除 Todo 失败', message: error.message });
    }
  });

  /**
   * 批量更新 Todo 排序
   * PUT /api/projects/:name/todos/reorder
   * Body: { todoIds: [1, 3, 2, 4] }
   */
  app.put('/api/projects/:name/todos/reorder', (req, res) => {
    try {
      const { todoIds } = req.body;

      if (!Array.isArray(todoIds)) {
        return res.status(400).json({ error: 'todoIds 必须是数组' });
      }

      db.reorderTodos(todoIds);
      res.json({ success: true, message: 'Todo 排序已更新' });
    } catch (error) {
      console.error('更新 Todo 排序失败:', error);
      res.status(500).json({ error: '更新 Todo 排序失败', message: error.message });
    }
  });

  // ========== Milestones API ==========

  /**
   * 获取项目的里程碑
   * GET /api/projects/:name/milestones
   */
  app.get('/api/projects/:name/milestones', (req, res) => {
    try {
      const { name } = req.params;
      const milestones = db.getMilestonesByProject(name);
      res.json({ success: true, data: milestones });
    } catch (error) {
      console.error('获取里程碑失败:', error);
      res.status(500).json({ error: '获取里程碑失败', message: error.message });
    }
  });

  /**
   * 创建里程碑
   * POST /api/projects/:name/milestones
   */
  app.post('/api/projects/:name/milestones', (req, res) => {
    try {
      const { name } = req.params;
      const milestoneData = {
        ...req.body,
        project_name: name
      };

      const milestone = db.createMilestone(milestoneData);

      db.logActivity({
        project_name: name,
        action: 'milestone_created',
        entity_type: 'milestone',
        entity_id: milestone.id,
        details: { title: milestone.title }
      });

      res.json({ success: true, data: milestone });
    } catch (error) {
      console.error('创建里程碑失败:', error);
      res.status(500).json({ error: '创建里程碑失败', message: error.message });
    }
  });

  /**
   * 更新里程碑
   * PUT /api/milestones/:id
   */
  app.put('/api/milestones/:id', (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const result = db.updateMilestone(parseInt(id), updates);

      if (result.changes === 0) {
        return res.status(404).json({ error: '里程碑不存在' });
      }

      res.json({ success: true, message: '里程碑已更新' });
    } catch (error) {
      console.error('更新里程碑失败:', error);
      res.status(500).json({ error: '更新里程碑失败', message: error.message });
    }
  });

  /**
   * 删除里程碑
   * DELETE /api/milestones/:id
   */
  app.delete('/api/milestones/:id', (req, res) => {
    try {
      const { id } = req.params;
      const result = db.deleteMilestone(parseInt(id));

      if (result.changes === 0) {
        return res.status(404).json({ error: '里程碑不存在' });
      }

      res.json({ success: true, message: '里程碑已删除' });
    } catch (error) {
      console.error('删除里程碑失败:', error);
      res.status(500).json({ error: '删除里程碑失败', message: error.message });
    }
  });

  // ========== Labels API ==========

  /**
   * 获取所有标签
   * GET /api/labels
   */
  app.get('/api/labels', (req, res) => {
    try {
      const labels = db.getAllLabels();
      res.json({ success: true, data: labels });
    } catch (error) {
      console.error('获取标签失败:', error);
      res.status(500).json({ error: '获取标签失败', message: error.message });
    }
  });

  /**
   * 创建标签
   * POST /api/labels
   */
  app.post('/api/labels', (req, res) => {
    try {
      const label = db.createLabel(req.body);
      res.json({ success: true, data: label });
    } catch (error) {
      console.error('创建标签失败:', error);
      res.status(500).json({ error: '创建标签失败', message: error.message });
    }
  });

  /**
   * 删除标签
   * DELETE /api/labels/:id
   */
  app.delete('/api/labels/:id', (req, res) => {
    try {
      const { id } = req.params;
      const result = db.deleteLabel(parseInt(id));

      if (result.changes === 0) {
        return res.status(404).json({ error: '标签不存在' });
      }

      res.json({ success: true, message: '标签已删除' });
    } catch (error) {
      console.error('删除标签失败:', error);
      res.status(500).json({ error: '删除标签失败', message: error.message });
    }
  });

  // ========== Time Entries API ==========

  /**
   * 获取项目的时间记录
   * GET /api/projects/:name/time-entries?start=2024-01-01&end=2024-12-31
   */
  app.get('/api/projects/:name/time-entries', (req, res) => {
    try {
      const { name } = req.params;
      const { start, end } = req.query;

      const entries = db.getTimeEntriesByProject(name, start, end);
      res.json({ success: true, data: entries });
    } catch (error) {
      console.error('获取时间记录失败:', error);
      res.status(500).json({ error: '获取时间记录失败', message: error.message });
    }
  });

  /**
   * 获取 Todo 的时间记录
   * GET /api/todos/:id/time-entries
   */
  app.get('/api/todos/:id/time-entries', (req, res) => {
    try {
      const { id } = req.params;
      const entries = db.getTimeEntriesByTodo(parseInt(id));
      res.json({ success: true, data: entries });
    } catch (error) {
      console.error('获取时间记录失败:', error);
      res.status(500).json({ error: '获取时间记录失败', message: error.message });
    }
  });

  /**
   * 创建时间记录
   * POST /api/projects/:name/time-entries
   */
  app.post('/api/projects/:name/time-entries', (req, res) => {
    try {
      const { name } = req.params;
      const entryData = {
        ...req.body,
        project_name: name
      };

      const entry = db.createTimeEntry(entryData);

      // 如果关联了 Todo，更新实际工时
      if (entry.todo_id) {
        const todo = db.getTodoById(entry.todo_id);
        if (todo) {
          const totalHours = (todo.actual_hours || 0) + entry.duration;
          db.updateTodo(entry.todo_id, { actual_hours: totalHours });
        }
      }

      res.json({ success: true, data: entry });
    } catch (error) {
      console.error('创建时间记录失败:', error);
      res.status(500).json({ error: '创建时间记录失败', message: error.message });
    }
  });

  /**
   * 删除时间记录
   * DELETE /api/time-entries/:id
   */
  app.delete('/api/time-entries/:id', (req, res) => {
    try {
      const { id } = req.params;
      const result = db.deleteTimeEntry(parseInt(id));

      if (result.changes === 0) {
        return res.status(404).json({ error: '时间记录不存在' });
      }

      res.json({ success: true, message: '时间记录已删除' });
    } catch (error) {
      console.error('删除时间记录失败:', error);
      res.status(500).json({ error: '删除时间记录失败', message: error.message });
    }
  });

  // ========== Comments API ==========

  /**
   * 获取 Todo 的评论
   * GET /api/todos/:id/comments
   */
  app.get('/api/todos/:id/comments', (req, res) => {
    try {
      const { id } = req.params;
      const comments = db.getCommentsByTodo(parseInt(id));
      res.json({ success: true, data: comments });
    } catch (error) {
      console.error('获取评论失败:', error);
      res.status(500).json({ error: '获取评论失败', message: error.message });
    }
  });

  /**
   * 创建评论
   * POST /api/todos/:id/comments
   */
  app.post('/api/todos/:id/comments', (req, res) => {
    try {
      const { id } = req.params;
      const todo = db.getTodoById(parseInt(id));

      if (!todo) {
        return res.status(404).json({ error: 'Todo 不存在' });
      }

      const commentData = {
        ...req.body,
        project_name: todo.project_name,
        todo_id: parseInt(id)
      };

      const comment = db.createComment(commentData);
      res.json({ success: true, data: comment });
    } catch (error) {
      console.error('创建评论失败:', error);
      res.status(500).json({ error: '创建评论失败', message: error.message });
    }
  });

  /**
   * 删除评论
   * DELETE /api/comments/:id
   */
  app.delete('/api/comments/:id', (req, res) => {
    try {
      const { id } = req.params;
      const result = db.deleteComment(parseInt(id));

      if (result.changes === 0) {
        return res.status(404).json({ error: '评论不存在' });
      }

      res.json({ success: true, message: '评论已删除' });
    } catch (error) {
      console.error('删除评论失败:', error);
      res.status(500).json({ error: '删除评论失败', message: error.message });
    }
  });

  // ========== Statistics API ==========

  /**
   * 获取项目统计信息
   * GET /api/projects/:name/stats
   */
  app.get('/api/projects/:name/stats', (req, res) => {
    try {
      const { name } = req.params;
      const stats = db.getProjectStats(name);

      if (!stats) {
        return res.status(404).json({ error: '项目不存在' });
      }

      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('获取项目统计失败:', error);
      res.status(500).json({ error: '获取项目统计失败', message: error.message });
    }
  });

  /**
   * 获取活动日志
   * GET /api/projects/:name/activity?limit=50
   */
  app.get('/api/projects/:name/activity', (req, res) => {
    try {
      const { name } = req.params;
      const limit = parseInt(req.query.limit) || 100;

      const logs = db.getActivityLogs(name, limit);
      res.json({ success: true, data: logs });
    } catch (error) {
      console.error('获取活动日志失败:', error);
      res.status(500).json({ error: '获取活动日志失败', message: error.message });
    }
  });

  // ========== 项目分析 API ==========

  /**
   * 启动项目AI分析
   * POST /api/projects/:name/analyze
   */
  app.post('/api/projects/:name/analyze', async (req, res) => {
    try {
      const { name } = req.params;
      const project = db.getProjectByName(name);

      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      const path = require('path');
      const PROJECT_ROOT = process.env.PROJECT_ROOT || path.join(__dirname, '..', '..');

      const projectPath = path.isAbsolute(project.path)
        ? project.path
        : path.join(PROJECT_ROOT, project.path);

      // 更新分析状态为"分析中"
      db.updateProjectAnalysisStatus(name, 'analyzing', null);

      // 异步执行分析（不阻塞响应）
      const projectAnalyzer = require('./projectAnalyzer');
      projectAnalyzer.analyzeProject(name, projectPath)
        .then(result => {
          // 更新分析结果到数据库
          db.saveProjectAnalysis(name, result);

          // 记录活动日志
          db.logActivity({
            project_name: name,
            action: 'project_analyzed',
            entity_type: 'project',
            entity_id: project.id,
            details: {
              framework: result.framework,
              analyzed_at: result.analyzed_at
            }
          });

          console.log(`[API] ✅ 项目分析完成: ${name}`);
        })
        .catch(error => {
          console.error(`[API] ❌ 项目分析失败: ${name}`, error);
          db.updateProjectAnalysisStatus(name, 'failed', error.message);
        });

      res.json({
        success: true,
        message: '项目分析已启动',
        projectName: name
      });
    } catch (error) {
      console.error('启动项目分析失败:', error);
      res.status(500).json({ error: '启动项目分析失败', message: error.message });
    }
  });

  /**
   * 获取项目分析结果
   * GET /api/projects/:name/analysis
   */
  app.get('/api/projects/:name/analysis', (req, res) => {
    try {
      const { name } = req.params;
      const project = db.getProjectByName(name);

      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      // 解析 JSON 字段
      const analysis = {
        analyzed: Boolean(project.analyzed),
        analyzed_at: project.analyzed_at,
        analysis_status: project.analysis_status,
        analysis_error: project.analysis_error,
        framework: project.framework,
        languages: project.languages ? JSON.parse(project.languages) : [],
        tech: project.tech ? JSON.parse(project.tech) : [],
        dependencies: project.dependencies ? JSON.parse(project.dependencies) : {},
        start_command: project.start_command,
        port: project.port,
        description: project.description,
        architecture_notes: project.architecture_notes,
        main_features: project.main_features ? JSON.parse(project.main_features) : [],
        file_count: project.file_count,
        loc: project.loc
      };

      res.json({ success: true, data: analysis });
    } catch (error) {
      console.error('获取项目分析结果失败:', error);
      res.status(500).json({ error: '获取项目分析结果失败', message: error.message });
    }
  });
}

module.exports = { registerManagementRoutes };

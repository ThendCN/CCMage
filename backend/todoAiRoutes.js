const todoAiManager = require('./todoAiManager');
const db = require('./database');
const path = require('path');

/**
 * 注册 Todo AI 相关的 API 路由
 */
function registerTodoAiRoutes(app) {
  const PROJECT_ROOT = process.env.PROJECT_ROOT || path.join(__dirname, '..', '..');

  // ========== AI 任务拆分 ==========

  /**
   * POST /api/todos/decompose
   * 使用 AI 将一句话任务描述拆分为子任务
   */
  app.post('/api/todos/decompose', async (req, res) => {
    try {
      const { projectName, description } = req.body;

      if (!projectName || !description) {
        return res.status(400).json({ error: '缺少必需参数: projectName, description' });
      }

      // 获取项目路径
      const project = db.getProjectByName(projectName);
      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      const projectPath = path.isAbsolute(project.path)
        ? project.path
        : path.join(PROJECT_ROOT, project.path);

      // 启动任务拆分
      const result = await todoAiManager.decomposeTask(projectName, projectPath, description);

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('AI 任务拆分失败:', error);
      res.status(500).json({ error: 'AI 任务拆分失败', message: error.message });
    }
  });

  /**
   * GET /api/todos/decompose/stream/:sessionId
   * SSE 流 - 接收任务拆分的实时进度
   */
  app.get('/api/todos/decompose/stream/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log(`[API] 📡 客户端连接到任务拆分流: ${sessionId}`);

    // 监听事件
    const handler = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);

      // 如果任务完成或失败，关闭连接
      if (data.type === 'completed' || data.type === 'failed') {
        res.end();
      }
    };

    todoAiManager.on(`decompose:${sessionId}`, handler);

    // 客户端断开连接时清理
    req.on('close', () => {
      console.log(`[API] 🔌 客户端断开任务拆分流: ${sessionId}`);
      todoAiManager.off(`decompose:${sessionId}`, handler);
    });
  });

  /**
   * POST /api/todos/decompose/:sessionId/create
   * 根据拆分结果创建主任务和子任务
   */
  app.post('/api/todos/decompose/:sessionId/create', async (req, res) => {
    try {
      const { sessionId } = req.params;

      // 获取会话信息
      const session = db.getAiSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: '会话不存在' });
      }

      if (session.status !== 'completed') {
        return res.status(400).json({ error: '任务拆分尚未完成' });
      }

      const result = session.result_summary;
      if (!result || !result.mainTask || !result.subtasks) {
        return res.status(400).json({ error: '拆分结果格式不正确' });
      }

      // 创建主任务
      const mainTask = db.createTodo({
        project_name: session.project_name,
        title: result.mainTask.title,
        description: result.mainTask.description,
        priority: result.mainTask.priority,
        estimated_hours: result.mainTask.estimated_hours,
        type: 'task'
      });

      console.log(`[API] ✅ 创建主任务: ${mainTask.title} (ID: ${mainTask.id})`);

      // 创建子任务
      const subtasks = [];
      for (const subtask of result.subtasks) {
        const created = db.createTodo({
          project_name: session.project_name,
          title: subtask.title,
          description: subtask.description,
          priority: subtask.priority,
          estimated_hours: subtask.estimated_hours,
          type: 'task',
          parent_id: mainTask.id,
          order_index: subtask.order || 0
        });
        subtasks.push(created);
        console.log(`[API]   └─ 子任务: ${created.title} (ID: ${created.id})`);
      }

      // 记录活动日志
      db.logActivity({
        project_name: session.project_name,
        action: 'ai_task_decomposed',
        entity_type: 'todo',
        entity_id: mainTask.id,
        details: {
          sessionId,
          mainTaskId: mainTask.id,
          subtaskCount: subtasks.length
        }
      });

      res.json({
        success: true,
        data: {
          mainTask,
          subtasks
        }
      });
    } catch (error) {
      console.error('创建任务失败:', error);
      res.status(500).json({ error: '创建任务失败', message: error.message });
    }
  });

  // ========== AI 协作 ==========

  /**
   * POST /api/todos/:id/collaborate
   * 为特定任务开启 AI 协作
   */
  app.post('/api/todos/:id/collaborate', async (req, res) => {
    try {
      const { id } = req.params;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: '缺少必需参数: message' });
      }

      // 获取任务详情
      const todo = db.getTodoById(parseInt(id));
      if (!todo) {
        return res.status(404).json({ error: 'Todo 不存在' });
      }

      // 获取项目路径
      const project = db.getProjectByName(todo.project_name);
      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      const projectPath = path.isAbsolute(project.path)
        ? project.path
        : path.join(PROJECT_ROOT, project.path);

      // 启动 AI 协作
      const result = await todoAiManager.collaborateOnTask(
        parseInt(id),
        todo.project_name,
        projectPath,
        message
      );

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('AI 协作启动失败:', error);
      res.status(500).json({ error: 'AI 协作启动失败', message: error.message });
    }
  });

  /**
   * GET /api/todos/collaborate/stream/:sessionId
   * SSE 流 - 接收 AI 协作的实时输出
   */
  app.get('/api/todos/collaborate/stream/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log(`[API] 📡 客户端连接到 AI 协作流: ${sessionId}`);

    const handler = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);

      if (data.type === 'completed' || data.type === 'failed') {
        res.end();
      }
    };

    todoAiManager.on(`collaborate:${sessionId}`, handler);

    req.on('close', () => {
      console.log(`[API] 🔌 客户端断开 AI 协作流: ${sessionId}`);
      todoAiManager.off(`collaborate:${sessionId}`, handler);
    });
  });

  /**
   * POST /api/todos/collaborate/:sessionId/continue
   * 在现有 AI 协作会话中继续对话
   */
  app.post('/api/todos/collaborate/:sessionId/continue', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: '缺少必需参数: message' });
      }

      // 获取会话信息
      const session = db.getAiSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: '会话不存在' });
      }

      // 获取项目路径
      const project = db.getProjectByName(session.project_name);
      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      const projectPath = path.isAbsolute(project.path)
        ? project.path
        : path.join(PROJECT_ROOT, project.path);

      // 继续会话
      const result = await todoAiManager.continueCollaboration(sessionId, message, projectPath);

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('继续 AI 协作失败:', error);
      res.status(500).json({ error: '继续 AI 协作失败', message: error.message });
    }
  });

  /**
   * POST /api/todos/collaborate/:sessionId/terminate
   * 终止 AI 协作会话
   */
  app.post('/api/todos/collaborate/:sessionId/terminate', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const result = await todoAiManager.terminateSession(sessionId);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('终止 AI 协作失败:', error);
      res.status(500).json({ error: '终止 AI 协作失败', message: error.message });
    }
  });

  // ========== AI 任务验证 ==========

  /**
   * POST /api/todos/:id/verify
   * 使用 AI 验证任务是否完成
   */
  app.post('/api/todos/:id/verify', async (req, res) => {
    try {
      const { id } = req.params;

      // 获取任务详情
      const todo = db.getTodoById(parseInt(id));
      if (!todo) {
        return res.status(404).json({ error: 'Todo 不存在' });
      }

      // 获取项目路径
      const project = db.getProjectByName(todo.project_name);
      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      const projectPath = path.isAbsolute(project.path)
        ? project.path
        : path.join(PROJECT_ROOT, project.path);

      // 启动验证
      const result = await todoAiManager.verifyTask(
        parseInt(id),
        todo.project_name,
        projectPath
      );

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('AI 任务验证失败:', error);
      res.status(500).json({ error: 'AI 任务验证失败', message: error.message });
    }
  });

  /**
   * GET /api/todos/verify/stream/:sessionId
   * SSE 流 - 接收任务验证的实时进度
   */
  app.get('/api/todos/verify/stream/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    console.log(`[API] 📡 客户端连接到任务验证流: ${sessionId}`);

    const handler = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);

      if (data.type === 'completed' || data.type === 'failed') {
        res.end();
      }
    };

    todoAiManager.on(`verify:${sessionId}`, handler);

    req.on('close', () => {
      console.log(`[API] 🔌 客户端断开任务验证流: ${sessionId}`);
      todoAiManager.off(`verify:${sessionId}`, handler);
    });
  });

  /**
   * GET /api/todos/:id/verifications
   * 获取任务的所有验证记录
   */
  app.get('/api/todos/:id/verifications', (req, res) => {
    try {
      const { id } = req.params;
      const verifications = db.getAiVerifications(parseInt(id));
      res.json({ success: true, data: verifications });
    } catch (error) {
      console.error('获取验证记录失败:', error);
      res.status(500).json({ error: '获取验证记录失败', message: error.message });
    }
  });

  // ========== AI 会话管理 ==========

  /**
   * GET /api/todos/:id/sessions
   * 获取任务的所有 AI 会话
   */
  app.get('/api/todos/:id/sessions', (req, res) => {
    try {
      const { id } = req.params;
      const sessions = db.getAiSessionsByTodo(parseInt(id));
      res.json({ success: true, data: sessions });
    } catch (error) {
      console.error('获取 AI 会话失败:', error);
      res.status(500).json({ error: '获取 AI 会话失败', message: error.message });
    }
  });

  /**
   * GET /api/sessions/:sessionId
   * 获取会话详情
   */
  app.get('/api/sessions/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = db.getAiSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: '会话不存在' });
      }

      res.json({ success: true, data: session });
    } catch (error) {
      console.error('获取会话详情失败:', error);
      res.status(500).json({ error: '获取会话详情失败', message: error.message });
    }
  });

  /**
   * GET /api/sessions/:sessionId/messages
   * 获取会话的所有消息
   */
  app.get('/api/sessions/:sessionId/messages', (req, res) => {
    try {
      const { sessionId } = req.params;
      const limit = parseInt(req.query.limit) || 100;

      const messages = db.getAiMessages(sessionId, limit);
      res.json({ success: true, data: messages });
    } catch (error) {
      console.error('获取会话消息失败:', error);
      res.status(500).json({ error: '获取会话消息失败', message: error.message });
    }
  });

  /**
   * GET /api/sessions/:sessionId/status
   * 获取会话运行状态
   */
  app.get('/api/sessions/:sessionId/status', (req, res) => {
    try {
      const { sessionId } = req.params;
      const status = todoAiManager.getSessionStatus(sessionId);
      res.json({ success: true, data: status });
    } catch (error) {
      console.error('获取会话状态失败:', error);
      res.status(500).json({ error: '获取会话状态失败', message: error.message });
    }
  });
}

module.exports = { registerTodoAiRoutes };

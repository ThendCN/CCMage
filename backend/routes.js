const processManager = require('./processManager');
const startupDetector = require('./startupDetector');
const claudeCodeManager = require('./claudeCodeManager');
const path = require('path');

/**
 * 注册进程管理相关的路由
 */
function registerProcessRoutes(app, PROJECT_ROOT, PROJECTS_CONFIG, fs) {
  // 6. 获取项目启动配置
  app.get('/api/projects/:name/startup', (req, res) => {
    try {
      const { name } = req.params;
      const config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));

      let project = config.projects[name];
      if (!project && config.external && config.external[name]) {
        project = config.external[name];
      }

      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      const projectPath = path.isAbsolute(project.path)
        ? project.path
        : path.join(PROJECT_ROOT, project.path);

      // 自动检测启动命令
      const startup = startupDetector.detect(projectPath, project);

      res.json({
        detected: startup,
        manual: project.startCommand || null
      });
    } catch (error) {
      res.status(500).json({ error: '获取启动配置失败', message: error.message });
    }
  });

  // 7. 启动项目服务
  app.post('/api/projects/:name/start', (req, res) => {
    try {
      const { name } = req.params;
      const { command: customCommand } = req.body;
      const config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));

      let project = config.projects[name];
      if (!project && config.external && config.external[name]) {
        project = config.external[name];
      }

      if (!project) {
        return res.status(404).json({ error: '项目不存在' });
      }

      const projectPath = path.isAbsolute(project.path)
        ? project.path
        : path.join(PROJECT_ROOT, project.path);

      // 确定启动命令
      let command = customCommand;
      if (!command) {
        const startup = startupDetector.detect(projectPath, project);
        if (!startup) {
          return res.status(400).json({ error: '无法检测启动命令，请手动指定' });
        }
        command = startup.command;
      }

      // 启动进程
      const result = processManager.start(name, command, projectPath);

      res.json({
        success: true,
        message: '项目启动成功',
        ...result
      });
    } catch (error) {
      res.status(500).json({ error: '启动项目失败', message: error.message });
    }
  });

  // 8. 停止项目服务
  app.post('/api/projects/:name/stop', (req, res) => {
    try {
      const { name } = req.params;
      const result = processManager.stop(name);
      res.json({ success: true, message: '项目已停止' });
    } catch (error) {
      res.status(500).json({ error: '停止项目失败', message: error.message });
    }
  });

  // 9. 获取项目运行状态
  app.get('/api/projects/:name/running', (req, res) => {
    try {
      const { name } = req.params;
      const status = processManager.getStatus(name);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: '获取运行状态失败', message: error.message });
    }
  });

  // 10. 获取项目日志（SSE 实时流）
  app.get('/api/projects/:name/logs/stream', (req, res) => {
    const { name } = req.params;

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 发送历史日志
    const historicalLogs = processManager.getLogs(name, 100);
    historicalLogs.forEach(log => {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    });

    // 监听新日志
    const logHandler = (log) => {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    };

    processManager.on(`log:${name}`, logHandler);

    // 客户端断开连接时清理
    req.on('close', () => {
      processManager.off(`log:${name}`, logHandler);
    });
  });

  // 11. 获取最近日志（HTTP）
  app.get('/api/projects/:name/logs', (req, res) => {
    try {
      const { name } = req.params;
      const limit = parseInt(req.query.limit) || 100;
      const logs = processManager.getLogs(name, limit);
      res.json({ logs });
    } catch (error) {
      res.status(500).json({ error: '获取日志失败', message: error.message });
    }
  });

  // 12. 批量操作
  app.post('/api/projects/batch', async (req, res) => {
    try {
      const { action, projectNames } = req.body;

      if (!['start', 'stop', 'restart'].includes(action)) {
        return res.status(400).json({ error: '不支持的批量操作' });
      }

      const results = [];

      for (const name of projectNames) {
        try {
          if (action === 'start') {
            const config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));
            let project = config.projects[name];
            if (!project && config.external) {
              project = config.external[name];
            }

            const projectPath = path.isAbsolute(project.path)
              ? project.path
              : path.join(PROJECT_ROOT, project.path);

            const startup = startupDetector.detect(projectPath, project);
            if (startup) {
              processManager.start(name, startup.command, projectPath);
              results.push({ name, success: true });
            } else {
              results.push({ name, success: false, error: '无法检测启动命令' });
            }
          } else if (action === 'stop') {
            processManager.stop(name);
            results.push({ name, success: true });
          } else if (action === 'restart') {
            processManager.stop(name);
            // 等待一秒后重启
            setTimeout(() => {
              const config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));
              let project = config.projects[name];
              if (!project && config.external) {
                project = config.external[name];
              }
              const projectPath = path.isAbsolute(project.path)
                ? project.path
                : path.join(PROJECT_ROOT, project.path);
              const startup = startupDetector.detect(projectPath, project);
              if (startup) {
                processManager.start(name, startup.command, projectPath);
              }
            }, 1000);
            results.push({ name, success: true });
          }
        } catch (error) {
          results.push({ name, success: false, error: error.message });
        }
      }

      res.json({ results });
    } catch (error) {
      res.status(500).json({ error: '批量操作失败', message: error.message });
    }
  });

  // ========== Claude Code AI 集成 ==========

  // 13. 执行 AI 编程任务
  app.post('/api/projects/:name/ai', async (req, res) => {
    try {
      const { name } = req.params;
      const { prompt } = req.body;

      console.log(`[API] 📬 收到 AI 任务请求`);
      console.log(`[API]   - projectName: ${name}`);
      console.log(`[API]   - prompt: ${prompt}`);

      if (!prompt || !prompt.trim()) {
        console.log('[API] ❌ 任务描述为空');
        return res.status(400).json({ error: '请提供任务描述' });
      }

      const config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));
      let project = config.projects[name];
      if (!project && config.external) {
        project = config.external[name];
      }

      if (!project) {
        console.log(`[API] ❌ 项目不存在: ${name}`);
        return res.status(404).json({ error: '项目不存在' });
      }

      const projectPath = path.isAbsolute(project.path)
        ? project.path
        : path.join(PROJECT_ROOT, project.path);

      console.log(`[API] ✅ 项目路径: ${projectPath}`);

      // 生成会话 ID
      const sessionId = `${name}-${Date.now()}`;
      console.log(`[API] 🆔 生成会话 ID: ${sessionId}`);

      // 异步执行（不等待完成）
      console.log(`[API] 🚀 启动 AI 任务...`);
      claudeCodeManager.execute(name, projectPath, prompt, sessionId)
        .then(result => {
          console.log(`[API] ✅ AI 任务完成: ${sessionId}`);
        })
        .catch(error => {
          console.error(`[API] ❌ AI 任务失败: ${sessionId}`, error);
        });

      // 立即返回会话信息
      console.log(`[API] 📤 返回会话信息`);
      res.json({
        success: true,
        message: 'AI 任务已启动',
        sessionId,
        prompt
      });
    } catch (error) {
      console.error('[API] ❌ 启动 AI 任务失败:', error);
      res.status(500).json({ error: '启动 AI 任务失败', message: error.message });
    }
  });

  // 14. AI 实时输出流（SSE）
  app.get('/api/projects/:name/ai/stream/:sessionId', (req, res) => {
    const { name, sessionId } = req.params;

    console.log(`[SSE] 📡 新的 SSE 连接`);
    console.log(`[SSE]   - projectName: ${name}`);
    console.log(`[SSE]   - sessionId: ${sessionId}`);

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    console.log(`[SSE] ✅ SSE 响应头已设置`);

    // 不发送历史日志，因为这是实时流连接
    // 所有消息都会通过 EventEmitter 实时发送
    console.log(`[SSE] 📜 跳过历史日志（实时流模式）`);

    // 监听新输出
    const outputHandler = (log) => {
      console.log(`[SSE] 📨 收到新输出事件: ${log.type}, ${log.content.substring(0, 50)}...`);
      res.write(`data: ${JSON.stringify(log)}\n\n`);
      console.log(`[SSE] ✅ 已发送到客户端`);
    };

    const completeHandler = (result) => {
      console.log(`[SSE] 🏁 收到完成事件: ${sessionId}, success: ${result.success}`);
      res.write(`data: ${JSON.stringify({ type: 'complete', ...result })}\n\n`);
      console.log(`[SSE] ✅ 完成事件已发送到客户端`);
    };

    console.log(`[SSE] 👂 开始监听事件:`);
    console.log(`[SSE]   - ai-output:${sessionId}`);
    console.log(`[SSE]   - ai-complete:${sessionId}`);
    claudeCodeManager.on(`ai-output:${sessionId}`, outputHandler);
    claudeCodeManager.on(`ai-complete:${sessionId}`, completeHandler);

    // 客户端断开连接时清理
    req.on('close', () => {
      console.log(`[SSE] 🔌 客户端断开连接: ${sessionId}`);
      claudeCodeManager.off(`ai-output:${sessionId}`, outputHandler);
      claudeCodeManager.off(`ai-complete:${sessionId}`, completeHandler);
      console.log(`[SSE] 🧹 事件监听器已清理`);
    });
  });

  // 15. 获取 AI 会话状态
  app.get('/api/projects/:name/ai/status/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      const status = claudeCodeManager.getSessionStatus(sessionId);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: '获取会话状态失败', message: error.message });
    }
  });

  // 16. 终止 AI 会话
  app.post('/api/projects/:name/ai/terminate/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      const result = claudeCodeManager.terminateSession(sessionId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: '终止会话失败', message: error.message });
    }
  });

  // 17. 获取 AI 执行历史
  app.get('/api/projects/:name/ai/history', (req, res) => {
    try {
      const { name } = req.params;
      const limit = parseInt(req.query.limit) || 10;
      const history = claudeCodeManager.getHistory(name, limit);
      res.json({ history });
    } catch (error) {
      res.status(500).json({ error: '获取历史记录失败', message: error.message });
    }
  });

  // 18. 获取历史记录详情
  app.get('/api/projects/:name/ai/history/:recordId', (req, res) => {
    try {
      const { name, recordId } = req.params;
      const record = claudeCodeManager.getHistoryDetail(name, recordId);
      if (!record) {
        return res.status(404).json({ error: '历史记录不存在' });
      }
      res.json(record);
    } catch (error) {
      res.status(500).json({ error: '获取历史详情失败', message: error.message });
    }
  });

  // 19. 清空历史记录
  app.delete('/api/projects/:name/ai/history', (req, res) => {
    try {
      const { name } = req.params;
      const result = claudeCodeManager.clearHistory(name);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: '清空历史失败', message: error.message });
    }
  });

  // 20. 获取所有活跃的 AI 会话
  app.get('/api/ai/sessions', (req, res) => {
    try {
      const sessions = claudeCodeManager.getActiveSessions();
      res.json({ sessions });
    } catch (error) {
      res.status(500).json({ error: '获取会话列表失败', message: error.message });
    }
  });
}

module.exports = { registerProcessRoutes };

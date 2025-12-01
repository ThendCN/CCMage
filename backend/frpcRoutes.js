const db = require('./database');
const frpcManager = require('./frpcManager');

/**
 * Frpc 内网穿透 API 路由
 */
function registerFrpcRoutes(app) {

  // ==================== Frps 服务器配置 ====================

  /**
   * GET /api/frps/config
   * 获取 frps 服务器配置
   */
  app.get('/api/frps/config', (req, res) => {
    try {
      const config = db.getFrpsConfig();
      res.json({
        success: true,
        data: config || null
      });
    } catch (error) {
      console.error('[Frps配置] 获取失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/frps/config
   * 保存 frps 服务器配置
   */
  app.post('/api/frps/config', (req, res) => {
    try {
      const config = req.body;

      if (!config.server_addr) {
        return res.status(400).json({
          success: false,
          error: '服务器地址不能为空'
        });
      }

      db.saveFrpsConfig(config);

      res.json({
        success: true,
        message: 'Frps 配置已保存'
      });
    } catch (error) {
      console.error('[Frps配置] 保存失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ==================== 项目 Frpc 配置 ====================

  /**
   * GET /api/projects/:name/frpc/config
   * 获取项目的 frpc 配置
   */
  app.get('/api/projects/:name/frpc/config', (req, res) => {
    try {
      const { name } = req.params;
      const config = db.getProjectFrpcConfig(name);

      res.json({
        success: true,
        data: config || {
          project_name: name,
          enabled: false,
          frontend_enabled: false,
          backend_enabled: false,
          protocol: 'http'
        }
      });
    } catch (error) {
      console.error('[Frpc配置] 获取失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/projects/:name/frpc/config
   * 保存项目的 frpc 配置
   */
  app.post('/api/projects/:name/frpc/config', (req, res) => {
    try {
      const { name } = req.params;
      const config = req.body;

      // 验证项目存在
      const project = db.getProjectByName(name);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: '项目不存在'
        });
      }

      db.saveProjectFrpcConfig(name, config);

      // 如果正在运行且配置改变，需要重启
      const status = frpcManager.getStatus(name);
      if (status.running && config.enabled) {
        frpcManager.stop(name);
        setTimeout(() => {
          frpcManager.start(name);
        }, 1000);
      }

      res.json({
        success: true,
        message: 'Frpc 配置已保存'
      });
    } catch (error) {
      console.error('[Frpc配置] 保存失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ==================== Frpc 进程控制 ====================

  /**
   * POST /api/projects/:name/frpc/start
   * 启动 frpc
   */
  app.post('/api/projects/:name/frpc/start', async (req, res) => {
    try {
      const { name } = req.params;
      const result = await frpcManager.start(name);

      if (result.success) {
        res.json({
          success: true,
          data: result
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('[Frpc] 启动失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/projects/:name/frpc/stop
   * 停止 frpc
   */
  app.post('/api/projects/:name/frpc/stop', (req, res) => {
    try {
      const { name } = req.params;
      const result = frpcManager.stop(name);

      if (result.success) {
        res.json({
          success: true,
          message: result.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('[Frpc] 停止失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/projects/:name/frpc/restart
   * 重启 frpc
   */
  app.post('/api/projects/:name/frpc/restart', async (req, res) => {
    try {
      const { name } = req.params;

      // 先停止
      const stopResult = frpcManager.stop(name);
      if (!stopResult.success && stopResult.error !== 'Frpc 未运行') {
        return res.status(500).json({
          success: false,
          error: `停止失败: ${stopResult.error}`
        });
      }

      // 延迟后启动
      setTimeout(async () => {
        const startResult = await frpcManager.start(name);
        if (!startResult.success) {
          console.error('[Frpc] 重启失败:', startResult.error);
        }
      }, 1000);

      res.json({
        success: true,
        message: 'Frpc 正在重启...'
      });
    } catch (error) {
      console.error('[Frpc] 重启失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/projects/:name/frpc/status
   * 获取 frpc 运行状态
   */
  app.get('/api/projects/:name/frpc/status', (req, res) => {
    try {
      const { name } = req.params;
      const status = frpcManager.getStatus(name);

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('[Frpc] 获取状态失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ==================== 全局管理 ====================

  /**
   * GET /api/frpc/running
   * 获取所有运行中的 frpc
   */
  app.get('/api/frpc/running', (req, res) => {
    try {
      const running = frpcManager.getAllRunning();

      res.json({
        success: true,
        data: running
      });
    } catch (error) {
      console.error('[Frpc] 获取运行列表失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/frpc/stop-all
   * 停止所有 frpc
   */
  app.post('/api/frpc/stop-all', (req, res) => {
    try {
      const results = frpcManager.stopAll();

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('[Frpc] 停止所有失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
}

module.exports = { registerFrpcRoutes };

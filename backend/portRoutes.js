const portService = require('./portService');

/**
 * 简化的端口管理路由
 * 提供端口查询、检测、建议功能
 */
function registerPortRoutes(app) {

  /**
   * GET /api/ports
   * 获取所有项目的端口使用情况
   */
  app.get('/api/ports', (req, res) => {
    try {
      const usage = portService.getPortUsage();
      res.json({
        success: true,
        data: usage
      });
    } catch (error) {
      console.error('[端口路由] 获取端口使用失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/ports/check/:port
   * 检查指定端口是否可用
   */
  app.get('/api/ports/check/:port', async (req, res) => {
    try {
      const port = parseInt(req.params.port, 10);

      if (!portService.isValidPort(port)) {
        return res.status(400).json({
          success: false,
          error: '无效的端口号'
        });
      }

      const isAvailable = await portService.isPortAvailable(port);
      const conflict = portService.checkConflict(port);
      const processInfo = isAvailable ? null : await portService.findProcessByPort(port);

      res.json({
        success: true,
        data: {
          port,
          available: isAvailable,
          conflict,
          process: processInfo
        }
      });
    } catch (error) {
      console.error('[端口路由] 检查端口失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/ports/check-batch
   * 批量检查端口可用性
   * Body: { ports: [3000, 5000, 8000] }
   */
  app.post('/api/ports/check-batch', async (req, res) => {
    try {
      const { ports } = req.body;

      if (!Array.isArray(ports)) {
        return res.status(400).json({
          success: false,
          error: 'ports 必须是数组'
        });
      }

      const invalidPorts = ports.filter(p => !portService.isValidPort(p));
      if (invalidPorts.length > 0) {
        return res.status(400).json({
          success: false,
          error: `无效的端口号: ${invalidPorts.join(', ')}`
        });
      }

      const results = await portService.checkPorts(ports);

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('[端口路由] 批量检查端口失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/ports/suggestions?type=frontend&count=3
   * 获取可用端口建议
   */
  app.get('/api/ports/suggestions', (req, res) => {
    try {
      const type = req.query.type || 'frontend';
      const count = parseInt(req.query.count || '3', 10);

      if (!['frontend', 'backend'].includes(type)) {
        return res.status(400).json({
          success: false,
          error: 'type 必须是 frontend 或 backend'
        });
      }

      const suggestions = portService.suggestPorts(type, count);

      res.json({
        success: true,
        data: {
          type,
          suggestions
        }
      });
    } catch (error) {
      console.error('[端口路由] 获取端口建议失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/ports/find-available?start=3000&max=20
   * 查找下一个可用端口
   */
  app.get('/api/ports/find-available', async (req, res) => {
    try {
      const startPort = parseInt(req.query.start || '3000', 10);
      const maxAttempts = parseInt(req.query.max || '20', 10);

      if (!portService.isValidPort(startPort)) {
        return res.status(400).json({
          success: false,
          error: '无效的起始端口号'
        });
      }

      const availablePort = await portService.findAvailablePort(startPort, maxAttempts);

      if (!availablePort) {
        return res.status(404).json({
          success: false,
          error: `在 ${startPort}-${startPort + maxAttempts - 1} 范围内未找到可用端口`
        });
      }

      res.json({
        success: true,
        data: {
          port: availablePort
        }
      });
    } catch (error) {
      console.error('[端口路由] 查找可用端口失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
}

module.exports = { registerPortRoutes };

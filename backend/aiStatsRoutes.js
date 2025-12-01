const db = require('./database');
const { formatCost, getSupportedModels } = require('./aiCostCalculator');

/**
 * AI 使用统计和费用追踪路由
 */
function registerAIStatsRoutes(app) {
  /**
   * GET /api/ai/stats
   * 获取 AI 使用统计列表
   *
   * Query 参数:
   * - project_name: 项目名称筛选
   * - engine: AI 引擎筛选 (claude-code/codex)
   * - date_from: 开始日期 (ISO 8601)
   * - date_to: 结束日期 (ISO 8601)
   * - limit: 限制返回数量
   */
  app.get('/api/ai/stats', (req, res) => {
    try {
      const filters = {
        project_name: req.query.project_name,
        engine: req.query.engine,
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        limit: req.query.limit ? parseInt(req.query.limit) : 100
      };

      const sessions = db.getAIStats(filters);

      // 格式化费用显示
      const formattedSessions = sessions.map(session => ({
        ...session,
        total_cost_formatted: formatCost(session.total_cost_usd || 0),
        input_cost_formatted: formatCost(session.input_cost || 0),
        output_cost_formatted: formatCost(session.output_cost || 0),
        duration_formatted: session.duration_ms ? `${(session.duration_ms / 1000).toFixed(2)}s` : null
      }));

      res.json({
        success: true,
        data: formattedSessions,
        filters
      });
    } catch (error) {
      console.error('[AIStats] 获取统计失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/ai/cost-summary
   * 获取 AI 费用汇总
   *
   * Query 参数: 同 /api/ai/stats
   */
  app.get('/api/ai/cost-summary', (req, res) => {
    try {
      const filters = {
        project_name: req.query.project_name,
        engine: req.query.engine,
        date_from: req.query.date_from,
        date_to: req.query.date_to
      };

      const summary = db.getAICostSummary(filters);

      // 格式化汇总数据
      const formattedSummary = {
        ...summary,
        total_cost_formatted: formatCost(summary.total_cost || 0),
        avg_cost_formatted: formatCost(summary.avg_cost || 0),
        // 计算成功率
        success_rate: summary.total_sessions > 0
          ? ((summary.completed_sessions / summary.total_sessions) * 100).toFixed(2) + '%'
          : '0%'
      };

      res.json({
        success: true,
        data: formattedSummary,
        filters
      });
    } catch (error) {
      console.error('[AIStats] 获取汇总失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/ai/models
   * 获取支持的 AI 模型列表和价格
   */
  app.get('/api/ai/models', (req, res) => {
    try {
      const engine = req.query.engine || 'claude-code';
      const models = getSupportedModels(engine);

      res.json({
        success: true,
        data: {
          engine,
          models
        }
      });
    } catch (error) {
      console.error('[AIStats] 获取模型列表失败:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/projects/:name/ai/stats
   * 获取特定项目的 AI 使用统计
   */
  app.get('/api/projects/:name/ai/stats', (req, res) => {
    try {
      const { name } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit) : 20;

      const sessions = db.getAIStats({
        project_name: name,
        limit
      });

      const summary = db.getAICostSummary({
        project_name: name
      });

      res.json({
        success: true,
        data: {
          sessions: sessions.map(s => ({
            ...s,
            total_cost_formatted: formatCost(s.total_cost_usd || 0)
          })),
          summary: {
            ...summary,
            total_cost_formatted: formatCost(summary.total_cost || 0),
            success_rate: summary.total_sessions > 0
              ? ((summary.completed_sessions / summary.total_sessions) * 100).toFixed(2) + '%'
              : '0%'
          }
        }
      });
    } catch (error) {
      console.error(`[AIStats] 获取项目 ${req.params.name} 统计失败:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
}

module.exports = { registerAIStatsRoutes };

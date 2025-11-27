const projectAnalyzer = require('./projectAnalyzer');
const db = require('./database');
const fs = require('fs');
const path = require('path');

/**
 * 注册项目分析相关的路由
 */
function registerAnalysisRoutes(app, PROJECT_ROOT, PROJECTS_CONFIG) {

  /**
   * 获取项目分析统计
   * GET /api/analysis/stats
   */
  app.get('/api/analysis/stats', (req, res) => {
    try {
      const stats = db.getAnalysisStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('[AnalysisRoutes] 获取分析统计失败:', error);
      res.status(500).json({
        success: false,
        error: '获取分析统计失败',
        message: error.message
      });
    }
  });

  /**
   * 获取所有未分析的项目
   * GET /api/analysis/unanalyzed
   */
  app.get('/api/analysis/unanalyzed', (req, res) => {
    try {
      const projects = db.getUnanalyzedProjects();
      res.json({ success: true, data: projects });
    } catch (error) {
      console.error('[AnalysisRoutes] 获取未分析项目失败:', error);
      res.status(500).json({
        success: false,
        error: '获取未分析项目失败',
        message: error.message
      });
    }
  });

  /**
   * 批量分析所有项目
   * POST /api/analysis/analyze-all
   * Body: { force: boolean } - 是否强制重新分析已分析的项目
   */
  app.post('/api/analysis/analyze-all', async (req, res) => {
    try {
      const { force = false } = req.body;

      // 读取项目配置
      if (!fs.existsSync(PROJECTS_CONFIG)) {
        return res.status(404).json({
          success: false,
          error: '项目配置文件不存在'
        });
      }

      const config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));
      const allProjects = [];

      // 收集所有项目
      for (const [name, project] of Object.entries(config.projects || {})) {
        allProjects.push({
          name,
          path: path.join(PROJECT_ROOT, project.path),
          isExternal: false
        });
      }

      for (const [name, project] of Object.entries(config.external || {})) {
        allProjects.push({
          name,
          path: project.path,
          isExternal: true
        });
      }

      // 过滤需要分析的项目
      let projectsToAnalyze = allProjects;
      if (!force) {
        projectsToAnalyze = allProjects.filter(p => {
          const analysis = db.getProjectAnalysis(p.name);
          return !analysis || !analysis.analyzed || analysis.analysis_status === 'failed';
        });
      }

      console.log(`[AnalysisRoutes] 准备分析 ${projectsToAnalyze.length} 个项目`);

      // 异步分析所有项目（不阻塞响应）
      setImmediate(async () => {
        for (const project of projectsToAnalyze) {
          try {
            console.log(`[AnalysisRoutes] 开始分析: ${project.name}`);

            // 更新状态为分析中
            db.updateProjectAnalysisStatus(project.name, 'analyzing');

            // 执行分析
            const result = await projectAnalyzer.analyzeProject(project.name, project.path);

            // 保存结果
            db.saveProjectAnalysis(project.name, result);

            console.log(`[AnalysisRoutes] ✅ 分析完成: ${project.name}`);
          } catch (error) {
            console.error(`[AnalysisRoutes] ❌ 分析失败: ${project.name}`, error);
            db.updateProjectAnalysisStatus(project.name, 'failed', error.message);
          }
        }

        console.log('[AnalysisRoutes] 🎉 批量分析任务完成');
      });

      // 立即返回响应
      res.json({
        success: true,
        message: '批量分析任务已启动',
        data: {
          total: projectsToAnalyze.length,
          projects: projectsToAnalyze.map(p => p.name)
        }
      });

    } catch (error) {
      console.error('[AnalysisRoutes] 启动批量分析失败:', error);
      res.status(500).json({
        success: false,
        error: '启动批量分析失败',
        message: error.message
      });
    }
  });

  /**
   * 分析单个项目
   * POST /api/projects/:name/analyze
   * Body: { force: boolean } - 是否强制重新分析
   */
  app.post('/api/projects/:name/analyze', async (req, res) => {
    try {
      const { name } = req.params;
      const { force = false } = req.body;

      // 读取项目配置
      if (!fs.existsSync(PROJECTS_CONFIG)) {
        return res.status(404).json({
          success: false,
          error: '项目配置文件不存在'
        });
      }

      const config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));

      // 查找项目
      let projectConfig = null;
      let projectPath = null;
      let isExternal = false;

      if (config.projects && config.projects[name]) {
        projectConfig = config.projects[name];
        projectPath = path.join(PROJECT_ROOT, projectConfig.path);
        isExternal = false;
      } else if (config.external && config.external[name]) {
        projectConfig = config.external[name];
        projectPath = projectConfig.path;
        isExternal = true;
      }

      if (!projectConfig) {
        return res.status(404).json({
          success: false,
          error: '项目不存在'
        });
      }

      // 检查是否已分析
      if (!force) {
        const existing = db.getProjectAnalysis(name);
        if (existing && existing.analyzed && existing.analysis_status === 'completed') {
          return res.json({
            success: true,
            message: '项目已分析，使用 force=true 强制重新分析',
            data: existing
          });
        }
      }

      console.log(`[AnalysisRoutes] 开始分析项目: ${name}`);

      // 更新状态为分析中
      db.updateProjectAnalysisStatus(name, 'analyzing');

      // 异步分析项目（不阻塞响应）
      setImmediate(async () => {
        try {
          const result = await projectAnalyzer.analyzeProject(name, projectPath);
          db.saveProjectAnalysis(name, result);
          console.log(`[AnalysisRoutes] ✅ 分析完成: ${name}`);
        } catch (error) {
          console.error(`[AnalysisRoutes] ❌ 分析失败: ${name}`, error);
          db.updateProjectAnalysisStatus(name, 'failed', error.message);
        }
      });

      // 立即返回响应
      res.json({
        success: true,
        message: '项目分析任务已启动',
        data: { projectName: name, status: 'analyzing' }
      });

    } catch (error) {
      console.error(`[AnalysisRoutes] 启动项目分析失败:`, error);
      res.status(500).json({
        success: false,
        error: '启动项目分析失败',
        message: error.message
      });
    }
  });

  /**
   * 获取项目分析结果
   * GET /api/projects/:name/analysis
   */
  app.get('/api/projects/:name/analysis', (req, res) => {
    try {
      const { name } = req.params;
      const analysis = db.getProjectAnalysis(name);

      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: '项目不存在或尚未分析'
        });
      }

      res.json({
        success: true,
        data: analysis
      });

    } catch (error) {
      console.error(`[AnalysisRoutes] 获取项目分析结果失败:`, error);
      res.status(500).json({
        success: false,
        error: '获取项目分析结果失败',
        message: error.message
      });
    }
  });

  console.log('✅ 项目分析路由已注册');
}

module.exports = { registerAnalysisRoutes };

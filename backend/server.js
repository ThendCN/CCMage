const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const { registerProcessRoutes } = require('./routes');
const processManager = require('./processManager');

const execPromise = util.promisify(exec);

const app = express();
const PORT = 9999;

// 项目根目录（backend的上上级目录）
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PROJECTS_CONFIG = path.join(PROJECT_ROOT, '.claude/projects.json');

app.use(cors());
app.use(express.json());

// 提供前端静态文件
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// ========== API 路由 ==========

// 1. 获取所有项目
app.get('/api/projects', (req, res) => {
  try {
    const config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));
    res.json(config);
  } catch (error) {
    res.status(500).json({ error: '读取项目配置失败', message: error.message });
  }
});

// 2. 获取单个项目状态
app.get('/api/projects/:name/status', async (req, res) => {
  try {
    const { name } = req.params;
    const config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));

    // 查找项目（可能在 projects 或 external 中）
    let project = config.projects[name];
    if (!project && config.external && config.external[name]) {
      project = config.external[name];
    }

    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    // 如果是绝对路径直接使用，否则相对于项目根目录
    const projectPath = path.isAbsolute(project.path)
      ? project.path
      : path.join(PROJECT_ROOT, project.path);
    const status = await checkProjectStatus(projectPath, project);

    res.json({ name, ...status });
  } catch (error) {
    res.status(500).json({ error: '检查项目状态失败', message: error.message });
  }
});

// 3. 批量获取项目状态
app.post('/api/projects/status/batch', async (req, res) => {
  try {
    const { projectNames } = req.body;
    const config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));

    const statusPromises = projectNames.map(async (name) => {
      // 查找项目（可能在 projects 或 external 中）
      let project = config.projects[name];
      if (!project && config.external && config.external[name]) {
        project = config.external[name];
      }

      if (!project) return { name, error: '项目不存在' };

      // 如果是绝对路径直接使用，否则相对于项目根目录
      const projectPath = path.isAbsolute(project.path)
        ? project.path
        : path.join(PROJECT_ROOT, project.path);
      const status = await checkProjectStatus(projectPath, project);
      return { name, ...status };
    });

    const results = await Promise.all(statusPromises);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: '批量检查失败', message: error.message });
  }
});

// 4. 更新项目配置
app.put('/api/projects', (req, res) => {
  try {
    const newConfig = req.body;
    fs.writeFileSync(PROJECTS_CONFIG, JSON.stringify(newConfig, null, 2), 'utf8');
    res.json({ success: true, message: '配置更新成功' });
  } catch (error) {
    res.status(500).json({ error: '更新配置失败', message: error.message });
  }
});

// 5. 执行项目操作
app.post('/api/projects/:name/action', async (req, res) => {
  try {
    const { name } = req.params;
    const { action, params } = req.body;

    const config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));

    // 查找项目（可能在 projects 或 external 中）
    let project = config.projects[name];
    if (!project && config.external && config.external[name]) {
      project = config.external[name];
    }

    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    // 如果是绝对路径直接使用，否则相对于项目根目录
    const projectPath = path.isAbsolute(project.path)
      ? project.path
      : path.join(PROJECT_ROOT, project.path);
    const result = await executeAction(action, projectPath, project, params);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: '执行操作失败', message: error.message });
  }
});

// ========== 辅助函数 ==========

// 检查项目状态
async function checkProjectStatus(projectPath, project) {
  const status = {
    exists: fs.existsSync(projectPath),
    hasGit: false,
    gitBranch: null,
    uncommittedFiles: 0,
    hasDependencies: false,
    dependenciesInstalled: false,
    port: project.port || null
  };

  if (!status.exists) return status;

  // 检查 Git 状态
  const gitPath = path.join(projectPath, '.git');
  status.hasGit = fs.existsSync(gitPath);

  if (status.hasGit) {
    try {
      const { stdout: branch } = await execPromise('git branch --show-current', { cwd: projectPath });
      status.gitBranch = branch.trim();

      const { stdout: statusOutput } = await execPromise('git status --porcelain', { cwd: projectPath });
      status.uncommittedFiles = statusOutput.trim().split('\n').filter(l => l).length;
    } catch (error) {
      // Git 命令失败，忽略
    }
  }

  // 检查依赖状态
  const hasPackageJson = fs.existsSync(path.join(projectPath, 'package.json'));
  const hasRequirements = fs.existsSync(path.join(projectPath, 'requirements.txt')) ||
                          fs.existsSync(path.join(projectPath, 'backend/requirements.txt'));

  status.hasDependencies = hasPackageJson || hasRequirements;

  if (hasPackageJson) {
    status.dependenciesInstalled = fs.existsSync(path.join(projectPath, 'node_modules'));
  } else if (hasRequirements) {
    status.dependenciesInstalled = fs.existsSync(path.join(projectPath, 'venv')) ||
                                   fs.existsSync(path.join(projectPath, '.venv')) ||
                                   fs.existsSync(path.join(projectPath, 'backend/venv'));
  }

  return status;
}

// 执行操作
async function executeAction(action, projectPath, project, params) {
  switch (action) {
    case 'open-directory':
      await execPromise(`open "${projectPath}"`);
      return { success: true, message: '已打开项目目录' };

    case 'open-vscode':
      await execPromise(`code "${projectPath}"`);
      return { success: true, message: '已在 VSCode 中打开' };

    case 'git-status':
      const { stdout } = await execPromise('git status', { cwd: projectPath });
      return { success: true, output: stdout };

    case 'install-deps':
      if (fs.existsSync(path.join(projectPath, 'package.json'))) {
        await execPromise('npm install', { cwd: projectPath });
        return { success: true, message: 'npm 依赖安装完成' };
      } else if (fs.existsSync(path.join(projectPath, 'requirements.txt'))) {
        await execPromise('pip install -r requirements.txt', { cwd: projectPath });
        return { success: true, message: 'Python 依赖安装完成' };
      }
      return { success: false, message: '未找到依赖配置文件' };

    default:
      return { success: false, message: '未知操作' };
  }
}

// 注册进程管理路由
registerProcessRoutes(app, PROJECT_ROOT, PROJECTS_CONFIG, fs);

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 项目管理系统后端运行在 http://localhost:${PORT}`);
  console.log(`📁 项目根目录: ${PROJECT_ROOT}`);
  console.log(`📋 配置文件: ${PROJECTS_CONFIG}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在停止所有进程...');
  processManager.stopAll();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n收到 SIGINT 信号，正在停止所有进程...');
  processManager.stopAll();
  process.exit(0);
});

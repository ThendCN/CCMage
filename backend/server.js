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

// 项目根目录（backend的上一级目录）
const PROJECT_ROOT = path.resolve(__dirname, '..');
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

// 6. 添加新项目
app.post('/api/projects/:name', (req, res) => {
  try {
    const { name } = req.params;
    const { project, isExternal } = req.body;

    const config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));

    // 检查项目是否已存在
    if (config.projects[name] || (config.external && config.external[name])) {
      return res.status(400).json({ error: '项目名称已存在' });
    }

    // 添加到相应的分类
    if (isExternal) {
      if (!config.external) config.external = {};
      config.external[name] = project;
    } else {
      config.projects[name] = project;
    }

    // 更新 active/archived 数组
    if (project.status === 'active') {
      if (!config.active) config.active = [];
      config.active.push(name);
    } else if (project.status === 'archived') {
      if (!config.archived) config.archived = [];
      config.archived.push(name);
    }

    // 更新元数据
    if (config.meta) {
      config.meta.totalProjects = (config.meta.totalProjects || 0) + 1;
      if (project.status === 'active') {
        config.meta.activeProjects = (config.meta.activeProjects || 0) + 1;
      }
    }

    fs.writeFileSync(PROJECTS_CONFIG, JSON.stringify(config, null, 2), 'utf8');
    res.json({ success: true, message: '项目添加成功' });
  } catch (error) {
    res.status(500).json({ error: '添加项目失败', message: error.message });
  }
});

// 7. 更新项目
app.put('/api/projects/:name', (req, res) => {
  try {
    const { name } = req.params;
    const { project, isExternal } = req.body;

    const config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));

    // 查找项目
    let oldProject = config.projects[name];
    let wasExternal = false;
    if (!oldProject && config.external && config.external[name]) {
      oldProject = config.external[name];
      wasExternal = true;
    }

    if (!oldProject) {
      return res.status(404).json({ error: '项目不存在' });
    }

    // 删除旧位置
    if (wasExternal) {
      delete config.external[name];
    } else {
      delete config.projects[name];
    }

    // 添加到新位置
    if (isExternal) {
      if (!config.external) config.external = {};
      config.external[name] = project;
    } else {
      config.projects[name] = project;
    }

    // 更新 active/archived 数组
    if (config.active) {
      config.active = config.active.filter(n => n !== name);
    }
    if (config.archived) {
      config.archived = config.archived.filter(n => n !== name);
    }

    if (project.status === 'active') {
      if (!config.active) config.active = [];
      config.active.push(name);
    } else if (project.status === 'archived') {
      if (!config.archived) config.archived = [];
      config.archived.push(name);
    }

    fs.writeFileSync(PROJECTS_CONFIG, JSON.stringify(config, null, 2), 'utf8');
    res.json({ success: true, message: '项目更新成功' });
  } catch (error) {
    res.status(500).json({ error: '更新项目失败', message: error.message });
  }
});

// 8. 删除项目
app.delete('/api/projects/:name', (req, res) => {
  try {
    const { name } = req.params;

    const config = JSON.parse(fs.readFileSync(PROJECTS_CONFIG, 'utf8'));

    // 查找项目
    let found = false;
    if (config.projects[name]) {
      delete config.projects[name];
      found = true;
    } else if (config.external && config.external[name]) {
      delete config.external[name];
      found = true;
    }

    if (!found) {
      return res.status(404).json({ error: '项目不存在' });
    }

    // 从 active/archived 数组中移除
    if (config.active) {
      config.active = config.active.filter(n => n !== name);
    }
    if (config.archived) {
      config.archived = config.archived.filter(n => n !== name);
    }

    // 更新元数据
    if (config.meta) {
      config.meta.totalProjects = Math.max(0, (config.meta.totalProjects || 0) - 1);
      if (config.active) {
        config.meta.activeProjects = config.active.length;
      }
    }

    fs.writeFileSync(PROJECTS_CONFIG, JSON.stringify(config, null, 2), 'utf8');
    res.json({ success: true, message: '项目删除成功' });
  } catch (error) {
    res.status(500).json({ error: '删除项目失败', message: error.message });
  }
});

// 9. 打开文件夹选择对话框并自动识别项目信息
app.post('/api/select-folder', async (req, res) => {
  try {
    // 使用 osascript (macOS) 或其他系统命令打开文件夹选择器
    const platform = process.platform;
    let folderPath = '';

    if (platform === 'darwin') {
      // macOS - 使用 AppleScript
      const { stdout } = await execPromise(
        'osascript -e \'POSIX path of (choose folder with prompt "选择项目文件夹")\''
      );
      folderPath = stdout.trim();
    } else if (platform === 'win32') {
      // Windows - 使用 PowerShell
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.Description = "选择项目文件夹"
        $result = $dialog.ShowDialog()
        if ($result -eq 'OK') { Write-Output $dialog.SelectedPath }
      `;
      const { stdout } = await execPromise(`powershell -Command "${psScript}"`);
      folderPath = stdout.trim();
    } else {
      // Linux - 尝试使用 zenity
      const { stdout } = await execPromise('zenity --file-selection --directory --title="选择项目文件夹"');
      folderPath = stdout.trim();
    }

    if (!folderPath) {
      return res.json({ success: false, message: '未选择文件夹' });
    }

    // 自动识别项目信息
    const projectInfo = await detectProjectInfo(folderPath);

    res.json({
      success: true,
      path: folderPath,
      detected: projectInfo
    });
  } catch (error) {
    if (error.message.includes('User canceled') || error.code === 1) {
      res.json({ success: false, message: '用户取消选择' });
    } else {
      res.status(500).json({ error: '打开文件夹选择器失败', message: error.message });
    }
  }
});

// 自动检测项目信息
async function detectProjectInfo(projectPath) {
  const info = {
    name: path.basename(projectPath),
    type: '',
    stack: [],
    description: '',
    port: null,
    hasGit: false
  };

  try {
    // 检测 Git
    if (fs.existsSync(path.join(projectPath, '.git'))) {
      info.hasGit = true;
    }

    // 1. 优先从 README 提取描述
    const readmeInfo = await extractFromReadme(projectPath);
    if (readmeInfo.description) {
      info.description = readmeInfo.description;
    }
    if (readmeInfo.stack.length > 0) {
      info.stack.push(...readmeInfo.stack);
    }

    // 检测 package.json (Node.js项目)
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // 获取描述(如果README没有提供)
      if (!info.description && pkg.description) {
        info.description = pkg.description;
      }

      // 检测框架和技术栈
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps.react || deps['react-dom']) {
        if (!info.stack.includes('React')) info.stack.push('React');
        info.type = 'Web App';
      }
      if (deps.vue || deps['@vue/cli-service']) {
        if (!info.stack.includes('Vue')) info.stack.push('Vue');
        info.type = 'Web App';
      }
      if (deps.next) {
        if (!info.stack.includes('Next.js')) info.stack.push('Next.js');
        info.type = 'Web App';
      }
      if (deps['@angular/core']) {
        if (!info.stack.includes('Angular')) info.stack.push('Angular');
        info.type = 'Web App';
      }
      if (deps.express || deps.koa || deps.fastify) {
        if (!info.stack.includes('Node.js')) info.stack.push('Node.js');
        if (!info.type) info.type = 'Backend API';
      }
      if (deps.typescript) {
        if (!info.stack.includes('TypeScript')) info.stack.push('TypeScript');
      }
      if (deps.vite) {
        if (!info.stack.includes('Vite')) info.stack.push('Vite');
      }

      // 检测端口 (从scripts中推断)
      if (pkg.scripts) {
        const devScript = pkg.scripts.dev || pkg.scripts.start || '';
        const portMatch = devScript.match(/--port[=\s]+(\d+)/i) ||
                         devScript.match(/:(\d{4,5})/);
        if (portMatch) {
          info.port = parseInt(portMatch[1]);
        }
      }

      // 默认端口推断
      if (!info.port) {
        if (deps.react && deps.vite) info.port = 5173;
        else if (deps.react) info.port = 3000;
        else if (deps.vue) info.port = 8080;
        else if (deps.next) info.port = 3000;
        else if (deps.express) info.port = 3000;
      }
    }

    // 检测 Python 项目
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    const setupPyPath = path.join(projectPath, 'setup.py');
    const pyprojectPath = path.join(projectPath, 'pyproject.toml');

    if (fs.existsSync(requirementsPath) || fs.existsSync(setupPyPath) || fs.existsSync(pyprojectPath)) {
      if (!info.stack.includes('Python')) info.stack.push('Python');
      if (!info.type) info.type = 'Python App';

      // 检测 Flask/Django/FastAPI
      if (fs.existsSync(requirementsPath)) {
        const reqs = fs.readFileSync(requirementsPath, 'utf8').toLowerCase();
        if (reqs.includes('flask')) {
          if (!info.stack.includes('Flask')) info.stack.push('Flask');
          info.type = 'Backend API';
          if (!info.port) info.port = 5000;
        }
        if (reqs.includes('django')) {
          if (!info.stack.includes('Django')) info.stack.push('Django');
          info.type = 'Web App';
          if (!info.port) info.port = 8000;
        }
        if (reqs.includes('fastapi')) {
          if (!info.stack.includes('FastAPI')) info.stack.push('FastAPI');
          info.type = 'Backend API';
          if (!info.port) info.port = 8000;
        }
      }
    }

    // 检测 Go 项目
    if (fs.existsSync(path.join(projectPath, 'go.mod'))) {
      if (!info.stack.includes('Go')) info.stack.push('Go');
      if (!info.type) info.type = 'Backend API';
    }

    // 检测 Rust 项目
    if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {
      if (!info.stack.includes('Rust')) info.stack.push('Rust');
      if (!info.type) info.type = 'Application';
    }

    // 检测 Java/Maven 项目
    if (fs.existsSync(path.join(projectPath, 'pom.xml'))) {
      if (!info.stack.includes('Java')) info.stack.push('Java', 'Maven');
      if (!info.type) info.type = 'Java App';
    }

    // 检测 Gradle 项目
    if (fs.existsSync(path.join(projectPath, 'build.gradle')) ||
        fs.existsSync(path.join(projectPath, 'build.gradle.kts'))) {
      if (!info.stack.includes('Java')) info.stack.push('Java', 'Gradle');
      if (!info.type) info.type = 'Java App';
    }

    // 如果没有检测到类型,设置为通用项目
    if (!info.type) {
      info.type = 'Project';
    }

    // 去重技术栈
    info.stack = [...new Set(info.stack)];

  } catch (error) {
    console.error('自动检测项目信息失败:', error);
  }

  return info;
}

// 从 README 提取项目信息
async function extractFromReadme(projectPath) {
  const result = {
    description: '',
    stack: []
  };

  try {
    // 查找 README 文件 (支持多种命名)
    const readmeFiles = ['README.md', 'README.MD', 'readme.md', 'Readme.md', 'README', 'README.txt'];
    let readmePath = null;
    let readmeContent = '';

    for (const filename of readmeFiles) {
      const filepath = path.join(projectPath, filename);
      if (fs.existsSync(filepath)) {
        readmePath = filepath;
        readmeContent = fs.readFileSync(filepath, 'utf8');
        break;
      }
    }

    if (!readmeContent) return result;

    // 提取项目标题和描述
    const lines = readmeContent.split('\n');
    let description = '';

    // 1. 尝试提取第一个标题下的描述
    for (let i = 0; i < Math.min(lines.length, 30); i++) {
      const line = lines[i].trim();

      // 跳过空行和徽章
      if (!line || line.startsWith('[![') || line.startsWith('[!') || line.startsWith('<')) {
        continue;
      }

      // 如果是标题,读取下一行作为描述
      if (line.startsWith('#')) {
        // 跳过标题本身,读取后续内容
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const descLine = lines[j].trim();
          if (descLine && !descLine.startsWith('#') && !descLine.startsWith('[') &&
              !descLine.startsWith('<') && !descLine.startsWith('!')) {
            description = descLine;
            break;
          }
        }
        break;
      }

      // 如果不是标题但是有内容,直接作为描述
      if (line.length > 10 && !line.startsWith('-') && !line.startsWith('*')) {
        description = line;
        break;
      }
    }

    // 2. 清理描述(移除markdown语法)
    if (description) {
      description = description
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // 移除链接
        .replace(/`([^`]+)`/g, '$1')              // 移除行内代码
        .replace(/\*\*([^*]+)\*\*/g, '$1')        // 移除加粗
        .replace(/\*([^*]+)\*/g, '$1')            // 移除斜体
        .replace(/~~([^~]+)~~/g, '$1')            // 移除删除线
        .trim();

      // 限制长度
      if (description.length > 200) {
        description = description.substring(0, 200) + '...';
      }

      result.description = description;
    }

    // 3. 提取技术栈 (从内容中查找常见技术关键词)
    const content = readmeContent.toLowerCase();
    const techKeywords = {
      'react': 'React',
      'vue': 'Vue',
      'angular': 'Angular',
      'next.js': 'Next.js',
      'nuxt': 'Nuxt',
      'svelte': 'Svelte',
      'typescript': 'TypeScript',
      'javascript': 'JavaScript',
      'node.js': 'Node.js',
      'express': 'Express',
      'fastapi': 'FastAPI',
      'django': 'Django',
      'flask': 'Flask',
      'python': 'Python',
      'go': 'Go',
      'golang': 'Go',
      'rust': 'Rust',
      'java': 'Java',
      'spring': 'Spring',
      'tailwind': 'Tailwind CSS',
      'bootstrap': 'Bootstrap',
      'mongodb': 'MongoDB',
      'postgresql': 'PostgreSQL',
      'mysql': 'MySQL',
      'redis': 'Redis',
      'docker': 'Docker',
      'kubernetes': 'K8s',
      'vite': 'Vite',
      'webpack': 'Webpack'
    };

    // 在 ## Tech Stack 或 ## Technologies 段落查找
    const techSectionMatch = content.match(/##\s*(?:tech(?:nolog(?:y|ies))?|stack|built\s*with)[^\n]*\n([^#]*)/i);
    if (techSectionMatch) {
      const techSection = techSectionMatch[1];
      for (const [key, value] of Object.entries(techKeywords)) {
        if (techSection.includes(key) && !result.stack.includes(value)) {
          result.stack.push(value);
        }
      }
    } else {
      // 否则在整个README前1000字符中查找
      const searchContent = content.substring(0, 1000);
      for (const [key, value] of Object.entries(techKeywords)) {
        // 使用正则确保是完整单词匹配
        const regex = new RegExp(`\\b${key}\\b`, 'i');
        if (regex.test(searchContent) && !result.stack.includes(value)) {
          result.stack.push(value);
        }
      }
    }

  } catch (error) {
    console.error('从README提取信息失败:', error);
  }

  return result;
}

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

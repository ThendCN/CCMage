const aiEngineFactory = require('./aiEngineFactory');
const db = require('./database');
const processManager = require('./processManager');
const startupDetector = require('./startupDetector');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * 项目创建路由 - 使用 AI 一句话创建项目
 */
function registerProjectCreationRoutes(app, PROJECT_ROOT) {
  /**
   * POST /api/projects/create-with-ai
   * 使用 AI 一句话创建项目
   * 
   * 请求体:
   * {
   *   "description": "一个博客系统，使用React和Node.js",
   *   "projectName": "my-blog",  // 可选，默认从描述生成
   *   "targetDir": "custom-path", // 可选，默认在 PROJECT_ROOT 下
   *   "preferences": {  // 可选
   *     "stack": ["React", "Node.js"],
   *     "port": 3000,
   *     "autoStart": true,
   *     "autoInstall": true
   *   }
   * }
   * 
   * 响应:
   * {
   *   "success": true,
   *   "sessionId": "my-blog-1701234567890",
   *   "projectName": "my-blog",
   *   "message": "项目创建已启动",
   *   "streamUrl": "/api/projects/create/stream/my-blog-1701234567890"
   * }
   */
  app.post('/api/projects/create-with-ai', async (req, res) => {
    try {
      const { description, projectName: requestedName, targetDir, preferences = {}, engine = 'claude-code' } = req.body;

      console.log('[ProjectCreation] 📬 收到项目创建请求');
      console.log('[ProjectCreation]   - 描述:', description);
      console.log('[ProjectCreation]   - 项目名:', requestedName || '(自动生成)');
      console.log('[ProjectCreation]   - 目标目录:', targetDir || '(默认)');
      console.log('[ProjectCreation]   - AI 引擎:', engine);

      // 验证输入
      if (!description || !description.trim()) {
        return res.status(400).json({ error: '请提供项目描述' });
      }

      // 生成或验证项目名称
      const projectName = requestedName || generateProjectName(description);

      // 检查项目名是否已存在
      const existingProject = db.getProjectByName(projectName);
      if (existingProject) {
        return res.status(400).json({
          error: '项目名称已存在',
          projectName,
          suggestion: `${projectName}-${Date.now()}`
        });
      }

      // 确定项目路径
      const projectPath = targetDir
        ? (path.isAbsolute(targetDir) ? targetDir : path.join(PROJECT_ROOT, targetDir))
        : path.join(PROJECT_ROOT, projectName);

      // 检查目录是否已存在
      if (fs.existsSync(projectPath)) {
        return res.status(400).json({
          error: '目标目录已存在',
          path: projectPath
        });
      }

      // 生成会话 ID
      const sessionId = `${engine}-create-${projectName}-${Date.now()}`;

      // 构建 AI prompt
      const prompt = buildProjectCreationPrompt({
        description,
        projectName,
        projectPath,
        preferences
      });

      console.log('[ProjectCreation] 🤖 构建的 Prompt:');
      console.log('='.repeat(80));
      console.log(prompt);
      console.log('='.repeat(80));

      console.log('[ProjectCreation] 📊 请求参数:');
      console.log('  - description:', description);
      console.log('  - projectName:', projectName);
      console.log('  - projectPath:', projectPath);
      console.log('  - engine:', engine);
      console.log('  - preferences:', JSON.stringify(preferences, null, 2));

      console.log('[ProjectCreation] 🚀 启动 AI 任务');
      console.log('  - sessionId:', sessionId);

      // 保存项目创建的上下文信息,等待 AI 完成后使用
      const creationContext = {
        projectName,
        projectPath,
        preferences: preferences || {}
      };

      aiEngineFactory.execute(
        engine,
        `创建项目: ${projectName}`,
        PROJECT_ROOT, // 在项目根目录执行
        prompt,
        sessionId
      ).catch(error => {
        console.error('[ProjectCreation] ❌ AI 任务启动失败');
        console.error('[ProjectCreation] 错误详情:', error);
        console.error('[ProjectCreation] 错误堆栈:', error.stack);
      });

      // 监听 AI 完成事件,在真正完成时才执行后续处理
      const completionHandler = async (result) => {
        console.log('[ProjectCreation] ✅ AI 任务完成事件触发');
        console.log('[ProjectCreation] 结果:', { success: result.success, duration: result.duration });

        if (result.success) {
          console.log('[ProjectCreation] 开始后续处理...');
          try {
            // 等待后续处理完成
            await handleProjectCreationComplete(
              creationContext.projectName,
              creationContext.projectPath,
              creationContext.preferences
            );
            console.log('[ProjectCreation] ✅ 后续处理完成,项目已添加到数据库');

            // 发出项目创建完成事件,通知 SSE 可以发送 complete 消息了
            aiEngineFactory.emit(engine, `project-creation-ready:${sessionId}`, {
              success: true,
              projectName: creationContext.projectName,
              projectPath: creationContext.projectPath
            });
          } catch (error) {
            console.error('[ProjectCreation] ❌ 后续处理失败:', error);
            // 即使失败也要通知前端
            aiEngineFactory.emit(engine, `project-creation-ready:${sessionId}`, {
              success: false,
              error: error.message
            });
          }
        } else {
          console.error('[ProjectCreation] AI 任务执行失败:', result.error);
          // AI 失败,也要通知前端
          aiEngineFactory.emit(engine, `project-creation-ready:${sessionId}`, {
            success: false,
            error: result.error
          });
        }

        // 移除监听器
        aiEngineFactory.off(engine, `ai-complete:${sessionId}`, completionHandler);
      };

      aiEngineFactory.on(engine, `ai-complete:${sessionId}`, completionHandler);

      // 立即返回会话信息
      res.json({
        success: true,
        sessionId,
        projectName,
        projectPath,
        engine,
        message: '项目创建已启动，请通过 SSE 流监听进度',
        streamUrl: `/api/projects/create/stream/${sessionId}`
      });

    } catch (error) {
      console.error('[ProjectCreation] ❌ 启动项目创建失败:', error);
      res.status(500).json({ error: '启动项目创建失败', message: error.message });
    }
  });

  /**
   * GET /api/projects/create/stream/:sessionId
   * 项目创建进度的 SSE 流
   */
  app.get('/api/projects/create/stream/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    // 从 sessionId 中提取引擎类型 (格式: engine-create-name-timestamp)
    const engine = sessionId.split('-')[0];

    console.log(`[ProjectCreation-SSE] 📡 新的 SSE 连接: ${sessionId}`);
    console.log(`[ProjectCreation-SSE] 🤖 引擎: ${engine}`);

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 监听 AI 输出
    const outputHandler = (log) => {
      res.write(`data: ${JSON.stringify(log)}\n\n`);
    };

    // 监听项目创建完成事件(包括数据库更新)
    const completeHandler = (result) => {
      console.log(`[ProjectCreation-SSE] ✅ 收到项目创建完成事件:`, result);
      res.write(`data: ${JSON.stringify({ type: 'complete', ...result })}\n\n`);
    };

    aiEngineFactory.on(engine, `ai-output:${sessionId}`, outputHandler);
    aiEngineFactory.on(engine, `project-creation-ready:${sessionId}`, completeHandler);

    // 客户端断开连接时清理
    req.on('close', () => {
      console.log(`[ProjectCreation-SSE] 🔌 客户端断开连接: ${sessionId}`);
      aiEngineFactory.off(engine, `ai-output:${sessionId}`, outputHandler);
      aiEngineFactory.off(engine, `project-creation-ready:${sessionId}`, completeHandler);
    });
  });

  /**
   * GET /api/projects/create/status/:sessionId
   * 获取项目创建状态
   */
  app.get('/api/projects/create/status/:sessionId', (req, res) => {
    try {
      const { sessionId } = req.params;
      const status = claudeCodeManager.getSessionStatus(sessionId);
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: '获取创建状态失败', message: error.message });
    }
  });
}

/**
 * 从描述中生成项目名称
 */
function generateProjectName(description) {
  // 简单的实现：提取描述中的关键词
  const words = description
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['使用', '一个', 'the', 'and', 'with'].includes(w));
  
  const name = words.slice(0, 3).join('-');
  return name || `project-${Date.now()}`;
}

/**
 * 构建项目创建的 AI Prompt
 */
function buildProjectCreationPrompt({ description, projectName, projectPath, preferences }) {
  const { stack = [], port, autoStart = true, autoInstall = true } = preferences;

  return `# 项目创建任务

## 📋 项目需求
${description}

## 🎯 项目配置
- **项目名称**: ${projectName}
- **项目路径**: ${projectPath}
${stack.length > 0 ? `- **技术栈**: ${stack.join(', ')}` : ''}
${port ? `- **端口**: ${port}` : ''}

## ✅ 任务要求

请按照以下步骤创建项目：

### 1. 创建项目目录结构
- 在 \`${projectPath}\` 创建项目
- 根据需求选择合适的技术栈和项目结构
- 创建必要的配置文件

### 2. 初始化版本控制
\`\`\`bash
cd "${projectPath}"
git init
\`\`\`

### 3. 生成项目脚手架
根据项目需求生成：
- 如果是 Web 应用，创建前后端目录结构
- 如果有指定技术栈，使用相应的脚手架工具
- 生成 package.json (Node.js) 或 requirements.txt (Python) 等依赖文件
- 创建 README.md 说明文件
- 配置 .gitignore

### 4. 编写基础代码
- 实现基本的项目框架
- 添加必要的配置文件（.env.example 等）
- 编写入口文件

${autoInstall ? `### 5. 安装依赖
\`\`\`bash
cd "${projectPath}"
# 根据项目类型安装依赖
# Node.js: npm install
# Python: pip install -r requirements.txt
# 等等
\`\`\`
` : ''}

### ${autoInstall ? '6' : '5'}. 创建 Git 初始提交
\`\`\`bash
cd "${projectPath}"
git add .
git commit -m "feat: 初始化项目 - ${projectName}"
\`\`\`

## 📝 重要提示
1. 确保所有文件都在 \`${projectPath}\` 目录下创建
2. 遵循最佳实践和代码规范
3. 添加适当的注释和文档
4. 配置文件应该包含合理的默认值
${port ? `5. 如果是 Web 服务，配置端口为 ${port}` : ''}

## ⚠️ 注意事项
- 不要创建不必要的文件
- 保持项目结构清晰简洁
- 确保配置文件的正确性

请开始执行任务，完成后报告创建结果。
`;
}

/**
 * 处理项目创建完成后的操作
 */
async function handleProjectCreationComplete(projectName, projectPath, preferences) {
  try {
    console.log(`[ProjectCreation] 🎉 项目创建完成，开始后续处理: ${projectName}`);

    // 检查项目是否确实创建成功
    if (!fs.existsSync(projectPath)) {
      console.error(`[ProjectCreation] ❌ 项目目录不存在: ${projectPath}`);
      return;
    }

    // 1. 自动检测项目信息
    console.log('[ProjectCreation] 🔍 检测项目信息...');
    const projectInfo = await detectProjectInfo(projectPath);
    
    // 2. 添加到数据库
    console.log('[ProjectCreation] 💾 添加项目到数据库...');
    const projectData = {
      path: projectPath,
      description: (projectInfo.description || (preferences && preferences.description)) || '',
      status: 'active',
      port: (projectInfo.port || (preferences && preferences.port)) || null,
      stack: projectInfo.stack || (preferences && preferences.stack) || [],
      startCommand: projectInfo.startCommand || null
    };
    
    console.log('[ProjectCreation] 项目数据:', JSON.stringify(projectData, null, 2));
    db.addProject(projectName, projectData, path.isAbsolute(projectPath));

    // 3. 触发项目分析
    console.log('[ProjectCreation] 📊 开始项目分析...');
    db.updateProjectAnalysisStatus(projectName, 'analyzing');
    const projectAnalyzer = require('./projectAnalyzer');
    const analysis = await projectAnalyzer.analyzeProject(projectName, projectPath);
    db.saveProjectAnalysis(projectName, analysis);
    console.log('[ProjectCreation] ✅ 项目分析完成');

    // 4. 自动启动（如果需要）
    if (preferences.autoStart) {
      console.log('[ProjectCreation] 🚀 自动启动项目...');
      const startup = startupDetector.detect(projectPath, {
        path: projectPath,
        startCommand: projectInfo.startCommand
      });

      if (startup && startup.command) {
        processManager.start(projectName, startup.command, projectPath);
        console.log('[ProjectCreation] ✅ 项目已启动');
      } else {
        console.log('[ProjectCreation] ⚠️  无法检测启动命令，跳过自动启动');
      }
    }

    console.log(`[ProjectCreation] 🎊 项目 ${projectName} 全部设置完成！`);

  } catch (error) {
    console.error('[ProjectCreation] ❌ 后续处理失败:', error);
  }
}

/**
 * 自动检测项目信息
 */
async function detectProjectInfo(projectPath) {
  const info = {
    name: path.basename(projectPath),
    stack: [],
    description: '',
    port: null,
    startCommand: null
  };

  try {
    // 检测技术栈
    info.stack = await identifyTechStack(projectPath);

    // 读取 README
    const readmeFiles = ['README.md', 'readme.md', 'README', 'README.txt'];
    for (const readme of readmeFiles) {
      const readmePath = path.join(projectPath, readme);
      if (fs.existsSync(readmePath)) {
        const content = fs.readFileSync(readmePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        info.description = lines.slice(0, 3).join(' ').substring(0, 200);
        break;
      }
    }

    // 检测端口
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // 从 scripts 中查找端口
      const scripts = Object.values(packageJson.scripts || {}).join(' ');
      const portMatch = scripts.match(/PORT[=:\s]+(\d+)|port[=:\s]+(\d+)|--port[=\s]+(\d+)/i);
      if (portMatch) {
        info.port = parseInt(portMatch[1] || portMatch[2] || portMatch[3]);
      }

      // 检测启动命令
      if (packageJson.scripts) {
        info.startCommand = packageJson.scripts.dev || packageJson.scripts.start || null;
      }
    }

  } catch (error) {
    console.error('[ProjectCreation] 检测项目信息失败:', error);
  }

  return info;
}

/**
 * 识别技术栈
 */
async function identifyTechStack(projectPath) {
  const stack = new Set();

  // 检查文件存在性
  const files = {
    'package.json': fs.existsSync(path.join(projectPath, 'package.json')),
    'requirements.txt': fs.existsSync(path.join(projectPath, 'requirements.txt')),
    'Cargo.toml': fs.existsSync(path.join(projectPath, 'Cargo.toml')),
    'go.mod': fs.existsSync(path.join(projectPath, 'go.mod')),
    'pom.xml': fs.existsSync(path.join(projectPath, 'pom.xml')),
    'Gemfile': fs.existsSync(path.join(projectPath, 'Gemfile'))
  };

  // Node.js 项目
  if (files['package.json']) {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8')
      );
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // 框架检测
      if (deps.react) stack.add('React');
      if (deps.vue) stack.add('Vue');
      if (deps.next) stack.add('Next.js');
      if (deps.express) stack.add('Express');
      if (deps.vite) stack.add('Vite');
      if (deps.typescript) stack.add('TypeScript');

      if (stack.size === 0) stack.add('Node.js');
    } catch (e) {
      stack.add('Node.js');
    }
  }

  // Python 项目
  if (files['requirements.txt']) {
    const requirements = fs.readFileSync(path.join(projectPath, 'requirements.txt'), 'utf8');
    if (requirements.includes('django')) stack.add('Django');
    if (requirements.includes('flask')) stack.add('Flask');
    if (requirements.includes('fastapi')) stack.add('FastAPI');
    if (stack.size === 0) stack.add('Python');
  }

  // 其他语言
  if (files['Cargo.toml']) stack.add('Rust');
  if (files['go.mod']) stack.add('Go');
  if (files['pom.xml']) stack.add('Java');
  if (files['Gemfile']) stack.add('Ruby');

  return Array.from(stack);
}

module.exports = { registerProjectCreationRoutes };

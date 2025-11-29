const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * 项目分析器 - 使用 Claude Code SDK 分析项目结构和特征
 */
class ProjectAnalyzer {
  constructor() {
    this.sdkModule = null;
  }

  /**
   * 动态导入 Claude Agent SDK
   */
  async loadSDK() {
    if (!this.sdkModule) {
      console.log('[ProjectAnalyzer] 🔄 动态加载 Claude Agent SDK...');
      try {
        this.sdkModule = await import('@anthropic-ai/claude-agent-sdk');
        console.log('[ProjectAnalyzer] ✅ Claude Agent SDK 加载成功');
      } catch (error) {
        console.error('[ProjectAnalyzer] ❌ 加载 Claude Agent SDK 失败:', error);
        throw new Error('无法加载 Claude Agent SDK: ' + error.message);
      }
    }
    return this.sdkModule;
  }

  /**
   * 分析单个项目
   * @param {string} projectName - 项目名称
   * @param {string} projectPath - 项目路径
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeProject(projectName, projectPath) {
    console.log(`[ProjectAnalyzer] 🔍 开始分析项目: ${projectName}`);
    console.log(`[ProjectAnalyzer]   路径: ${projectPath}`);

    try {
      // 1. 检查项目路径是否存在
      if (!fs.existsSync(projectPath)) {
        throw new Error(`项目路径不存在: ${projectPath}`);
      }

      // 2. 进行快速静态分析
      const staticAnalysis = await this.performStaticAnalysis(projectPath);
      console.log(`[ProjectAnalyzer] ✅ 静态分析完成`);

      // 3. 使用 AI 进行深度分析
      const aiAnalysis = await this.performAIAnalysis(projectName, projectPath, staticAnalysis);
      console.log(`[ProjectAnalyzer] ✅ AI 分析完成`);

      // 4. 合并分析结果
      const result = {
        ...staticAnalysis,
        ...aiAnalysis,
        analyzed: true,
        analyzed_at: new Date().toISOString(),
        analysis_status: 'completed',
        analysis_error: null
      };

      console.log(`[ProjectAnalyzer] 🎉 项目分析完成: ${projectName}`);
      return result;

    } catch (error) {
      console.error(`[ProjectAnalyzer] ❌ 分析失败: ${projectName}`, error);
      return {
        analyzed: false,
        analyzed_at: new Date().toISOString(),
        analysis_status: 'failed',
        analysis_error: error.message
      };
    }
  }

  /**
   * 执行静态分析（不使用 AI）
   */
  async performStaticAnalysis(projectPath) {
    const result = {
      framework: null,
      languages: [],
      dependencies: {},
      file_count: 0,
      loc: 0,
      readme_summary: null,
      // 新增字段
      start_command: null,
      port: null,
      scripts: {},
      environment_files: [],
      config_files: []
    };

    try {
      // 检测框架
      result.framework = this.detectFramework(projectPath);

      // 检测语言
      result.languages = this.detectLanguages(projectPath);

      // 读取依赖信息
      result.dependencies = this.extractDependencies(projectPath);

      // 统计文件数量和代码行数
      const stats = this.countFilesAndLines(projectPath);
      result.file_count = stats.fileCount;
      result.loc = stats.loc;

      // 读取 README 摘要
      result.readme_summary = this.extractReadmeSummary(projectPath);

      // 检测启动命令和脚本
      const startInfo = this.detectStartCommand(projectPath, result.framework);
      result.start_command = startInfo.command;
      result.port = startInfo.port;
      result.scripts = startInfo.scripts;

      // 检测配置文件
      result.environment_files = this.detectEnvironmentFiles(projectPath);
      result.config_files = this.detectConfigFiles(projectPath);

    } catch (error) {
      console.error('[ProjectAnalyzer] ⚠️  静态分析部分失败:', error);
    }

    return result;
  }

  /**
   * 使用 AI 进行深度分析
   */
  async performAIAnalysis(projectName, projectPath, staticAnalysis) {
    try {
      const sdk = await this.loadSDK();

      // 构建分析提示词
      const prompt = this.buildAnalysisPrompt(projectName, staticAnalysis);

      console.log(`[ProjectAnalyzer] 📝 创建 AI 分析 query...`);

      // 创建 query
      const queryInstance = sdk.query({
        prompt: prompt,
        options: {
          cwd: projectPath,
          settingSources: ['project', 'user'],
          systemPrompt: {
            type: 'preset',
            preset: 'claude_code'
          },
          env: { ...process.env },
          maxTurns: 10 // 限制轮次，快速分析
        }
      });

      // 收集 AI 响应
      let aiResponse = '';
      for await (const message of queryInstance) {
        if (message.type === 'assistant' && message.message?.content) {
          const textContent = message.message.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');
          aiResponse += textContent + '\n';
        }
      }

      // 解析 AI 响应
      return this.parseAIResponse(aiResponse);

    } catch (error) {
      console.error('[ProjectAnalyzer] ⚠️  AI 分析失败:', error);
      return {
        architecture_notes: '暂无架构说明（AI 分析失败）',
        main_features: []
      };
    }
  }

  /**
   * 构建 AI 分析提示词
   */
  buildAnalysisPrompt(projectName, staticAnalysis) {
    return `请深入分析项目 "${projectName}" 的运行环境、启动配置和架构特征。

## 当前已检测到的信息

- **框架**: ${staticAnalysis.framework || '未知'}
- **语言**: ${staticAnalysis.languages.join(', ') || '未知'}
- **文件数**: ${staticAnalysis.file_count}
- **代码行数**: ${staticAnalysis.loc}
- **检测到的启动命令**: ${staticAnalysis.start_command || '未检测到'}
- **检测到的端口**: ${staticAnalysis.port || '未检测到'}
- **环境文件**: ${staticAnalysis.environment_files?.join(', ') || '无'}
- **配置文件**: ${staticAnalysis.config_files?.join(', ') || '无'}

## 分析任务

请验证并补充以下信息：

### 1. 运行环境要求
- **运行时版本**: 读取 package.json 的 "engines" 字段、.nvmrc、.python-version 等，确定 Node.js/Python/其他运行时的版本要求
- **包管理工具**: 检测是使用 npm/yarn/pnpm (查看 package-lock.json/yarn.lock/pnpm-lock.yaml)
- **系统依赖**: 是否需要安装额外的系统工具（如 Python、Redis、PostgreSQL 等）

### 2. 启动命令验证
- **开发命令**: 验证静态分析检测到的启动命令是否正确，从 package.json scripts、README.md 中确认
- **生产命令**: 查找生产环境的启动方式（npm start、pm2、docker 等）
- **构建命令**: 如果是需要编译的项目，找出构建命令（npm run build 等）
- **安装命令**: 确认依赖安装命令（npm install、pip install -r requirements.txt 等）

### 3. 环境变量分析
- **必需变量**: 从 .env.example、README.md、配置文件中提取必需的环境变量
- **可选变量**: 提取可选的环境变量
- **默认值**: 标注哪些变量有默认值

### 4. 端口和服务配置
- **默认端口**: 验证并确认项目的默认监听端口
- **端口配置方式**: 如何自定义端口（环境变量名、配置文件位置）
- **其他服务**: 是否依赖其他服务（数据库、Redis、消息队列等）及其默认端口

### 5. 架构和功能
- **架构说明**: 简要描述项目的整体架构（如：前后端分离的全栈应用、微服务、单体应用等）
- **技术栈**: 列出核心技术和工具
- **主要功能**: 列出3-5个核心功能特性
- **项目描述**: 用1-2句话概括项目的用途

## 输出格式要求

**重要：请严格按照以下 JSON 格式输出，不要包含任何 markdown 标记之外的文字。**

\`\`\`json
{
  "runtime": {
    "name": "Node.js",
    "version": ">=18.0.0",
    "packageManager": "npm",
    "systemDependencies": ["Python 3.x", "PostgreSQL 14+"]
  },
  "startCommands": {
    "install": "npm install",
    "dev": "npm run dev",
    "build": "npm run build",
    "prod": "npm start"
  },
  "port": {
    "default": 3000,
    "envVar": "PORT",
    "configFile": "config/server.js"
  },
  "environmentVariables": [
    {
      "name": "DATABASE_URL",
      "required": true,
      "description": "数据库连接字符串",
      "default": null,
      "example": "postgresql://user:pass@localhost:5432/db"
    },
    {
      "name": "API_KEY",
      "required": false,
      "description": "第三方 API 密钥",
      "default": "demo_key"
    }
  ],
  "services": [
    {
      "name": "PostgreSQL",
      "port": 5432,
      "required": true
    },
    {
      "name": "Redis",
      "port": 6379,
      "required": false
    }
  ],
  "architecture_notes": "这是一个前后端分离的全栈应用，前端使用 React + Vite，后端使用 Express + PostgreSQL，支持 RESTful API 和实时通信。",
  "main_features": [
    "用户认证和权限管理",
    "实时数据同步",
    "文件上传和管理",
    "报表生成和导出"
  ],
  "description": "企业级项目管理系统，提供任务跟踪、团队协作和数据分析功能。",
  "techStack": ["React", "Vite", "Express", "PostgreSQL", "Socket.io"]
}
\`\`\`

## 注意事项

1. **务必读取实际文件**：不要猜测，请读取 package.json、README.md、.env.example 等文件
2. **验证启动命令**：确保启动命令准确无误
3. **环境变量完整性**：尽可能提取所有环境变量及其说明
4. **简洁准确**：所有描述保持简洁但准确
5. **只返回 JSON**：不要在 JSON 代码块之外添加任何文字

现在请开始分析项目。`;
  }

  /**
   * 解析 AI 响应
   */
  parseAIResponse(response) {
    try {
      // 尝试提取 JSON
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[1]);

        // 转换为数据库格式
        const result = {
          architecture_notes: data.architecture_notes || '暂无架构说明',
          main_features: Array.isArray(data.main_features)
            ? JSON.stringify(data.main_features)
            : JSON.stringify([]),
          description: data.description || null,
          tech: data.techStack ? JSON.stringify(data.techStack) : null,
          framework: data.runtime?.name || null,
          languages: data.techStack ? JSON.stringify(data.techStack.filter(t =>
            ['JavaScript', 'TypeScript', 'Python', 'Go', 'Rust', 'Java'].includes(t)
          )) : null
        };

        // 保存启动命令（优先使用 dev）
        if (data.startCommands) {
          result.start_command = data.startCommands.dev || data.startCommands.prod || null;
        }

        // 保存端口信息
        if (data.port && data.port.default) {
          result.port = data.port.default;
        }

        // 保存完整的分析数据到 dependencies 字段（JSON）
        result.dependencies = JSON.stringify({
          runtime: data.runtime || {},
          startCommands: data.startCommands || {},
          port: data.port || {},
          environmentVariables: data.environmentVariables || [],
          services: data.services || []
        });

        console.log('[ProjectAnalyzer] ✅ 成功解析 AI 响应');
        return result;
      }

      // 如果没有 JSON，尝试解析纯文本
      console.warn('[ProjectAnalyzer] ⚠️  未找到 JSON 格式，使用降级方案');
      return {
        architecture_notes: response.substring(0, 500) || '暂无架构说明',
        main_features: JSON.stringify([])
      };
    } catch (error) {
      console.error('[ProjectAnalyzer] ⚠️  解析 AI 响应失败:', error);
      return {
        architecture_notes: '暂无架构说明（解析失败）',
        main_features: JSON.stringify([])
      };
    }
  }

  /**
   * 检测项目框架
   */
  detectFramework(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    const goModPath = path.join(projectPath, 'go.mod');
    const cargoPath = path.join(projectPath, 'Cargo.toml');

    // Node.js 项目
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (deps.react || deps['@types/react']) return 'React';
        if (deps.vue || deps['@vue/cli-service']) return 'Vue';
        if (deps.angular || deps['@angular/core']) return 'Angular';
        if (deps.next) return 'Next.js';
        if (deps.express) return 'Express';
        if (deps.koa) return 'Koa';
        if (deps.nestjs || deps['@nestjs/core']) return 'NestJS';

        return 'Node.js';
      } catch (error) {
        return 'Node.js';
      }
    }

    // Python 项目
    if (fs.existsSync(requirementsPath)) {
      const content = fs.readFileSync(requirementsPath, 'utf8');
      if (content.includes('django')) return 'Django';
      if (content.includes('flask')) return 'Flask';
      if (content.includes('fastapi')) return 'FastAPI';
      return 'Python';
    }

    // Go 项目
    if (fs.existsSync(goModPath)) {
      return 'Go';
    }

    // Rust 项目
    if (fs.existsSync(cargoPath)) {
      return 'Rust';
    }

    return null;
  }

  /**
   * 检测项目使用的编程语言
   */
  detectLanguages(projectPath) {
    const languages = new Set();
    const extensions = {
      '.js': 'JavaScript',
      '.jsx': 'JavaScript',
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript',
      '.py': 'Python',
      '.go': 'Go',
      '.rs': 'Rust',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.rb': 'Ruby',
      '.php': 'PHP',
      '.swift': 'Swift',
      '.kt': 'Kotlin'
    };

    const scanDir = (dir, depth = 0) => {
      if (depth > 3) return; // 限制扫描深度
      if (path.basename(dir).startsWith('.')) return; // 跳过隐藏目录
      if (['node_modules', 'dist', 'build', 'vendor'].includes(path.basename(dir))) return;

      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            scanDir(fullPath, depth + 1);
          } else {
            const ext = path.extname(file);
            if (extensions[ext]) {
              languages.add(extensions[ext]);
            }
          }
        }
      } catch (error) {
        // 忽略权限错误
      }
    };

    scanDir(projectPath);
    return Array.from(languages);
  }

  /**
   * 提取依赖信息
   */
  extractDependencies(projectPath) {
    const result = {
      production: [],
      development: []
    };

    // Node.js
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        result.production = Object.keys(packageJson.dependencies || {});
        result.development = Object.keys(packageJson.devDependencies || {});
      } catch (error) {
        // 忽略错误
      }
    }

    // Python
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    if (fs.existsSync(requirementsPath)) {
      try {
        const content = fs.readFileSync(requirementsPath, 'utf8');
        result.production = content.split('\n')
          .filter(line => line.trim() && !line.startsWith('#'))
          .map(line => line.split('==')[0].trim());
      } catch (error) {
        // 忽略错误
      }
    }

    return result;
  }

  /**
   * 统计文件数量和代码行数
   */
  countFilesAndLines(projectPath) {
    let fileCount = 0;
    let loc = 0;

    const countDir = (dir, depth = 0) => {
      if (depth > 5) return; // 限制深度
      if (path.basename(dir).startsWith('.')) return;
      if (['node_modules', 'dist', 'build', 'vendor', '.git'].includes(path.basename(dir))) return;

      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            countDir(fullPath, depth + 1);
          } else {
            fileCount++;
            // 只统计代码文件
            const ext = path.extname(file);
            if (['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.rs', '.java', '.cpp', '.c'].includes(ext)) {
              try {
                const content = fs.readFileSync(fullPath, 'utf8');
                loc += content.split('\n').length;
              } catch (error) {
                // 忽略读取错误
              }
            }
          }
        }
      } catch (error) {
        // 忽略权限错误
      }
    };

    countDir(projectPath);
    return { fileCount, loc };
  }

  /**
   * 提取 README 摘要
   */
  extractReadmeSummary(projectPath) {
    const readmePaths = [
      path.join(projectPath, 'README.md'),
      path.join(projectPath, 'readme.md'),
      path.join(projectPath, 'README'),
      path.join(projectPath, 'README.txt')
    ];

    for (const readmePath of readmePaths) {
      if (fs.existsSync(readmePath)) {
        try {
          const content = fs.readFileSync(readmePath, 'utf8');
          // 提取前500个字符作为摘要
          const lines = content.split('\n').filter(line => line.trim());
          const summary = lines.slice(0, 10).join(' ').substring(0, 500);
          return summary || null;
        } catch (error) {
          // 忽略错误
        }
      }
    }

    return null;
  }

  /**
   * 检测启动命令
   */
  detectStartCommand(projectPath, framework) {
    const result = {
      command: null,
      port: null,
      scripts: {}
    };

    // 1. 优先检查 package.json (Node.js 项目)
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const scripts = packageJson.scripts || {};
        result.scripts = scripts;

        // 检测启动命令优先级
        if (scripts.dev) {
          result.command = 'npm run dev';
        } else if (scripts.start) {
          result.command = 'npm start';
        } else if (scripts.serve) {
          result.command = 'npm run serve';
        }

        // 尝试从脚本中提取端口
        const portMatch = JSON.stringify(scripts).match(/--port[=\s]+(\d+)|PORT[=\s]+(\d+)|:\s*(\d{4,5})/);
        if (portMatch) {
          result.port = parseInt(portMatch[1] || portMatch[2] || portMatch[3]);
        }
      } catch (error) {
        console.error('[ProjectAnalyzer] ⚠️  读取 package.json 失败:', error);
      }
    }

    // 2. 检查 Python 项目
    if (framework && framework.includes('Python')) {
      const mainFiles = ['app.py', 'main.py', 'manage.py', 'run.py'];
      for (const file of mainFiles) {
        if (fs.existsSync(path.join(projectPath, file))) {
          if (framework === 'Django') {
            result.command = 'python manage.py runserver';
            result.port = 8000;
          } else if (framework === 'Flask') {
            result.command = `python ${file}`;
            result.port = 5000;
          } else if (framework === 'FastAPI') {
            result.command = `uvicorn ${file.replace('.py', '')}:app --reload`;
            result.port = 8000;
          } else {
            result.command = `python ${file}`;
          }
          break;
        }
      }
    }

    // 3. 检查 Go 项目
    if (framework === 'Go') {
      result.command = 'go run .';
      const mainGoPath = path.join(projectPath, 'main.go');
      if (fs.existsSync(mainGoPath)) {
        try {
          const content = fs.readFileSync(mainGoPath, 'utf8');
          const portMatch = content.match(/:\s*(\d{4,5})/);
          if (portMatch) {
            result.port = parseInt(portMatch[1]);
          }
        } catch (error) {
          // 忽略错误
        }
      }
    }

    // 4. 检查 Rust 项目
    if (framework === 'Rust') {
      result.command = 'cargo run';
    }

    // 5. 检查 Makefile
    const makefilePath = path.join(projectPath, 'Makefile');
    if (fs.existsSync(makefilePath) && !result.command) {
      try {
        const content = fs.readFileSync(makefilePath, 'utf8');
        if (content.includes('run:') || content.includes('start:')) {
          result.command = 'make run';
        } else if (content.includes('dev:')) {
          result.command = 'make dev';
        }
      } catch (error) {
        // 忽略错误
      }
    }

    // 6. 尝试从环境文件中检测端口
    if (!result.port) {
      const envPort = this.detectPortFromEnv(projectPath);
      if (envPort) {
        result.port = envPort;
      }
    }

    return result;
  }

  /**
   * 从环境文件中检测端口
   */
  detectPortFromEnv(projectPath) {
    const envFiles = ['.env', '.env.local', '.env.development'];

    for (const envFile of envFiles) {
      const envPath = path.join(projectPath, envFile);
      if (fs.existsSync(envPath)) {
        try {
          const content = fs.readFileSync(envPath, 'utf8');
          const portMatch = content.match(/PORT\s*=\s*(\d+)/i);
          if (portMatch) {
            return parseInt(portMatch[1]);
          }
        } catch (error) {
          // 忽略错误
        }
      }
    }

    return null;
  }

  /**
   * 检测环境文件
   */
  detectEnvironmentFiles(projectPath) {
    const envFiles = [];
    const possibleEnvFiles = [
      '.env',
      '.env.local',
      '.env.development',
      '.env.production',
      '.env.test',
      '.env.example',
      'config.json',
      'config.yml',
      'config.yaml'
    ];

    for (const file of possibleEnvFiles) {
      if (fs.existsSync(path.join(projectPath, file))) {
        envFiles.push(file);
      }
    }

    return envFiles;
  }

  /**
   * 检测配置文件
   */
  detectConfigFiles(projectPath) {
    const configFiles = [];
    const possibleConfigs = [
      'vite.config.js',
      'vite.config.ts',
      'webpack.config.js',
      'rollup.config.js',
      'tsconfig.json',
      'babel.config.js',
      '.babelrc',
      'tailwind.config.js',
      'postcss.config.js',
      'next.config.js',
      'nuxt.config.js',
      'vue.config.js',
      'angular.json',
      'nest-cli.json',
      'Cargo.toml',
      'go.mod',
      'requirements.txt',
      'Pipfile',
      'pyproject.toml'
    ];

    for (const file of possibleConfigs) {
      if (fs.existsSync(path.join(projectPath, file))) {
        configFiles.push(file);
      }
    }

    return configFiles;
  }
}

module.exports = new ProjectAnalyzer();

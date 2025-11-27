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
      readme_summary: null
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
    return `请分析这个项目并提供以下信息：

项目名称: ${projectName}
框架: ${staticAnalysis.framework || '未知'}
语言: ${staticAnalysis.languages.join(', ')}
文件数: ${staticAnalysis.file_count}
代码行数: ${staticAnalysis.loc}

请提供：
1. **架构说明**：简要描述项目的整体架构和技术栈（50-100字）
2. **主要功能**：列出项目的3-5个核心功能（每个功能用一句话描述）

请用以下 JSON 格式回复（直接返回 JSON，不要其他文字）：
\`\`\`json
{
  "architecture_notes": "架构说明...",
  "main_features": ["功能1", "功能2", "功能3"]
}
\`\`\`

注意：
- 只分析代码结构，不要运行任何命令
- 聚焦于项目的核心特征
- 保持简洁和准确`;
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
        return {
          architecture_notes: data.architecture_notes || '暂无架构说明',
          main_features: Array.isArray(data.main_features) ? data.main_features : []
        };
      }

      // 如果没有 JSON，尝试解析纯文本
      return {
        architecture_notes: response.substring(0, 500) || '暂无架构说明',
        main_features: []
      };
    } catch (error) {
      console.error('[ProjectAnalyzer] ⚠️  解析 AI 响应失败:', error);
      return {
        architecture_notes: '暂无架构说明',
        main_features: []
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
}

module.exports = new ProjectAnalyzer();

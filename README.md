<h1 align="center">🚀 Project Manager</h1>

<p align="center">
  <strong>智能化多项目管理系统 | Intelligent Multi-Project Management System</strong>
</p>

<p align="center">
  <a href="#features">功能特性</a> •
  <a href="#quick-start">快速开始</a> •
  <a href="#documentation">文档</a> •
  <a href="#contributing">贡献指南</a> •
  <a href="#license">许可证</a>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen">
  <img alt="React" src="https://img.shields.io/badge/react-18.2.0-61dafb">
</p>

---

## 📖 简介

Project Manager 是一个现代化的图形化项目管理工具,专为开发者设计,用于统一管理多个开发项目。提供项目状态监控、快速操作、AI 编程助手等强大功能,让项目管理更加高效。

### ✨ 核心特性 {#features}

#### 🎯 项目管理
- **可视化项目卡片** - 清晰展示所有项目,支持按状态分类(活跃/生产/归档)
- **实时状态监控** - 自动检测 Git 状态、依赖安装状态、运行状态
- **智能项目检测** - 自动识别项目类型、技术栈、启动命令
- **分类筛选** - 快速筛选不同状态的项目

#### ⚡ 快速操作
- **一键操作** - 打开目录、启动 VSCode、安装依赖
- **进程管理** - 启动/停止项目服务,实时查看日志
- **批量操作** - 同时操作多个项目
- **配置编辑** - 图形化编辑项目配置

#### 🤖 AI 编程助手
- **Claude Code 集成** - 内置 Claude Agent SDK,提供 AI 编程支持
- **实时对话** - 流式输出,实时显示 AI 执行过程
- **Markdown 渲染** - 支持代码高亮、复制功能
- **历史记录** - 自动保存对话历史,支持回溯

#### 📊 进程监控
- **服务管理** - 启动/停止项目开发服务器
- **日志查看** - 实时 SSE 流式日志输出
- **状态追踪** - 监控服务运行状态和端口占用

## 🚀 快速开始 {#quick-start}

### 前置要求

- Node.js >= 16.0.0
- npm >= 7.0.0
- Git

### 安装步骤

1. **克隆项目**
```bash
git clone https://github.com/yourusername/project-manager.git
cd project-manager
```

2. **安装依赖**
```bash
# 安装前端和后端依赖
npm run install:all
```

3. **配置项目列表**
```bash
# 复制示例配置
cp .claude/projects.example.json .claude/projects.json

# 编辑配置,添加你的项目
# 配置格式参见下方「配置说明」
```

4. **配置环境变量(可选)**
```bash
# 如果需要使用 AI 功能
cp .env.example .env
# 编辑 .env 文件,填入 ANTHROPIC_API_KEY
```

5. **启动开发服务**
```bash
# 启动前后端开发服务器
npm run dev

# 或者分别启动:
# 前端 (http://localhost:5173)
npm run dev:frontend

# 后端 (http://localhost:9999)
npm run dev:backend
```

6. **访问应用**

打开浏览器访问 http://localhost:5173

## 📋 配置说明

### 项目配置文件 (.claude/projects.json)

```json
{
  "projects": {
    "my-app": {
      "path": "my-app",                    // 相对路径
      "tech": ["React", "Node.js"],        // 技术栈
      "status": "active",                  // 状态: active/production/archived
      "port": 3000,                        // 端口号
      "description": "我的应用",           // 描述
      "startCommand": "npm run dev"        // 启动命令(可选,会自动检测)
    }
  },
  "external": {
    "external-project": {
      "path": "/absolute/path/to/project", // 绝对路径
      "tech": ["Vue"],
      "status": "production",
      "port": 8080,
      "description": "外部项目"
    }
  }
}
```

### 支持的项目类型

系统会自动检测以下项目类型和启动命令:

- **Node.js** - 检测 package.json 中的 dev/start 脚本
- **Python** - 检测 requirements.txt / pyproject.toml
- **Vue/React/Next.js** - 自动识别框架
- **自定义** - 可手动配置启动命令

## 🛠️ 技术栈

### 后端
- **Node.js + Express** - RESTful API 服务
- **Claude Agent SDK** - AI 编程助手集成
- **CORS** - 跨域支持
- **Child Process** - 进程管理
- **SSE** - 服务器推送事件

### 前端
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 现代化构建工具
- **Lucide React** - 图标库
- **React Markdown** - Markdown 渲染
- **React Syntax Highlighter** - 代码高亮

## 📁 项目结构

```
project-manager/
├── backend/                    # 后端服务
│   ├── server.js              # Express 服务器主文件
│   ├── routes.js              # API 路由定义
│   ├── processManager.js      # 进程管理模块
│   ├── startupDetector.js     # 项目启动命令检测
│   ├── claudeCodeManager.js   # Claude Code SDK 集成
│   └── package.json           # 后端依赖
├── frontend/                   # 前端应用
│   ├── src/
│   │   ├── components/        # React 组件
│   │   │   ├── ProjectCard.tsx      # 项目卡片
│   │   │   ├── AiDialog.tsx         # AI 对话框
│   │   │   ├── LogViewer.tsx        # 日志查看器
│   │   │   └── MarkdownRenderer.tsx # Markdown 渲染器
│   │   ├── App.tsx            # 主应用组件
│   │   ├── api.ts             # API 调用封装
│   │   └── types.ts           # TypeScript 类型定义
│   ├── index.html             # HTML 入口
│   └── package.json           # 前端依赖
├── .claude/                    # Claude Code 配置
│   └── projects.example.json  # 项目配置示例
├── docs/                       # 文档目录
│   └── ARCHITECTURE.md        # 架构文档
├── .gitignore                 # Git 忽略规则
├── .env.example               # 环境变量示例
├── LICENSE                    # MIT 许可证
├── CONTRIBUTING.md            # 贡献指南
├── package.json               # 根目录脚本
└── README.md                  # 本文件
```

## 🎯 主要功能详解

### 1. 项目状态监控

自动检测并显示:
- ✅ Git 仓库状态(分支、未提交文件数)
- ✅ 依赖安装状态(node_modules / venv)
- ✅ 项目端口信息
- ✅ 技术栈和描述
- ✅ 运行状态

### 2. 进程管理

- 启动/停止项目开发服务器
- 实时查看服务日志(SSE 流式输出)
- 自动检测启动命令
- 支持自定义启动命令
- 优雅关闭进程

### 3. AI 编程助手

基于 **Claude Agent SDK** 的智能编程助手:

- **实时对话** - 流式输出,无需等待
- **工具调用可视化** - 显示文件读写、命令执行等操作
- **Markdown 渲染** - 代码高亮、表格、列表等完整支持
- **历史记录** - 自动保存,支持查看历史对话
- **进度提示** - emoji 图标显示操作类型

支持的操作类型:
- 📖 读取文件
- ✍️ 写入文件
- ✏️ 编辑文件
- ⚙️ 执行命令
- 🔍 搜索文件/内容
- 🌐 网页访问
- 🤖 启动子任务

## 📚 API 接口文档 {#documentation}

### 项目管理 API

#### 获取所有项目
```http
GET /api/projects
```

#### 获取单个项目状态
```http
GET /api/projects/:name/status
```

#### 批量获取项目状态
```http
POST /api/projects/status/batch
Content-Type: application/json

{
  "projectNames": ["project1", "project2"]
}
```

#### 更新项目配置
```http
PUT /api/projects
Content-Type: application/json

{
  "projects": { ... },
  "external": { ... }
}
```

#### 执行项目操作
```http
POST /api/projects/:name/action
Content-Type: application/json

{
  "action": "open-directory" | "open-vscode" | "install-deps" | "git-status"
}
```

### 进程管理 API

#### 启动项目服务
```http
POST /api/projects/:name/start
Content-Type: application/json

{
  "command": "npm run dev"  // 可选,默认自动检测
}
```

#### 停止项目服务
```http
POST /api/projects/:name/stop
```

#### 获取运行状态
```http
GET /api/projects/:name/running
```

#### 获取实时日志 (SSE)
```http
GET /api/projects/:name/logs/stream
```

### AI 助手 API

#### 执行 AI 任务
```http
POST /api/projects/:name/ai
Content-Type: application/json

{
  "prompt": "帮我添加一个登录功能"
}
```

#### 获取 AI 输出流 (SSE)
```http
GET /api/projects/:name/ai/stream/:sessionId
```

#### 终止 AI 会话
```http
POST /api/projects/:name/ai/terminate/:sessionId
```

#### 获取历史记录
```http
GET /api/projects/:name/ai/history
```

详细 API 文档请参见 [docs/API.md](docs/API.md)

## 🤝 贡献指南 {#contributing}

我们欢迎所有形式的贡献!请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详细信息。

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 遵循 KISS 原则 - 保持简单
- 遵循 YAGNI 原则 - 只实现必需功能
- 单个文件不超过 200 行
- 使用 TypeScript 类型检查
- 保持代码整洁和可读性

## 🐛 故障排查

### 端口被占用
```bash
# 查看占用 9999 端口的进程
lsof -i :9999

# 杀死进程
kill -9 <PID>
```

### 依赖安装失败
```bash
# 清除缓存后重新安装
rm -rf node_modules package-lock.json
npm install
```

### API 调用失败
- 检查后端服务是否启动 (`http://localhost:9999`)
- 查看浏览器 Console 错误信息
- 检查 `.claude/projects.json` 格式是否正确
- 确保项目路径存在

### AI 功能无法使用
- 检查 `.env` 文件中的 `ANTHROPIC_API_KEY` 是否配置
- 确保已安装 `@anthropic-ai/claude-agent-sdk` 依赖
- 查看后端日志确认 SDK 加载状态

## 📄 许可证 {#license}

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Claude](https://www.anthropic.com/claude) - AI 编程助手
- [React](https://react.dev/) - UI 框架
- [Vite](https://vitejs.dev/) - 构建工具
- [Lucide](https://lucide.dev/) - 图标库

---

<p align="center">
  Made with ❤️ by the Project Manager Contributors
</p>

<p align="center">
  <a href="#top">回到顶部 ⬆️</a>
</p>

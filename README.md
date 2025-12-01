<p align="center">
  <img src="logo.svg" alt="CCMage Logo" width="400">
</p>

<p align="center">
  <strong>专为 Vibe Coding 开发者打造的 AI 辅助开发系统</strong>
</p>

<p align="center">
  多引擎 AI 编程助手 + 智能项目管理 + 任务拆分与协作
</p>

<p align="center">
  <a href="https://github.com/ThendCN/CCMage/wiki">📚 Wiki 文档</a> •
  <a href="https://github.com/ThendCN/CCMage/wiki/Quick-Start">快速开始</a> •
  <a href="https://github.com/ThendCN/CCMage/releases">版本发布</a> •
  <a href="https://github.com/ThendCN/CCMage/wiki/FAQ">常见问题</a> •
  <a href="#contributing">贡献指南</a>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen">
  <img alt="React" src="https://img.shields.io/badge/react-18.2.0-61dafb">
  <img alt="AI" src="https://img.shields.io/badge/AI-Multi%20Engine-9b59b6">
  <img alt="Version" src="https://img.shields.io/badge/version-1.2.2-orange">
</p>

---

## 📖 简介

**CCMage** 是专为 Vibe Coding 开发者设计的 **AI 辅助开发系统**。

### 😫 你是否遇到这些困扰？

当你同时维护多个项目时：
- 🔀 **项目切换混乱** - 不同项目的启动命令、端口配置记不住
- 💸 **AI 费用失控** - 不知道每天用了多少 Token，成本不透明
- 🐛 **错误排查困难** - 项目启动失败，看不懂复杂的错误日志
- 🌐 **演示项目繁琐** - 想给客户演示本地项目，配置内网穿透太麻烦
- 🤖 **AI 协作低效** - 在多个 AI 工具间切换，上下文经常丢失

### ✨ CCMage 来帮你解决

**CCMage = 统一项目中心 + 多引擎 AI 助手 + 费用追踪 + 内网穿透**

#### 🎯 核心能力

| 能力 | 说明 | 价值 |
|-----|------|------|
| 🎯 **统一项目管理中心** | 可视化面板管理所有项目，一键启动/停止 | 告别项目切换混乱 |
| 🤖 **多引擎 AI 助手** | Claude Code、Codex 自由切换，任务拆分、协作编码 | AI 真正理解你的项目 |
| 💰 **精确费用追踪** | 自动记录 Token 使用量，精确到每一分钱 | 成本透明可控 |
| 🩺 **AI 智能诊断** | 自动分析错误日志，给出解决方案 | 快速定位和修复问题 |
| 🌐 **一键内网穿透** | Frpc 集成，瞬间暴露本地项目到公网 | 演示、测试、共享都方便 |
| 🔌 **智能端口管理** | 前后端端口分离，冲突自动检测 | 配置更清晰 |
| 📊 **实时状态监控** | Git、依赖、运行状态自动检测 | 项目健康一目了然 |

#### 🆕 v1.2.2 新功能亮点

- 💰 **AI 费用追踪** - 实时统计成本，多维度分析（按项目、引擎、模型）
- 🌐 **内网穿透** - 一键将本地项目暴露到公网，演示/测试/共享
- 🩺 **AI 智能诊断** - 自动分析错误，提供解决方案（端口占用、依赖错误等）
- 🔌 **端口管理优化** - 前后端端口分离，智能识别项目类型

> 💡 **详细更新内容**：[查看 Release Notes](https://github.com/ThendCN/CCMage/releases/tag/v1.2.2) | [完整 CHANGELOG](CHANGELOG.md)

---

## 🚀 快速开始

### 前置要求

- Node.js >= 16.0.0
- npm >= 7.0.0

### 5 分钟上手

```bash
# 1. 克隆项目
git clone https://github.com/ThendCN/ccmage.git
cd ccmage

# 2. 安装依赖
npm run install:all

# 3. 配置环境变量（可选，推荐先启动再在界面配置）
cp .env.example .env
# 编辑 .env 添加 ANTHROPIC_API_KEY 或 OPENAI_API_KEY

# 4. 启动服务
npm run dev

# 5. 访问应用
# 打开浏览器访问 http://localhost:5173
```

### 配置 AI 引擎（推荐）

**图形界面配置（推荐）：**
1. 启动应用后，点击右上角 ⚙️ **设置** 按钮
2. 填入 API Key：
   - `ANTHROPIC_API_KEY` - 用于 Claude Code
   - `OPENAI_API_KEY` - 用于 Codex
3. 选择默认引擎，保存配置

**获取 API Key：**
- **Claude Code**: [虎三小破站](https://api.husanai.com/register?aff=c34V)（推荐，国内快）
- **Codex**: [OpenAI Platform](https://platform.openai.com/)

> 💡 可以只配置一个引擎，也可以同时配置多个自由切换

### 使用 AI 创建第一个项目

1. 点击 **"✨ AI 创建项目"** 按钮
2. 输入项目描述，例如：`一个博客系统，使用 React 和 Node.js`
3. 选择 AI 引擎（Claude Code 或 Codex）
4. 点击"开始创建"，AI 会自动创建项目、安装依赖、启动服务

**或者添加已存在的项目：**
- 编辑 `.claude/projects.json` 配置文件
- 参考 `.claude/projects.example.json` 格式

> 📖 **完整教程**：[Wiki - 快速开始](https://github.com/ThendCN/CCMage/wiki/Quick-Start)

---

## ✨ 核心特性

### 🤖 多引擎 AI 编程助手

**支持的 AI 引擎：**
- ✅ **Claude Code** - Anthropic Claude Agent SDK，强大的代码理解和生成
- ✅ **Codex** - OpenAI Codex SDK，专注代码补全和解释
- 🔜 **Gemini** - Google Gemini（即将支持）

**AI 功能：**
- 🎯 智能任务拆分 - 将复杂需求拆解为 3-8 个可执行子任务
- 💬 实时对话协作 - 流式输出，上下文自动带入
- 🔍 代码分析生成 - 理解代码结构，生成代码片段
- 🐛 错误智能诊断 - 自动分析错误日志，给出修复建议
- 💰 费用实时追踪 - 精确统计每次对话的 Token 和费用

### 📊 智能项目管理

- 🎯 **可视化面板** - 一屏掌控所有项目状态
- 📈 **任务层级管理** - 主任务+子任务，进度清晰可见
- 🔄 **状态实时同步** - Git、依赖、运行状态自动检测
- ⚙️ **智能配置分析** - 自动识别技术栈、启动命令、端口
- 🔌 **端口智能管理** - 前后端端口分离，冲突检测

### ⚡ 快速操作

- 🚀 **一键启动/停止** - 项目服务进程管理
- 📂 **打开目录** - 直接打开项目文件夹
- 💻 **启动 VSCode** - 在编辑器中打开项目
- 📦 **安装依赖** - 自动检测并安装依赖
- 📊 **实时日志** - SSE 流式日志输出
- 🌐 **内网穿透** - 一键暴露本地项目到公网

> 📖 **更多功能**：[Wiki - AI 功能详解](https://github.com/ThendCN/CCMage/wiki/AI-Features) | [项目管理指南](https://github.com/ThendCN/CCMage/wiki/Project-Management)

---

## 📋 项目配置

### .claude/projects.json 格式

```json
{
  "projects": {
    "my-app": {
      "path": "my-app",                    // 相对路径
      "tech": ["React", "Node.js"],        // 技术栈
      "status": "active",                  // active/production/archived
      "port": 3000,                        // 端口号
      "description": "我的应用",           // 描述
      "startCommand": "npm run dev"        // 启动命令（可选，会自动检测）
    }
  },
  "external": {
    "external-project": {
      "path": "/absolute/path/to/project", // 绝对路径
      "tech": ["Vue"],
      "status": "production"
    }
  }
}
```

### 支持的项目类型

系统自动检测以下类型并识别启动命令：
- **Node.js** - package.json 中的 dev/start 脚本
- **Python** - requirements.txt / Django / Flask / FastAPI
- **Vue/React/Next.js** - 自动识别框架
- **Go/Rust** - 自动识别构建工具

> 📖 **详细配置说明**：[Wiki - 项目配置](https://github.com/ThendCN/CCMage/wiki/Project-Configuration)

---

## 🛠️ 技术栈

**后端：** Node.js + Express + Claude Agent SDK + SQLite + SSE
**前端：** React 18 + TypeScript + Vite + Lucide React + CodeMirror 6

> 📖 **系统架构**：[Wiki - 架构设计](https://github.com/ThendCN/CCMage/wiki/Architecture) | [本地文档](docs/ARCHITECTURE.md)

---

## 📚 文档

### 在线文档（推荐）

- 🌟 **[GitHub Wiki](https://github.com/ThendCN/CCMage/wiki)** - 完整的 Wiki 文档体系
  - [快速开始](https://github.com/ThendCN/CCMage/wiki/Quick-Start) - 5 分钟上手
  - [AI 功能详解](https://github.com/ThendCN/CCMage/wiki/AI-Features) - 多引擎 AI 使用指南
  - [项目管理](https://github.com/ThendCN/CCMage/wiki/Project-Management) - Todo、里程碑、标签系统
  - [API 参考](https://github.com/ThendCN/CCMage/wiki/API-Reference) - 完整的 API 文档
  - [开发指南](https://github.com/ThendCN/CCMage/wiki/Development-Guide) - 贡献代码指南
  - [常见问题](https://github.com/ThendCN/CCMage/wiki/FAQ) - 故障排查和解决方案

### 本地文档

- 📖 [快速上手指南（SOP）](docs/QUICK_START_GUIDE.md) - 完整的分步教程
- 📖 [架构设计文档](docs/ARCHITECTURE.md) - 系统架构详解
- 📖 [AI 费用追踪指南](docs/AI_COST_TRACKING_GUIDE.md) - 费用追踪功能说明
- 📖 [AI 诊断指南](docs/AI_DIAGNOSIS_GUIDE.md) - 智能诊断使用教程
- 📖 [CHANGELOG](CHANGELOG.md) - 版本更新历史

---

## 🤝 贡献指南 {#contributing}

我们欢迎所有形式的贡献！

### 贡献流程

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

> 📖 **详细指南**：[CONTRIBUTING.md](CONTRIBUTING.md) | [Wiki - 开发指南](https://github.com/ThendCN/CCMage/wiki/Development-Guide)

---

## 🐛 常见问题

### 端口被占用
```bash
lsof -i :9999     # 查看占用进程
kill -9 <PID>     # 终止进程
```

### 依赖安装失败
```bash
rm -rf node_modules package-lock.json
npm install
```

### AI 功能无法使用
- 检查 `.env` 中的 `ANTHROPIC_API_KEY` 是否配置
- 确保已安装 `@anthropic-ai/claude-agent-sdk`
- 查看后端日志确认 SDK 加载状态

> 📖 **更多问题**：[Wiki - 常见问题](https://github.com/ThendCN/CCMage/wiki/FAQ)

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [Claude](https://www.anthropic.com/claude) - AI 编程助手
- [React](https://react.dev/) - UI 框架
- [Vite](https://vitejs.dev/) - 构建工具
- [Lucide](https://lucide.dev/) - 图标库

---

<p align="center">
  <strong>如果这个项目对你有帮助，欢迎 ⭐ Star 支持！</strong>
</p>

<p align="center">
  Made with ❤️ by <a href="https://github.com/ThendCN">ThendCN</a>
</p>

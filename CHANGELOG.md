# Changelog / 更新日志

本文档记录 CCMage 的所有重要更新和变更。

遵循 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) 格式规范，
版本号遵循 [语义化版本 2.0.0](https://semver.org/spec/v2.0.0.html)。

---

## [1.3.0] - 2025-12-03

### 🎉 重大更新：完整支持 DeepSeek V3.2

#### ✨ Added / 新增功能

**🧠 DeepSeek V3.2 AI 引擎集成**
- ✅ **独立引擎选项** - 新增 "Claude Code - DeepSeek" 引擎，一键切换使用 DeepSeek 模型
- ✅ **双模型支持** - 支持 DeepSeek-V3.2-Exp (通用) 和 deepseek-reasoner (思维) 模型
- ✅ **智能配置** - 自动使用 DEEPSEEK_API_KEY，回退到 ANTHROPIC_API_KEY
- ✅ **自动化部署** - 无需手动配置环境变量，自动设置 DeepSeek API 地址
- ✅ **思考模式** - AI 对话中新增 "🧠 思考模式" 开关，开启深度推理能力
- 📍 位置: AI 助手 → 引擎选择器 → "Claude Code - DeepSeek"

**新增模块**
- `deepseekManager.js` (155 行) - DeepSeek 引擎包装器
  - 自动环境变量配置
  - 智能模型选择（通用/思维模式）
  - 临时环境覆盖，不影响其他引擎
  - 详细的日志输出

**🎛️ 应用配置界面增强**
- ✅ **DeepSeek 专用配置区** - 绿色主题独立配置区域
  - DeepSeek API Key 密码输入框
  - DeepSeek Base URL 可选配置
  - 使用提示和配置建议
- ✅ **AI 模型配置** - 新增模型名称自定义输入框
- ✅ **配置持久化** - 自动保存到 .env 文件并更新运行时环境变量
- 📍 位置: 应用设置 → DeepSeek 专用配置

#### 🔧 Changed / 改进

**后端架构优化**
- 🔄 `aiEngineFactory.js` - 扩展支持 3 个引擎：claude-code, deepseek, codex
- 🔄 `aiManager.js` - 增强环境变量配置逻辑，支持思考模式参数
- 🔄 `routes.js` - API 接口支持 `thinkingMode` 参数传递
- 🔄 `server.js` - 配置 API 支持 DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, ANTHROPIC_MODEL

**前端类型和组件更新**
- 🔄 `types.ts` - AIEngine 类型扩展为 'claude-code' | 'deepseek' | 'codex'
- 🔄 `Settings.tsx` - 新增 DeepSeek 配置表单，优化配置加载逻辑
- 🔄 `AiDialog.tsx` - 新增思考模式开关，默认引擎改为 deepseek
- 🔄 `api.ts` - executeAI 函数支持 thinkingMode 参数

**环境配置完善**
- 📝 `.env.example` - 新增 DeepSeek 配置说明和使用建议
  - `DEEPSEEK_API_KEY` - DeepSeek 专用 API Key
  - `DEEPSEEK_BASE_URL` - DeepSeek API 地址（可选）
  - `ANTHROPIC_MODEL` - 自定义模型名称（可选）

#### 🐛 Fixed / 修复

- 🐛 **配置保存问题** - 修复配置保存后环境变量未更新的问题
- 🐛 **React 警告** - 修复配置加载时的不受控组件警告
- 🐛 **配置持久化** - 修复 DeepSeek API Key 无法持久化到 .env 文件
- 🐛 **默认值处理** - 确保所有配置字段都有默认值，避免 undefined 错误

#### 📝 Documentation / 文档

- 📖 补充 DeepSeek 配置和使用文档
- 📖 新增环境变量配置详细说明
- 📖 提供多种配置方案示例
- 📖 添加故障排查指南

### 💡 使用建议

**方式 1: 使用配置界面（推荐）**
1. 打开应用设置 → DeepSeek 专用配置
2. 填写 DeepSeek API Key（从 https://platform.deepseek.com/ 获取）
3. 保存配置，系统自动写入 .env 文件
4. 在 AI 助手中选择 "Claude Code - DeepSeek" 引擎
5. 可选：勾选 "🧠 思考模式" 开启深度推理

**方式 2: 手动配置 .env 文件**
```bash
# 最简配置
DEEPSEEK_API_KEY=sk-xxxxx

# 完整配置
DEEPSEEK_API_KEY=sk-xxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_MODEL=DeepSeek-V3.2-Exp
DEFAULT_AI_ENGINE=deepseek
```

### 🔗 相关资源

- [DeepSeek 官网](https://www.deepseek.com/)
- [DeepSeek API 文档](https://platform.deepseek.com/api-docs/)
- [DeepSeek V3 技术报告](https://github.com/deepseek-ai/DeepSeek-V3)

---

## [1.2.2] - 2025-12-01

### ✨ Added / 新增功能

#### 💰 AI 费用追踪系统
**精确的 Token 使用统计和费用计算**
- ✅ **实时费用统计** - 自动记录每次 AI 对话的 Token 使用量和费用
- ✅ **多维度统计** - 按项目、引擎、模型分类统计
- ✅ **详细分类** - 区分输入/输出/缓存创建/缓存读取 Token
- ✅ **费用计算器** - 支持 Claude Sonnet 4.5/4.0 和 Opus 4.0 定价
- ✅ **可视化展示** - AI 使用统计页面（AIStats 组件）
- 📍 位置: 项目详情页 → AI 编程 Tab → 费用统计

**新增模块**
- `aiCostCalculator.js` (150 行) - AI 费用计算引擎
  - 支持多模型定价配置
  - 精确到 0.01 美分的费用计算
  - 自动识别引擎和模型
- `aiStatsRoutes.js` (180 行) - AI 统计 API 路由
  - 项目级别统计
  - 全局统计
  - 时间范围筛选
- `AIStats.tsx` (220 行) - 前端统计展示组件
  - 费用趋势图
  - Token 使用分布
  - 会话详情列表

#### 🌐 内网穿透支持 (Frpc)
**一键实现项目公网访问**
- ✅ **Frpc 集成** - 无缝集成 frp 客户端
- ✅ **自动配置生成** - 根据项目端口自动生成 frpc 配置
- ✅ **进程管理** - 启动/停止/状态监控
- ✅ **可视化配置** - 图形界面配置服务器信息
- ✅ **持久化存储** - 配置保存到 `~/.ccmage/frpc/`
- 📍 位置: 项目详情页 → 快捷操作 → Frpc 配置

**新增模块**
- `frpcManager.js` (280 行) - Frpc 进程管理器
  - EventEmitter 事件驱动
  - 配置文件生成
  - 进程生命周期管理
  - 自动恢复运行中的进程
- `frpcRoutes.js` (120 行) - Frpc API 路由
  - 配置保存/获取
  - 启动/停止接口
  - 状态查询
- `FrpcConfigDialog.tsx` (200 行) - 配置对话框
  - 服务器地址/端口配置
  - 协议选择 (http/https/tcp)
  - 子域名配置
  - 实时验证

#### 🔌 端口管理优化
**智能端口识别和管理**
- ✅ **前后端端口分离** - 区分前端和后端端口
- ✅ **项目类型识别** - 自动识别 frontend/backend/fullstack
- ✅ **关联项目管理** - 前后端项目互相关联
- ✅ **代理配置支持** - 存储代理配置（JSON 格式）
- ✅ **端口冲突检测** - 自动检测端口占用
- 📍 位置: 项目分析和配置中

**新增模块**
- `portService.js` (160 行) - 端口服务层
  - 端口可用性检测
  - 智能端口推荐
  - 冲突解决建议
- `portRoutes.js` (90 行) - 端口 API 路由
  - 端口检测接口
  - 配置更新接口

#### 🩺 AI 智能诊断功能
**自动分析项目启动失败原因**
- ✅ **错误日志分析** - 收集启动失败日志
- ✅ **AI 智能诊断** - 使用 AI 分析根本原因
- ✅ **解决方案推荐** - 提供可操作的修复步骤
- ✅ **一键诊断** - 项目卡片"AI诊断"按钮
- 📍 位置: 项目卡片 → 启动失败时显示诊断按钮

### 🏗️ Changed / 架构改进

#### 数据库模式扩展
**projects 表新增字段**
```sql
project_type TEXT,           -- frontend/backend/fullstack/unknown
frontend_port INTEGER,       -- 前端端口
backend_port INTEGER,        -- 后端端口
linked_project TEXT,         -- 关联项目名称
proxy_config TEXT,           -- 代理配置 (JSON)
```

**ai_sessions 表增强**
```sql
-- 引擎和模型信息
engine TEXT DEFAULT 'claude-code',
model TEXT,

-- Token 统计
input_tokens INTEGER DEFAULT 0,
output_tokens INTEGER DEFAULT 0,
cache_creation_tokens INTEGER DEFAULT 0,
cache_read_tokens INTEGER DEFAULT 0,
total_tokens INTEGER DEFAULT 0,

-- 费用计算（美元）
input_cost REAL DEFAULT 0,
output_cost REAL DEFAULT 0,
cache_creation_cost REAL DEFAULT 0,
cache_read_cost REAL DEFAULT 0,
total_cost_usd REAL DEFAULT 0,
```

#### 后端模块增强 (+1000+ 行代码)
- `aiManager.js` (+103 行) - Token 统计和费用计算集成
- `database.js` (+551 行) - 新增端口管理、费用统计方法
- `routes.js` (+443 行) - 诊断 API、端口 API
- `processManager.js` (+246 行) - 增强错误日志收集
- `projectAnalyzer.js` (+127 行) - 项目类型识别优化
- `server.js` (+95 行) - 新路由集成

#### 前端组件增强 (+700+ 行代码)
- `App.tsx` (+471 行) - AI 统计页面集成
- `AiDialog.tsx` (+324 行) - 费用显示、引擎选择
- `ProjectCard.tsx` (+392 行) - Frpc 配置、AI 诊断按钮
- `ProjectDetailPage.tsx` (+405 行) - AI 统计 Tab
- `Settings.tsx` (+207 行) - Frpc 全局设置
- `api.ts` (+135 行) - 新增 API 方法

### 🔌 API / API 更新

**新增 API 端点**
```
# AI 费用统计
GET  /api/ai-stats/project/:projectName    # 项目统计
GET  /api/ai-stats/global                  # 全局统计

# Frpc 管理
POST /api/frpc/config                      # 保存配置
GET  /api/frpc/config/:projectName         # 获取配置
POST /api/frpc/start/:projectName          # 启动穿透
POST /api/frpc/stop/:projectName           # 停止穿透
GET  /api/frpc/status/:projectName         # 查询状态

# 端口管理
POST /api/ports/check                      # 检测端口可用性
GET  /api/ports/recommend                  # 推荐可用端口

# AI 诊断
POST /api/projects/:name/diagnose          # 启动诊断
GET  /api/projects/:name/diagnose/stream   # SSE 诊断进度
```

### 📚 Documentation / 文档更新

**新增文档**
- `docs/AI_COST_TRACKING_GUIDE.md` (5KB) - AI 费用追踪功能说明
- `docs/AI_DIAGNOSIS_GUIDE.md` (4KB) - AI 诊断功能使用指南
- `docs/POLLING_OPTIMIZATION.md` (5KB) - 轮询优化方案
- `docs/PORT_SIMPLIFICATION.md` (4KB) - 端口管理简化说明

### ⚡ Improved / 性能优化

**轮询优化**
- 智能轮询频率调整
- 减少不必要的 API 调用
- 前端状态缓存机制

**错误处理增强**
- 更详细的错误日志
- AI 诊断自动化
- 用户友好的错误提示

### 🐛 Fixed / Bug 修复

- 🐛 修复 AI 会话未正确记录 Token 使用量的问题
- 🐛 修复端口配置在项目重启后丢失的问题
- 🐛 修复前后端项目关联不正确的问题
- 🔧 修复 Codex 历史记录 JSON 格式问题
- 🛠️ 新增 `fixDatabaseJSON.js` 工具脚本修复损坏的 JSON

### 🚀 Release / 发布说明

**升级步骤**
1. 拉取最新代码: `git pull origin main`
2. 停止当前运行的服务
3. 安装新依赖: `npm run install:all`
4. 数据库会自动迁移（新增字段）
5. 启动服务: `npm run dev`

**环境要求**
- Node.js >= 16
- 现代浏览器 (Chrome/Edge/Firefox/Safari)
- 配置 `ANTHROPIC_API_KEY` (使用 AI 功能需要)

**已知限制**
- Frpc 需要用户自行安装 frpc 客户端
- AI 费用统计仅支持 Claude 系列模型
- 端口冲突检测在 Windows 上可能不准确

**破坏性变更**
- 无破坏性变更，向下兼容 v1.2.1

**统计数据**
- 修改文件: 21 个
- 新增文件: 12 个
- 代码变化: +4931/-350 行

---

## [1.2.1] - 2025-11-30

### ✨ Added / 新增功能

#### 📁 内置文件管理器和代码编辑器

**在线代码编辑**
- ✅ **CodeMirror 6 集成** - 轻量强大的代码编辑器
- ✅ **语法高亮** - 支持 JavaScript/TypeScript/Python/HTML/CSS/JSON/Markdown
- ✅ **12+ 主题** - GitHub/VS Code/Dracula/Nord/Tokyo Night/Solarized 等
- ✅ **明暗主题切换** - 一键切换明暗模式
- ✅ **Markdown 实时预览** - 编辑/预览/分屏三种模式
- ✅ **自动缩进** - Tab 键智能缩进
- ✅ **括号匹配** - 自动高亮配对括号
- ✅ **快捷键支持** - Ctrl+S 保存,Cmd+S (Mac)
- 📍 位置: 项目详情页 → 文件编辑器 Tab

**文件树浏览**
- ✅ **树形结构展示** - 基于 Ant Design Tree 组件
- ✅ **文件夹展开/折叠** - 清晰的层级导航
- ✅ **文件图标** - 文件和文件夹图标区分
- ✅ **智能过滤** - 自动忽略 node_modules、.git 等目录
- ✅ **点击预览** - 点击文件即可在编辑器中查看
- 📍 位置: 项目详情页左侧文件树

### 🏗️ Changed / 架构改进

#### 后端增强 (+500 行代码)

**新增后端模块**
- `fileManager.js` (350 行) - 文件管理核心逻辑
  - `generateFileTree()` - 生成文件树结构
  - `readFile()` - 读取文件内容
  - `saveFile()` - 保存文件
  - `validatePath()` - 路径安全验证
  - `detectLanguage()` - 语言自动检测
- `fileRoutes.js` (150 行) - 文件操作 API 路由
  - 文件树 API
  - 文件读取 API
  - 文件保存 API

#### 前端增强 (+650 行代码)

**新增组件**
- `FileExplorer.tsx` (180 行) - 文件树浏览组件
  - 树形结构渲染
  - 文件选择处理
  - 加载状态管理
- `CodeEditor.tsx` (470 行) - CodeMirror 编辑器组件
  - CodeMirror 6 集成
  - 12+ 主题支持
  - Markdown 实时预览
  - 文件加载和保存
  - 快捷键注册
  - 工具栏(保存/刷新/预览模式切换/主题选择)

**类型定义扩展** (`types.ts` +30 行)
```typescript
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
  children?: FileNode[];
}
```

### 🔌 API / API 更新

**新增 API 端点**
```
GET  /api/projects/:name/files              # 获取项目文件树
GET  /api/files/read?project=&path=         # 读取文件内容
POST /api/files/save                        # 保存文件
```

### 📦 Dependencies / 依赖更新

**新增依赖**
- `@codemirror/view` - CodeMirror 6 核心视图
- `@codemirror/state` - 编辑器状态管理
- `@codemirror/language` - 语言支持
- `@codemirror/commands` - 编辑器命令
- `@codemirror/theme-one-dark` - One Dark 主题
- `@codemirror/lang-javascript` - JavaScript/TypeScript 支持
- `@codemirror/lang-html` - HTML 支持
- `@codemirror/lang-css` - CSS 支持
- `@codemirror/lang-json` - JSON 支持
- `@codemirror/lang-markdown` - Markdown 支持
- `@codemirror/lang-python` - Python 支持
- `@uiw/codemirror-themes` - 12+ 精美主题包

### 🔒 Security / 安全增强

**路径安全验证**
- ✅ 防止路径遍历攻击 (Path Traversal)
- ✅ 白名单验证,确保只能访问项目目录内的文件
- ✅ 自动忽略敏感目录 (.git, .env, node_modules)
- ✅ 文件大小限制(避免大文件导致性能问题)

### 📚 Documentation / 文档更新

**新增文档**
- `docs/FILE_MANAGER_EDITOR_PROPOSAL.md` (37KB) - 文件管理器和编辑器技术方案

### 🎯 UI/UX / 用户体验

**编辑器界面**
- 📊 顶部工具栏:文件路径 + 保存/刷新按钮 + 预览模式 + 主题选择
- 📊 编辑器配置:
  - 语法高亮
  - 行号显示
  - 自动缩进 (Tab 键)
  - 括号匹配高亮
  - 活动行高亮
- 📊 Markdown 预览:
  - 编辑模式 - 纯编辑器
  - 预览模式 - 渲染后的 Markdown
  - 分屏模式 - 同时显示编辑和预览
- 📊 12+ 主题选择:
  - 明亮主题: GitHub Light, VS Code Light, Solarized Light, Material Light
  - 暗黑主题: GitHub Dark, VS Code Dark, One Dark, Dracula, Nord, Tokyo Night, Solarized Dark, Material Dark

**文件树界面**
- 📊 文件夹图标 + 文件图标
- 📊 显示行分隔线
- 📊 滚动条支持
- 📊 加载状态提示

### 🚀 Release / 发布说明

**升级步骤**
1. 拉取最新代码:`git pull origin main`
2. 停止当前运行的服务
3. 安装新依赖:`npm run install:all`
4. 启动服务:`npm run dev`

**环境要求**
- Node.js >= 16
- 现代浏览器 (Chrome/Edge/Firefox/Safari)

**已知限制**
- 文件大小限制 ≤ 1MB (避免编辑器卡顿)
- 暂不支持文件创建/删除/重命名(计划 v1.3.0)
- 暂不支持多标签页编辑(计划 v1.3.0)

**破坏性变更**
- 无破坏性变更,向下兼容 v1.2.0

---

## [1.2.0] - 2025-11-29

### ✨ Added / 新增功能

#### 🤖 AI 增强 Todo 功能
全新的 AI 驱动任务管理系统，让项目规划更智能、更高效。

**AI 智能拆分任务**
- ✅ 一键将复杂任务拆分为 3-8 个可执行的子任务
- ✅ 自动估算每个子任务的工时
- ✅ 智能设置任务优先级和顺序
- ✅ 支持流式进度显示，实时查看拆分过程
- 📍 位置：任务创建对话框 → 勾选"使用 AI 智能拆分"

**AI 协作助手（任务上下文预填充）**
- ✅ 点击任务卡片的 AI 按钮 (🤖) 自动打开对话
- ✅ 任务上下文（标题、描述）自动预填充到输入框
- ✅ 格式化提示词：`关于任务：[标题]\n\n[描述]`
- ✅ 预填充后仍可编辑，灵活性高
- ✅ 所有 AI 对话历史自动关联到任务

**任务层级展示**
- ✅ 主任务以卡片形式展示，子任务嵌套显示
- ✅ 可折叠/展开子任务列表（ChevronDown/ChevronRight 图标）
- ✅ 显示子任务完成进度条（如：3/6 完成 50%）
- ✅ 清晰的视觉层级，一目了然
- ✅ 使用 `buildTodoTree()` 函数转换扁平列表为树状结构

**任务编辑功能**
- ✅ 主任务和子任务都支持编辑
- ✅ 可编辑字段：标题、描述、优先级、类型、预估工时、截止日期
- ✅ 蓝色编辑按钮 (✏️ Edit2 图标)，操作直观
- ✅ 编辑对话框复用创建对话框结构，保持一致性
- ✅ 标题非空验证

**AI 编程助手任务状态同步**
- ✅ 在 AI 对话框顶部显示当前关联任务信息卡片
- ✅ 显示任务标题、描述、当前状态
- ✅ 快捷状态更新按钮：
  - 🔵 待处理 → [开始任务] → 进行中
  - 🟠 进行中 → [暂停] → 待处理
  - 🟢 进行中 → [完成] → 已完成
  - ⚪ 已完成 → [重新开启] → 待处理
- ✅ 状态徽章颜色编码（黄/蓝/绿/灰）
- ✅ 关闭对话框自动刷新任务列表，同步最新状态

#### 🎨 项目品牌重塑
- 🎯 项目名称从"Claude Code 项目管理系统"更名为 **CCMage**
- 🎯 新的品牌定位：专为 Vibe Coding 开发者打造
- 🎯 页面标题：`CCMage - 专为 Vibe Coding 开发者打造`
- 🎯 Footer：`CCMage v1.2.0 - 专为 Vibe Coding 开发者打造 | 运行在端口 9999`
- 🎯 Settings 说明更新为 CCMage 品牌

### 🏗️ Changed / 架构改进

#### 后端增强 (+783 行代码)

**新增数据库表**
- `ai_sessions` - AI 会话记录
  - 字段：session_id, project_name, todo_id, session_type, status, duration_ms, result_summary 等
- `ai_messages` - AI 消息记录
  - 字段：session_id, message_type, content, metadata, timestamp
- `ai_verifications` - AI 验证记录
  - 字段：todo_id, session_id, result, confidence, issues_found, suggestions, evidence 等

**新增后端模块**
- `todoAiManager.js` (426 行) - AI 任务拆分和验证核心逻辑
  - `decomposeTask()` - 任务拆分
  - `verifyTask()` - 任务验证
  - `generateTaskContext()` - 生成任务上下文
  - `linkSessionToTask()` - 会话关联
- `todoAiRoutes.js` (414 行) - AI 任务相关 API 路由
  - 任务拆分 API
  - SSE 流式进度
  - 会话管理 API

**数据库操作方法扩展** (`database.js` +241 行)
- Todo CRUD: `createTodo()`, `getTodoById()`, `updateTodo()`, `deleteTodo()`
- AI 会话: `createAiSession()`, `getSessionById()`, `linkSessionToTask()`
- AI 消息: `addAiMessage()`, `getSessionMessages()`
- AI 验证: `createVerification()`, `getTaskVerifications()`
- 其他: `getTodosByProject()`, `getTaskSessions()` 等

**增强现有模块**
- `aiManager.js` (+30 行) - 支持任务上下文注入
  - 检测 todoId 参数
  - 自动生成任务上下文
  - 注入到 AI 对话
- `routes.js` (+3 行) - 支持 todoId 参数传递
- `aiEngineFactory.js` (+2 行) - 支持 todoId 参数

#### 前端增强 (+391 行代码)

**组件扩展**
- `TodoManager.tsx` (+120 行)
  - 新增状态：`showEditTodo`, `editingTodo`, `aiInitialPrompt`, `useAiDecompose`, `expandedTodos`
  - 新增方法：`buildTodoTree()`, `handleEditTodo()`, `handleUpdateTodo()`, `handleAiCollaborate()`, `handleAiDecompose()`
  - UI 重构：层级展示、折叠/展开、进度条、编辑对话框、AI 拆分选项
- `AiDialog.tsx` (+60 行)
  - 新增状态：`currentTodo`
  - 新增方法：`loadTodoDetails()`, `updateTodoStatus()`
  - 新增 UI：任务信息卡片、快捷状态按钮
  - 新增图标：`CheckCircle2`, `Circle`, `PlayCircle`, `PauseCircle`

**类型定义扩展** (`types.ts` +71 行)
```typescript
export interface TodoWithSubtasks extends Todo {
  subtasks?: Todo[];
  verification?: AiVerification;
  aiSessions?: AiSession[];
}

export interface AiSession {
  id: number;
  session_id: string;
  project_name: string;
  todo_id?: number;
  session_type: 'decompose' | 'collaborate' | 'verify';
  status: 'running' | 'completed' | 'failed';
  ...
}

export interface AiVerification {
  id: number;
  todo_id: number;
  result: 'passed' | 'failed' | 'partial';
  confidence: number;
  issues_found: string[];
  suggestions: string[];
  ...
}
```

**API 方法扩展** (`api.ts` +140 行)
- `decomposeTask()` - 启动任务拆分
- `createDecomposedTasks()` - 创建拆分的任务
- `collaborateOnTask()` - AI 协作
- `verifyTask()` - 任务验证
- `getTaskVerifications()` - 获取验证历史
- `getTaskAiSessions()` - 获取 AI 会话
- `getSessionById()` - 获取会话详情
- `getSessionMessages()` - 获取会话消息
- 等 12 个新方法

### 🔌 API / API 更新

**新增 API 端点**
```
POST /api/todos/decompose                           # 启动 AI 任务拆分
GET  /api/todos/decompose/stream/:sessionId        # SSE 流式进度
POST /api/todos/decompose/:sessionId/create        # 创建拆分的任务
GET  /api/todos/:id                                # 获取单个任务详情
PUT  /api/todos/:id                                # 更新任务（支持状态）
POST /api/todos/:id/verify                         # 启动任务验证
GET  /api/todos/verify/stream/:sessionId           # SSE 验证进度
GET  /api/todos/:id/sessions                       # 获取任务的所有 AI 会话
GET  /api/todos/:id/verifications                  # 获取验证历史
GET  /api/sessions/:sessionId                      # 获取会话详情
GET  /api/sessions/:sessionId/messages             # 获取会话消息
GET  /api/sessions/:sessionId/status               # 获取会话状态
```

**扩展现有 API**
```
POST /api/projects/:name/ai
  新增参数: todoId (可选) - 关联的任务 ID
  效果: 自动注入任务上下文到 AI 对话
  返回: { conversationId, sessionId }
```

### 🐛 Fixed / Bug 修复

**AI 任务拆分时序问题**
- ❌ 问题：前端过早调用创建接口导致"任务拆分尚未完成"错误
- 🔍 原因：使用固定 3 秒延迟 (`setTimeout(3000)`)，AI 处理时间可能超过 3 秒
- ✅ 解决：改用 SSE 事件监听，等待 `type: 'completed'` 事件
- ✅ 增强：添加 30 秒超时保护，防止无限等待
- 📍 位置：`TodoManager.tsx:145-177`

**任务状态更新后列表不刷新**
- ❌ 问题：在 AiDialog 中更新任务状态后，关闭对话框任务列表未刷新
- ✅ 解决：AiDialog 的 `onClose` 回调中添加 `loadTodos()` 刷新调用
- 📍 位置：`TodoManager.tsx:1234-1240`

### ⚡ Improved / 性能优化

**SSE 流式通信**
- 使用 Server-Sent Events 实现 AI 任务拆分的实时进度推送
- 避免轮询，减少服务器压力
- 实时反馈，提升用户体验

**树状结构渲染**
- 使用 `buildTodoTree()` 函数转换扁平列表为树状结构
- Map-based 构建，时间复杂度 O(n)
- 按 `order_index` 排序，确保顺序一致

**对话框状态本地化**
- 任务详情在 AiDialog 内部管理
- 状态更新立即反映到 UI
- 减少不必要的 API 调用

### 📚 Documentation / 文档更新

**新增文档**
- `AI_TODO_INTEGRATION.md` (9KB) - AI Todo 技术集成文档（开发者向）
- `AI_TODO_USER_GUIDE.md` (11KB) - AI Todo 用户使用指南
- `AI_TODO_IMPLEMENTATION_SUMMARY.md` (13KB) - 完整实现总结
- `CHANGELOG.md` - 本更新日志

**更新文档**
- `CLAUDE.md` - 更新项目说明和架构描述
- `README.md` - （待更新）添加 v1.2.0 新功能说明

**临时总结文件**
- `/tmp/todo_edit_ai_summary.md` - Todo 编辑和 AI 预填充实现总结
- `/tmp/todo_hierarchy_summary.md` - 任务层级展示实现总结
- `/tmp/ai_todo_sync_summary.md` - AI 任务状态同步实现总结

### 📦 Dependencies / 依赖更新

**版本号更新**
- `package.json` (root): `1.1.0` → `1.2.0`
- `frontend/package.json`: `1.1.0` → `1.2.0`
- `backend/package.json`: `1.1.0` → `1.2.0`

**无新增依赖**，继续使用：
- `@anthropic-ai/claude-agent-sdk` - AI 功能核心
- `better-sqlite3` - SQLite 数据库
- `lucide-react` - 图标库
- `react-markdown` + `remark-gfm` - Markdown 渲染

### 🎯 UI/UX / 用户体验

**任务管理界面优化**
- 📊 主任务操作按钮：[🤖 AI] [✏️ 编辑] [🗑️ 删除]（从左到右）
- 📊 子任务操作按钮：[✏️ 编辑] [🗑️ 删除]
- 📊 折叠/展开按钮：ChevronDown ↔ ChevronRight
- 📊 进度条：绿色渐变，动态宽度过渡

**状态徽章颜色编码**
- 🟡 待处理 (pending): 黄色背景 `#fef3c7`, 褐色文字 `#92400e`
- 🔵 进行中 (in_progress): 蓝色背景 `#dbeafe`, 深蓝文字 `#1e40af`
- 🟢 已完成 (completed): 绿色背景 `#dcfce7`, 深绿文字 `#16a34a`
- ⚪ 已取消 (cancelled): 灰色背景 `#f3f4f6`, 深灰文字 `#1f2937`

**AI 对话框增强**
- 任务信息卡片显示在头部下方
- 快捷状态按钮根据当前状态动态显示
- 按钮悬停效果（颜色加深）
- 状态更新立即反映到界面

### 🚀 Release / 发布说明

**升级步骤**
1. 拉取最新代码：`git pull origin main`
2. 停止当前运行的服务
3. 安装依赖：`npm run install:all`
4. 数据库会自动迁移（新增 3 张表）
5. 启动服务：`npm run dev`

**环境要求**
- Node.js >= 16
- 配置 `ANTHROPIC_API_KEY`（使用 AI 功能需要）
- SQLite 支持

**已知限制**
- AI 任务拆分每次生成 3-8 个子任务（可调整）
- AI 验证功能后端已实现，前端 UI 待开发（计划 v1.2.1）
- 任务层级目前仅支持两层（主任务 + 子任务）

**破坏性变更**
- 无破坏性变更，向下兼容 v1.1.0

---

## [1.1.0] - 2025-11-28

### Added / 新增功能

#### 项目详情页 (Project Detail Page)
- ✨ 全新的项目详情页组件，提供完整的项目管理视图
- 📊 左侧栏显示项目状态、技术栈、快捷操作
- 🎯 右侧 Tab 切换：概览、任务、日志、AI 编程、项目分析
- 🖱️ 点击项目卡片即可打开详情页，提升用户体验

#### 项目分析功能增强
- 🔍 **智能启动命令检测**
  - 自动检测 Node.js 项目的 npm scripts (dev/start/serve)
  - 支持 Python (Django/Flask/FastAPI) 启动命令
  - 支持 Go、Rust、Makefile 项目
- 🔌 **自动端口检测**
  - 从 package.json scripts 中提取端口
  - 从环境文件 (.env*) 中读取端口配置
  - 智能匹配框架默认端口
- 📋 **配置文件发现**
  - 检测环境文件 (.env, .env.local, .env.development 等)
  - 识别配置文件 (vite.config, webpack.config, tsconfig.json 等)
  - 提取 package.json 中的可用脚本列表
- ⚡ **一键应用配置**
  - 在分析对话框中直接应用检测到的启动命令
  - 一键应用检测到的端口配置
  - 自动更新 projects.json 和数据库
- 📊 **分析结果展示**
  - 在项目详情页的"项目分析" Tab 中查看快速预览
  - 完整的分析报告对话框
  - 支持重新分析和查看历史分析结果

#### 新增 API 接口
- `POST /api/projects/:name/apply-analysis` - 应用分析结果到项目配置

### Changed / 架构改进

#### 组件重构
- ♻️ **ProjectCard 重构** (520 行 → 291 行)
  - 精简为纯展示组件，移除内部弹窗管理
  - 保留快捷操作：启动/停止、打开目录、打开 VSCode
  - 点击卡片打开详情页，符合单一职责原则
  - 减少 44% 代码量，提升可维护性
- 🎨 **TodoManager 样式统一**
  - 从 Tailwind CSS 类名迁移到 inline styles
  - 解决样式不一致问题
- 📱 **App.tsx 路由升级**
  - 支持项目详情页模态显示
  - 事件监听机制处理跨组件交互

### Fixed / Bug 修复
- 🐛 修复 TodoManager 组件样式渲染问题
- 🔧 修复外部项目在详情页中的显示逻辑
- 🛠️ 修复依赖列表解析兼容性问题

### Improved / 性能优化
- 🎯 层次分明的信息架构
- ⚡ 快捷操作优化
- 🔄 智能轮询机制

---

## [1.0.0] - 2025-11-27

### Added / 新增功能
- 🎉 初始版本发布
- 项目基础功能：列表展示、状态监控、进程管理
- AI 编程助手集成
- 任务管理系统 (Todo CRUD)
- 项目分析基础功能

---

## 链接 / Links

- [v1.2.2 对比 v1.2.1](https://github.com/ThendCN/ccmage/compare/v1.2.1...v1.2.2)
- [v1.2.1 对比 v1.2.0](https://github.com/ThendCN/ccmage/compare/v1.2.0...v1.2.1)
- [v1.2.0 对比 v1.1.0](https://github.com/ThendCN/ccmage/compare/v1.1.0...v1.2.0)
- [v1.1.0 对比 v1.0.0](https://github.com/ThendCN/ccmage/compare/v1.0.0...v1.1.0)
- [v1.0.0 发布](https://github.com/ThendCN/ccmage/releases/tag/v1.0.0)

---

## 联系方式 / Contact

- 📧 Issues: https://github.com/ThendCN/ccmage/issues
- 📖 文档: https://github.com/ThendCN/ccmage

---

**感谢使用 CCMage！** 🎉

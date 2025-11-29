# Changelog / 更新日志

本文档记录 CCMage 的所有重要更新和变更。

遵循 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) 格式规范，
版本号遵循 [语义化版本 2.0.0](https://semver.org/spec/v2.0.0.html)。

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

- [v1.2.0 对比 v1.1.0](https://github.com/ThendCN/ccmage/compare/v1.1.0...v1.2.0)
- [v1.1.0 对比 v1.0.0](https://github.com/ThendCN/ccmage/compare/v1.0.0...v1.1.0)
- [v1.0.0 发布](https://github.com/ThendCN/ccmage/releases/tag/v1.0.0)

---

## 联系方式 / Contact

- 📧 Issues: https://github.com/ThendCN/ccmage/issues
- 📖 文档: https://github.com/ThendCN/ccmage

---

**感谢使用 CCMage！** 🎉

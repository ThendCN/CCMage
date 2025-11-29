# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**CCMage** 是专为 Vibe Coding 开发者设计的项目管理系统，通过可视化界面统一管理多个本地项目，提供项目状态监控、进程管理和 AI 辅助功能。

**核心定位**: 解决 Vibe Coding 模式下管理多项目时的切换、状态追踪和协同问题。

## 架构说明

### 技术栈
- **前端**: React 18 + TypeScript + Vite (端口 5173)
- **后端**: Node.js + Express (端口 9999)
- **数据库**: SQLite (better-sqlite3)
- **AI 集成**: @anthropic-ai/claude-agent-sdk

### 目录结构
```
├── backend/                    # 后端服务
│   ├── server.js              # Express 主服务器
│   ├── routes.js              # 进程/AI 路由模块
│   ├── managementRoutes.js    # 项目管理 API 路由
│   ├── projectCreationRoutes.js # AI 项目创建路由 (新)
│   ├── database.js            # SQLite 数据库服务层
│   ├── database-schema.sql    # 数据库模式定义
│   ├── processManager.js      # 进程管理 (EventEmitter)
│   ├── startupDetector.js     # 启动命令自动检测
│   └── claudeCodeManager.js   # AI 对话管理
├── frontend/                   # 前端应用
│   └── src/
│       ├── components/        # React 组件
│       │   ├── TodoManager.tsx   # Todo 任务管理
│       │   ├── ProjectCard.tsx   # 项目卡片
│       │   ├── AiDialog.tsx      # AI 对话框
│       │   ├── ProjectCreationDialog.tsx # AI 项目创建对话框 (新)
│       │   └── LogViewer.tsx     # 日志查看器
│       ├── App.tsx            # 主应用
│       ├── api.ts             # API 封装
│       └── types.ts           # TypeScript 类型
├── .claude/                    # 项目配置
│   └── projects.json          # 项目列表配置(gitignore)
└── docs/
    ├── ARCHITECTURE.md         # 详细架构文档
    ├── PROJECT_MANAGEMENT_GUIDE.md  # 项目管理功能指南
    └── AI_PROJECT_CREATION_GUIDE.md # AI 创建项目指南 (新)
```

### 核心模块职责

#### processManager.js - 进程生命周期管理
- 使用 `EventEmitter` 管理子进程
- 使用 `Map` 存储进程和日志缓存(最多 1000 条)
- 通过 SSE (Server-Sent Events) 实时推送日志

#### claudeCodeManager.js - AI 对话管理
- 集成 Claude Agent SDK,支持流式输出
- 格式化 SDK 消息类型 (SDKAssistantMessage/SDKUserMessage/SDKResultMessage)
- 持久化历史记录到 `ai-history.json`

#### startupDetector.js - 智能启动检测
检测顺序:
1. 用户自定义 `startCommand`
2. package.json 中的 `dev` / `start` 脚本
3. Python 项目的 `requirements.txt` → `python app.py`

#### database.js - 数据库服务层
- 使用 better-sqlite3 实现 SQLite 数据库
- 单例模式确保全局唯一连接
- 启动时自动同步 projects.json 到数据库
- 提供完整的 CRUD 操作接口

#### managementRoutes.js - 项目管理 API
- Todo/任务管理 API
- 里程碑管理 API
- 标签系统 API
- 时间追踪 API
- 评论和活动日志 API
- 项目统计 API

## 项目管理功能

### 数据库模型

系统使用 SQLite 存储项目管理数据，主要表结构：

**projects** - 项目信息（与 projects.json 同步）
**todos** - 任务/待办事项
**milestones** - 里程碑
**labels** - 标签
**time_entries** - 时间追踪记录
**comments** - 任务评论
**activity_logs** - 活动日志（审计）

详细模式见 `backend/database-schema.sql`

### 项目管理 API

所有 API 返回格式: `{ success: boolean, data?: any, error?: string }`

#### Todo 管理
- `GET /api/projects/:name/todos` - 获取项目任务（支持筛选）
- `POST /api/projects/:name/todos` - 创建任务
- `PUT /api/todos/:id` - 更新任务
- `DELETE /api/todos/:id` - 删除任务
- `PUT /api/projects/:name/todos/reorder` - 批量排序

#### 里程碑管理
- `GET /api/projects/:name/milestones` - 获取里程碑
- `POST /api/projects/:name/milestones` - 创建里程碑
- `PUT /api/milestones/:id` - 更新里程碑
- `DELETE /api/milestones/:id` - 删除里程碑

#### 标签管理
- `GET /api/labels` - 获取所有标签
- `POST /api/labels` - 创建标签
- `DELETE /api/labels/:id` - 删除标签

#### 时间追踪
- `POST /api/projects/:name/time-entries` - 创建时间记录
- `GET /api/projects/:name/time-entries` - 获取时间记录
- `GET /api/todos/:id/time-entries` - 获取任务时间记录

#### 统计和日志
- `GET /api/projects/:name/stats` - 获取项目统计
- `GET /api/projects/:name/activity` - 获取活动日志

完整 API 文档见 `docs/PROJECT_MANAGEMENT_GUIDE.md`

## 常用开发命令

### 初始化安装
```bash
npm run install:all          # 同时安装前后端依赖
```

### 开发服务
```bash
npm run dev                  # 同时启动前后端 (推荐)
npm run dev:frontend         # 仅前端 (http://localhost:5173)
npm run dev:backend          # 仅后端 (http://localhost:9999)
```

### 生产构建
```bash
npm run build                # 构建前端 (输出到 frontend/dist)
npm start                    # 启动生产服务器
```

### 调试说明
- **前端调试**: 浏览器 DevTools + React DevTools
- **后端调试**: `nodemon` 已配置自动重启
- **日志查看**: SSE 实时日志流 `/api/projects/:name/logs/stream`

## 重要配置文件

### .claude/projects.json (不纳入版本控制)
定义项目列表,支持两种路径类型:
- `projects`: 相对于 `PROJECT_ROOT` 的本地项目
- `external`: 使用绝对路径的外部项目

配置示例参见 `.claude/projects.example.json`

### .env (不纳入版本控制)
必需配置:
- `ANTHROPIC_API_KEY`: AI 功能所需(可选)
- `ANTHROPIC_BASE_URL`: API 地址(默认 https://api.husanai.com)
- `PROJECT_ROOT`: 项目根目录(默认 ../..)
- `PORT`: 后端端口(默认 9999)

复制 `.env.example` 并根据说明配置。

### vite.config.js
前端开发服务器配置,已设置 `/api` 代理到后端 9999 端口。

## API 设计模式

### RESTful 资源
- `GET /api/projects` - 获取所有项目
- `GET /api/projects/:name/status` - 单个项目状态
- `POST /api/projects/status/batch` - 批量状态查询
- `POST /api/projects/:name/action` - 执行操作 (open-directory/open-vscode/install-deps/git-status)

### 进程管理
- `POST /api/projects/:name/start` - 启动服务
- `POST /api/projects/:name/stop` - 停止服务
- `GET /api/projects/:name/running` - 获取运行状态
- `GET /api/projects/:name/logs/stream` - **SSE 日志流**

### AI 功能
- `POST /api/projects/:name/ai` - 创建 AI 对话
- `GET /api/projects/:name/ai/stream/:sessionId` - **SSE 输出流**
- `POST /api/projects/:name/ai/terminate/:sessionId` - 终止会话
- `GET /api/projects/:name/ai/history` - 历史记录

### AI 项目创建 (新功能)
- `POST /api/projects/create-with-ai` - **一句话创建项目**
- `GET /api/projects/create/stream/:sessionId` - **SSE 创建进度流**
- `GET /api/projects/create/status/:sessionId` - 获取创建状态

详见 [AI 项目创建指南](docs/AI_PROJECT_CREATION_GUIDE.md)

### 错误处理规范
统一返回格式:
```json
{
  "error": "错误类型",
  "message": "详细信息"
}
```
状态码: 200(成功) | 400(请求错误) | 404(不存在) | 500(服务器错误)

## 关键技术细节

### SSE 流式通信
前后端通过 SSE 实现实时数据推送:
- **后端**: `res.setHeader('Content-Type', 'text/event-stream')` + EventEmitter 监听
- **前端**: `EventSource` 订阅流,`onmessage` 处理数据

### 进程管理陷阱
- 使用 `child_process.spawn` 而非 `exec` (支持长期运行进程)
- SIGTERM/SIGINT 信号捕获,确保优雅关闭子进程
- 日志缓存防止内存溢出(限制 1000 条)

### AI SDK 集成
- SDK 返回 `AsyncGenerator`,使用 `for await...of` 处理
- 消息类型映射到统一格式供前端渲染
- 工具调用结果智能截断(过长输出截取前后各 300 字符)

## 开发注意事项

### 状态管理
- **前端**: React Hooks (useState/useEffect/useRef),无需额外状态库
- **后端**: Map 存储运行时状态 + 文件持久化历史记录

### 安全考虑
- 路径验证: 检查项目路径在允许范围内
- 敏感信息: `.gitignore` 排除 `.env`, `ai-history.json`, `.claude/projects.json`
- CORS 配置: 开发环境全开,生产建议白名单

### 性能优化
- **并发处理**: 批量状态查询使用 `Promise.all`
- **日志缓存**: 限制单项目日志数量 ≤1000 条
- **SSE 连接**: 一个会话一个连接,断开自动清理

### 文件大小限制
遵循项目编码规范:
- TypeScript/JavaScript: ≤ 200 行/文件
- 超出时拆分为多个模块或提取子组件

## 常见问题处理

### 端口冲突
```bash
lsof -i :9999  # 查看占用进程
kill -9 <PID>  # 终止进程
```

### 依赖安装失败
```bash
rm -rf node_modules package-lock.json
npm install
```

### AI 功能无法使用
检查清单:
1. `.env` 中 `ANTHROPIC_API_KEY` 是否配置
2. `@anthropic-ai/claude-agent-sdk` 是否已安装
3. 后端日志是否有 SDK 加载错误

### 项目状态不更新
- 手动刷新: 调用 `GET /api/projects/:name/status`
- 检查项目路径是否存在且可访问
- 确认 `.claude/projects.json` 格式正确

## 测试说明

当前项目**尚未配置自动化测试**,建议添加:
- [ ] 单元测试 (Jest + React Testing Library)
- [ ] E2E 测试 (Playwright)
- [ ] API 集成测试

手动测试重点:
1. 项目列表加载和状态更新
2. 进程启动/停止和日志流
3. AI 对话流式输出和历史记录
4. 配置文件保存和加载

## 扩展开发

### 添加新的项目类型检测
编辑 `backend/startupDetector.js`,添加检测逻辑:
```javascript
// 示例: 检测 Rust 项目
if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {
  return { command: 'cargo run', type: 'rust' };
}
```

### 添加新的项目操作
在 `backend/server.js` 的 `executeAction` 函数中添加 case:
```javascript
case 'new-action':
  // 实现逻辑
  return { success: true, message: '操作完成' };
```

### 自定义 AI 工具
扩展 `claudeCodeManager.js`,参考 Claude Agent SDK 文档配置自定义工具。

## 相关文档

- **架构详解**: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - 完整的系统架构和设计决策
- **README**: [README.md](README.md) - 用户面向的功能介绍和快速开始
- **API 示例**: 参考 `backend/server.js` 和 `backend/routes.js` 的注释

## 维护说明

- **配置管理**: 不要提交用户特定配置到仓库
- **依赖更新**: 定期检查 `npm outdated` 并测试更新
- **日志监控**: 生产环境需配置日志持久化方案
- **进程清理**: 确保服务关闭时清理所有子进程

---

**最后更新**: 2025-11-28
**适用版本**: v1.1.0
**新增功能**: ✨ AI 一句话创建项目

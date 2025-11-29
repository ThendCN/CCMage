# AI 一句话创建项目功能使用指南

## 📋 功能概述

通过集成 Claude Code SDK，用户可以用一句话描述项目需求，AI 会自动：
1. 🏗️ 创建项目目录结构
2. 📦 生成项目脚手架代码
3. ⚙️ 配置开发环境
4. 📥 安装项目依赖
5. 🚀 自动启动开发服务器
6. 📊 自动分析项目并添加到管理系统

## 🎯 使用步骤

### 1. 打开项目创建对话框

在 CCMage 主界面点击 **"✨ AI 创建项目"** 按钮（紫色渐变按钮）

### 2. 输入项目描述

在对话框中输入项目描述，例如：

```
一个博客系统，使用 React 和 Node.js，支持文章管理和评论功能
```

**描述建议：**
- ✅ 说明项目类型（博客、商城、管理系统等）
- ✅ 指定技术栈（React、Vue、Python、Django 等）
- ✅ 列出核心功能（用户认证、数据管理等）
- ❌ 避免过于简单的描述（如"一个网站"）

### 3. 配置高级选项（可选）

点击 **"显示高级选项"** 可以设置：

| 选项 | 说明 | 示例 |
|-----|------|------|
| **项目名称** | 自定义项目名称，留空则自动生成 | `my-blog` |
| **偏好技术栈** | 提示 AI 使用特定技术 | `React, TypeScript, Express` |
| **端口号** | 指定开发服务器端口 | `3000` |
| **自动安装依赖** | 创建后自动执行 npm install | ✅ 默认开启 |
| **自动启动项目** | 创建后自动启动开发服务器 | ✅ 默认开启 |

### 4. 开始创建

点击 **"开始创建"** 按钮，AI 将开始工作。

### 5. 监控创建进度

对话框会实时显示：
- 📝 AI 执行的每个步骤
- 📂 创建的文件和目录
- ⚙️ 执行的命令输出
- ✅ 完成状态

### 6. 完成

创建成功后：
- ✅ 项目自动添加到 CCMage
- 📊 自动完成项目分析
- 🚀 开发服务器已启动（如果勾选了自动启动）
- 🔄 页面自动刷新并显示新项目

## 🔧 技术架构

### 后端实现

**新增文件：**
- `backend/projectCreationRoutes.js` - 项目创建路由处理器

**API 端点：**
```
POST /api/projects/create-with-ai
  请求体: { description, projectName?, targetDir?, preferences? }
  响应: { sessionId, projectName, streamUrl }

GET /api/projects/create/stream/:sessionId
  SSE 流式输出创建进度

GET /api/projects/create/status/:sessionId
  获取创建状态
```

**核心流程：**
```javascript
1. 接收用户输入 → 验证参数
2. 生成 AI Prompt → 调用 Claude Code SDK
3. AI 创建项目文件 → 实时推送进度（SSE）
4. 自动检测项目信息 → 添加到数据库
5. 安装依赖（可选） → 启动项目（可选）
6. 触发项目分析 → 返回完成状态
```

### 前端实现

**新增文件：**
- `frontend/src/components/ProjectCreationDialog.tsx` - 创建对话框组件

**更新文件：**
- `frontend/src/api.ts` - 添加 `createProjectWithAI()` API
- `frontend/src/App.tsx` - 集成创建对话框

**技术特性：**
- ✨ 优雅的对话框 UI
- 📡 SSE 实时流式输出
- 🎨 Markdown 格式化渲染
- ⚡ 自动滚动到最新日志
- 🔔 创建完成后自动跳转

## 📝 AI Prompt 模板

系统会根据用户输入构建以下 Prompt：

```markdown
# 项目创建任务

## 📋 项目需求
{用户描述}

## 🎯 项目配置
- **项目名称**: {projectName}
- **项目路径**: {projectPath}
- **技术栈**: {stack}（可选）
- **端口**: {port}（可选）

## ✅ 任务要求

1. 创建项目目录结构
2. 初始化版本控制（git init）
3. 生成项目脚手架
4. 编写基础代码
5. 安装依赖（可选）
6. 创建 Git 初始提交

## 📝 重要提示
- 确保所有文件都在指定目录下创建
- 遵循最佳实践和代码规范
- 添加适当的注释和文档
```

## 🎬 使用示例

### 示例 1: 创建 React 博客系统

**输入：**
```
描述: 一个简单的博客系统，使用 React 和 Express，支持文章的增删改查
技术栈: React, Express, TypeScript
端口: 3000
```

**AI 会创建：**
```
my-blog/
├── frontend/          # React 前端
│   ├── src/
│   │   ├── components/
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── package.json
│   └── tsconfig.json
├── backend/           # Express 后端
│   ├── src/
│   │   ├── routes/
│   │   ├── models/
│   │   └── index.ts
│   └── package.json
├── .gitignore
└── README.md
```

### 示例 2: 创建 Python API

**输入：**
```
描述: 一个 RESTful API 服务，使用 FastAPI，提供用户认证和数据管理
```

**AI 会创建：**
```
restful-api/
├── app/
│   ├── main.py
│   ├── models/
│   ├── routes/
│   └── utils/
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

## ⚠️ 注意事项

### 环境要求

1. **Claude API Key**
   - 在设置中配置 `ANTHROPIC_API_KEY`
   - 确保 API Key 有效且有足够额度

2. **Claude Agent SDK**
   - 后端已自动安装 `@anthropic-ai/claude-agent-sdk`
   - 首次使用会自动加载 SDK

3. **项目根目录**
   - 确保 `.env` 中配置了 `PROJECT_ROOT`
   - 新项目默认创建在 `PROJECT_ROOT` 下

### 常见问题

**Q: 创建失败怎么办？**

A: 检查以下几点：
- Claude API Key 是否配置正确
- 项目名称是否已存在
- 目标目录是否有写入权限
- 查看错误日志了解具体原因

**Q: 如何自定义项目模板？**

A: 可以在 `projectCreationRoutes.js` 的 `buildProjectCreationPrompt()` 函数中修改 Prompt 模板。

**Q: 创建过程可以中断吗？**

A: 目前不支持中断，但可以关闭对话框。后台任务会继续执行完成。

**Q: 创建的项目可以自定义吗？**

A: 创建后可以手动修改代码。建议在描述中详细说明需求，让 AI 生成更符合预期的代码。

## 🚀 性能优化

### 创建速度

- ⚡ AI 执行通常需要 30-60 秒
- 📦 依赖安装时间取决于项目大小
- 🚀 整体流程约 1-3 分钟

### 成本控制

- 💰 每次创建约消耗 0.01-0.05 USD
- 📊 可在 AI 日志中查看具体费用
- 💡 建议详细描述以减少重试次数

## 📚 相关文档

- [CLAUDE.md](../CLAUDE.md) - 项目整体说明
- [ARCHITECTURE.md](./ARCHITECTURE.md) - 系统架构详解
- [PROJECT_MANAGEMENT_GUIDE.md](./PROJECT_MANAGEMENT_GUIDE.md) - 项目管理功能

## 🎉 开始使用

现在就试试用一句话创建你的第一个 AI 项目吧！

1. 点击 **"✨ AI 创建项目"**
2. 输入项目描述
3. 等待 AI 完成
4. 开始开发！

---

**版本**: v1.1.0  
**更新时间**: 2025-11-28  
**作者**: CCMage Team

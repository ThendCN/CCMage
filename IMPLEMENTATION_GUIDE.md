# 项目管理系统 - 扩展功能开发进度

> 更新时间：2025-11-27

## ✅ 已完成功能（后端）

### 1. 进程管理系统
**文件**：`backend/processManager.js`

**功能**：
- ✅ 启动项目服务（支持任意命令）
- ✅ 停止项目服务（优雅关闭 + 强制终止）
- ✅ 进程状态跟踪（PID、运行时间、命令）
- ✅ 实时日志收集（最多1000行）
- ✅ 事件系统（日志流、进程退出）
- ✅ 批量停止所有进程

### 2. 启动命令自动检测
**文件**：`backend/startupDetector.js`

**支持的项目类型**：
- ✅ Node.js（检测 package.json 的 dev/start/serve 脚本）
- ✅ Python（检测 main.py/app.py/server.py + FastAPI/Flask）
- ✅ Go（检测 go.mod + main.go）
- ✅ Docker（检测 Dockerfile + docker-compose.yml）
- ✅ Makefile（检测 run/dev/start 目标）

### 3. RESTful API 接口
**文件**：`backend/routes.js`

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/projects/:name/startup` | GET | 获取项目启动配置（自动检测+手动配置） |
| `/api/projects/:name/start` | POST | 启动项目服务 |
| `/api/projects/:name/stop` | POST | 停止项目服务 |
| `/api/projects/:name/running` | GET | 获取项目运行状态 |
| `/api/projects/:name/logs/stream` | GET | 实时日志流（SSE） |
| `/api/projects/:name/logs` | GET | 获取最近日志（HTTP） |
| `/api/projects/batch` | POST | 批量操作（start/stop/restart） |

### 4. Claude Code CLI 集成 ✨ NEW
**文件**：`backend/claudeCodeManager.js`、`backend/routes.js`

**核心功能**：
- ✅ 执行 Claude Code CLI 命令
- ✅ 实时流式输出（SSE）
- ✅ 会话管理（启动、终止、状态查询）
- ✅ 执行历史记录（每个项目最多20条）
- ✅ 历史详情查询和清空
- ✅ 活跃会话列表

**新增 API 接口**：

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/projects/:name/ai` | POST | 执行 AI 编程任务 |
| `/api/projects/:name/ai/stream/:sessionId` | GET | AI 实时输出流（SSE） |
| `/api/projects/:name/ai/status/:sessionId` | GET | 获取 AI 会话状态 |
| `/api/projects/:name/ai/terminate/:sessionId` | POST | 终止 AI 会话 |
| `/api/projects/:name/ai/history` | GET | 获取执行历史 |
| `/api/projects/:name/ai/history/:recordId` | GET | 获取历史详情 |
| `/api/projects/:name/ai/history` | DELETE | 清空历史记录 |
| `/api/ai/sessions` | GET | 获取所有活跃会话 |

### 5. 优雅关闭机制
- ✅ 监听 SIGTERM 和 SIGINT 信号
- ✅ 停止所有运行中的项目服务
- ✅ 防止进程泄漏

---

## 📋 新增 API 使用示例

### 1. 检测启动配置
```bash
curl http://localhost:9999/api/projects/workgame/startup
```

响应：
```json
{
  "detected": {
    "command": "npm run dev",
    "type": "node",
    "manager": "npm"
  },
  "manual": null
}
```

### 2. 启动项目
```bash
curl -X POST http://localhost:9999/api/projects/workgame/start \
  -H "Content-Type: application/json"
```

响应：
```json
{
  "success": true,
  "message": "项目启动成功",
  "pid": 12345,
  "startTime": 1701080000000
}
```

### 3. 检查运行状态
```bash
curl http://localhost:9999/api/projects/workgame/running
```

响应：
```json
{
  "running": true,
  "pid": 12345,
  "startTime": 1701080000000,
  "uptime": 15000,
  "command": "npm run dev"
}
```

### 4. 停止项目
```bash
curl -X POST http://localhost:9999/api/projects/workgame/stop
```

### 5. 获取日志
```bash
curl "http://localhost:9999/api/projects/workgame/logs?limit=50"
```

### 6. 实时日志流（SSE）
```bash
curl -N http://localhost:9999/api/projects/workgame/logs/stream
```

### 7. 批量操作
```bash
curl -X POST http://localhost:9999/api/projects/batch \
  -H "Content-Type: application/json" \
  -d '{
    "action": "start",
    "projectNames": ["workgame", "MandalaFlow"]
  }'
```

---

## ✅ 已完成功能（前端）

### 1. 项目卡片增强 ✅
**位置**：`frontend/src/components/ProjectCard.tsx`

**已实现**：
- ✅ 绿色启动按钮（Play 图标）
- ✅ 红色停止按钮（Square 图标）
- ✅ 运行状态指示器（绿色脉动动画 + "运行中"文字）
- ✅ 日志查看按钮（运行中时显示）
- ✅ **AI 编程按钮**（紫色渐变背景 + Bot 图标）
- ✅ 实时状态轮询（每3秒）
- ✅ 批量选择支持（复选框 + 高亮边框）

### 2. 日志查看器组件 ✅
**文件**：`frontend/src/components/LogViewer.tsx`

**已实现功能**：
- ✅ 实时显示日志（使用 EventSource 连接 SSE）
- ✅ 自动滚动到底部
- ✅ 支持暂停/开启自动滚动
- ✅ 区分 stdout（绿色 INFO）和 stderr（橙色 ERROR）
- ✅ 支持清空日志
- ✅ 时间戳显示
- ✅ 全屏弹窗式设计
- ✅ 深色代码风格
- ✅ 连接状态指示器

### 3. 批量操作界面 ✅
**位置**：`frontend/src/App.tsx`

**已实现**：
- ✅ "批量操作"按钮（开启/退出多选模式）
- ✅ 项目多选功能（复选框）
- ✅ 选中项目高亮显示（蓝色边框）
- ✅ 批量操作工具栏
  - ✅ 显示已选项目数量
  - ✅ 批量启动按钮（绿色）
  - ✅ 批量停止按钮（红色）
  - ✅ 批量重启按钮（灰色）
- ✅ 操作结果提示
- ✅ 自动退出多选模式

### 4. AI 编程助手 ✨ NEW
**文件**：`frontend/src/components/AiDialog.tsx`

**核心功能**：
- ✅ **交互式对话界面** - 输入任务描述，AI 自动执行
- ✅ **实时流式输出** - 使用 SSE 实时显示 Claude Code 执行过程
- ✅ **执行历史记录** - 每个项目保存最近20条历史
- ✅ **历史详情查看** - 点击历史记录可重新查看输出
- ✅ **会话管理** - 支持终止正在运行的任务
- ✅ **快捷键支持** - Cmd/Ctrl + Enter 执行
- ✅ **侧边栏历史** - 可展开/收起的历史记录面板
- ✅ **清空历史** - 一键清空所有历史记录
- ✅ **执行统计** - 显示成功/失败状态和执行时长

**使用体验**：
- 全屏对话窗口，沉浸式体验
- 深色输出区域，类似终端体验
- 实时显示 AI 思考和执行过程
- 自动滚动到最新输出
- 紫色渐变 AI 按钮，视觉醒目

---

## 🎯 完整功能列表

| 功能模块 | 后端 | 前端 | 说明 |
|---------|------|------|------|
| 项目启动 | ✅ | ✅ | 自动检测启动命令并执行 |
| 项目停止 | ✅ | ✅ | 优雅关闭 + 强制终止机制 |
| 运行状态显示 | ✅ | ✅ | 实时轮询 + 绿色脉动动画 |
| 实时日志查看 | ✅ | ✅ | SSE 推送 + 颜色区分 stdout/stderr |
| 日志自动滚动 | - | ✅ | 可暂停/开启 |
| 批量启动 | ✅ | ✅ | 多选 + 一键启动 |
| 批量停止 | ✅ | ✅ | 多选 + 一键停止 |
| 批量重启 | ✅ | ✅ | 先停止再启动 |
| **AI 编程助手** | ✅ | ✅ | **Claude Code CLI 集成** |
| **AI 实时输出** | ✅ | ✅ | **SSE 流式传输** |
| **AI 执行历史** | ✅ | ✅ | **每项目20条记录** |
| **AI 会话管理** | ✅ | ✅ | **启动/终止/状态查询** |

---

## 📘 使用指南

### 如何使用 AI 编程助手

1. **打开 AI 对话框**
   - 在任意项目卡片中点击紫色"AI 编程"按钮
   - 将打开全屏 AI 编程助手界面

2. **输入任务描述**
   - 在底部输入框中用自然语言描述你想让 AI 做的事情
   - 例如："帮我添加一个用户登录功能"、"优化这个项目的性能"
   - 支持快捷键：Cmd/Ctrl + Enter 快速执行

3. **查看实时输出**
   - AI 开始工作后，会在深色输出区域实时显示执行过程
   - stdout 输出显示为白色
   - stderr 输出显示为红色
   - 自动滚动到最新输出

4. **管理执行历史**
   - 点击右上角"历史记录"按钮打开侧边栏
   - 查看最近 20 条执行记录
   - 点击任意历史记录可重新查看详情
   - 点击垃圾桶图标清空所有历史

5. **终止执行**
   - 如果 AI 执行时间过长，可以点击"终止"按钮
   - 系统会优雅地停止当前任务

### AI 编程最佳实践

✅ **DO（推荐做法）**：
- 使用清晰、具体的任务描述
- 一次只让 AI 做一件事
- 检查 AI 的输出，确保符合预期
- 定期查看历史记录，学习 AI 的工作方式

❌ **DON'T（避免做法）**：
- 不要给出模糊的指令
- 不要在关键代码上完全依赖 AI，要人工Review
- 不要频繁中断 AI 的执行
- 不要忽略 stderr 的错误输出

---

## 📝 开发建议

所有核心功能已完成！系统现在包含：
- ✅ 完整的项目管理功能
- ✅ 进程启动/停止控制
- ✅ 实时日志查看
- ✅ 批量操作支持
- ✅ **AI 编程助手（Claude Code CLI 集成）**

### 后续优化方向

1. **性能优化**
   - 实现日志分页加载（目前只保存最近1000行）
   - 优化 SSE 连接的资源占用
   - 添加项目状态缓存机制

2. **用户体验提升**
   - 添加项目图标/Logo 支持
   - 实现拖拽排序功能
   - 添加项目分组功能
   - 支持自定义主题颜色

3. **安全性增强**
   - 添加用户认证机制
   - 实现操作权限控制
   - 添加操作审计日志

4. **功能扩展**
   - 支持 Docker Compose 管理
   - 集成 Git 操作（commit, push, pull）
   - 添加项目依赖关系图谱
   - 支持环境变量配置管理

---

## 🔧 技术要点

### SSE（Server-Sent Events）连接
```typescript
// 前端连接实时日志
const eventSource = new EventSource('/api/projects/project-name/logs/stream');

eventSource.onmessage = (event) => {
  const log = JSON.parse(event.data);
  console.log(log);
};

// 记得在组件卸载时关闭连接
eventSource.close();
```

### 进程状态轮询
```typescript
// 每3秒检查一次项目运行状态
useEffect(() => {
  const interval = setInterval(async () => {
    const status = await fetch(`/api/projects/${name}/running`).then(r => r.json());
    setIsRunning(status.running);
  }, 3000);

  return () => clearInterval(interval);
}, [name]);
```

---

## ✨ 下一步行动

### 立即可以做的：
1. **测试后端 API**：使用 curl 或 Postman 测试所有接口
2. **启动一个项目**：`curl -X POST http://localhost:9999/api/projects/workgame/start`
3. **查看日志流**：`curl -N http://localhost:9999/api/projects/workgame/logs/stream`

### 继续开发建议：
1. 从简单的启动/停止按钮开始
2. 然后实现日志查看器
3. 最后添加批量操作和 AI 集成

---

## 📊 项目统计

- ✅ 后端模块：3 个文件
- ✅ API 接口：7 个
- ✅ 支持的项目类型：5 种
- ✅ 代码行数：~500 行
- ⏳ 前端功能：待开发
- ⏳ 测试覆盖率：待提升

---

**🎯 当前状态**：后端核心功能已完成，前端功能等待开发！

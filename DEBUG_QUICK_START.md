# 🐛 启用 AI 详细日志

## 快速开始

```bash
# 方法 1: 使用快速脚本（推荐）
cd /Users/thend/Project/project-manager
./start-debug.sh
```

这将自动：
1. ✅ 在 `.env` 中启用 `DEBUG_AI=true`
2. ✅ 停止现有后端进程
3. ✅ 启动带详细日志的后端服务

---

## 方法 2: 手动配置

```bash
# 1. 编辑 .env 文件
cd /Users/thend/Project/project-manager
echo "DEBUG_AI=true" >> .env

# 2. 重启后端
pkill -f "node.*server.js"
npm run dev:backend
```

---

## 📊 详细日志内容

启用后，你会看到：

### ✅ 系统消息详情
```
[AI] 📋 系统消息 subtype: init
[AI] ⚙️  初始化消息: {
  cwd: '/Users/thend/Project',
  settingSources: ['project', 'user'],
  hasTools: true,
  toolCount: 15
}
```

### ✅ 每条消息的详细信息
```
[AI] 📨 收到第 1 条消息
[AI]   - 消息类型: assistant
[AI]   - 距上条消息: 234ms
[AI]   - 内容预览: 我会帮你创建一个番茄钟应用...
```

### ✅ 项目创建完整过程
```
[ProjectCreation] 🤖 构建的 Prompt:
================================================================================
# 项目创建任务
...
================================================================================

[ProjectCreation] 📊 请求参数:
  - description: 写个番茄钟
  - projectName: pomodoro-timer
  - projectPath: /Users/thend/Project/pomodoro-timer
  - preferences: { autoStart: true, autoInstall: true }
```

### ✅ 错误详细信息（如果有）
```
[ProjectCreation] ❌ AI 任务失败
[ProjectCreation] 错误详情: Error: ...
[ProjectCreation] 错误堆栈: 
  at ...
  at ...
```

### ✅ 原始消息内容（最详细）
```
[AI-DEBUG] 原始消息: {
  "type": "assistant",
  "message": {
    "content": [...],
    ...
  }
}
```

---

## 🔧 常见问题

### Q: 如何关闭详细日志？

```bash
# 编辑 .env，设置为 false
DEBUG_AI=false

# 或者删除该行
sed -i.bak '/DEBUG_AI/d' .env && rm -f .env.bak

# 重启服务
pkill -f "node.*server.js"
npm run dev:backend
```

### Q: 日志太多，如何查看特定部分？

```bash
# 只看错误
npm run dev:backend 2>&1 | grep "❌"

# 只看项目创建相关
npm run dev:backend 2>&1 | grep "ProjectCreation"

# 只看 AI 消息
npm run dev:backend 2>&1 | grep "\[AI\]"
```

### Q: 如何保存日志到文件？

```bash
# 保存所有日志
npm run dev:backend 2>&1 | tee backend-debug.log

# 只保存错误
npm run dev:backend 2>&1 | grep "❌\|错误" | tee errors.log
```

---

## 📋 下一步

1. **启动调试模式**: `./start-debug.sh`
2. **尝试创建项目**: 打开浏览器 → http://localhost:5173 → "✨ AI 创建项目"
3. **观察日志**: 查看控制台的详细输出
4. **定位问题**: 根据日志找到失败原因

---

详细的调试指南请查看: [docs/AI_DEBUG_GUIDE.md](./docs/AI_DEBUG_GUIDE.md)

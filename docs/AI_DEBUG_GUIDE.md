# 🐛 AI 项目创建调试指南

## 📋 问题诊断

根据你提供的日志，AI 创建项目过程中遇到了问题。我已经添加了详细的日志输出，帮助你定位问题。

## ✅ 增强的日志功能

### 新增的日志输出

1. **系统消息详情**
   ```
   [AI] 📋 系统消息 subtype: init
   [AI] ⚙️  初始化消息: { cwd, settingSources, toolCount }
   ```

2. **消息过滤信息**
   ```
   [AI]   - 消息已被过滤: system/init
   [AI]   - 消息概要: { type, subtype, hasContent, keys }
   ```

3. **项目创建详情**
   ```
   [ProjectCreation] 🤖 构建的 Prompt: (完整内容)
   [ProjectCreation] 📊 请求参数: (description, projectName, preferences)
   [ProjectCreation] 🚀 启动 AI 任务
   ```

4. **错误详情**
   ```
   [ProjectCreation] ❌ AI 任务失败
   [ProjectCreation] 错误详情: (error)
   [ProjectCreation] 错误堆栈: (stack trace)
   ```

## 🔧 启用详细日志

### 方法 1: 编辑 .env 文件（推荐）

```bash
# 1. 编辑 .env 文件
cd /Users/thend/Project/project-manager
nano .env

# 2. 添加/修改以下行
DEBUG_AI=true

# 3. 保存并退出（Ctrl+O, Enter, Ctrl+X）

# 4. 重启后端服务
pkill -f "node.*server.js"
npm run dev:backend
```

### 方法 2: 临时启用（本次会话）

```bash
cd /Users/thend/Project/project-manager/backend
DEBUG_AI=true node server.js
```

### 方法 3: 使用启动脚本

```bash
cd /Users/thend/Project/project-manager
npm run dev:backend:debug  # 如果有配置
```

## 📊 预期日志输出

启用详细日志后，创建项目时你会看到：

```
[ProjectCreation] 📬 收到项目创建请求
[ProjectCreation]   - 描述: 写个番茄钟
[ProjectCreation]   - 项目名: project-1764315814751
...

[ProjectCreation] 🤖 构建的 Prompt:
================================================================================
# 项目创建任务

## 📋 项目需求
写个番茄钟
...
================================================================================

[ProjectCreation] 🚀 启动 AI 任务
[ProjectCreation] Claude Code Manager 执行参数:
  - 显示名称: 创建项目: project-1764315814751
  - 工作目录: /Users/thend/Project
  - sessionId: create-project-1764315814751-1764315814753
  - Prompt 长度: 1234 字符

[AI] 🔄 动态加载 Claude Agent SDK...
[AI] ✅ Claude Agent SDK 加载成功
[AI] 📝 创建 query 实例...
[AI] ✅ Query 实例已创建
[AI] 💾 保存会话信息: create-project-1764315814751-1764315814753

[AI] 📡 开始处理消息流: create-project-1764315814751-1764315814753
[AI] 📋 项目名称: 创建项目: project-1764315814751
[AI] ⏱️  开始时间: 2024-11-28 15:36:54

[AI] 📨 收到第 1 条消息
[AI]   - 消息类型: system
[AI]   - 距上条消息: 6674ms
[AI] 📋 系统消息 subtype: init
[AI] ⚙️  初始化消息: {
  cwd: '/Users/thend/Project',
  settingSources: ['project', 'user'],
  hasTools: true,
  toolCount: 15
}
[AI]   - 消息已被过滤: system/init

[AI] 📨 收到第 2 条消息
[AI]   - 消息类型: assistant
[AI]   - 距上条消息: 234ms
[AI]   - 内容预览: 我会帮你创建一个番茄钟应用...
[AI] 📡 发送 EventEmitter 事件: ai-output:create-project-1764315814751-1764315814753

[AI] 📨 收到第 3 条消息
[AI]   - 消息类型: assistant
[AI]   - 距上条消息: 567ms
[AI]   - 内容预览: 📂 **正在创建目录**...
...
```

## 🔍 常见问题排查

### 问题 1: API Key 无效

**日志特征**:
```
API Error: 401 {"error":{"message":"无效的令牌"}}
```

**解决方法**:
1. 检查 `.env` 中的 `ANTHROPIC_API_KEY`
2. 确保 API Key 有效且有余额
3. 验证 `ANTHROPIC_BASE_URL` 配置正确

### 问题 2: 项目目录创建失败

**日志特征**:
```
[ProjectCreation] ❌ 项目目录不存在: /Users/thend/Project/...
```

**解决方法**:
1. 检查 `PROJECT_ROOT` 配置
2. 确保有目录写入权限
3. 检查磁盘空间

### 问题 3: SDK 加载失败

**日志特征**:
```
[AI] ❌ 加载 Claude Agent SDK 失败: ...
```

**解决方法**:
```bash
cd /Users/thend/Project/project-manager/backend
npm install @anthropic-ai/claude-agent-sdk
```

### 问题 4: 消息流中断

**日志特征**:
```
[AI] 📨 收到第 X 条消息
... (然后没有更多消息)
```

**可能原因**:
- 网络连接问题
- API 超时
- 达到令牌限制

## 📝 收集诊断信息

如果问题仍未解决，请收集以下信息：

```bash
# 1. 启用详细日志
echo "DEBUG_AI=true" >> .env

# 2. 清理旧日志
pkill -f "node.*server.js"

# 3. 启动后端并保存日志
cd /Users/thend/Project/project-manager/backend
node server.js 2>&1 | tee debug.log

# 4. 在另一个终端，尝试创建项目
# 打开浏览器访问 http://localhost:5173
# 点击 "✨ AI 创建项目"，输入描述

# 5. 查看日志文件
tail -100 debug.log
```

## 🎯 下一步

1. **启用详细日志**: 在 `.env` 中设置 `DEBUG_AI=true`
2. **重启服务**: `pkill -f "node.*server.js" && npm run dev:backend`
3. **重试创建**: 再次尝试创建项目
4. **查看日志**: 观察控制台输出的详细信息
5. **定位问题**: 根据日志找到失败的具体步骤

## 📞 获取帮助

如果仍有问题，请提供：
- 完整的控制台日志输出
- `.env` 配置（隐藏敏感信息）
- 项目创建的描述内容
- 错误发生的具体时间点

---

**更新时间**: 2024-11-28  
**适用版本**: v1.1.0

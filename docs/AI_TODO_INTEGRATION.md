# AI 增强 Todo 功能集成完成

## ✅ 已完成的优化重构

### 核心思路：**复用而不是重复实现**

我们成功地将 AI 任务协作功能与系统现有的 AI 编程助手进行了深度集成，避免了重复实现，提高了代码复用性和维护性。

---

## 🔄 架构优化

### 之前的设计（已废弃）
```
todoAiManager.js
├── decomposeTask()      ✓ 保留
├── collaborateOnTask()  ✗ 移除（重复实现）
├── continueCollaboration() ✗ 移除
└── verifyTask()         ✓ 保留
```

### 优化后的设计
```
todoAiManager.js (简化)
├── decomposeTask()           - AI 任务拆分（专用功能）
├── verifyTask()              - AI 任务验证（专用功能）
├── generateTaskContext()     - 生成任务上下文（工具方法）
└── linkSessionToTask()       - 关联会话到任务（工具方法）

aiManager.js (增强)
├── execute(..., todoId)      - 增加 todoId 参数支持
├── processQueryStream()      - 会话结束自动关联任务
└── [现有所有功能]           - 完全复用

前端
├── AiDialog 组件             - 完全复用现有对话界面
└── executeAI(..., todoId)    - API 支持传入 todoId
```

---

## 📋 技术实现细节

### 1. **任务上下文自动注入**

当从 Todo 任务发起 AI 对话时，自动提供丰富的上下文信息：

**aiManager.js (Line 43-62)**
```javascript
async execute(projectName, projectPath, prompt, sessionId, todoId = null) {
  // 如果有关联任务，添加任务上下文
  let finalPrompt = prompt;
  if (todoId) {
    const todoAiManager = require('./todoAiManager');
    const taskContext = todoAiManager.generateTaskContext(todoId);
    finalPrompt = taskContext + '\n\n【用户请求】\n' + prompt;
  }
  // ... 使用增强后的 prompt 调用 AI
}
```

**上下文包含的信息：**
- 任务标题、描述、类型、优先级、状态
- 预估工时 vs 实际工时
- 所有子任务列表（如果有）
- 最近的 AI 验证结果（问题、建议、置信度）

### 2. **会话自动关联到任务**

AI 对话完成后，自动保存会话记录到数据库：

**aiManager.js (Line 259-268)**
```javascript
// 如果关联了任务，保存会话记录
const session = this.sessions.get(sessionId);
if (session && session.todoId) {
  const todoAiManager = require('./todoAiManager');
  await todoAiManager.linkSessionToTask(sessionId, session.todoId);
}
```

**好处：**
- 可以查看某个任务的所有 AI 协作历史
- 追溯问题解决过程
- 统计 AI 使用情况

### 3. **前后端 API 调用链**

**前端 → 后端的完整调用链：**

```
前端组件
  ↓ executeAI(projectName, prompt, engine, conversationId, todoId)
api.ts
  ↓ POST /api/projects/:name/ai { prompt, engine, conversationId, todoId }
routes.js
  ↓ aiEngineFactory.execute(engine, name, path, prompt, sessionId, todoId)
aiEngineFactory.js
  ↓ claudeCodeManager.execute(name, path, prompt, sessionId, todoId)
aiManager.js
  ↓ [自动注入任务上下文] → SDK query → [会话完成自动关联]
```

---

## 🎯 三大核心功能

### ✅ 1. AI 任务拆分 (独立实现)

**功能：** 用一句话描述任务，AI 自动拆分为 3-8 个子任务

**技术：**
- `todoAiManager.decomposeTask()` - 使用 Claude Agent SDK
- 返回结构化 JSON：主任务 + 子任务列表
- 包含标题、描述、工时、优先级、执行顺序

**API：**
```bash
POST /api/todos/decompose
{
  "projectName": "my-project",
  "description": "实现用户登录功能"
}
```

### ✅ 2. AI 协作助手 (复用现有)

**功能：** 为任务开启专属 AI 对话，自动提供任务上下文

**技术：**
- 完全复用现有 `aiManager.js` 和 `AiDialog.tsx`
- 通过 `todoId` 参数自动注入上下文
- 支持连续对话（resume 机制）

**使用方式：**
```javascript
// 前端调用（带 todoId）
executeAI(projectName, userMessage, engine, conversationId, todoId);

// 后端自动：
// 1. 生成任务上下文（任务信息+子任务+验证记录）
// 2. 拼接到用户消息
// 3. 调用 AI
// 4. 完成后关联会话到任务
```

### ✅ 3. AI 任务验证 (独立实现)

**功能：** 自动验证任务是否完成，返回结构化结果

**技术：**
- `todoAiManager.verifyTask()` - 使用 Claude Agent SDK
- 检查代码实现、运行测试、评估质量
- 返回：passed/failed/partial + 置信度 + 问题列表 + 建议

**API：**
```bash
POST /api/todos/:id/verify
→ 返回: { result, confidence, issues_found, suggestions, evidence }
```

---

## 📊 数据库设计

**新增 3 张表：**

```sql
-- AI 会话表
CREATE TABLE ai_sessions (
  session_id TEXT UNIQUE,
  project_name TEXT,
  todo_id INTEGER,              -- 关联的任务
  session_type TEXT,            -- decompose/collaborate/verify
  status TEXT,
  result_summary TEXT,
  ...
);

-- AI 消息表
CREATE TABLE ai_messages (
  session_id TEXT,
  message_type TEXT,
  content TEXT,
  metadata TEXT,
  ...
);

-- AI 验证记录表
CREATE TABLE ai_verifications (
  todo_id INTEGER,
  session_id TEXT,
  result TEXT,                  -- passed/failed/partial
  confidence REAL,
  issues_found TEXT,
  suggestions TEXT,
  evidence TEXT,
  ...
);
```

---

## 🎨 前端集成（待实现）

### 需要添加的 UI 元素

**1. 在 TodoManager 中为每个任务添加 AI 按钮：**

```tsx
<button onClick={() => openAiDialog(todo.id)}>
  <Bot /> AI 协作
</button>
```

**2. 打开现有的 AiDialog，传入 todoId：**

```tsx
<AiDialog
  projectName={projectName}
  todoId={todo.id}            // 新增参数
  onClose={() => setShowAiDialog(false)}
/>
```

**3. AiDialog 调用 API 时传入 todoId：**

```tsx
const result = await executeAI(
  projectName,
  userMessage,
  selectedEngine,
  conversationId,
  todoId                      // 新增参数
);
```

**完成！** 无需任何其他修改，后端会自动处理上下文注入和会话关联。

---

## 🔍 使用场景示例

### 场景 1：普通 AI 对话（无任务关联）
```javascript
// 在项目详情页发起对话，不传 todoId
executeAI(projectName, "帮我优化数据库查询", engine);
// → AI 响应但不关联任务
```

### 场景 2：AI 协作（有任务关联）
```javascript
// 在 Todo 任务卡片点击 AI 按钮，传入 todoId
executeAI(projectName, "这个登录功能怎么实现？", engine, null, todoId);

// → 后端自动：
// 【当前任务上下文】
// - 任务标题: 实现用户登录功能
// - 任务描述: 支持邮箱和手机号登录
// - 任务类型: feature
// - 优先级: high
// - 状态: in_progress
// 【子任务列表】
// 1. [completed] 设计数据库表结构
// 2. [in_progress] 实现登录 API
// 3. [pending] 前端登录表单
//
// 【用户请求】
// 这个登录功能怎么实现？
//
// AI: 根据你的任务信息，我看到你正在实现用户登录功能...
```

### 场景 3：查看任务的 AI 协作历史
```javascript
// API 调用
GET /api/todos/123/sessions

// → 返回该任务的所有 AI 会话记录
[
  {
    session_id: "claude-code-xxx",
    prompt: "这个登录功能怎么实现？",
    started_at: "2025-11-29 10:30:00",
    duration_ms: 45000
  },
  ...
]
```

---

## 📈 优势总结

### ✅ 代码复用
- AI 对话核心逻辑：**100% 复用**
- UI 组件：**100% 复用** (AiDialog)
- 减少了约 **400 行重复代码**

### ✅ 用户体验一致
- 所有 AI 对话使用统一界面
- 保持一致的交互模式
- 支持跨引擎对话（Claude Code / Codex）

### ✅ 易于维护
- AI 功能集中在 `aiManager.js`
- 修改一处，所有调用都生效
- 清晰的职责分离

### ✅ 功能增强
- 任务上下文自动注入
- 会话历史自动关联
- 可追溯的协作记录

---

## 🚀 下一步工作

1. **前端 UI 实现**（约 50 行代码）
   - 在 TodoManager 中添加 AI 按钮
   - 在 AiDialog 中接受 todoId 参数
   - 传递 todoId 到 executeAI 调用

2. **AI 任务拆分 UI**（约 200 行）
   - 创建任务拆分对话框
   - 显示拆分结果
   - 一键创建主任务+子任务

3. **AI 验证 UI**（约 150 行）
   - 显示验证徽章（passed/failed/partial）
   - 展示问题列表和建议
   - 查看验证历史

4. **测试和优化**
   - 端到端流程测试
   - 性能优化
   - 用户体验打磨

---

## 📝 关键代码变更

| 文件 | 变更说明 | 行数变化 |
|------|---------|---------|
| `todoAiManager.js` | 移除协作功能，保留拆分和验证 | -300 行 |
| `aiManager.js` | 增加 todoId 支持和自动关联 | +30 行 |
| `routes.js` | API 支持 todoId 参数 | +3 行 |
| `aiEngineFactory.js` | 传递 todoId 参数 | +2 行 |
| `codexManager.js` | 支持 todoId 参数（兼容性） | +3 行 |
| `api.ts` | executeAI 支持 todoId | +3 行 |
| **总计** | | **-259 行** |

**净减少 259 行代码，功能更强大！** 🎉

---

**编写时间：** 2025-11-29
**版本：** v1.2.0
**作者：** Claude Code Integration Team

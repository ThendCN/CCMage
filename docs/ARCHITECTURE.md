# 架构文档 Architecture Documentation

本文档详细描述 Project Manager 的系统架构、设计决策和实现细节。

## 目录

- [系统架构](#系统架构)
- [技术选型](#技术选型)
- [核心模块](#核心模块)
- [数据流](#数据流)
- [API 设计](#api-设计)
- [状态管理](#状态管理)
- [安全性考虑](#安全性考虑)
- [性能优化](#性能优化)
- [扩展性设计](#扩展性设计)

## 系统架构

### 整体架构

```
┌─────────────────────────────────────────────────┐
│                    Frontend                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │  React   │  │  Vite    │  │  TypeScript   │ │
│  │   App    │  │  Build   │  │   Types       │ │
│  └──────────┘  └──────────┘  └───────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │           Component Layer                   │ │
│  │  ┌─────────┐  ┌─────────┐  ┌──────────┐   │ │
│  │  │ Project │  │   AI    │  │   Log    │   │ │
│  │  │  Card   │  │ Dialog  │  │  Viewer  │   │ │
│  │  └─────────┘  └─────────┘  └──────────┘   │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │            API Client Layer                 │ │
│  │  - HTTP Client (fetch)                      │ │
│  │  - SSE Client (EventSource)                 │ │
│  └────────────────────────────────────────────┘ │
└────────────┬────────────────────────────────────┘
             │ HTTP/SSE
             │
┌────────────▼────────────────────────────────────┐
│                    Backend                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ Express  │  │  CORS    │  │   Claude      │ │
│  │  Server  │  │ Middleware│  │  Agent SDK    │ │
│  └──────────┘  └──────────┘  └───────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │           Route Layer                       │ │
│  │  ┌─────────┐  ┌─────────┐  ┌──────────┐   │ │
│  │  │ Project │  │ Process │  │    AI    │   │ │
│  │  │  API    │  │   API   │  │   API    │   │ │
│  │  └─────────┘  └─────────┘  └──────────┘   │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │          Service Layer                      │ │
│  │  ┌──────────────┐  ┌──────────────────┐   │ │
│  │  │   Process    │  │     Claude       │   │ │
│  │  │   Manager    │  │  Code Manager    │   │ │
│  │  └──────────────┘  └──────────────────┘   │ │
│  │  ┌──────────────┐                          │ │
│  │  │   Startup    │                          │ │
│  │  │   Detector   │                          │ │
│  │  └──────────────┘                          │ │
│  └────────────────────────────────────────────┘ │
└────────────┬────────────────────────────────────┘
             │ File System / Child Process
             │
┌────────────▼────────────────────────────────────┐
│              System Resources                    │
│  ┌─────────────────────────────────────────┐   │
│  │  File System                             │   │
│  │  - .claude/projects.json (Config)        │   │
│  │  - ai-history.json (AI History)          │   │
│  │  - Project Directories                   │   │
│  └─────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────┐   │
│  │  Child Processes                         │   │
│  │  - Project Dev Servers                   │   │
│  │  - Git Commands                          │   │
│  │  - npm/pip Commands                      │   │
│  └─────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### 层次划分

#### 1. 前端层 (Frontend)
- **组件层**: 可复用的 React 组件
- **API 客户端层**: HTTP 和 SSE 通信
- **状态管理**: React Hooks (useState, useEffect)

#### 2. 后端层 (Backend)
- **路由层**: RESTful API 路由定义
- **服务层**: 业务逻辑处理
- **数据访问层**: 文件系统操作

#### 3. 系统资源层
- **文件系统**: 配置文件、历史记录
- **进程管理**: 子进程控制

## 技术选型

### 前端技术栈

#### React 18
**选择原因:**
- 成熟的生态系统
- Hooks 提供简洁的状态管理
- 虚拟 DOM 提升性能
- 强大的社区支持

**关键特性:**
- 函数式组件
- Hooks (useState, useEffect, useRef)
- 组件化开发

#### TypeScript
**选择原因:**
- 类型安全,减少运行时错误
- 更好的 IDE 支持
- 代码可维护性强

**使用方式:**
- 严格模式
- 接口定义所有 Props 和 State
- 避免使用 `any`

#### Vite
**选择原因:**
- 极快的冷启动
- HMR (热模块替换)
- 开箱即用的 TypeScript 支持
- 优化的生产构建

### 后端技术栈

#### Node.js + Express
**选择原因:**
- JavaScript 全栈统一
- 非阻塞 I/O 适合并发请求
- 丰富的中间件生态

#### Claude Agent SDK
**选择原因:**
- 官方 SDK,稳定可靠
- 完整的 TypeScript 类型
- 流式输出支持
- 内置工具调用

## 核心模块

### 1. 项目管理模块

#### server.js
**职责:**
- 启动 Express 服务器
- 配置中间件 (CORS, JSON)
- 定义项目管理 API
- 提供静态文件服务

**核心函数:**

```javascript
// 检查项目状态
async function checkProjectStatus(projectPath, project) {
  // 检查 Git 状态
  // 检查依赖安装状态
  // 返回项目状态对象
}

// 执行项目操作
async function executeAction(action, projectPath, project, params) {
  // 支持操作:
  // - open-directory: 打开项目目录
  // - open-vscode: 在 VSCode 中打开
  // - git-status: 查看 Git 状态
  // - install-deps: 安装依赖
}
```

### 2. 进程管理模块

#### processManager.js
**职责:**
- 启动/停止项目开发服务器
- 管理子进程生命周期
- 收集和分发进程日志

**设计模式: EventEmitter**

```javascript
class ProcessManager extends EventEmitter {
  constructor() {
    this.processes = new Map(); // 进程映射
    this.logs = new Map();      // 日志缓存
  }

  // 启动进程
  start(name, command, cwd) {
    const proc = spawn(command, { cwd, shell: true });

    // 监听输出
    proc.stdout.on('data', (data) => {
      this.emit(`log:${name}`, { type: 'stdout', content: data });
    });

    // 保存进程
    this.processes.set(name, proc);
  }

  // 停止进程
  stop(name) {
    const proc = this.processes.get(name);
    proc.kill();
  }
}
```

**日志管理:**
- 内存缓存最近 1000 条日志
- 使用 EventEmitter 实时分发
- SSE 流式输出到前端

### 3. 启动检测模块

#### startupDetector.js
**职责:**
- 自动检测项目类型
- 识别启动命令
- 支持自定义配置

**检测逻辑:**

```javascript
function detect(projectPath, project) {
  // 1. 用户自定义命令优先
  if (project.startCommand) {
    return { command: project.startCommand, detected: false };
  }

  // 2. 检测 package.json
  if (hasFile('package.json')) {
    const pkg = readPackageJson();
    if (pkg.scripts.dev) return { command: 'npm run dev' };
    if (pkg.scripts.start) return { command: 'npm start' };
  }

  // 3. 检测 Python 项目
  if (hasFile('requirements.txt')) {
    return { command: 'python app.py' };
  }

  return null;
}
```

### 4. AI 编程助手模块

#### claudeCodeManager.js
**职责:**
- 集成 Claude Agent SDK
- 管理 AI 对话会话
- 格式化 SDK 消息输出
- 持久化历史记录

**核心流程:**

```javascript
class ClaudeCodeManager extends EventEmitter {
  async execute(projectName, projectPath, prompt, sessionId) {
    // 1. 加载 SDK
    const sdk = await this.loadSDK();

    // 2. 创建 query
    const queryInstance = sdk.query({
      prompt,
      options: {
        cwd: projectPath,
        systemPrompt: { type: 'preset', preset: 'claude_code' },
        maxTurns: 50
      }
    });

    // 3. 处理消息流
    for await (const message of queryInstance) {
      const logEntry = this.messageToLogEntry(message, sessionId);
      this.emit(`ai-output:${sessionId}`, logEntry);
    }
  }
}
```

**消息处理:**

1. **SDKAssistantMessage** - AI 回复
   - 提取文本内容
   - 格式化工具调用

2. **SDKUserMessage** - 工具结果
   - 格式化执行结果
   - 智能截断长输出

3. **SDKResultMessage** - 执行总结
   - 显示统计信息
   - 成功/失败状态

4. **SDKSystemMessage** - 系统消息
   - 过滤不需要的消息
   - 保留关键信息

### 5. 前端组件

#### ProjectCard.tsx
**职责:**
- 显示项目信息
- 提供快速操作按钮
- 显示项目状态徽章

**状态显示:**
- Git 状态 (分支、未提交文件)
- 依赖状态
- 运行状态

#### AiDialog.tsx
**职责:**
- AI 对话界面
- 实时流式输出
- 历史记录管理

**特性:**
- SSE 连接管理
- 消息去重
- 自动滚动
- Markdown 渲染

#### MarkdownRenderer.tsx
**职责:**
- 渲染 Markdown 内容
- 代码语法高亮
- 复制代码功能

**支持特性:**
- GitHub Flavored Markdown
- 代码块高亮 (react-syntax-highlighter)
- 表格、列表、引用
- 自定义样式

## 数据流

### 1. 项目状态查询流程

```
用户操作
    ↓
前端组件 (ProjectCard)
    ↓ HTTP GET /api/projects/:name/status
后端路由 (server.js)
    ↓
checkProjectStatus()
    ↓ execPromise (git, file system)
系统资源
    ↓ 状态数据
后端路由
    ↓ JSON Response
前端组件
    ↓ setState
UI 更新
```

### 2. AI 对话流程

```
用户输入 Prompt
    ↓
AiDialog 组件
    ↓ HTTP POST /api/projects/:name/ai
后端路由
    ↓
claudeCodeManager.execute()
    ↓
Claude Agent SDK
    ↓ Async Generator (for await...of)
Message Stream
    ↓ EventEmitter
SSE 路由
    ↓ text/event-stream
前端 EventSource
    ↓ onmessage
MarkdownRenderer
    ↓
实时 UI 更新
```

### 3. 进程管理流程

```
启动按钮点击
    ↓
前端组件
    ↓ HTTP POST /api/projects/:name/start
后端路由
    ↓
startupDetector.detect()
    ↓
processManager.start()
    ↓
spawn (child_process)
    ↓ stdout/stderr
EventEmitter
    ↓ log:${name} 事件
SSE 路由监听
    ↓ text/event-stream
前端 EventSource
    ↓ onmessage
LogViewer 组件
    ↓
日志显示
```

## API 设计

### RESTful API 原则

1. **资源导向**: URL 表示资源,动词表示操作
2. **无状态**: 每个请求独立,不依赖服务器状态
3. **统一接口**: 使用标准 HTTP 方法
4. **分层系统**: 前端不关心后端实现细节

### API 设计模式

#### 1. 项目资源
```
GET    /api/projects              # 获取所有项目
GET    /api/projects/:name/status # 获取项目状态
PUT    /api/projects              # 更新配置
POST   /api/projects/:name/action # 执行操作
```

#### 2. 进程资源
```
POST   /api/projects/:name/start       # 启动服务
POST   /api/projects/:name/stop        # 停止服务
GET    /api/projects/:name/running     # 获取状态
GET    /api/projects/:name/logs/stream # SSE 日志流
```

#### 3. AI 资源
```
POST   /api/projects/:name/ai                  # 创建会话
GET    /api/projects/:name/ai/stream/:sessionId # SSE 输出流
POST   /api/projects/:name/ai/terminate/:sessionId # 终止会话
GET    /api/projects/:name/ai/history          # 历史记录
```

### 错误处理

统一的错误响应格式:

```json
{
  "error": "错误类型",
  "message": "详细错误信息"
}
```

HTTP 状态码使用:
- 200: 成功
- 400: 请求错误
- 404: 资源不存在
- 500: 服务器错误

## 状态管理

### 前端状态管理

采用 React Hooks 进行状态管理:

```typescript
// 本地状态
const [projects, setProjects] = useState<Project[]>([]);
const [filter, setFilter] = useState<string>('all');

// 副作用
useEffect(() => {
  loadProjects();
}, []);

// 引用
const outputRef = useRef<HTMLDivElement>(null);
```

**优点:**
- 简单直接,无需额外库
- 类型安全
- 易于测试

### 后端状态管理

#### 进程状态
```javascript
// 使用 Map 存储进程信息
this.processes = new Map();
// key: projectName
// value: ChildProcess
```

#### AI 会话状态
```javascript
// 使用 Map 存储会话
this.sessions = new Map();
// key: sessionId
// value: { query, logs, startTime, projectName }
```

#### 历史记录持久化
```javascript
// 内存 Map
this.history = new Map();

// 文件持久化
saveHistoryToFile() {
  const historyObj = Object.fromEntries(this.history);
  fs.writeFileSync('ai-history.json', JSON.stringify(historyObj));
}

loadHistoryFromFile() {
  const historyData = JSON.parse(fs.readFileSync('ai-history.json'));
  this.history = new Map(Object.entries(historyData));
}
```

## 安全性考虑

### 1. 文件系统安全

**路径验证:**
```javascript
// 检查路径是否在允许的范围内
function isPathSafe(projectPath, allowedRoot) {
  const resolved = path.resolve(projectPath);
  return resolved.startsWith(allowedRoot);
}
```

**敏感信息保护:**
- `.gitignore` 排除 `.env`, `ai-history.json`
- 不提交 API 密钥
- 用户配置文件不上传

### 2. CORS 配置

```javascript
app.use(cors()); // 开发环境

// 生产环境建议配置白名单
app.use(cors({
  origin: 'https://yourdomain.com'
}));
```

### 3. 输入验证

```javascript
// 验证项目名称
if (!name || typeof name !== 'string') {
  return res.status(400).json({ error: '无效的项目名称' });
}

// 验证命令
if (action && !ALLOWED_ACTIONS.includes(action)) {
  return res.status(400).json({ error: '不允许的操作' });
}
```

## 性能优化

### 1. 前端优化

**组件优化:**
```typescript
// 避免不必要的重新渲染
const memoizedComponent = useMemo(() => <Component />, [deps]);

// 防抖处理
const debouncedSearch = debounce(searchProjects, 300);
```

**懒加载:**
```typescript
// Vite 自动代码分割
const AiDialog = lazy(() => import('./components/AiDialog'));
```

### 2. 后端优化

**并发处理:**
```javascript
// 批量状态检查使用 Promise.all
const statusPromises = projectNames.map(name =>
  checkProjectStatus(name)
);
const results = await Promise.all(statusPromises);
```

**日志缓存:**
```javascript
// 限制缓存大小
if (this.logs.get(name).length > 1000) {
  this.logs.get(name).shift();
}
```

### 3. 网络优化

**SSE 连接复用:**
- 一个会话一个 SSE 连接
- 连接断开自动清理

**响应压缩:**
```javascript
const compression = require('compression');
app.use(compression());
```

## 扩展性设计

### 1. 插件系统 (规划中)

```javascript
class PluginManager {
  plugins = [];

  register(plugin) {
    this.plugins.push(plugin);
    plugin.init(this.context);
  }

  executeHook(hookName, ...args) {
    this.plugins.forEach(plugin => {
      if (plugin.hooks[hookName]) {
        plugin.hooks[hookName](...args);
      }
    });
  }
}
```

### 2. 多项目类型支持

通过配置化实现:

```javascript
const PROJECT_TYPES = {
  'node': {
    detector: (path) => hasFile(path, 'package.json'),
    startCommand: 'npm run dev'
  },
  'python': {
    detector: (path) => hasFile(path, 'requirements.txt'),
    startCommand: 'python app.py'
  }
  // 可扩展...
};
```

### 3. 自定义工具集成

```javascript
// 支持用户自定义工具
const customTools = [
  {
    name: 'lint',
    command: 'npm run lint',
    icon: '🔍'
  }
];
```

## 未来优化方向

### 短期 (1-3 个月)
- [ ] 添加单元测试
- [ ] 添加 E2E 测试
- [ ] 优化错误处理
- [ ] 添加日志级别控制

### 中期 (3-6 个月)
- [ ] 插件系统
- [ ] Docker 支持
- [ ] 多语言支持 (i18n)
- [ ] 性能监控面板

### 长期 (6-12 个月)
- [ ] 分布式部署支持
- [ ] 云端配置同步
- [ ] 团队协作功能
- [ ] 项目模板市场

---

**最后更新**: 2025-11-27
**维护者**: Project Manager Team

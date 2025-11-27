# 贡献指南 Contributing Guide

首先,感谢你考虑为 Project Manager 做出贡献!🎉

以下是一些指南,帮助你了解如何参与项目贡献。

## 📋 目录

- [行为准则](#行为准则)
- [我能做什么贡献?](#我能做什么贡献)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)
- [问题反馈](#问题反馈)

## 行为准则

本项目采用 [Contributor Covenant](https://www.contributor-covenant.org/) 行为准则。参与本项目即表示你同意遵守其条款。

简而言之:
- 尊重所有贡献者
- 使用友善和包容的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评

## 我能做什么贡献?

### 🐛 报告 Bug

发现 Bug?请通过 [GitHub Issues](../../issues) 报告,并包含以下信息:

- Bug 的详细描述
- 重现步骤
- 预期行为 vs 实际行为
- 环境信息(Node.js 版本、操作系统等)
- 如果可能,提供截图或错误日志

### 💡 功能建议

有好的想法?我们很乐意听取!请创建一个 Issue 并标注 `enhancement`,说明:

- 功能的详细描述
- 使用场景
- 期望的实现方式(可选)
- 相关的截图或示例(可选)

### 📖 改进文档

文档永远可以更好!你可以:

- 修正拼写或语法错误
- 改进说明的清晰度
- 添加更多示例
- 翻译文档

### 💻 代码贡献

准备好动手了?查看 [Good First Issues](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) 开始。

## 开发流程

### 1. Fork 并克隆仓库

```bash
# Fork 项目后克隆到本地
git clone https://github.com/your-username/project-manager.git
cd project-manager

# 添加上游仓库
git remote add upstream https://github.com/original-owner/project-manager.git
```

### 2. 创建分支

```bash
# 从 main 分支创建新分支
git checkout -b feature/your-feature-name

# 或者修复 bug
git checkout -b fix/bug-description
```

分支命名规范:
- `feature/` - 新功能
- `fix/` - Bug 修复
- `docs/` - 文档更新
- `refactor/` - 代码重构
- `test/` - 测试相关
- `chore/` - 构建/工具相关

### 3. 安装依赖

```bash
# 安装所有依赖
npm run install:all
```

### 4. 开发

```bash
# 启动开发服务器
npm run dev

# 前端: http://localhost:5173
# 后端: http://localhost:9999
```

### 5. 测试

确保你的更改通过所有测试:

```bash
# 运行测试(如果有)
npm test

# 类型检查
npm run type-check

# 代码检查
npm run lint
```

### 6. 提交更改

遵循我们的[提交规范](#提交规范):

```bash
git add .
git commit -m "feat: add awesome feature"
```

### 7. 同步上游

在提交 PR 前,同步上游更改:

```bash
git fetch upstream
git rebase upstream/main
```

### 8. 推送并创建 Pull Request

```bash
git push origin feature/your-feature-name
```

然后在 GitHub 上创建 Pull Request。

## 代码规范

### 通用原则

我们遵循以下编程原则:

- **KISS** (Keep It Simple) - 保持简单
- **YAGNI** (You Aren't Gonna Need It) - 只实现必需功能
- **DRY** (Don't Repeat Yourself) - 不要重复
- **SOLID** - 面向对象设计原则

### 具体规范

#### 文件大小
- TypeScript/JavaScript 文件不超过 **200 行**
- 如果文件过长,考虑拆分成多个模块

#### 命名规范
- **文件名**: 使用 PascalCase (组件) 或 camelCase (工具函数)
  - ✅ `ProjectCard.tsx`
  - ✅ `api.ts`
  - ❌ `project_card.tsx`

- **变量/函数**: camelCase
  - ✅ `const projectStatus = ...`
  - ✅ `function getProjectInfo() { }`

- **常量**: UPPER_SNAKE_CASE
  - ✅ `const API_BASE_URL = ...`

- **类型/接口**: PascalCase
  - ✅ `interface ProjectConfig { }`
  - ✅ `type StatusType = ...`

#### TypeScript
- 使用 TypeScript 类型检查
- 优先使用 `interface` 而非 `type`
- 避免使用 `any`,使用 `unknown` 代替
- 导出公共接口和类型

```typescript
// ✅ 好的示例
interface Project {
  name: string;
  path: string;
  status: 'active' | 'production' | 'archived';
}

function getProject(name: string): Project | null {
  // ...
}

// ❌ 避免
function getProject(name: any): any {
  // ...
}
```

#### React 组件
- 使用函数式组件和 Hooks
- Props 使用 TypeScript 接口定义
- 组件导出使用 `export default`

```typescript
interface Props {
  name: string;
  onAction: (action: string) => void;
}

export default function ProjectCard({ name, onAction }: Props) {
  // ...
}
```

#### 注释
- 复杂逻辑需要添加注释
- 使用 JSDoc 注释公共 API

```typescript
/**
 * 检查项目状态
 * @param projectPath - 项目路径
 * @returns 项目状态对象
 */
async function checkProjectStatus(projectPath: string): Promise<ProjectStatus> {
  // ...
}
```

## 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式(不影响功能)
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

### 示例

```bash
# 新功能
git commit -m "feat(ai): add chat history persistence"

# Bug 修复
git commit -m "fix(api): resolve CORS issue in production"

# 文档
git commit -m "docs(readme): update installation steps"

# 重构
git commit -m "refactor(server): extract route handlers"

# 更详细的提交
git commit -m "feat(ui): add dark mode support

- Add theme toggle button
- Implement dark color scheme
- Save preference to localStorage

Closes #123"
```

## Pull Request 流程

### 创建 PR 前检查清单

- [ ] 代码符合项目规范
- [ ] 已运行测试并通过
- [ ] 已添加必要的注释和文档
- [ ] 已从 `main` 分支 rebase 最新代码
- [ ] 提交消息符合规范

### PR 描述模板

```markdown
## 描述

[简要描述这个 PR 的目的和改动]

## 类型

- [ ] Bug 修复
- [ ] 新功能
- [ ] 重构
- [ ] 文档更新
- [ ] 其他:

## 相关 Issue

Closes #[issue number]

## 改动内容

- 改动点 1
- 改动点 2
- 改动点 3

## 测试

[描述如何测试这些改动]

## 截图(如果适用)

[添加截图]

## 检查清单

- [ ] 代码符合项目规范
- [ ] 已添加必要的测试
- [ ] 文档已更新
- [ ] 所有测试通过
- [ ] PR 标题符合 Conventional Commits 规范
```

### 审查流程

1. 提交 PR 后,维护者会进行代码审查
2. 可能会要求修改
3. 解决所有反馈后,PR 会被合并

## 问题反馈

### 如何提出好的 Bug 报告?

**好的 Bug 报告**包含:

- **清晰的标题** - 简洁描述问题
- **详细的描述** - 你期望看到什么?实际发生了什么?
- **重现步骤** - 如何触发这个 Bug?
- **环境信息** - Node.js 版本、操作系统等
- **相关日志** - 错误消息、控制台输出
- **截图** - 如果涉及 UI 问题

### Issue 标签说明

- `bug` - 确认的 Bug
- `enhancement` - 功能请求
- `good first issue` - 适合新手的 Issue
- `help wanted` - 需要帮助
- `documentation` - 文档相关
- `question` - 问题咨询

## 开发环境设置

### 推荐工具

- **编辑器**: VS Code
- **插件**:
  - ESLint
  - Prettier
  - TypeScript
  - GitLens

### VS Code 配置

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## 获取帮助

遇到问题?

- 查看 [README](README.md)
- 搜索现有 [Issues](../../issues)
- 创建新 Issue 询问
- 加入讨论(如果有社区渠道)

## 许可证

贡献代码即表示你同意你的贡献将采用 [MIT License](LICENSE) 授权。

---

再次感谢你的贡献!🚀 每一个贡献都让这个项目变得更好。

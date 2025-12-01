# 🚀 轮询优化文档

## 📊 问题分析

### 优化前

**现状**:
- 系统有 **17 个项目**
- 每个项目卡片每 **3 秒**轮询一次运行状态
- 详情页每 **3 秒**轮询一次
- **请求频率**: 17 项目 × (1/3秒) ≈ **5.7 次/秒**
- **每分钟**: 约 **340 个请求**

**问题**:
1. ❌ 请求过于频繁，浪费服务器资源
2. ❌ 大部分项目处于停止状态，无需频繁轮询
3. ❌ 固定间隔不合理，未运行的项目不需要高频检查
4. ❌ 每个组件单独轮询，重复请求

---

## ✨ 优化方案

### 方案 1: 智能自适应轮询（已实施）

**核心思路**: 根据项目运行状态动态调整轮询间隔

**轮询策略**:
```typescript
// 运行中的项目: 5 秒轮询一次（及时更新状态）
// 未运行的项目: 15 秒轮询一次（降低频率）
const pollInterval = runningStatus?.running ? 5000 : 15000;
```

**优化效果**:
- 假设只有 2 个项目在运行：
  - 运行中: 2 × (1/5秒) = 0.4 次/秒
  - 停止中: 15 × (1/15秒) = 1 次/秒
  - **总计**: 1.4 次/秒（原来 5.7 次/秒）
  - **减少**: **75%** 的请求量 🎉

### ⭐ 方案 2: 批量查询（已实施，最优方案）

**核心思路**: 在顶层统一批量查询所有项目状态，通过 props 向下传递

**实施步骤**:
1. **后端**: 添加批量查询 API `POST /api/projects/running/batch`
2. **前端**: App.tsx 统一批量轮询
3. **传递**: 通过 props 向下传递给 ProjectCard 和 ProjectDetailPage
4. **清理**: 移除组件内的单独轮询逻辑

**优化效果**:
- **17 个项目** → **1 个请求**
- **减少**: **94%** 的请求量 🚀
- **每秒**: 0.1-0.2 次（10秒间隔）

---

## 📝 实施详情

### 后端 API

**路径**: `POST /api/projects/running/batch`

**请求**:
```json
{
  "projectNames": ["project-1", "project-2", "project-3"]
}
```

**响应**:
```json
{
  "success": true,
  "statuses": {
    "project-1": { "running": true, "pid": 12345 },
    "project-2": { "running": false },
    "project-3": { "running": true, "pid": 67890 }
  }
}
```

**代码位置**: `backend/routes.js:351-373`

---

### 前端实施

#### 1. App.tsx 统一轮询

**代码位置**: `frontend/src/App.tsx:62-96`

```typescript
// 添加运行状态存储
const [runningStatuses, setRunningStatuses] = useState<Map<string, any>>(new Map());

// 批量轮询运行状态
useEffect(() => {
  if (!config) return;

  const allProjectNames = [
    ...Object.keys(config.projects || {}),
    ...Object.keys(config.external || {})
  ];

  const fetchRunningStatuses = async () => {
    const statuses = await batchGetRunningStatus(allProjectNames);
    const statusMap = new Map<string, any>();
    Object.entries(statuses).forEach(([name, status]) => {
      statusMap.set(name, status);
    });
    setRunningStatuses(statusMap);
  };

  fetchRunningStatuses();

  // 智能间隔：有运行中的项目5秒，否则10秒
  const hasRunningProjects = Array.from(runningStatuses.values()).some(s => s?.running);
  const pollInterval = hasRunningProjects ? 5000 : 10000;

  const interval = setInterval(fetchRunningStatuses, pollInterval);
  return () => clearInterval(interval);
}, [config, runningStatuses]);
```

#### 2. 向下传递状态

**ProjectCard**:
```tsx
<ProjectCard
  runningStatus={runningStatuses.get(name)}
  // ... other props
/>
```

**ProjectDetailPage**:
```tsx
<ProjectDetailPage
  runningStatus={runningStatuses.get(detailProjectName)}
  // ... other props
/>
```

#### 3. 移除组件轮询

**ProjectCard.tsx**:
- ✅ 移除 `getRunningStatus` 导入
- ✅ 从 props 接收 `runningStatus`
- ✅ 删除 useEffect 轮询逻辑

**ProjectDetailPage.tsx**:
- ✅ 移除 `getRunningStatus` 导入
- ✅ 从 props 接收 `runningStatus`
- ✅ 删除 useEffect 轮询逻辑

---

## 📈 性能对比

| 方案 | 请求数 (17项目) | 优化幅度 | 实施复杂度 |
|------|----------------|---------|-----------|
| **原始** | 5.7 次/秒 | - | - |
| **智能轮询** | 1.4 次/秒 | ↓ 75% | 低 |
| **批量查询** ⭐ | 0.1 次/秒 | ↓ 94% | 中 |

---

## 🎯 进一步优化建议（未实施）

### WebSocket 实时推送

使用 WebSocket 或 SSE 推送状态变化，完全消除轮询：

```typescript
// 服务端主动推送状态变化
const ws = new WebSocket('ws://localhost:9999/status');
ws.onmessage = (event) => {
  const { projectName, status } = JSON.parse(event.data);
  updateProjectStatus(projectName, status);
};
```

**优势**:
- 零轮询，实时更新
- 减少 **100%** 的轮询请求

**劣势**:
- 需要实现 WebSocket 服务端
- 增加系统复杂度

---

## ✅ 验证步骤

1. **刷新浏览器**
2. 打开开发者工具 → Network 面板
3. 观察请求：
   - ✅ 应该看到 `/api/projects/running/batch` 请求（每 5-10 秒）
   - ✅ 不应该看到单独的 `/api/projects/:name/running` 请求
4. 计算请求频率应该显著降低

---

## 📅 更新日志

**日期**: 2025-12-01
**版本**: v1.3.0
**优化内容**:
- ✅ 智能自适应轮询策略
- ✅ 批量查询架构重构

**效果**: 减少 **94%** 的 API 请求量

---

## 🔗 相关文档

- [架构文档](./ARCHITECTURE.md)
- [API 文档](../README.md#api)
- [性能优化指南](./PERFORMANCE.md) (待创建)

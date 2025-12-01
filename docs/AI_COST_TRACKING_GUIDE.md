# AI 使用日志和费用追踪功能说明

## ✨ 功能概述

CCMage 项目管理系统新增了完整的 AI 使用日志和费用追踪功能，可以精确记录每次 AI 对话的 Token 使用情况和产生的费用。

## 📊 核心功能

### 1. 自动记录 AI 使用情况

系统会自动记录以下信息：
- **Token 统计**: 输入/输出 token 数量、缓存创建/读取 token
- **费用计算**: 精确计算每次对话的成本（美元）
- **会话信息**: 模型名称、引擎类型、执行时长
- **统计指标**: 消息数、工具调用次数、成功/失败状态

### 2. 支持的 AI 引擎

#### Claude Code
- Claude Sonnet 4.5: $3/MTok (输入), $15/MTok (输出)
- Claude Sonnet 4.0: $3/MTok (输入), $15/MTok (输出)
- Claude Opus 4.0: $15/MTok (输入), $75/MTok (输出)
- 缓存: 写入 $3.75/MTok, 读取 $0.30/MTok

#### OpenAI Codex
- 默认定价: $0.10/MTok (输入), $0.30/MTok (输出)

## 🔌 API 端点

### 获取 AI 使用统计

```http
GET /api/ai/stats?project_name=my-project&limit=50
```

**查询参数:**
- `project_name`: 项目名称筛选
- `engine`: AI 引擎 (claude-code/codex)
- `date_from`: 开始日期 (ISO 8601)
- `date_to`: 结束日期 (ISO 8601)
- `limit`: 限制返回数量 (默认 100)

**响应示例:**
```json
{
  "success": true,
  "data": [
    {
      "session_id": "claude-code-my-project-1234567890",
      "project_name": "my-project",
      "engine": "claude-code",
      "model": "claude-sonnet-4-5-20250929",
      "status": "completed",
      "duration_ms": 15234,
      "input_tokens": 1250,
      "output_tokens": 3420,
      "total_tokens": 4670,
      "total_cost_usd": 0.055,
      "total_cost_formatted": "$0.0550",
      "started_at": "2025-01-15T10:30:00Z"
    }
  ],
  "filters": {...}
}
```

### 获取费用汇总

```http
GET /api/ai/cost-summary?project_name=my-project
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "total_sessions": 25,
    "total_input_tokens": 31250,
    "total_output_tokens": 85500,
    "total_tokens": 116750,
    "total_cost": 1.375,
    "total_cost_formatted": "$1.3750",
    "avg_cost": 0.055,
    "avg_cost_formatted": "$0.0550",
    "completed_sessions": 23,
    "failed_sessions": 2,
    "success_rate": "92.00%"
  }
}
```

### 获取支持的模型和价格

```http
GET /api/ai/models?engine=claude-code
```

**响应示例:**
```json
{
  "success": true,
  "data": {
    "engine": "claude-code",
    "models": [
      {
        "model": "claude-sonnet-4-5-20250929",
        "pricing": {
          "input": 3.00,
          "output": 15.00,
          "cache_creation": 3.75,
          "cache_read": 0.30
        }
      }
    ]
  }
}
```

### 获取项目的 AI 统计

```http
GET /api/projects/my-project/ai/stats
```

返回特定项目的最近 20 次 AI 使用记录和汇总统计。

## 💾 数据库表结构

### ai_sessions 表

| 字段 | 类型 | 说明 |
|------|------|------|
| session_id | TEXT | 唯一会话标识 |
| project_name | TEXT | 关联项目名称 |
| engine | TEXT | AI 引擎 (claude-code/codex) |
| model | TEXT | 模型名称 |
| status | TEXT | 状态 (running/completed/failed) |
| input_tokens | INTEGER | 输入 token 数 |
| output_tokens | INTEGER | 输出 token 数 |
| cache_creation_tokens | INTEGER | 缓存创建 token 数 |
| cache_read_tokens | INTEGER | 缓存读取 token 数|
| total_tokens | INTEGER | 总 token 数 |
| input_cost | REAL | 输入成本 (美元) |
| output_cost | REAL | 输出成本 (美元) |
| total_cost_usd | REAL | 总费用 (美元) |
| duration_ms | INTEGER | 执行时长 (毫秒) |
| num_messages | INTEGER | 消息数 |
| num_tool_calls | INTEGER | 工具调用次数 |

## 🔄 工作流程

### 1. 会话开始
```javascript
// aiManager.js 在会话开始时创建数据库记录
db.createAISession({
  session_id,
  project_name,
  session_type: 'chat',
  engine: 'claude-code',
  prompt
});
```

### 2. 消息处理
```javascript
// 每收到一条消息，提取并累积 token 使用情况
const usage = extractTokenUsage(message);
session.tokenUsage.input_tokens += usage.input_tokens;
session.tokenUsage.output_tokens += usage.output_tokens;
```

### 3. 会话结束
```javascript
// 计算总费用并更新数据库
const costData = calculateCost(session.tokenUsage, 'claude-code', session.model);
db.updateAISession(sessionId, {
  status: 'completed',
  input_tokens: costData.input_tokens,
  output_tokens: costData.output_tokens,
  total_cost_usd: costData.total_cost_usd,
  // ... 其他字段
});
```

## 📈 使用示例

### 查看所有 AI 使用记录
```bash
curl http://localhost:9999/api/ai/stats
```

### 查看特定项目的费用统计
```bash
curl http://localhost:9999/api/projects/my-blog/ai/stats
```

### 查看本月的总费用
```bash
curl "http://localhost:9999/api/ai/cost-summary?date_from=2025-01-01"
```

## 🎯 后续扩展建议

### 前端展示组件
1. 在项目详情页添加"AI 使用统计"标签页
2. 显示费用趋势图表（按日期/项目）
3. 展示最近的 AI 会话记录
4. 提供费用预警功能

### 高级功能
1. **预算控制**: 设置每月/每项目费用上限
2. **成本优化建议**: 分析并建议使用更经济的模型
3. **使用报告**: 生成定期的使用和费用报告
4. **多用户支持**: 按用户统计 AI 使用情况

## 📝 注意事项

1. **价格更新**: AI 模型价格可能会变化，需定期更新 `aiCostCalculator.js` 中的价格配置
2. **数据迁移**: 已实现数据库自动迁移（版本 3），首次启动会自动添加新字段
3. **性能考虑**: 大量数据时建议添加日期范围限制查询
4. **精度**: 费用计算精确到小数点后 6 位

## 🔧 配置文件

### backend/aiCostCalculator.js
包含所有 AI 模型的定价配置，可根据实际情况调整。

### backend/database-schema.sql
定义了完整的 `ai_sessions` 表结构，包含所有费用追踪字段。

---

**最后更新**: 2025-01-15
**版本**: v1.3.0

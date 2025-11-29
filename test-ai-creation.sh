#!/bin/bash

# 测试 AI 项目创建 API

echo "🧪 测试 AI 项目创建路由..."
echo ""

# 测试 1: 检查路由是否正确响应
echo "📡 发送测试请求..."
curl -X POST http://localhost:9999/api/projects/create-with-ai \
  -H "Content-Type: application/json" \
  -d '{
    "description": "测试项目 - 一个简单的计数器应用",
    "projectName": "test-counter",
    "preferences": {
      "autoStart": false,
      "autoInstall": false
    }
  }' \
  -s -w "\nHTTP Status: %{http_code}\n" | head -30

echo ""
echo "✅ 测试完成！"
echo ""
echo "预期结果："
echo "- HTTP Status: 200"
echo "- 响应包含 sessionId 和 streamUrl"
echo ""
echo "如果看到 400 错误'缺少 project 参数'，说明路由仍然冲突"

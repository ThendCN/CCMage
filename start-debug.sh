#!/bin/bash

# AI 调试模式启动脚本

echo "🐛 启用 AI 调试模式..."
echo ""

# 检查 .env 文件是否存在
if [ ! -f ".env" ]; then
    echo "⚠️  .env 文件不存在，正在从 .env.example 创建..."
    cp .env.example .env
fi

# 检查是否已经有 DEBUG_AI 配置
if grep -q "DEBUG_AI" .env; then
    # 更新现有配置
    sed -i.bak 's/DEBUG_AI=.*/DEBUG_AI=true/' .env && rm -f .env.bak
    echo "✅ 已更新 DEBUG_AI=true"
else
    # 添加新配置
    echo "" >> .env
    echo "# Debug Mode" >> .env
    echo "DEBUG_AI=true" >> .env
    echo "✅ 已添加 DEBUG_AI=true"
fi

echo ""
echo "📋 当前 .env 配置:"
echo "----------------------------------------"
cat .env | grep -v "^#" | grep -v "^$"
echo "----------------------------------------"
echo ""

# 停止现有后端进程
echo "🛑 停止现有后端进程..."
pkill -f "node.*server.js" 2>/dev/null || echo "   (没有运行中的后端)"

echo ""
echo "🚀 启动带详细日志的后端服务..."
echo "   (按 Ctrl+C 停止)"
echo ""
echo "📝 详细日志已启用，你会看到:"
echo "   - [AI] 📋 系统消息详情"
echo "   - [AI] 📨 每条消息的类型和内容"
echo "   - [ProjectCreation] 完整的创建过程"
echo "   - [AI-DEBUG] 原始消息内容"
echo ""
echo "=========================================="
echo ""

# 启动后端
cd backend
node server.js

/**
 * 对话管理器 - 管理跨引擎的对话历史
 */
class ConversationManager {
  constructor() {
    // conversationId -> { messages: [], engines: Set, lastEngine, startTime }
    this.conversations = new Map();
    this.maxMessagesPerConversation = 50; // 限制历史长度
  }

  /**
   * 创建或获取对话
   */
  getOrCreateConversation(conversationId) {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, {
        messages: [],
        engines: new Set(),
        lastEngine: null,
        startTime: Date.now()
      });
      console.log(`[Conversation] ✨ 创建新对话: ${conversationId}`);
    }
    return this.conversations.get(conversationId);
  }

  /**
   * 添加用户消息
   */
  addUserMessage(conversationId, engine, prompt) {
    const conversation = this.getOrCreateConversation(conversationId);

    conversation.messages.push({
      role: 'user',
      content: prompt,
      engine,
      timestamp: Date.now()
    });

    console.log(`[Conversation] 💬 添加用户消息`);
    console.log(`[Conversation]   - conversationId: ${conversationId}`);
    console.log(`[Conversation]   - engine: ${engine}`);
    console.log(`[Conversation]   - 更新前 lastEngine: ${conversation.lastEngine || '(无)'}`);

    conversation.lastEngine = engine;
    conversation.engines.add(engine);

    console.log(`[Conversation]   - 更新后 lastEngine: ${conversation.lastEngine}`);
    console.log(`[Conversation]   - prompt: ${prompt.substring(0, 50)}...`);
    console.log(`[Conversation]   - 当前消息数: ${conversation.messages.length}`);

    // 限制历史长度
    if (conversation.messages.length > this.maxMessagesPerConversation) {
      conversation.messages = conversation.messages.slice(-this.maxMessagesPerConversation);
    }
  }

  /**
   * 添加 AI 回复
   */
  addAssistantMessage(conversationId, engine, content) {
    const conversation = this.getOrCreateConversation(conversationId);

    conversation.messages.push({
      role: 'assistant',
      content,
      engine,
      timestamp: Date.now()
    });

    console.log(`[Conversation] 🤖 添加 AI 回复`);
    console.log(`[Conversation]   - conversationId: ${conversationId}`);
    console.log(`[Conversation]   - engine: ${engine}`);
    console.log(`[Conversation]   - content: ${content.substring(0, 50)}...`);
    console.log(`[Conversation]   - 当前消息数: ${conversation.messages.length}`);

    // 限制历史长度
    if (conversation.messages.length > this.maxMessagesPerConversation) {
      conversation.messages = conversation.messages.slice(-this.maxMessagesPerConversation);
    }
  }

  /**
   * 获取对话历史（用于传递给 AI）
   */
  getHistory(conversationId, options = {}) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return [];
    }

    const {
      limit = 10,           // 最多返回多少条消息
      includeEngine = null  // 只包含特定引擎的消息
    } = options;

    let messages = conversation.messages;

    // 过滤引擎
    if (includeEngine) {
      messages = messages.filter(msg => msg.engine === includeEngine);
    }

    // 限制数量（保留最近的）
    if (messages.length > limit) {
      messages = messages.slice(-limit);
    }

    return messages;
  }

  /**
   * 获取格式化的上下文提示
   * 用于在切换引擎时提供之前的对话摘要
   */
  getContextPrompt(conversationId, currentEngine) {
    console.log(`[Conversation] 🔍 获取上下文提示`);
    console.log(`[Conversation]   - conversationId: ${conversationId}`);
    console.log(`[Conversation]   - currentEngine: ${currentEngine}`);

    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      console.log(`[Conversation] ❌ 对话不存在`);
      return null;
    }

    if (conversation.messages.length === 0) {
      console.log(`[Conversation] ❌ 对话无消息`);
      return null;
    }

    console.log(`[Conversation]   - 消息数: ${conversation.messages.length}`);
    console.log(`[Conversation]   - lastEngine: ${conversation.lastEngine}`);

    // 获取最近 5 轮对话
    const recentMessages = this.getHistory(conversationId, { limit: 10 });

    if (recentMessages.length === 0) {
      console.log(`[Conversation] ❌ 无最近消息`);
      return null;
    }

    // 检查是否切换了引擎
    const previousEngine = conversation.lastEngine;
    const isSwitchingEngine = previousEngine && previousEngine !== currentEngine;

    console.log(`[Conversation]   - previousEngine: ${previousEngine}`);
    console.log(`[Conversation]   - isSwitchingEngine: ${isSwitchingEngine}`);

    if (!isSwitchingEngine) {
      console.log(`[Conversation] ℹ️  同引擎继续，无需上下文注入`);
      return null; // 同引擎继续，不需要上下文提示
    }

    // 构建上下文提示
    const engineNames = {
      'claude-code': 'Claude Code',
      'codex': 'OpenAI Codex'
    };

    let contextPrompt = `\n\n---\n📋 **对话上下文** (之前使用 ${engineNames[previousEngine] || previousEngine})\n\n`;

    // 只包含最近 3 轮对话
    const summary = recentMessages.slice(-6).map(msg => {
      const roleLabel = msg.role === 'user' ? '👤 用户' : '🤖 AI';
      const content = msg.content.length > 200
        ? msg.content.substring(0, 200) + '...'
        : msg.content;
      return `${roleLabel}: ${content}`;
    }).join('\n\n');

    contextPrompt += summary;
    contextPrompt += `\n\n---\n\n请基于以上对话历史继续工作。\n\n`;

    console.log(`[Conversation] 🔄 生成切换引擎的上下文提示 (${previousEngine} → ${currentEngine})`);
    console.log(`[Conversation] 📝 包含 ${recentMessages.length} 条历史消息`);

    return contextPrompt;
  }

  /**
   * 清除对话
   */
  clearConversation(conversationId) {
    if (this.conversations.has(conversationId)) {
      this.conversations.delete(conversationId);
      console.log(`[Conversation] 🗑️  清除对话: ${conversationId}`);
    }
  }

  /**
   * 获取对话统计
   */
  getStats(conversationId) {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }

    return {
      messageCount: conversation.messages.length,
      engines: Array.from(conversation.engines),
      lastEngine: conversation.lastEngine,
      startTime: conversation.startTime,
      duration: Date.now() - conversation.startTime
    };
  }
}

module.exports = new ConversationManager();

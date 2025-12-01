/**
 * AI 费用计算工具
 *
 * 根据不同 AI 引擎和模型的定价计算使用费用
 *
 * 价格参考 (2025年1月):
 * - Claude Sonnet 4.5: $3/MTok (输入), $15/MTok (输出)
 * - Claude Sonnet 4.0: $3/MTok (输入), $15/MTok (输出)
 * - Claude Opus 4.0: $15/MTok (输入), $75/MTok (输出)
 * - Cache: 写入 $3.75/MTok, 读取 $0.30/MTok
 */

// 价格配置 (美元 / 百万 token)
const PRICING = {
  'claude-code': {
    'claude-sonnet-4-5-20250929': {
      input: 3.00,
      output: 15.00,
      cache_creation: 3.75,
      cache_read: 0.30
    },
    'claude-sonnet-4-20250514': {
      input: 3.00,
      output: 15.00,
      cache_creation: 3.75,
      cache_read: 0.30
    },
    'claude-opus-4-20250514': {
      input: 15.00,
      output: 75.00,
      cache_creation: 18.75,
      cache_read: 1.50
    },
    // 默认价格 (如果模型未知，使用 Sonnet 4.5 价格)
    default: {
      input: 3.00,
      output: 15.00,
      cache_creation: 3.75,
      cache_read: 0.30
    }
  },
  'codex': {
    // OpenAI Codex 价格 (示例)
    default: {
      input: 0.10,
      output: 0.30,
      cache_creation: 0,
      cache_read: 0
    }
  }
};

/**
 * 计算 token 使用费用
 * @param {Object} usage - Token 使用统计
 * @param {number} usage.input_tokens - 输入 token 数
 * @param {number} usage.output_tokens - 输出 token 数
 * @param {number} usage.cache_creation_tokens - 缓存创建 token 数
 * @param {number} usage.cache_read_tokens - 缓存读取 token 数
 * @param {string} engine - AI 引擎 (claude-code/codex)
 * @param {string} model - 模型名称
 * @returns {Object} 费用详情
 */
function calculateCost(usage, engine = 'claude-code', model = null) {
  const enginePricing = PRICING[engine] || PRICING['claude-code'];
  const modelPricing = (model && enginePricing[model]) || enginePricing.default;

  const {
    input_tokens = 0,
    output_tokens = 0,
    cache_creation_tokens = 0,
    cache_read_tokens = 0
  } = usage;

  // 计算各项费用 (token / 1,000,000 * 单价)
  const input_cost = (input_tokens / 1_000_000) * modelPricing.input;
  const output_cost = (output_tokens / 1_000_000) * modelPricing.output;
  const cache_creation_cost = (cache_creation_tokens / 1_000_000) * modelPricing.cache_creation;
  const cache_read_cost = (cache_read_tokens / 1_000_000) * modelPricing.cache_read;

  const total_cost = input_cost + output_cost + cache_creation_cost + cache_read_cost;
  const total_tokens = input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens;

  return {
    input_tokens,
    output_tokens,
    cache_creation_tokens,
    cache_read_tokens,
    total_tokens,
    input_cost: Number(input_cost.toFixed(6)),
    output_cost: Number(output_cost.toFixed(6)),
    cache_creation_cost: Number(cache_creation_cost.toFixed(6)),
    cache_read_cost: Number(cache_read_cost.toFixed(6)),
    total_cost_usd: Number(total_cost.toFixed(6)),
    // 价格详情（用于调试）
    pricing: {
      engine,
      model: model || 'default',
      rates: modelPricing
    }
  };
}

/**
 * 从 Claude SDK 消息中提取 token 使用情况
 * @param {Object} message - SDK 消息对象
 * @returns {Object} Token 使用统计
 */
function extractTokenUsage(message) {
  const usage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_tokens: 0,
    cache_read_tokens: 0
  };

  // 检查消息中的 usage 字段
  if (message && message.usage) {
    const u = message.usage;
    usage.input_tokens = u.input_tokens || 0;
    usage.output_tokens = u.output_tokens || 0;

    // 缓存 token (Claude 特有)
    if (u.cache_creation_input_tokens) {
      usage.cache_creation_tokens = u.cache_creation_input_tokens;
    }
    if (u.cache_read_input_tokens) {
      usage.cache_read_tokens = u.cache_read_input_tokens;
    }
  }

  return usage;
}

/**
 * 格式化费用显示
 * @param {number} cost - 费用金额 (美元)
 * @returns {string} 格式化的费用字符串
 */
function formatCost(cost) {
  if (cost < 0.01) {
    return `$${(cost * 1000).toFixed(4)}‰`; // 显示为千分之
  } else if (cost < 1) {
    return `$${(cost * 100).toFixed(4)}¢`; // 显示为分
  } else {
    return `$${cost.toFixed(4)}`;
  }
}

/**
 * 获取支持的模型列表
 */
function getSupportedModels(engine = 'claude-code') {
  const enginePricing = PRICING[engine];
  if (!enginePricing) return [];

  return Object.keys(enginePricing)
    .filter(key => key !== 'default')
    .map(model => ({
      model,
      pricing: enginePricing[model]
    }));
}

module.exports = {
  calculateCost,
  extractTokenUsage,
  formatCost,
  getSupportedModels,
  PRICING
};

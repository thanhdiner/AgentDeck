import { ModelPricing, BillingMode } from '../types.js';

export const seededPricing: ModelPricing[] = [
  // OpenAI
  {
    provider: 'openai',
    modelId: 'gpt-5.5',
    displayName: 'GPT-5.5 (Omni Ultimate)',
    billingMode: 'token',
    inputPer1M: 2.00,
    outputPer1M: 6.00,
    updatedAt: Date.now()
  },
  {
    provider: 'openai',
    modelId: 'gpt-5.4',
    displayName: 'GPT-5.4 (Omni Standard)',
    billingMode: 'token',
    inputPer1M: 1.00,
    outputPer1M: 3.00,
    updatedAt: Date.now()
  },
  {
    provider: 'openai',
    modelId: 'gpt-5.4-mini',
    displayName: 'GPT-5.4 Mini',
    billingMode: 'token',
    inputPer1M: 0.15,
    outputPer1M: 0.60,
    updatedAt: Date.now()
  },
  // Anthropic
  {
    provider: 'anthropic',
    modelId: 'claude-opus-4.8',
    displayName: 'Claude 4.8 Opus',
    billingMode: 'token',
    inputPer1M: 15.00,
    cachedInp: 3.75, // 25% of standard input rate
    outputPer1M: 75.00,
    updatedAt: Date.now()
  },
  {
    provider: 'anthropic',
    modelId: 'claude-sonnet-4.6',
    displayName: 'Claude 4.6 Sonnet',
    billingMode: 'token',
    inputPer1M: 3.00,
    cachedInp: 0.30, // 10% of standard input rate
    outputPer1M: 15.00,
    updatedAt: Date.now()
  },
  {
    provider: 'anthropic',
    modelId: 'claude-haiku-4.5',
    displayName: 'Claude 4.5 Haiku',
    billingMode: 'token',
    inputPer1M: 0.25,
    cachedInp: 0.03, // 12.5% of standard input rate
    outputPer1M: 1.25,
    updatedAt: Date.now()
  },
  // 9Router router configurations
  {
    provider: '9router',
    routeProvider: 'openai',
    modelId: '9router-gpt-5.5',
    displayName: '9Router GPT-5.5 Proxy',
    billingMode: 'token',
    inputPer1M: 2.10, // Slight proxy premium markup
    outputPer1M: 6.30,
    updatedAt: Date.now()
  },
  {
    provider: '9router',
    routeProvider: 'anthropic',
    modelId: '9router-sonnet-4.6',
    displayName: '9Router Claude Sonnet 4.6 Proxy',
    billingMode: 'token',
    inputPer1M: 3.15,
    cachedInp: 0.35,
    outputPer1M: 15.75,
    updatedAt: Date.now()
  },
  {
    provider: '9router',
    routeProvider: 'kimi',
    modelId: '9router-kimi-free',
    displayName: '9Router Kimi (Free)',
    billingMode: 'free',
    inputPer1M: 0,
    outputPer1M: 0,
    updatedAt: Date.now()
  },
  {
    provider: '9router',
    routeProvider: 'glm',
    modelId: '9router-glm-quota',
    displayName: '9Router GLM (Subscription Quota)',
    billingMode: 'subscription_quota',
    inputPer1M: 0,
    outputPer1M: 0,
    updatedAt: Date.now()
  }
];

export function calculateCost(
  model: ModelPricing,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number = 0
): number {
  if (model.billingMode !== 'token') {
    return 0;
  }
  const cachedCount = Math.min(inputTokens, cachedInputTokens);
  const regularInputCount = Math.max(0, inputTokens - cachedCount);
  
  const regularInputCost = (regularInputCount / 1000000) * model.inputPer1M;
  const cachedInputCost = (cachedCount / 1000000) * (model.cachedInp || 0);
  const outputCost = (outputTokens / 1000000) * model.outputPer1M;
  
  return regularInputCost + cachedInputCost + outputCost;
}

export function formatCost(cost: number, billingMode: BillingMode): string {
  switch (billingMode) {
    case 'free':
      return 'Free';
    case 'subscription_quota':
      return 'Quota-based';
    case 'unknown':
      return 'Unknown pricing';
    case 'token':
    default:
      return `$${cost.toFixed(6)}`;
  }
}

export function formatBillingRate(model: ModelPricing): string {
  switch (model.billingMode) {
    case 'free':
      return 'Free';
    case 'subscription_quota':
      return 'Quota-based';
    case 'unknown':
      return 'Unknown';
    case 'token':
    default:
      let rateStr = `In: $${model.inputPer1M.toFixed(2)}/1M, Out: $${model.outputPer1M.toFixed(2)}/1M`;
      if (model.cachedInp !== undefined) {
        rateStr += `, Cache Read: $${model.cachedInp.toFixed(2)}/1M`;
      }
      return rateStr;
  }
}

export function resolveModelRouting(selectedModelId: string, pricingList: ModelPricing[]): {
  model: ModelPricing;
  actualModel?: string;
  actualProvider?: string;
  routeProvider?: string;
} {
  if (selectedModelId === 'custom') {
    const customModel: ModelPricing = {
      provider: 'custom',
      modelId: 'custom',
      displayName: 'Custom Pricing',
      billingMode: 'token',
      inputPer1M: 3.0,
      outputPer1M: 15.0,
      updatedAt: Date.now()
    };
    return {
      model: customModel,
      actualModel: 'custom',
      actualProvider: 'custom'
    };
  }

  const model = pricingList.find(m => m.modelId === selectedModelId) || pricingList.find(m => m.modelId === 'gpt-5.5') || pricingList[0];
  
  if (model.provider === '9router') {
    let actualModel = model.modelId;
    let actualProvider = 'unknown';
    
    if (model.routeProvider === 'openai') {
      actualModel = 'gpt-5.5';
      actualProvider = 'openai';
    } else if (model.routeProvider === 'anthropic') {
      actualModel = 'claude-sonnet-4.6';
      actualProvider = 'anthropic';
    } else if (model.routeProvider === 'kimi') {
      actualModel = 'kimi-chat';
      actualProvider = 'kimi';
    } else if (model.routeProvider === 'glm') {
      actualModel = 'glm-4';
      actualProvider = 'glm';
    }
    
    return {
      model,
      actualModel,
      actualProvider,
      routeProvider: model.routeProvider
    };
  }
  
  return {
    model,
    actualModel: model.modelId,
    actualProvider: model.provider
  };
}

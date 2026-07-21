import { seededPricing, calculateCost, resolveModelRouting, formatCost } from './pricingHelper.js';
import assert from 'assert';

console.log('Running AI Model Pricing and Routing Tests...');

// 1. Resolve model routing tests
const gpt5 = resolveModelRouting('gpt-5.5', seededPricing);
assert.strictEqual(gpt5.model.modelId, 'gpt-5.5');
assert.strictEqual(gpt5.actualProvider, 'openai');
assert.strictEqual(gpt5.actualModel, 'gpt-5.5');

const routerSonnet = resolveModelRouting('9router-sonnet-4.6', seededPricing);
assert.strictEqual(routerSonnet.model.modelId, '9router-sonnet-4.6');
assert.strictEqual(routerSonnet.actualProvider, 'anthropic');
assert.strictEqual(routerSonnet.actualModel, 'claude-sonnet-4.6');
assert.strictEqual(routerSonnet.routeProvider, 'anthropic');

const routerKimi = resolveModelRouting('9router-kimi-free', seededPricing);
assert.strictEqual(routerKimi.model.billingMode, 'free');
assert.strictEqual(routerKimi.actualProvider, 'kimi');
assert.strictEqual(routerKimi.actualModel, 'kimi-chat');

// 2. Cost calculation tests
const gptPricing = seededPricing.find(m => m.modelId === 'gpt-5.5')!;
const costStandard = calculateCost(gptPricing, 1000000, 1000000, 0);
assert.strictEqual(costStandard, 2.00 + 6.00); // 8.00 USD

const sonnetPricing = seededPricing.find(m => m.modelId === 'claude-sonnet-4.6')!;
// Claude caching formula: standard input is $3.00/1M, cache read is $0.30/1M
// Let's say input is 1M, with 400k cache hits
const costCaching = calculateCost(sonnetPricing, 1000000, 500000, 400000);
// 600k regular input: (600,000 / 1,000,000) * 3.0 = 1.80
// 400k cached input: (400,000 / 1,000,000) * 0.30 = 0.12
// 500k output: (500,000 / 1,000,000) * 15.0 = 7.50
// Total cost: 1.80 + 0.12 + 7.50 = 9.42
assert.strictEqual(costCaching.toFixed(2), '9.42');

const kimiPricing = seededPricing.find(m => m.modelId === '9router-kimi-free')!;
const costFree = calculateCost(kimiPricing, 1000000, 1000000);
assert.strictEqual(costFree, 0);

// 3. Format tests
assert.strictEqual(formatCost(costFree, 'free'), 'Free');
assert.strictEqual(formatCost(5.123, 'token'), '$5.123000');

console.log('All Pricing and Routing Tests Passed successfully!');

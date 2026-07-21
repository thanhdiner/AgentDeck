import { test, run } from 'node:test';
import assert from 'node:assert';
import { processAgentInput } from './adapterRegistry.js';
import type { AgentInputPayload } from '../../shared/types.js';

// Setup common mock payload
const mockPayload = (agentType: AgentInputPayload['agentType'], attachmentsCount = 0): AgentInputPayload => {
  const attachments = Array.from({ length: attachmentsCount }, (_, i) => ({
    id: `att-${i}`,
    type: 'image' as const,
    localPath: `C:\\Users\\Mock\\attachments\\image-${i}.png`,
    mimeType: 'image/png',
    originalName: `screenshot-${i}.png`
  }));

  return {
    text: 'Hello Agent, optimize this script',
    attachments,
    paneId: 'pane-test-123',
    agentType
  };
};

test('Claude Code Adapter Conversion', () => {
  const payloadNoImage = mockPayload('claude-code', 0);
  const resultNoImage = processAgentInput(payloadNoImage);
  assert.strictEqual(resultNoImage.success, true);
  assert.strictEqual(resultNoImage.commandText, 'Hello Agent, optimize this script');
  assert.strictEqual(resultNoImage.warning, undefined);
  assert.strictEqual(resultNoImage.adapterUsed, 'Claude Code Adapter');

  const payloadWithImage = mockPayload('claude-code', 1);
  const resultWithImage = processAgentInput(payloadWithImage);
  assert.strictEqual(resultWithImage.success, true);
  assert.ok(resultWithImage.commandText.includes('Hello Agent, optimize this script'));
  assert.ok(resultWithImage.commandText.includes('[Attached Image: screenshot-0.png]'));
  assert.ok(resultWithImage.commandText.includes('file:///C:/Users/Mock/attachments/image-0.png'));
  assert.ok(resultWithImage.warning?.includes('does not support direct image preview'));
});

test('Codex CLI Adapter Conversion', () => {
  const payloadNoImage = mockPayload('codex', 0);
  const resultNoImage = processAgentInput(payloadNoImage);
  assert.strictEqual(resultNoImage.success, true);
  assert.strictEqual(resultNoImage.commandText, 'Hello Agent, optimize this script');
  assert.strictEqual(resultNoImage.warning, undefined);
  assert.strictEqual(resultNoImage.adapterUsed, 'Codex CLI Adapter');

  const payloadWithImage = mockPayload('codex', 2);
  const resultWithImage = processAgentInput(payloadWithImage);
  assert.strictEqual(resultWithImage.success, true);
  assert.ok(resultWithImage.commandText.includes('Hello Agent, optimize this script'));
  assert.ok(resultWithImage.commandText.includes('--image "C:\\Users\\Mock\\attachments\\image-0.png"'));
  assert.ok(resultWithImage.commandText.includes('--image "C:\\Users\\Mock\\attachments\\image-1.png"'));
  assert.strictEqual(resultWithImage.warning, undefined);
});

test('OpenCode Adapter Conversion', () => {
  const payloadNoImage = mockPayload('opencode', 0);
  const resultNoImage = processAgentInput(payloadNoImage);
  assert.strictEqual(resultNoImage.success, true);
  assert.strictEqual(resultNoImage.commandText, 'Hello Agent, optimize this script');
  assert.strictEqual(resultNoImage.warning, undefined);
  assert.strictEqual(resultNoImage.adapterUsed, 'OpenCode Adapter');

  const payloadWithImage = mockPayload('opencode', 1);
  const resultWithImage = processAgentInput(payloadWithImage);
  assert.strictEqual(resultWithImage.success, true);
  assert.ok(resultWithImage.commandText.includes('Hello Agent, optimize this script'));
  assert.ok(resultWithImage.commandText.includes('![screenshot-0.png](file:///C:/Users/Mock/attachments/image-0.png)'));
  assert.strictEqual(resultWithImage.warning, undefined);
});

test('Custom Adapter Fallback (Text-Only)', () => {
  const payloadNoImage = mockPayload('custom', 0);
  const resultNoImage = processAgentInput(payloadNoImage);
  assert.strictEqual(resultNoImage.success, true);
  assert.strictEqual(resultNoImage.commandText, 'Hello Agent, optimize this script');
  assert.strictEqual(resultNoImage.warning, undefined);
  assert.strictEqual(resultNoImage.adapterUsed, 'Custom Agent Adapter');

  const payloadWithImage = mockPayload('custom', 1);
  const resultWithImage = processAgentInput(payloadWithImage);
  assert.strictEqual(resultWithImage.success, true);
  assert.ok(resultWithImage.commandText.includes('Hello Agent, optimize this script'));
  assert.ok(resultWithImage.commandText.includes('"C:/Users/Mock/attachments/image-0.png"'));
});

// Run the tests explicitly if this script is executed directly
run();

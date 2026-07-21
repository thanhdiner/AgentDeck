import type { AgentInputPayload } from '../../shared/types.js';
import type { AgentCliAdapter, AdapterResult } from './baseAdapter.js';
import { ClaudeCodeAdapter } from './claudeCodeAdapter.js';
import { CodexAdapter } from './codexAdapter.js';
import { OpenCodeAdapter } from './openCodeAdapter.js';
import { AntigravityAdapter } from './antigravityAdapter.js';
import { CustomAdapter } from './customAdapter.js';

const adapters: Record<AgentInputPayload['agentType'], AgentCliAdapter> = {
  'claude-code': new ClaudeCodeAdapter(),
  'codex': new CodexAdapter(),
  'opencode': new OpenCodeAdapter(),
  'antigravity': new AntigravityAdapter(),
  'custom': new CustomAdapter()
};

export function getAdapter(agentType: AgentInputPayload['agentType']): AgentCliAdapter {
  return adapters[agentType] || adapters['custom'];
}

export function processAgentInput(payload: AgentInputPayload): AdapterResult & { adapterUsed: string } {
  const adapter = getAdapter(payload.agentType);
  console.log(`[AGENT ADAPTER] Processing payload for pane ${payload.paneId} with adapter: ${adapter.name}`);
  
  const result = adapter.process(payload);
  return {
    ...result,
    adapterUsed: adapter.name
  };
}

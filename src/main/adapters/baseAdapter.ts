import type { AgentInputPayload } from '../../shared/types.js';

export interface AdapterResult {
  success: boolean;
  commandText: string;
  warning?: string;
}

export interface AgentCliAdapter {
  id: 'claude-code' | 'codex' | 'opencode' | 'antigravity' | 'custom';
  name: string;
  supportsImages: boolean;
  
  process(payload: AgentInputPayload): AdapterResult;
}

import type { AgentInputPayload } from '../../shared/types.js';
import type { AgentCliAdapter, AdapterResult } from './baseAdapter.js';

export class AntigravityAdapter implements AgentCliAdapter {
  id = 'antigravity' as const;
  name = 'Antigravity CLI Adapter';
  supportsImages = true;

  process(payload: AgentInputPayload): AdapterResult {
    let commandText = payload.text || '';
    let warning: string | undefined;

    if (payload.attachments && payload.attachments.length > 0) {
      const pathsDesc = payload.attachments
        .map((img) => `"${img.localPath.replace(/\\/g, '/')}"`)
        .join(' ');
      
      commandText = commandText ? `${commandText} ${pathsDesc}` : pathsDesc;
    }

    return {
      success: true,
      commandText,
      warning
    };
  }
}

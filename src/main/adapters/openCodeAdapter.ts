import type { AgentInputPayload } from '../../shared/types.js';
import type { AgentCliAdapter, AdapterResult } from './baseAdapter.js';

export class OpenCodeAdapter implements AgentCliAdapter {
  id = 'opencode' as const;
  name = 'OpenCode Adapter';
  supportsImages = true;

  process(payload: AgentInputPayload): AdapterResult {
    let commandText = payload.text;

    if (payload.attachments && payload.attachments.length > 0) {
      const attachmentsDesc = payload.attachments
        .map((img) => `![${img.originalName}](file:///${img.localPath.replace(/\\/g, '/')})`)
        .join(' ');
      
      commandText = commandText ? `${commandText} ${attachmentsDesc}` : attachmentsDesc;
    }

    return {
      success: true,
      commandText
    };
  }
}

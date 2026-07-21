import type { AgentInputPayload } from '../../shared/types.js';
import type { AgentCliAdapter, AdapterResult } from './baseAdapter.js';

export class CodexAdapter implements AgentCliAdapter {
  id = 'codex' as const;
  name = 'Codex CLI Adapter';
  supportsImages = true;

  process(payload: AgentInputPayload): AdapterResult {
    let commandText = payload.text;

    if (payload.attachments && payload.attachments.length > 0) {
      const attachmentsDesc = payload.attachments
        .map((img) => `--image "${img.localPath}"`)
        .join(' ');
      
      commandText = commandText ? `${commandText} ${attachmentsDesc}` : attachmentsDesc;
    }

    return {
      success: true,
      commandText
    };
  }
}

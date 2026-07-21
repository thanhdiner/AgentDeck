import type { AgentInputPayload } from '../../shared/types.js';
import type { AgentCliAdapter, AdapterResult } from './baseAdapter.js';

export class ClaudeCodeAdapter implements AgentCliAdapter {
  id = 'claude-code' as const;
  name = 'Claude Code Adapter';
  supportsImages = false;

  process(payload: AgentInputPayload): AdapterResult {
    let commandText = payload.text;
    let warning: string | undefined;

    if (payload.attachments && payload.attachments.length > 0) {
      const attachmentsDesc = payload.attachments
        .map((img) => `[Attached Image: ${img.originalName}](file:///${img.localPath.replace(/\\/g, '/')})`)
        .join(' ');
      
      commandText = commandText ? `${commandText} ${attachmentsDesc}` : attachmentsDesc;
      warning = `Claude Code does not support direct image preview. The image has been converted to a local file path.`;
    }

    return {
      success: true,
      commandText,
      warning
    };
  }
}

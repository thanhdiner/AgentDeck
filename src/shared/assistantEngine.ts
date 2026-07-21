import { AssistantMessage, AssistantMessageId, AssistantActionKind, AssistantAction } from './types.js';

/** Recent turns only — Assist is command-oriented, not endless chat */
export const ASSISTANT_HISTORY_MAX = 24;

const DEFAULT_HELP =
  `Try Quick Actions (Status, Scan, Errors, Report), or:\n` +
  `• create task [name] - [desc]\n` +
  `• run task [name]`;

const DEFAULT_HELP_SHORT = `Same as above — Status / Scan / Errors / Report, or create/run task.`;

const LLM_NEEDED_HINT =
  `For full free-form answers, open **Settings → AI Models** and configure an LLM provider.`;

/** Offline summary for AI Explain / paste-diff prompts (no LLM required). */
export function tryOfflineDiffExplain(message: string): string | null {
  const raw = message.trim();
  if (!raw) return null;

  const looksLikeExplain =
    /giải\s*thích|giai\s*thich|explain|what\s+changed|tóm\s*tắt\s*diff|tom\s*tat\s*diff|review\s+(this\s+)?diff|những\s*thay\s*đổi|nhung\s*thay\s*doi/i.test(
      raw
    );
  const hasDiffFence = /```(?:diff)?\s*\n[\s\S]*?```/i.test(raw);
  const hasGitDiff = /\bdiff\s+--git\b/.test(raw) || /^@@\s+-\d+/m.test(raw);

  if (!looksLikeExplain && !hasDiffFence && !hasGitDiff) {
    return null;
  }
  if (!hasDiffFence && !hasGitDiff && !/```/.test(raw)) {
    // Explain request without a diff body — not something we can offline-summarize
    if (looksLikeExplain) {
      return (
        `I can summarize a git diff offline if you include the \`\`\`diff\`\`\` block.\n\n` +
        `${LLM_NEEDED_HINT}`
      );
    }
    return null;
  }

  let diffBody = raw;
  const fence = raw.match(/```(?:diff)?\s*\n([\s\S]*?)```/i);
  if (fence?.[1]) {
    diffBody = fence[1].trim();
  } else {
    const gitIdx = raw.search(/\bdiff\s+--git\b/);
    if (gitIdx >= 0) diffBody = raw.slice(gitIdx).trim();
  }

  const fileFromPrompt =
    raw.match(/(?:file|trong file)\s+`([^`]+)`/i)?.[1] ||
    raw.match(/(?:file|trong file)\s+['"]([^'"]+)['"]/i)?.[1] ||
    null;

  const paths = new Set<string>();
  for (const m of diffBody.matchAll(/^\+\+\+\s+(?:b\/)?(.+)$/gm)) {
    const p = m[1].trim();
    if (p && p !== '/dev/null') paths.add(p);
  }
  for (const m of diffBody.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)) {
    paths.add(m[2].trim());
  }
  if (fileFromPrompt) paths.add(fileFromPrompt);

  const isNewFile = /new file mode/i.test(diffBody) || /^---\s+\/dev\/null/m.test(diffBody);
  const isDeleted = /deleted file mode/i.test(diffBody) || /^\+\+\+\s+\/dev\/null/m.test(diffBody);

  let additions = 0;
  let deletions = 0;
  const sampleAdded: string[] = [];
  for (const line of diffBody.split('\n')) {
    if (/^\+[^+]/.test(line) || line === '+') {
      additions += 1;
      if (sampleAdded.length < 8 && line.length > 1) {
        sampleAdded.push(line.slice(1).trimEnd());
      }
    } else if (/^-[^-]/.test(line) || line === '-') {
      deletions += 1;
    }
  }

  const pathList = [...paths];
  const pathLabel = pathList.length ? pathList.map((p) => `\`${p}\``).join(', ') : 'unknown path';

  const lines: string[] = [];
  lines.push(`**Offline diff summary** (LLM not used):`);
  lines.push('');
  if (isNewFile) {
    lines.push(`- **Type**: new file`);
  } else if (isDeleted) {
    lines.push(`- **Type**: deleted file`);
  } else {
    lines.push(`- **Type**: modified`);
  }
  lines.push(`- **Path(s)**: ${pathLabel}`);
  lines.push(`- **Lines**: +${additions} / -${deletions}`);

  if (isNewFile && sampleAdded.length) {
    lines.push('');
    lines.push(`**What was added** (first lines):`);
    for (const s of sampleAdded) {
      if (!s) continue;
      lines.push(`- \`${s.length > 100 ? s.slice(0, 100) + '…' : s}\``);
    }
  } else if (additions || deletions) {
    lines.push('');
    lines.push(
      isNewFile
        ? `This introduces a new file with ${additions} line(s).`
        : `Net change: ${additions - deletions >= 0 ? '+' : ''}${additions - deletions} line(s).`
    );
  }

  lines.push('');
  lines.push(LLM_NEEDED_HINT);

  return lines.join('\n');
}

export type StoreContext = {
  activeWorkspaceName: string | null;
  activeWorkspacePath: string | null;
  activePaneId: string | null;
  activePaneTitle: string | null;
  tasks: {
    id: string;
    title: string;
    body: string;
    status: string;
    priority: string;
  }[];
  agentProfiles: {
    id: string;
    name: string;
    description: string;
  }[];
  runningAgentsCount: number;
  recentErrors: string[];
};

export function classifyIntent(message: string): AssistantActionKind | 'chat' {
  const msg = message.trim().toLowerCase();

  // CHECK_STATUS matches
  if (
    /^(status|trang\s*thai|check\s*status|summary|what's\s*running|dang\s*lam\s*gi)$/i.test(msg) ||
    /^(kiem\s*tra\s*trang\s*thai|xem\s*trang\s*thai)$/i.test(msg)
  ) {
    return 'check_status';
  }

  // READ_LOGS matches
  if (
    /^(error|errors|loi|debug|doc\s*log|xem\s*log|read\s*logs?|loi\s*gi\s*vay|co\s*loi\s*gi|tim\s*loi)$/i.test(msg) ||
    /\b(loi|error|exception|traceback|debug|read\s*logs?|doc\s*logs?)\b/i.test(msg)
  ) {
    return 'read_logs';
  }

  // SCAN_CONTEXT matches
  if (
    /^(scan|quet\s*context|scan\s*workspace|auto\s*scan|quet\s*du\s*an)$/i.test(msg) ||
    /\b(scan\s*workspace|quet\s*context|auto\s*scan|scan\s*du\s*an)\b/i.test(msg)
  ) {
    return 'scan_context';
  }

  // GENERATE_REPORT matches
  if (
    /^(report|bao\s*cao|tao\s*bao\s*cao|generate\s*report|review\s*report)$/i.test(msg) ||
    /\b(tao\s*bao\s*cao|generate\s*report|review\s*report)\b/i.test(msg)
  ) {
    return 'generate_report';
  }

  // CREATE_TASK matches
  if (
    /^(tao\s*task|them\s*nhiem\s*vu|create\s*task|new\s*task|add\s*task)\b/i.test(msg) ||
    /\b(tao\s*task|them\s*nhiem\s*vu|create\s*task|new\s*task|add\s*task)\b/i.test(msg)
  ) {
    return 'create_task';
  }

  // RUN_TASK matches
  if (
    /^(chay\s*task|run\s*task|thuc\s*thi|execute)\b/i.test(msg) ||
    /\b(chay\s*task|run\s*task|thuc\s*thi\s*task|execute\s*task)\b/i.test(msg)
  ) {
    return 'run_task';
  }

  // SUGGEST_AGENT matches
  if (
    /^(goi\s*y\s*agent|suggest\s*agent|agent\s*nao|dung\s*agent\s*gi)$/i.test(msg) ||
    /\b(goi\s*y\s*agent|suggest\s*agent|agent\s*nao|dung\s*agent\s*gi|chon\s*agent|recommend\s*agent)\b/i.test(msg)
  ) {
    return 'suggest_agent';
  }

  // START_WORKFLOW matches
  if (
    /^(chay\s*workflow|run\s*workflow|workflow|start\s*workflow|exec\s*workflow)\b/i.test(msg) ||
    /\b(chay\s*workflow|run\s*workflow|start\s*workflow|chay\s*quy\s*trinh|dieu\s*phoi)\b/i.test(msg)
  ) {
    return 'start_workflow';
  }

  return 'chat';
}

export function generateAssistantResponse(message: string, context: StoreContext): AssistantMessage {
  const timestamp = Date.now();
  const id = `assistant-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
  const intent = classifyIntent(message);

  let content = '';
  let action: AssistantAction | null = null;

  switch (intent) {
    case 'create_task': {
      const match = message.match(/^(?:tao\s+task|them\s+nhiem\s+vu|create\s+task|new\s+task|add\s+task)\s*(?:[-:]\s*)?(.+)$/i);
      let title = 'New Task';
      let body = '';

      if (match && match[1]) {
        const fullText = match[1].trim();
        const splitIdx = fullText.search(/[-;]/);
        if (splitIdx !== -1) {
          title = fullText.slice(0, splitIdx).trim();
          body = fullText.slice(splitIdx + 1).trim();
        } else {
          title = fullText;
        }
      }

      action = {
        kind: 'create_task',
        label: `Create task: ${title}`,
        payload: { title, body },
        executed: false
      };

      content = `I noticed you want to create a new task: "${title}". I have created the confirmation card below. Please select Confirm to add it to the list or Dismiss to cancel.`;
      break;
    }

    case 'run_task': {
      const match = message.match(/^(?:chay\s+task|run\s+task|thuc\s+thi|execute)\s*(?:[-:]\s*)?(.+)$/i);
      const query = match && match[1] ? match[1].trim().toLowerCase() : '';

      let foundTask: typeof context.tasks[0] | null = null;
      if (query) {
        foundTask = context.tasks.find((t) => t.title.toLowerCase().includes(query)) || null;
      }

      if (!foundTask) {
        foundTask = context.tasks.find((t) => t.status === 'todo' || t.status === 'review') || null;
      }

      if (foundTask) {
        action = {
          kind: 'run_task',
          label: `Run task: ${foundTask.title}`,
          payload: { taskId: foundTask.id },
          executed: false
        };
        content = `I found the task "${foundTask.title}" (ID: ${foundTask.id}) in the list. Please confirm the action card below to start execution on the active terminal.`;
      } else {
        content = `No matching task found to run. Please create a task first by typing "create task [task name]".`;
      }
      break;
    }

    case 'suggest_agent': {
      const msg = message.toLowerCase();
      let suggestions: string[] = [];

      context.agentProfiles.forEach((agent) => {
        const keywords = agent.description.toLowerCase() + ' ' + agent.name.toLowerCase();
        let matchScore = 0;

        if (msg.includes('review') || msg.includes('danh gia') || msg.includes('kiem tra')) {
          if (keywords.includes('review') || keywords.includes('critic') || keywords.includes('evaluate')) {
            matchScore += 2;
          }
        }
        if (msg.includes('deploy') || msg.includes('trien khai') || msg.includes('distribute')) {
          if (keywords.includes('deploy') || keywords.includes('dist') || keywords.includes('build')) {
            matchScore += 2;
          }
        }
        if (msg.includes('security') || msg.includes('bao mat') || msg.includes('lo hong')) {
          if (keywords.includes('security') || keywords.includes('vulnerability') || keywords.includes('audit')) {
            matchScore += 2;
          }
        }
        if (msg.includes('seo') || msg.includes('search engine') || msg.includes('toi uu')) {
          if (keywords.includes('seo') || keywords.includes('search engine') || keywords.includes('lighthouse')) {
            matchScore += 2;
          }
        }
        if (msg.includes('doc') || msg.includes('tailieu') || msg.includes('viet sach')) {
          if (keywords.includes('doc') || keywords.includes('markdown') || keywords.includes('readme')) {
            matchScore += 2;
          }
        }
        if (msg.includes('github') || msg.includes('git') || msg.includes('commit')) {
          if (keywords.includes('git') || keywords.includes('github') || keywords.includes('pr')) {
            matchScore += 2;
          }
        }

        if (matchScore > 0) {
          suggestions.push(`- **${agent.name}**: ${agent.description}`);
        }
      });

      if (suggestions.length === 0) {
        content = `Based on your request, I couldn't find a 100% matching specialized agent. Below is the list of available agents for you to choose from:\n\n` +
          context.agentProfiles.map((a) => `- **${a.name}**: ${a.description}`).join('\n');
      } else {
        content = `I recommend the following matching agents for you:\n\n` + suggestions.join('\n');
      }
      break;
    }

    case 'read_logs': {
      if (context.recentErrors && context.recentErrors.length > 0) {
        const errorBlock = context.recentErrors.map((err) => `  ${err}`).join('\n');
        content = `I detected some recent error lines in the terminal logs:\n\n\`\`\`\n${errorBlock}\n\`\`\`\n\nI have created an action card for you to open the Logs tab and view the detailed error logs.`;
      } else {
        content = `No recent errors were recorded in the terminal logs. However, you can still view the detailed logs using the action card below.`;
      }

      action = {
        kind: 'read_logs',
        label: 'Open Logs Tab',
        payload: {},
        executed: false
      };
      break;
    }

    case 'check_status': {
      const workspaceName = context.activeWorkspaceName || 'None';
      const workspacePath = context.activeWorkspacePath || 'None';
      const paneTitle = context.activePaneTitle || 'None';

      const todoTasks = context.tasks.filter((t) => t.status === 'todo').length;
      const runningTasks = context.tasks.filter((t) => t.status === 'running').length;
      const reviewTasks = context.tasks.filter((t) => t.status === 'review').length;
      const doneTasks = context.tasks.filter((t) => t.status === 'done').length;

      content = `System Status Report:\n` +
        `- **Active Workspace**: ${workspaceName} (${workspacePath})\n` +
        `- **Active Terminal**: Pane [${paneTitle}]\n` +
        `- **Running Tasks**: ${runningTasks} task${runningTasks !== 1 ? 's' : ''}\n` +
        `- **Task Statistics**: Todo: ${todoTasks} | Running: ${runningTasks} | Review: ${reviewTasks} | Done: ${doneTasks}\n` +
        `- **Active Agents**: ${context.runningAgentsCount} agent${context.runningAgentsCount !== 1 ? 's' : ''}`;
      break;
    }

    case 'scan_context': {
      action = {
        kind: 'scan_context',
        label: 'Scan workspace context',
        payload: {},
        executed: false
      };
      content = `I can scan the current project to extract the shared context (tech stack, directory structure, etc.). Please confirm the action card below.`;
      break;
    }

    case 'generate_report': {
      action = {
        kind: 'generate_report',
        label: 'Generate review report',
        payload: {},
        executed: false
      };
      content = `Do you want to generate a detailed review report for the current workspace? Click confirm to begin.`;
      break;
    }

    case 'start_workflow': {
      action = {
        kind: 'start_workflow',
        label: 'Open Workflows panel',
        payload: {},
        executed: false
      };
      content = `I noticed you want to work with automated workflows. I can help you open the Workflows panel to start an existing workflow or create a custom one. Click to confirm.`;
      break;
    }

    case 'chat':
    default: {
      // Very short / noise input → one-liner, not another help dump
      if (message.trim().length < 2) {
        content = 'Try a Quick Action, or create task [name] / run task [name].';
        break;
      }

      // AI Explain / pasted git diffs → offline summary (don't dump Quick Actions help)
      const offlineDiff = tryOfflineDiffExplain(message);
      if (offlineDiff) {
        content = offlineDiff;
        break;
      }

      content =
        `I only handle Quick Actions offline (Status, Scan, Errors, Report) and simple task commands.\n\n` +
        `${LLM_NEEDED_HINT}\n\n` +
        DEFAULT_HELP;
      break;
    }
  }

  return {
    id,
    role: 'assistant',
    content,
    action,
    timestamp
  };
}

/** Avoid spamming the same help block back-to-back in history */
export function dedupeAssistantReply(
  reply: AssistantMessage,
  previous: AssistantMessage[]
): AssistantMessage {
  const last = [...previous].reverse().find((m) => m.role === 'assistant');
  if (!last || reply.action) return reply;
  if (last.content === reply.content) {
    return { ...reply, content: DEFAULT_HELP_SHORT };
  }
  // If we already gave short dedupe, stay ultra-brief
  if (last.content === DEFAULT_HELP_SHORT && (reply.content === DEFAULT_HELP || reply.content === DEFAULT_HELP_SHORT)) {
    return { ...reply, content: '…' };
  }
  return reply;
}

export function trimAssistantHistory(messages: AssistantMessage[]): AssistantMessage[] {
  if (messages.length <= ASSISTANT_HISTORY_MAX) return messages;
  return messages.slice(messages.length - ASSISTANT_HISTORY_MAX);
}

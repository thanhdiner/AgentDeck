import { create } from 'zustand';
import { detectDangerousCommand } from '../../shared/commandSafety';
import type {
  AgentProfile,
  AgentProfileId,
  AgentRun,
  AgentRunId,
  AgentRunFileChange,
  AppSetting,
  CommandSafetyReview,
  DangerousCommandFinding,
  PermissionDecision,
  AppSettingValue,
  AppStateSnapshot,
  AppStorageInfo,
  CommandPermissionPolicy,
  DeckTask,
  PaneId,
  PaneLayout,
  Project,
  ProjectNote,
  ProjectNoteId,
  ReviewReport,
  ReviewReportId,
  RightPanelTab,
  Skill,
  SkillId,
  SplitDirection,
  TaskId,
  TaskStatus,
  TerminalLifecycleEvent,
  TerminalLogEntry,
  TerminalPaneConfig,
  Workspace,
  WorkspaceId,
  WorkspaceTemplate,
  WorkspaceTemplateId,
  AssistantMessage,
  McpClientInfo,
  AssistantMessageId,
  Workflow,
  WorkflowStep,
  WorkflowStepId,
  WorkflowId,
  WorkflowTemplate,
  WorkflowStepStatus,
  WorkflowStatus,
  ProjectRunStatus,
  RunConfig,
  ModelPricing,
  UsageLog,
  BillingMode,
  ProjectInitConfig,
  ProjectInitStep,
  McpServerConnection,
  FigmaPluginSelectionPayload,
  ReceivedFigmaSelection,
  FigmaBuildPlan,
  FigmaBuildPlanTask,
  DbConnectionConfig,
  DbColumnMetadata,
  DbTableMetadata,
  DbSchemaMetadata,
  DbAuditLog
} from '../../shared/types';

import {
  dedupeAssistantReply,
  generateAssistantResponse,
  tryOfflineDiffExplain,
  trimAssistantHistory,
  type StoreContext
} from '../utils/assistantEngine';
import { getBuiltinTemplates, createWorkflowFromTemplate as engineCreateWorkflow, advanceWorkflow, buildStepPrompt } from '../../shared/workflowEngine';
import { seededPricing, calculateCost, resolveModelRouting } from '../../shared/utils/pricingHelper';

const SCHEMA_VERSION = 2;

const now = () => Date.now();
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

// Throttled token and usage log state buffering (flushed every 400ms to eliminate UI thread starvation)
const pendingInputBytes: Record<string, { bytes: number; requests: number }> = {};
const pendingOutputBytes: Record<string, number> = {};
let tokenFlushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleTokenFlush(get: () => DeckStore, set: (fn: (state: DeckStore) => Partial<DeckStore>) => void) {
  if (tokenFlushTimer) return;
  tokenFlushTimer = setTimeout(() => {
    tokenFlushTimer = null;
    flushPendingTokens(get, set);
  }, 400);
}

function flushPendingTokens(get: () => DeckStore, set: (fn: (state: DeckStore) => Partial<DeckStore>) => void) {
  const inputs = { ...pendingInputBytes };
  const outputs = { ...pendingOutputBytes };

  for (const k of Object.keys(pendingInputBytes)) delete pendingInputBytes[k];
  for (const k of Object.keys(pendingOutputBytes)) delete pendingOutputBytes[k];

  if (Object.keys(inputs).length === 0 && Object.keys(outputs).length === 0) return;

  set((state) => {
    let nextPaneTokens = { ...state.paneTokens };
    let nextUsageLogs = [...(state.usageLogs || [])];
    let changed = false;

    for (const [paneId, data] of Object.entries(inputs)) {
      if (data.bytes <= 0 && data.requests <= 0) continue;
      changed = true;
      const current = nextPaneTokens[paneId] || { inputChars: 0, outputChars: 0, requests: 0 };
      nextPaneTokens[paneId] = {
        ...current,
        inputChars: current.inputChars + data.bytes,
        requests: current.requests + data.requests
      };
    }

    for (const [paneId, bytes] of Object.entries(outputs)) {
      if (bytes <= 0) continue;
      changed = true;
      const current = nextPaneTokens[paneId] || { inputChars: 0, outputChars: 0, requests: 0 };
      nextPaneTokens = {
        ...nextPaneTokens,
        [paneId]: {
          ...current,
          outputChars: current.outputChars + bytes
        }
      };

      const recentLogIndex = nextUsageLogs.findIndex((l) => l.paneId === paneId);
      if (recentLogIndex !== -1) {
        const log = nextUsageLogs[recentLogIndex];
        const addedOutputTokens = Math.ceil(bytes / 4);
        const newOutputTokens = log.outputTokens + addedOutputTokens;

        const pricingList = state.pricingList || seededPricing;
        const { model } = resolveModelRouting(log.selectedModel, pricingList);

        let inputRate = model.inputPer1M;
        let outputRate = model.outputPer1M;
        let cachedRate = model.cachedInp;

        if (log.selectedModel === 'custom') {
          const customInputSetting = state.appSettings.find((s) => s.key === 'agent.customInputPrice')?.value;
          const customOutputSetting = state.appSettings.find((s) => s.key === 'agent.customOutputPrice')?.value;
          inputRate = typeof customInputSetting === 'number' ? customInputSetting : 3.0;
          outputRate = typeof customOutputSetting === 'number' ? customOutputSetting : 15.0;
          cachedRate = 0;
        }

        const resolvedModel = {
          ...model,
          inputPer1M: inputRate,
          outputPer1M: outputRate,
          cachedInp: cachedRate
        };

        const newCost = calculateCost(resolvedModel, log.inputTokens, newOutputTokens, log.cachedInputTokens);

        nextUsageLogs[recentLogIndex] = {
          ...log,
          outputTokens: newOutputTokens,
          cost: newCost
        };
      }
    }

    if (!changed) return {};
    return {
      paneTokens: nextPaneTokens,
      usageLogs: nextUsageLogs
    };
  });
}

/** Same key as Settings → AI Models (LLM) */
const LLM_SETTINGS_KEY = 'agentdeck_llm_settings';

function readAgentDeckLlmSettings(): {
  provider: 'gemini' | 'openai' | 'anthropic' | 'ollama' | '9router';
  apiKey: string;
  model: string;
  baseUrl?: string;
} | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(LLM_SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      provider?: string;
      apiKey?: string;
      model?: string;
      baseUrl?: string;
    };
    const provider = (parsed.provider || '') as
      | 'gemini'
      | 'openai'
      | 'anthropic'
      | 'ollama'
      | '9router';
    if (!provider) return null;
    if (provider !== 'ollama' && !(parsed.apiKey && parsed.apiKey.trim())) return null;
    return {
      provider,
      apiKey: parsed.apiKey || '',
      model: parsed.model || '',
      baseUrl: parsed.baseUrl
    };
  } catch {
    return null;
  }
}

function buildAssistantSystemPrompt(ctx: StoreContext): string {
  const taskLines =
    ctx.tasks.length === 0
      ? '  (none)'
      : ctx.tasks
          .slice(0, 20)
          .map((t) => `  - [${t.status}] ${t.title} (${t.id})`)
          .join('\n');
  const agentLines =
    ctx.agentProfiles.length === 0
      ? '  (none)'
      : ctx.agentProfiles
          .slice(0, 15)
          .map((a) => `  - ${a.name}: ${a.description || 'no description'}`)
          .join('\n');
  const errLines =
    ctx.recentErrors.length === 0
      ? '  (none recent)'
      : ctx.recentErrors
          .slice(0, 8)
          .map((e) => `  - ${e.slice(0, 200)}`)
          .join('\n');

  return [
    'You are AgentDeck’s central assistant inside a desktop multi-agent IDE.',
    'Be concise, practical, and action-oriented. Prefer short replies.',
    'You can suggest commands the user may type: create task [name] - [desc], run task [name], status, scan, errors, report.',
    'When recommending agents, only use names from the available agents list.',
    'Do not invent file paths or terminal state you cannot see.',
    '',
    '## Live deck context',
    `Workspace: ${ctx.activeWorkspaceName || 'none'}`,
    `Path: ${ctx.activeWorkspacePath || 'n/a'}`,
    `Active pane: ${ctx.activePaneTitle || 'none'} (${ctx.activePaneId || 'n/a'})`,
    `Running agents: ${ctx.runningAgentsCount}`,
    'Tasks:',
    taskLines,
    'Agents:',
    agentLines,
    'Recent log errors:',
    errLines
  ].join('\n');
}

export const defaultPermissionPolicy: CommandPermissionPolicy = {
  mode: 'allow-safe',
  allowedCommands: [
    'dir',
    'ls',
    'pwd',
    'git status',
    'git diff',
    'npm test',
    'npm run build',
    'npm run lint',
    'npm run typecheck',
    'claude',
    'codex'
  ],
  blockedPatterns: ['rm -rf', 'del /s', 'rmdir /s', 'format ', 'diskpart', 'git reset --hard', 'git clean -fd'],
  reviewPatterns: ['git push', 'npm install', 'pnpm install', 'yarn install', 'curl ', 'wget ', 'docker compose down'],
  trustedWorkspaceIds: []
};

export const BUILTIN_AGENT_IDS = [
  'agent-claude-code',
  'agent-codex',
  'agent-grok',
  'agent-antigravity',
  'agent-shell',
  'agent-reviewer',
  'agent-reviewer-codex',
  'agent-reviewer-grok',
  'agent-reviewer-antigravity'
] as const;

/** Shared review prompt body (CLI-specific binary is prefixed in each profile). */
export const REVIEWER_PROMPT =
  'Review the changes for the task: {{taskTitle}}. Git status:\\n{{gitStatus}}';

export const defaultAgentProfiles: AgentProfile[] = [
  {
    id: 'agent-claude-code',
    name: 'Claude Code',
    providerType: 'cli',
    commandTemplate: 'claude "{{taskTitle}}" "{{taskDescription}}"',
    defaultWorkingDirectory: '{{workspacePath}}',
    environmentJson: '{}',
    permissionMode: 'unsafe-auto-run',
    systemPrompt: '',
    description: 'Run a local Claude Code agent session in the selected pane.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'agent-codex',
    name: 'Codex CLI',
    providerType: 'cli',
    commandTemplate: 'codex "{{taskTitle}}" "{{taskDescription}}"',
    defaultWorkingDirectory: '{{workspacePath}}',
    environmentJson: '{}',
    permissionMode: 'unsafe-auto-run',
    systemPrompt: '',
    description: 'Run a local Codex-style coding agent if installed on this machine.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'agent-grok',
    name: 'Grok',
    providerType: 'cli',
    commandTemplate: 'grok "{{taskTitle}}" "{{taskDescription}}"',
    defaultWorkingDirectory: '{{workspacePath}}',
    environmentJson: '{}',
    permissionMode: 'unsafe-auto-run',
    systemPrompt: '',
    description: 'Run xAI Grok agent (CLI) in the selected pane. Adjust command if your install uses a different binary.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'agent-antigravity',
    name: 'Antigravity',
    providerType: 'cli',
    commandTemplate: 'agy "{{taskTitle}}" "{{taskDescription}}"',
    defaultWorkingDirectory: '{{workspacePath}}',
    environmentJson: '{}',
    permissionMode: 'unsafe-auto-run',
    systemPrompt: '',
    description: 'Run Google Antigravity coding agent (agy) in the selected pane.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'agent-shell',
    name: 'Custom shell',
    providerType: 'cli',
    commandTemplate: '',
    defaultWorkingDirectory: '{{workspacePath}}',
    environmentJson: '{}',
    permissionMode: 'unsafe-auto-run',
    systemPrompt: '',
    description: 'Use this profile as a placeholder for custom local commands.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'agent-reviewer',
    name: 'Reviewer · Claude',
    providerType: 'cli',
    commandTemplate: `claude "${REVIEWER_PROMPT}"`,
    defaultWorkingDirectory: '{{workspacePath}}',
    environmentJson: '{}',
    permissionMode: 'unsafe-auto-run',
    systemPrompt: '',
    description: 'Code review via Claude Code CLI — git status + task context.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'agent-reviewer-codex',
    name: 'Reviewer · Codex',
    providerType: 'cli',
    commandTemplate: `codex "${REVIEWER_PROMPT}"`,
    defaultWorkingDirectory: '{{workspacePath}}',
    environmentJson: '{}',
    permissionMode: 'unsafe-auto-run',
    systemPrompt: '',
    description: 'Code review via Codex CLI — git status + task context.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'agent-reviewer-grok',
    name: 'Reviewer · Grok',
    providerType: 'cli',
    commandTemplate: `grok "${REVIEWER_PROMPT}"`,
    defaultWorkingDirectory: '{{workspacePath}}',
    environmentJson: '{}',
    permissionMode: 'unsafe-auto-run',
    systemPrompt: '',
    description: 'Code review via Grok CLI — git status + task context.',
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'agent-reviewer-antigravity',
    name: 'Reviewer · Antigravity',
    providerType: 'cli',
    commandTemplate: `agy "${REVIEWER_PROMPT}"`,
    defaultWorkingDirectory: '{{workspacePath}}',
    environmentJson: '{}',
    permissionMode: 'unsafe-auto-run',
    systemPrompt: '',
    description: 'Code review via Antigravity (agy) — git status + task context.',
    createdAt: 0,
    updatedAt: 0
  }
];

export const defaultWorkspaceTemplates: WorkspaceTemplate[] = [
  {
    id: 'template-full-stack',
    name: 'Full-stack project',
    description: 'Frontend, backend, database, Git, and agent panes.',
    paneTitles: ['Frontend', 'Backend', 'Database', 'Git', 'Agent'],
    createdAt: 0,
    updatedAt: 0
  },
  {
    id: 'template-agent-review',
    name: 'Agent review loop',
    description: 'Agent, tests, Git, and review panes.',
    paneTitles: ['Agent', 'Tests', 'Git', 'Review'],
    createdAt: 0,
    updatedAt: 0
  }
];

export const defaultSkills: Skill[] = [
  {
    id: 'skill-security',
    name: 'Security Scanner',
    description: 'Scan code for vulnerabilities and leaked secrets',
    promptTemplate: 'Scan the project codebase for security vulnerabilities, exposed credentials/secrets, and common injection patterns. Output a clean report showing severity levels, specific lines, and recommendations for remediation.',
    allowedTools: 'grep, file_view, find',
    fileScope: 'src/**/*, config/**/*',
    version: '1.0.0',
    isSystem: true,
    updatedAt: 0
  },
  {
    id: 'skill-seo',
    name: 'SEO Evaluator',
    description: 'Evaluate HTML structure, meta tags, and accessibility for SEO',
    promptTemplate: 'Analyze the HTML structure, meta tags, heading hierarchies, image alt attributes, and structural semantics to evaluate SEO compliance and accessibility. Suggest improvements where tags are missing or suboptimal.',
    allowedTools: 'file_view, browser',
    fileScope: 'public/**/*.html, src/**/*.tsx, src/**/*.html',
    version: '1.0.0',
    isSystem: true,
    updatedAt: 0
  },
  {
    id: 'skill-github',
    name: 'PR Description Generator',
    description: 'Analyze git diff and draft a detailed Pull Request description',
    promptTemplate: 'Review the git diff changes between the current branch and the main branch. Generate a clear, structured Pull Request description detailing the purpose, changes made, and self-review checklist.',
    allowedTools: 'git',
    fileScope: '',
    version: '1.0.0',
    isSystem: true,
    updatedAt: 0
  },
  {
    id: 'skill-docs',
    name: 'API Documentation Writer',
    description: 'Generate or update API references and README markdown files',
    promptTemplate: 'Scan the newly added or updated source files for export statements, class declarations, and function signatures. Create or update API documentation in markdown format, describing functions, parameters, return types, and example usages.',
    allowedTools: 'file_view, write_file',
    fileScope: 'src/**/*.ts, docs/**/*.md',
    version: '1.0.0',
    isSystem: true,
    updatedAt: 0
  },
  {
    id: 'skill-review',
    name: 'Code Reviewer',
    description: 'Evaluate code quality, performance, formatting, and style issues',
    promptTemplate: 'Perform a comprehensive code review of the modified files. Identify potential performance bottlenecks, code style inconsistencies, code duplication, and logical bugs. Provide constructive feedback with code diff examples.',
    allowedTools: 'file_view, lint',
    fileScope: 'src/**/*.ts, src/**/*.tsx, src/**/*.js',
    version: '1.0.0',
    isSystem: true,
    updatedAt: 0
  },
  {
    id: 'skill-deploy',
    name: 'Build and Deploy Verifier',
    description: 'Verify project builds, run tests, and outline deployment steps',
    promptTemplate: 'Run verification tests, compile/build the project bundle to verify there are no compilation errors, and generate a deployment verification checklist based on the build outputs.',
    allowedTools: 'npm, shell',
    fileScope: 'package.json, src/**/*',
    version: '1.0.0',
    isSystem: true,
    updatedAt: 0
  },
  {
    id: 'skill-memory',
    name: 'Context Summarizer',
    description: 'Summarize workspace context and requirements into memory files',
    promptTemplate: 'Summarize the current workspace state, active features, database schema, and project constraints into a structured project memory file (e.g. MEMORY.md) to preserve context for future agent sessions.',
    allowedTools: 'file_view, write_file',
    fileScope: 'MEMORY.md, src/**/*',
    version: '1.0.0',
    isSystem: true,
    updatedAt: 0
  }
];

const createDefaultMetadata = () => {
  const timestamp = now();
  return {
    schemaVersion: SCHEMA_VERSION,
    storageEngine: 'sqlite' as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    migratedAt: null
  };
};

const defaultState: AppStateSnapshot = {
  metadata: createDefaultMetadata(),
  workspaces: [],
  projects: [],
  activeWorkspaceId: null,
  activePaneId: null,
  tasks: [],
  skills: defaultSkills,
  removedSystemSkillIds: [],
  pinnedSkillIds: [],
  agentProfiles: defaultAgentProfiles,
  agentRuns: [],
  permissionPolicy: defaultPermissionPolicy,
  permissionRules: [],
  permissionDecisions: [],
  workspaceTemplates: defaultWorkspaceTemplates,
  projectNotes: [],
  reviewReports: [],
  appSettings: [],
  rightTab: 'tasks',
  assistantMessages: [],
  workflows: [],
  pricingList: seededPricing,
  usageLogs: [],
  mcpConnections: [],
  autoImportFigma: false,
  autoAttachFigma: false,
  autoImportMode: 'get_design_context',
  latestReceivedSelection: null,
  figmaBuildPlans: [],
  activeFigmaBuildPlanId: null,
  databaseAuditLogs: []
};

const serializeLayout = (layout: PaneLayout | null) => JSON.stringify(layout);

const parseLayout = (layoutJson: string | undefined, fallback: PaneLayout | null) => {
  if (!layoutJson) {
    return fallback;
  }

  try {
    return JSON.parse(layoutJson) as PaneLayout | null;
  } catch {
    return fallback;
  }
};

const logPathForPane = (paneId: PaneId) => `logs/${paneId}.jsonl`;

const createPane = (cwd: string, title = 'Terminal'): TerminalPaneConfig => {
  const paneId = id('pane');
  return {
    id: paneId,
    title,
    cwd,
    logPath: logPathForPane(paneId),
    createdAt: now(),
    shell: null,
    processStatus: 'new',
    lastStartedAt: null,
    lastReadyAt: null,
    lastActiveAt: null,
    lastExitedAt: null,
    lastExitCode: null,
    lastExitSignal: null
  };
};

const createPaneLayout = (paneId: PaneId): PaneLayout => ({ type: 'pane', paneId });

const createBalancedLayout = (paneIds: PaneId[], direction: SplitDirection = 'vertical'): PaneLayout | null => {
  if (paneIds.length === 0) {
    return null;
  }

  if (paneIds.length === 1) {
    return createPaneLayout(paneIds[0]);
  }

  const midpoint = Math.ceil(paneIds.length / 2);
  return {
    type: 'split',
    id: id('split'),
    direction,
    ratio: 0.5,
    first: createBalancedLayout(paneIds.slice(0, midpoint), direction === 'vertical' ? 'horizontal' : 'vertical')!,
    second: createBalancedLayout(paneIds.slice(midpoint), direction === 'vertical' ? 'horizontal' : 'vertical')!
  };
};

const findFirstPaneId = (layout: PaneLayout | null): PaneId | null => {
  if (!layout) {
    return null;
  }

  if (layout.type === 'pane') {
    return layout.paneId;
  }

  return findFirstPaneId(layout.first) ?? findFirstPaneId(layout.second);
};

const replacePaneWithSplit = (
  layout: PaneLayout,
  paneId: PaneId,
  direction: SplitDirection,
  newPaneId: PaneId
): PaneLayout => {
  if (layout.type === 'pane') {
    if (layout.paneId !== paneId) {
      return layout;
    }

    return {
      type: 'split',
      id: id('split'),
      direction,
      ratio: 0.5,
      first: layout,
      second: createPaneLayout(newPaneId)
    };
  }

  return {
    ...layout,
    first: replacePaneWithSplit(layout.first, paneId, direction, newPaneId),
    second: replacePaneWithSplit(layout.second, paneId, direction, newPaneId)
  };
};

const removePaneFromLayout = (layout: PaneLayout, paneId: PaneId): PaneLayout | null => {
  if (layout.type === 'pane') {
    return layout.paneId === paneId ? null : layout;
  }

  const first = removePaneFromLayout(layout.first, paneId);
  const second = removePaneFromLayout(layout.second, paneId);

  if (!first && !second) {
    return null;
  }

  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  return { ...layout, first, second };
};

const setSplitRatio = (layout: PaneLayout, splitId: string, ratio: number): PaneLayout => {
  if (layout.type === 'pane') {
    return layout;
  }

  if (layout.id === splitId) {
    return { ...layout, ratio: Math.min(0.8, Math.max(0.2, ratio)) };
  }

  return {
    ...layout,
    first: setSplitRatio(layout.first, splitId, ratio),
    second: setSplitRatio(layout.second, splitId, ratio)
  };
};

const appendPaneToLayout = (layout: PaneLayout | null, newPaneId: PaneId): PaneLayout => {
  if (!layout) {
    return createPaneLayout(newPaneId);
  }

  return {
    type: 'split',
    id: id('split'),
    direction: 'vertical',
    ratio: 0.68,
    first: layout,
    second: createPaneLayout(newPaneId)
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isSplitDirection = (value: unknown): value is SplitDirection => value === 'horizontal' || value === 'vertical';

const sanitizeLayout = (layout: unknown, panes: Record<PaneId, TerminalPaneConfig>): PaneLayout | null => {
  if (!isRecord(layout)) {
    return null;
  }

  if (layout.type === 'pane') {
    const paneId = typeof layout.paneId === 'string' ? layout.paneId : null;
    return paneId && panes[paneId] ? createPaneLayout(paneId) : null;
  }

  if (layout.type !== 'split') {
    return null;
  }

  const first = sanitizeLayout(layout.first, panes);
  const second = sanitizeLayout(layout.second, panes);

  if (!first && !second) {
    return null;
  }

  if (!first) {
    return second;
  }

  if (!second) {
    return first;
  }

  const ratio = typeof layout.ratio === 'number' && Number.isFinite(layout.ratio) ? layout.ratio : 0.5;
  return {
    type: 'split',
    id: typeof layout.id === 'string' && layout.id ? layout.id : id('split'),
    direction: isSplitDirection(layout.direction) ? layout.direction : 'vertical',
    ratio: Math.min(0.8, Math.max(0.2, ratio)),
    first,
    second
  };
};

const collectPaneIds = (layout: PaneLayout | null, panes?: Record<PaneId, TerminalPaneConfig>): PaneId[] => {
  if (!layout) {
    return [];
  }

  if (layout.type === 'pane') {
    return !panes || panes[layout.paneId] ? [layout.paneId] : [];
  }

  return [...collectPaneIds(layout.first, panes), ...collectPaneIds(layout.second, panes)];
};

const appendMissingPanes = (layout: PaneLayout | null, panes: Record<PaneId, TerminalPaneConfig>) => {
  const present = new Set(collectPaneIds(layout));
  return Object.keys(panes).reduce<PaneLayout | null>((nextLayout, paneId) => {
    if (present.has(paneId)) {
      return nextLayout;
    }

    present.add(paneId);
    return appendPaneToLayout(nextLayout, paneId);
  }, layout);
};

const orderedPaneIds = (workspace: Workspace) => {
  const layoutPaneIds = collectPaneIds(workspace.savedLayout ?? workspace.layout, workspace.panes);
  const seen = new Set(layoutPaneIds);
  return [...layoutPaneIds, ...Object.keys(workspace.panes).filter((paneId) => !seen.has(paneId))];
};

type LayoutPathNode = {
  layout: PaneLayout;
  parent: LayoutPathNode | null;
  isFirstChild: boolean;
};

const findPathToPane = (
  layout: PaneLayout | null,
  targetPaneId: PaneId,
  parent: LayoutPathNode | null = null,
  isFirstChild = false
): LayoutPathNode | null => {
  if (!layout) return null;
  const currentPathNode: LayoutPathNode = { layout, parent, isFirstChild };

  if (layout.type === 'pane') {
    if (layout.paneId === targetPaneId) {
      return currentPathNode;
    }
    return null;
  }

  const firstPath = findPathToPane(layout.first, targetPaneId, currentPathNode, true);
  if (firstPath) return firstPath;

  const secondPath = findPathToPane(layout.second, targetPaneId, currentPathNode, false);
  if (secondPath) return secondPath;

  return null;
};

const findBoundaryLeaf = (layout: PaneLayout, direction: 'up' | 'down' | 'left' | 'right'): PaneId => {
  if (layout.type === 'pane') {
    return layout.paneId;
  }

  if (layout.direction === 'vertical') {
    if (direction === 'left') {
      return findBoundaryLeaf(layout.second, direction);
    }
    if (direction === 'right') {
      return findBoundaryLeaf(layout.first, direction);
    }
    return findBoundaryLeaf(layout.first, direction);
  } else {
    if (direction === 'up') {
      return findBoundaryLeaf(layout.second, direction);
    }
    if (direction === 'down') {
      return findBoundaryLeaf(layout.first, direction);
    }
    return findBoundaryLeaf(layout.first, direction);
  }
};

const migrateAgentProfile = (
  profile: Partial<AgentProfile> & { command?: string; defaultTaskPrefix?: string }
): AgentProfile => {
  const timestamp = now();
  const commandTemplate =
    profile.commandTemplate ?? [profile.command, profile.defaultTaskPrefix].filter(Boolean).join(' ').trim();
  
  // Built-in agents default to unsafe-auto-run to bypass default confirmations.
  const isBuiltIn = BUILTIN_AGENT_IDS.includes(profile.id as (typeof BUILTIN_AGENT_IDS)[number]);
  const defaultMode = isBuiltIn ? 'unsafe-auto-run' : 'preview-required';

  const systemPrompt = profile.systemPrompt ?? '';

  return {
    id: profile.id ?? id('agent'),
    name: profile.name?.trim() || 'Local agent',
    providerType: profile.providerType ?? 'cli',
    commandTemplate,
    defaultWorkingDirectory: profile.defaultWorkingDirectory ?? '{{workspacePath}}',
    environmentJson: profile.environmentJson ?? '{}',
    permissionMode: isBuiltIn ? 'unsafe-auto-run' : (profile.permissionMode ?? defaultMode),
    systemPrompt,
    description: profile.description ?? '',
    createdAt: profile.createdAt ?? timestamp,
    updatedAt: profile.updatedAt ?? timestamp
  };
};

const migrateAgentRun = (
  run: Partial<AgentRun> & { agentId?: AgentProfileId; paneId?: PaneId; endedAt?: number | null },
  workspaceId: WorkspaceId | null
): AgentRun | null => {
  const agentProfileId = run.agentProfileId ?? run.agentId;
  const terminalSessionId = run.terminalSessionId ?? run.paneId;
  if (!run.id || !workspaceId || !agentProfileId || !terminalSessionId || !run.command) {
    return null;
  }

  const rawStatus = run.status as string | undefined;
  const status =
    rawStatus === 'succeeded'
      ? 'finished'
      : rawStatus === 'queued' ||
          rawStatus === 'running' ||
          rawStatus === 'finished' ||
          rawStatus === 'failed' ||
          rawStatus === 'cancelled'
        ? rawStatus
        : 'running';

  return {
    id: run.id,
    workspaceId: run.workspaceId ?? workspaceId,
    taskId: run.taskId ?? null,
    agentProfileId,
    terminalSessionId,
    command: run.command,
    status,
    startedAt: run.startedAt ?? now(),
    finishedAt: run.finishedAt ?? run.endedAt ?? null,
    logPath: run.logPath ?? logPathForPane(terminalSessionId),
    summary: run.summary ?? ''
  };
};

const templateValue = (value: string) =>
  [...value]
    .map((character) => {
      const code = character.charCodeAt(0);
      if (character === '\n') {
        return '\\n';
      }

      if (character === '\r') {
        return '';
      }

      if (character === '\t') {
        return ' ';
      }

      if (code < 32 || character === '`' || character === '$' || character === '\\' || character === '"') {
        return `\\${character}`;
      }

      return character;
    })
    .join('');

const replaceToken = (value: string, token: string, replacement: string) => value.split(token).join(replacement);

const renderCommandTemplate = (
  profile: AgentProfile,
  workspace: Workspace,
  pane: TerminalPaneConfig,
  task: DeckTask | null,
  gitStatusText = ''
) => {
  let cmd = replaceToken(
    replaceToken(
      replaceToken(
        replaceToken(
          replaceToken(profile.commandTemplate, '{{workspacePath}}', templateValue(workspace.rootPath)),
          '{{taskTitle}}',
          templateValue(task?.title ?? '')
        ),
        '{{taskDescription}}',
        templateValue(task?.body ?? '')
      ),
      '{{sessionName}}',
      templateValue(pane.title)
    ),
    '{{gitStatus}}',
    templateValue(gitStatusText)
  );

  // Clean up empty quoted arguments if task is null or empty
  if (!task || !task.title.trim()) {
    cmd = cmd.replace(/"\s*-\s*"/g, '');
    cmd = cmd.replace(/"\s*"/g, '');
    cmd = cmd.replace(/\s+/g, ' ');
  }

  cmd = cmd.trim();

  // Inject dangerous mode flags if figma auto run toggle is active
  if (localStorage.getItem('agentdeck_figma_auto_dispatch') === 'true') {
    if (cmd.startsWith('claude ') || cmd === 'claude') {
      cmd = cmd.replace(/^claude(\s|$)/, 'claude --dangerously-skip-permissions$1');
    } else if (cmd.includes(' claude ')) {
      cmd = cmd.replace(/(\s)claude(\s)/, '$1claude --dangerously-skip-permissions$2');
    }

    if (cmd.startsWith('codex ') || cmd === 'codex') {
      cmd = cmd.replace(/^codex(\s|$)/, 'codex --sandbox danger-full-access --ask-for-approval never$1');
    } else if (cmd.includes(' codex ')) {
      cmd = cmd.replace(/(\s)codex(\s)/, '$1codex --sandbox danger-full-access --ask-for-approval never$2');
    }
  }

  return cmd;
};

const createAgentRunRecord = (
  workspace: Workspace,
  agent: AgentProfile,
  pane: TerminalPaneConfig,
  task: DeckTask | null,
  command: string,
  status: AgentRun['status']
): AgentRun => ({
  id: id('run'),
  workspaceId: workspace.id,
  taskId: task?.id ?? null,
  agentProfileId: agent.id,
  terminalSessionId: pane.id,
  command,
  status,
  startedAt: now(),
  finishedAt: status === 'cancelled' || status === 'failed' ? now() : null,
  logPath: pane.logPath ?? logPathForPane(pane.id),
  summary: status === 'cancelled' ? 'Command preview was cancelled before launch.' : ''
});

const isPaneTerminalAlive = (status: TerminalPaneConfig['processStatus'] | undefined) =>
  status === 'ready' || status === 'running' || status === 'idle' || status === 'spawning';

const isPaneTerminalAcceptingInput = (status: TerminalPaneConfig['processStatus'] | undefined) =>
  status === 'ready' || status === 'running' || status === 'idle';

/**
 * Ensure the pane has a live PTY before agent CLI injection.
 * Restarts killed/restored/exited panes and waits until ready.
 * Pass forceRestart when a prior write failed despite "ready" status (PTY desync).
 */
const ensurePaneReadyForAgent = async (
  getState: () => DeckStore,
  pane: TerminalPaneConfig,
  options?: { forceRestart?: boolean; reason?: string }
): Promise<TerminalPaneConfig | null> => {
  const resolvePane = (): TerminalPaneConfig | null => {
    const state = getState();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    return workspace?.panes[pane.id] ?? null;
  };

  let current = resolvePane() ?? pane;
  const needsRestart = options?.forceRestart || !isPaneTerminalAlive(current.processStatus);

  if (needsRestart || current.processStatus === 'spawning') {
    if (needsRestart) {
      try {
        await window.agentDeck.terminalRestart({
          paneId: current.id,
          cwd: current.cwd,
          cols: 80,
          rows: 24,
          shell: current.shell ?? undefined
        });
      } catch (err) {
        console.error('[AGENT] terminalRestart failed:', err);
        return null;
      }

      getState().updatePaneLifecycle({
        paneId: current.id,
        kind: 'spawning',
        shell: current.shell,
        cwd: current.cwd,
        exitCode: null,
        signal: null,
        message: options?.reason || 'Starting terminal for agent launch.'
      });
    }

    // Wait until PTY is accepting input (not just "spawning")
    for (let attempt = 0; attempt < 50; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      current = resolvePane() ?? current;
      if (isPaneTerminalAcceptingInput(current.processStatus)) {
        // Small settle delay so the shell prompt is ready for the command
        await new Promise((resolve) => setTimeout(resolve, 150));
        return resolvePane() ?? current;
      }
    }
    return null;
  }

  return current;
};

const snapshotFromState = (state: DeckStore): AppStateSnapshot => ({
  metadata: { ...state.metadata, updatedAt: now() },
  workspaces: state.workspaces,
  projects: state.projects,
  activeWorkspaceId: state.activeWorkspaceId,
  activePaneId: state.activePaneId,
  tasks: state.tasks,
  skills: state.skills,
  removedSystemSkillIds: state.removedSystemSkillIds || [],
  pinnedSkillIds: state.pinnedSkillIds || [],
  agentProfiles: state.agentProfiles,
  agentRuns: state.agentRuns,
  permissionPolicy: state.permissionPolicy,
  permissionRules: state.permissionRules,
  permissionDecisions: state.permissionDecisions,
  workspaceTemplates: state.workspaceTemplates,
  projectNotes: state.projectNotes,
  reviewReports: state.reviewReports,
  appSettings: state.appSettings,
  rightTab: state.rightTab,
  assistantMessages: state.assistantMessages,
  workflows: state.workflows,
  pricingList: state.pricingList,
  usageLogs: state.usageLogs,
  mcpConnections: state.mcpConnections || [],
  autoImportFigma: state.autoImportFigma,
  autoAttachFigma: state.autoAttachFigma,
  autoImportMode: state.autoImportMode,
  latestReceivedSelection: state.latestReceivedSelection,
  figmaBuildPlans: state.figmaBuildPlans || [],
  activeFigmaBuildPlanId: state.activeFigmaBuildPlanId || null
});

let persistTimer: ReturnType<typeof setTimeout> | null = null;

const persist = (state: DeckStore) => {
  if (!state.loaded || !window.agentDeck) {
    return;
  }

  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(() => {
    persistTimer = null;
    void window.agentDeck.saveState(snapshotFromState(state));
  }, 250);
};

const persistImmediately = (state: DeckStore) => {
  if (!state.loaded || !window.agentDeck) {
    return;
  }

  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }

  void window.agentDeck.saveState(snapshotFromState(state));
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
      const state = useDeckStore.getState();
      if (state.loaded) {
        void window.agentDeck.saveState(snapshotFromState(state));
      }
    }
  });
}

let layoutPersistTimer: ReturnType<typeof setTimeout> | null = null;

const persistLayoutSoon = (stateProvider: () => DeckStore) => {
  if (layoutPersistTimer) {
    clearTimeout(layoutPersistTimer);
  }

  layoutPersistTimer = setTimeout(() => {
    layoutPersistTimer = null;
    persist(stateProvider());
  }, 350);
};

const mutateWorkspace = (
  workspaces: Workspace[],
  workspaceId: WorkspaceId,
  mutator: (workspace: Workspace) => Workspace
) => workspaces.map((workspace) => (workspace.id === workspaceId ? mutator(workspace) : workspace));

const projectFromWorkspace = (workspace: Workspace): Project => ({
  id: `project-${workspace.id}`,
  workspaceId: workspace.id,
  name: workspace.name,
  rootPath: workspace.rootPath,
  createdAt: workspace.createdAt,
  updatedAt: workspace.updatedAt
});

const upsertAppSetting = (settings: AppSetting[], key: string, value: AppSettingValue): AppSetting[] => [
  { key, value, updatedAt: now() },
  ...settings.filter((setting) => setting.key !== key)
];

const settingsWithStorageInfo = (settings: AppSetting[], storageInfo: AppStorageInfo | null): AppSetting[] => {
  const withoutStorage = settings.filter((setting) => setting.key !== 'storage.info');
  if (!storageInfo) {
    return withoutStorage;
  }

  return upsertAppSetting(withoutStorage, 'storage.info', storageInfo);
};

const mergeDefaults = (snapshot: AppStateSnapshot, storageInfo: AppStorageInfo | null): AppStateSnapshot => {
  const metadata = snapshot.metadata ?? createDefaultMetadata();
  const workspaces = Array.isArray(snapshot.workspaces)
    ? snapshot.workspaces.map((workspace) => {
        const panes = Object.fromEntries(
          Object.values(workspace.panes ?? {}).map((pane) => [
            pane.id,
            {
              ...pane,
              shell: pane.shell ?? null,
              logPath: pane.logPath ?? logPathForPane(pane.id),
              processStatus: 'restored' as const,
              lastStartedAt: pane.lastStartedAt ?? null,
              lastReadyAt: pane.lastReadyAt ?? null,
              lastActiveAt: pane.lastActiveAt ?? null,
              lastExitedAt: pane.lastExitedAt ?? null,
              lastExitCode: pane.lastExitCode ?? null,
              lastExitSignal: pane.lastExitSignal ?? null
            }
          ])
        );
        const parsedLayout = parseLayout(workspace.layoutJson, workspace.layout ?? null);
        const layout = appendMissingPanes(sanitizeLayout(parsedLayout, panes), panes);
        const savedLayout = sanitizeLayout(workspace.savedLayout ?? null, panes);
        return {
          ...workspace,
          path: workspace.rootPath ?? workspace.path,
          rootPath: workspace.rootPath ?? workspace.path,
          templateId: workspace.templateId ?? null,
          lastOpenedAt: workspace.lastOpenedAt ?? null,
          panes,
          layout,
          savedLayout,
          layoutJson: serializeLayout(layout),
          settingsJson: workspace.settingsJson ?? '{}',
          restoreDirectory: workspace.restoreDirectory ?? false,
          dbConnections: Array.isArray(workspace.dbConnections) ? workspace.dbConnections : [],
          paneAgentAssignments:
            workspace.paneAgentAssignments && typeof workspace.paneAgentAssignments === 'object'
              ? workspace.paneAgentAssignments
              : {}
        };
      })
    : [];
  const projects =
    Array.isArray(snapshot.projects) && snapshot.projects.length
      ? snapshot.projects
      : workspaces.map(projectFromWorkspace);

  const sanitizeSkill = (s: any): Skill => ({
    id: typeof s?.id === 'string' && s.id ? s.id : `skill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: typeof s?.name === 'string' && s.name.trim() ? s.name.trim() : 'Untitled Skill',
    description: typeof s?.description === 'string' ? s.description : '',
    promptTemplate:
      typeof s?.promptTemplate === 'string'
        ? s.promptTemplate
        : typeof s?.prompt === 'string'
          ? s.prompt
          : '',
    allowedTools: typeof s?.allowedTools === 'string' ? s.allowedTools : '',
    fileScope: typeof s?.fileScope === 'string' ? s.fileScope : '',
    version: typeof s?.version === 'string' && s.version.trim() ? s.version.trim() : '1.0.0',
    isSystem: Boolean(s?.isSystem),
    category: typeof s?.category === 'string' && s.category.trim() ? s.category.trim() : undefined,
    updatedAt:
      typeof s?.updatedAt === 'number' && !isNaN(s.updatedAt) && s.updatedAt > 0
        ? s.updatedAt
        : Date.now()
  });

  const userSkills = Array.isArray(snapshot.skills)
    ? snapshot.skills.filter((s) => !s.isSystem).map(sanitizeSkill)
    : [];
  const systemSkillsInSnapshot = Array.isArray(snapshot.skills) ? snapshot.skills.filter((s) => s.isSystem) : [];
  const removedSystemSkillIds = Array.isArray(snapshot.removedSystemSkillIds)
    ? snapshot.removedSystemSkillIds
    : [];
  const removedSystemSet = new Set(removedSystemSkillIds);
  // Skip built-ins the user deleted; still pick up brand-new defaults not in the removed list
  const mergedSystemSkills = defaultSkills
    .filter((defSkill) => !removedSystemSet.has(defSkill.id))
    .map((defSkill) => {
      const existing = systemSkillsInSnapshot.find((s) => s.id === defSkill.id);
      return existing ? { ...defSkill, ...existing } : defSkill;
    });
  const skills = [...mergedSystemSkills, ...userSkills];

  return {
    ...defaultState,
    ...snapshot,
    metadata: {
      ...defaultState.metadata,
      ...metadata,
      schemaVersion: SCHEMA_VERSION,
      storageEngine: 'sqlite'
    },
    workspaces,
    projects,
    skills,
    removedSystemSkillIds,
    pinnedSkillIds: Array.isArray(snapshot.pinnedSkillIds)
      ? snapshot.pinnedSkillIds.filter((id) => typeof id === 'string')
      : [],
    tasks: Array.isArray(snapshot.tasks)
      ? snapshot.tasks.map((task) => ({
          ...task,
          agentId: task.agentId ?? null,
          priority: task.priority ?? 'medium',
          skillId: task.skillId ?? null
        }))
      : [],
    agentProfiles: (() => {
      const migrated = (snapshot.agentProfiles?.length ? snapshot.agentProfiles : []).map(migrateAgentProfile);
      if (migrated.length === 0) return defaultAgentProfiles.map(migrateAgentProfile);
      // Ensure newly shipped built-ins (Grok, Antigravity, …) appear even on old saves
      const byId = new Map(migrated.map((a) => [a.id, a]));
      for (const def of defaultAgentProfiles) {
        if (!byId.has(def.id)) {
          byId.set(def.id, migrateAgentProfile(def));
          continue;
        }
        // Patch known outdated built-in defaults
        const existing = byId.get(def.id)!;
        if (
          def.id === 'agent-antigravity' &&
          /^\s*antigravity\b/.test(existing.commandTemplate)
        ) {
          byId.set(def.id, {
            ...existing,
            commandTemplate: def.commandTemplate,
            description: def.description,
            updatedAt: now()
          });
        }
        // Rename legacy single "Agent Reviewer" → "Reviewer · Claude"
        if (def.id === 'agent-reviewer' && existing.name === 'Agent Reviewer') {
          byId.set(def.id, {
            ...existing,
            name: def.name,
            description: def.description,
            commandTemplate: def.commandTemplate,
            updatedAt: now()
          });
        }
      }
      // Keep default order for built-ins, then user-created
      const builtinIds = new Set(defaultAgentProfiles.map((a) => a.id));
      const orderedBuiltins = defaultAgentProfiles.map((d) => byId.get(d.id)!);
      const userAgents = migrated.filter((a) => !builtinIds.has(a.id));
      return [...orderedBuiltins, ...userAgents];
    })(),
    agentRuns: Array.isArray(snapshot.agentRuns)
      ? snapshot.agentRuns
          .map((run) => migrateAgentRun(run, snapshot.activeWorkspaceId ?? workspaces[0]?.id ?? null))
          .filter((run): run is AgentRun => Boolean(run))
          .map((run) => (run.status === 'running' || run.status === 'paused' ? { ...run, status: 'cancelled' as const } : run))
      : [],
    permissionPolicy: { ...defaultPermissionPolicy, ...(snapshot.permissionPolicy ?? {}) },
    permissionRules: Array.isArray(snapshot.permissionRules) ? snapshot.permissionRules : [],
    permissionDecisions: Array.isArray(snapshot.permissionDecisions) ? snapshot.permissionDecisions : [],
    workspaceTemplates: snapshot.workspaceTemplates?.length ? snapshot.workspaceTemplates : defaultWorkspaceTemplates,
    projectNotes: Array.isArray(snapshot.projectNotes) ? snapshot.projectNotes : [],
    appSettings: settingsWithStorageInfo(Array.isArray(snapshot.appSettings) ? snapshot.appSettings : [], storageInfo),
    assistantMessages: trimAssistantHistory(
      Array.isArray(snapshot.assistantMessages) ? snapshot.assistantMessages : []
    ),
    workflows: Array.isArray(snapshot.workflows) ? snapshot.workflows : [],
    pricingList: Array.isArray(snapshot.pricingList) && snapshot.pricingList.length ? snapshot.pricingList : seededPricing,
    usageLogs: Array.isArray(snapshot.usageLogs) ? snapshot.usageLogs : [],
    mcpConnections: Array.isArray(snapshot.mcpConnections) ? snapshot.mcpConnections : [],
    databaseAuditLogs: Array.isArray(snapshot.databaseAuditLogs) ? snapshot.databaseAuditLogs : []
  };
};

type PermissionEvaluation = {
  review: CommandSafetyReview;
  blocked: boolean;
  needsReview: boolean;
  action: PermissionDecision['action'];
  reason: string;
};

const commandMatchesPattern = (command: string, pattern: string) => {
  const normalized = command.trim().toLowerCase();
  const normalizedPattern = pattern.trim().toLowerCase();
  return (
    Boolean(normalizedPattern) &&
    (normalized === normalizedPattern ||
      normalized.startsWith(`${normalizedPattern} `) ||
      normalized.includes(normalizedPattern))
  );
};

const policyFindings = (policy: CommandPermissionPolicy, command: string): DangerousCommandFinding[] => [
  ...policy.blockedPatterns
    .filter((pattern) => commandMatchesPattern(command, pattern))
    .map((pattern) => ({
      id: `policy-block-${pattern}`,
      severity: 'block' as const,
      pattern,
      message: 'Blocked by the workspace command policy.'
    })),
  ...policy.reviewPatterns
    .filter((pattern) => commandMatchesPattern(command, pattern))
    .map((pattern) => ({
      id: `policy-review-${pattern}`,
      severity: 'review' as const,
      pattern,
      message: 'Requires review by the workspace command policy.'
    }))
];

const commandIsAllowed = (policy: CommandPermissionPolicy, command: string) =>
  policy.allowedCommands.some((pattern) => commandMatchesPattern(command, pattern));

const reviewCommand = (policy: CommandPermissionPolicy, command: string): CommandSafetyReview => {
  const base = detectDangerousCommand(command);
  const findings = [...base.findings, ...policyFindings(policy, command)];
  const blocked = findings.some((finding) => finding.severity === 'block');
  const risky =
    blocked || base.risky || findings.some((finding) => finding.severity === 'danger' || finding.severity === 'review');

  return {
    ...base,
    findings,
    blocked,
    risky,
    safe: !risky && (base.safe || commandIsAllowed(policy, command))
  };
};

const evaluateCommandPermission = (
  policy: CommandPermissionPolicy,
  workspaceId: WorkspaceId | null,
  command: string
): PermissionEvaluation => {
  const review = reviewCommand(policy, command);
  const trusted = Boolean(workspaceId && policy.trustedWorkspaceIds.includes(workspaceId));

  if (policy.mode === 'bypass-permissions') {
    return {
      review,
      blocked: false,
      needsReview: false,
      action: review.risky ? 'overridden' : 'allowed',
      reason: review.risky ? 'Bypass mode allowed a risky command without review.' : 'Bypass mode allowed the command.'
    };
  }

  if (review.blocked) {
    return {
      review,
      blocked: true,
      needsReview: true,
      action: 'blocked',
      reason: review.findings.find((finding) => finding.severity === 'block')?.message ?? 'Blocked by command policy.'
    };
  }

  if (policy.mode === 'workspace-trusted' && trusted) {
    return {
      review,
      blocked: false,
      needsReview: false,
      action: 'allowed',
      reason: 'Trusted workspace mode allowed the command.'
    };
  }

  if (policy.mode === 'allow-safe' && (review.safe || commandIsAllowed(policy, command))) {
    return {
      review,
      blocked: false,
      needsReview: false,
      action: 'allowed',
      reason: 'Safe command policy allowed the command.'
    };
  }

  if (policy.mode === 'workspace-trusted' && !trusted) {
    return {
      review,
      blocked: false,
      needsReview: true,
      action: 'reviewed',
      reason: 'Workspace is not trusted yet.'
    };
  }

  return {
    review,
    blocked: false,
    needsReview: true,
    action: 'reviewed',
    reason:
      policy.mode === 'ask-every-time'
        ? 'Policy requires review for every command.'
        : 'Command requires review before running.'
  };
};

const createPermissionDecision = (
  workspaceId: WorkspaceId | null,
  paneId: PaneId | null,
  command: string,
  review: CommandSafetyReview,
  action: PermissionDecision['action'],
  reason: string
): PermissionDecision => ({
  id: id('permission'),
  workspaceId,
  paneId,
  command,
  category: review.category,
  action,
  reason,
  findings: review.findings,
  createdAt: now()
});

const appendPermissionDecision = (decisions: PermissionDecision[], decision: PermissionDecision) =>
  [decision, ...decisions].slice(0, 100);

const parseTerminalLogEntries = (log: string, paneId: PaneId): TerminalLogEntry[] =>
  log
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        const entry = JSON.parse(line) as Partial<TerminalLogEntry>;
        if (
          typeof entry.timestamp === 'number' &&
          typeof entry.text === 'string' &&
          (entry.direction === 'input' || entry.direction === 'output' || entry.direction === 'system')
        ) {
          return {
            timestamp: entry.timestamp,
            sessionId: entry.sessionId ?? paneId,
            direction: entry.direction,
            text: entry.text
          } satisfies TerminalLogEntry;
        }
      } catch {
        return null;
      }

      return null;
    })
    .filter((entry): entry is TerminalLogEntry => Boolean(entry));

const readWorkspaceLogEntries = async (workspace: Workspace) => {
  const entriesByPane = await Promise.all(
    Object.keys(workspace.panes).map(async (paneId) => ({
      paneId,
      entries: parseTerminalLogEntries(await window.agentDeck.readLog(paneId), paneId)
    }))
  );

  return entriesByPane.flatMap(({ entries }) => entries).sort((first, second) => first.timestamp - second.timestamp);
};

const recentErrorLines = (entries: TerminalLogEntry[], limit = 12) =>
  entries
    .filter(
      (entry) =>
        entry.direction !== 'input' && /\b(error|failed|exception|traceback|crashed|denied|fatal)\b/i.test(entry.text)
    )
    .slice(-limit);

const markdownCode = (value: string) => ['```', value || '_None_', '```'].join('\n');

const safetyReviewSummary = (review: CommandSafetyReview) => {
  const findings = review.findings.length
    ? review.findings.map((finding) => `- ${finding.severity}: ${finding.message} (${finding.pattern})`).join('\n')
    : '- No detector findings.';
  return [`Category: ${review.category}`, `Risky: ${review.risky ? 'yes' : 'no'}`, findings].join('\n');
};

const confirmCommandReview = (pane: TerminalPaneConfig, command: string, evaluation: PermissionEvaluation) =>
  window.confirm(
    [
      `Review command before running in ${pane.title}:`,
      '',
      command,
      '',
      evaluation.reason,
      safetyReviewSummary(evaluation.review),
      '',
      'Run this command?'
    ].join('\n')
  );

const runGitCheckpointFlow = async (workspace: Workspace, review: CommandSafetyReview) => {
  if (!review.risky) {
    return { approved: true, action: null as PermissionDecision['action'] | null, reason: '' };
  }

  const gitStatus = await window.agentDeck.getGitWorkspaceStatus(workspace.rootPath);
  if (!gitStatus.isRepo) {
    const approved = window.confirm(
      [
        'This command is risky and the workspace is not a Git repository.',
        gitStatus.error ?? 'No Git status is available.',
        '',
        'Run anyway without a checkpoint?'
      ].join('\n')
    );

    return {
      approved,
      action: approved ? ('overridden' as const) : ('blocked' as const),
      reason: approved
        ? 'User overrode missing Git checkpoint for a risky command.'
        : 'Risky command blocked because the workspace is not a Git repository.'
    };
  }

  if (gitStatus.changedFiles.length === 0) {
    return {
      approved: true,
      action: null as PermissionDecision['action'] | null,
      reason: 'Risky command reviewed with a clean Git working tree.'
    };
  }

  const wantsCheckpoint = window.confirm(
    [
      'This command is risky and the workspace has uncommitted changes.',
      '',
      gitStatus.statusText,
      gitStatus.diffStat ? `\n${gitStatus.diffStat}` : '',
      '',
      'Create a checkpoint commit before running?'
    ]
      .filter(Boolean)
      .join('\n')
  );

  if (wantsCheckpoint) {
    const checkpoint = await window.agentDeck.createGitCheckpoint(workspace.rootPath);
    return {
      approved: true,
      action: null as PermissionDecision['action'] | null,
      reason: checkpoint
    };
  }

  const approved = window.confirm('Continue without a Git checkpoint for this risky command?');
  return {
    approved,
    action: approved ? ('overridden' as const) : ('cancelled' as const),
    reason: approved
      ? 'User explicitly continued without a Git checkpoint.'
      : 'Risky command cancelled before checkpoint.'
  };
};

export type DeckStore = AppStateSnapshot & {
  paneTokens: Record<string, { inputChars: number; outputChars: number; requests: number }>;
  loaded: boolean;
  loadError: string | null;
  lastPermissionNotice: string | null;
  lastExportPath: string | null;
  gitCheckpoint: string;
  workspaceLocks: Record<WorkspaceId, { paneId: PaneId; agentName: string }>;
  mcpClients: McpClientInfo[];
  loadingWorkspace: boolean;
  showFigmaImportModal: boolean;
  figmaImportSelectionPayload: FigmaPluginSelectionPayload | null;
  autoImportFigma: boolean;
  autoAttachFigma: boolean;
  autoImportMode: 'get_design_context' | 'get_file' | 'get_svg';
  latestReceivedSelection: ReceivedFigmaSelection | null;
  setShowFigmaImportModal: (open: boolean) => void;
  setFigmaImportSelectionPayload: (payload: FigmaPluginSelectionPayload | null) => void;
  setAutoImportFigma: (enabled: boolean) => void;
  setAutoAttachFigma: (enabled: boolean) => void;
  setAutoImportMode: (mode: 'get_design_context' | 'get_file' | 'get_svg') => void;
  setLatestReceivedSelection: (sel: ReceivedFigmaSelection | null) => void;
  importFigmaSelection: (payload: FigmaPluginSelectionPayload, isAuto?: boolean) => Promise<void>;
  setMcpClients: (clients: McpClientInfo[]) => void;
  setLoadingWorkspace: (loading: boolean) => void;
  hydrate: () => Promise<void>;
  createWorkspace: (templateId?: WorkspaceTemplateId | null) => Promise<void>;
  openWorkspace: (templateId?: WorkspaceTemplateId | null) => Promise<void>;
  addWorkspaceFromFolder: (folder: string, templateId?: WorkspaceTemplateId | null) => void;
  renameWorkspace: (workspaceId: WorkspaceId, name: string) => void;
  setWorkspaceColor: (workspaceId: WorkspaceId, color: string | null) => void;
  setWorkspaceNote: (workspaceId: WorkspaceId, note: string | null) => void;
  setWorkspaceRestoreDirectory: (workspaceId: WorkspaceId, restore: boolean) => void;
  deleteWorkspace: (workspaceId: WorkspaceId) => void;
  reorderWorkspaces: (sourceId: WorkspaceId, targetId: WorkspaceId) => void;
  moveWorkspace: (workspaceId: WorkspaceId, direction: 'up' | 'down') => void;
  updatePaneLifecycle: (event: TerminalLifecycleEvent) => void;
  markPaneStarted: (paneId: PaneId, shell?: string | null) => void;
  markPaneExited: (paneId: PaneId, exitCode: number | null, signal?: number | null) => void;
  selectWorkspace: (workspaceId: WorkspaceId) => void;
  selectPane: (paneId: PaneId) => void;
  focusPaneInDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
  createPane: (title?: string) => PaneId | null;
  splitPane: (paneId: PaneId, direction: SplitDirection) => PaneId | null;
  closePane: (paneId: PaneId) => void;
  closeActivePane: () => void;
  renamePane: (paneId: PaneId, title: string) => void;
  renameActivePane: () => void;
  setGridLayout: (cols: number, rows: number) => void;
  maximizePane: (paneId: PaneId) => void;
  focusNextPane: () => void;
  focusPreviousPane: () => void;
  setSplitRatio: (splitId: string, ratio: number) => void;
  setRightTab: (tab: RightPanelTab) => void;
  setAppSetting: (key: string, value: AppSettingValue) => void;
  /** Returns new task id, or null if title empty */
  createTask: (title: string, body?: string) => string | null;
  updateTask: (
    taskId: TaskId,
    patch: Partial<Pick<DeckTask, 'title' | 'body' | 'status' | 'paneId' | 'agentId' | 'priority' | 'skillId' | 'includeContext'>>
  ) => void;
  deleteTask: (taskId: TaskId) => void;
  assignTaskToPane: (taskId: TaskId, paneId: PaneId | null) => void;
  assignTaskToAgent: (taskId: TaskId, agentId: AgentProfileId | null) => void;
  runTaskInPane: (taskId: TaskId, targetPaneId?: PaneId | null) => Promise<void>;
  updateWorkspaceInitConfig: (workspaceId: WorkspaceId, patch: Partial<ProjectInitConfig>) => void;
  resetWorkspaceInitConfig: (workspaceId: WorkspaceId) => void;
  runAgentProfile: (agent: AgentProfile, pane: TerminalPaneConfig, task: DeckTask | null) => Promise<boolean>;
  upsertAgentProfile: (profile: Partial<AgentProfile> & Pick<AgentProfile, 'name' | 'commandTemplate'>) => void;
  deleteAgentProfile: (agentId: AgentProfileId) => void;
  runAgentInPane: (agentId: AgentProfileId, paneId?: PaneId | null) => Promise<void>;
  /** Create a new terminal pane and launch the agent CLI there (no manual typing). */
  runAgentInNewPane: (agentId: AgentProfileId) => Promise<void>;
  runAgentInAllPanes: (agentId: AgentProfileId) => Promise<void>;
  /** Launch different agents on multiple panes in one go (map paneId → agentId). */
  runAgentsOnPanes: (assignments: Array<{ paneId: PaneId; agentId: AgentProfileId }>) => Promise<void>;
  /** Persist multi-pane launch board (pane → agent) on the workspace. Survives restart. */
  setPaneAgentAssignments: (workspaceId: WorkspaceId, assignments: Record<PaneId, AgentProfileId | ''>) => void;
  stopAllPanes: () => Promise<void>;
  closeAllPanes: () => void;
  pauseAgentRun: (runId: AgentRunId) => void;
  resumeAgentRun: (runId: AgentRunId) => void;
  captureAgentRunChanges: (runId: AgentRunId) => Promise<void>;
  discardFileChanges: (filePath: string) => Promise<void>;
  discardAllWorkspaceChanges: () => Promise<void>;
  commitReviewedFiles: (message: string) => Promise<boolean>;
  updatePermissionPolicy: (patch: Partial<CommandPermissionPolicy>) => void;
  upsertWorkspaceTemplate: (
    template: Partial<WorkspaceTemplate> & Pick<WorkspaceTemplate, 'name' | 'paneTitles'>
  ) => void;
  deleteWorkspaceTemplate: (templateId: WorkspaceTemplateId) => void;
  createProjectNote: (title: string, body: string) => void;
  updateProjectNote: (noteId: ProjectNoteId, patch: Partial<Pick<ProjectNote, 'title' | 'body'>>) => void;
  deleteProjectNote: (noteId: ProjectNoteId) => void;
  generateReviewReport: () => Promise<void>;
  exportReviewReport: (reportId: ReviewReportId) => Promise<void>;
  exportWorkspaceReport: () => Promise<void>;
  createGitCheckpoint: () => Promise<void>;
  createSkill: (skillDraft: Omit<Skill, 'id' | 'isSystem' | 'updatedAt'>) => void;
  updateSkill: (skillId: SkillId, patch: Partial<Omit<Skill, 'id' | 'isSystem'>>) => void;
  deleteSkill: (skillId: SkillId) => void;
  deleteAllCustomSkills: () => void;
  /** Toggle favorite pin — pinned skills float to the top of the Skills panel. */
  togglePinSkill: (skillId: SkillId) => void;
  /** Reorder skills list (Default order). place = before | after the target skill. */
  moveSkill: (draggedId: SkillId, overId: SkillId, place?: 'before' | 'after') => void;
  /** Reorder available agents list. place = before | after target profile. */
  moveAgentProfile: (draggedId: string, overId: string, place?: 'before' | 'after') => void;
  assignSkillToTask: (taskId: TaskId, skillId: SkillId | null) => void;
  generateContext: (workspaceId: WorkspaceId) => Promise<void>;
  sendAssistantMessage: (
    content: string,
    images?: import('../../shared/types').AssistantImageAttachment[],
    options?: { requestId?: string; signal?: AbortSignal }
  ) => Promise<'ok' | 'cancelled'>;
  /** True while Assist is waiting on LLM / offline reply (AI Explain, composer, etc.) */
  assistantBusy: boolean;
  assistantRequestId: string | null;
  cancelAssistantRequest: () => void;
  executeAssistantAction: (messageId: AssistantMessageId) => Promise<void>;
  dismissAssistantAction: (messageId: AssistantMessageId) => void;
  clearAssistantMessages: () => void;
  createWorkflow: (name: string, steps: WorkflowStep[], taskId?: TaskId | null) => void;
  createWorkflowFromTemplate: (templateId: string, taskId?: TaskId | null) => void;
  deleteWorkflow: (workflowId: WorkflowId) => void;
  addMcpConnection: (connection: Omit<McpServerConnection, 'id' | 'status' | 'tools' | 'lastChecked'>) => void;
  updateMcpConnection: (id: string, patch: Partial<McpServerConnection>) => void;
  deleteMcpConnection: (id: string) => void;
  addDbConnection: (connection: Omit<DbConnectionConfig, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'> & { password?: string; connectionString?: string; username?: string }) => Promise<void>;
  updateDbConnection: (connectionId: string, patch: Partial<DbConnectionConfig> & { password?: string; connectionString?: string; username?: string }) => Promise<void>;
  deleteDbConnection: (connectionId: string) => void;
  testMcpConnection: (id: string) => Promise<{ ok: boolean; message: string }>;
  loadMcpTools: (id: string) => Promise<void>;
  startWorkflow: (workflowId: WorkflowId, paneId?: PaneId) => Promise<void>;
  pauseWorkflow: (workflowId: WorkflowId) => void;
  resumeWorkflow: (workflowId: WorkflowId) => Promise<void>;
  retryWorkflowStep: (workflowId: WorkflowId, stepIndex: number) => Promise<void>;
  skipWorkflowStep: (workflowId: WorkflowId, stepIndex: number) => void;
  cancelWorkflow: (workflowId: WorkflowId) => void;
  executeWorkflowStep: (workflowId: WorkflowId, stepIndex: number) => Promise<void>;
  addPaneInputBytes: (paneId: string, bytes: number, isRequest?: boolean) => void;
  addPaneOutputBytes: (paneId: string, bytes: number) => void;
  resetPaneTokens: (paneId: string) => void;
  addUsageLog: (log: Omit<UsageLog, 'id' | 'timestamp'>) => void;
  simulateUsageLog: (selectedModelId: string, inputTokens: number, outputTokens: number, cachedInputTokens?: number) => void;
  resetUsageLogs: () => void;

  // Project Run System
  projectRunStates: Record<WorkspaceId, { status: ProjectRunStatus; activeConfigId: string | null; errors: string[] }>;
  projectLogs: Record<WorkspaceId, string>;
  projectLogListenersBound: boolean;
  showRunConfigModalWorkspaceId: WorkspaceId | null;
  setShowRunConfigModalWorkspaceId: (workspaceId: WorkspaceId | null) => void;
  showRunLogsModalWorkspaceId: WorkspaceId | null;
  setShowRunLogsModalWorkspaceId: (workspaceId: WorkspaceId | null) => void;

  runProject: (workspaceId: WorkspaceId, configId: string) => Promise<void>;
  stopProject: (workspaceId: WorkspaceId) => Promise<void>;
  configureProjectRunConfigs: (workspaceId: WorkspaceId, configs: RunConfig[], defaultConfigId?: string) => void;
  loadProjectStatus: (workspaceId: WorkspaceId) => Promise<void>;
  loadProjectLogs: (workspaceId: WorkspaceId) => Promise<void>;

  // Figma Build Orchestrator
  figmaBuildPlans: FigmaBuildPlan[];
  activeFigmaBuildPlanId: string | null;
  createFigmaBuildPlan: (selection: ReceivedFigmaSelection, analysisResult: any) => void;
  setActiveFigmaBuildPlan: (planId: string | null) => void;
  updateFigmaBuildTaskStatus: (planId: string, taskId: string, status: FigmaBuildPlanTask['status']) => void;
  dispatchFigmaBuildTask: (planId: string, taskId: string, paneId: string, agentProfileId: string) => Promise<void>;
  deleteFigmaBuildPlan: (planId: string) => void;
};

export const useDeckStore = create<DeckStore>((set, get) => ({
  ...defaultState,
  paneTokens: {},
  loaded: false,
  loadError: null,
  lastPermissionNotice: null,
  lastExportPath: null,
  gitCheckpoint: '',
  workspaceLocks: {},
  mcpClients: [],
  loadingWorkspace: false,
  assistantBusy: false,
  assistantRequestId: null,
  showFigmaImportModal: false,
  figmaImportSelectionPayload: null,
  autoImportFigma: false,
  autoAttachFigma: false,
  autoImportMode: 'get_design_context',
  latestReceivedSelection: null,
  setShowFigmaImportModal: (open) => set({ showFigmaImportModal: open }),
  setFigmaImportSelectionPayload: (payload) => set({ figmaImportSelectionPayload: payload }),
  setAutoImportFigma: (enabled) => {
    set({ autoImportFigma: enabled });
    persist(get());
  },
  setAutoAttachFigma: (enabled) => {
    set({ autoAttachFigma: enabled });
    persist(get());
  },
  setAutoImportMode: (mode) => {
    set({ autoImportMode: mode });
    persist(get());
  },
  setLatestReceivedSelection: (sel) => {
    set({ latestReceivedSelection: sel });
    persist(get());
  },
  importFigmaSelection: async (payload, isAuto = false) => {
    const selectionId = `figma-sel-${Date.now()}`;
    const receivedSel: ReceivedFigmaSelection = {
      id: selectionId,
      source: "figma-plugin",
      trigger: isAuto ? "auto" : "manual",
      fileKey: payload.fileKey,
      fileName: payload.fileName,
      nodeId: payload.nodeId,
      nodeName: payload.nodeName,
      nodeType: payload.nodeType,
      width: payload.width,
      height: payload.height,
      selectionUrl: payload.selectionUrl,
      receivedAt: new Date().toISOString(),
      status: "importing"
    };

    set({ latestReceivedSelection: receivedSel });
    persist(get());

    const mcpConnections = get().mcpConnections || [];
    const figmaConn = mcpConnections.find((c) =>
      c.tools?.some((t) => t.name === 'get_design_context') ||
      c.name.toLowerCase().includes('figma') ||
      c.url.includes('figma.com')
    );

    if (!figmaConn) {
      set((state) => {
        if (state.latestReceivedSelection?.id === selectionId) {
          return {
            latestReceivedSelection: {
              ...state.latestReceivedSelection,
              status: "failed",
              error: "No Figma MCP Connection found. Check Connections settings."
            }
          };
        }
        return {};
      });
      persist(get());
      return;
    }

    if (figmaConn.status !== 'connected') {
      set((state) => {
        if (state.latestReceivedSelection?.id === selectionId) {
          return {
            latestReceivedSelection: {
              ...state.latestReceivedSelection,
              status: "failed",
              error: `Figma MCP Connection is ${figmaConn.status}. Please connect first.`
            }
          };
        }
        return {};
      });
      persist(get());
      return;
    }

    // Build headers
    let headers: Record<string, string> = {};
    if (figmaConn.authType === 'bearer' && figmaConn.bearerToken) {
      headers = { Authorization: `Bearer ${figmaConn.bearerToken.trim()}` };
    } else if (figmaConn.authType === 'headers' && figmaConn.headersJson) {
      try {
        headers = JSON.parse(figmaConn.headersJson);
      } catch {
        // ignore
      }
    }
    headers['x-figma-tool-name'] = get().autoImportMode || 'get_design_context';
    headers['x-figma-node-name'] = encodeURIComponent(payload.nodeName || '');
    headers['x-figma-node-type'] = payload.nodeType || '';
    headers['x-figma-node-width'] = String(payload.width || 0);
    headers['x-figma-node-height'] = String(payload.height || 0);

    try {
      const headersStr = JSON.stringify(headers);
      console.log(`[AUTO FIGMA IMPORT] Invoking tool ${get().autoImportMode || 'get_design_context'} for url: ${payload.selectionUrl}`);
      const res = await window.agentDeck.mcpClientGetFigmaContext(figmaConn.url, headersStr, payload.selectionUrl.trim());

      if (res.ok) {
        const textContent = res.data;
        const autoAttach = get().autoAttachFigma;

        set((state) => {
          if (state.latestReceivedSelection?.id === selectionId) {
            return {
              latestReceivedSelection: {
                ...state.latestReceivedSelection,
                status: autoAttach ? "attached" : "imported",
                importedContext: textContent,
                previewText: textContent.slice(0, 3000)
              }
            };
          }
          return {};
        });
        persist(get());

        if (autoAttach) {
          // Clean the JSON representation to strip out heavy properties before inserting in prompt
          let cleanedText = textContent;
          try {
            const parsed = JSON.parse(textContent);
            const cleanNode = (obj: any) => {
              if (!obj || typeof obj !== 'object') return;
              if (Array.isArray(obj)) {
                obj.forEach(cleanNode);
                return;
              }
              if (typeof obj.previewImage === 'string' && obj.previewImage.startsWith('data:')) {
                delete obj.previewImage;
              }
              delete obj.previewImageBase64;
              delete obj.previewText;
              delete obj.svgContent;
              delete obj.childVectors;
              for (const key of Object.keys(obj)) {
                if (typeof obj[key] === 'object') {
                  cleanNode(obj[key]);
                }
              }
            };
            cleanNode(parsed);
            cleanedText = JSON.stringify(parsed, null, 2);
          } catch {
            // ignore
          }

          // Format prompt content and dispatch event
          const summaryText = cleanedText;
          const isLarge = summaryText.length > 8000;
          const finalContext = isLarge ? summaryText.slice(0, 8000) + '\n\n... [Content Truncated due to size] ...' : summaryText;

          const promptText = [
            `# Figma Design Context`,
            ``,
            `Source: ${payload.selectionUrl.trim()}`,
            `Tool: ${get().autoImportMode || 'get_design_context'}`,
            `Size: ${summaryText.length} chars (${isLarge ? 'Truncated reference attached' : 'Full context attached'})`,
            ``,
            `## Imported Context`,
            ``,
            `\`\`\`json`,
            finalContext,
            `\`\`\``,
            ``,
            `## Agent Instruction`,
            ``,
            `Use this Figma design context as reference.`,
            ``,
            `Do not generate code unless explicitly asked.`,
            ``,
            `When implementing UI:`,
            `- Inspect the real codebase first.`,
            `- Find existing components/styles.`,
            `- Preserve current behavior.`,
            `- Do not redesign unrelated areas.`,
            `- Match layout, typography, spacing, and colors from the Figma context where practical.`
          ].join('\n');

          window.dispatchEvent(
            new CustomEvent('agentdeck:insert-composer', {
              detail: {
                text: promptText,
                paneId: get().activePaneId || undefined
              }
            })
          );
        }
      } else {
        const errMsg = res.error?.message || 'Figma MCP tool call failed.';
        set((state) => {
          if (state.latestReceivedSelection?.id === selectionId) {
            return {
              latestReceivedSelection: {
                ...state.latestReceivedSelection,
                status: "failed",
                error: errMsg
              }
            };
          }
          return {};
        });
        persist(get());
      }
    } catch (err: any) {
      console.error('[AUTO FIGMA IMPORT] Error during import tool execution:', err);
      set((state) => {
        if (state.latestReceivedSelection?.id === selectionId) {
          return {
            latestReceivedSelection: {
              ...state.latestReceivedSelection,
              status: "failed",
              error: err.message || String(err)
            }
          };
        }
        return {};
      });
      persist(get());
    }
  },
  projectRunStates: {},
  projectLogs: {},
  projectLogListenersBound: false,
  showRunConfigModalWorkspaceId: null,
  setShowRunConfigModalWorkspaceId: (workspaceId) => set({ showRunConfigModalWorkspaceId: workspaceId }),
  showRunLogsModalWorkspaceId: null,
  setShowRunLogsModalWorkspaceId: (workspaceId) => set({ showRunLogsModalWorkspaceId: workspaceId }),
  setMcpClients: (clients) => set({ mcpClients: clients }),
  setLoadingWorkspace: (loading) => set({ loadingWorkspace: loading }),

  hydrate: async () => {
    try {
      const api = window.agentDeck;
      if (!api) {
        throw new Error('AgentDeck preload API is not available. Restart the Electron app.');
      }

      // Load initial MCP clients
      try {
        const clientsRes = await api.getMcpClients();
        if (clientsRes.ok) {
          set({ mcpClients: clientsRes.data });
        }
      } catch (err) {
        console.error('Failed to load initial MCP clients:', err);
      }

      // Listen to MCP clients changes
      try {
        api.onMcpClientsChanged((clients) => {
          set({ mcpClients: clients });
        });
      } catch (err) {
        console.error('Failed to register MCP clients changed listener:', err);
      }

      const [stateSnapshot, storageInfo] = await Promise.all([api.loadState(), api.getStorageInfo()]);
      const snapshot = mergeDefaults(stateSnapshot, storageInfo);
      const activeWorkspace =
        snapshot.workspaces.find((workspace) => workspace.id === snapshot.activeWorkspaceId) ?? null;
      set({
        ...snapshot,
        activeWorkspaceId: activeWorkspace?.id ?? snapshot.workspaces[0]?.id ?? null,
        activePaneId: activeWorkspace
          ? activeWorkspace.panes[snapshot.activePaneId ?? '']
            ? snapshot.activePaneId
            : findFirstPaneId(activeWorkspace.layout)
          : findFirstPaneId(snapshot.workspaces[0]?.layout ?? null),
        loaded: true,
        loadError: null
      });

      // Bind Project Runner listeners
      try {
        if (!get().projectLogListenersBound) {
          api.onProjectLifecycle((event) => {
            set((current) => ({
              projectRunStates: {
                ...current.projectRunStates,
                [event.workspaceId]: {
                  status: event.status as any,
                  activeConfigId: event.activeConfigId,
                  errors: event.errors
                }
              }
            }));
          });

          api.onProjectData((event) => {
            set((current) => {
              const currentLogs = current.projectLogs[event.workspaceId] || '';
              let nextLogs = currentLogs + event.data;
              if (nextLogs.length > 100000) {
                nextLogs = nextLogs.substring(nextLogs.length - 80000);
              }
              return {
                projectLogs: {
                  ...current.projectLogs,
                  [event.workspaceId]: nextLogs
                }
              };
            });
          });

          set({ projectLogListenersBound: true });
        }
      } catch (err) {
        console.error('Failed to register project runner listeners:', err);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load AgentDeck state.';
      set({ ...defaultState, loaded: true, loadError: message });
    }
  },

  createWorkspace: async (templateId = null) => {
    set({ loadingWorkspace: true });
    try {
      const folder = await window.agentDeck.createWorkspaceFolder();
      if (!folder.ok) {
        set({ loadError: folder.error.message });
        return;
      }
      if (!folder.data) {
        set({ loadError: null });
        return;
      }

      const existing = get().workspaces.find(
        (workspace) => workspace.rootPath === folder.data || workspace.path === folder.data
      );
      if (existing) {
        get().selectWorkspace(existing.id);
        return;
      }

      get().addWorkspaceFromFolder(folder.data, templateId);
    } finally {
      set({ loadingWorkspace: false });
    }
  },

  openWorkspace: async (templateId = null) => {
    set({ loadingWorkspace: true });
    try {
      const folder = await window.agentDeck.openWorkspaceFolder();
      if (!folder.ok) {
        set({ loadError: folder.error.message });
        return;
      }
      if (!folder.data) {
        set({ loadError: null });
        return;
      }

      const existing = get().workspaces.find(
        (workspace) => workspace.rootPath === folder.data || workspace.path === folder.data
      );
      if (existing) {
        get().selectWorkspace(existing.id);
        return;
      }

      get().addWorkspaceFromFolder(folder.data, templateId);
    } finally {
      set({ loadingWorkspace: false });
    }
  },

  addWorkspaceFromFolder: (folder, templateId = null) => {
    const state = get();
    const template = state.workspaceTemplates.find((item) => item.id === templateId) ?? null;
    const paneTitles = template?.paneTitles.length ? template.paneTitles : ['Terminal 1'];
    const panes = paneTitles.map((title) => createPane(folder, title));
    const layout = createBalancedLayout(panes.map((pane) => pane.id));
    const timestamp = now();
    const workspace: Workspace = {
      id: id('workspace'),
      name: folder.split(/[\\/]/).filter(Boolean).slice(-1)[0] || folder,
      path: folder,
      rootPath: folder,
      templateId: template?.id ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastOpenedAt: timestamp,
      panes: Object.fromEntries(panes.map((pane) => [pane.id, pane])),
      layout,
      savedLayout: null,
      layoutJson: serializeLayout(layout),
      settingsJson: '{}'
    };
    const project: Project = {
      id: id('project'),
      workspaceId: workspace.id,
      name: workspace.name,
      rootPath: workspace.rootPath,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    set({
      workspaces: [...state.workspaces, workspace],
      projects: [...state.projects, project],
      activeWorkspaceId: workspace.id,
      activePaneId: panes[0]?.id ?? null,
      loadError: null
    });
    persistImmediately(get());
  },

  renameWorkspace: (workspaceId, name) => {
    const nextName = name.trim();
    if (!nextName) {
      return;
    }

    set((state) => ({
      workspaces: mutateWorkspace(state.workspaces, workspaceId, (workspace) => ({
        ...workspace,
        name: nextName,
        updatedAt: now()
      })),
      projects: state.projects.map((project) =>
        project.workspaceId === workspaceId ? { ...project, name: nextName, updatedAt: now() } : project
      )
    }));
    persist(get());
  },

  setWorkspaceColor: (workspaceId, color) => {
    set((state) => ({
      workspaces: mutateWorkspace(state.workspaces, workspaceId, (workspace) => ({
        ...workspace,
        color: color || undefined,
        updatedAt: now()
      }))
    }));
    persist(get());
  },

  setWorkspaceNote: (workspaceId, note) => {
    const trimmed = note ? note.trim() : undefined;
    set((state) => ({
      workspaces: mutateWorkspace(state.workspaces, workspaceId, (workspace) => ({
        ...workspace,
        note: trimmed || undefined,
        updatedAt: now()
      }))
    }));
    persist(get());
  },

  setWorkspaceRestoreDirectory: (workspaceId, restore) => {
    set((state) => ({
      workspaces: mutateWorkspace(state.workspaces, workspaceId, (workspace) => ({
        ...workspace,
        restoreDirectory: restore,
        updatedAt: now()
      }))
    }));
    persist(get());
  },

  deleteWorkspace: (workspaceId) => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      return;
    }

    Object.keys(workspace.panes).forEach((paneId) => {
      void window.agentDeck.terminalKill(paneId);
    });
    void window.agentDeck.attachmentCleanupWorkspace(workspaceId);

    const remaining = state.workspaces.filter((item) => item.id !== workspaceId);
    const nextActive = state.activeWorkspaceId === workspaceId ? (remaining[0] ?? null) : null;
    set({
      workspaces: remaining,
      projects: state.projects.filter((project) => project.workspaceId !== workspaceId),
      activeWorkspaceId: state.activeWorkspaceId === workspaceId ? (nextActive?.id ?? null) : state.activeWorkspaceId,
      activePaneId: nextActive ? findFirstPaneId(nextActive.layout) : (state.activeWorkspaceId === workspaceId ? null : state.activePaneId),
      attachments: (state.attachments || []).filter((att) => att.workspaceId !== workspaceId),
      tasks: state.tasks.map((task) =>
        task.paneId && workspace.panes[task.paneId] ? { ...task, paneId: null, updatedAt: now() } : task
      ),
      projectNotes: state.projectNotes.filter((note) => note.workspaceId !== workspaceId),
      reviewReports: state.reviewReports.filter((report) => report.workspaceId !== workspaceId)
    });
    persistImmediately(get());
  },

  reorderWorkspaces: (sourceId, targetId) => {
    if (sourceId === targetId) return;
    const state = get();
    const list = [...state.workspaces];
    const sourceIdx = list.findIndex((w) => w.id === sourceId);
    const targetIdx = list.findIndex((w) => w.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const [moved] = list.splice(sourceIdx, 1);
    list.splice(targetIdx, 0, moved);

    set({ workspaces: list });
    persistImmediately(get());
  },

  moveWorkspace: (workspaceId, direction) => {
    const state = get();
    const list = [...state.workspaces];
    const idx = list.findIndex((w) => w.id === workspaceId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;

    set({ workspaces: list });
    persistImmediately(get());
  },

  updatePaneLifecycle: (event) => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.panes[event.paneId]);
    if (!workspace) {
      return;
    }

    const timestamp = now();
    const isTerminalExit = event.kind === 'exited' || event.kind === 'crashed' || event.kind === 'killed';
    const nextLocks = { ...state.workspaceLocks };
    if (isTerminalExit && nextLocks[workspace.id]?.paneId === event.paneId) {
      delete nextLocks[workspace.id];
    }

    const activeRun = isTerminalExit
      ? state.agentRuns.find(
          (run) =>
            run.workspaceId === workspace.id &&
            run.terminalSessionId === event.paneId &&
            (run.status === 'running' || run.status === 'paused')
        )
      : null;

    set({
      workspaces: mutateWorkspace(state.workspaces, workspace.id, (item) => {
        const pane = item.panes[event.paneId];
        return {
          ...item,
          panes: {
            ...item.panes,
            [event.paneId]: {
              ...pane,
              shell: event.shell ?? pane.shell,
              cwd: event.cwd ?? pane.cwd,
              processStatus: event.kind,
              lastStartedAt: event.kind === 'spawning' ? timestamp : pane.lastStartedAt,
              lastReadyAt: event.kind === 'ready' ? timestamp : pane.lastReadyAt,
              lastActiveAt: event.kind === 'running' || event.kind === 'idle' ? timestamp : pane.lastActiveAt,
              lastExitedAt: isTerminalExit ? timestamp : pane.lastExitedAt,
              lastExitCode: isTerminalExit ? event.exitCode : null,
              lastExitSignal: isTerminalExit ? event.signal : null
            }
          }
        };
      }),
      agentRuns: isTerminalExit
        ? state.agentRuns.map((run) =>
            run.workspaceId === workspace.id && run.terminalSessionId === event.paneId && (run.status === 'running' || run.status === 'paused')
              ? {
                  ...run,
                  status:
                    (event.kind === 'exited' && (event.exitCode === null || event.exitCode === 0))
                      ? 'finished'
                      : event.kind === 'killed'
                        ? 'cancelled'
                        : 'failed',
                  finishedAt: timestamp,
                  summary:
                    event.message ??
                    (event.kind === 'exited'
                      ? 'Terminal process exited.'
                      : event.kind === 'killed'
                        ? 'Terminal process was killed.'
                        : 'Terminal process failed.')
                }
              : run
          )
        : state.agentRuns,
      tasks: isTerminalExit
        ? state.tasks.map((task) => {
            const associatedRun = state.agentRuns.find(
              (run) =>
                run.taskId === task.id &&
                run.terminalSessionId === event.paneId &&
                (run.status === 'running' || run.status === 'paused')
            );
            if (associatedRun) {
              const isSuccess = event.kind === 'exited' && (event.exitCode === null || event.exitCode === 0);
              return {
                ...task,
                status: isSuccess ? ('review' as const) : ('todo' as const),
                updatedAt: timestamp
              };
            }
            return task;
          })
        : state.tasks,
      workspaceLocks: nextLocks
    });

    if (isTerminalExit) {
      const runningWorkflow = state.workflows.find(
        (w) => w.status === 'running' && w.paneId === event.paneId
      );
      if (runningWorkflow) {
        const isSuccess = event.kind === 'exited' && (event.exitCode === null || event.exitCode === 0);
        const errorMsg = event.message || (event.kind === 'exited' ? `Terminal exited with code ${event.exitCode}` : `Terminal failed with kind: ${event.kind}`);

        const result = advanceWorkflow(runningWorkflow, isSuccess, errorMsg);

        set((current) => ({
          workflows: current.workflows.map((w) =>
            w.id === runningWorkflow.id ? result.workflow : w
          )
        }));
        persist(get());

        if (result.shouldRunNextStep) {
          void get().executeWorkflowStep(runningWorkflow.id, result.nextStepIndex);
        } else {
          if (result.workflow.status === 'completed' && runningWorkflow.taskId) {
            get().updateTask(runningWorkflow.taskId, { status: 'review' });
          }
        }
      }
    }

    if (activeRun) {
      void get().captureAgentRunChanges(activeRun.id);
    }

    if (event.kind === 'idle' && localStorage.getItem('agentdeck_figma_auto_dispatch') === 'true') {
      const runningRun = state.agentRuns.find(
        (run) =>
          run.workspaceId === workspace.id &&
          run.terminalSessionId === event.paneId &&
          run.status === 'running' &&
          run.taskId
      );

      if (runningRun) {
        const linkedPlan = state.figmaBuildPlans?.find((plan) =>
          plan.tasks.some((t) => t.kanbanTaskId === runningRun.taskId && t.status === 'running')
        );

        if (linkedPlan) {
          const planTask = linkedPlan.tasks.find(
            (t) => t.kanbanTaskId === runningRun.taskId && t.status === 'running'
          );
          if (planTask) {
            setTimeout(() => {
              get().updateFigmaBuildTaskStatus(linkedPlan.id, planTask.id, 'completed');
              get().updateTask(runningRun.taskId!, { status: 'done' });
            }, 100);
          }
        }
      }
    }

    persist(get());
  },

  markPaneStarted: (paneId, shell = null) => {
    get().updatePaneLifecycle({
      paneId,
      kind: 'spawning',
      shell,
      cwd: null,
      exitCode: null,
      signal: null,
      message: null
    });
  },

  markPaneExited: (paneId, exitCode, signal = null) => {
    get().updatePaneLifecycle({
      paneId,
      kind: 'exited',
      shell: null,
      cwd: null,
      exitCode,
      signal,
      message: null
    });
  },

  selectWorkspace: (workspaceId) => {
    const workspace = get().workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      return;
    }
    const timestamp = now();
    set((state) => ({
      activeWorkspaceId: workspaceId,
      activePaneId: findFirstPaneId(workspace.layout ?? null),
      workspaces: mutateWorkspace(state.workspaces, workspaceId, (item) => ({ ...item, lastOpenedAt: timestamp }))
    }));
    persist(get());
  },

  selectPane: (paneId) => {
    set({ activePaneId: paneId });
    persist(get());
  },

  setGridLayout: (cols, rows) => {
    const state = get();
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId) return;

    set((state) => {
      const workspace = state.workspaces.find((w) => w.id === workspaceId);
      if (!workspace) return state;

      const totalRequired = cols * rows;
      if (totalRequired <= 0) return state;

      const currentPaneIds = Object.keys(workspace.panes);
      const nowTime = now();
      const updatedPanes = { ...workspace.panes };

      // 1. Create missing panes if needed
      while (currentPaneIds.length < totalRequired) {
        const title = `Terminal ${currentPaneIds.length + 1}`;
        const newPane = createPane(workspace.rootPath, title);
        updatedPanes[newPane.id] = newPane;
        currentPaneIds.push(newPane.id);
      }

      // 2. Kill and delete excess panes from terminal process in main if needed
      const excessPaneIds = currentPaneIds.slice(totalRequired);
      excessPaneIds.forEach((pid) => {
        void window.agentDeck.terminalKill(pid);
        delete updatedPanes[pid];
      });

      // Active pane IDs for layout
      const activePaneIds = currentPaneIds.slice(0, totalRequired);

      // 3. Build 2D grid structure [cols][rows]
      const gridIds: string[][] = [];
      for (let c = 0; c < cols; c++) {
        gridIds[c] = [];
        for (let r = 0; r < rows; r++) {
          gridIds[c].push(activePaneIds[c * rows + r]);
        }
      }

      // Helper functions to build vertical columns and horizontal rows
      const buildColLayout = (paneIds: string[]): PaneLayout => {
        if (paneIds.length === 1) {
          return createPaneLayout(paneIds[0]);
        }
        const midpoint = Math.ceil(paneIds.length / 2);
        return {
          type: 'split',
          id: id('split'),
          direction: 'horizontal',
          ratio: midpoint / paneIds.length,
          first: buildColLayout(paneIds.slice(0, midpoint)),
          second: buildColLayout(paneIds.slice(midpoint))
        };
      };

      const buildGridLayout = (paneIds2D: string[][]): PaneLayout => {
        const cCount = paneIds2D.length;
        if (cCount === 1) {
          return buildColLayout(paneIds2D[0]);
        }
        const midpoint = Math.ceil(cCount / 2);
        return {
          type: 'split',
          id: id('split'),
          direction: 'vertical',
          ratio: midpoint / cCount,
          first: buildGridLayout(paneIds2D.slice(0, midpoint)),
          second: buildGridLayout(paneIds2D.slice(midpoint))
        };
      };

      const newLayout = buildGridLayout(gridIds);

      // Update workspace layout
      const updatedWorkspaces = state.workspaces.map((w) => {
        if (w.id === workspaceId) {
          return {
            ...w,
            updatedAt: nowTime,
            panes: updatedPanes,
            layout: newLayout,
            layoutJson: serializeLayout(newLayout),
            savedLayout: null
          };
        }
        return w;
      });

      // Find first pane in new layout to focus
      const newActivePaneId = findFirstPaneId(newLayout);

      return {
        ...state,
        workspaces: updatedWorkspaces,
        activePaneId: newActivePaneId
      };
    });

    persist(get());
  },

  createPane: (title?: string) => {
    const state = get();
    const workspaceId = state.activeWorkspaceId;
    const workspace = state.workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      return null;
    }

    const pane = createPane(workspace.rootPath, title || `Terminal ${Object.keys(workspace.panes).length + 1}`);

    set({
      workspaces: mutateWorkspace(state.workspaces, workspace.id, (item) => {
        const layout = appendPaneToLayout(item.layout, pane.id);
        return {
          ...item,
          updatedAt: now(),
          panes: { ...item.panes, [pane.id]: pane },
          layout,
          layoutJson: serializeLayout(layout),
          savedLayout: null
        };
      }),
      activePaneId: pane.id
    });
    persist(get());
    return pane.id;
  },

  splitPane: (paneId, direction) => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (!workspace?.layout) {
      return null;
    }

    const pane = createPane(workspace.rootPath, `Terminal ${Object.keys(workspace.panes).length + 1}`);
    set({
      workspaces: mutateWorkspace(state.workspaces, workspace.id, (item) => {
        const layout = replacePaneWithSplit(item.layout ?? createPaneLayout(paneId), paneId, direction, pane.id);
        return {
          ...item,
          updatedAt: now(),
          panes: { ...item.panes, [pane.id]: pane },
          layout,
          layoutJson: serializeLayout(layout),
          savedLayout: null
        };
      }),
      activePaneId: pane.id
    });
    persist(get());
    return pane.id;
  },

  closePane: (paneId) => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (!workspace?.layout || !workspace.panes[paneId]) {
      return;
    }

    const nextLayout = removePaneFromLayout(workspace.layout, paneId);
    const nextPanes = { ...workspace.panes };
    delete nextPanes[paneId];

    set({
      workspaces: mutateWorkspace(state.workspaces, workspace.id, (item) => {
        const nextAssignments = { ...(item.paneAgentAssignments || {}) };
        delete nextAssignments[paneId];
        return {
          ...item,
          updatedAt: now(),
          panes: nextPanes,
          layout: nextLayout,
          layoutJson: serializeLayout(nextLayout),
          savedLayout: item.savedLayout ? removePaneFromLayout(item.savedLayout, paneId) : null,
          paneAgentAssignments: nextAssignments
        };
      }),
      activePaneId: state.activePaneId === paneId ? findFirstPaneId(nextLayout) : state.activePaneId,
      tasks: state.tasks.map((task) => (task.paneId === paneId ? { ...task, paneId: null, updatedAt: now() } : task))
    });
    void window.agentDeck.terminalKill(paneId);
    persist(get());
  },

  closeActivePane: () => {
    const paneId = get().activePaneId;
    if (paneId) {
      get().closePane(paneId);
    }
  },

  renamePane: (paneId, title) => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (!workspace?.panes[paneId] || !title.trim()) {
      return;
    }

    set({
      workspaces: mutateWorkspace(state.workspaces, workspace.id, (item) => ({
        ...item,
        updatedAt: now(),
        panes: {
          ...item.panes,
          [paneId]: { ...item.panes[paneId], title: title.trim() }
        }
      }))
    });
    persist(get());
  },

  renameActivePane: () => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    const pane = state.activePaneId ? workspace?.panes[state.activePaneId] : null;
    if (!pane) {
      return;
    }

    window.dispatchEvent(new CustomEvent('trigger-pane-rename', { detail: { paneId: pane.id } }));
  },

  maximizePane: (paneId) => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (!workspace?.layout || !workspace.panes[paneId]) {
      return;
    }

    const isAlreadyMaximized =
      workspace.layout.type === 'pane' && workspace.layout.paneId === paneId && workspace.savedLayout;

    set({
      workspaces: mutateWorkspace(state.workspaces, workspace.id, (item) => {
        const layout = isAlreadyMaximized ? sanitizeLayout(item.savedLayout, item.panes) : createPaneLayout(paneId);
        return {
          ...item,
          updatedAt: now(),
          layout,
          layoutJson: serializeLayout(layout),
          savedLayout: isAlreadyMaximized ? null : item.layout
        };
      }),
      activePaneId: paneId
    });
    persist(get());
  },

  focusNextPane: () => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (!workspace) {
      return;
    }

    const paneIds = orderedPaneIds(workspace);
    if (!paneIds.length) {
      return;
    }

    const currentIndex = Math.max(0, paneIds.indexOf(state.activePaneId ?? ''));
    set({ activePaneId: paneIds[(currentIndex + 1) % paneIds.length] });
    persist(get());
  },

  focusPreviousPane: () => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (!workspace) {
      return;
    }

    const paneIds = orderedPaneIds(workspace);
    if (!paneIds.length) {
      return;
    }

    const currentIndex = paneIds.indexOf(state.activePaneId ?? '');
    const nextIndex = currentIndex <= 0 ? paneIds.length - 1 : currentIndex - 1;
    set({ activePaneId: paneIds[nextIndex] });
    persist(get());
  },

  focusPaneInDirection: (direction) => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (!workspace || !workspace.layout || !state.activePaneId) {
      return;
    }

    const pathToActive = findPathToPane(workspace.layout, state.activePaneId);
    if (!pathToActive) {
      return;
    }

    let current = pathToActive;
    let targetSubtree: PaneLayout | null = null;

    while (current.parent) {
      const parentLayout = current.parent.layout;
      if (parentLayout.type === 'split') {
        if (direction === 'left' && parentLayout.direction === 'vertical' && !current.isFirstChild) {
          targetSubtree = parentLayout.first;
          break;
        }
        if (direction === 'right' && parentLayout.direction === 'vertical' && current.isFirstChild) {
          targetSubtree = parentLayout.second;
          break;
        }
        if (direction === 'up' && parentLayout.direction === 'horizontal' && !current.isFirstChild) {
          targetSubtree = parentLayout.first;
          break;
        }
        if (direction === 'down' && parentLayout.direction === 'horizontal' && current.isFirstChild) {
          targetSubtree = parentLayout.second;
          break;
        }
      }
      current = current.parent;
    }

    if (targetSubtree) {
      const targetPaneId = findBoundaryLeaf(targetSubtree, direction);
      set({ activePaneId: targetPaneId });
      persist(get());
    }
  },

  setSplitRatio: (splitId, ratio) => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (!workspace?.layout) {
      return;
    }

    set({
      workspaces: mutateWorkspace(state.workspaces, workspace.id, (item) => {
        const layout = item.layout ? setSplitRatio(item.layout, splitId, ratio) : item.layout;
        return {
          ...item,
          updatedAt: now(),
          layout,
          layoutJson: serializeLayout(layout)
        };
      })
    });
    persistLayoutSoon(get);
  },

  setRightTab: (rightTab) => {
    set({ rightTab });
    persist(get());
  },

  setAppSetting: (key, value) => {
    set((state) => ({ appSettings: upsertAppSetting(state.appSettings, key, value) }));
    persist(get());
  },

  addPaneInputBytes: (paneId, bytes, isRequest) => {
    if (!pendingInputBytes[paneId]) {
      pendingInputBytes[paneId] = { bytes: 0, requests: 0 };
    }
    pendingInputBytes[paneId].bytes += bytes;
    if (isRequest) {
      pendingInputBytes[paneId].requests += 1;
      const state = get();
      const selectedModelId = (state.appSettings.find((s) => s.key === 'agent.model')?.value as string) || 'claude-sonnet-4.6';
      const inputTokens = Math.ceil(bytes / 4);
      get().simulateUsageLog(selectedModelId, inputTokens, 0, 0);
    }
    scheduleTokenFlush(get, set);
  },

  addPaneOutputBytes: (paneId, bytes) => {
    pendingOutputBytes[paneId] = (pendingOutputBytes[paneId] || 0) + bytes;
    scheduleTokenFlush(get, set);
  },

  resetPaneTokens: (paneId) => {
    set((state) => {
      return {
        paneTokens: {
          ...state.paneTokens,
          [paneId]: { inputChars: 0, outputChars: 0, requests: 0 }
        }
      };
    });
  },

  addUsageLog: (log) => {
    const timestamp = Date.now();
    const logId = `usagelog-${crypto.randomUUID()}`;
    const newLog: UsageLog = {
      id: logId,
      timestamp,
      ...log
    };
    set((state) => ({
      usageLogs: [newLog, ...(state.usageLogs || [])]
    }));
    persist(get());
  },

  simulateUsageLog: (selectedModelId, inputTokens, outputTokens, cachedInputTokens = 0) => {
    const state = get();
    const pricingList = state.pricingList || seededPricing;
    const { model, actualModel, actualProvider, routeProvider } = resolveModelRouting(selectedModelId, pricingList);

    let inputRate = model.inputPer1M;
    let outputRate = model.outputPer1M;
    let cachedRate = model.cachedInp;

    if (selectedModelId === 'custom') {
      const customInputSetting = state.appSettings.find((s) => s.key === 'agent.customInputPrice')?.value;
      const customOutputSetting = state.appSettings.find((s) => s.key === 'agent.customOutputPrice')?.value;
      inputRate = typeof customInputSetting === 'number' ? customInputSetting : 3.0;
      outputRate = typeof customOutputSetting === 'number' ? customOutputSetting : 15.0;
      cachedRate = 0;
    }

    const resolvedModel = {
      ...model,
      inputPer1M: inputRate,
      outputPer1M: outputRate,
      cachedInp: cachedRate
    };

    const cost = calculateCost(resolvedModel, inputTokens, outputTokens, cachedInputTokens);

    get().addUsageLog({
      selectedModel: selectedModelId,
      actualModel,
      actualProvider,
      routeProvider,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      cost,
      workspaceId: state.activeWorkspaceId || undefined,
      paneId: state.activePaneId || undefined
    });
  },

  resetUsageLogs: () => {
    set({ usageLogs: [] });
    persist(get());
  },

  updateWorkspaceInitConfig: (workspaceId, patch) => {
    const state = get();
    const workspace = state.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;

    const currentConfig = workspace.initConfig || {
      projectName: workspace.name,
      description: '',
      projectType: 'web',
      mvpScope: '',
      constraints: '',
      frontendStack: '',
      backendStack: '',
      database: '',
      uiFramework: '',
      apiStyle: '',
      folderStructureBlueprint: '',
      namingConventions: '',
      primaryColor: '#6366f1',
      secondaryColor: '#ec4899',
      backgroundColor: '#0f172a',
      textColor: '#f8fafc',
      borderRadius: '0.5rem',
      darkLightMode: 'dark',
      envKeys: [],
      customAgentRules: '',
      initSteps: []
    };

    const updatedConfig = {
      ...currentConfig,
      ...patch
    };

    set({
      workspaces: mutateWorkspace(state.workspaces, workspaceId, (item) => ({
        ...item,
        updatedAt: now(),
        initConfig: updatedConfig
      }))
    });
    persist(get());
  },

  resetWorkspaceInitConfig: (workspaceId) => {
    const state = get();
    set({
      workspaces: mutateWorkspace(state.workspaces, workspaceId, (item) => ({
        ...item,
        updatedAt: now(),
        initConfig: null
      }))
    });
    persist(get());
  },

  createTask: (title, body = '') => {
    if (!title.trim()) {
      return null;
    }

    const task: DeckTask = {
      id: id('task'),
      title: title.trim(),
      body,
      status: 'todo',
      paneId: get().activePaneId,
      agentId: null,
      priority: 'medium',
      createdAt: now(),
      updatedAt: now()
    };

    set((state) => ({ tasks: [task, ...state.tasks] }));
    persist(get());
    return task.id;
  },

  updateTask: (taskId, patch) => {
    set((state) => ({
      tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, ...patch, updatedAt: now() } : task))
    }));
    persist(get());
  },

  deleteTask: (taskId) => {
    set((state) => ({ tasks: state.tasks.filter((task) => task.id !== taskId) }));
    persist(get());
  },

  assignTaskToPane: (taskId, paneId) => {
    get().updateTask(taskId, { paneId });
  },

  assignTaskToAgent: (taskId, agentId) => {
    get().updateTask(taskId, { agentId });
  },

  runTaskInPane: async (taskId, targetPaneId = null) => {
    const state = get();
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }

    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    // Drop target pane wins; else assigned pane; else active pane (same as Run button)
    const paneId = targetPaneId ?? task.paneId ?? state.activePaneId;
    const pane = paneId ? workspace?.panes[paneId] : null;
    if (!workspace || !pane) {
      set({ lastPermissionNotice: 'Select or assign a pane before sending this task.' });
      return;
    }

    const skill = task.skillId ? state.skills.find((s) => s.id === task.skillId) : null;
    const include = task.includeContext;
    const context = workspace.context;
    let contextPrompt = '';
    
    if (workspace.initConfig) {
      const ic = workspace.initConfig;
      const bpParts: string[] = [];
      bpParts.push(`=== ENFORCED PROJECT INITIALIZATION BLUEPRINT ===`);
      bpParts.push(`[Project Identity]\nName: ${ic.projectName}\nDescription: ${ic.description}\nType: ${ic.projectType}\nMVP Scope: ${ic.mvpScope}\nConstraints: ${ic.constraints}`);
      bpParts.push(`[Tech Stack & Architecture Blueprint]\nFrontend: ${ic.frontendStack}\nBackend: ${ic.backendStack}\nDatabase: ${ic.database}\nUI Framework: ${ic.uiFramework}\nAPI Style: ${ic.apiStyle}\nFolder Structure Constraints: ${ic.folderStructureBlueprint}\nNaming Conventions: ${ic.namingConventions}`);
      bpParts.push(`[UI Theme & Design Tokens]\nPrimary Color: ${ic.primaryColor}\nSecondary Color: ${ic.secondaryColor}\nBackground Color: ${ic.backgroundColor}\nText Color: ${ic.textColor}\nBorder Radius: ${ic.borderRadius}\nDesign Mode: ${ic.darkLightMode}`);
      if (ic.customAgentRules) {
        bpParts.push(`[Mandatory Agent Guardrails & Coding Rules]\n${ic.customAgentRules}`);
      }
      bpParts.push(`=================================================`);
      contextPrompt = bpParts.join('\n\n') + '\n\n';
    }

    if (context && include) {
      const parts: string[] = [];
      if (include.techStack && context.techStack) {
        parts.push(`[Project Technology Stack]\n${context.techStack}`);
      }
      if (include.folderStructure && context.folderStructure) {
        parts.push(`[Project Directory Structure]\n${context.folderStructure}`);
      }
      if (include.codingRules && context.codingRules) {
        parts.push(`[Coding Rules & Formatting Guidelines]\n${context.codingRules}`);
      }
      if (include.projectMemory && context.projectMemory) {
        parts.push(`[Project Memory / Context]\n${context.projectMemory}`);
      }
      if (parts.length > 0) {
        contextPrompt = parts.join('\n\n') + '\n\n';
      }
    }

    let compiledBody = skill
      ? `${skill.promptTemplate}\n\nTask body:\n${task.body}`.trim()
      : task.body;

    if (contextPrompt) {
      compiledBody = `${contextPrompt}Task prompt:\n${compiledBody}`.trim();
    }

    const bypass = state.permissionPolicy.mode === 'bypass-permissions';
    if (!bypass && (skill || contextPrompt)) {
      const previewTitle = skill ? `skill '${skill.name}' and context` : 'context';
      const approved = window.confirm(`Preview Prompt with ${previewTitle}:\n\n${compiledBody}\n\nRun this task?`);
      if (!approved) {
        return;
      }
    }

    const agent = state.agentProfiles.find((item) => item.id === task.agentId) ?? null;
    if (!agent) {
      const prompt = (skill || contextPrompt) ? compiledBody : `${task.title}\n${task.body}`.trim();
      if (prompt) {
        window.agentDeck.terminalWrite(pane.id, `${prompt}\r`);
      }
      get().updateTask(task.id, { paneId: pane.id, status: 'running' });
      return;
    }

    const modifiedTask = { ...task, body: compiledBody };
    const launched = await get().runAgentProfile(agent, pane, modifiedTask);
    if (launched) {
      get().updateTask(task.id, { paneId: pane.id, status: 'running' });
    }
  },

  runAgentProfile: async (agent, pane, task) => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (!workspace || !agent.commandTemplate.trim()) {
      return false;
    }

    if (agent.providerType !== 'cli') {
      const run = createAgentRunRecord(workspace, agent, pane, task, agent.commandTemplate, 'failed');
      set({
        agentRuns: [run, ...get().agentRuns],
        lastPermissionNotice: 'Only local CLI agent profiles can run inside terminal panes in this MVP.'
      });
      persist(get());
      return false;
    }

    // A. Concurrency limit check bypassed completely to avoid dialog interruptions.
    const activeRun = get().agentRuns.find(
      (run) => run.terminalSessionId === pane.id && run.status === 'running'
    );

    const bypass = state.permissionPolicy.mode === 'bypass-permissions';

    // B. Workspace lock check bypassed completely to avoid dialog interruptions.

    if (activeRun) {
      // Auto-terminate the old run and start the new one without showing a dialog.
      const timestamp = now();
      // Cancel the old run manually first
      set({
        agentRuns: get().agentRuns.map((run) =>
          run.id === activeRun.id
            ? {
                ...run,
                status: 'cancelled',
                finishedAt: timestamp,
                summary: `Terminated to start ${agent.name}.`
              }
            : run
        )
      });

      // Reset the associated task status to 'todo' if applicable
      if (activeRun.taskId) {
        set({
          tasks: get().tasks.map((t) =>
            t.id === activeRun.taskId ? { ...t, status: 'todo', updatedAt: timestamp } : t
          )
        });
      }
    }

    // Always ensure a live PTY before injecting the CLI — killed/restored panes
    // previously "succeeded" while terminalWrite was dropped on the floor.
    const livePane = await ensurePaneReadyForAgent(get, pane);
    if (!livePane) {
      set({
        agentRuns: [
          createAgentRunRecord(workspace, agent, pane, task, agent.commandTemplate, 'failed'),
          ...get().agentRuns
        ],
        lastPermissionNotice: `Could not start terminal for "${pane.title || pane.id}". Click Start terminal, then Launch again.`
      });
      persist(get());
      return false;
    }
    pane = livePane;

    // Fetch dynamic Git status
    let gitStatusText = '';
    try {
      const gitStatus = await window.agentDeck.getGitWorkspaceStatus(workspace.rootPath);
      if (gitStatus && gitStatus.isRepo) {
        gitStatusText = `${gitStatus.statusText}\n${gitStatus.diffStat}`.trim();
      }
    } catch {
      // ignore
    }

    const command = renderCommandTemplate(agent, workspace, pane, task, gitStatusText);
    if (!command.trim()) {
      set({
        lastPermissionNotice: `"${agent.name}" resolved to an empty command. Check the command template.`
      });
      return false;
    }

    const evaluation = evaluateCommandPermission(state.permissionPolicy, workspace.id, command);
    const initialDecision = createPermissionDecision(
      workspace.id,
      pane.id,
      command,
      evaluation.review,
      evaluation.action,
      evaluation.reason
    );

    if (evaluation.blocked) {
      set({
        agentRuns: [createAgentRunRecord(workspace, agent, pane, task, command, 'failed'), ...get().agentRuns],
        permissionDecisions: appendPermissionDecision(get().permissionDecisions, initialDecision),
        lastPermissionNotice: evaluation.reason
      });
      persist(get());
      return false;
    }

    if (!bypass && (evaluation.needsReview || agent.permissionMode !== 'unsafe-auto-run')) {
      const approved = confirmCommandReview(pane, command, evaluation);
      if (!approved) {
        const decision = createPermissionDecision(
          workspace.id,
          pane.id,
          command,
          evaluation.review,
          'cancelled',
          'User cancelled command review.'
        );
        set({
          agentRuns: [createAgentRunRecord(workspace, agent, pane, task, command, 'cancelled'), ...get().agentRuns],
          permissionDecisions: appendPermissionDecision(get().permissionDecisions, decision),
          lastPermissionNotice: 'Command cancelled before launch.'
        });
        persist(get());
        return false;
      }
    }

    const checkpoint = bypass
      ? { approved: true, action: null as any, reason: 'Bypass mode allowed command without Git checkpoint.' }
      : await runGitCheckpointFlow(workspace, evaluation.review).catch((error: unknown) => ({
          approved: false,
          action: 'blocked' as const,
          reason: error instanceof Error ? error.message : 'Git checkpoint failed.'
        }));

    if (!checkpoint.approved) {
      const decision = createPermissionDecision(
        workspace.id,
        pane.id,
        command,
        evaluation.review,
        checkpoint.action ?? 'cancelled',
        checkpoint.reason
      );
      set({
        agentRuns: [createAgentRunRecord(workspace, agent, pane, task, command, 'cancelled'), ...get().agentRuns],
        permissionDecisions: appendPermissionDecision(get().permissionDecisions, decision),
        lastPermissionNotice: checkpoint.reason
      });
      persist(get());
      return false;
    }

    const finalAction = checkpoint.action ?? (evaluation.needsReview ? 'reviewed' : evaluation.action);
    const finalReason =
      checkpoint.reason || (evaluation.needsReview ? 'User reviewed and approved the command.' : evaluation.reason);
    const decision = createPermissionDecision(
      workspace.id,
      pane.id,
      command,
      evaluation.review,
      finalAction,
      finalReason
    );

    // Fetch pre-run git status baseline
    let preRunChanges: string[] = [];
    let preRunNumstat: Record<string, { additions: number; deletions: number }> = {};
    try {
      const gitStatus = await window.agentDeck.getGitWorkspaceStatus(workspace.rootPath);
      if (gitStatus && gitStatus.isRepo) {
        preRunChanges = gitStatus.changedFiles || [];
        preRunNumstat = gitStatus.numstat || {};
      }
    } catch (err) {
      console.error('Failed to capture pre-run git baseline:', err);
    }

    // Inject CLI only when PTY accepts the write (retry briefly after restart races).
    const writePayload = `${command}\r`;
    let wrote = false;
    const writeChecked = window.agentDeck.terminalWriteChecked;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      if (writeChecked) {
        wrote = await writeChecked(pane.id, writePayload);
      } else {
        window.agentDeck.terminalWrite(pane.id, writePayload);
        wrote = true;
      }
      if (wrote) break;
      await new Promise((resolve) => setTimeout(resolve, 150));
      // Status may say "ready" while main PTY map is empty — force restart and wait.
      if (attempt === 1 || attempt === 4 || attempt === 7) {
        const again = await ensurePaneReadyForAgent(get, pane, {
          forceRestart: true,
          reason: 'Restarting terminal after failed CLI write.'
        });
        if (again) pane = again;
      }
    }

    if (!wrote) {
      set({
        agentRuns: [createAgentRunRecord(workspace, agent, pane, task, command, 'failed'), ...get().agentRuns],
        permissionDecisions: appendPermissionDecision(get().permissionDecisions, decision),
        lastPermissionNotice: `Failed to inject "${command}" into ${pane.title || 'pane'} — terminal has no live shell. Click Start terminal, then Launch again.`
      });
      persist(get());
      return false;
    }

    const baseRun = createAgentRunRecord(workspace, agent, pane, task, command, 'running');
    const run = {
      ...baseRun,
      preRunChanges,
      preRunNumstat,
      taskTitle: task?.title || undefined,
      taskBody: task?.body || undefined
    };

    set({
      agentRuns: [run, ...get().agentRuns],
      permissionDecisions: appendPermissionDecision(get().permissionDecisions, decision),
      gitCheckpoint: checkpoint.reason || get().gitCheckpoint,
      lastPermissionNotice: evaluation.review.risky ? finalReason : null,
      workspaceLocks: {
        ...get().workspaceLocks,
        [workspace.id]: { paneId: pane.id, agentName: agent.name }
      }
    });
    persistImmediately(get());
    return true;
  },

  upsertAgentProfile: (profile) => {
    const timestamp = now();
    set((state) => {
      const existing = profile.id ? state.agentProfiles.find((item) => item.id === profile.id) : null;
      const next: AgentProfile = {
        ...migrateAgentProfile({ ...existing, ...profile }),
        name: profile.name.trim(),
        commandTemplate: profile.commandTemplate.trim(),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      return {
        agentProfiles: existing
          ? state.agentProfiles.map((item) => (item.id === next.id ? next : item))
          : [next, ...state.agentProfiles]
      };
    });
    persist(get());
  },

  deleteAgentProfile: (agentId) => {
    set((state) => ({
      agentProfiles: state.agentProfiles.filter((agent) => agent.id !== agentId),
      tasks: state.tasks.map((task) => (task.agentId === agentId ? { ...task, agentId: null, updatedAt: now() } : task))
    }));
    persistImmediately(get());
  },

  moveAgentProfile: (draggedId, overId, place = 'before') => {
    if (draggedId === overId) return;
    let changed = false;
    set((state) => {
      const agentProfiles = [...state.agentProfiles];
      const from = agentProfiles.findIndex((a) => a.id === draggedId);
      if (from < 0) return state;
      const [item] = agentProfiles.splice(from, 1);
      let insertAt = agentProfiles.findIndex((a) => a.id === overId);
      if (insertAt < 0) {
        agentProfiles.splice(from, 0, item);
        return state;
      }
      if (place === 'after') insertAt += 1;
      if (insertAt === from) {
        agentProfiles.splice(from, 0, item);
        return state;
      }
      agentProfiles.splice(insertAt, 0, item);
      if (agentProfiles.every((a, i) => a.id === state.agentProfiles[i]?.id)) return state;
      changed = true;
      return { agentProfiles };
    });
    if (changed) persistImmediately(get());
  },

  runAgentInPane: async (agentId, paneId = null) => {
    const state = get();
    const agent = state.agentProfiles.find((item) => item.id === agentId);
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    const targetPaneId = paneId ?? state.activePaneId;
    const pane = targetPaneId ? workspace?.panes[targetPaneId] : null;

    if (!agent) {
      set({ lastPermissionNotice: 'Agent profile not found.' });
      return;
    }
    if (!agent.commandTemplate.trim()) {
      set({ lastPermissionNotice: `"${agent.name}" has no command template. Expand the card and set a CLI command first.` });
      return;
    }
    if (!pane) {
      set({
        lastPermissionNotice:
          'Select a terminal pane first (click a pane), then press Run — or use “Run in new pane”.'
      });
      return;
    }

    const launched = await get().runAgentProfile(agent, pane, null);
    if (launched) {
      set({ lastPermissionNotice: null });
    }
  },

  runAgentInNewPane: async (agentId) => {
    const state = get();
    const agent = state.agentProfiles.find((item) => item.id === agentId);
    if (!agent) {
      set({ lastPermissionNotice: 'Agent profile not found.' });
      return;
    }
    if (!agent.commandTemplate.trim()) {
      set({ lastPermissionNotice: `"${agent.name}" has no command template. Expand the card and set a CLI command first.` });
      return;
    }

    const paneId = get().createPane(agent.name);
    if (!paneId) {
      set({ lastPermissionNotice: 'Could not create a terminal pane. Open a workspace first.' });
      return;
    }

    // Wait until the new PTY is ready so the CLI command is not dropped.
    const maxAttempts = 60;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const current = get();
      const workspace = current.workspaces.find((item) => item.id === current.activeWorkspaceId);
      const pane = workspace?.panes[paneId];
      if (!pane) {
        continue;
      }
      const ready =
        pane.processStatus === 'ready' ||
        pane.processStatus === 'running' ||
        pane.processStatus === 'idle';
      if (ready) {
        const launched = await get().runAgentProfile(agent, pane, null);
        if (launched) {
          set({ lastPermissionNotice: null });
        }
        return;
      }
    }

    set({
      lastPermissionNotice: `New pane created for ${agent.name}, but the terminal did not become ready in time. Click the pane and press Run again.`
    });
  },

  runAgentInAllPanes: async (agentId) => {
    const state = get();
    const agent = state.agentProfiles.find((item) => item.id === agentId);
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (!agent || !workspace) {
      return;
    }
    if (!agent.commandTemplate.trim()) {
      set({ lastPermissionNotice: `"${agent.name}" has no command template.` });
      return;
    }
    const panes = Object.values(workspace.panes);
    for (const pane of panes) {
      await get().runAgentProfile(agent, pane, null);
    }
  },

  runAgentsOnPanes: async (assignments) => {
    if (!assignments.length) {
      set({ lastPermissionNotice: 'Pick at least one pane → agent mapping before launching.' });
      return;
    }

    const state = get();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (!workspace) {
      set({ lastPermissionNotice: 'Open a workspace first.' });
      return;
    }

    // Remember the mapping so it survives app restart
    const assignmentMap: Record<string, AgentProfileId | ''> = {
      ...(workspace.paneAgentAssignments || {})
    };
    for (const { paneId, agentId } of assignments) {
      assignmentMap[paneId] = agentId;
    }
    get().setPaneAgentAssignments(workspace.id, assignmentMap);

    let launched = 0;
    let skipped = 0;
    const failures: string[] = [];

    // Sequential to keep store updates and terminal writes race-free.
    for (const { paneId, agentId } of assignments) {
      const current = get();
      const currentWorkspace = current.workspaces.find((item) => item.id === current.activeWorkspaceId);
      const agent = current.agentProfiles.find((item) => item.id === agentId);
      const pane = currentWorkspace?.panes[paneId];
      if (!agent || !pane) {
        skipped += 1;
        continue;
      }
      if (!agent.commandTemplate.trim()) {
        skipped += 1;
        failures.push(`"${agent.name}" has no command`);
        continue;
      }
      try {
        const ok = await get().runAgentProfile(agent, pane, null);
        if (ok) {
          launched += 1;
        } else {
          skipped += 1;
          failures.push(`${agent.name} → ${pane.title} failed`);
        }
      } catch (err) {
        skipped += 1;
        failures.push(err instanceof Error ? err.message : `${agent.name} failed`);
      }
    }

    if (launched === 0) {
      set({
        lastPermissionNotice:
          failures[0] || 'No agents launched. Check command templates and pane selection.'
      });
      return;
    }

    set({
      lastPermissionNotice:
        skipped > 0
          ? `Launched ${launched} agent${launched === 1 ? '' : 's'} (${skipped} skipped).${
              failures[0] ? ` ${failures[0]}` : ''
            }`
          : `Launched ${launched} agent${launched === 1 ? '' : 's'} across panes.`
    });
  },

  setPaneAgentAssignments: (workspaceId, assignments) => {
    set((current) => {
      const nextWorkspaces = current.workspaces.map((w) => {
        if (w.id !== workspaceId) return w;
        // Drop stale pane ids that no longer exist
        const cleaned: Record<string, AgentProfileId | ''> = {};
        for (const [paneId, agentId] of Object.entries(assignments)) {
          if (w.panes[paneId]) {
            cleaned[paneId] = agentId;
          }
        }
        return {
          ...w,
          paneAgentAssignments: cleaned,
          updatedAt: now()
        };
      });
      const next = { ...current, workspaces: nextWorkspaces };
      persist(next);
      return next;
    });
  },

  stopAllPanes: async () => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (!workspace) {
      return;
    }
    const paneIds = Object.keys(workspace.panes);
    for (const pid of paneIds) {
      void window.agentDeck.terminalKill(pid);
    }
  },

  closeAllPanes: () => {
    const state = get();
    const workspaceId = state.activeWorkspaceId;
    if (!workspaceId) return;

    set((state) => {
      const workspace = state.workspaces.find((w) => w.id === workspaceId);
      if (!workspace) return state;

      // 1. Kill all active terminal processes in main
      const currentPaneIds = Object.keys(workspace.panes);
      currentPaneIds.forEach((pid) => {
        void window.agentDeck.terminalKill(pid);
      });

      // 2. Clear panes and layout
      const updatedWorkspaces = state.workspaces.map((w) => {
        if (w.id === workspaceId) {
          return {
            ...w,
            updatedAt: now(),
            panes: {},
            layout: null,
            layoutJson: serializeLayout(null),
            savedLayout: null
          };
        }
        return w;
      });

      return {
        ...state,
        workspaces: updatedWorkspaces,
        activePaneId: null
      };
    });

    persist(get());
  },

  pauseAgentRun: (runId) => {
    const state = get();
    const run = state.agentRuns.find((r) => r.id === runId);
    if (!run || run.status !== 'running') {
      return;
    }
    set({
      agentRuns: state.agentRuns.map((r) =>
        r.id === runId ? { ...r, status: 'paused' as const } : r
      )
    });
    persist(get());
    void window.agentDeck.terminalPause(run.terminalSessionId);
  },

  resumeAgentRun: (runId) => {
    const state = get();
    const run = state.agentRuns.find((r) => r.id === runId);
    if (!run || run.status !== 'paused') {
      return;
    }
    set({
      agentRuns: state.agentRuns.map((r) =>
        r.id === runId ? { ...r, status: 'running' as const } : r
      )
    });
    persist(get());
    void window.agentDeck.terminalResume(run.terminalSessionId);
  },

  captureAgentRunChanges: async (runId) => {
    const state = get();
    const run = state.agentRuns.find((r) => r.id === runId);
    if (!run) {
      return;
    }

    const workspace = state.workspaces.find((w) => w.id === run.workspaceId);
    if (!workspace) {
      return;
    }

    try {
      const postRunStatus = await window.agentDeck.getGitWorkspaceStatus(workspace.rootPath);
      if (!postRunStatus || !postRunStatus.isRepo) {
        return;
      }

      const preMap = new Map<string, { code: string; line: string }>();
      if (run.preRunChanges) {
        for (const line of run.preRunChanges) {
          const code = line.slice(0, 2).trim();
          let pathPart = line.slice(2).trim();
          if (pathPart.startsWith('"') && pathPart.endsWith('"')) {
            pathPart = pathPart.slice(1, -1).replace(/\\"/g, '"');
          }
          if (code.startsWith('R') || pathPart.includes(' -> ')) {
            const arrowIndex = pathPart.indexOf(' -> ');
            if (arrowIndex !== -1) {
              pathPart = pathPart.slice(arrowIndex + 4).trim();
              if (pathPart.startsWith('"') && pathPart.endsWith('"')) {
                pathPart = pathPart.slice(1, -1).replace(/\\"/g, '"');
              }
            }
          }
          preMap.set(pathPart, { code, line });
        }
      }

      const changedFiles: AgentRunFileChange[] = [];
      const timestamp = Date.now();

      for (const line of postRunStatus.changedFiles || []) {
        const code = line.slice(0, 2).trim();
        let pathPart = line.slice(2).trim();
        let status: 'added' | 'modified' | 'deleted' | 'renamed' = 'modified';

        if (pathPart.startsWith('"') && pathPart.endsWith('"')) {
          pathPart = pathPart.slice(1, -1).replace(/\\"/g, '"');
        }

        if (code.startsWith('R') || pathPart.includes(' -> ')) {
          status = 'renamed';
          const arrowIndex = pathPart.indexOf(' -> ');
          if (arrowIndex !== -1) {
            pathPart = pathPart.slice(arrowIndex + 4).trim();
            if (pathPart.startsWith('"') && pathPart.endsWith('"')) {
              pathPart = pathPart.slice(1, -1).replace(/\\"/g, '"');
            }
          }
        } else if (code === 'M' || code.includes('M')) {
          status = 'modified';
        } else if (code === 'A' || code === '??' || code.includes('A')) {
          status = 'added';
        } else if (code === 'D' || code.includes('D')) {
          status = 'deleted';
        }

        const pre = preMap.get(pathPart);
        let isChanged = false;

        if (!pre) {
          isChanged = true;
        } else {
          const postNum = postRunStatus.numstat?.[pathPart] || { additions: 0, deletions: 0 };
          const preNum = run.preRunNumstat?.[pathPart] || { additions: 0, deletions: 0 };
          if (pre.code !== code || preNum.additions !== postNum.additions || preNum.deletions !== postNum.deletions) {
            isChanged = true;
          }
        }

        if (isChanged) {
          const numstat = postRunStatus.numstat?.[pathPart] || { additions: 0, deletions: 0 };
          changedFiles.push({
            filePath: pathPart,
            additions: numstat.additions,
            deletions: numstat.deletions,
            status,
            timestamp
          });
        }
      }

      if (run.preRunChanges) {
        for (const line of run.preRunChanges) {
          const code = line.slice(0, 2).trim();
          let pathPart = line.slice(2).trim();
          if (pathPart.startsWith('"') && pathPart.endsWith('"')) {
            pathPart = pathPart.slice(1, -1).replace(/\\"/g, '"');
          }
          if (code.startsWith('R') || pathPart.includes(' -> ')) {
            const arrowIndex = pathPart.indexOf(' -> ');
            if (arrowIndex !== -1) {
              pathPart = pathPart.slice(arrowIndex + 4).trim();
            }
          }

          const stillDirty = (postRunStatus.changedFiles || []).some(postLine => {
            let postPath = postLine.slice(2).trim();
            if (postPath.startsWith('"') && postPath.endsWith('"')) {
              postPath = postPath.slice(1, -1).replace(/\\"/g, '"');
            }
            if (postLine.slice(0, 2).trim().startsWith('R') || postPath.includes(' -> ')) {
              const arrowIdx = postPath.indexOf(' -> ');
              if (arrowIdx !== -1) {
                postPath = postPath.slice(arrowIdx + 4).trim();
              }
            }
            return postPath === pathPart;
          });

          if (!stillDirty) {
            changedFiles.push({
              filePath: pathPart,
              additions: 0,
              deletions: 0,
              status: 'modified',
              timestamp
            });
          }
        }
      }

      set((current) => ({
        agentRuns: current.agentRuns.map((r) =>
          r.id === runId ? { ...r, changedFiles } : r
        )
      }));
      persistImmediately(get());
    } catch (err) {
      console.error('Failed to capture agent run changes:', err);
    }
  },

  discardFileChanges: async (filePath) => {
    const state = get();
    const workspace = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
    if (!workspace) return;

    try {
      await get().createGitCheckpoint();
      await window.agentDeck.discardGitFileChanges(workspace.rootPath, filePath);
    } catch (err) {
      console.error('Failed to discard file changes:', err);
      throw err;
    }
  },

  discardAllWorkspaceChanges: async () => {
    const state = get();
    const workspace = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
    if (!workspace) return;

    try {
      await get().createGitCheckpoint();
      await window.agentDeck.discardAllGitChanges(workspace.rootPath);
    } catch (err) {
      console.error('Failed to discard all changes:', err);
      throw err;
    }
  },

  commitReviewedFiles: async (message) => {
    const state = get();
    const workspace = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
    if (!workspace || !message.trim()) return false;

    let reviewedMap: Record<string, boolean> = {};
    try {
      const stored = localStorage.getItem(`agentdeck:reviewed:${workspace.id}`);
      if (stored) {
        reviewedMap = JSON.parse(stored);
      }
    } catch (err) {
      console.error('Failed to parse reviewed files:', err);
    }

    const filesToCommit = Object.keys(reviewedMap).filter((path) => reviewedMap[path]);
    if (filesToCommit.length === 0) {
      return false;
    }

    try {
      await window.agentDeck.commitGitChanges(workspace.rootPath, filesToCommit, message);

      const nextReviewed = { ...reviewedMap };
      for (const filePath of filesToCommit) {
        delete nextReviewed[filePath];
      }
      localStorage.setItem(`agentdeck:reviewed:${workspace.id}`, JSON.stringify(nextReviewed));

      return true;
    } catch (err) {
      console.error('Failed to commit reviewed files:', err);
      throw err;
    }
  },

  updatePermissionPolicy: (patch) => {
    set((state) => ({ permissionPolicy: { ...state.permissionPolicy, ...patch } }));
    persist(get());
  },

  upsertWorkspaceTemplate: (template) => {
    const timestamp = now();
    set((state) => {
      const existing = template.id ? state.workspaceTemplates.find((item) => item.id === template.id) : null;
      const next: WorkspaceTemplate = {
        id: template.id ?? id('template'),
        name: template.name.trim(),
        description: template.description ?? existing?.description ?? '',
        paneTitles: template.paneTitles.map((title) => title.trim()).filter(Boolean),
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp
      };
      return {
        workspaceTemplates: existing
          ? state.workspaceTemplates.map((item) => (item.id === next.id ? next : item))
          : [next, ...state.workspaceTemplates]
      };
    });
    persist(get());
  },

  deleteWorkspaceTemplate: (templateId) => {
    set((state) => ({ workspaceTemplates: state.workspaceTemplates.filter((template) => template.id !== templateId) }));
    persist(get());
  },

  createProjectNote: (title, body) => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId || !title.trim()) {
      return;
    }

    const note: ProjectNote = {
      id: id('note'),
      workspaceId,
      title: title.trim(),
      body,
      createdAt: now(),
      updatedAt: now()
    };
    set((state) => ({ projectNotes: [note, ...state.projectNotes] }));
    persist(get());
  },

  updateProjectNote: (noteId, patch) => {
    set((state) => ({
      projectNotes: state.projectNotes.map((note) =>
        note.id === noteId ? { ...note, ...patch, updatedAt: now() } : note
      )
    }));
    persist(get());
  },

  deleteProjectNote: (noteId) => {
    set((state) => ({ projectNotes: state.projectNotes.filter((note) => note.id !== noteId) }));
    persist(get());
  },

  generateReviewReport: async () => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (!workspace) {
      return;
    }

    const workspacePaneIds = new Set(Object.keys(workspace.panes));
    const workspaceTasks = state.tasks.filter((task) => task.paneId === null || workspacePaneIds.has(task.paneId));
    const notes = state.projectNotes.filter((note) => note.workspaceId === workspace.id);
    const runs = state.agentRuns.filter((run) => run.workspaceId === workspace.id).slice(0, 12);
    const agentsById = new Map(state.agentProfiles.map((agent) => [agent.id, agent]));
    const logEntries = await readWorkspaceLogEntries(workspace);
    const errors = recentErrorLines(logEntries);
    const commands = logEntries.filter((entry) => entry.direction === 'input').slice(-20);
    const git = await window.agentDeck.getGitWorkspaceStatus(workspace.rootPath).catch((error: unknown) => ({
      isRepo: false,
      changedFiles: [],
      statusText: 'Git status failed.',
      diffStat: '',
      error: error instanceof Error ? error.message : 'Git status failed.'
    }));
    const likelyChangedFiles = git.changedFiles.length ? git.changedFiles : ['No current Git changes detected.'];
    const finalStatus =
      workspaceTasks.length && workspaceTasks.every((task) => task.status === 'done')
        ? 'All tracked tasks are done.'
        : runs.some((run) => run.status === 'failed') || errors.length
          ? 'Needs review: failed runs or errors were found.'
          : 'In progress.';
    const nextAction = finalStatus.startsWith('Needs review')
      ? 'Inspect the listed errors and rerun the relevant task or agent.'
      : workspaceTasks.some((task) => task.status !== 'done')
        ? 'Continue the remaining non-done tasks.'
        : 'Export the report or archive this workspace state.';
    const body = [
      `# Review report: ${workspace.name}`,
      '',
      `Generated: ${new Date().toLocaleString()}`,
      `Project path: ${workspace.rootPath}`,
      '',
      '## Task summary',
      ...workspaceTasks.map(
        (task) =>
          `- [${task.status}] ${task.title}${task.agentId ? ` (agent: ${agentsById.get(task.agentId)?.name ?? task.agentId})` : ''}`
      ),
      workspaceTasks.length ? '' : '_No tasks tracked._',
      '',
      '## Agent profiles and runs',
      ...runs.map(
        (run) =>
          `- ${run.status}: ${agentsById.get(run.agentProfileId)?.name ?? run.agentProfileId} ran \`${run.command}\` in ${run.terminalSessionId}`
      ),
      runs.length ? '' : '_No recent agent runs._',
      '',
      '## Commands run',
      ...commands.map(
        (entry) => `- ${new Date(entry.timestamp).toLocaleString()} [${entry.sessionId}] ${entry.text.trim()}`
      ),
      commands.length ? '' : '_No commands captured yet._',
      '',
      '## Files likely changed',
      ...likelyChangedFiles.map((file) => `- ${file}`),
      git.diffStat ? markdownCode(git.diffStat) : '',
      '',
      '## Errors found',
      ...errors.map(
        (entry) => `- ${new Date(entry.timestamp).toLocaleString()} [${entry.sessionId}] ${entry.text.trim()}`
      ),
      errors.length ? '' : '_No recent error lines found in terminal logs._',
      '',
      '## Final status',
      finalStatus,
      '',
      '## Next recommended action',
      nextAction,
      '',
      '## Manual notes',
      ...notes.flatMap((note) => [`### ${note.title}`, note.body || '_No details._', '']),
      notes.length ? '' : '_No manual notes._',
      '',
      '## Data sources',
      '- Task board state',
      '- Agent run records',
      '- Structured terminal JSONL logs',
      '- Git status summary',
      '- Project notes'
    ]
      .filter((line) => line !== undefined)
      .join('\n');
    const report: ReviewReport = {
      id: id('report'),
      workspaceId: workspace.id,
      title: `${workspace.name}-review-${new Date().toISOString().slice(0, 10)}`,
      body,
      createdAt: now()
    };

    set((current) => ({ reviewReports: [report, ...current.reviewReports], gitCheckpoint: git.statusText }));
    persistImmediately(get());
  },

  exportReviewReport: async (reportId) => {
    const report = get().reviewReports.find((item) => item.id === reportId);
    if (!report) {
      return;
    }

    const filePath = await window.agentDeck.exportReviewReport(report);
    set({ lastExportPath: filePath });
  },

  exportWorkspaceReport: async () => {
    const state = get();
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    if (!workspace) {
      return;
    }

    const workspacePaneIds = new Set(Object.keys(workspace.panes));
    const activePanes = Object.values(workspace.panes).filter(
      (pane) =>
        pane.processStatus !== 'restored' &&
        pane.processStatus !== 'exited' &&
        pane.processStatus !== 'crashed' &&
        pane.processStatus !== 'killed'
    );
    const workspaceTasks = state.tasks.filter((task) => task.paneId === null || workspacePaneIds.has(task.paneId));
    const tasksByStatus = taskStatuses.map((status) => ({
      status,
      tasks: workspaceTasks.filter((task) => task.status === status)
    }));
    const recentRuns = state.agentRuns.filter((run) => run.workspaceId === workspace.id).slice(0, 10);
    const notes = state.projectNotes.filter((note) => note.workspaceId === workspace.id);
    const logEntries = await readWorkspaceLogEntries(workspace);
    const errors = recentErrorLines(logEntries, 15);
    const git = await window.agentDeck.getGitWorkspaceStatus(workspace.rootPath).catch((error: unknown) => ({
      isRepo: false,
      changedFiles: [],
      statusText: 'Git status failed.',
      diffStat: '',
      error: error instanceof Error ? error.message : 'Git status failed.'
    }));
    const body = [
      `# Workspace report: ${workspace.name}`,
      '',
      `Generated: ${new Date().toLocaleString()}`,
      `Project path: ${workspace.rootPath}`,
      '',
      '## Active terminal sessions',
      ...activePanes.map(
        (pane) => `- ${pane.title} (${pane.id}) — ${pane.processStatus}, cwd: ${pane.cwd}, log: ${pane.logPath}`
      ),
      activePanes.length ? '' : '_No active terminal sessions._',
      '',
      '## Tasks by status',
      ...tasksByStatus.flatMap(({ status, tasks }) => [
        `### ${status}`,
        ...(tasks.length ? tasks.map((task) => `- ${task.title}`) : ['_None_']),
        ''
      ]),
      '## Recent agent runs',
      ...recentRuns.map((run) => `- ${run.status}: \`${run.command}\` in ${run.terminalSessionId} (${run.logPath})`),
      recentRuns.length ? '' : '_No recent agent runs._',
      '',
      '## Recent errors',
      ...errors.map(
        (entry) => `- ${new Date(entry.timestamp).toLocaleString()} [${entry.sessionId}] ${entry.text.trim()}`
      ),
      errors.length ? '' : '_No recent error lines found._',
      '',
      '## Links to logs',
      ...Object.values(workspace.panes).map((pane) => `- ${pane.title}: ${pane.logPath}`),
      '',
      '## Git status',
      markdownCode([git.statusText, git.diffStat].filter(Boolean).join('\n\n')),
      '',
      '## Manual notes',
      ...notes.flatMap((note) => [`### ${note.title}`, note.body || '_No details._', '']),
      notes.length ? '' : '_No manual notes._'
    ].join('\n');
    const filePath = await window.agentDeck.exportReviewReport({
      id: id('workspace-report'),
      workspaceId: workspace.id,
      title: `${workspace.name}-workspace-${new Date().toISOString().slice(0, 10)}`,
      body,
      createdAt: now()
    });
    set({ lastExportPath: filePath });
  },

  createGitCheckpoint: async () => {
    const workspace = get().workspaces.find((item) => item.id === get().activeWorkspaceId);
    if (!workspace) {
      return;
    }

    const gitCheckpoint = await window.agentDeck
      .createGitCheckpoint(workspace.path)
      .catch((error: unknown) => (error instanceof Error ? error.message : 'Git checkpoint failed.'));
    set({ gitCheckpoint });
  },

  createSkill: (skillDraft) => {
    const timestamp = now();
    const newSkill: Skill = {
      id: id('skill'),
      name: skillDraft.name.trim(),
      description: skillDraft.description.trim(),
      promptTemplate: skillDraft.promptTemplate,
      allowedTools: skillDraft.allowedTools,
      fileScope: skillDraft.fileScope,
      version: skillDraft.version || '1.0.0',
      isSystem: false,
      updatedAt: timestamp
    };
    set((state) => ({ skills: [...state.skills, newSkill] }));
    persist(get());
  },

  updateSkill: (skillId, patch) => {
    const timestamp = now();
    set((state) => ({
      skills: state.skills.map((skill) =>
        skill.id === skillId && !skill.isSystem
          ? { ...skill, ...patch, updatedAt: timestamp }
          : skill
      )
    }));
    persist(get());
  },

  deleteSkill: (skillId) => {
    const target = get().skills.find((s) => s.id === skillId);
    if (!target) return;

    set((state) => {
      const nextRemoved =
        target.isSystem && !state.removedSystemSkillIds?.includes(skillId)
          ? [...(state.removedSystemSkillIds || []), skillId]
          : state.removedSystemSkillIds || [];

      return {
        skills: state.skills.filter((skill) => skill.id !== skillId),
        removedSystemSkillIds: nextRemoved,
        pinnedSkillIds: (state.pinnedSkillIds || []).filter((id) => id !== skillId),
        tasks: state.tasks.map((task) =>
          task.skillId === skillId ? { ...task, skillId: null, updatedAt: now() } : task
        )
      };
    });
    persist(get());
  },

  deleteAllCustomSkills: () => {
    set((state) => {
      const customSkillIds = new Set(state.skills.filter((s) => !s.isSystem).map((s) => s.id));
      if (customSkillIds.size === 0) return state;
      return {
        skills: state.skills.filter((s) => s.isSystem),
        pinnedSkillIds: (state.pinnedSkillIds || []).filter((id) => !customSkillIds.has(id)),
        tasks: state.tasks.map((task) =>
          task.skillId && customSkillIds.has(task.skillId) ? { ...task, skillId: null, updatedAt: now() } : task
        )
      };
    });
    persist(get());
  },

  togglePinSkill: (skillId: SkillId) => {
    set((state) => {
      if (!state.skills.some((s) => s.id === skillId)) return state;
      const pinned = state.pinnedSkillIds || [];
      const next = pinned.includes(skillId)
        ? pinned.filter((id) => id !== skillId)
        : [...pinned, skillId];
      return { pinnedSkillIds: next };
    });
    persist(get());
  },

  moveSkill: (draggedId, overId, place = 'before') => {
    if (draggedId === overId) return;
    let changed = false;
    set((state) => {
      const skills = [...state.skills];
      const from = skills.findIndex((s) => s.id === draggedId);
      if (from < 0) return state;
      const [item] = skills.splice(from, 1);
      let insertAt = skills.findIndex((s) => s.id === overId);
      if (insertAt < 0) {
        // target gone — put back
        skills.splice(from, 0, item);
        return state;
      }
      if (place === 'after') insertAt += 1;
      // Already in this slot?
      if (insertAt === from) {
        skills.splice(from, 0, item);
        return state;
      }
      skills.splice(insertAt, 0, item);
      // No-op if order identical
      if (skills.every((s, i) => s.id === state.skills[i]?.id)) return state;
      changed = true;
      return { skills };
    });
    if (changed) persist(get());
  },

  assignSkillToTask: (taskId, skillId) => {
    get().updateTask(taskId, { skillId });
  },

  generateContext: async (workspaceId) => {
    const state = get();
    const workspace = state.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;

    try {
      const context = await window.agentDeck.generateProjectContext(workspace.rootPath);
      set((current) => ({
        workspaces: mutateWorkspace(current.workspaces, workspaceId, (w) => ({
          ...w,
          context,
          updatedAt: now()
        }))
      }));
      persistImmediately(get());
    } catch (err) {
      console.error('Failed to generate project context:', err);
    }
  },

  cancelAssistantRequest: () => {
    const rid = get().assistantRequestId;
    if (rid && typeof window !== 'undefined' && window.agentDeck?.cancelAssistantChat) {
      void window.agentDeck.cancelAssistantChat(rid);
    }
    set({ assistantBusy: false, assistantRequestId: null });
  },

  sendAssistantMessage: async (content, images, options) => {
    const state = get();
    const activeWorkspace = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
    const attached = Array.isArray(images) ? images.slice(0, 4) : [];
    const text =
      content.trim() ||
      (attached.length
        ? `Please analyze the attached image${attached.length > 1 ? 's' : ''}.`
        : '');

    if (!text && attached.length === 0) return 'ok';
    if (options?.signal?.aborted) return 'cancelled';

    const requestId =
      options?.requestId || `assist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const userMsg: AssistantMessage = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: text,
      images: attached.length ? attached : undefined,
      timestamp: Date.now()
    };

    // Optimistic user bubble + global thinking (AI Explain can switch tab immediately)
    set((current) => ({
      assistantMessages: trimAssistantHistory([...current.assistantMessages, userMsg]),
      assistantBusy: true,
      assistantRequestId: requestId
    }));

    let result: 'ok' | 'cancelled' = 'ok';

    try {
      let recentErrors: string[] = [];
      if (activeWorkspace) {
        try {
          const logEntries = await readWorkspaceLogEntries(activeWorkspace);
          recentErrors = recentErrorLines(logEntries, 8).map((e) => e.text);
        } catch (err) {
          console.error('Failed to read logs for assistant:', err);
        }
      }

      if (options?.signal?.aborted) {
        result = 'cancelled';
        return result;
      }

      const latest = get();
      const activePane =
        activeWorkspace && latest.activePaneId ? activeWorkspace.panes[latest.activePaneId] : null;
      const runningAgentsCount = latest.agentRuns.filter((r) => r.status === 'running').length;

      const storeContext: StoreContext = {
        activeWorkspaceName: activeWorkspace ? activeWorkspace.name : null,
        activeWorkspacePath: activeWorkspace ? activeWorkspace.rootPath : null,
        activePaneId: latest.activePaneId,
        activePaneTitle: activePane ? activePane.title : null,
        tasks: latest.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          body: t.body || '',
          status: t.status,
          priority: t.priority || 'medium'
        })),
        agentProfiles: latest.agentProfiles.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || ''
        })),
        runningAgentsCount,
        recentErrors
      };

      // Prefer Settings → AI Models (LLM) when configured (same localStorage as Design Engine)
      let assistantMsg: AssistantMessage | null = null;
      const llmSettings = readAgentDeckLlmSettings();
      if (llmSettings && typeof window !== 'undefined' && window.agentDeck?.assistantChatLLM) {
        try {
          // History already includes optimistic userMsg — avoid duplicating it in the payload
          const history = latest.assistantMessages
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .slice(-16)
            .map((m) => ({
              role: m.role as 'user' | 'assistant',
              content:
                m.content +
                (m.images?.length
                  ? `\n[Previously attached ${m.images.length} image(s) — not re-sent]`
                  : ''),
              images:
                m.id === userMsg.id
                  ? attached.map((img) => ({
                      mimeType: img.mimeType,
                      data: img.dataUrl
                    }))
                  : (undefined as { mimeType: string; data: string }[] | undefined)
            }));

          const systemPrompt =
            buildAssistantSystemPrompt(storeContext) +
            (attached.length
              ? '\nThe user may attach screenshots/images. Describe and reason about them when present.'
              : '');
          const res = await window.agentDeck.assistantChatLLM({
            settings: llmSettings,
            systemPrompt,
            messages: history,
            requestId
          });
          if (options?.signal?.aborted) {
            result = 'cancelled';
            return result;
          }
          if (res.ok && res.data?.content?.trim()) {
            assistantMsg = {
              id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              role: 'assistant',
              content: res.data.content.trim(),
              action: null,
              timestamp: Date.now()
            };
          } else if (!res.ok) {
            const errMsg = res.error?.message || '';
            if (/CANCELLED|AbortError|aborted/i.test(errMsg)) {
              result = 'cancelled';
              return result;
            }
            console.warn('[Assist] LLM failed, falling back offline:', res.error);
            // Prefer offline diff explain when LLM fails mid-request
            const offline = tryOfflineDiffExplain(text);
            if (offline) {
              assistantMsg = {
                id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                role: 'assistant',
                content: `${offline}\n\n_(LLM request failed: ${errMsg || 'unknown error'})_`,
                action: null,
                timestamp: Date.now()
              };
            }
          }
        } catch (err) {
          const name = err instanceof Error ? err.name : '';
          const msg = err instanceof Error ? err.message : String(err);
          if (name === 'AbortError' || /CANCELLED|aborted/i.test(msg) || options?.signal?.aborted) {
            result = 'cancelled';
            return result;
          }
          console.warn('[Assist] LLM error, falling back offline:', err);
        }
      }

      if (options?.signal?.aborted) {
        result = 'cancelled';
        return result;
      }

      if (!assistantMsg) {
        if (attached.length && !llmSettings) {
          assistantMsg = {
            id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            role: 'assistant',
            content:
              'Image attached, but no LLM is configured. Open Settings → AI Models and set a vision-capable provider (e.g. 9router / OpenAI / Gemini).',
            action: null,
            timestamp: Date.now()
          };
        } else if (attached.length) {
          assistantMsg = {
            id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            role: 'assistant',
            content:
              'Could not reach the LLM with your image. Check Settings → AI Models (model must support vision) and that 9router/API is running.',
            action: null,
            timestamp: Date.now()
          };
        } else {
          const rawReply = generateAssistantResponse(text, storeContext);
          // Dedupe against messages before this turn's user bubble
          assistantMsg = dedupeAssistantReply(
            rawReply,
            get().assistantMessages.filter((m) => m.id !== userMsg.id)
          );
        }
      }

      if (options?.signal?.aborted) {
        result = 'cancelled';
        return result;
      }

      set((current) => {
        // User bubble already in store — only append assistant reply
        const messages = trimAssistantHistory([...current.assistantMessages, assistantMsg!]);
        return { assistantMessages: messages };
      });

      persist(get());
      result = 'ok';
      return result;
    } finally {
      // Clear thinking whenever this request finishes (ok / cancelled / error)
      const stillThisRequest = get().assistantRequestId === requestId;
      if (stillThisRequest) {
        set({ assistantBusy: false, assistantRequestId: null });
      }
    }
  },

  executeAssistantAction: async (messageId) => {
    const state = get();
    const msgIndex = state.assistantMessages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    const msg = state.assistantMessages[msgIndex];
    if (!msg.action || msg.action.executed) return;

    const action = msg.action;

    try {
      if (action.kind === 'create_task') {
        const payload = action.payload as { title: string; body: string };
        state.createTask(payload.title, payload.body);
      } else if (action.kind === 'run_task') {
        const payload = action.payload as { taskId: TaskId };
        await state.runTaskInPane(payload.taskId);
      } else if (action.kind === 'read_logs') {
        state.setRightTab('logs');
      } else if (action.kind === 'scan_context') {
        if (state.activeWorkspaceId) {
          await state.generateContext(state.activeWorkspaceId);
        }
      } else if (action.kind === 'generate_report') {
        await state.generateReviewReport();
      } else if (action.kind === 'start_workflow') {
        state.setRightTab('workflow');
      }
    } catch (err) {
      console.error(`Failed to execute assistant action ${action.kind}:`, err);
    }

    set((current) => {
      const messages = [...current.assistantMessages];
      const targetMsg = messages.find((m) => m.id === messageId);
      if (targetMsg && targetMsg.action) {
        targetMsg.action = { ...targetMsg.action, executed: true };
      }
      return { assistantMessages: messages };
    });

    persist(get());
  },

  dismissAssistantAction: (messageId) => {
    set((current) => {
      const messages = [...current.assistantMessages];
      const targetMsg = messages.find((m) => m.id === messageId);
      if (targetMsg && targetMsg.action) {
        targetMsg.action = { ...targetMsg.action, executed: true };
      }
      return { assistantMessages: messages };
    });
    persist(get());
  },

  clearAssistantMessages: () => {
    set({ assistantMessages: [] });
    persist(get());
  },

  createWorkflow: (name, steps, taskId = null) => {
    const state = get();
    if (!name.trim()) return;
    const activeWorkspaceId = state.activeWorkspaceId;
    if (!activeWorkspaceId) return;

    const workflow: Workflow = {
      id: `wf-${now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      description: 'Custom User Workflow',
      steps,
      status: 'idle',
      currentStepIndex: 0,
      taskId,
      workspaceId: activeWorkspaceId,
      paneId: null,
      createdAt: now(),
      updatedAt: now(),
      completedAt: null,
      log: [
        {
          timestamp: now(),
          stepIndex: -1,
          message: `Custom workflow "${name}" created.`,
          level: 'info'
        }
      ]
    };

    set((current) => ({ workflows: [workflow, ...current.workflows] }));
    persist(get());
  },

  createWorkflowFromTemplate: (templateId, taskId = null) => {
    const state = get();
    const activeWorkspaceId = state.activeWorkspaceId;
    if (!activeWorkspaceId) return;

    const templates = getBuiltinTemplates();
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    let taskTitle = '';
    let taskDescription = '';
    if (taskId) {
      const task = state.tasks.find((t) => t.id === taskId);
      if (task) {
        taskTitle = task.title;
        taskDescription = task.body;
      }
    }

    const workflow = engineCreateWorkflow(
      template,
      activeWorkspaceId,
      taskId,
      taskTitle,
      taskDescription,
      state.agentProfiles,
      state.skills
    );

    set((current) => ({ workflows: [workflow, ...current.workflows] }));
    persist(get());
  },

  deleteWorkflow: (workflowId) => {
    set((current) => ({
      workflows: current.workflows.filter((w) => w.id !== workflowId)
    }));
    persist(get());
  },

  startWorkflow: async (workflowId, paneId) => {
    const state = get();
    const workflow = state.workflows.find((w) => w.id === workflowId);
    if (!workflow || workflow.status === 'running') return;

    const workspace = state.workspaces.find((w) => w.id === workflow.workspaceId);
    const targetPaneId = paneId ?? workflow.paneId ?? state.activePaneId;
    const pane = targetPaneId ? workspace?.panes[targetPaneId] : null;

    if (!workspace || !pane) {
      set({ lastPermissionNotice: 'Select or assign a pane before starting the workflow.' });
      return;
    }

    set((current) => ({
      workflows: current.workflows.map((w) => {
        if (w.id === workflowId) {
          return {
            ...w,
            status: 'running' as const,
            paneId: pane.id,
            updatedAt: now(),
            log: [
              ...w.log,
              {
                timestamp: now(),
                stepIndex: -1,
                message: `Workflow started in pane "${pane.title}"`,
                level: 'info'
              }
            ]
          };
        }
        return w;
      })
    }));
    persistImmediately(get());

    await get().executeWorkflowStep(workflowId, workflow.currentStepIndex);
  },

  pauseWorkflow: (workflowId) => {
    const state = get();
    const workflow = state.workflows.find((w) => w.id === workflowId);
    if (!workflow || workflow.status !== 'running') return;

    const activeStep = workflow.steps[workflow.currentStepIndex];
    if (activeStep && activeStep.runId) {
      get().pauseAgentRun(activeStep.runId);
    }

    set((current) => ({
      workflows: current.workflows.map((w) => {
        if (w.id === workflowId) {
          return {
            ...w,
            status: 'paused' as const,
            updatedAt: now(),
            log: [
              ...w.log,
              {
                timestamp: now(),
                stepIndex: w.currentStepIndex,
                message: 'Workflow paused by user.',
                level: 'warn'
              }
            ]
          };
        }
        return w;
      })
    }));
    persist(get());
  },

  resumeWorkflow: async (workflowId) => {
    const state = get();
    const workflow = state.workflows.find((w) => w.id === workflowId);
    if (!workflow || workflow.status !== 'paused') return;

    const activeStep = workflow.steps[workflow.currentStepIndex];
    if (activeStep && activeStep.runId) {
      get().resumeAgentRun(activeStep.runId);
    }

    set((current) => ({
      workflows: current.workflows.map((w) => {
        if (w.id === workflowId) {
          return {
            ...w,
            status: 'running' as const,
            updatedAt: now(),
            log: [
              ...w.log,
              {
                timestamp: now(),
                stepIndex: w.currentStepIndex,
                message: 'Workflow resumed by user.',
                level: 'info'
              }
            ]
          };
        }
        return w;
      })
    }));
    persistImmediately(get());

    if (!activeStep || !activeStep.runId) {
      await get().executeWorkflowStep(workflowId, workflow.currentStepIndex);
    }
  },

  retryWorkflowStep: async (workflowId, stepIndex) => {
    const state = get();
    const workflow = state.workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    set((current) => ({
      workflows: current.workflows.map((w) => {
        if (w.id === workflowId) {
          const nextSteps = [...w.steps];
          nextSteps[stepIndex] = {
            ...nextSteps[stepIndex],
            status: 'pending' as const,
            retryCount: nextSteps[stepIndex].retryCount + 1,
            startedAt: null,
            finishedAt: null,
            errorSummary: ''
          };
          return {
            ...w,
            status: 'running' as const,
            currentStepIndex: stepIndex,
            steps: nextSteps,
            updatedAt: now(),
            log: [
              ...w.log,
              {
                timestamp: now(),
                stepIndex,
                message: `User triggered retry for step "${nextSteps[stepIndex].label}"`,
                level: 'info'
              }
            ]
          };
        }
        return w;
      })
    }));
    persistImmediately(get());

    await get().executeWorkflowStep(workflowId, stepIndex);
  },

  skipWorkflowStep: (workflowId, stepIndex) => {
    const state = get();
    const workflow = state.workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    const currentStep = workflow.steps[stepIndex];
    const timestamp = now();
    const nextIdx = stepIndex + 1;
    const isLast = nextIdx >= workflow.steps.length;

    set((current) => ({
      workflows: current.workflows.map((w) => {
        if (w.id === workflowId) {
          const nextSteps = [...w.steps];
          nextSteps[stepIndex] = {
            ...nextSteps[stepIndex],
            status: 'skipped' as const,
            finishedAt: timestamp
          };

          const isCompleted = isLast;
          const status = isCompleted ? ('completed' as const) : w.status === 'failed' ? ('running' as const) : w.status;
          const currentStepIndex = isCompleted ? stepIndex : nextIdx;

          const log = [
            ...w.log,
            {
              timestamp,
              stepIndex,
              message: `User skipped step "${currentStep.label}"`,
              level: 'warn' as const
            }
          ];

          if (isCompleted) {
            log.push({
              timestamp,
              stepIndex: -1,
              message: 'Workflow completed successfully (with skipped steps).',
              level: 'info'
            });
          } else {
            log.push({
              timestamp,
              stepIndex: nextIdx,
              message: `Moving to next step: "${nextSteps[nextIdx].label}"`,
              level: 'info'
            });
          }

          return {
            ...w,
            status,
            currentStepIndex,
            steps: nextSteps,
            completedAt: isCompleted ? timestamp : w.completedAt,
            updatedAt: timestamp,
            log
          };
        }
        return w;
      })
    }));
    persistImmediately(get());

    if (!isLast) {
      void get().executeWorkflowStep(workflowId, nextIdx);
    } else if (workflow.taskId) {
      get().updateTask(workflow.taskId, { status: 'review' });
    }
  },

  cancelWorkflow: (workflowId) => {
    const state = get();
    const workflow = state.workflows.find((w) => w.id === workflowId);
    if (!workflow) return;

    const activeStep = workflow.steps[workflow.currentStepIndex];
    if (activeStep && activeStep.runId) {
      const activeRun = state.agentRuns.find((r) => r.id === activeStep.runId);
      if (activeRun && activeRun.status === 'running' && workflow.paneId) {
        void window.agentDeck.terminalRestart({
          paneId: workflow.paneId,
          cwd: activeRun.logPath,
          cols: 80,
          rows: 24
        });
      }
    }

    set((current) => ({
      workflows: current.workflows.map((w) => {
        if (w.id === workflowId) {
          const nextSteps = [...w.steps];
          if (w.status === 'running' || w.status === 'paused') {
            nextSteps[w.currentStepIndex] = {
              ...nextSteps[w.currentStepIndex],
              status: 'failed' as const,
              errorSummary: 'Cancelled by user.'
            };
          }
          return {
            ...w,
            status: 'failed' as const,
            steps: nextSteps,
            updatedAt: now(),
            log: [
              ...w.log,
              {
                timestamp: now(),
                stepIndex: -1,
                message: 'Workflow cancelled by user.',
                level: 'error'
              }
            ]
          };
        }
        return w;
      })
    }));
    persist(get());
  },

  executeWorkflowStep: async (workflowId, stepIndex) => {
    const state = get();
    const workflow = state.workflows.find((w) => w.id === workflowId);
    if (!workflow || workflow.status !== 'running') return;

    const step = workflow.steps[stepIndex];
    if (!step) return;

    const agent = state.agentProfiles.find((p) => p.id === step.agentId);
    if (!agent) {
      set((current) => ({
        workflows: current.workflows.map((w) => {
          if (w.id === workflowId) {
            const nextSteps = [...w.steps];
            nextSteps[stepIndex] = {
              ...nextSteps[stepIndex],
              status: 'failed' as const,
              errorSummary: `Agent profile not found for step.`
            };
            return {
              ...w,
              steps: nextSteps,
              status: 'failed' as const,
              updatedAt: now(),
              log: [
                ...w.log,
                {
                  timestamp: now(),
                  stepIndex,
                  message: `Error: Agent profile with ID ${step.agentId} not found.`,
                  level: 'error'
                }
              ]
            };
          }
          return w;
        })
      }));
      persist(get());
      return;
    }

    const workspace = state.workspaces.find((w) => w.id === workflow.workspaceId);
    const pane = workflow.paneId ? workspace?.panes[workflow.paneId] : null;
    if (!workspace || !pane) return;

    let previousStepSummary = '';
    if (stepIndex > 0) {
      const prevStep = workflow.steps[stepIndex - 1];
      if (prevStep && prevStep.runId) {
        const prevRun = state.agentRuns.find((r) => r.id === prevStep.runId);
        if (prevRun && prevRun.summary) {
          previousStepSummary = prevRun.summary;
        }
      }
    }

    const compiledBody = buildStepPrompt(step, workflow, previousStepSummary);

    const dummyTask: DeckTask = {
      id: workflow.taskId || id('task'),
      title: `${workflow.name} - ${step.label}`,
      body: compiledBody,
      status: 'running',
      paneId: pane.id,
      agentId: agent.id,
      skillId: step.skillId,
      createdAt: now(),
      updatedAt: now()
    };

    set((current) => ({
      workflows: current.workflows.map((w) => {
        if (w.id === workflowId) {
          const nextSteps = [...w.steps];
          nextSteps[stepIndex] = {
            ...nextSteps[stepIndex],
            status: 'running' as const,
            startedAt: now()
          };
          return {
            ...w,
            steps: nextSteps,
            updatedAt: now(),
            log: [
              ...w.log,
              {
                timestamp: now(),
                stepIndex,
                message: `Executing step "${step.label}" using agent "${agent.name}"`,
                level: 'info'
              }
            ]
          };
        }
        return w;
      })
    }));
    persistImmediately(get());

    const success = await get().runAgentProfile(agent, pane, dummyTask);
    if (!success) {
      set((current) => ({
        workflows: current.workflows.map((w) => {
          if (w.id === workflowId) {
            const nextSteps = [...w.steps];
            nextSteps[stepIndex] = {
              ...nextSteps[stepIndex],
              status: 'failed' as const,
              errorSummary: 'Failed to launch agent profile.'
            };
            return {
              ...w,
              steps: nextSteps,
              status: 'failed' as const,
              updatedAt: now(),
              log: [
                ...w.log,
                {
                  timestamp: now(),
                  stepIndex,
                  message: `Failed to launch agent profile "${agent.name}"`,
                  level: 'error'
                }
              ]
            };
          }
          return w;
        })
      }));
      persist(get());
      return;
    }

    setTimeout(() => {
      const updatedRuns = get().agentRuns;
      const latestRun = updatedRuns.find(
        (r) => r.agentProfileId === agent.id && r.terminalSessionId === pane.id && r.status === 'running'
      );
      if (latestRun) {
        set((current) => ({
          workflows: current.workflows.map((w) => {
            if (w.id === workflowId) {
              const nextSteps = [...w.steps];
              nextSteps[stepIndex] = {
                ...nextSteps[stepIndex],
                runId: latestRun.id
              };
              return {
                ...w,
                steps: nextSteps
              };
            }
            return w;
          })
        }));
        persist(get());
      }
    }, 200);
  },

  runProject: async (workspaceId, configId) => {
    const workspace = get().workspaces.find((w) => w.id === workspaceId);
    if (!workspace) return;

    const config = workspace.runConfigs?.find((c) => c.id === configId);
    if (!config) {
      throw new Error(`Run configuration with id ${configId} not found.`);
    }

    try {
      set((current) => ({
        projectRunStates: {
          ...current.projectRunStates,
          [workspaceId]: {
            status: 'starting',
            activeConfigId: configId,
            errors: []
          }
        }
      }));

      await window.agentDeck.projectRun(workspaceId, config);

      if (config.autoOpenPreview && config.previewUrl) {
        set({ rightTab: 'preview' });
      }
    } catch (err: any) {
      set((current) => ({
        projectRunStates: {
          ...current.projectRunStates,
          [workspaceId]: {
            status: 'failed',
            activeConfigId: configId,
            errors: [err.message || 'Failed to start project']
          }
        }
      }));
    }
  },

  stopProject: async (workspaceId) => {
    try {
      await window.agentDeck.projectStop(workspaceId);
    } catch (err: any) {
      console.error('Failed to stop project:', err);
    }
  },

  configureProjectRunConfigs: (workspaceId, configs, defaultConfigId) => {
    set((current) => {
      const nextWorkspaces = current.workspaces.map((w) => {
        if (w.id === workspaceId) {
          return {
            ...w,
            runConfigs: configs,
            defaultConfigId: defaultConfigId || w.defaultConfigId
          };
        }
        return w;
      });
      const next = { ...current, workspaces: nextWorkspaces };
      persist(next);
      return next;
    });
  },

  loadProjectStatus: async (workspaceId) => {
    try {
      const res = await window.agentDeck.projectStatus(workspaceId);
      if (res.ok) {
        set((current) => ({
          projectRunStates: {
            ...current.projectRunStates,
            [workspaceId]: {
              status: res.data.status as any,
              activeConfigId: res.data.activeConfigId,
              errors: res.data.errors
            }
          }
        }));
      }
    } catch (err) {
      console.error('Failed to load project status:', err);
    }
  },

  loadProjectLogs: async (workspaceId) => {
    try {
      const res = await window.agentDeck.projectReadLogs(workspaceId);
      if (res.ok) {
        set((current) => ({
          projectLogs: {
            ...current.projectLogs,
            [workspaceId]: res.data
          }
        }));
      }
    } catch (err) {
      console.error('Failed to load project logs:', err);
    }
  },

  addMcpConnection: (connection) => {
    const nextConnection: McpServerConnection = {
      id: `mcp-${now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: connection.name.trim(),
      url: connection.url.trim(),
      transport: connection.transport,
      authType: connection.authType,
      headersJson: connection.headersJson,
      bearerToken: connection.bearerToken,
      figmaToolName: connection.figmaToolName,
      status: 'disconnected',
      serverStatus: 'idle',
      authStatus: 'unknown',
      toolStatus: 'not_loaded',
      tools: [],
      permissions: connection.permissions || {
        readAllowed: true,
        writeConfirm: true,
        unknownConfirm: true
      }
    };
    set((state) => ({
      mcpConnections: [...(state.mcpConnections || []), nextConnection]
    }));
    persist(get());
  },

  updateMcpConnection: (id, patch) => {
    set((state) => ({
      mcpConnections: (state.mcpConnections || []).map((conn) =>
        conn.id === id ? { ...conn, ...patch } : conn
      )
    }));
    persist(get());
  },

  deleteMcpConnection: (id) => {
    set((state) => ({
      mcpConnections: (state.mcpConnections || []).filter((conn) => conn.id !== id)
    }));
    persist(get());
  },

  addDbConnection: async (connection) => {
    const state = get();
    const activeWorkspaceId = state.activeWorkspaceId;
    if (!activeWorkspaceId) return;

    const connectionId = `db-${now()}-${Math.random().toString(36).substr(2, 9)}`;
    const { password, connectionString, username, ...publicConfig } = connection as any;

    if (password || connectionString || username) {
      await window.agentDeck.databaseSaveSecrets(connectionId, password, connectionString, username);
    }

    const nextConnection: DbConnectionConfig = {
      id: connectionId,
      workspaceId: activeWorkspaceId,
      ...publicConfig,
      createdAt: now(),
      updatedAt: now()
    };

    set((current) => ({
      workspaces: current.workspaces.map((w) =>
        w.id === activeWorkspaceId
          ? { ...w, dbConnections: [...(w.dbConnections || []), nextConnection] }
          : w
      )
    }));
    persist(get());
  },

  updateDbConnection: async (connectionId, patch) => {
    const state = get();
    const activeWorkspaceId = state.activeWorkspaceId;
    if (!activeWorkspaceId) return;

    const { password, connectionString, username, ...publicPatch } = patch as any;

    if (password !== undefined || connectionString !== undefined || username !== undefined) {
      await window.agentDeck.databaseSaveSecrets(connectionId, password, connectionString, username);
    }

    set((current) => ({
      workspaces: current.workspaces.map((w) =>
        w.id === activeWorkspaceId
          ? {
              ...w,
              dbConnections: (w.dbConnections || []).map((conn) =>
                conn.id === connectionId ? { ...conn, ...publicPatch, updatedAt: now() } : conn
              )
            }
          : w
      )
    }));
    persist(get());
  },

  deleteDbConnection: (connectionId) => {
    const state = get();
    const activeWorkspaceId = state.activeWorkspaceId;
    if (!activeWorkspaceId) return;

    void window.agentDeck.databaseDeleteSecrets(connectionId);

    set((current) => ({
      workspaces: current.workspaces.map((w) =>
        w.id === activeWorkspaceId
          ? {
              ...w,
              dbConnections: (w.dbConnections || []).filter((conn) => conn.id !== connectionId)
            }
          : w
      )
    }));
    persist(get());
  },

  testMcpConnection: async (id) => {
    const conn = (get().mcpConnections || []).find((c) => c.id === id);
    if (!conn) return { ok: false, message: 'Connection not found' };

    get().updateMcpConnection(id, { status: 'testing', errorMessage: undefined });
    const timestamp = now();

    // 1. Mock Stdio Transport
    if (conn.transport === 'stdio') {
      await new Promise((resolve) => setTimeout(resolve, 800));
      get().updateMcpConnection(id, {
        status: 'connected',
        serverStatus: 'reachable',
        authStatus: 'authenticated',
        toolStatus: 'loaded',
        errorMessage: undefined,
        lastChecked: timestamp,
        tools: [
          {
            name: 'local_run_command',
            description: 'Run a command locally (stdio placeholder tool)',
            inputSchema: {
              type: 'object',
              properties: {
                command: { type: 'string', description: 'The command to execute' }
              },
              required: ['command']
            }
          }
        ]
      });
      return { ok: true, message: 'Local stdio connection simulated successfully. Stdio process initialized.' };
    }

    // 2. Mock OAuth status check
    if (conn.authType === 'oauth') {
      await new Promise((resolve) => setTimeout(resolve, 500));
      // In a real client, OAuth redirects or loads stored tokens. Since this is the UI/logic layer, we check if it is already "connected" (meaning they authorized it).
      // If it was already connected, testing keeps it connected. Otherwise, it asks for authorization.
      if (conn.status === 'connected') {
        get().updateMcpConnection(id, {
          status: 'connected',
          serverStatus: 'reachable',
          authStatus: 'authenticated',
          toolStatus: 'loaded',
          errorMessage: undefined,
          lastChecked: timestamp
        });
        return { ok: true, message: 'OAuth credentials valid. Connection successful.' };
      } else {
        get().updateMcpConnection(id, {
          status: 'auth_required',
          serverStatus: 'reachable',
          authStatus: 'required',
          toolStatus: 'setup_only',
          errorMessage: 'OAuth browser login required. Click "Connect" to authenticate.',
          lastChecked: timestamp,
          tools: [
            {
              name: 'authenticate',
              description: 'Start OAuth authentication flow'
            },
            {
              name: 'complete_authentication',
              description: 'Complete OAuth authentication with redirect callback'
            }
          ]
        });
        return { ok: false, message: 'OAuth Authentication Required' };
      }
    }

    // 3. Build headers for SSE/HTTP based on authType
    let headers: Record<string, string> = {};
    if (conn.authType === 'bearer' && conn.bearerToken) {
      headers = { Authorization: `Bearer ${conn.bearerToken.trim()}` };
    } else if (conn.authType === 'headers' && conn.headersJson) {
      try {
        headers = JSON.parse(conn.headersJson);
      } catch (err) {
        get().updateMcpConnection(id, {
          status: 'error',
          serverStatus: 'failed',
          authStatus: 'failed',
          toolStatus: 'failed',
          errorMessage: 'Invalid Headers JSON',
          lastChecked: timestamp
        });
        return { ok: false, message: 'Invalid Headers JSON format' };
      }
    }

    try {
      const headersStr = JSON.stringify(headers);
      const res = await window.agentDeck.mcpClientTestConnection(conn.url, headersStr);
      if (res.ok && res.data.ok) {
        // Fetch tools to check setup state
        const toolsRes = await window.agentDeck.mcpClientListTools(conn.url, headersStr);
        let tools: any[] = [];
        if (toolsRes.ok) {
          tools = toolsRes.data;
        }

        const setupToolNames = ['authenticate', 'complete_authentication', 'complete-authentication', 'auth', 'login'];
        const hasOnlySetupTools = tools.length > 0 && tools.every((t: any) => setupToolNames.includes(t.name));

        let status: 'connected' | 'auth_required' = 'connected';
        let serverStatus: 'reachable' = 'reachable';
        let authStatus: 'authenticated' | 'required' = 'authenticated';
        let toolStatus: 'loaded' | 'setup_only' = 'loaded';

        if (hasOnlySetupTools) {
          status = 'auth_required';
          authStatus = 'required';
          toolStatus = 'setup_only';
        }

        get().updateMcpConnection(id, {
          status,
          serverStatus,
          authStatus,
          toolStatus,
          tools,
          errorMessage: undefined,
          lastChecked: timestamp
        });

        if (hasOnlySetupTools) {
          return { ok: true, message: 'Server reachable, authentication not completed' };
        }
        return { ok: true, message: res.data.message };
      } else {
        const errMsg = res.ok ? res.data.message : res.error.message;
        get().updateMcpConnection(id, {
          status: 'error',
          serverStatus: 'failed',
          authStatus: 'failed',
          toolStatus: 'failed',
          errorMessage: errMsg,
          lastChecked: timestamp
        });
        return { ok: false, message: errMsg };
      }
    } catch (err: any) {
      const errMsg = err.message || String(err);
      get().updateMcpConnection(id, {
        status: 'error',
        serverStatus: 'failed',
        authStatus: 'failed',
        toolStatus: 'failed',
        errorMessage: errMsg,
        lastChecked: timestamp
      });
      return { ok: false, message: errMsg };
    }
  },

  loadMcpTools: async (id) => {
    const conn = (get().mcpConnections || []).find((c) => c.id === id);
    if (!conn) return;

    if (conn.transport === 'stdio') return; // stdio tools are set statically in connection test/mock

    let headers: Record<string, string> = {};
    if (conn.authType === 'bearer' && conn.bearerToken) {
      headers = { Authorization: `Bearer ${conn.bearerToken.trim()}` };
    } else if (conn.authType === 'headers' && conn.headersJson) {
      try {
        headers = JSON.parse(conn.headersJson);
      } catch {
        // ignore
      }
    }

    try {
      const headersStr = JSON.stringify(headers);
      const res = await window.agentDeck.mcpClientListTools(conn.url, headersStr);
      if (res.ok) {
        const tools = res.data;
        const setupToolNames = ['authenticate', 'complete_authentication', 'complete-authentication', 'auth', 'login'];
        const hasOnlySetupTools = tools.length > 0 && tools.every((t: any) => setupToolNames.includes(t.name));

        let status: 'connected' | 'auth_required' = 'connected';
        let serverStatus: 'reachable' = 'reachable';
        let authStatus: 'authenticated' | 'required' = 'authenticated';
        let toolStatus: 'loaded' | 'setup_only' = 'loaded';

        if (hasOnlySetupTools) {
          status = 'auth_required';
          authStatus = 'required';
          toolStatus = 'setup_only';
        }

        get().updateMcpConnection(id, {
          tools,
          status,
          serverStatus,
          authStatus,
          toolStatus
        });
      }
    } catch (err) {
      console.error('Failed to load MCP tools:', err);
    }
  },

  createFigmaBuildPlan: (selection, analysisResult) => {
    const timestamp = now();
    const newPlan: FigmaBuildPlan = {
      id: id('plan'),
      workspaceId: get().activeWorkspaceId || '',
      selectionId: selection.id,
      nodeName: selection.nodeName || 'Figma Frame',
      nodeType: selection.nodeType,
      analysis: analysisResult.analysis,
      tasks: analysisResult.tasks || [],
      currentTaskIndex: 0,
      status: 'draft',
      createdAt: timestamp,
      updatedAt: timestamp
    };
    set((state) => ({
      figmaBuildPlans: [newPlan, ...(state.figmaBuildPlans || [])],
      activeFigmaBuildPlanId: newPlan.id
    }));
    persist(get());
  },

  setActiveFigmaBuildPlan: (planId) => {
    set({ activeFigmaBuildPlanId: planId });
    persist(get());
  },

  updateFigmaBuildTaskStatus: (planId, taskId, status) => {
    set((state) => {
      const plan = (state.figmaBuildPlans || []).find((p) => p.id === planId);
      if (!plan) return state;

      const planTask = plan.tasks.find((t) => t.id === taskId);
      const kanbanTaskId = planTask?.kanbanTaskId;

      let nextAgentRuns = state.agentRuns;
      const timestamp = now();

      if (status === 'completed' && kanbanTaskId) {
        // Mark any active running agentRun for this task as finished!
        nextAgentRuns = state.agentRuns.map((run) => {
          if (run.taskId === kanbanTaskId && run.status === 'running') {
            return {
              ...run,
              status: 'finished' as const,
              finishedAt: timestamp,
              summary: 'Task approved via Figma Orchestrator.'
            };
          }
          return run;
        });
      }

      const nextPlans = (state.figmaBuildPlans || []).map((p) => {
        if (p.id !== planId) return p;
        return {
          ...p,
          tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
          updatedAt: timestamp
        };
      });

      return {
        ...state,
        agentRuns: nextAgentRuns,
        figmaBuildPlans: nextPlans
      };
    });
    persist(get());
  },

  dispatchFigmaBuildTask: async (planId, taskId, paneId, agentProfileId) => {
    const state = get();
    const plan = (state.figmaBuildPlans || []).find((p) => p.id === planId);
    if (!plan) return;

    const taskIndex = plan.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return;

    const planTask = plan.tasks[taskIndex];

    // 1. Create standard Kanban Task
    const newKanbanTask: DeckTask = {
      id: id('task'),
      title: `[Figma Build] ${planTask.title}`,
      body: planTask.promptPayload,
      status: 'todo',
      paneId: paneId || state.activePaneId || null,
      agentId: agentProfileId || null,
      priority: 'high',
      createdAt: now(),
      updatedAt: now()
    };

    set((state) => ({
      tasks: [newKanbanTask, ...(state.tasks || [])],
      figmaBuildPlans: (state.figmaBuildPlans || []).map((p) => {
        if (p.id !== planId) return p;
        return {
          ...p,
          tasks: p.tasks.map((t) =>
            t.id === taskId ? { ...t, status: 'running', kanbanTaskId: newKanbanTask.id } : t
          ),
          currentTaskIndex: taskIndex,
          status: 'running',
          updatedAt: now()
        };
      })
    }));
    persist(get());

    // 2. Dispatch to terminal agent
    try {
      await get().runTaskInPane(newKanbanTask.id);
    } catch (err) {
      console.error('Failed to run dispatched figma build task in pane:', err);
      get().updateFigmaBuildTaskStatus(planId, taskId, 'failed');
    }
  },

  deleteFigmaBuildPlan: (planId) => {
    set((state) => {
      const remaining = (state.figmaBuildPlans || []).filter((p) => p.id !== planId);
      const activeId = state.activeFigmaBuildPlanId === planId
        ? (remaining[0]?.id || null)
        : state.activeFigmaBuildPlanId;
      return {
        figmaBuildPlans: remaining,
        activeFigmaBuildPlanId: activeId
      };
    });
    persist(get());
  }
}));

export const taskStatuses: TaskStatus[] = ['todo', 'running', 'review', 'done'];

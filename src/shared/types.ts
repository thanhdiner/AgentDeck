export type PaneId = string;
export type WorkspaceId = string;
export type ProjectId = string;
export type TaskId = string;
export type AgentProfileId = string;
export type AgentRunId = string;
export type WorkspaceTemplateId = string;
export type ProjectNoteId = string;
export type ReviewReportId = string;
export type PermissionRuleId = string;
export type AppSettingKey = string;

export type SplitDirection = 'horizontal' | 'vertical';

export type TerminalProcessStatus =
  | 'new'
  | 'restored'
  | 'spawning'
  | 'ready'
  | 'running'
  | 'idle'
  | 'exited'
  | 'crashed'
  | 'killed';

export type TerminalLogDirection = 'input' | 'output' | 'system';

export type TerminalLogEntry = {
  timestamp: number;
  sessionId: PaneId;
  direction: TerminalLogDirection;
  text: string;
  agentType?: string;
  textLength?: number;
  attachmentCount?: number;
  attachmentIds?: string[];
  success?: boolean;
  error?: string;
  taskId?: string | null;
};

export type TerminalPaneConfig = {
  id: PaneId;
  title: string;
  cwd: string;
  shell: string | null;
  logPath: string;
  createdAt: number;
  processStatus: TerminalProcessStatus;
  lastStartedAt: number | null;
  lastReadyAt: number | null;
  lastActiveAt: number | null;
  lastExitedAt: number | null;
  lastExitCode: number | null;
  lastExitSignal: number | null;
};

export type PaneLayout =
  | {
      type: 'pane';
      paneId: PaneId;
    }
  | {
      type: 'split';
      id: string;
      direction: SplitDirection;
      ratio: number;
      first: PaneLayout;
      second: PaneLayout;
    };

export type ProjectContext = {
  techStack: string;
  folderStructure: string;
  codingRules: string;
  projectMemory: string;
  envExample?: string;
  keyModules?: string;
  updatedAt: number;
};

export type ProjectRunStatus = 'stopped' | 'starting' | 'running' | 'failed' | 'stopping';

export type RunConfig = {
  id: string;
  name: string;
  type: 'frontend' | 'backend' | 'fullstack' | 'custom';
  workingDirectory: string;
  command: string;
  previewUrl?: string;
  autoOpenPreview?: boolean;
  backendWorkingDirectory?: string;
  backendCommand?: string;
  frontendWorkingDirectory?: string;
  frontendCommand?: string;
  delayBetweenMs?: number;
};

export type ProjectInitStep = {
  id: string;
  label: string;
  command: string;
  enabled: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed';
};

export type ProjectInitConfig = {
  projectName: string;
  description: string;
  projectType: 'web' | 'desktop' | 'mobile' | 'api' | 'fullstack' | 'internal' | 'other';
  mvpScope: string;
  constraints: string;
  
  // Tech Stack & Architecture
  frontendStack: string;
  backendStack: string;
  database: string;
  uiFramework: string;
  apiStyle: string;
  folderStructureBlueprint: string;
  namingConventions: string;
  
  // UI Theme & Design Foundation (dark / default colors)
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: string;
  darkLightMode: 'dark' | 'light' | 'both';

  // Light mode colors — only used when darkLightMode === 'both'
  lightPrimaryColor?: string;
  lightSecondaryColor?: string;
  lightBackgroundColor?: string;
  lightTextColor?: string;
  
  // Env & Rules
  envKeys: string[];
  customAgentRules: string;
  customStackFields?: { key: string; value: string }[];
  
  // Pre-Run Workflows
  initSteps: ProjectInitStep[];

  // Persistent Blueprint & Design Vision
  blueprintMarkdown?: string;
  designVision?: string;
  designSystemMarkdown?: string;
  agentPrompt?: string;

  // Rich Typography & Styling GUI tokens
  primaryFont?: string;
  secondaryFont?: string;
  baseSpacing?: string;
  containerMaxWidth?: string;
  buttonHeight?: string;
  cardPadding?: string;
  cardShadow?: string;
};

export type Workspace = {
  id: WorkspaceId;
  name: string;
  path: string;
  rootPath: string;
  templateId: WorkspaceTemplateId | null;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number | null;
  panes: Record<PaneId, TerminalPaneConfig>;
  layout: PaneLayout | null;
  savedLayout: PaneLayout | null;
  layoutJson: string;
  settingsJson: string;
  color?: string;
  note?: string;
  restoreDirectory?: boolean;
  context?: ProjectContext | null;
  runConfigs?: RunConfig[];
  defaultConfigId?: string;
  initConfig?: ProjectInitConfig | null;
  dbConnections?: DbConnectionConfig[];
  /** Multi-pane launch board: paneId → agentProfileId (empty string = skip). Survives app restart. */
  paneAgentAssignments?: Record<PaneId, AgentProfileId | ''>;
};

export type Project = {
  id: ProjectId;
  workspaceId: WorkspaceId;
  name: string;
  rootPath: string;
  createdAt: number;
  updatedAt: number;
};

export type TaskStatus = 'todo' | 'running' | 'review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';

export type SkillId = string;

export type Skill = {
  id: SkillId;
  name: string;
  description: string;
  promptTemplate: string;
  allowedTools: string;
  fileScope: string;
  version: string;
  isSystem: boolean;
  updatedAt: number;
};

export type DeckTask = {
  id: TaskId;
  title: string;
  body: string;
  status: TaskStatus;
  paneId: PaneId | null;
  agentId: AgentProfileId | null;
  priority?: TaskPriority;
  skillId?: SkillId | null;
  includeContext?: {
    techStack: boolean;
    folderStructure: boolean;
    codingRules: boolean;
    projectMemory: boolean;
  } | null;
  createdAt: number;
  updatedAt: number;
};

export type AgentProviderType = 'cli' | 'api';

export type AgentPermissionMode = 'preview-required' | 'unsafe-auto-run';

export type AgentProfile = {
  id: AgentProfileId;
  name: string;
  providerType: AgentProviderType;
  commandTemplate: string;
  defaultWorkingDirectory: string;
  environmentJson: string;
  permissionMode: AgentPermissionMode;
  systemPrompt: string;
  description: string;
  createdAt: number;
  updatedAt: number;
};

export type AgentRunStatus = 'queued' | 'running' | 'paused' | 'finished' | 'failed' | 'cancelled';

export type AgentRunFileChange = {
  filePath: string;
  additions: number;
  deletions: number;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  timestamp: number;
};

export type AgentRun = {
  id: AgentRunId;
  workspaceId: WorkspaceId;
  taskId: TaskId | null;
  agentProfileId: AgentProfileId;
  terminalSessionId: PaneId;
  command: string;
  status: AgentRunStatus;
  startedAt: number;
  finishedAt: number | null;
  logPath: string;
  summary: string;
  preRunChanges?: string[];
  preRunNumstat?: Record<string, { additions: number; deletions: number }>;
  changedFiles?: AgentRunFileChange[];
  taskTitle?: string;
  taskBody?: string;
};

export type LogEntryKind = 'stdout' | 'stderr' | 'system';

export type LogEntry = {
  id: string;
  workspaceId: WorkspaceId | null;
  paneId: PaneId;
  kind: LogEntryKind;
  message: string;
  createdAt: number;
};

export type CommandPermissionMode = 'ask-every-time' | 'allow-safe' | 'workspace-trusted' | 'bypass-permissions';

export type CommandCategory =
  | 'safe-read'
  | 'package-install'
  | 'build-test'
  | 'file-write'
  | 'git'
  | 'delete'
  | 'system'
  | 'network'
  | 'unknown';

export type CommandDangerSeverity = 'info' | 'review' | 'danger' | 'block';

export type DangerousCommandFinding = {
  id: string;
  severity: CommandDangerSeverity;
  pattern: string;
  message: string;
};

export type CommandSafetyReview = {
  command: string;
  category: CommandCategory;
  findings: DangerousCommandFinding[];
  safe: boolean;
  risky: boolean;
  blocked: boolean;
};

export type CommandPermissionPolicy = {
  mode: CommandPermissionMode;
  allowedCommands: string[];
  blockedPatterns: string[];
  reviewPatterns: string[];
  trustedWorkspaceIds: WorkspaceId[];
};

export type PermissionDecisionAction = 'allowed' | 'reviewed' | 'overridden' | 'blocked' | 'cancelled';

export type PermissionDecision = {
  id: PermissionRuleId;
  workspaceId: WorkspaceId | null;
  paneId: PaneId | null;
  command: string;
  category: CommandCategory;
  action: PermissionDecisionAction;
  reason: string;
  findings: DangerousCommandFinding[];
  createdAt: number;
};

export type PermissionRuleAction = 'allow' | 'review' | 'block';

export type PermissionRule = {
  id: PermissionRuleId;
  pattern: string;
  action: PermissionRuleAction;
  createdAt: number;
  updatedAt: number;
};

export type WorkspaceTemplate = {
  id: WorkspaceTemplateId;
  name: string;
  description: string;
  paneTitles: string[];
  createdAt: number;
  updatedAt: number;
};

export type ProjectNote = {
  id: ProjectNoteId;
  workspaceId: WorkspaceId;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
};

export type ReviewReport = {
  id: ReviewReportId;
  workspaceId: WorkspaceId;
  title: string;
  body: string;
  createdAt: number;
};

export type AppSettingValue = string | number | boolean | string[] | Record<string, unknown> | null;

export type AppSetting = {
  key: AppSettingKey;
  value: AppSettingValue;
  updatedAt: number;
};

export type AppStateMetadata = {
  schemaVersion: number;
  storageEngine: 'json' | 'sqlite';
  createdAt: number;
  updatedAt: number;
  migratedAt: number | null;
};

export type WorkflowId = string;
export type WorkflowStepId = string;

export type WorkflowStatus = 'idle' | 'running' | 'paused' | 'completed' | 'failed';

export type WorkflowStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type WorkflowLogEntry = {
  timestamp: number;
  stepIndex: number;
  message: string;
  level: 'info' | 'warn' | 'error';
};

export type WorkflowStep = {
  id: WorkflowStepId;
  label: string;
  agentId: AgentProfileId;
  skillId: SkillId | null;
  promptOverride: string;
  status: WorkflowStepStatus;
  retryCount: number;
  maxRetries: number;
  runId: AgentRunId | null;
  startedAt: number | null;
  finishedAt: number | null;
  errorSummary: string;
};

export type Workflow = {
  id: WorkflowId;
  name: string;
  description: string;
  steps: WorkflowStep[];
  status: WorkflowStatus;
  currentStepIndex: number;
  taskId: TaskId | null;
  workspaceId: WorkspaceId;
  paneId: PaneId | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  log: WorkflowLogEntry[];
};

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  steps: {
    label: string;
    agentName: string;
    skillName: string | null;
    promptOverride: string;
    maxRetries: number;
  }[];
};

export type AttachedImageMetadata = {
  id: string;
  originalName: string;
  localPath: string;
  mimeType: string;
  size: number;
  createdAt: number;
  workspaceId: string;
  paneId: string;
  taskId: string | null;
  status: 'pending' | 'submitted';
};

export type AgentInputPayload = {
  text: string;
  attachments: Array<{
    id: string;
    type: 'image';
    localPath: string;
    mimeType: string;
    originalName: string;
  }>;
  paneId: string;
  agentType: 'claude-code' | 'codex' | 'opencode' | 'antigravity' | 'custom';
};

export type BillingMode = 'token' | 'minute' | 'call' | 'subscription_quota' | 'free' | 'unknown';

export interface ModelPricing {
  provider: string;
  routeProvider?: string;
  modelId: string;
  displayName: string;
  billingMode: BillingMode;
  inputPer1M: number;
  cachedInp?: number;
  outputPer1M: number;
  updatedAt: number;
}

export interface UsageLog {
  id: string;
  timestamp: number;
  selectedModel: string;
  actualModel?: string;
  actualProvider?: string;
  routeProvider?: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  cost: number;
  paneId?: string;
  workspaceId?: string;
}

export type AppStateSnapshot = {
  metadata: AppStateMetadata;
  workspaces: Workspace[];
  projects: Project[];
  activeWorkspaceId: WorkspaceId | null;
  activePaneId: PaneId | null;
  tasks: DeckTask[];
  skills: Skill[];
  /** Built-in skill ids the user removed — prevents re-merge from defaultSkills on load */
  removedSystemSkillIds?: string[];
  /** Favorites — always shown first in Skills panel */
  pinnedSkillIds?: SkillId[];
  agentProfiles: AgentProfile[];
  agentRuns: AgentRun[];
  permissionPolicy: CommandPermissionPolicy;
  permissionRules: PermissionRule[];
  permissionDecisions: PermissionDecision[];
  workspaceTemplates: WorkspaceTemplate[];
  projectNotes: ProjectNote[];
  reviewReports: ReviewReport[];
  appSettings: AppSetting[];
  rightTab: RightPanelTab;
  assistantMessages: AssistantMessage[];
  workflows: Workflow[];
  attachments?: AttachedImageMetadata[];
  pricingList?: ModelPricing[];
  usageLogs?: UsageLog[];
  mcpConnections?: McpServerConnection[];
  autoImportFigma: boolean;
  autoAttachFigma: boolean;
  autoImportMode: 'get_design_context' | 'get_file' | 'get_svg';
  latestReceivedSelection?: ReceivedFigmaSelection | null;
  figmaBuildPlans: FigmaBuildPlan[];
  activeFigmaBuildPlanId: string | null;
  databaseAuditLogs?: DbAuditLog[];
};

export type AssistantMessageId = string;
export type AssistantMessageRole = 'user' | 'assistant';

export type AssistantActionKind =
  | 'create_task'
  | 'run_task'
  | 'suggest_agent'
  | 'read_logs'
  | 'check_status'
  | 'scan_context'
  | 'generate_report'
  | 'start_workflow';

export type AssistantAction = {
  kind: AssistantActionKind;
  label: string;
  payload: Record<string, unknown>;
  executed: boolean;
};

/** Image attached to an Assist chat turn (for vision LLMs) */
export type AssistantImageAttachment = {
  id: string;
  name: string;
  mimeType: string;
  /** data:image/...;base64,... */
  dataUrl: string;
};

export type AssistantMessage = {
  id: AssistantMessageId;
  role: AssistantMessageRole;
  content: string;
  /** Optional images on user turns (sent to vision-capable models) */
  images?: AssistantImageAttachment[];
  action?: AssistantAction | null;
  timestamp: number;
};

export type RightPanelTab = 'overview' | 'tasks' | 'skills' | 'agents' | 'logs' | 'review' | 'settings' | 'assist' | 'workflow' | 'files' | 'preview' | 'blueprint' | 'git' | 'mcp' | 'figma-orchestrator' | 'design-extractor' | 'database' | 'device-lab';

export type TerminalStartOptions = {
  paneId: PaneId;
  cwd: string;
  cols: number;
  rows: number;
  shell?: string;
};

export type TerminalOutputEvent = {
  paneId: PaneId;
  data: string;
};

export type TerminalLifecycleKind = 'spawning' | 'ready' | 'running' | 'idle' | 'exited' | 'crashed' | 'killed';

export type TerminalLifecycleEvent = {
  paneId: PaneId;
  kind: TerminalLifecycleKind;
  shell: string | null;
  cwd: string | null;
  exitCode: number | null;
  signal: number | null;
  message: string | null;
};

export type TerminalExitEvent = TerminalLifecycleEvent & {
  kind: 'exited' | 'crashed' | 'killed';
  exitCode: number | null;
  signal: number | null;
};

export type GitWorkspaceStatus = {
  isRepo: boolean;
  changedFiles: string[];
  statusText: string;
  diffStat: string;
  error: string | null;
  branch: string | null;
  numstat?: Record<string, { additions: number; deletions: number }>;
};

export type AppStorageInfo = {
  schemaVersion: number;
  storageEngine: 'json' | 'sqlite';
  userDataPath: string;
  statePath: string;
  logsDir: string;
  reportsDir: string;
  logFilePattern: string;
};

export type IpcError = {
  code: string;
  message: string;
};

export type IpcResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: IpcError;
    };

export type IpcChannel =
  | 'app:getVersion'
  | 'workspace:list'
  | 'workspace:create'
  | 'workspace:open'
  | 'workspace:validate-path'
  | 'terminal:create'
  | 'terminal:start'
  | 'terminal:restart'
  | 'terminal:write'
  | 'terminal:resize'
  | 'terminal:kill'
  | 'terminal:clear-log'
  | 'terminal:pause'
  | 'terminal:resume'
  | 'settings:get'
  | 'settings:set';

export type SettingUpdate = {
  key: AppSettingKey;
  value: AppSettingValue;
};

export interface McpClientInfo {
  id: string;
  name: string;
  connectedAt: number;
  userAgent: string;
}

export type PreviewViewport = 'desktop' | 'tablet' | 'mobile';

export type PreviewTab = {
  id: string;
  url: string;
  title: string;
  linkedPaneId: PaneId | null;
  viewport: PreviewViewport;
  createdAt: number;
};

export type DevServerInfo = {
  port: number;
  url: string;
  name: string;
  status: 'online' | 'error';
};

export interface McpServerConnection {
  id: string;
  name: string;
  url: string;
  transport: 'auto' | 'sse' | 'stdio';
  authType: 'none' | 'oauth' | 'bearer' | 'headers';
  headersJson: string;
  bearerToken?: string;
  figmaToolName?: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing' | 'auth_required';
  errorMessage?: string;
  tools: any[];
  lastChecked?: number;
  permissions?: {
    readAllowed: boolean;
    writeConfirm: boolean;
    unknownConfirm: boolean;
  };
  serverStatus?: 'idle' | 'reachable' | 'failed';
  authStatus?: 'unknown' | 'required' | 'authenticated' | 'failed';
  toolStatus?: 'not_loaded' | 'setup_only' | 'loaded' | 'failed';
}

export type FigmaImportRequest = {
  id: string;
  url: string;
  connectionId: string;
  toolName: 'get_design_context' | 'get_file' | 'get_svg';
  createdAt: string;
};

export type FigmaImportResult = {
  id: string;
  requestId: string;
  status: 'success' | 'failed';
  toolName: string;
  durationMs?: number;
  resultSize?: number;
  rawResult?: unknown;
  previewText?: string;
  error?: string;
  createdAt: string;
};

export type FigmaPluginSelectionPayload = {
  source: "figma-plugin";
  trigger: "manual" | "auto";
  fileKey?: string;
  fileName?: string;
  nodeId: string;
  nodeName?: string;
  nodeType?: string;
  width?: number;
  height?: number;
  selectionUrl: string;
  timestamp: string;
};

export type ReceivedFigmaSelection = {
  id: string;
  source: "figma-plugin";
  trigger?: "manual" | "auto";
  fileKey?: string;
  fileName?: string;
  nodeId: string;
  nodeName?: string;
  nodeType?: string;
  width?: number;
  height?: number;
  selectionUrl: string;
  receivedAt: string;
  status:
    | "received"
    | "waiting_auto_import"
    | "importing"
    | "imported"
    | "attached"
    | "failed"
    | "skipped_duplicate";
  importedContext?: string; // Stored raw JSON context
  previewText?: string;     // Preview characters
  error?: string;
};

export type AgentDeckContextDragPayload = {
  kind: "agentdeck-context";
  contextType: "figma-design-context";
  contextId: string;
  nodeName?: string;
  nodeType?: string;
  selectionUrl: string;
};

export type FigmaDetectedSection = {
  id: string;
  name: string;
  type: string;
  description: string;
  suggestedFileName?: string;
};

export type FigmaDetectedComponent = {
  id: string;
  name: string;
  type: string;
  description: string;
  props?: string[];
  styles?: string[];
  suggestedFileName?: string;
};

export type FigmaTypographyToken = {
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  lineHeight?: number | string;
  role?: string;
};

export type FigmaMotionOpportunity = {
  elementId: string;
  elementName: string;
  trigger: 'hover' | 'scroll' | 'mount' | 'click' | 'active';
  type: 'fade' | 'slide' | 'scale' | 'spring' | 'rotate' | 'shimmer';
  description: string;
};

export type FigmaDesignAnalysis = {
  id: string;
  sourceUrl: string;
  nodeName?: string;
  nodeType?: string;
  dimensions?: {
    width?: number;
    height?: number;
  };
  detectedSections: FigmaDetectedSection[];
  detectedComponents: FigmaDetectedComponent[];
  colors: string[];
  typography: FigmaTypographyToken[];
  spacingHints: string[];
  layoutHints: string[];
  assetHints: string[];
  responsiveHints: string[];
  motionOpportunities: FigmaMotionOpportunity[];
  risks: string[];
};

export type FigmaBuildPlanTask = {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'running' | 'completed' | 'failed';
  targetFile?: string;
  dependsOn?: string[];
  promptPayload: string;
  kanbanTaskId?: string | null;
};

export type FigmaBuildPlan = {
  id: string;
  workspaceId: string;
  selectionId: string;
  nodeName: string;
  nodeType?: string;
  analysis: FigmaDesignAnalysis;
  tasks: FigmaBuildPlanTask[];
  currentTaskIndex: number;
  status: 'draft' | 'approved' | 'running' | 'completed' | 'failed';
  createdAt: number;
  updatedAt: number;
};

// ─── Website Design Extractor ──────────────────────────────────────────────

export type WebsiteTypographyEntry = {
  selector?: string;
  role?: string;
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
};

export type WebsiteDesignTokens = {
  colors: {
    primary: string[];
    neutral: string[];
    semantic: string[];
    background: string[];
    text: string[];
    border: string[];
  };
  typography: {
    fontFamilies: string[];
    scale: WebsiteTypographyEntry[];
  };
  spacing: string[];
  radius: string[];
  shadows: string[];
  components: {
    buttons: unknown[];
    inputs: unknown[];
    cards: unknown[];
    nav: unknown[];
    badges: unknown[];
  };
};

export interface RawExtractedStyleSample {
  selector: string;
  tagName: string;
  className: string;
  id: string;
  textSample?: string;
  isDisplayed: boolean;
  rect: { x: number; y: number; width: number; height: number };
  computedStyles: {
    color?: string;
    backgroundColor?: string;
    borderColor?: string;
    fontFamily?: string;
    fontSize?: string;
    fontWeight?: string;
    lineHeight?: string;
    letterSpacing?: string;
    borderRadius?: string;
    boxShadow?: string;
    padding?: string;
    margin?: string;
    border?: string;
    fill?: string;
    stroke?: string;
    gradientColors?: string[];
  };
  attrs: Record<string, string>;
  isNoise?: boolean;
}

export interface NormalizedColorToken {
  hex: string;
  role: 'primary' | 'accent' | 'background' | 'surface' | 'text' | 'mutedText' | 'border' | 'semanticSuccess' | 'semanticDanger' | 'semanticWarning' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  evidence: Array<{
    selector?: string;
    tagName?: string;
    usage?: string;
    count?: number;
  }>;
}

export interface NormalizedTypographyToken {
  role: 'display' | 'heading1' | 'heading2' | 'heading3' | 'body' | 'bodySmall' | 'button' | 'caption' | 'link' | 'unknown';
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: Array<{
    selector?: string;
    tagName?: string;
    textSample?: string;
    count?: number;
  }>;
}

export interface NormalizedComponentRule {
  component: 'button' | 'input' | 'card' | 'nav' | 'badge' | 'modal' | 'sidebar' | 'link' | 'unknown';
  properties: Record<string, string>;
  confidence: 'high' | 'medium' | 'low';
  evidence: Array<{
    selector?: string;
    textSample?: string;
  }>;
}

export interface WebsiteDesignConfidenceSummary {
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  noiseElementsFiltered: number;
  overallScore: 'high' | 'medium' | 'low';
}

export interface WebsiteDesignReport {
  summary: {
    theme: string;
    mood: string;
    layoutStyle: string;
    mainInteractionStyle: string;
    confidenceNote: string;
  };
  colors: NormalizedColorToken[];
  typography: NormalizedTypographyToken[];
  spacing: Array<{ value: string; confidence: 'high' | 'medium' | 'low'; count: number }>;
  radius: Array<{ value: string; confidence: 'high' | 'medium' | 'low'; count: number }>;
  shadows: Array<{ value: string; confidence: 'high' | 'medium' | 'low'; count: number }>;
  components: NormalizedComponentRule[];
  confidenceSummary: WebsiteDesignConfidenceSummary;
}

export interface WebsiteCaptureMetadata {
  viewport: string;
  userAgent: string;
  pageVariant: 'desktop' | 'mobile';
  qualityScore: number;
  overlaysRemovedCount: number;
  skeletonDetected: boolean;
  screenshotsCount: number;
}

export type WebsiteExtractResult = {
  url: string;
  finalUrl: string;
  title: string;
  capturedAt: number;
  viewportWidth: number;
  viewportHeight: number;
  screenshotAboveFoldBase64?: string;
  screenshotMidPageBase64?: string;
  screenshotLowerPageBase64?: string;
  captureMetadata?: WebsiteCaptureMetadata;
  tokens: WebsiteDesignTokens;
  normalizedReport: WebsiteDesignReport;
  rawElements: RawExtractedStyleSample[];
  designMd: string;
};

export type WebsiteExtractOptions = {
  captureScreenshot?: boolean;
  includeFullPage?: boolean;
  includeDomCss?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
};

export interface WebsiteAnalysisSourceUrl {
  id: string;
  url: string;
  label?: string;
  enabled: boolean;
}

export interface UserProvidedDesignScreenshot {
  id: string;
  filePath: string;
  dataBase64?: string;
  label?: string;
  sourceType: 'user-upload';
  viewportHint?: 'desktop' | 'tablet' | 'mobile' | 'unknown';
  notes?: string;
}

export interface WebsiteSectionScreenshot {
  id: string;
  sourceUrlId: string;
  url: string;
  finalUrl?: string;
  viewport: {
    name: 'desktop' | 'tablet' | 'mobile';
    width: number;
    height: number;
  };
  scrollY: number;
  sectionIndex: number;
  screenshotBase64: string;
  capturedAt: string;
  quality: {
    score: number;
    skeletonDetected: boolean;
    overlaysRemovedCount: number;
    visibleTextCount?: number;
  };
}

export interface DesignEvidenceRef {
  sourceUrl: string;
  viewport: 'desktop' | 'tablet' | 'mobile';
  sectionIndex: number;
  selector?: string;
  tagName?: string;
  textSample?: string;
}

export interface WebsiteDesignCoverageSummary {
  source: string;
  viewports: string[];
  sectionsCaptured: number;
  qualityScore: number;
  notes: string;
}

export interface WebsiteAnalysisRun {
  id: string;
  sources: WebsiteAnalysisSourceUrl[];
  userScreenshots: UserProvidedDesignScreenshot[];
  sectionCaptures: WebsiteSectionScreenshot[];
  overallQualityScore: number;
  coverageSummaries: WebsiteDesignCoverageSummary[];
  report: WebsiteDesignReport;
  designMd: string;
}

// ─── Database Integration ───────────────────────────────────────────────────

export type DbConnectionType = 'sqlite' | 'postgres' | 'mysql' | 'supabase' | 'prisma' | 'mongodb' | 'mssql';

export type DbEnvironmentType = 'local' | 'dev' | 'staging' | 'production';

export type DbPermissionMode = 'read-only' | 'dev-write' | 'manual-approve' | 'danger';

export interface DbConnectionPublicConfig {
  id: string;
  workspaceId: string;
  name: string;
  type: DbConnectionType;
  environment: DbEnvironmentType;
  permissionMode: DbPermissionMode;
  connectionMethod: 'manual' | 'connection-string';
  maskedConnectionString?: string;
  maskedUsername?: string;
  filepath?: string; // For SQLite
  host?: string;
  port?: number;
  database?: string;
  ssl: boolean;
  status?: 'disconnected' | 'connected' | 'error' | 'testing';
  errorMessage?: string;
  lastTestedAt?: number;
  createdAt: number;
  updatedAt: number;
  authSource?: string; // For MongoDB auth DB config
}

export interface DbConnectionSecretRecord {
  connectionId: string;
  passwordEncryptedRef?: string;
  connectionStringEncryptedRef?: string;
  usernameEncryptedRef?: string; // To securely store the raw username
  createdAt: number;
  updatedAt: number;
}

export type DbConnectionConfig = DbConnectionPublicConfig;

export interface DbColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string | null;
  primaryKey: boolean;
  foreignKey?: {
    table: string;
    column: string;
  } | null;
}

export interface DbTableMetadata {
  name: string;
  columns: DbColumnMetadata[];
}

export interface DbSchemaMetadata {
  tables: DbTableMetadata[];
  updatedAt: number;
}

export interface DbAuditLog {
  id: string;
  workspaceId: string;
  connectionId: string;
  timestamp: number;
  caller: 'agent' | 'user';
  sql: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  approvedBy?: string; // Null if auto-run
}

export type AndroidDeviceStatus = 'device' | 'unauthorized' | 'offline' | 'unknown';

export type AndroidDevice = {
  id: string;
  status: AndroidDeviceStatus;
  model?: string;
  product?: string;
  device?: string;
  transportId?: string;
};

export type MobileStackType =
  | 'expo'
  | 'react-native'
  | 'flutter'
  | 'native-android'
  | 'unknown';

export type MobileStackSuggestedCommand = {
  label: string;
  command: string;
  cwd: string;
  requiresBuild: boolean;
  note?: string;
};

export type MobileStackDetection = {
  type: MobileStackType;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  suggestedCommands: MobileStackSuggestedCommand[];
};






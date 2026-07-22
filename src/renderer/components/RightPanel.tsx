import { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback, useDeferredValue, memo } from 'react';
import { createPortal } from 'react-dom';
import type {
  AgentPermissionMode,
  AgentProfile,
  AgentProviderType,
  AgentRun,
  CommandPermissionPolicy,
  DeckTask,
  DevServerInfo,
  PermissionDecision,
  PreviewTab,
  PreviewViewport,
  RightPanelTab,
  Skill,
  SkillId,
  TaskStatus,
  TaskPriority,
  TerminalPaneConfig,
  WorkspaceTemplate,
  AssistantMessage,
  AssistantMessageId,
  Workflow,
  WorkflowStep,
  WorkflowTemplate,
  GitWorkspaceStatus,
  McpServerConnection
} from '../../shared/types';
import { taskStatuses, useDeckStore } from '../store/deckStore';
import { useThemeStore } from '../store/themeStore';
import { subscribeTerminalOutput } from '../utils/terminalBus';
import { getBuiltinTemplates } from '../../shared/workflowEngine';
import { resolveModelRouting, formatCost, formatBillingRate, seededPricing } from '../../shared/utils/pricingHelper';
import { ProjectBlueprintPanel } from './ProjectBlueprintPanel.js';
import { FigmaOrchestratorPanel } from './FigmaOrchestratorPanel.js';
import { GitPanel } from './GitPanel.js';
import { WebsiteDesignExtractorPanel } from './WebsiteDesignExtractorPanel.js';
import { DatabasePanel } from './DatabasePanel.js';
import { ScreenshotCaptureService } from '../services/ScreenshotCaptureService';
import type { Annotation, AnnotationType, Point } from '../services/ScreenshotCaptureService';
import { DeviceLab } from './DeviceLab.js';

const tabs: RightPanelTab[] = ['overview', 'figma-orchestrator', 'design-extractor', 'tasks', 'skills', 'agents', 'logs', 'review', 'settings', 'assist', 'workflow', 'files', 'blueprint', 'git', 'mcp', 'database', 'device-lab'];
const policyModes: CommandPermissionPolicy['mode'][] = [
  'ask-every-time',
  'allow-safe',
  'workspace-trusted',
  'bypass-permissions'
];
const agentProviderTypes: AgentProviderType[] = ['cli', 'api'];
const agentPermissionModes: AgentPermissionMode[] = ['preview-required', 'unsafe-auto-run'];

const EyeIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 8s3-5.5 7-5.5 7 5.5 7 5.5-3 5.5-7 5.5-7-5.5-7-5.5z" />
    <circle cx="8" cy="8" r="2.2" />
  </svg>
);

const DesktopIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

const TabletIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
  </svg>
);

const MobileIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
  </svg>
);

const GlobeIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const WarningIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3" />
  </svg>
);

const RefreshIcon = ({ size = 11, className }: { size?: number; className?: string }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <polyline points="21 3 21 9 15 9" />
  </svg>
);

const BackIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ForwardIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const BrowserIcon = ({ size = 11 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const CloseIcon = ({ size = 9 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PopoutIcon = ({ size = 11 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <path d="M15 9l3-3-3-3" />
    <path d="M18 6H9" />
  </svg>
);

const FocusIcon = ({ size = 11 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 3h6v6" />
    <path d="M9 21H3v-6" />
    <path d="M21 3l-7 7" />
    <path d="M3 21l7-7" />
  </svg>
);

const ExitFocusIcon = ({ size = 11 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 14h6v6" />
    <path d="M20 10h-6V4" />
    <path d="M14 10l6-6" />
    <path d="M10 14l-6 6" />
  </svg>
);

const FullscreenIcon = ({ size = 11 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);

const ExitFullscreenIcon = ({ size = 11 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 14h4v4" />
    <path d="M20 10h-4V6" />
    <path d="M14 10l6-6" />
    <path d="M10 14l-6 6" />
  </svg>
);

const ChevronUpIcon = ({ size = 11 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
);
const ChevronDownIcon = ({ size = 11 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const PlusIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);


const InspectIcon = ({ size = 11 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 16V8a2 2 0 0 0-1.73-1.96L12 4 4.27 6.04A2 2 0 0 0 2.5 8v8a2 2 0 0 0 1.77 1.96L12 20l7.73-2.04A2 2 0 0 0 21 16z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const ZoomIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const LinkIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);



const OverviewIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
);

const TasksIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

const SkillsIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const AgentsIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="11" width="18" height="10" rx="2" />
    <circle cx="12" cy="5" r="2" />
    <path d="M12 7v4" />
    <line x1="8" y1="16" x2="8.01" y2="16" strokeWidth="2.5" />
    <line x1="16" y1="16" x2="16.01" y2="16" strokeWidth="2.5" />
  </svg>
);

const LogsIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const ReviewIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <polyline points="9 15 11 17 15 13" />
  </svg>
);

const SettingsIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const AssistIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const WorkflowIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
    <path d="M7 12v4" />
    <path d="M18 8v4" />
  </svg>
);

const BlueprintIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
  </svg>
);

const FilesIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const getTabIcon = (tab: RightPanelTab, size = 13) => {
  switch (tab) {
    case 'overview':
      return <OverviewIcon size={size} />;
    case 'figma-orchestrator':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      );
    case 'tasks':
      return <TasksIcon size={size} />;
    case 'skills':
      return <SkillsIcon size={size} />;
    case 'agents':
      return <AgentsIcon size={size} />;
    case 'logs':
      return <LogsIcon size={size} />;
    case 'review':
      return <ReviewIcon size={size} />;
    case 'settings':
      return <SettingsIcon size={size} />;
    case 'assist':
      return <AssistIcon size={size} />;
    case 'workflow':
      return <WorkflowIcon size={size} />;
    case 'files':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="9" y1="12" x2="21" y2="12" />
        </svg>
      );
    case 'preview':
      return <EyeIcon />;
    case 'blueprint':
      return <BlueprintIcon size={size} />;
    case 'git':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
      );
    case 'mcp':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      );
    case 'design-extractor':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 9v-2M12 17v-2M9 12H7M17 12h-2" />
        </svg>
      );
    case 'database':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
        </svg>
      );
    case 'device-lab':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
          <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
        </svg>
      );
    default:
      return null;
  }
};

const getViewportIcon = (viewport: PreviewViewport, size = 12) => {
  switch (viewport) {
    case 'desktop':
      return <DesktopIcon size={size} />;
    case 'tablet':
      return <TabletIcon size={size} />;
    case 'mobile':
      return <MobileIcon size={size} />;
    default:
      return null;
  }
};

const listToText = (items: string[]) => items.join('\n');
const textToList = (text: string) =>
  text
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
const emptyAgentDraft = (): Partial<AgentProfile> & Pick<AgentProfile, 'name' | 'commandTemplate'> => ({
  name: '',
  providerType: 'cli',
  commandTemplate: '',
  defaultWorkingDirectory: '{{workspacePath}}',
  environmentJson: '{}',
  permissionMode: 'preview-required',
  systemPrompt: '',
  description: ''
});

export function RightPanel({ collapsed = false }: { collapsed?: boolean }) {
  const rightTab = useDeckStore((state) => state.rightTab);
  const lastPermissionNotice = useDeckStore((state) => state.lastPermissionNotice);
  const lastExportPath = useDeckStore((state) => state.lastExportPath);
  const setRightTab = useDeckStore((state) => state.setRightTab);
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const workspaces = useDeckStore((state) => state.workspaces);
  const appSettings = useDeckStore((state) => state.appSettings);

  const leftCollapsed = appSettings.find((setting) => setting.key === 'ui.leftCollapsed')?.value === true;

  const [selectedFileForReview, setSelectedFileForReview] = useState<string | null>(null);
  const [reviewedFiles, setReviewedFiles] = useState<Record<string, boolean>>({});
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);
  const [gitStatus, setGitStatus] = useState<GitWorkspaceStatus | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  /** Keep Device Lab mounted after first visit — remount was causing layout jank on tab switch */
  const [deviceLabMounted, setDeviceLabMounted] = useState(false);

  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId);
  }, [workspaces, activeWorkspaceId]);

  const workspaceRoot = activeWorkspace?.rootPath || '';

  const loadGitStatus = useCallback(async () => {
    if (!workspaceRoot) {
      setGitStatus(null);
      return;
    }
    setGitLoading(true);
    try {
      const res = await window.agentDeck.getGitWorkspaceStatus(workspaceRoot);
      if (res && res.isRepo) {
        setGitStatus(res);
      } else {
        setGitStatus(null);
      }
    } catch (err) {
      console.error('Failed to load git status:', err);
      setGitStatus(null);
    } finally {
      setGitLoading(false);
    }
  }, [workspaceRoot]);

  useEffect(() => {
    void loadGitStatus();
    const timer = setInterval(() => {
      void loadGitStatus();
    }, 10000);
    return () => clearInterval(timer);
  }, [loadGitStatus]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setReviewedFiles({});
      return;
    }
    try {
      const stored = localStorage.getItem(`agentdeck:reviewed:${activeWorkspaceId}`);
      if (stored) {
        setReviewedFiles(JSON.parse(stored));
      } else {
        setReviewedFiles({});
      }
    } catch (err) {
      console.error('Failed to load reviewed status:', err);
      setReviewedFiles({});
    }
  }, [activeWorkspaceId]);

  const toggleReviewed = (filePath: string) => {
    if (!activeWorkspaceId) return;
    setReviewedFiles(prev => {
      const next = { ...prev, [filePath]: !prev[filePath] };
      try {
        localStorage.setItem(`agentdeck:reviewed:${activeWorkspaceId}`, JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save reviewed status:', err);
      }
      return next;
    });
  };

  const [panelWidth, setPanelWidth] = useState(() => {
    const saved = localStorage.getItem('agentdeck:right-panel-width');
    return saved ? parseInt(saved, 10) : 380;
  });

  // Ghost-resize: no setState / no layout thrash until mouseup (esp. File Explorer line DOM)
  const isResizingRef = useRef(false);
  const panelWidthRef = useRef(panelWidth);
  const leftCollapsedRef = useRef(leftCollapsed);
  const resizeGuideRef = useRef<HTMLDivElement | null>(null);
  const resizeOverlayRef = useRef<HTMLDivElement | null>(null);
  const resizeRafRef = useRef(0);
  const pendingGuideLeftRef = useRef(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  leftCollapsedRef.current = leftCollapsed;
  panelWidthRef.current = panelWidth;

  useEffect(() => {
    if (isResizingRef.current) return;
    document.documentElement.style.setProperty('--right-panel-width', `${panelWidth}px`);
  }, [panelWidth]);

  useEffect(() => {
    if (rightTab === 'files' && panelWidthRef.current < 600) {
      const next = 750;
      panelWidthRef.current = next;
      setPanelWidth(next);
      document.documentElement.style.setProperty('--right-panel-width', `${next}px`);
      try {
        localStorage.setItem('agentdeck:right-panel-width', String(next));
      } catch {
        /* ignore */
      }
    }
    if (rightTab === 'device-lab') {
      setDeviceLabMounted(true);
    }
  }, [rightTab]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);
  const unreviewedCount = useMemo(() => {
    if (!gitStatus || !gitStatus.changedFiles) return 0;
    return gitStatus.changedFiles.filter((fileLine) => {
      const parsedPath = parseGitStatus(fileLine).path;
      return !reviewedFiles[parsedPath];
    }).length;
  }, [gitStatus, reviewedFiles]);

  const cleanupResizeGhost = useCallback(() => {
    if (resizeRafRef.current) {
      cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = 0;
    }
    resizeGuideRef.current?.remove();
    resizeGuideRef.current = null;
    resizeOverlayRef.current?.remove();
    resizeOverlayRef.current = null;
  }, []);

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    mouseDownEvent.stopPropagation();
    if (isResizingRef.current) return;
    isResizingRef.current = true;

    const startX = mouseDownEvent.clientX;
    pendingGuideLeftRef.current = startX;

    // Full-screen overlay + guide line via pure DOM — zero React work on mousedown
    const overlay = document.createElement('div');
    overlay.setAttribute('data-panel-resize-overlay', '1');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:999998;cursor:ew-resize;user-select:none;touch-action:none;';
    document.body.appendChild(overlay);
    resizeOverlayRef.current = overlay;

    const guide = document.createElement('div');
    guide.setAttribute('data-panel-resize-guide', '1');
    guide.style.cssText = [
      'position:fixed',
      'top:0',
      'bottom:0',
      'width:2px',
      `left:${startX}px`,
      'z-index:999999',
      'pointer-events:none',
      'background:#a78bfa',
      'box-shadow:0 0 0 1px rgba(167,139,250,0.35), 0 0 12px rgba(167,139,250,0.45)',
    ].join(';');
    document.body.appendChild(guide);
    resizeGuideRef.current = guide;

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    if (!isResizingRef.current) return;
    isResizingRef.current = false;
    cleanupResizeGhost();

    const finalWidth = panelWidthRef.current;
    // Single React commit + layout after drag ends
    setPanelWidth(finalWidth);
    document.documentElement.style.setProperty('--right-panel-width', `${finalWidth}px`);
    try {
      localStorage.setItem('agentdeck:right-panel-width', String(finalWidth));
    } catch {
      /* ignore */
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [cleanupResizeGhost]);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (!isResizingRef.current) return;
    const newWidth = window.innerWidth - mouseMoveEvent.clientX;
    const leftSidebarWidth = leftCollapsedRef.current ? 0 : 240;
    const maxPanelWidth = window.innerWidth - leftSidebarWidth - 100;
    if (newWidth < 150 || newWidth > maxPanelWidth) return;
    panelWidthRef.current = newWidth;
    pendingGuideLeftRef.current = window.innerWidth - newWidth;
    // Move guide only — panel layout stays frozen until mouseup
    if (resizeRafRef.current) return;
    resizeRafRef.current = requestAnimationFrame(() => {
      resizeRafRef.current = 0;
      if (resizeGuideRef.current) {
        resizeGuideRef.current.style.left = `${pendingGuideLeftRef.current}px`;
      }
    });
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize, { passive: true });
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      cleanupResizeGhost();
    };
  }, [resize, stopResizing, cleanupResizeGhost]);

  return (
    <aside
      className={`right-panel ${collapsed ? 'collapsed' : ''}`}
      aria-hidden={collapsed}
      style={{ position: 'relative' }}
    >
      {dropdownOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 998,
            background: 'transparent'
          }}
          onMouseDown={() => setDropdownOpen(false)}
        />
      )}
      {!collapsed && (
        <div
          className="panel-resizer-handle"
          onMouseDown={startResizing}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: '4px',
            cursor: 'ew-resize',
            zIndex: 100,
            background: 'transparent'
          }}
        />
      )}
      <div className="panel-header-select-container" ref={dropdownRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', zIndex: 1000 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <button
            className={`panel-select-trigger ${dropdownOpen ? 'open' : ''}`}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            type="button"
            style={{ width: '100%' }}
          >
            <span className="panel-select-trigger-label">
              {getTabIcon(['files', 'preview'].includes(rightTab) ? 'files' : rightTab, 14)}
              <span className="panel-select-trigger-text">
                {rightTab === 'git' ? 'source control' : ['files', 'preview'].includes(rightTab) ? 'workspace' : rightTab === 'mcp' ? 'MCP connections' : rightTab === 'database' ? 'Database Console' : rightTab === 'figma-orchestrator' ? 'Figma orchestrator' : rightTab === 'device-lab' ? 'Device Lab' : rightTab}
              </span>
              {/* Only on Review tab — don't pin review count onto Device Lab / other tabs */}
              {rightTab === 'review' && unreviewedCount > 0 && (
                <span className="panel-count-badge" title={`${unreviewedCount} unreviewed change${unreviewedCount === 1 ? '' : 's'}`}>
                  {unreviewedCount > 99 ? '99+' : unreviewedCount}
                </span>
              )}
            </span>
            <ChevronDownIcon size={12} />
          </button>

          {dropdownOpen && (
            <div className="panel-select-dropdown">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  className={`panel-select-option ${(tab === 'files' && ['files', 'preview'].includes(rightTab)) || rightTab === tab ? 'active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRightTab(tab);
                    setDropdownOpen(false);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRightTab(tab);
                    setDropdownOpen(false);
                  }}
                  type="button"
                >
                  <span className="panel-select-option-label">
                    {getTabIcon(tab, 13)}
                    <span>{tab === 'git' ? 'source control' : tab === 'files' ? 'workspace' : tab === 'mcp' ? 'MCP connections' : tab === 'figma-orchestrator' ? 'Figma orchestrator' : tab === 'design-extractor' ? 'Design extractor' : tab === 'device-lab' ? 'Device Lab' : tab}</span>
                    {tab === 'review' && unreviewedCount > 0 && (
                      <span className="panel-count-badge" title={`${unreviewedCount} unreviewed change${unreviewedCount === 1 ? '' : 's'}`}>
                        {unreviewedCount > 99 ? '99+' : unreviewedCount}
                      </span>
                    )}
                  </span>
                  {rightTab === tab && <span className="active-dot" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {['files', 'preview'].includes(rightTab) && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(24, 24, 27, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '2.5px',
            gap: '1px',
            flexShrink: 0,
            height: '28px',
            boxSizing: 'border-box',
            userSelect: 'none'
          }}>
            {/* 🌐 Preview Button */}
            <button
              onClick={() => setRightTab('preview')}
              title="Live Web Preview"
              type="button"
              style={{
                background: rightTab === 'preview' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                border: 'none',
                borderRadius: '16px',
                color: rightTab === 'preview' ? '#38bdf8' : '#71717a',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: rightTab === 'preview' ? '0 8px' : '0',
                width: rightTab === 'preview' ? 'auto' : '26px',
                height: '22px',
                fontSize: '9px',
                fontWeight: 600,
                transition: 'all 0.15s ease',
                gap: '4px'
              }}
              onMouseEnter={(e) => rightTab !== 'preview' && (e.currentTarget.style.color = '#e4e4e7')}
              onMouseLeave={(e) => rightTab !== 'preview' && (e.currentTarget.style.color = '#71717a')}
            >
              <GlobeIcon size={12} />
              {rightTab === 'preview' && <span>Preview</span>}
            </button>

            {/* Divider */}
            <div style={{ width: '1px', background: 'rgba(255,255,255,0.08)', height: '12px', margin: '0 2px' }} />

            {/* </> Code Button */}
            <button
              onClick={() => setRightTab('files')}
              title="Code Editor & Files"
              type="button"
              style={{
                background: rightTab === 'files' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                border: 'none',
                borderRadius: '16px',
                color: rightTab === 'files' ? '#38bdf8' : '#71717a',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: rightTab === 'files' ? '0 8px' : '0',
                width: rightTab === 'files' ? 'auto' : '26px',
                height: '22px',
                fontSize: '9px',
                fontWeight: 600,
                transition: 'all 0.15s ease',
                gap: '4px'
              }}
              onMouseEnter={(e) => rightTab !== 'files' && (e.currentTarget.style.color = '#e4e4e7')}
              onMouseLeave={(e) => rightTab !== 'files' && (e.currentTarget.style.color = '#71717a')}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              {rightTab === 'files' && <span>Code</span>}
            </button>
          </div>
        )}
      </div>
      <div 
        className="right-panel-body"
        style={['files', 'git', 'device-lab'].includes(rightTab) ? { padding: 0, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' } : undefined}
      >
        {lastPermissionNotice ? <div className="notice-card">{lastPermissionNotice}</div> : null}
        {lastExportPath ? <div className="notice-card success">Exported report: {lastExportPath}</div> : null}
        {rightTab === 'overview' ? (
          <OverviewPanel
            setSelectedFileForReview={setSelectedFileForReview}
            reviewedFiles={reviewedFiles}
            toggleReviewed={toggleReviewed}
            gitStatus={gitStatus}
            gitLoading={gitLoading}
            loadGitStatus={loadGitStatus}
          />
        ) : null}
        {rightTab === 'tasks' ? <TasksPanel /> : null}
        {rightTab === 'figma-orchestrator' ? <FigmaOrchestratorPanel /> : null}
        {rightTab === 'skills' ? <SkillsPanel /> : null}
        {rightTab === 'agents' ? <AgentsPanel /> : null}
        {rightTab === 'logs' ? <LogsPanel /> : null}
        {rightTab === 'review' ? (
          <ReviewPanel
            selectedFileForReview={selectedFileForReview}
            setSelectedFileForReview={setSelectedFileForReview}
            reviewedFiles={reviewedFiles}
            toggleReviewed={toggleReviewed}
            gitStatus={gitStatus}
            gitLoading={gitLoading}
            loadGitStatus={loadGitStatus}
          />
        ) : null}
        {rightTab === 'settings' ? <SettingsPanel /> : null}
        {rightTab === 'assist' ? <AssistantPanel /> : null}
        {rightTab === 'workflow' ? <WorkflowPanel /> : null}
        {rightTab === 'files' ? <FileExplorerPanel isTreeCollapsed={isTreeCollapsed} setIsTreeCollapsed={setIsTreeCollapsed} /> : null}
        {rightTab === 'preview' ? <PreviewPanel /> : null}
        {rightTab === 'blueprint' ? <ProjectBlueprintPanel /> : null}
        {rightTab === 'git' ? (
          <GitPanel workspaceRoot={workspaceRoot} />
        ) : null}
        {rightTab === 'mcp' ? <McpConnectionsPanel /> : null}
        {rightTab === 'database' ? <DatabasePanel /> : null}
        {rightTab === 'design-extractor' ? <WebsiteDesignExtractorPanel /> : null}
        {deviceLabMounted ? (
          <div
            style={{
              display: rightTab === 'device-lab' ? 'flex' : 'none',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              height: '100%',
              overflow: 'hidden'
            }}
          >
            <DeviceLab />
          </div>
        ) : null}
      </div>
    </aside>
  );
}

interface DiffLine {
  type: 'addition' | 'deletion' | 'normal' | 'hunk-header' | 'meta';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

function getFileNameAndDir(filePath: string) {
  const parts = filePath.split('/');
  const fileName = parts.pop() || '';
  const dirPath = parts.join('/');
  return { fileName, dirPath };
}

function getExtensionBadge(filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  let label = ext.toUpperCase();
  // Solid-ish chip surfaces — avoid ultra-low alpha (soft on dark UI)
  let bgColor = 'rgba(255, 255, 255, 0.08)';
  let color = '#e4e4e7';
  let border = '1px solid rgba(255, 255, 255, 0.12)';

  if (ext === 'tsx' || ext === 'jsx') {
    bgColor = 'rgba(56, 189, 248, 0.16)';
    color = '#7dd3fc';
    border = '1px solid rgba(56, 189, 248, 0.35)';
  } else if (ext === 'ts' || ext === 'js') {
    bgColor = 'rgba(59, 130, 246, 0.16)';
    color = '#93c5fd';
    border = '1px solid rgba(59, 130, 246, 0.35)';
  } else if (ext === 'css') {
    bgColor = 'rgba(139, 92, 246, 0.16)';
    color = '#c4b5fd';
    border = '1px solid rgba(139, 92, 246, 0.35)';
  } else if (ext === 'json') {
    bgColor = 'rgba(245, 158, 11, 0.16)';
    color = '#fcd34d';
    border = '1px solid rgba(245, 158, 11, 0.35)';
  } else if (ext === 'md') {
    bgColor = 'rgba(16, 185, 129, 0.16)';
    color = '#6ee7b7';
    border = '1px solid rgba(16, 185, 129, 0.35)';
  } else if (ext === 'html') {
    bgColor = 'rgba(239, 68, 68, 0.16)';
    color = '#fca5a5';
    border = '1px solid rgba(239, 68, 68, 0.35)';
  } else if (['png', 'jpg', 'jpeg', 'svg', 'gif'].includes(ext)) {
    bgColor = 'rgba(236, 72, 153, 0.16)';
    color = '#f9a8d4';
    border = '1px solid rgba(236, 72, 153, 0.35)';
  } else if (ext === 'err' || ext === 'log') {
    bgColor = 'rgba(239, 68, 68, 0.16)';
    color = '#fca5a5';
    border = '1px solid rgba(239, 68, 68, 0.35)';
  } else if (ext === 'out') {
    bgColor = 'rgba(34, 197, 94, 0.16)';
    color = '#86efac';
    border = '1px solid rgba(34, 197, 94, 0.35)';
  }

  // Long labels (e.g. folder names mistaken as ext) — keep readable chip
  if (label.length > 6) {
    label = label.slice(0, 6);
  }

  return { label: label || 'FILE', bgColor, color, border };
}

function parseGitStatus(fileLine: string) {
  const code = fileLine.slice(0, 2).trim();
  const pathPart = fileLine.slice(2).trim();
  let label = 'Modified';
  let badgeColor = 'rgba(234, 179, 8, 0.18)';
  let textColor = '#fde047';
  let pathVal = pathPart;
  let oldPath: string | undefined = undefined;

  if (pathVal.startsWith('"') && pathVal.endsWith('"')) {
    pathVal = pathVal.slice(1, -1).replace(/\\"/g, '"');
  }

  if (code.startsWith('R') || code.includes('R') || pathVal.includes(' -> ')) {
    label = 'Renamed';
    badgeColor = 'rgba(167, 139, 250, 0.2)';
    textColor = '#ddd6fe';
    
    const arrowIndex = pathVal.indexOf(' -> ');
    if (arrowIndex !== -1) {
      let rawOld = pathVal.slice(0, arrowIndex).trim();
      let rawNew = pathVal.slice(arrowIndex + 4).trim();
      if (rawOld.startsWith('"') && rawOld.endsWith('"')) rawOld = rawOld.slice(1, -1).replace(/\\"/g, '"');
      if (rawNew.startsWith('"') && rawNew.endsWith('"')) rawNew = rawNew.slice(1, -1).replace(/\\"/g, '"');
      oldPath = rawOld;
      pathVal = rawNew;
    }
  } else if (code === 'M' || code.includes('M')) {
    label = 'Modified';
    badgeColor = 'rgba(234, 179, 8, 0.18)';
    textColor = '#fde047';
  } else if (code === 'A' || code === '??' || code.includes('A')) {
    label = 'Added';
    badgeColor = 'rgba(34, 197, 94, 0.2)';
    textColor = '#86efac';
  } else if (code === 'D' || code.includes('D')) {
    label = 'Deleted';
    badgeColor = 'rgba(239, 68, 68, 0.2)';
    textColor = '#fca5a5';
  }

  return { code, path: pathVal, oldPath, label, badgeColor, textColor };
}

interface MediaThumbnailProps {
  relPath: string;
}

function MediaThumbnail({ relPath }: MediaThumbnailProps) {
  const [base64, setBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const data = await window.agentDeck.readArtifactBase64(relPath);
        if (active) {
          setBase64(data);
        }
      } catch (err) {
        console.error('Failed to load thumbnail:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [relPath]);

  if (loading) {
    return (
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '4px',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        animation: 'pulse 1.5s infinite ease-in-out',
        flexShrink: 0
      }} />
    );
  }

  if (!base64) {
    return (
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '4px',
        background: 'rgba(236, 72, 153, 0.1)',
        border: '1px solid rgba(236, 72, 153, 0.2)',
        color: '#f472b6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        flexShrink: 0
      }}>
        ðŸ–¼ï¸
      </div>
    );
  }

  return (
    <img
      src={`data:image/png;base64,${base64}`}
      alt="Thumbnail"
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '4px',
        objectFit: 'cover',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: '#0a0a0c',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
        flexShrink: 0
      }}
    />
  );
}

interface ArtifactItemProps {
  art: { name: string; relPath: string; type: string; size: number; mtime: number };
  tasks: any[];
  artifactTasks: Record<string, string>;
  handleLinkTask: (artRelPath: string, taskId: string) => void;
  handleDeleteArtifact: (art: any, e: React.MouseEvent) => void;
  handleOpenArtifact: (art: any) => void;
}

function ArtifactItem({
  art,
  tasks,
  artifactTasks,
  handleLinkTask,
  handleDeleteArtifact,
  handleOpenArtifact
}: ArtifactItemProps) {
  const linkedTaskId = artifactTasks[art.relPath];
  const linkedTask = tasks.find((t) => t.id === linkedTaskId);

  return (
    <div 
      onClick={() => handleOpenArtifact(art)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 8px',
        background: '#1a1a1c',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '4px',
        cursor: 'pointer',
        gap: '8px',
        transition: 'all 0.2s ease',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = '#1c1c1e';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = '#1a1a1c';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
        {art.type === 'Media' && (
          <MediaThumbnail relPath={art.relPath} />
        )}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: '12px', color: '#f4f4f5', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {art.name}
          </span>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
              {(art.size / 1024).toFixed(1)} KB
            </span>
            
            {linkedTask && (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  useDeckStore.getState().setRightTab('tasks');
                }}
                style={{
                  fontSize: '10px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  color: '#7dd3fc',
                  border: '1px solid rgba(56, 189, 248, 0.28)',
                  padding: '0.5px 4px',
                  borderRadius: '3px',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '1px',
                  cursor: 'pointer'
                }}
                title="Linked Task - Click to view"
              >
                📌 {linkedTask.title.slice(0, 12)}{linkedTask.title.length > 12 ? '...' : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <select
          value={linkedTaskId || 'none'}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleLinkTask(art.relPath, e.target.value)}
          title={linkedTask ? `Linked Task: ${linkedTask.title}` : "Link to a Kanban task"}
          style={{
            background: '#141416',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '3px',
            color: '#d4d4d8',
            fontSize: '11px',
            padding: '2px 4px',
            outline: 'none',
            cursor: 'pointer',
            maxWidth: '70px',
            transition: 'border-color 0.2s'
          }}
        >
          <option value="none" style={{ background: '#16161a' }} title="No linked task">Link...</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id} style={{ background: '#16161a' }} title={t.title}>
              {t.title.slice(0, 20)}{t.title.length > 20 ? '...' : ''}
            </option>
          ))}
        </select>

        <button
          onClick={(e) => handleDeleteArtifact(art, e)}
          style={{
            background: 'none',
            border: 'none',
            color: '#a1a1aa',
            cursor: 'pointer',
            padding: '3px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '3px',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#a1a1aa';
            e.currentTarget.style.background = 'none';
          }}
          title="Delete artifact"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2m-7 5v6m4-6v6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** Normalize CLI command for display — expand \n, extract quoted prompt */
function parseAgentRunCommand(command: string): { cli: string; prompt: string; full: string } {
  const full = (command || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, ' ')
    .trim();
  const quoted = full.match(/"([\s\S]{4,})"/) || full.match(/'([\s\S]{4,})'/);
  if (quoted && quoted.index != null) {
    const prompt = quoted[1].replace(/\s+/g, ' ').trim();
    const cli = full.slice(0, quoted.index).trim() || full.split(/\s+/)[0] || 'agent';
    return { cli, prompt, full };
  }
  const oneLine = full.replace(/\s+/g, ' ').trim();
  return { cli: oneLine.split(/\s+/)[0] || 'agent', prompt: oneLine, full };
}

function agentRunStatusStyle(status: AgentRun['status']): { bg: string; color: string } {
  if (status === 'running') return { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' };
  if (status === 'finished' || status === 'paused' || status === 'queued') {
    return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' };
  }
  return { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' };
}

function formatRunTime(ts: number): string {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

/** Compact / expandable row for Overview → Subagents */
function OverviewAgentRunRow({
  run,
  mode = 'compact'
}: {
  run: AgentRun;
  mode?: 'compact' | 'list';
}) {
  const [open, setOpen] = useState(false);
  const { cli, prompt, full } = useMemo(() => parseAgentRunCommand(run.command), [run.command]);
  const st = agentRunStatusStyle(run.status);
  const when = formatRunTime(run.startedAt);
  const isList = mode === 'list';

  return (
    <div
      className={`overview-run-row${open ? ' is-open' : ''}${isList ? ' is-list' : ''}`}
      onClick={isList ? () => setOpen((v) => !v) : undefined}
      role={isList ? 'button' : undefined}
      tabIndex={isList ? 0 : undefined}
      onKeyDown={
        isList
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setOpen((v) => !v);
              }
            }
          : undefined
      }
      title={!isList ? full : undefined}
    >
      <div className="overview-run-row-top">
        <div className="overview-run-row-id">
          <span className="overview-run-agent">{run.agentProfileId}</span>
          {when ? <span className="overview-run-time">{when}</span> : null}
        </div>
        <span className="overview-run-status" style={{ background: st.bg, color: st.color }}>
          {run.status}
        </span>
      </div>
      {isList ? (
        <div className="overview-run-cli-line">{cli}</div>
      ) : null}
      <div className={`overview-run-prompt${open ? ' is-expanded' : isList ? ' is-clamped' : ' is-single'}`}>
        {open ? full : prompt}
      </div>
      {isList ? (
        <div className="overview-run-row-foot">
          <span className="overview-run-expand-hint">{open ? 'Hide command' : 'Show full command'}</span>
        </div>
      ) : null}
    </div>
  );
}

interface OverviewPanelProps {
  setSelectedFileForReview: (path: string | null) => void;
  reviewedFiles: Record<string, boolean>;
  toggleReviewed: (filePath: string) => void;
  gitStatus: GitWorkspaceStatus | null;
  gitLoading: boolean;
  loadGitStatus: () => Promise<void>;
}

function OverviewPanel({
  setSelectedFileForReview,
  reviewedFiles,
  toggleReviewed,
  gitStatus,
  gitLoading,
  loadGitStatus
}: OverviewPanelProps) {
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const workspaces = useDeckStore((state) => state.workspaces);
  const setWorkspaceNote = useDeckStore((state) => state.setWorkspaceNote);
  const agentRuns = useDeckStore((state) => state.agentRuns);
  const workflows = useDeckStore((state) => state.workflows);
  const projectRunStates = useDeckStore((state) => state.projectRunStates);
  const tasks = useDeckStore((state) => state.tasks);

  const [artifactTasks, setArtifactTasks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (activeWorkspaceId) {
      const saved = localStorage.getItem(`agentdeck:artifact-tasks:${activeWorkspaceId}`);
      if (saved) {
        try {
          setArtifactTasks(JSON.parse(saved));
        } catch {
          setArtifactTasks({});
        }
      } else {
        setArtifactTasks({});
      }
    }
  }, [activeWorkspaceId]);

  const handleLinkTask = (artRelPath: string, taskId: string) => {
    const next = { ...artifactTasks };
    if (!taskId || taskId === 'none') {
      delete next[artRelPath];
    } else {
      next[artRelPath] = taskId;
    }
    setArtifactTasks(next);
    if (activeWorkspaceId) {
      localStorage.setItem(`agentdeck:artifact-tasks:${activeWorkspaceId}`, JSON.stringify(next));
    }
  };

  const handleDeleteArtifact = async (art: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = window.confirm(`Are you sure you want to delete ${art.name}? This will delete the file on disk and cannot be undone.`);
    if (!ok) return;

    try {
      await window.agentDeck.deleteArtifact(art.relPath);
      handleLinkTask(art.relPath, 'none');
      void loadArtifacts();
    } catch (err) {
      alert(`Failed to delete artifact: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId);
  }, [workspaces, activeWorkspaceId]);



  const workspaceRoot = activeWorkspace?.rootPath || '';

  const [artifacts, setArtifacts] = useState<Array<{ name: string; relPath: string; type: string; size: number; mtime: number }>>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    subagents: true,
    files: true,
    artifacts: true,
    backgroundTasks: true
  });

  const [artifactModal, setArtifactModal] = useState<{ name: string; type: string; content?: string; base64?: string } | null>(null);
  const [seeAllModal, setSeeAllModal] = useState<{ title: string; children: React.ReactNode } | null>(null);
  const [seeAllRunsOpen, setSeeAllRunsOpen] = useState(false);
  const [runStatusFilter, setRunStatusFilter] = useState<'all' | AgentRun['status']>('all');

  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [fileSortKey, setFileSortKey] = useState<'path' | 'type' | 'lines' | 'status'>('path');
  const [seeAllFilesOpen, setSeeAllFilesOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setSortDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadArtifacts = useCallback(async () => {
    setArtifactsLoading(true);
    try {
      const res = await window.agentDeck.listArtifacts();
      if (res && Array.isArray(res)) {
        setArtifacts(res);
      }
    } catch (err) {
      console.error('Failed to load artifacts:', err);
    } finally {
      setArtifactsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGitStatus();
    void loadArtifacts();
    
    const timer = setInterval(() => {
      void loadGitStatus();
      void loadArtifacts();
    }, 10000);
    
    return () => clearInterval(timer);
  }, [loadGitStatus, loadArtifacts]);

  const toggleExpanded = (section: string) => {
    setExpanded(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const workspaceRuns = useMemo(() => {
    return agentRuns
      .filter((run) => run.workspaceId === activeWorkspaceId)
      .slice()
      .sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
  }, [agentRuns, activeWorkspaceId]);

  const filteredWorkspaceRuns = useMemo(() => {
    if (runStatusFilter === 'all') return workspaceRuns;
    return workspaceRuns.filter((r) => r.status === runStatusFilter);
  }, [workspaceRuns, runStatusFilter]);

  const runningRuns = useMemo(() => {
    return agentRuns.filter((run) => run.workspaceId === activeWorkspaceId && run.status === 'running');
  }, [agentRuns, activeWorkspaceId]);

  const runningWorkflows = useMemo(() => {
    return workflows.filter((w) => w.workspaceId === activeWorkspaceId && w.status === 'running');
  }, [workflows, activeWorkspaceId]);

  const isServerRunning = activeWorkspaceId && projectRunStates[activeWorkspaceId]?.status === 'running';

  const backgroundTasks = useMemo(() => {
    const tasks = [];
    if (isServerRunning) {
      const activeConfigId = projectRunStates[activeWorkspaceId]?.activeConfigId || 'Dev Server';
      tasks.push({
        id: 'dev-server',
        name: `Dev Server: ${activeConfigId}`,
        type: 'Server',
        status: 'running'
      });
    }
    for (const run of runningRuns) {
      tasks.push({
        id: `run-${run.id}`,
        name: `Agent Run: ${run.command.slice(0, 40)}${run.command.length > 40 ? '...' : ''}`,
        type: 'Agent',
        status: 'running'
      });
    }
    for (const wf of runningWorkflows) {
      tasks.push({
        id: `workflow-${wf.id}`,
        name: `Workflow: ${wf.name}`,
        type: 'Workflow',
        status: 'running'
      });
    }
    return tasks;
  }, [isServerRunning, activeWorkspaceId, runningRuns, runningWorkflows, projectRunStates]);

  const categorizedArtifacts = useMemo(() => {
    const categories: Record<string, typeof artifacts> = {
      Media: [],
      Task: [],
      Walkthrough: [],
      'Test Search': [],
      Other: []
    };
    for (const art of artifacts) {
      const cat = categories[art.type] ? art.type : 'Other';
      categories[cat].push(art);
    }
    return categories;
  }, [artifacts]);

  const handleOpenFileDiff = (filePath: string) => {
    setSelectedFileForReview(filePath);
    useDeckStore.getState().setRightTab('review');
  };

  const handleOpenArtifact = async (art: typeof artifacts[0]) => {
    try {
      if (art.type === 'Media') {
        const base64 = await window.agentDeck.readArtifactBase64(art.relPath);
        setArtifactModal({ name: art.name, type: 'Media', base64 });
      } else {
        const content = await window.agentDeck.readArtifactText(art.relPath);
        setArtifactModal({ name: art.name, type: 'Text', content });
      }
    } catch (err) {
      alert(`Failed to open artifact: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const processedFiles = useMemo(() => {
    if (!gitStatus || !gitStatus.changedFiles) return [];
    
    const parsed = gitStatus.changedFiles.map((fileLine) => {
      const parsedInfo = parseGitStatus(fileLine);
      const numstatInfo = gitStatus.numstat?.[parsedInfo.path] || { additions: 0, deletions: 0 };
      const totalChanges = numstatInfo.additions + numstatInfo.deletions;
      const ext = parsedInfo.path.split('.').pop()?.toLowerCase() || '';
      return {
        ...parsedInfo,
        numstat: numstatInfo,
        totalChanges,
        ext
      };
    });

    let filtered = parsed;
    if (fileSearchQuery.trim()) {
      const q = fileSearchQuery.trim().toLowerCase();
      filtered = parsed.filter(item => 
        item.path.toLowerCase().includes(q) || 
        (item.oldPath && item.oldPath.toLowerCase().includes(q))
      );
    }

    filtered.sort((a, b) => {
      if (fileSortKey === 'path') {
        return a.path.localeCompare(b.path);
      } else if (fileSortKey === 'type') {
        return a.ext.localeCompare(b.ext) || a.path.localeCompare(b.path);
      } else if (fileSortKey === 'lines') {
        if (b.totalChanges !== a.totalChanges) {
          return b.totalChanges - a.totalChanges;
        }
        return a.path.localeCompare(b.path);
      } else if (fileSortKey === 'status') {
        const statusOrder = { 'Renamed': 1, 'Added': 2, 'Modified': 3, 'Deleted': 4 };
        const orderA = statusOrder[a.label as keyof typeof statusOrder] || 5;
        const orderB = statusOrder[b.label as keyof typeof statusOrder] || 5;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.path.localeCompare(b.path);
      }
      return 0;
    });

    return filtered;
  }, [gitStatus, fileSearchQuery, fileSortKey]);

  const renderFileItem = (item: any) => {
    const { fileName, dirPath } = getFileNameAndDir(item.path);
    const badgeInfo = getExtensionBadge(item.path);
    const numstatInfo = item.numstat;
    const additions = numstatInfo.additions;
    const deletions = numstatInfo.deletions;
    const hasNumstat = additions > 0 || deletions > 0;
    const isReviewed = !!reviewedFiles[item.path];

    return (
      <div key={item.path} className="review-file-row">
        <button
          type="button"
          onClick={() => toggleReviewed(item.path)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isReviewed ? '#38bdf8' : '#a1a1aa',
            transition: 'color 0.15s',
            flexShrink: 0
          }}
          title={isReviewed ? 'Mark as Unreviewed' : 'Mark as Reviewed'}
        >
          {isReviewed ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <div style={{ width: '11px', height: '11px', borderRadius: '2px', border: '2px solid rgba(255,255,255,0.28)' }} />
          )}
        </button>

        <div
          className={`review-file-main${isReviewed ? ' is-reviewed' : ''}`}
          onClick={() => {
            setSeeAllFilesOpen(false);
            void handleOpenFileDiff(item.path);
          }}
        >
          <span
            className="review-ext-badge"
            style={{
              background: badgeInfo.bgColor,
              color: badgeInfo.color,
              border: badgeInfo.border
            }}
          >
            {badgeInfo.label}
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
            <span className="review-file-name">{fileName}</span>
            {dirPath ? <span className="review-file-dir">{dirPath}</span> : null}
            {item.oldPath ? (
              <span className="review-file-rename">Renamed from {item.oldPath}</span>
            ) : null}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {hasNumstat && (
            <div className="review-numstat">
              {additions > 0 && <span style={{ color: '#4ade80' }}>+{additions}</span>}
              {deletions > 0 && <span style={{ color: '#f87171' }}>-{deletions}</span>}
            </div>
          )}

          <span
            className="review-status-badge"
            style={{ background: item.badgeColor, color: item.textColor }}
          >
            {item.label}
          </span>
        </div>
      </div>
    );
  };

  const renderFileControls = () => {
    return (
      <div style={{ display: 'flex', gap: '8px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            value={fileSearchQuery}
            onChange={(e) => setFileSearchQuery(e.target.value)}
            placeholder="Search changed files..."
            style={{
              width: '100%',
              background: '#141416',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px',
              color: '#f4f4f5',
              fontSize: '12px',
              padding: '5px 8px 5px 24px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a1a1aa"
            strokeWidth="2.5"
            style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          {fileSearchQuery && (
            <button
              onClick={() => setFileSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        <div ref={sortDropdownRef} style={{ position: 'relative', flexShrink: 0, zIndex: sortDropdownOpen ? 40 : 1 }}>
          <button
            type="button"
            onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
            className={`panel-select-trigger ${sortDropdownOpen ? 'open' : ''}`}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              minWidth: '84px',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px'
            }}
          >
            <span className="panel-select-trigger-label" style={{ fontSize: '12px', textTransform: 'capitalize' }}>
              {fileSortKey}
            </span>
            <ChevronDownIcon size={12} />
          </button>
          {sortDropdownOpen && (
            <div
              className="panel-select-dropdown overview-sort-dropdown"
              style={{
                left: 'auto',
                right: 0,
                top: '100%',
                marginTop: 4,
                minWidth: 120,
                width: 'max-content',
                zIndex: 300,
                padding: 4,
                background: '#1a1a1c',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                boxShadow: '0 12px 28px rgba(0,0,0,0.55)',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none'
              }}
            >
              {(['path', 'type', 'lines', 'status'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setFileSortKey(key);
                    setSortDropdownOpen(false);
                  }}
                  className={`panel-select-option ${fileSortKey === key ? 'active' : ''}`}
                  style={{ padding: '7px 12px', fontSize: '12px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}
                >
                  <span className="panel-select-option-label" style={{ fontSize: '12px', textTransform: 'capitalize' }}>
                    {key}
                  </span>
                  {fileSortKey === key && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDiffLine = (line: string, index: number) => {
    let lineBg = 'transparent';
    let lineColor = '#e4e4e7';
    if (line.startsWith('+')) {
      lineBg = 'rgba(34, 197, 94, 0.1)';
      lineColor = '#4ade80';
    } else if (line.startsWith('-')) {
      lineBg = 'rgba(239, 68, 68, 0.1)';
      lineColor = '#f87171';
    } else if (line.startsWith('@@')) {
      lineBg = 'rgba(139, 92, 246, 0.1)';
      lineColor = '#a78bfa';
    } else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
      lineColor = '#71717a';
    }
    return (
      <div key={index} style={{ background: lineBg, color: lineColor, padding: '2px 8px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '11px' }}>
        {line}
      </div>
    );
  };

  return (
    <div className="overview-panel-root">
      {/* Context strip: branch + workspace + refresh in one surface */}
      <section className="overview-context-card" aria-label="Workspace context">
        <div className="overview-context-header">
          <div className="overview-context-title">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>Context</span>
          </div>
          <button
            type="button"
            className={`overview-refresh-btn refresh-btn${refreshing ? ' is-refreshing' : ''}`}
            onClick={() => {
              if (refreshing) return;
              setRefreshing(true);
              const startedAt = Date.now();
              const minSpinMs = 600;
              void Promise.all([loadGitStatus(), loadArtifacts()])
                .catch(() => {
                  /* keep UI feedback even if a load fails */
                })
                .finally(() => {
                  const elapsed = Date.now() - startedAt;
                  const wait = Math.max(0, minSpinMs - elapsed);
                  window.setTimeout(() => setRefreshing(false), wait);
                });
            }}
            disabled={refreshing}
            aria-busy={refreshing}
            title={refreshing ? 'Refreshing…' : 'Refresh overview data'}
          >
            <span className="refresh-btn-icon-wrap" aria-hidden>
              <RefreshIcon size={12} className="refresh-btn-icon" />
            </span>
            <span className="refresh-btn-label">Refresh</span>
          </button>
        </div>

        <div className="overview-context-stats">
          <div className="overview-stat">
            <span className="overview-stat-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              Git Branch
            </span>
            <span
              className="overview-stat-value is-branch"
              title={gitStatus?.branch || 'no branch'}
            >
              {gitStatus?.branch || 'no branch'}
            </span>
          </div>
          <div className="overview-stat">
            <span className="overview-stat-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Workspace
            </span>
            <span
              className="overview-stat-value is-workspace"
              title={activeWorkspace?.name || 'none'}
            >
              {activeWorkspace?.name || 'none'}
            </span>
          </div>
        </div>
      </section>



      <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', overflow: 'hidden', background: '#141416' }}>
        <div 
          onClick={() => toggleExpanded('subagents')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#18181b', cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: expanded.subagents ? '#fafafa' : '#d4d4d8', fontSize: '12px', fontWeight: 600 }}>Subagents</span>
            <span style={{ fontSize: '11px', background: 'rgba(167, 139, 250, 0.15)', color: '#c4b5fd', padding: '1px 6px', borderRadius: '10px', fontWeight: 500 }}>
              {workspaceRuns.length} runs
            </span>
          </div>
          {expanded.subagents ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          )}
        </div>

        {expanded.subagents && (
          <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {workspaceRuns.length === 0 ? (
              <div style={{
                background: '#18181b',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: '20px 12px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '12px', color: '#a1a1aa', lineHeight: 1.5 }}>No subagent runs recorded yet.</span>
              </div>
            ) : (
              <>
                {workspaceRuns.slice(0, 5).map((run) => (
                  <OverviewAgentRunRow key={run.id} run={run} mode="compact" />
                ))}
                {workspaceRuns.length > 5 && (
                  <button
                    type="button"
                    className="overview-see-all-btn"
                    onClick={() => {
                      setRunStatusFilter('all');
                      setSeeAllRunsOpen(true);
                    }}
                  >
                    + {workspaceRuns.length - 5} more (See all)
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        /* visible so Path sort dropdown is not clipped */
        overflow: sortDropdownOpen ? 'visible' : 'hidden',
        background: '#141416',
        position: 'relative',
        zIndex: sortDropdownOpen ? 20 : 0
      }}>
        <div 
          onClick={() => toggleExpanded('files')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: '#18181b',
            cursor: 'pointer',
            userSelect: 'none',
            borderRadius: expanded.files ? '8px 8px 0 0' : 8
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: expanded.files ? '#fafafa' : '#d4d4d8', fontSize: '12px', fontWeight: 600 }}>Files Changed</span>
            <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#7dd3fc', padding: '1px 6px', borderRadius: '10px', fontWeight: 500 }}>
              {processedFiles.length} files
            </span>
          </div>
          {expanded.files ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          )}
        </div>

        {expanded.files && (
          <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'visible', position: 'relative', zIndex: 1 }}>
            {!gitStatus || gitStatus.changedFiles.length === 0 ? (
              <div style={{
                background: '#18181b',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: '20px 12px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '12px', color: '#a1a1aa', lineHeight: 1.5 }}>Working tree clean. No files changed.</span>
              </div>
            ) : (
              <>
                {renderFileControls()}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  {processedFiles.length === 0 ? (
                    <span style={{ fontSize: '12px', color: '#a1a1aa', padding: '4px 2px' }}>No matching files.</span>
                  ) : (
                    processedFiles.slice(0, 5).map(renderFileItem)
                  )}
                </div>
                {processedFiles.length > 5 && (
                  <button 
                    onClick={() => setSeeAllFilesOpen(true)}
                    style={{ background: 'none', border: 'none', color: '#7dd3fc', fontSize: '12px', cursor: 'pointer', textAlign: 'left', padding: '4px 2px' }}
                  >
                    + {processedFiles.length - 5} more (See all)
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', overflow: 'hidden', background: '#141416' }}>
        <div 
          onClick={() => toggleExpanded('artifacts')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#18181b', cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: expanded.artifacts ? '#fafafa' : '#d4d4d8', fontSize: '12px', fontWeight: 600 }}>Artifacts</span>
            <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', padding: '1px 6px', borderRadius: '10px', fontWeight: 500 }}>
              {artifacts.length} files
            </span>
          </div>
          {expanded.artifacts ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          )}
        </div>

        {expanded.artifacts && (
          <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {artifacts.length === 0 ? (
              <div style={{
                background: '#18181b',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: '20px 12px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '12px', color: '#a1a1aa', lineHeight: 1.5 }}>No artifacts found.</span>
              </div>
            ) : (
              Object.keys(categorizedArtifacts).map((catName) => {
                const list = categorizedArtifacts[catName];
                if (list.length === 0) return null;
                return (
                  <div key={catName} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#d4d4d8', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                      {catName}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {list.slice(0, 5).map((art) => (
                        <ArtifactItem
                          key={art.relPath}
                          art={art}
                          tasks={tasks}
                          artifactTasks={artifactTasks}
                          handleLinkTask={handleLinkTask}
                          handleDeleteArtifact={handleDeleteArtifact}
                          handleOpenArtifact={handleOpenArtifact}
                        />
                      ))}
                      {list.length > 5 && (
                        <button 
                          onClick={() => setSeeAllModal({
                            title: `All ${catName} Artifacts`,
                            children: (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                                {list.map((art) => (
                                  <ArtifactItem
                                    key={art.relPath}
                                    art={art}
                                    tasks={tasks}
                                    artifactTasks={artifactTasks}
                                    handleLinkTask={handleLinkTask}
                                    handleDeleteArtifact={(deletedArt, e) => {
                                      setSeeAllModal(null);
                                      void handleDeleteArtifact(deletedArt, e);
                                    }}
                                    handleOpenArtifact={(openedArt) => {
                                      setSeeAllModal(null);
                                      handleOpenArtifact(openedArt);
                                    }}
                                  />
                                ))}
                              </div>
                            )
                          })}
                          style={{ background: 'none', border: 'none', color: '#7dd3fc', fontSize: '12px', cursor: 'pointer', textAlign: 'left', padding: '4px 2px' }}
                        >
                          + {list.length - 5} more (See all)
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', overflow: 'hidden', background: '#141416' }}>
        <div 
          onClick={() => toggleExpanded('backgroundTasks')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#18181b', cursor: 'pointer', userSelect: 'none' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: expanded.backgroundTasks ? '#fafafa' : '#d4d4d8', fontSize: '12px', fontWeight: 600 }}>Background Tasks</span>
            <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', padding: '1px 6px', borderRadius: '10px', fontWeight: 500 }}>
              {backgroundTasks.length} active
            </span>
          </div>
          {expanded.backgroundTasks ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          )}
        </div>

        {expanded.backgroundTasks && (
          <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {backgroundTasks.length === 0 ? (
              <div style={{
                background: '#18181b',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: '20px 12px',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: '12px', color: '#a1a1aa', lineHeight: 1.5 }}>No active background tasks.</span>
              </div>
            ) : (
              backgroundTasks.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '75%' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#f4f4f5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name}
                    </span>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>{t.type}</span>
                  </div>
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#fcd34d'
                  }}>{t.status}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>



      {artifactModal && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 10, 12, 0.92)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            background: '#16161a'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '80%' }}>
              <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 500 }}>Artifact Preview</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fafafa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {artifactModal.name}
              </span>
            </div>
            <button 
              onClick={() => setArtifactModal(null)}
              style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', color: '#a1a1aa', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', background: '#0e0e11', padding: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {artifactModal.type === 'Media' ? (
              <img 
                src={`data:image/png;base64,${artifactModal.base64}`} 
                alt={artifactModal.name} 
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} 
              />
            ) : (
              <pre style={{ margin: 0, width: '100%', height: '100%', whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '11px', color: '#e4e4e7', overflow: 'auto' }}>
                {artifactModal.content}
              </pre>
            )}
          </div>
        </div>
      )}

      {seeAllModal && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 10, 12, 0.92)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            background: '#16161a'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#fafafa' }}>
              {seeAllModal.title}
            </span>
            <button 
              onClick={() => setSeeAllModal(null)}
              style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', color: '#a1a1aa', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', background: '#0e0e11', padding: '16px' }}>
            {seeAllModal.children}
          </div>
        </div>
      )}

      {seeAllRunsOpen && (
        <div className="overview-see-all-sheet" role="dialog" aria-label="All subagent runs">
          <div className="overview-see-all-head">
            <div className="overview-see-all-head-text">
              <span className="overview-see-all-kicker">Subagents</span>
              <span className="overview-see-all-title">
                All runs
                <span className="overview-see-all-count">{workspaceRuns.length}</span>
              </span>
            </div>
            <button
              type="button"
              className="overview-see-all-close"
              onClick={() => setSeeAllRunsOpen(false)}
              title="Close"
              aria-label="Close"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="overview-run-filters" role="tablist" aria-label="Filter by status">
            {(
              [
                { id: 'all' as const, label: 'All' },
                { id: 'running' as const, label: 'Running' },
                { id: 'finished' as const, label: 'Finished' },
                { id: 'cancelled' as const, label: 'Cancelled' },
                { id: 'failed' as const, label: 'Failed' }
              ] as const
            ).map((f) => {
              const count =
                f.id === 'all'
                  ? workspaceRuns.length
                  : workspaceRuns.filter((r) => r.status === f.id).length;
              if (f.id !== 'all' && count === 0) return null;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={runStatusFilter === f.id}
                  className={`overview-run-filter-chip${runStatusFilter === f.id ? ' is-active' : ''}`}
                  onClick={() => setRunStatusFilter(f.id)}
                >
                  {f.label}
                  <span className="overview-run-filter-n">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="overview-see-all-body">
            {filteredWorkspaceRuns.length === 0 ? (
              <div className="overview-see-all-empty">No runs match this filter.</div>
            ) : (
              filteredWorkspaceRuns.map((run) => (
                <OverviewAgentRunRow key={run.id} run={run} mode="list" />
              ))
            )}
          </div>
        </div>
      )}

      {seeAllFilesOpen && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 10, 12, 0.92)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            background: '#16161a'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 500 }}>Files Changed</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#fafafa' }}>
                All Changed Files ({processedFiles.length})
              </span>
            </div>
            <button 
              onClick={() => setSeeAllFilesOpen(false)}
              style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', color: '#a1a1aa', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', background: '#0e0e11', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {renderFileControls()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {processedFiles.length === 0 ? (
                <div style={{
                  padding: '28px 16px',
                  color: '#a1a1aa',
                  textAlign: 'center',
                  fontSize: '12px',
                  background: '#141416',
                  border: '1px dashed rgba(255,255,255,0.1)',
                  borderRadius: 8
                }}>
                  No files match search query.
                </div>
              ) : (
                processedFiles.map(renderFileItem)
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function TasksPanel() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  const [activeDragOverColumn, setActiveDragOverColumn] = useState<TaskStatus | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const tasks = useDeckStore((state) => state.tasks);
  const createTask = useDeckStore((state) => state.createTask);
  const updateTask = useDeckStore((state) => state.updateTask);

  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter(
      (task) => task.title.toLowerCase().includes(query) || (task.body && task.body.toLowerCase().includes(query))
    );
  }, [tasks, searchQuery]);

  const grouped = useMemo(
    () =>
      Object.fromEntries(
        taskStatuses.map((status) => [status, filteredTasks.filter((task) => task.status === status)])
      ) as Record<TaskStatus, DeckTask[]>,
    [filteredTasks]
  );

  const openCount = useMemo(
    () => tasks.filter((t) => t.status !== 'done').length,
    [tasks]
  );

  const submit = () => {
    if (!title.trim()) {
      setTitleError(true);
      setComposerOpen(true);
      titleInputRef.current?.focus();
      return;
    }
    createTask(title, body);
    setTitle('');
    setBody('');
    setTitleError(false);
    setComposerOpen(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setActiveDragOverColumn(status);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setActiveDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setActiveDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      updateTask(taskId, { status });
    }
  };

  const toggleColumn = (status: TaskStatus) => {
    setCollapsedColumns((prev) => ({ ...prev, [status]: !prev[status] }));
  };

  const isDragging = activeDragOverColumn !== null;

  return (
    <div className="tasks-panel">
      <div className="tasks-toolbar">
        <div className="tasks-toolbar-meta">
          <span className="tasks-open-count">
            <strong>{openCount}</strong> open
          </span>
          <span className="tasks-total-count">{tasks.length} total</span>
        </div>
        <button
          type="button"
          className={`task-new-btn${composerOpen ? ' is-open' : ''}`}
          aria-expanded={composerOpen}
          aria-label={composerOpen ? 'Close new task form' : 'New task'}
          title={composerOpen ? 'Close' : 'New task'}
          onClick={() => {
            if (composerOpen) {
              setComposerOpen(false);
              setTitleError(false);
            } else {
              setComposerOpen(true);
              requestAnimationFrame(() => titleInputRef.current?.focus());
            }
          }}
        >
          <span className="task-new-btn-icon" aria-hidden>
            {/* + rotates into × when open */}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
          <span className="task-new-btn-label">{composerOpen ? 'Close' : 'New task'}</span>
        </button>
      </div>

      <div className={`task-composer${composerOpen ? ' open' : ''}`}>
        <input
          ref={titleInputRef}
          className={titleError ? 'field-invalid' : undefined}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (titleError && event.target.value.trim()) setTitleError(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
            if (event.key === 'Escape') {
              setComposerOpen(false);
              setTitleError(false);
            }
          }}
          placeholder="Task title"
          aria-invalid={titleError}
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              submit();
            }
            if (event.key === 'Escape') {
              setComposerOpen(false);
            }
          }}
          placeholder="Details or prompt (optional)"
          rows={2}
        />
        <div className="task-composer-actions">
          <span className="task-composer-hint">Enter · Ctrl+Enter · Esc</span>
          <div className="task-composer-btns">
            <button type="button" className="task-composer-cancel" onClick={() => { setComposerOpen(false); setTitleError(false); }}>
              Cancel
            </button>
            <button type="button" className="task-add-btn" onClick={submit}>
              Add task
            </button>
          </div>
        </div>
      </div>

      <div className="task-search">
        <svg className="task-search-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search tasks…"
          aria-label="Search tasks"
        />
        {searchQuery ? (
          <button
            type="button"
            className="task-search-clear"
            title="Clear search"
            onClick={() => setSearchQuery('')}
          >
            ×
          </button>
        ) : null}
      </div>

      {filteredTasks.length === 0 ? (
        <div className="tasks-empty">
          {tasks.length === 0 ? (
            <>
              <strong>No tasks yet</strong>
              <p>Create a task to track work, agents, and Figma build steps.</p>
              <button type="button" className="task-add-btn" onClick={() => { setComposerOpen(true); requestAnimationFrame(() => titleInputRef.current?.focus()); }}>
                New task
              </button>
            </>
          ) : (
            <>
              <strong>No matches</strong>
              <p>Nothing matches “{searchQuery.trim()}”.</p>
              <button type="button" className="task-composer-cancel" onClick={() => setSearchQuery('')}>
                Clear search
              </button>
            </>
          )}
        </div>
      ) : (
        taskStatuses.map((status) => {
          const list = grouped[status];
          const isEmpty = list.length === 0;
          // Hide empty columns unless dragging (drop targets) or it's the only non-empty filter noise
          if (isEmpty && !isDragging && status !== 'todo') return null;

          const collapsed = !!collapsedColumns[status] && !isEmpty;
          return (
            <section
              className={`task-column${activeDragOverColumn === status ? ' drag-over' : ''}${isEmpty ? ' is-empty' : ''}${collapsed ? ' is-collapsed' : ''}`}
              key={status}
              onDragOver={handleDragOver}
              onDragEnter={(e) => handleDragEnter(e, status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, status)}
            >
              <button
                type="button"
                className={`task-column-header status-${status}`}
                onClick={() => toggleColumn(status)}
                aria-expanded={!collapsed}
              >
                <span className="task-column-title">{status}</span>
                <span className="task-column-count">{list.length}</span>
                {!isEmpty ? (
                  <svg className="task-column-chevron" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                ) : null}
              </button>
              {!collapsed ? (
                <div className="task-column-body">
                  {isEmpty ? (
                    <p className="task-column-empty">
                      {status === 'todo' ? 'Drop tasks here or create one above.' : 'Drop a task here.'}
                    </p>
                  ) : (
                    list.map((task) => <TaskCard task={task} key={task.id} />)
                  )}
                </div>
              ) : null}
            </section>
          );
        })
      )}
    </div>
  );
}

type CustomSelectOption = {
  value: string;
  label: string;
};

type CustomSelectProps = {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  capitalize?: boolean;
  'aria-label'?: string;
};

function SelectChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`custom-select-chevron${open ? ' open' : ''}`}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Custom dropdown matching app UI — replaces native <select>. */
function CustomSelect({
  value,
  options,
  onChange,
  className,
  triggerClassName,
  disabled = false,
  capitalize = true,
  'aria-label': ariaLabel
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(() =>
    Math.max(0, options.findIndex((o) => o.value === value))
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    openUp: boolean;
  } | null>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Collapsed / hidden trigger — drop the portal menu
    if (rect.width < 2 || rect.height < 2) {
      setOpen(false);
      return;
    }
    const gap = 4;
    const preferredMax = 280;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < 140 && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(96, Math.min(preferredMax, available));
    // Long labels: allow menu a bit wider than trigger (still clamp to viewport)
    const minMenuW = Math.max(rect.width, 220);
    const maxMenuW = Math.min(window.innerWidth - 16, 420);
    const width = Math.min(maxMenuW, Math.max(minMenuW, rect.width));
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - 8 - width);
    }
    setMenuPos({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      left,
      width,
      maxHeight,
      openUp
    });
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const selectValue = useCallback(
    (next: string) => {
      onChange(next);
      setOpen(false);
    },
    [onChange]
  );

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('resize', onResize);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open, options, value, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => Math.min(options.length - 1, h + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        setHighlight(0);
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        setHighlight(options.length - 1);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const opt = options[highlight];
        if (opt) selectValue(opt.value);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, options, highlight, close, selectValue]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const active = menuRef.current.querySelector<HTMLElement>('[data-highlighted="true"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [open, highlight]);

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            className="custom-select-menu"
            role="listbox"
            style={{
              position: 'fixed',
              top: menuPos.openUp ? undefined : menuPos.top,
              bottom: menuPos.openUp ? window.innerHeight - menuPos.top : undefined,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
              zIndex: 10050
            }}
          >
            {options.map((opt, index) => {
              const isActive = opt.value === value;
              const isHighlighted = index === highlight;
              return (
                <button
                  key={opt.value === '' ? `__empty-${index}` : opt.value}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  title={opt.label}
                  data-highlighted={isHighlighted ? 'true' : undefined}
                  className={`custom-select-option${isActive ? ' active' : ''}${isHighlighted ? ' highlighted' : ''}`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectValue(opt.value);
                  }}
                >
                  <span
                    className={`custom-select-option-label${capitalize ? ' capitalize' : ''}`}
                    title={opt.label}
                  >
                    {opt.label}
                  </span>
                  {isActive ? <span className="custom-select-check" aria-hidden>✓</span> : null}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  const selectedLabel = selected?.label ?? 'Select…';

  return (
    <div
      ref={rootRef}
      className={`custom-select${open ? ' open' : ''}${className ? ` ${className}` : ''}${disabled ? ' disabled' : ''}`}
    >
      <button
        type="button"
        className={`custom-select-trigger${triggerClassName ? ` ${triggerClassName}` : ''}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || selectedLabel}
        title={selectedLabel}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span
          className={`custom-select-value${capitalize ? ' capitalize' : ''}${!selected ? ' placeholder' : ''}`}
          title={selectedLabel}
        >
          {selectedLabel}
        </span>
        <SelectChevron open={open} />
      </button>
      {menu}
    </div>
  );
}

function TaskCard({ task }: { task: DeckTask }) {
  const workspaces = useDeckStore((state) => state.workspaces);
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const agentProfiles = useDeckStore((state) => state.agentProfiles);
  const skills = useDeckStore((state) => state.skills);
  const updateTask = useDeckStore((state) => state.updateTask);
  const deleteTask = useDeckStore((state) => state.deleteTask);
  const assignTaskToPane = useDeckStore((state) => state.assignTaskToPane);
  const assignTaskToAgent = useDeckStore((state) => state.assignTaskToAgent);
  const runTaskInPane = useDeckStore((state) => state.runTaskInPane);
  const activePaneId = useDeckStore((state) => state.activePaneId);
  const runAgentProfile = useDeckStore((state) => state.runAgentProfile);
  const workspace = workspaces.find((item) => item.id === activeWorkspaceId) ?? null;
  const panes = workspace ? Object.values(workspace.panes) : [];
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const deleteActionsRef = useRef<HTMLDivElement | null>(null);

  const reviewerAgents = useMemo(
    () =>
      agentProfiles.filter(
        (a) => a.id === 'agent-reviewer' || a.id.startsWith('agent-reviewer-')
      ),
    [agentProfiles]
  );
  const [reviewerId, setReviewerId] = useState(
    () => reviewerAgents[0]?.id ?? 'agent-reviewer'
  );

  useEffect(() => {
    if (!reviewerAgents.some((a) => a.id === reviewerId) && reviewerAgents[0]) {
      setReviewerId(reviewerAgents[0].id);
    }
  }, [reviewerAgents, reviewerId]);

  useEffect(() => {
    if (!isExpanded) setDeleteConfirming(false);
  }, [isExpanded]);

  useEffect(() => {
    if (!deleteConfirming) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (deleteActionsRef.current && !deleteActionsRef.current.contains(e.target as Node)) {
        setDeleteConfirming(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDeleteConfirming(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [deleteConfirming]);

  const handleReviewOutput = async () => {
    const reviewerAgent =
      reviewerAgents.find((a) => a.id === reviewerId) ?? reviewerAgents[0] ?? null;
    if (!reviewerAgent || !workspace) {
      alert('No reviewer agent profile found.');
      return;
    }
    const paneId = task.paneId ?? activePaneId;
    const pane = paneId ? workspace.panes[paneId] : null;
    if (!pane) {
      alert('Select or assign a pane before running the review.');
      return;
    }
    await runAgentProfile(reviewerAgent, pane, task);
  };

  const handleDragStart = (e: React.DragEvent) => {
    // Kanban column reorder still uses text/plain
    e.dataTransfer.setData('text/plain', task.id);
    // Terminal drop uses dedicated MIME so host doesn't treat id as shell text
    e.dataTransfer.setData('text/task-id', task.id);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const toggleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    updateTask(task.id, { status: nextStatus });
  };

  const pane = panes.find(p => p.id === task.paneId);
  const agent = agentProfiles.find(a => a.id === task.agentId);
  const skill = skills.find(s => s.id === task.skillId);

  const contextCount = [
    task.includeContext?.techStack,
    task.includeContext?.folderStructure,
    task.includeContext?.codingRules,
    task.includeContext?.projectMemory
  ].filter(Boolean).length;

  return (
    <article
      data-task-id={task.id}
      className={`task-card ${task.priority ?? 'medium'} ${isExpanded ? 'expanded' : ''} ${isDragOver ? 'drag-over-skill' : ''}`}
      draggable="true"
      onDragStart={handleDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const skillId = e.dataTransfer.getData('text/skill-id');
        if (skillId) {
          updateTask(task.id, { skillId });
        }
      }}
      onClick={() => setIsExpanded(prev => !prev)}
      style={{ cursor: 'pointer' }}
    >
      {/* Collapsed Header Layout */}
      <div className="task-card-header">
        <div
          className={`task-status-circle ${task.status}`}
          onClick={toggleStatus}
          title={`Status: ${task.status}. Click to cycle.`}
        >
          {task.status === 'done' && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
          {task.status === 'running' && (
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
            </svg>
          )}
          {task.status === 'review' && (
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          )}
        </div>
        <span className={`task-title-text ${task.status === 'done' ? 'done' : ''}`}>
          {task.title || 'Untitled Task'}
        </span>

        <div className="task-collapsed-actions">
          <button
            type="button"
            className="task-quick-run-btn"
            title="Run task"
            onClick={(e) => {
              e.stopPropagation();
              runTaskInPane(task.id);
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </button>
          <div className="task-expand-chevron">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Collapsed Metadata Row with Smooth Grid Slide */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: !isExpanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.18s ease',
          opacity: !isExpanded ? 1 : 0,
          pointerEvents: !isExpanded ? 'auto' : 'none'
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div className="task-collapsed-meta" style={{ marginTop: '4px' }}>
            <span
              className={`priority-tag ${task.priority ?? 'medium'}`}
              title={`Priority: ${task.priority ?? 'medium'}`}
            >
              <span className="priority-tag-dot" aria-hidden />
              {(task.priority ?? 'medium') === 'high'
                ? 'High'
                : (task.priority ?? 'medium') === 'low'
                  ? 'Low'
                  : 'Medium'}
            </span>
            {pane && (
              <span className="resource-badge" title={`Linked terminal pane: ${pane.title}`}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 17 10 11 4 5"/>
                  <line x1="12" y1="19" x2="20" y2="19"/>
                </svg>
                {pane.title}
              </span>
            )}
            {agent && (
              <span className="resource-badge resource-badge-agent" title={`Agent profile: ${agent.name}`}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="11" width="18" height="10" rx="2"/>
                  <circle cx="12" cy="5" r="2"/>
                  <path d="M12 7v4"/>
                  <line x1="8" y1="16" x2="8.01" y2="16"/>
                  <line x1="16" y1="16" x2="16.01" y2="16"/>
                </svg>
                {agent.name}
              </span>
            )}
            {skill && (
              <span className="resource-badge" title={`Skill template: ${skill.name}`}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/>
                </svg>
                {skill.name}
              </span>
            )}
            {contextCount > 0 && (
              <span className="resource-badge has-context" title={`${contextCount} attached workspace contexts`}>
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
                +{contextCount} Ctx
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Editing Body Wrapper with Smooth Grid Slide */}
      <div
        style={{
          display: 'grid',
          gridTemplateRows: isExpanded ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease',
          opacity: isExpanded ? 1 : 0,
          pointerEvents: isExpanded ? 'auto' : 'none'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ overflow: 'hidden' }}>
          <div className="task-card-expanded-body">
            <div className="task-expanded-grid">
              <div className="task-field full-width">
                <label>Task Title</label>
                <input
                  value={task.title}
                  onChange={(event) => updateTask(task.id, { title: event.target.value })}
                  placeholder="Title"
                />
              </div>

              <div className="task-field full-width">
                <label>Task Details / Prompt</label>
                <textarea
                  value={task.body ?? ''}
                  onChange={(event) => updateTask(task.id, { body: event.target.value })}
                  placeholder="Details or prompt instructions..."
                  rows={3}
                />
              </div>

              <div className="task-field">
                <label>Status</label>
                <CustomSelect
                  aria-label="Status"
                  value={task.status}
                  onChange={(v) => updateTask(task.id, { status: v as TaskStatus })}
                  options={taskStatuses.map((status) => ({ value: status, label: status }))}
                />
              </div>

              <div className="task-field">
                <label>Priority</label>
                <CustomSelect
                  aria-label="Priority"
                  value={task.priority ?? 'medium'}
                  onChange={(v) => updateTask(task.id, { priority: v as TaskPriority })}
                  triggerClassName={`priority-select ${task.priority ?? 'medium'}`}
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' }
                  ]}
                />
              </div>

              <div className="task-field">
                <label>Linked Terminal Pane</label>
                <div style={{ display: 'flex', gap: '4px', width: '100%', alignItems: 'stretch' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <CustomSelect
                      aria-label="Linked terminal pane"
                      value={task.paneId ?? ''}
                      onChange={(v) => assignTaskToPane(task.id, v || null)}
                      capitalize={false}
                      options={[
                        { value: '', label: 'Active pane' },
                        ...panes.map((p) => ({ value: p.id, label: p.title }))
                      ]}
                    />
                  </div>
                  {task.paneId && (
                    <button
                      type="button"
                      onClick={() => useDeckStore.getState().selectPane(task.paneId!)}
                      title="Focus linked terminal pane"
                      style={{
                        padding: '4px 6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '28px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '5px'
                      }}
                    >
                      <EyeIcon />
                    </button>
                  )}
                </div>
              </div>

              <div className="task-field">
                <label>Agent Command</label>
                <CustomSelect
                  aria-label="Agent command"
                  value={task.agentId ?? ''}
                  onChange={(v) => assignTaskToAgent(task.id, v || null)}
                  capitalize={false}
                  options={[
                    { value: '', label: 'No agent command' },
                    ...agentProfiles.map((agentProfile) => ({
                      value: agentProfile.id,
                      label: agentProfile.name
                    }))
                  ]}
                />
              </div>

              <div className="task-field full-width">
                <label>Skill Template</label>
                <CustomSelect
                  aria-label="Skill template"
                  value={task.skillId ?? ''}
                  onChange={(v) => updateTask(task.id, { skillId: v || null })}
                  capitalize={false}
                  options={[
                    { value: '', label: 'No skill template' },
                    ...skills.map((s) => ({ value: s.id, label: s.name }))
                  ]}
                />
              </div>
            </div>

            {/* Context Attachments */}
            {workspace && (
              <div className="task-field full-width">
                <div className="task-context-label-row">
                  <span>Attach Workspace Context:</span>
                  {workspace.context && (
                    <span className="context-length-preview-text">
                      +{
                        (task.includeContext?.techStack ? workspace.context.techStack.length + 25 : 0) +
                        (task.includeContext?.folderStructure ? workspace.context.folderStructure.length + 30 : 0) +
                        (task.includeContext?.codingRules ? workspace.context.codingRules.length + 40 : 0) +
                        (task.includeContext?.projectMemory ? workspace.context.projectMemory.length + 30 : 0)
                      } chars context
                    </span>
                  )}
                </div>
                <div className="task-context-grid">
                  <div
                    className={`context-pill-toggle ${task.includeContext?.techStack ? 'active' : ''}`}
                    title="Include package dependencies and scripts"
                    onClick={() => {
                      const current = task.includeContext || { techStack: false, folderStructure: false, codingRules: false, projectMemory: false };
                      updateTask(task.id, { includeContext: { ...current, techStack: !current.techStack } });
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                      <line x1="12" y1="22.08" x2="12" y2="12"/>
                    </svg>
                    <span>Stack</span>
                  </div>
                  <div
                    className={`context-pill-toggle ${task.includeContext?.folderStructure ? 'active' : ''}`}
                    title="Include project directory tree"
                    onClick={() => {
                      const current = task.includeContext || { techStack: false, folderStructure: false, codingRules: false, projectMemory: false };
                      updateTask(task.id, { includeContext: { ...current, folderStructure: !current.folderStructure } });
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <line x1="6" y1="3" x2="6" y2="21"/>
                      <path d="M6 12h12a2 2 0 0 1 2 2v3"/>
                      <path d="M6 6h8a2 2 0 0 1 2 2v3"/>
                    </svg>
                    <span>Tree</span>
                  </div>
                  <div
                    className={`context-pill-toggle ${task.includeContext?.codingRules ? 'active' : ''}`}
                    title="Include linting/formatting rules"
                    onClick={() => {
                      const current = task.includeContext || { techStack: false, folderStructure: false, codingRules: false, projectMemory: false };
                      updateTask(task.id, { includeContext: { ...current, codingRules: !current.codingRules } });
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="9" y1="9" x2="15" y2="9"/>
                      <line x1="9" y1="13" x2="15" y2="13"/>
                      <line x1="9" y1="17" x2="13" y2="17"/>
                    </svg>
                    <span>Rules</span>
                  </div>
                  <div
                    className={`context-pill-toggle ${task.includeContext?.projectMemory ? 'active' : ''}`}
                    title="Include README or MEMORY notes"
                    onClick={() => {
                      const current = task.includeContext || { techStack: false, folderStructure: false, codingRules: false, projectMemory: false };
                      updateTask(task.id, { includeContext: { ...current, projectMemory: !current.projectMemory } });
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                      <line x1="6" y1="6" x2="6.01" y2="6"/>
                      <line x1="6" y1="18" x2="6.01" y2="18"/>
                      <line x1="18" y1="6" x2="18.01" y2="6"/>
                      <line x1="18" y1="18" x2="18.01" y2="18"/>
                    </svg>
                    <span>Memory</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Row — inline confirm delete (fixed slots + crossfade) */}
            <div
              ref={deleteActionsRef}
              className={`task-actions item-actions${deleteConfirming ? ' confirming' : ''}`}
            >
              <div className="task-actions-primary">
                <div className="task-actions-idle-group">
                  <button
                    type="button"
                    className="task-btn-run"
                    onClick={() => runTaskInPane(task.id)}
                    tabIndex={deleteConfirming ? -1 : 0}
                  >
                    Run
                  </button>
                  {task.status === 'review' && reviewerAgents.length > 0 && (
                    <div className="task-review-actions">
                      {reviewerAgents.length > 1 ? (
                        <CustomSelect
                          aria-label="Reviewer agent"
                          value={reviewerId}
                          onChange={setReviewerId}
                          capitalize={false}
                          options={reviewerAgents.map((a) => ({
                            value: a.id,
                            label: a.name.replace(/^Reviewer · /, '')
                          }))}
                        />
                      ) : null}
                      <button
                        type="button"
                        className="task-btn-review"
                        onClick={handleReviewOutput}
                        title="Run selected reviewer on this task's output"
                        tabIndex={deleteConfirming ? -1 : 0}
                      >
                        Review
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  className="task-delete-cancel"
                  title="Cancel delete"
                  tabIndex={deleteConfirming ? 0 : -1}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirming(false);
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span>Cancel</span>
                </button>
              </div>

              <button
                type="button"
                className="task-btn-delete delete-btn"
                title={deleteConfirming ? 'Click again to confirm delete' : 'Delete'}
                onClick={(e) => {
                  e.stopPropagation();
                  if (deleteConfirming) {
                    deleteTask(task.id);
                    setDeleteConfirming(false);
                  } else {
                    setDeleteConfirming(true);
                  }
                }}
              >
                <span className="delete-idle-content">
                  <svg
                    className="trash-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  <span>Delete</span>
                </span>
                <span className="delete-confirm-content" aria-hidden={!deleteConfirming}>
                  <svg
                    className="confirm-icon"
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Confirm</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function AgentsPanel() {
  const agentProfiles = useDeckStore((state) => state.agentProfiles);
  const agentRuns = useDeckStore((state) => state.agentRuns);
  const activePaneId = useDeckStore((state) => state.activePaneId);
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const workspaces = useDeckStore((state) => state.workspaces);
  const lastPermissionNotice = useDeckStore((state) => state.lastPermissionNotice);
  const upsertAgentProfile = useDeckStore((state) => state.upsertAgentProfile);
  const deleteAgentProfile = useDeckStore((state) => state.deleteAgentProfile);
  const runAgentInPane = useDeckStore((state) => state.runAgentInPane);
  const runAgentInNewPane = useDeckStore((state) => state.runAgentInNewPane);
  const runAgentsOnPanes = useDeckStore((state) => state.runAgentsOnPanes);
  const setPaneAgentAssignments = useDeckStore((state) => state.setPaneAgentAssignments);
  const moveAgentProfile = useDeckStore((state) => state.moveAgentProfile);

  const agentsListRef = useRef<HTMLDivElement | null>(null);
  const agentFlipRectsRef = useRef<Map<string, DOMRect>>(new Map());

  const captureAgentFlipRects = useCallback(() => {
    const list = agentsListRef.current;
    if (!list) return;
    const map = new Map<string, DOMRect>();
    list.querySelectorAll('[data-agent-card-id]').forEach((node) => {
      const id = node.getAttribute('data-agent-card-id');
      if (id) map.set(id, node.getBoundingClientRect());
    });
    agentFlipRectsRef.current = map;
  }, []);

  const [draggingAgentId, setDraggingAgentId] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!draggingAgentId) {
      agentFlipRectsRef.current.clear();
      return;
    }
    const list = agentsListRef.current;
    if (!list) return;
    const prev = agentFlipRectsRef.current;
    if (prev.size === 0) return;

    list.querySelectorAll('[data-agent-card-id]').forEach((node) => {
      const el = node as HTMLElement;
      const id = el.getAttribute('data-agent-card-id');
      if (!id || id === draggingAgentId) return;
      const oldRect = prev.get(id);
      if (!oldRect) return;
      const newRect = el.getBoundingClientRect();
      const dy = oldRect.top - newRect.top;
      if (Math.abs(dy) < 0.5) return;
      el.animate(
        [
          { transform: `translate(0, ${dy}px)` },
          { transform: 'translate(0, 0)' }
        ],
        { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'both' }
      );
    });
    prev.clear();
  }, [draggingAgentId, agentProfiles]);

  const agentDropHoverRef = useRef<HTMLElement | null>(null);
  const agentPointerReorderRef = useRef<{
    agentId: string;
    pointerId: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const agentPointerCleanupRef = useRef<(() => void) | null>(null);

  const clearAgentDropHover = useCallback(() => {
    if (agentDropHoverRef.current) {
      agentDropHoverRef.current.classList.remove('skill-drop-target', 'skill-drop-target-before', 'skill-drop-target-after');
      agentDropHoverRef.current.removeAttribute('data-skill-drop-label');
      agentDropHoverRef.current = null;
    }
  }, []);

  const detachAgentPointerListeners = useCallback(() => {
    if (agentPointerCleanupRef.current) {
      agentPointerCleanupRef.current();
      agentPointerCleanupRef.current = null;
    }
  }, []);

  const beginAgentPointerReorder = useCallback(
    (agentId: string, pointerId: number, startY: number) => {
      detachAgentPointerListeners();
      agentPointerReorderRef.current = {
        agentId,
        pointerId,
        startY,
        active: false
      };

      const handlePointerMove = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        const cur = agentPointerReorderRef.current;
        if (!cur) return;
        if (!cur.active) {
          if (Math.abs(e.clientY - cur.startY) < 4) return;
          cur.active = true;
          setDraggingAgentId(agentId);
        }

        const stack = document.elementsFromPoint(e.clientX, e.clientY);
        let targetCard: HTMLElement | null = null;
        let targetTerminalPane: HTMLElement | null = null;
        for (const node of stack) {
          if (!(node instanceof Element)) continue;
          if (!targetCard) {
            const card = node.closest('[data-agent-card-id]') as HTMLElement | null;
            if (card && card.getAttribute('data-agent-card-id') !== agentId) {
              targetCard = card;
            }
          }
          if (!targetTerminalPane) {
            const term = node.closest('.terminal-pane') as HTMLElement | null;
            if (term) targetTerminalPane = term;
          }
        }

        const targetNode = targetTerminalPane || targetCard;

        if (!targetNode) {
          clearAgentDropHover();
          return;
        }

        if (agentDropHoverRef.current !== targetNode) {
          clearAgentDropHover();
          agentDropHoverRef.current = targetNode;
        }

        if (targetTerminalPane) {
          const paneId = targetTerminalPane.getAttribute('data-pane-id');
          if (paneId) {
            const store = useDeckStore.getState();
            const workspace = store.workspaces.find((w) => w.id === store.activeWorkspaceId);
            const pane = workspace?.panes[paneId];
            const isProcessRunning = pane ? pane.processStatus === 'running' || pane.processStatus === 'ready' || pane.processStatus === 'idle' : false;

            const activeTask = store.tasks.find((t) => t.paneId === paneId && t.status === 'running');
            const activeRun = store.agentRuns.find((r) => r.terminalSessionId === paneId && r.status === 'running');
            const isBusy = Boolean(activeTask || activeRun || isProcessRunning);

            targetTerminalPane.classList.add('skill-drop-target');
            if (isBusy) {
              targetTerminalPane.setAttribute('data-skill-drop-label', `⚠️ Terminal '${pane?.title || ''}' đang hoạt động — Không thể thả`);
            } else {
              const agentObj = store.agentProfiles.find((a) => a.id === agentId);
              targetTerminalPane.setAttribute('data-skill-drop-label', `Drop to run ${agentObj?.name || 'Agent'} in terminal`);
            }
          }
          return;
        }

        const rect = targetCard!.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const place: 'before' | 'after' = e.clientY < midY ? 'before' : 'after';

        targetCard!.classList.remove('skill-drop-target-before', 'skill-drop-target-after');
        targetCard!.classList.add(place === 'before' ? 'skill-drop-target-before' : 'skill-drop-target-after');
      };

      const handlePointerUp = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        const cur = agentPointerReorderRef.current;
        const hover = agentDropHoverRef.current;
        if (cur?.active && hover) {
          const paneId = hover.getAttribute('data-pane-id');
          if (paneId) {
            const store = useDeckStore.getState();
            const workspace = store.workspaces.find((w) => w.id === store.activeWorkspaceId);
            const pane = workspace?.panes[paneId];
            const isProcessRunning = pane ? pane.processStatus === 'running' || pane.processStatus === 'ready' || pane.processStatus === 'idle' : false;

            const activeTask = store.tasks.find((t) => t.paneId === paneId && t.status === 'running');
            const activeRun = store.agentRuns.find((r) => r.terminalSessionId === paneId && r.status === 'running');
            const isBusy = Boolean(activeTask || activeRun || isProcessRunning);

            if (isBusy) {
              const paneTitle = pane?.title || 'Terminal';
              window.alert(`Terminal '${paneTitle}' đang hoạt động (process running). Vui lòng mở Terminal mới hoặc thả vào Terminal đang dừng!`);
            } else {
              store.selectPane(paneId);
              void store.runAgentInPane(agentId, paneId);
            }
          } else {
            const targetId = hover.getAttribute('data-agent-card-id');
            if (targetId && targetId !== agentId) {
              const place = hover.classList.contains('skill-drop-target-before') ? 'before' : 'after';
              captureAgentFlipRects();
              moveAgentProfile(agentId, targetId, place);
            }
          }
        }
        clearAgentDropHover();
        setDraggingAgentId(null);
        agentPointerReorderRef.current = null;
        detachAgentPointerListeners();
      };

      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      window.addEventListener('pointerup', handlePointerUp, { passive: true });
      window.addEventListener('pointercancel', handlePointerUp, { passive: true });

      agentPointerCleanupRef.current = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      };
    },
    [clearAgentDropHover, detachAgentPointerListeners, moveAgentProfile]
  );

  const handleAgentDragStart = (e: React.DragEvent, agentId: string) => {
    setDraggingAgentId(agentId);
    e.dataTransfer.setData('text/plain', agentId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleAgentDragOver = (e: React.DragEvent, agentId: string) => {
    e.preventDefault();
    if (!draggingAgentId || draggingAgentId === agentId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const place: 'before' | 'after' = e.clientY < midY ? 'before' : 'after';

    const card = e.currentTarget as HTMLElement;
    document.querySelectorAll('.skill-drop-target-before, .skill-drop-target-after').forEach((el) => {
      if (el !== card) el.classList.remove('skill-drop-target-before', 'skill-drop-target-after');
    });
    card.classList.remove('skill-drop-target-before', 'skill-drop-target-after');
    card.classList.add(place === 'before' ? 'skill-drop-target-before' : 'skill-drop-target-after');
    e.dataTransfer.dropEffect = 'move';
  };

  const handleAgentDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const card = e.currentTarget as HTMLElement;
    const place = card.classList.contains('skill-drop-target-before') ? 'before' : 'after';
    card.classList.remove('skill-drop-target-before', 'skill-drop-target-after');
    if (draggingAgentId && draggingAgentId !== targetId) {
      captureAgentFlipRects();
      moveAgentProfile(draggingAgentId, targetId, place);
    }
    setDraggingAgentId(null);
  };

  const handleAgentDragEnd = () => {
    document.querySelectorAll('.skill-drop-target-before, .skill-drop-target-after').forEach((el) => {
      el.classList.remove('skill-drop-target-before', 'skill-drop-target-after');
    });
    setDraggingAgentId(null);
  };
  const [draft, setDraft] = useState(emptyAgentDraft);
  const [composerOpen, setComposerOpen] = useState(false);
  const [limit, setLimit] = useState(10);
  const [envJsonError, setEnvJsonError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [isLaunchingAll, setIsLaunchingAll] = useState(false);
  /** Avoid re-seeding auto-fill after user cleared / loaded persisted map */
  const seededWorkspaceRef = useRef<string | null>(null);

  const workspaceRuns = useMemo(() => {
    return agentRuns.filter((run) => run.workspaceId === activeWorkspaceId);
  }, [agentRuns, activeWorkspaceId]);

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  );

  const workspacePanes = useMemo(() => {
    if (!activeWorkspace) return [] as TerminalPaneConfig[];
    return Object.values(activeWorkspace.panes);
  }, [activeWorkspace]);

  const runnableAgents = useMemo(
    () => agentProfiles.filter((a) => a.providerType === 'cli' && a.commandTemplate.trim()),
    [agentProfiles]
  );

  /** Persisted map on workspace (survives app restart). */
  const paneAgentMap = activeWorkspace?.paneAgentAssignments || {};

  // Seed defaults for new panes only; never overwrite a saved assignment
  useEffect(() => {
    if (!activeWorkspaceId || !activeWorkspace) return;

    const saved = activeWorkspace.paneAgentAssignments || {};
    const paneIds = workspacePanes.map((p) => p.id);
    let changed = false;
    const next: Record<string, string> = { ...saved };

    // Drop assignments for deleted panes
    for (const key of Object.keys(next)) {
      if (!paneIds.includes(key)) {
        delete next[key];
        changed = true;
      }
    }

    // Only auto-seed when this workspace has never been seeded this session
    // AND has no saved assignments at all (first visit).
    const isFirstVisit =
      seededWorkspaceRef.current !== activeWorkspaceId && Object.keys(saved).length === 0;

    workspacePanes.forEach((pane, index) => {
      if (next[pane.id] !== undefined) return;
      if (isFirstVisit) {
        const used = new Set(Object.values(next).filter(Boolean));
        const free = runnableAgents.find((a) => !used.has(a.id));
        next[pane.id] = free?.id || runnableAgents[index % Math.max(runnableAgents.length, 1)]?.id || '';
        changed = true;
      } else {
        // New pane after user already configured → leave skip, don't surprise
        next[pane.id] = '';
        changed = true;
      }
    });

    seededWorkspaceRef.current = activeWorkspaceId;

    if (changed) {
      setPaneAgentAssignments(activeWorkspaceId, next);
    }
  }, [activeWorkspaceId, activeWorkspace, workspacePanes, runnableAgents, setPaneAgentAssignments]);

  const assignedCount = useMemo(
    () => Object.values(paneAgentMap).filter(Boolean).length,
    [paneAgentMap]
  );

  const commonAgentId = useMemo(() => {
    if (workspacePanes.length === 0) return '';
    const first = paneAgentMap[workspacePanes[0].id] || '';
    if (!first) return '';
    const allSame = workspacePanes.every((pane) => (paneAgentMap[pane.id] || '') === first);
    return allSame ? first : '';
  }, [workspacePanes, paneAgentMap]);

  const handleSetAllPanes = (agentId: string) => {
    if (agentId === '') return;
    const targetId = agentId === '__CLEAR_ALL__' ? '' : agentId;
    const next: Record<string, string> = {};
    workspacePanes.forEach((pane) => {
      next[pane.id] = targetId;
    });
    updateAssignments(next);
  };

  const updateAssignments = (next: Record<string, string>) => {
    if (!activeWorkspaceId) return;
    setPaneAgentAssignments(activeWorkspaceId, next);
  };

  const handleAutoFill = () => {
    const next: Record<string, string> = {};
    workspacePanes.forEach((pane, index) => {
      next[pane.id] = runnableAgents[index % Math.max(runnableAgents.length, 1)]?.id || '';
    });
    updateAssignments(next);
  };

  const handleClearAssignments = () => {
    const next: Record<string, string> = {};
    workspacePanes.forEach((pane) => {
      next[pane.id] = '';
    });
    updateAssignments(next);
  };

  const handleLaunchAll = async () => {
    const assignments = Object.entries(paneAgentMap)
      .filter(([, agentId]) => Boolean(agentId))
      .map(([paneId, agentId]) => ({ paneId, agentId: agentId as string }));
    if (!assignments.length) return;
    setIsLaunchingAll(true);
    try {
      await runAgentsOnPanes(assignments);
    } finally {
      setIsLaunchingAll(false);
    }
  };

  const handleEnvJsonChange = (value: string) => {
    setDraft({ ...draft, environmentJson: value });
    if (!value.trim()) {
      setEnvJsonError(null);
      return;
    }
    try {
      JSON.parse(value);
      setEnvJsonError(null);
    } catch (err) {
      setEnvJsonError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  const submit = () => {
    if (!draft.name.trim() || !draft.commandTemplate.trim() || envJsonError) {
      if (!composerOpen) setComposerOpen(true);
      return;
    }

    upsertAgentProfile(draft);
    setDraft(emptyAgentDraft());
    setEnvJsonError(null);
    setComposerOpen(false);
  };

  return (
    <div className="agents-panel">
      <section className="panel-section agents-section agents-section-last">
        <div className="agents-section-head">
          <h3>Multi-pane launch</h3>
          <span className="agents-count">{workspacePanes.length} panes</span>
        </div>
        {lastPermissionNotice ? <div className="notice-card agents-notice">{lastPermissionNotice}</div> : null}

        {workspacePanes.length === 0 ? (
          <p className="muted agents-empty-runs">No terminal panes in this workspace.</p>
        ) : (
          <div className="agents-multipane">
            <div className="agents-multipane-global">
              <div className="agents-multipane-global-label" title="Apply a single agent to all terminal panes at once">
                <span className="agents-pane-icon" aria-hidden>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                </span>
                <span>Global agent:</span>
              </div>
              <CustomSelect
                className="agents-multipane-select agents-multipane-global-select"
                value={commonAgentId}
                onChange={(next) => handleSetAllPanes(next)}
                capitalize={false}
                aria-label="Set agent for all panes"
                disabled={runnableAgents.length === 0}
                options={[
                  { value: '', label: '— set all panes —' },
                  { value: '__CLEAR_ALL__', label: '— skip all —' },
                  ...runnableAgents.map((agent) => ({
                    value: agent.id,
                    label: agent.name
                  }))
                ]}
              />
            </div>
            <div className="agents-multipane-list">
              {workspacePanes.map((pane) => {
                const isActive = pane.id === activePaneId;
                return (
                  <div
                    key={pane.id}
                    className={`agents-multipane-row${isActive ? ' is-active' : ''}`}
                  >
                    <div className="agents-multipane-pane" title={pane.id}>
                      <span className="agents-multipane-dot" aria-hidden />
                      <span className="agents-pane-icon" aria-hidden>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="4 17 10 11 4 5"/>
                          <line x1="12" y1="19" x2="20" y2="19"/>
                        </svg>
                      </span>
                      <span className="agents-multipane-title">{pane.title || 'Terminal'}</span>
                      {isActive ? <span className="agents-multipane-badge">active</span> : null}
                    </div>
                    <CustomSelect
                      className="agents-multipane-select"
                      value={paneAgentMap[pane.id] || ''}
                      onChange={(next) => updateAssignments({ ...paneAgentMap, [pane.id]: next })}
                      capitalize={false}
                      aria-label={`Agent for ${pane.title || 'pane'}`}
                      options={[
                        { value: '', label: '— skip —' },
                        ...runnableAgents.map((agent) => ({
                          value: agent.id,
                          label: agent.name
                        }))
                      ]}
                    />
                  </div>
                );
              })}
            </div>
            <div className="agents-multipane-actions">
              <button type="button" className="agents-multipane-secondary" onClick={handleAutoFill}>
                Auto-fill
              </button>
              <button type="button" className="agents-multipane-secondary" onClick={handleClearAssignments}>
                Clear
              </button>
              <button
                type="button"
                className="agents-run-btn agents-multipane-launch"
                onClick={() => void handleLaunchAll()}
                disabled={assignedCount === 0 || isLaunchingAll || runnableAgents.length === 0}
                title={
                  assignedCount === 0
                    ? 'Assign at least one agent'
                    : `Launch ${assignedCount} agent${assignedCount === 1 ? '' : 's'}`
                }
              >
                {isLaunchingAll ? 'Launching…' : `Launch all (${assignedCount})`}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel-section agents-section">
        <div className="agents-section-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h3>Available agents</h3>
            <span className="agents-count">{agentProfiles.length}</span>
          </div>
          <button
            type="button"
            className={`agents-new-btn${composerOpen ? ' is-open' : ''}`}
            aria-expanded={composerOpen}
            onClick={() => {
              if (composerOpen) {
                setComposerOpen(false);
              } else {
                setComposerOpen(true);
                requestAnimationFrame(() => nameInputRef.current?.focus());
              }
            }}
          >
            <span className="agents-new-btn-icon" aria-hidden>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </span>
            {composerOpen ? 'Close' : 'New profile'}
          </button>
        </div>

        <div className={`agents-composer${composerOpen ? ' open' : ''}`}>
          <input
            ref={nameInputRef}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Profile name"
          />
          <div className="agents-meta-grid">
            <CustomSelect
              aria-label="Provider type"
              value={draft.providerType ?? 'cli'}
              onChange={(v) => setDraft({ ...draft, providerType: v as AgentProviderType })}
              capitalize={false}
              options={agentProviderTypes.map((providerType) => ({
                value: providerType,
                label: providerType
              }))}
            />
            <CustomSelect
              aria-label="Permission mode"
              value={draft.permissionMode ?? 'preview-required'}
              onChange={(v) => setDraft({ ...draft, permissionMode: v as AgentPermissionMode })}
              capitalize={false}
              options={agentPermissionModes.map((mode) => ({
                value: mode,
                label: mode
              }))}
            />
          </div>
          <textarea
            value={draft.commandTemplate}
            onChange={(event) => setDraft({ ...draft, commandTemplate: event.target.value })}
            rows={2}
            placeholder="Command template, e.g. claude {{taskTitle}}"
          />
          <div className="agents-meta-grid">
            <input
              value={draft.defaultWorkingDirectory}
              onChange={(event) => setDraft({ ...draft, defaultWorkingDirectory: event.target.value })}
              placeholder="Working directory"
            />
            <textarea
              value={draft.environmentJson}
              onChange={(event) => handleEnvJsonChange(event.target.value)}
              rows={1}
              placeholder="Env JSON {}"
            />
          </div>
          {envJsonError && (
            <p className="agents-error">JSON: {envJsonError}</p>
          )}
          <textarea
            value={draft.systemPrompt}
            onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })}
            rows={2}
            placeholder="System prompt (optional)"
          />
          <textarea
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            rows={1}
            placeholder="Description (optional)"
          />
          <button type="button" className="agents-save-btn" onClick={submit} disabled={Boolean(envJsonError)}>
            Save profile
          </button>
        </div>

        <div ref={agentsListRef} className="agents-list">
          {agentProfiles.map((agent) => (
            <AgentProfileCard
              agent={agent}
              activePaneId={activePaneId}
              deleteAgentProfile={deleteAgentProfile}
              runAgentInPane={runAgentInPane}
              runAgentInNewPane={runAgentInNewPane}
              upsertAgentProfile={upsertAgentProfile}
              isDragging={draggingAgentId === agent.id}
              onDragHandlePointerDown={(e) => beginAgentPointerReorder(agent.id, e.pointerId, e.clientY)}
              onDragStart={(e) => handleAgentDragStart(e, agent.id)}
              onDragOver={(e) => handleAgentDragOver(e, agent.id)}
              onDrop={(e) => handleAgentDrop(e, agent.id)}
              onDragEnd={handleAgentDragEnd}
              key={agent.id}
            />
          ))}
        </div>
      </section>


    </div>
  );
}

function AgentIcon({ name, id }: { name: string; id: string }) {
  const lower = (name + ' ' + id).toLowerCase();

  if (lower.includes('claude')) {
    return (
      <span className="agent-avatar-icon is-claude" title="Claude Agent">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </span>
    );
  }
  if (lower.includes('codex') || lower.includes('gpt')) {
    return (
      <span className="agent-avatar-icon is-codex" title="Codex Agent">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      </span>
    );
  }
  if (lower.includes('grok')) {
    return (
      <span className="agent-avatar-icon is-grok" title="Grok Agent">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </span>
    );
  }
  if (lower.includes('antigravity') || lower.includes('agy')) {
    return (
      <span className="agent-avatar-icon is-antigravity" title="Antigravity AGY Agent">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </span>
    );
  }
  if (lower.includes('reviewer') || lower.includes('review')) {
    return (
      <span className="agent-avatar-icon is-reviewer" title="Reviewer Agent">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="agent-avatar-icon is-default" title="CLI Agent">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
      </svg>
    </span>
  );
}

function AgentProfileCard({
  agent,
  activePaneId,
  upsertAgentProfile,
  deleteAgentProfile,
  runAgentInPane,
  runAgentInNewPane,
  isDragging,
  onDragHandlePointerDown,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd
}: {
  agent: AgentProfile;
  activePaneId: string | null;
  upsertAgentProfile: (profile: Partial<AgentProfile> & Pick<AgentProfile, 'name' | 'commandTemplate'>) => void;
  deleteAgentProfile: (agentId: string) => void;
  runAgentInPane: (agentId: string, paneId?: string | null) => void;
  runAgentInNewPane: (agentId: string) => void;
  isDragging?: boolean;
  onDragHandlePointerDown?: (e: React.PointerEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}) {
  const [draft, setDraft] = useState(agent);
  const [expanded, setExpanded] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [runMenuOpen, setRunMenuOpen] = useState(false);
  const [envJsonError, setEnvJsonError] = useState<string | null>(null);
  const deleteActionsRef = useRef<HTMLDivElement | null>(null);
  const runMenuRef = useRef<HTMLDivElement | null>(null);
  const canRun = Boolean(draft.commandTemplate.trim());

  useEffect(() => {
    setDraft(agent);
    setEnvJsonError(null);
  }, [agent]);

  useEffect(() => {
    if (!expanded) setDeleteConfirming(false);
    setRunMenuOpen(false);
  }, [expanded]);

  useEffect(() => {
    if (!deleteConfirming && !runMenuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (deleteConfirming && deleteActionsRef.current && !deleteActionsRef.current.contains(e.target as Node)) {
        setDeleteConfirming(false);
      }
      if (runMenuOpen && runMenuRef.current && !runMenuRef.current.contains(e.target as Node)) {
        setRunMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDeleteConfirming(false);
        setRunMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [deleteConfirming, runMenuOpen]);

  const handleEnvJsonChange = (value: string) => {
    setDraft({ ...draft, environmentJson: value });
    if (!value.trim()) {
      setEnvJsonError(null);
      return;
    }
    try {
      JSON.parse(value);
      setEnvJsonError(null);
    } catch (err) {
      setEnvJsonError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  return (
    <article
      data-agent-card-id={agent.id}
      draggable={!expanded}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`profile-card agent-profile-card${isDragging ? ' is-dragging' : ''}${expanded ? ' is-expanded' : ''}${runMenuOpen ? ' is-menu-open' : ''}`}
    >
      <div className="agent-profile-top" style={{ display: 'flex', alignItems: 'center' }}>
        <button
          type="button"
          className="agent-drag-handle"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            onDragHandlePointerDown?.(e);
          }}
          title="Drag to reorder agent profiles"
          aria-label="Drag to reorder agent profiles"
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '24px',
            background: 'transparent',
            border: 'none',
            color: '#71717a',
            cursor: 'grab',
            touchAction: 'none',
            marginRight: '2px'
          }}
        >
          <span className="skill-drag-handle-dots" aria-hidden>
            <span /><span />
            <span /><span />
            <span /><span />
          </span>
        </button>
        <button
          type="button"
          className="agent-profile-summary"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          style={{ flex: 1 }}
        >
          <div className="agent-profile-summary-text">
            <div className="agent-profile-title-row">
              <AgentIcon name={draft.name} id={draft.id} />
              <strong>{draft.name || 'Untitled agent'}</strong>
              <div className="agent-profile-tags">
                <span className="agent-tag">{draft.providerType}</span>
                <span
                  className={`agent-tag mode-${
                    draft.permissionMode === 'unsafe-auto-run' ? 'auto' : 'preview'
                  }`}
                >
                  {draft.permissionMode === 'unsafe-auto-run' ? 'auto' : 'preview'}
                </span>
              </div>
            </div>
            <span className="agent-profile-cmd" title={draft.commandTemplate}>
              {draft.commandTemplate || 'No command'}
            </span>
          </div>
          <svg
            className="agent-profile-chevron"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {!expanded ? (
          <div ref={runMenuRef} className="agents-run-split agents-run-btn-inline" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="agents-run-btn agents-run-btn-main"
              onClick={() => {
                setRunMenuOpen(false);
                void runAgentInPane(agent.id, activePaneId);
              }}
              disabled={!canRun}
              title={
                !canRun
                  ? 'No command template'
                  : activePaneId
                    ? 'Inject CLI into the active terminal pane'
                    : 'No pane selected — use ▾ → Run in new pane'
              }
            >
              Run
            </button>
            <button
              type="button"
              className="agents-run-btn agents-run-btn-chevron"
              onClick={() => setRunMenuOpen((v) => !v)}
              disabled={!canRun}
              aria-label="More run options"
              title="More run options"
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {runMenuOpen && (
              <div className="agents-run-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setRunMenuOpen(false);
                    void runAgentInPane(agent.id, activePaneId);
                  }}
                >
                  Run in active pane
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setRunMenuOpen(false);
                    void runAgentInNewPane(agent.id);
                  }}
                >
                  Run in new pane
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {expanded ? (
        <div className="agent-profile-body" onClick={(e) => e.stopPropagation()}>
          <input
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Name"
          />
          <div className="agents-meta-grid">
            <CustomSelect
              aria-label="Provider type"
              value={draft.providerType}
              onChange={(v) => setDraft({ ...draft, providerType: v as AgentProviderType })}
              capitalize={false}
              options={agentProviderTypes.map((providerType) => ({
                value: providerType,
                label: providerType
              }))}
            />
            <CustomSelect
              aria-label="Permission mode"
              value={draft.permissionMode}
              onChange={(v) => setDraft({ ...draft, permissionMode: v as AgentPermissionMode })}
              capitalize={false}
              options={agentPermissionModes.map((mode) => ({
                value: mode,
                label: mode
              }))}
            />
          </div>
          <textarea
            value={draft.commandTemplate}
            onChange={(event) => setDraft({ ...draft, commandTemplate: event.target.value })}
            placeholder="Command template"
            rows={2}
          />
          <div className="agents-meta-grid">
            <input
              value={draft.defaultWorkingDirectory}
              onChange={(event) => setDraft({ ...draft, defaultWorkingDirectory: event.target.value })}
              placeholder="Working directory"
            />
            <textarea
              value={draft.environmentJson}
              onChange={(event) => handleEnvJsonChange(event.target.value)}
              rows={1}
              placeholder="Env JSON"
            />
          </div>
          {envJsonError && <p className="agents-error">JSON: {envJsonError}</p>}
          <textarea
            value={draft.systemPrompt}
            onChange={(event) => setDraft({ ...draft, systemPrompt: event.target.value })}
            rows={2}
            placeholder="System prompt"
          />
          <textarea
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            rows={1}
            placeholder="Description"
          />
          <div
            ref={deleteActionsRef}
            className={`agent-profile-actions item-actions${deleteConfirming ? ' confirming' : ''}`}
          >
            <div className="agent-actions-idle">
              <button
                type="button"
                className="agents-save-btn"
                onClick={() => upsertAgentProfile(draft)}
                disabled={Boolean(envJsonError)}
                tabIndex={deleteConfirming ? -1 : 0}
              >
                Save
              </button>
              <div ref={runMenuRef} className="agents-run-split">
                <button
                  type="button"
                  className="agents-run-btn agents-run-btn-main"
                  onClick={() => {
                    setRunMenuOpen(false);
                    void runAgentInPane(agent.id, activePaneId);
                  }}
                  disabled={!canRun}
                  tabIndex={deleteConfirming ? -1 : 0}
                  title="Run in active terminal pane"
                >
                  Run
                </button>
                <button
                  type="button"
                  className="agents-run-btn agents-run-btn-chevron"
                  onClick={() => setRunMenuOpen((v) => !v)}
                  disabled={!canRun}
                  tabIndex={deleteConfirming ? -1 : 0}
                  aria-label="More run options"
                >
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {runMenuOpen && !deleteConfirming && (
                  <div className="agents-run-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setRunMenuOpen(false);
                        void runAgentInPane(agent.id, activePaneId);
                      }}
                    >
                      Run in active pane
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setRunMenuOpen(false);
                        void runAgentInNewPane(agent.id);
                      }}
                    >
                      Run in new pane
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              className="agents-delete-cancel"
              title="Cancel delete"
              tabIndex={deleteConfirming ? 0 : -1}
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirming(false);
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Cancel</span>
            </button>

            <button
              type="button"
              className="agents-delete-btn"
              title={deleteConfirming ? 'Click again to confirm delete' : 'Delete profile'}
              onClick={(e) => {
                e.stopPropagation();
                if (deleteConfirming) {
                  deleteAgentProfile(agent.id);
                  setDeleteConfirming(false);
                } else {
                  setDeleteConfirming(true);
                }
              }}
            >
              <span className="agents-delete-idle">Delete</span>
              <span className="agents-delete-confirm">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Confirm</span>
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function AgentRunCard({ run }: { run: AgentRun }) {
  const [log, setLog] = useState<string | null>(null);

  const toggleLog = () => {
    if (log !== null) {
      setLog(null);
      return;
    }
    void window.agentDeck.readLog(run.terminalSessionId).then((raw) => {
      setLog(parseJsonlLogRaw(raw));
    });
  };

  const htmlLog = useMemo(() => (log ? ansiToHtml(log) : null), [log]);

  const statusClass =
    run.status === 'failed' || run.status === 'cancelled'
      ? 'crashed'
      : run.status === 'running'
        ? 'running'
        : 'idle';

  return (
    <article className="report-card agent-run-card">
      <div className="agent-run-head">
        <code className="agent-run-command" title={run.command}>
          {run.command || '(no command)'}
        </code>
        <span className={`pane-status ${statusClass}`}>{run.status}</span>
      </div>
      <div className="agent-run-meta">
        <span className="muted">{new Date(run.startedAt).toLocaleString()}</span>
        {run.finishedAt ? (
          <span className="muted">→ {new Date(run.finishedAt).toLocaleString()}</span>
        ) : null}
      </div>
      {run.summary ? <p className="muted agent-run-summary">{run.summary}</p> : null}
      <div className="agent-run-actions">
        <button type="button" className="agent-run-log-btn" onClick={toggleLog}>
          {log !== null ? 'Hide log' : 'Open log'}
        </button>
      </div>
      {log !== null ? (
        <pre className="mini-log" dangerouslySetInnerHTML={{ __html: htmlLog || 'No log output yet.' }} />
      ) : null}
    </article>
  );
}

const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

function stripAnsi(text: string): string {
  return text.replace(ansiRegex, '');
}

function get256Color(index: number): string {
  if (index >= 0 && index <= 7) {
    const basicColors = ['#000000', '#cd0000', '#00cd00', '#cdcd00', '#0000ee', '#cd00cd', '#00cdcd', '#e5e5e5'];
    return basicColors[index];
  }
  if (index >= 8 && index <= 15) {
    const brightColors = ['#7f7f7f', '#ff0000', '#00ff00', '#ffff00', '#5c5cff', '#ff00ff', '#00ffff', '#ffffff'];
    return brightColors[index - 8];
  }
  if (index >= 16 && index <= 231) {
    const r = Math.floor((index - 16) / 36) * 51;
    const g = Math.floor(((index - 16) % 36) / 6) * 51;
    const b = ((index - 16) % 6) * 51;
    return `rgb(${r},${g},${b})`;
  }
  if (index >= 232 && index <= 255) {
    const val = 8 + (index - 232) * 10;
    return `rgb(${val},${val},${val})`;
  }
  return '#ffffff';
}

function cleanNonColorAnsi(text: string): string {
  if (!text) return '';
  // Strip OSC sequences (like \u001b]0;Title\u0007)
  let cleaned = text.replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, '');
  // Strip non-color ANSI/CSI sequences
  cleaned = cleaned.replace(ansiRegex, (match) => {
    if (match.endsWith('m') && (match.startsWith('\u001b[') || match.startsWith('\u009b['))) {
      return match;
    }
    return '';
  });
  return cleaned;
}

function ansiToHtml(text: string): string {
  if (!text) return '';

  const cleanedText = cleanNonColorAnsi(text);

  const escaped = cleanedText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const ansiPattern = /\u001b\[([0-9;]*)m/g;
  let result = '';
  let lastIndex = 0;
  let match;

  let currentFg: string | null = null;
  let currentBg: string | null = null;
  let isBold = false;
  let isUnderline = false;
  let openSpanCount = 0;

  const closeSpans = () => {
    let closed = '';
    while (openSpanCount > 0) {
      closed += '</span>';
      openSpanCount--;
    }
    return closed;
  };

  const openSpan = () => {
    if (!currentFg && !currentBg && !isBold && !isUnderline) {
      return '';
    }

    const styles: string[] = [];

    if (isBold) styles.push('font-weight: bold');
    if (isUnderline) styles.push('text-decoration: underline');

    if (currentFg) {
      styles.push(`color: ${currentFg}`);
    }
    if (currentBg) {
      styles.push(`background-color: ${currentBg}`);
    }

    openSpanCount++;
    return `<span style="${styles.join('; ')}">`;
  };

  const fgColors: Record<number, string> = {
    30: 'var(--ansi-black, #1c1c1c)',
    31: 'var(--ansi-red, #ff6b6b)',
    32: 'var(--ansi-green, #51cf66)',
    33: 'var(--ansi-yellow, #fcc419)',
    34: 'var(--ansi-blue, #339af0)',
    35: 'var(--ansi-magenta, #cc5de8)',
    36: 'var(--ansi-cyan, #20c997)',
    37: 'var(--ansi-white, #e9ecef)',
    90: 'var(--ansi-bright-black, #868e96)',
    91: 'var(--ansi-bright-red, #ff8787)',
    92: 'var(--ansi-bright-green, #69db7c)',
    93: 'var(--ansi-bright-yellow, #ffd43b)',
    94: 'var(--ansi-bright-blue, #4dabf7)',
    95: 'var(--ansi-bright-magenta, #da77f2)',
    96: 'var(--ansi-bright-cyan, #38d9a9)',
    97: 'var(--ansi-bright-white, #f8f9fa)'
  };

  const bgColors: Record<number, string> = {
    40: 'var(--ansi-bg-black, #101010)',
    41: 'var(--ansi-bg-red, #c92a2a)',
    42: 'var(--ansi-bg-green, #2b8a3e)',
    43: 'var(--ansi-bg-yellow, #e67700)',
    44: 'var(--ansi-bg-blue, #1864ab)',
    45: 'var(--ansi-bg-magenta, #862e9c)',
    46: 'var(--ansi-bg-cyan, #087f5b)',
    47: 'var(--ansi-bg-white, #ced4da)',
    100: 'var(--ansi-bg-bright-black, #495057)',
    101: 'var(--ansi-bg-bright-red, #fa5252)',
    102: 'var(--ansi-bg-bright-green, #40c057)',
    103: 'var(--ansi-bg-bright-yellow, #fab005)',
    104: 'var(--ansi-bg-bright-blue, #228be6)',
    105: 'var(--ansi-bg-bright-magenta, #be4bdb)',
    106: 'var(--ansi-bg-bright-cyan, #12b886)',
    107: 'var(--ansi-bg-bright-white, #e9ecef)'
  };

  while ((match = ansiPattern.exec(escaped)) !== null) {
    const textChunk = escaped.slice(lastIndex, match.index);
    result += textChunk;
    lastIndex = ansiPattern.lastIndex;

    const codes = match[1].split(';').map(Number);
    let i = 0;
    let changed = false;

    while (i < codes.length) {
      const code = codes[i];
      if (code === 0) {
        currentFg = null;
        currentBg = null;
        isBold = false;
        isUnderline = false;
        changed = true;
        i++;
      } else if (code === 1) {
        isBold = true;
        changed = true;
        i++;
      } else if (code === 4) {
        isUnderline = true;
        changed = true;
        i++;
      } else if (code === 22) {
        isBold = false;
        changed = true;
        i++;
      } else if (code === 24) {
        isUnderline = false;
        changed = true;
        i++;
      } else if (code === 38) {
        if (codes[i + 1] === 5 && i + 2 < codes.length) {
          const colorIndex = codes[i + 2];
          currentFg = get256Color(colorIndex);
          changed = true;
          i += 3;
        } else if (codes[i + 1] === 2 && i + 4 < codes.length) {
          const r = codes[i + 2];
          const g = codes[i + 3];
          const b = codes[i + 4];
          currentFg = `rgb(${r},${g},${b})`;
          changed = true;
          i += 5;
        } else {
          i++;
        }
      } else if (code === 48) {
        if (codes[i + 1] === 5 && i + 2 < codes.length) {
          const colorIndex = codes[i + 2];
          currentBg = get256Color(colorIndex);
          changed = true;
          i += 3;
        } else if (codes[i + 1] === 2 && i + 4 < codes.length) {
          const r = codes[i + 2];
          const g = codes[i + 3];
          const b = codes[i + 4];
          currentBg = `rgb(${r},${g},${b})`;
          changed = true;
          i += 5;
        } else {
          i++;
        }
      } else if (fgColors[code] !== undefined) {
        currentFg = fgColors[code];
        changed = true;
        i++;
      } else if (code === 39) {
        currentFg = null;
        changed = true;
        i++;
      } else if (bgColors[code] !== undefined) {
        currentBg = bgColors[code];
        changed = true;
        i++;
      } else if (code === 49) {
        currentBg = null;
        changed = true;
        i++;
      } else {
        i++;
      }
    }

    if (changed) {
      result += closeSpans();
      result += openSpan();
    }
  }

  result += escaped.slice(lastIndex);
  result += closeSpans();

  return result;
}

export function parseJsonlLogRaw(raw: string): string {
  if (!raw) return '';
  return raw
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && 'text' in parsed) {
          const isSystem = parsed.direction === 'system';
          if (isSystem) {
            return `\r\n[System: ${parsed.text}]\r\n`;
          }
          return String(parsed.text);
        }
      } catch {
        return line + '\n';
      }
      return '';
    })
    .join('');
}

function stripAnsiForSearch(text: string): string {
  return text.replace(/\u001b\[[0-9;]*m/g, '');
}

function LogsPanel() {
  const workspaces = useDeckStore((state) => state.workspaces);
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const activePaneId = useDeckStore((state) => state.activePaneId);
  const [selectedPaneId, setSelectedPaneId] = useState(activePaneId ?? '');
  const [rawLog, setRawLog] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [hideSystem, setHideSystem] = useState(true);
  const [followTail, setFollowTail] = useState(true);
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const preRef = useRef<HTMLPreElement | null>(null);
  const workspace = workspaces.find((item) => item.id === activeWorkspaceId) ?? null;
  const panes = workspace ? Object.values(workspace.panes) : [];

  useEffect(() => {
    if (!selectedPaneId && activePaneId) {
      setSelectedPaneId(activePaneId);
    }
  }, [activePaneId, selectedPaneId]);

  useEffect(() => {
    if (!selectedPaneId) {
      setRawLog('');
      return;
    }

    void window.agentDeck.readLog(selectedPaneId).then((raw) => {
      setRawLog(parseJsonlLogRaw(raw));
    });

    let buffer = '';
    const interval = setInterval(() => {
      if (buffer) {
        setRawLog((current) => current + buffer);
        buffer = '';
      }
    }, 150);

    const unsubscribe = subscribeTerminalOutput((event) => {
      if (event.paneId === selectedPaneId) {
        buffer += event.data;
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [selectedPaneId]);

  // Reset follow when switching pane
  useEffect(() => {
    setFollowTail(true);
    setShowJumpLatest(false);
  }, [selectedPaneId]);

  const filteredLog = useMemo(() => {
    let text = rawLog;
    if (!text) return '';

    const lines = text.split(/\r?\n/);
    const q = searchQuery.trim().toLowerCase();

    const kept = lines.filter((line) => {
      if (hideSystem && /^\s*\[System:/i.test(line)) return false;
      if (!q) return true;
      return stripAnsiForSearch(line).toLowerCase().includes(q);
    });

    // Drop leading empties after filter for denser view
    while (kept.length && !kept[0].trim()) kept.shift();
    return kept.join('\n');
  }, [rawLog, hideSystem, searchQuery]);

  const htmlLog = useMemo(() => ansiToHtml(filteredLog), [filteredLog]);

  const lineStats = useMemo(() => {
    const all = rawLog ? rawLog.split(/\r?\n/).filter((l) => l.length > 0).length : 0;
    const shown = filteredLog ? filteredLog.split(/\r?\n/).filter((l) => l.length > 0).length : 0;
    return { all, shown };
  }, [rawLog, filteredLog]);

  const scrollToLatest = useCallback(() => {
    const el = preRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setFollowTail(true);
    setShowJumpLatest(false);
  }, []);

  // Sticky bottom while following
  useLayoutEffect(() => {
    if (!followTail) return;
    const el = preRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [htmlLog, followTail]);

  const onLogScroll = () => {
    const el = preRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = dist < 48;
    setFollowTail(atBottom);
    setShowJumpLatest(!atBottom && el.scrollHeight > el.clientHeight + 20);
  };

  const clearLog = () => {
    if (!selectedPaneId) return;
    void window.agentDeck.terminalClearLog(selectedPaneId);
    setRawLog('');
  };

  return (
    <div className="logs-panel">
      <div className="logs-toolbar">
        <div className="logs-toolbar-row">
          <CustomSelect
            className="logs-pane-select"
            aria-label="Select terminal pane"
            value={selectedPaneId}
            onChange={setSelectedPaneId}
            capitalize={false}
            options={[
              { value: '', label: 'Select pane' },
              ...panes.map((pane) => ({ value: pane.id, label: pane.title }))
            ]}
          />
          <button
            type="button"
            className="logs-clear-btn"
            onClick={clearLog}
            disabled={!selectedPaneId}
            title="Clear session log"
          >
            Clear
          </button>
        </div>
        <div className="logs-toolbar-row">
          <input
            type="search"
            className="logs-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search log…"
            spellCheck={false}
            disabled={!selectedPaneId}
          />
          <button
            type="button"
            className={`logs-filter-btn${hideSystem ? ' is-active' : ''}`}
            onClick={() => setHideSystem((v) => !v)}
            title={hideSystem ? 'Showing without system lines — click to show all' : 'Hide system lines'}
            aria-pressed={hideSystem}
          >
            Sys
          </button>
        </div>
        <div className="logs-status-row">
          <span className="logs-line-count">
            {searchQuery.trim() || hideSystem
              ? `${lineStats.shown} / ${lineStats.all} lines`
              : `${lineStats.all} lines`}
            {followTail ? ' · live' : ''}
          </span>
        </div>
      </div>

      <div className="logs-view">
        <pre
          ref={preRef}
          className="logs-pre"
          onScroll={onLogScroll}
          dangerouslySetInnerHTML={{
            __html: htmlLog || (selectedPaneId ? 'No logs yet.' : 'Select a terminal pane.')
          }}
        />
        {showJumpLatest ? (
          <button type="button" className="logs-jump-btn" onClick={scrollToLatest}>
            ↓ Latest
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface ReviewPanelProps {
  selectedFileForReview: string | null;
  setSelectedFileForReview: (path: string | null) => void;
  reviewedFiles: Record<string, boolean>;
  toggleReviewed: (filePath: string) => void;
  gitStatus: GitWorkspaceStatus | null;
  gitLoading: boolean;
  loadGitStatus: () => Promise<void>;
}

function ReviewPanel({
  selectedFileForReview,
  setSelectedFileForReview,
  reviewedFiles,
  toggleReviewed,
  gitStatus,
  gitLoading,
  loadGitStatus
}: ReviewPanelProps) {
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const workspaces = useDeckStore((state) => state.workspaces);
  const projectNotes = useDeckStore((state) => state.projectNotes);
  const reviewReports = useDeckStore((state) => state.reviewReports);
  const gitCheckpoint = useDeckStore((state) => state.gitCheckpoint);
  const createProjectNote = useDeckStore((state) => state.createProjectNote);
  const updateProjectNote = useDeckStore((state) => state.updateProjectNote);
  const deleteProjectNote = useDeckStore((state) => state.deleteProjectNote);
  const generateReviewReport = useDeckStore((state) => state.generateReviewReport);
  const exportReviewReport = useDeckStore((state) => state.exportReviewReport);
  const exportWorkspaceReport = useDeckStore((state) => state.exportWorkspaceReport);
  const createGitCheckpoint = useDeckStore((state) => state.createGitCheckpoint);
  const discardFileChanges = useDeckStore((state) => state.discardFileChanges);
  const discardAllWorkspaceChanges = useDeckStore((state) => state.discardAllWorkspaceChanges);
  const commitReviewedFiles = useDeckStore((state) => state.commitReviewedFiles);
  
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');

  const notes = projectNotes.filter((note) => note.workspaceId === activeWorkspaceId);
  const reports = reviewReports.filter((report) => report.workspaceId === activeWorkspaceId);

  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId);
  }, [workspaces, activeWorkspaceId]);

  const workspaceRoot = activeWorkspace?.rootPath || '';

  const agentRuns = useDeckStore((state) => state.agentRuns);
  const tasks = useDeckStore((state) => state.tasks);

  // Observability filters
  const [reviewScope, setReviewScope] = useState<'all' | 'agent' | 'task'>('all');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const workspaceRuns = useMemo(() => {
    return agentRuns.filter((run) => run.workspaceId === activeWorkspaceId);
  }, [agentRuns, activeWorkspaceId]);

  const workspaceTasks = useMemo(() => {
    if (!activeWorkspace) return [];
    const paneIds = new Set(Object.keys(activeWorkspace.panes));
    return tasks.filter((t) => t.paneId && paneIds.has(t.paneId));
  }, [tasks, activeWorkspace]);

  useEffect(() => {
    if (workspaceRuns.length > 0) {
      setSelectedRunId(workspaceRuns[0].id);
    } else {
      setSelectedRunId(null);
    }
  }, [workspaceRuns]);

  useEffect(() => {
    if (workspaceTasks.length > 0) {
      setSelectedTaskId(workspaceTasks[0].id);
    } else {
      setSelectedTaskId(null);
    }
  }, [workspaceTasks]);

  // Git changed files list state
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [fileSortKey, setFileSortKey] = useState<'path' | 'type' | 'lines' | 'status'>('path');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setSortDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Diff viewer state
  const [diffText, setDiffText] = useState('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
  const [diffSearchQuery, setDiffSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(200);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(-1);
  const [collapsedState, setCollapsedState] = useState<Record<string, { showTop: number; showBottom: number; isAllExpanded: boolean }>>({});
  /** In-app AI Repair dialog (window.prompt is unreliable in Electron) */
  const [repairOpen, setRepairOpen] = useState(false);
  const [repairInstructions, setRepairInstructions] = useState('');
  const [repairBusy, setRepairBusy] = useState(false);
  const [repairError, setRepairError] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(diffSearchQuery);
    }, 250);
    return () => {
      clearTimeout(handler);
    };
  }, [diffSearchQuery]);

  useEffect(() => {
    setVisibleLimit(200);
    setRepairOpen(false);
    setRepairError(null);
    setRepairBusy(false);
  }, [selectedFileForReview]);

  useEffect(() => {
    if (selectedFileForReview && workspaceRoot) {
      const loadDiff = async () => {
        setDiffLoading(true);
        setDiffSearchQuery('');
        setCurrentChangeIndex(-1);
        setCollapsedState({});
        try {
          const res = await window.agentDeck.getGitFileDiff(workspaceRoot, selectedFileForReview, 5000);
          if (res.ok) {
            setDiffText(res.data);
            setDiffLines(parseDiff(res.data));
          } else {
            alert(`Failed to fetch file diff: ${res.error.message}`);
            setSelectedFileForReview(null);
          }
        } catch (err) {
          alert(`Failed to fetch file diff: ${err instanceof Error ? err.message : String(err)}`);
          setSelectedFileForReview(null);
        } finally {
          setDiffLoading(false);
        }
      };
      void loadDiff();
    } else {
      setDiffText('');
      setDiffLines([]);
      setDiffSearchQuery('');
      setCurrentChangeIndex(-1);
      setCollapsedState({});
    }
  }, [selectedFileForReview, workspaceRoot]);

  const parseDiff = (diff: string): DiffLine[] => {
    const lines = diff.split(/\r?\n/);
    const parsed: DiffLine[] = [];
    let currentOldLine = 0;
    let currentNewLine = 0;
    let inHunk = false;

    for (const line of lines) {
      if (line.startsWith('diff --git') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
        parsed.push({ type: 'meta', content: line });
        inHunk = false;
        continue;
      }

      const match = line.match(/^@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        currentOldLine = parseInt(match[1], 10);
        currentNewLine = parseInt(match[2], 10);
        parsed.push({ type: 'hunk-header', content: line });
        inHunk = true;
        continue;
      }

      if (inHunk) {
        if (line.startsWith('+')) {
          parsed.push({
            type: 'addition',
            content: line,
            newLineNum: currentNewLine
          });
          currentNewLine++;
        } else if (line.startsWith('-')) {
          parsed.push({
            type: 'deletion',
            content: line,
            oldLineNum: currentOldLine
          });
          currentOldLine++;
        } else {
          parsed.push({
            type: 'normal',
            content: line,
            oldLineNum: currentOldLine,
            newLineNum: currentNewLine
          });
          currentOldLine++;
          currentNewLine++;
        }
      } else {
        parsed.push({ type: 'meta', content: line });
      }
    }

    return parsed;
  };

  const groupDiffLines = (lines: DiffLine[]) => {
    const result: Array<{ type: 'line', line: DiffLine } | { type: 'collapsed', id: string, lines: DiffLine[] }> = [];
    let currentCollapsed: DiffLine[] = [];
    const CONTEXT_SIZE = 3;

    const distances = new Array(lines.length).fill(Infinity);
    let lastChangeIndex = -Infinity;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].type === 'addition' || lines[i].type === 'deletion') {
        lastChangeIndex = i;
      }
      if (lastChangeIndex !== -Infinity) {
        distances[i] = i - lastChangeIndex;
      }
    }
    lastChangeIndex = -Infinity;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].type === 'addition' || lines[i].type === 'deletion') {
        lastChangeIndex = i;
      }
      if (lastChangeIndex !== -Infinity) {
        distances[i] = Math.min(distances[i], lastChangeIndex - i);
      }
    }

    const flushCollapsed = (endIdx: number) => {
      if (currentCollapsed.length === 0) return;
      if (currentCollapsed.length <= 6) {
        for (const l of currentCollapsed) {
          result.push({ type: 'line', line: l });
        }
      } else {
        const id = `collapsed-${endIdx - currentCollapsed.length}-${endIdx}`;
        const state = collapsedState[id] || { showTop: 0, showBottom: 0, isAllExpanded: false };
        
        if (state.isAllExpanded) {
          for (const l of currentCollapsed) {
            result.push({ type: 'line', line: l });
          }
        } else {
          for (let k = 0; k < state.showTop; k++) {
            result.push({ type: 'line', line: currentCollapsed[k] });
          }
          const middleCount = currentCollapsed.length - state.showTop - state.showBottom;
          if (middleCount > 0) {
            result.push({ 
              type: 'collapsed', 
              id, 
              lines: currentCollapsed.slice(state.showTop, currentCollapsed.length - state.showBottom) 
            });
          }
          for (let k = currentCollapsed.length - state.showBottom; k < currentCollapsed.length; k++) {
            result.push({ type: 'line', line: currentCollapsed[k] });
          }
        }
      }
      currentCollapsed = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.type === 'normal' && distances[i] > CONTEXT_SIZE) {
        currentCollapsed.push(line);
      } else {
        flushCollapsed(i);
        result.push({ type: 'line', line });
      }
    }
    flushCollapsed(lines.length);

    return result;
  };

  const expandAllCollapsed = (id: string) => {
    setCollapsedState(prev => ({
      ...prev,
      [id]: { showTop: 0, showBottom: 0, isAllExpanded: true }
    }));
  };

  const expandTopCollapsed = (id: string, totalLines: number) => {
    setCollapsedState(prev => {
      const current = prev[id] || { showTop: 0, showBottom: 0, isAllExpanded: false };
      const nextShowTop = current.showTop + 10;
      const isAll = nextShowTop + current.showBottom >= totalLines;
      return {
        ...prev,
        [id]: {
          showTop: nextShowTop,
          showBottom: current.showBottom,
          isAllExpanded: isAll
        }
      };
    });
  };

  const expandBottomCollapsed = (id: string, totalLines: number) => {
    setCollapsedState(prev => {
      const current = prev[id] || { showTop: 0, showBottom: 0, isAllExpanded: false };
      const nextShowBottom = current.showBottom + 10;
      const isAll = current.showTop + nextShowBottom >= totalLines;
      return {
        ...prev,
        [id]: {
          showTop: current.showTop,
          showBottom: nextShowBottom,
          isAllExpanded: isAll
        }
      };
    });
  };

  const processedFiles = useMemo(() => {
    let parsed: Array<{
      code: string;
      path: string;
      oldPath?: string;
      label: string;
      badgeColor: string;
      textColor: string;
      numstat: { additions: number; deletions: number };
      totalChanges: number;
      ext: string;
    }> = [];

    if (reviewScope === 'all') {
      if (gitStatus && gitStatus.changedFiles) {
        parsed = gitStatus.changedFiles.map((fileLine) => {
          const parsedInfo = parseGitStatus(fileLine);
          const numstatInfo = gitStatus.numstat?.[parsedInfo.path] || { additions: 0, deletions: 0 };
          const totalChanges = numstatInfo.additions + numstatInfo.deletions;
          const ext = parsedInfo.path.split('.').pop()?.toLowerCase() || '';
          return {
            ...parsedInfo,
            numstat: numstatInfo,
            totalChanges,
            ext
          };
        });
      }
    } else if (reviewScope === 'agent') {
      const run = agentRuns.find((r) => r.id === selectedRunId);
      if (run && run.changedFiles) {
        parsed = run.changedFiles.map((change) => {
          const path = change.filePath;
          const ext = path.split('.').pop()?.toLowerCase() || '';
          const numstatInfo = { additions: change.additions, deletions: change.deletions };
          const totalChanges = change.additions + change.deletions;
          
          let label = 'Modified';
          let badgeColor = 'rgba(234, 179, 8, 0.15)';
          let textColor = '#facc15';
          let code = 'M';
          
          if (change.status === 'added') {
            label = 'Added';
            badgeColor = 'rgba(34, 197, 94, 0.15)';
            textColor = '#4ade80';
            code = 'A';
          } else if (change.status === 'deleted') {
            label = 'Deleted';
            badgeColor = 'rgba(239, 68, 68, 0.15)';
            textColor = '#f87171';
            code = 'D';
          } else if (change.status === 'renamed') {
            label = 'Renamed';
            badgeColor = 'rgba(167, 139, 250, 0.15)';
            textColor = '#c084fc';
            code = 'R';
          }
          
          return {
            code,
            path,
            oldPath: undefined,
            label,
            badgeColor,
            textColor,
            numstat: numstatInfo,
            totalChanges,
            ext
          };
        });
      }
    } else if (reviewScope === 'task') {
      const mergedMap = new Map<string, NonNullable<AgentRun['changedFiles']>[0]>();
      const workspaceRunsForTask = agentRuns.filter(
        (run) => run.workspaceId === activeWorkspaceId && run.taskId === selectedTaskId
      );
      for (const run of workspaceRunsForTask) {
        for (const change of run.changedFiles || []) {
          const existing = mergedMap.get(change.filePath);
          if (!existing) {
            mergedMap.set(change.filePath, { ...change });
          } else {
            existing.additions += change.additions;
            existing.deletions += change.deletions;
            if (change.timestamp > existing.timestamp) {
              existing.status = change.status;
              existing.timestamp = change.timestamp;
            }
          }
        }
      }
      
      parsed = Array.from(mergedMap.values()).map((change) => {
        const path = change.filePath;
        const ext = path.split('.').pop()?.toLowerCase() || '';
        const numstatInfo = { additions: change.additions, deletions: change.deletions };
        const totalChanges = change.additions + change.deletions;
        
        let label = 'Modified';
        let badgeColor = 'rgba(234, 179, 8, 0.15)';
        let textColor = '#facc15';
        let code = 'M';
        
        if (change.status === 'added') {
          label = 'Added';
          badgeColor = 'rgba(34, 197, 94, 0.15)';
          textColor = '#4ade80';
          code = 'A';
        } else if (change.status === 'deleted') {
          label = 'Deleted';
          badgeColor = 'rgba(239, 68, 68, 0.15)';
          textColor = '#f87171';
          code = 'D';
        } else if (change.status === 'renamed') {
          label = 'Renamed';
          badgeColor = 'rgba(167, 139, 250, 0.15)';
          textColor = '#c084fc';
          code = 'R';
        }
        
        return {
          code,
          path,
          oldPath: undefined,
          label,
          badgeColor,
          textColor,
          numstat: numstatInfo,
          totalChanges,
          ext
        };
      });
    }

    let filtered = parsed;
    if (fileSearchQuery.trim()) {
      const q = fileSearchQuery.trim().toLowerCase();
      filtered = parsed.filter(item => 
        item.path.toLowerCase().includes(q) || 
        (item.oldPath && item.oldPath.toLowerCase().includes(q))
      );
    }

    filtered.sort((a, b) => {
      if (fileSortKey === 'path') {
        return a.path.localeCompare(b.path);
      } else if (fileSortKey === 'type') {
        return a.ext.localeCompare(b.ext) || a.path.localeCompare(b.path);
      } else if (fileSortKey === 'lines') {
        if (b.totalChanges !== a.totalChanges) {
          return b.totalChanges - a.totalChanges;
        }
        return a.path.localeCompare(b.path);
      } else if (fileSortKey === 'status') {
        const statusOrder = { 'Renamed': 1, 'Added': 2, 'Modified': 3, 'Deleted': 4 };
        const orderA = statusOrder[a.label as keyof typeof statusOrder] || 5;
        const orderB = statusOrder[b.label as keyof typeof statusOrder] || 5;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.path.localeCompare(b.path);
      }
      return 0;
    });

    return filtered;
  }, [gitStatus, fileSearchQuery, fileSortKey, reviewScope, selectedRunId, selectedTaskId, agentRuns, tasks, activeWorkspaceId]);

  const changeLineIndices = useMemo(() => {
    const indices: number[] = [];
    const groupedLines = groupDiffLines(diffLines);
    let renderIdx = 0;
    for (const item of groupedLines) {
      if (item.type === 'line') {
        const line = item.line;
        if (line.type === 'addition' || line.type === 'deletion') {
          indices.push(renderIdx);
        }
        renderIdx++;
      } else {
        renderIdx++;
      }
    }
    return indices;
  }, [diffLines, collapsedState]);

  const searchMatchIndices = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return [];
    const q = debouncedSearchQuery.trim().toLowerCase();
    const indices: number[] = [];
    const groupedLines = groupDiffLines(diffLines);
    let renderIdx = 0;
    for (const item of groupedLines) {
      if (item.type === 'line') {
        if (item.line.content.toLowerCase().includes(q)) {
          indices.push(renderIdx);
        }
        renderIdx++;
      } else {
        renderIdx++;
      }
    }
    return indices;
  }, [diffLines, collapsedState, debouncedSearchQuery]);

  const jumpTargets = useMemo(() => {
    return debouncedSearchQuery.trim() ? searchMatchIndices : changeLineIndices;
  }, [debouncedSearchQuery, searchMatchIndices, changeLineIndices]);

  const jumpToChange = (direction: 'next' | 'prev') => {
    if (jumpTargets.length === 0) return;
    let nextIdx = 0;
    if (direction === 'next') {
      nextIdx = (currentChangeIndex + 1) % jumpTargets.length;
    } else {
      nextIdx = (currentChangeIndex - 1 + jumpTargets.length) % jumpTargets.length;
    }
    setCurrentChangeIndex(nextIdx);
    const targetLineNum = jumpTargets[nextIdx];
    
    if (targetLineNum >= visibleLimit) {
      setVisibleLimit(targetLineNum + 100);
    }

    const startTime = Date.now();
    const scrollOnRender = () => {
      const el = document.getElementById(`diff-line-render-${targetLineNum}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (Date.now() - startTime < 1000) {
        requestAnimationFrame(scrollOnRender);
      }
    };
    requestAnimationFrame(scrollOnRender);
  };

  const highlightText = (text: string, search: string) => {
    // Regex matching credentials/passwords inside quotes or standalone keys (like sk-openai)
    const sensitiveRegex = /((?:api_?key|token|password|passwd|secret|private_?key|auth_?key|client_?secret|passphrase)\s*[:=]\s*['"])([^\r\n'"]{6,})(['"])|(sk-[a-zA-Z0-9-]{20,})/gi;
    
    const censoredParts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    
    sensitiveRegex.lastIndex = 0;
    while ((match = sensitiveRegex.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        censoredParts.push(text.slice(lastIndex, matchIndex));
      }
      
      if (match[4]) {
        // Standalone key match (e.g. sk-...)
        censoredParts.push(
          <span 
            key={`redact-${matchIndex}`}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              fontSize: '9.5px',
              padding: '1px 5px',
              borderRadius: '3.5px',
              fontWeight: 600,
              margin: '0 4px',
              fontStyle: 'italic',
              fontFamily: 'sans-serif',
              userSelect: 'none',
              boxShadow: '0 0 6px rgba(239, 68, 68, 0.2)'
            }}
            title="Cáº£nh bÃ¡o: ThÃ´ng tin nháº¡y cáº£m Ä‘Ã£ tá»± Ä‘á»™ng áº©n báº£o máº­t"
          >
            ðŸ” [REDACTED SECRET]
          </span>
        );
      } else {
        // Key-value pair definition match (e.g. api_key = "secret_value")
        censoredParts.push(match[1]); // e.g. api_key = "
        censoredParts.push(
          <span 
            key={`redact-${matchIndex}`}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              fontSize: '9.5px',
              padding: '1px 5px',
              borderRadius: '3.5px',
              fontWeight: 600,
              margin: '0 4px',
              fontStyle: 'italic',
              fontFamily: 'sans-serif',
              userSelect: 'none',
              boxShadow: '0 0 6px rgba(239, 68, 68, 0.2)'
            }}
            title="Cáº£nh bÃ¡o: ThÃ´ng tin nháº¡y cáº£m Ä‘Ã£ tá»± Ä‘á»™ng áº©n báº£o máº­t"
          >
            ðŸ” [REDACTED SECRET]
          </span>
        );
        censoredParts.push(match[3]); // e.g. "
      }
      lastIndex = sensitiveRegex.lastIndex;
    }
    if (lastIndex < text.length) {
      censoredParts.push(text.slice(lastIndex));
    }
    
    if (!search) {
      return <>{censoredParts}</>;
    }
    
    const finalParts: React.ReactNode[] = [];
    const searchEscaped = search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const searchRegex = new RegExp(`(${searchEscaped})`, 'gi');
    
    censoredParts.forEach((part, index) => {
      if (typeof part === 'string') {
        const subParts = part.split(searchRegex);
        subParts.forEach((sub, subIdx) => {
          if (sub.toLowerCase() === search.toLowerCase()) {
            finalParts.push(
              <mark 
                key={`highlight-${index}-${subIdx}`}
                style={{ background: '#facc15', color: '#000', borderRadius: '2px', padding: '0 2px' }}
              >
                {sub}
              </mark>
            );
          } else {
            finalParts.push(sub);
          }
        });
      } else {
        finalParts.push(part);
      }
    });
    
    return <>{finalParts}</>;
  };

  const renderCollapsedBar = (id: string, collapsedLines: DiffLine[]) => {
    const totalLines = collapsedLines.length;
    return (
      <div 
        key={id}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#141416',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '8px 12px',
          color: '#d4d4d8',
          fontSize: '12px',
          fontFamily: 'ui-monospace, Consolas, monospace'
        }}
      >
        <span 
          onClick={() => expandAllCollapsed(id)}
          style={{ cursor: 'pointer', color: '#7dd3fc', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m7 15 5 5 5-5M7 9l5-5 5 5"/></svg>
          Collapsed {totalLines} unchanged lines (Click to expand all)
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => expandTopCollapsed(id, totalLines)}
            style={{ background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', color: '#d4d4d8', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 500 }}
          >
            Expand 10 lines ↓
          </button>
          <button 
            onClick={() => expandBottomCollapsed(id, totalLines)}
            style={{ background: '#1a1a1c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '3px', color: '#d4d4d8', padding: '3px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: 500 }}
          >
            Expand 10 lines ↑
          </button>
        </div>
      </div>
    );
  };

  const renderFileControls = () => {
    return (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            className="review-search-input"
            value={fileSearchQuery}
            onChange={(e) => setFileSearchQuery(e.target.value)}
            placeholder="Search changed files..."
          />
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a1a1aa"
            strokeWidth="2.5"
            style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          {fileSearchQuery && (
            <button
              type="button"
              onClick={() => setFileSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        <div ref={sortDropdownRef} style={{ position: 'relative', flexShrink: 0, zIndex: sortDropdownOpen ? 40 : 1 }}>
          <button
            type="button"
            onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
            className={`panel-select-trigger ${sortDropdownOpen ? 'open' : ''}`}
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              minWidth: '84px',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px'
            }}
          >
            <span className="panel-select-trigger-label" style={{ fontSize: '12px', fontWeight: 500, textTransform: 'capitalize' }}>
              {fileSortKey}
            </span>
            <ChevronDownIcon size={12} />
          </button>
          {sortDropdownOpen && (
            <div
              className="panel-select-dropdown overview-sort-dropdown"
              style={{
                left: 'auto',
                right: 0,
                top: '100%',
                marginTop: 4,
                minWidth: 120,
                width: 'max-content',
                zIndex: 300,
                padding: 4,
                background: '#1a1a1c',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                boxShadow: '0 12px 28px rgba(0,0,0,0.55)',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none'
              }}
            >
              {(['path', 'type', 'lines', 'status'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setFileSortKey(key);
                    setSortDropdownOpen(false);
                  }}
                  className={`panel-select-option ${fileSortKey === key ? 'active' : ''}`}
                  style={{ padding: '7px 12px', fontSize: '12px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}
                >
                  <span className="panel-select-option-label" style={{ fontSize: '12px', textTransform: 'capitalize' }}>
                    {key}
                  </span>
                  {fileSortKey === key && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const submitNote = () => {
    createProjectNote(noteTitle, noteBody);
    setNoteTitle('');
    setNoteBody('');
  };

  if (selectedFileForReview) {
    const { fileName, dirPath } = getFileNameAndDir(selectedFileForReview);
    const badgeInfo = getExtensionBadge(selectedFileForReview);
    const numstatInfo = gitStatus?.numstat?.[selectedFileForReview] || { additions: 0, deletions: 0 };
    const additions = numstatInfo.additions;
    const deletions = numstatInfo.deletions;
    const hasNumstat = additions > 0 || deletions > 0;
    const isReviewed = !!reviewedFiles[selectedFileForReview];

    const groupedLines = groupDiffLines(diffLines);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      if (target.scrollHeight - target.scrollTop - target.clientHeight < 300) {
        setVisibleLimit((prev) => Math.min(prev + 200, groupedLines.length));
      }
    };

    const collectHunkLines = (startIdx: number) => {
      const headerLine = groupedLines[startIdx];
      if (headerLine.type !== 'line' || headerLine.line.type !== 'hunk-header') {
        return { hunkHeader: '', lines: [] };
      }
      const hunkHeader = headerLine.line.content;
      const lines: string[] = [];
      for (let i = startIdx + 1; i < groupedLines.length; i++) {
        const cur = groupedLines[i];
        if (cur.type === 'line') {
          if (cur.line.type === 'hunk-header' || cur.line.type === 'meta') {
            break;
          }
          lines.push(cur.line.content);
        } else {
          lines.push(...cur.lines.map(l => l.content));
        }
      }
      return { hunkHeader, lines };
    };

    return (
      <div className="review-panel review-diff-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#0a0a0c', zIndex: 10 }}>
        {/* Header — two rows so actions never crush "Back" / filename in a narrow right panel */}
        <div className="review-diff-header">
          <div className="review-diff-header-top">
            <button
              type="button"
              className="review-diff-btn review-diff-btn-back"
              onClick={() => setSelectedFileForReview(null)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Back
            </button>

            <span
              className="review-ext-badge"
              style={{
                background: badgeInfo.bgColor,
                color: badgeInfo.color,
                border: badgeInfo.border
              }}
            >
              {badgeInfo.label}
            </span>

            <div className="review-diff-file-meta">
              <span className="review-diff-file-name" title={fileName}>{fileName}</span>
              {dirPath ? (
                <span className="review-diff-file-dir" title={dirPath}>{dirPath}</span>
              ) : null}
            </div>
          </div>

          <div className="review-diff-header-actions">
            {hasNumstat && (
              <div className="review-diff-numstat">
                <span style={{ color: '#86efac' }}>+{additions}</span>
                <span style={{ color: '#fca5a5' }}>-{deletions}</span>
              </div>
            )}

            <button
              type="button"
              className="review-diff-btn review-diff-btn-explain"
              onClick={() => {
                const diffTextContent = diffLines.map(line => line.content).join('\n');
                const prompt = `Giải thích những thay đổi trong file \`${selectedFileForReview}\` dưới đây giúp tôi nhé. Đây là git diff:\n\n\`\`\`diff\n${diffTextContent}\n\`\`\``;
                // Switch tab immediately — do not wait for LLM / offline reply
                useDeckStore.getState().setRightTab('assist');
                void useDeckStore.getState().sendAssistantMessage(prompt);
              }}
              title="Yêu cầu AI giải thích diff của file này"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              AI Explain
            </button>

            <button
              type="button"
              className="review-diff-btn review-diff-btn-repair"
              onClick={() => {
                setRepairError(null);
                setRepairInstructions(
                  `Sửa tiếp file ${fileName} dựa trên git diff. Ưu tiên đúng design tokens / style hiện có, không phá layout.`
                );
                setRepairOpen(true);
              }}
              title="Mở form AI Repair — tạo task và chạy trên terminal pane"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              AI Repair
            </button>

            <button
              type="button"
              className="review-diff-btn review-diff-btn-discard"
              onClick={async () => {
                const confirmed = window.confirm(`Are you sure you want to discard all changes to ${fileName}? This will restore the file to HEAD and cannot be undone (a Git checkpoint backup will be created).`);
                if (confirmed) {
                  try {
                    await discardFileChanges(selectedFileForReview);
                    setSelectedFileForReview(null);
                    void loadGitStatus();
                  } catch (err) {
                    alert(`Failed to discard changes: ${err instanceof Error ? err.message : String(err)}`);
                  }
                }
              }}
              title="Discard all changes in this file"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Discard File
            </button>

            <button
              type="button"
              className={`review-diff-btn review-diff-btn-reviewed${isReviewed ? ' is-on' : ''}`}
              onClick={() => toggleReviewed(selectedFileForReview)}
            >
              {isReviewed ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  Reviewed
                </>
              ) : (
                'Mark Reviewed'
              )}
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: '#141416',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          gap: '12px',
          flexShrink: 0
        }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '240px' }}>
            <input
              type="text"
              value={diffSearchQuery}
              onChange={(e) => {
                setDiffSearchQuery(e.target.value);
                setCurrentChangeIndex(-1);
              }}
              placeholder="Search in diff..."
              style={{
                width: '100%',
                background: '#1a1a1c',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '4px',
                color: '#f4f4f5',
                fontSize: '12px',
                fontWeight: 500,
                padding: '6px 10px 6px 26px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a1a1aa"
              strokeWidth="2.5"
              style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            {diffSearchQuery && (
              <button
                onClick={() => {
                  setDiffSearchQuery('');
                  setCurrentChangeIndex(-1);
                }}
                style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: 0 }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#d4d4d8', fontWeight: 500 }}>
              {jumpTargets.length === 0 ? (
                diffSearchQuery.trim() ? 'No matches' : 'No changes'
              ) : (
                `${currentChangeIndex !== -1 ? currentChangeIndex + 1 : 0} of ${jumpTargets.length} ${diffSearchQuery.trim() ? 'matches' : 'changes'}`
              )}
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                disabled={jumpTargets.length === 0}
                onClick={() => jumpToChange('prev')}
                style={{
                  background: '#1a1a1c',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: jumpTargets.length === 0 ? '#71717a' : '#d4d4d8',
                  padding: '5px 8px',
                  cursor: jumpTargets.length === 0 ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Previous Change"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m18 15-6-6-6 6"/></svg>
              </button>
              <button
                disabled={jumpTargets.length === 0}
                onClick={() => jumpToChange('next')}
                style={{
                  background: '#1a1a1c',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  color: jumpTargets.length === 0 ? '#71717a' : '#d4d4d8',
                  padding: '5px 8px',
                  cursor: jumpTargets.length === 0 ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Next Change"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Diff content view */}
        <div 
          onScroll={handleScroll}
          style={{ flex: 1, overflowY: 'auto', background: '#0e0e11', padding: '12px 0' }}
        >
          {diffLoading ? (
            <div style={{ padding: '40px', color: '#a1a1aa', textAlign: 'center', fontSize: '12px' }}>
              Loading file diff...
            </div>
          ) : diffLines.length === 0 ? (
            <div style={{ padding: '40px', color: '#a1a1aa', textAlign: 'center', fontSize: '12px' }}>
              No differences found compared to HEAD.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {groupedLines.slice(0, visibleLimit).map((item, idx) => {
                if (item.type === 'collapsed') {
                  return renderCollapsedBar(item.id, item.lines);
                }

                const line = item.line;
                const isSelected = jumpTargets[currentChangeIndex] === idx;
                
                let lineBg = 'transparent';
                let lineColor = '#e4e4e7';
                let isChange = false;
                if (line.type === 'addition') {
                  lineBg = isSelected ? 'rgba(34, 197, 94, 0.22)' : 'rgba(34, 197, 94, 0.1)';
                  lineColor = '#86efac';
                  isChange = true;
                } else if (line.type === 'deletion') {
                  lineBg = isSelected ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.1)';
                  lineColor = '#fca5a5';
                  isChange = true;
                } else if (line.type === 'hunk-header') {
                  lineBg = 'rgba(139, 92, 246, 0.12)';
                  lineColor = '#c4b5fd';
                } else if (line.type === 'meta') {
                  lineColor = '#a1a1aa';
                }

                if (isSelected && !isChange) {
                  lineBg = 'rgba(250, 204, 21, 0.15)';
                }

                return (
                  <div 
                    id={`diff-line-render-${idx}`}
                    key={idx}
                    className={isChange ? 'diff-line-change' : ''}
                    style={{
                      display: 'flex',
                      background: lineBg,
                      color: lineColor,
                      padding: '1px 0',
                      fontSize: '12px',
                      fontFamily: 'ui-monospace, Cascadia Code, Consolas, monospace',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      alignItems: 'stretch',
                      borderLeft: isSelected ? '3px solid #facc15' : '3px solid transparent',
                      lineHeight: 1.45
                    }}
                  >
                    <div style={{
                      width: '36px',
                      textAlign: 'right',
                      paddingRight: '6px',
                      color: '#a1a1aa',
                      userSelect: 'none',
                      borderRight: '1px solid rgba(255,255,255,0.08)',
                      flexShrink: 0,
                      fontSize: '11px'
                    }}>
                      {line.oldLineNum !== undefined ? line.oldLineNum : ''}
                    </div>
                    <div style={{
                      width: '36px',
                      textAlign: 'right',
                      paddingRight: '6px',
                      color: '#a1a1aa',
                      userSelect: 'none',
                      borderRight: '1px solid rgba(255,255,255,0.08)',
                      flexShrink: 0,
                      fontSize: '11px'
                    }}>
                      {line.newLineNum !== undefined ? line.newLineNum : ''}
                    </div>
                    
                    <div style={{ paddingLeft: '8px', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <span>{highlightText(line.content, debouncedSearchQuery)}</span>
                      {line.type === 'hunk-header' && (
                        <div style={{ display: 'inline-flex', gap: '4px', marginRight: '8px' }}>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const { hunkHeader, lines: hLines } = collectHunkLines(idx);
                              if (!hunkHeader) return;
                              
                              const confirmed = window.confirm(
                                `Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n revert riÃªng phÃ¢n Ä‘oáº¡n (hunk) nÃ y khÃ´ng?\nHÃ nh Ä‘á»™ng nÃ y sáº½ táº¡o Git checkpoint tá»± Ä‘á»™ng Ä‘á»ƒ báº¡n cÃ³ thá»ƒ undo náº¿u cáº§n.`
                              );
                              if (confirmed) {
                                try {
                                  await createGitCheckpoint();
                                  const res = await window.agentDeck.revertGitHunk(workspaceRoot, selectedFileForReview, hunkHeader, hLines);
                                  if (res && !res.ok) {
                                    alert(`Lá»—i revert hunk: ${res.error.message}`);
                                  } else {
                                    alert('ÄÃ£ revert hunk thÃ nh cÃ´ng!');
                                    void loadGitStatus();
                                    // Trigger loading diff again
                                    setSelectedFileForReview(null);
                                    setTimeout(() => setSelectedFileForReview(selectedFileForReview), 50);
                                  }
                                } catch (err) {
                                  alert(`Lá»—i revert hunk: ${err instanceof Error ? err.message : String(err)}`);
                                }
                              }
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.14)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '4px',
                              color: '#fca5a5',
                              fontSize: '11px',
                              padding: '3px 8px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                              e.currentTarget.style.color = '#fecaca';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.14)';
                              e.currentTarget.style.color = '#fca5a5';
                            }}
                            title="Revert hunk nÃ y"
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                              <polyline points="3 3 3 8 8 8" />
                            </svg>
                            Revert
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const { hunkHeader, lines: hLines } = collectHunkLines(idx);
                              if (!hunkHeader) return;

                              const taskTitleInput = window.prompt(
                                'Nháº­p tÃªn cho Task má»›i Ä‘Æ°á»£c táº¡o tá»« Hunk nÃ y:',
                                `Review changes in ${fileName}`
                              );
                              if (!taskTitleInput || !taskTitleInput.trim()) return;

                              const hunkBody = [hunkHeader, ...hLines].join('\n');
                              const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                              const newTask: DeckTask = {
                                id: taskId,
                                title: taskTitleInput.trim(),
                                body: `Xem xÃ©t vÃ  kiá»ƒm tra Ä‘oáº¡n hunk thay Ä‘á»•i trong file ${selectedFileForReview}:\n\n\`\`\`diff\n${hunkBody}\n\`\`\``,
                                status: 'todo',
                                paneId: useDeckStore.getState().activePaneId || null,
                                agentId: null,
                                priority: 'medium',
                                createdAt: Date.now(),
                                updatedAt: Date.now()
                              };

                              useDeckStore.setState((state) => ({ tasks: [newTask, ...state.tasks] }));
                              alert('ÄÃ£ táº¡o task má»›i thÃ nh cÃ´ng trÃªn Kanban board!');
                            }}
                            style={{
                              background: 'rgba(56, 189, 248, 0.14)',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              borderRadius: '4px',
                              color: '#7dd3fc',
                              fontSize: '11px',
                              padding: '3px 8px',
                              cursor: 'pointer',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              transition: 'all 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(56, 189, 248, 0.22)';
                              e.currentTarget.style.color = '#bae6fd';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(56, 189, 248, 0.14)';
                              e.currentTarget.style.color = '#7dd3fc';
                            }}
                            title="Táº¡o task má»›i tá»« hunk nÃ y"
                          >
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="12" y1="5" x2="12" y2="19" />
                              <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Create Task
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {groupedLines.length > visibleLimit && (
            <div style={{
              padding: '16px',
              textAlign: 'center',
              color: '#a1a1aa',
              fontSize: '12px',
              background: '#141416',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <span style={{ animation: 'pulse 1.5s infinite ease-in-out' }}>⚡ Progressive loading active ({visibleLimit} of {groupedLines.length} lines rendered)</span>
              <button
                onClick={() => setVisibleLimit(groupedLines.length)}
                style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: '4px',
                  color: '#38bdf8',
                  padding: '2px 8px',
                  cursor: 'pointer',
                  fontSize: '10px',
                  fontWeight: 600
                }}
              >
                Load All
              </button>
            </div>
          )}
        </div>

        {/* AI Repair dialog — in-app (Electron often blocks window.prompt) */}
        {repairOpen ? (
          <div
            className="review-repair-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="AI Repair"
            onClick={() => {
              if (!repairBusy) setRepairOpen(false);
            }}
          >
            <div
              className="review-repair-dialog"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="review-repair-dialog-head">
                <div>
                  <div className="review-repair-dialog-title">AI Repair</div>
                  <div className="review-repair-dialog-sub" title={selectedFileForReview || ''}>
                    {fileName}
                  </div>
                </div>
                <button
                  type="button"
                  className="review-diff-btn review-diff-btn-back"
                  disabled={repairBusy}
                  onClick={() => setRepairOpen(false)}
                >
                  Close
                </button>
              </div>

              <label className="review-repair-label" htmlFor="review-repair-input">
                Repair instructions
              </label>
              <textarea
                id="review-repair-input"
                className="review-repair-textarea"
                value={repairInstructions}
                disabled={repairBusy}
                rows={5}
                placeholder="Describe what to fix (e.g. add null checks, fix types, match design tokens)…"
                onChange={(e) => setRepairInstructions(e.target.value)}
                autoFocus
              />

              {repairError ? (
                <div className="review-repair-error" role="alert">
                  {repairError}
                </div>
              ) : (
                <p className="review-repair-hint">
                  Creates a Tasks card with the current diff, then sends it to the active terminal pane.
                </p>
              )}

              <div className="review-repair-actions">
                <button
                  type="button"
                  className="review-diff-btn review-diff-btn-back"
                  disabled={repairBusy}
                  onClick={() => setRepairOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="review-diff-btn review-diff-btn-repair"
                  disabled={repairBusy || !repairInstructions.trim()}
                  onClick={() => {
                    const instructions = repairInstructions.trim();
                    if (!instructions) {
                      setRepairError('Enter repair instructions first.');
                      return;
                    }

                    const store = useDeckStore.getState();
                    const workspace = store.workspaces.find((w) => w.id === store.activeWorkspaceId);
                    if (!workspace) {
                      setRepairError('No active workspace. Open a workspace first.');
                      return;
                    }

                    const paneIds = Object.keys(workspace.panes || {});
                    const paneId = store.activePaneId && workspace.panes[store.activePaneId]
                      ? store.activePaneId
                      : paneIds[0] || null;

                    if (!paneId) {
                      setRepairError('No terminal pane. Open or create a terminal pane first.');
                      return;
                    }

                    setRepairBusy(true);
                    setRepairError(null);

                    const diffTextContent = diffLines.map((line) => line.content).join('\n');
                    const title = `[Repair] ${fileName}`;
                    const body =
                      `Yêu cầu sửa tiếp:\n${instructions}\n\n` +
                      `File cần sửa: ${selectedFileForReview}\n\n` +
                      `Diff hiện tại:\n\`\`\`diff\n${diffTextContent}\n\`\`\``;

                    const taskId = store.createTask(title, body);
                    if (!taskId) {
                      setRepairBusy(false);
                      setRepairError('Failed to create repair task.');
                      return;
                    }

                    const afterCreate = useDeckStore.getState();
                    // Ensure pane assignment even when activePane was empty
                    if (afterCreate.activePaneId !== paneId) {
                      afterCreate.selectPane(paneId);
                    }
                    afterCreate.updateTask(taskId, { paneId });
                    afterCreate.setRightTab('tasks');
                    setRepairOpen(false);
                    setRepairBusy(false);

                    void afterCreate.runTaskInPane(taskId, paneId).catch((err) => {
                      useDeckStore.setState({
                        lastPermissionNotice:
                          `AI Repair failed: ${err instanceof Error ? err.message : String(err)}`
                      });
                    });
                  }}
                >
                  {repairBusy ? 'Starting…' : 'Create & Run'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // Standard review list view
  return (
    <div className="review-panel">
      {/* Code changes section */}
      <section className="panel-section">
        <h2>Code Changes for Review</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Scope Selector Bar */}
          <div className="review-scope-tabs" role="tablist" aria-label="Review scope">
            <button
              type="button"
              role="tab"
              className={`review-scope-tab${reviewScope === 'all' ? ' is-active' : ''}`}
              aria-selected={reviewScope === 'all'}
              onClick={() => setReviewScope('all')}
            >
              All Changes
            </button>
            <button
              type="button"
              role="tab"
              className={`review-scope-tab${reviewScope === 'agent' ? ' is-active' : ''}`}
              aria-selected={reviewScope === 'agent'}
              onClick={() => setReviewScope('agent')}
            >
              By Agent Run
            </button>
            <button
              type="button"
              role="tab"
              className={`review-scope-tab${reviewScope === 'task' ? ' is-active' : ''}`}
              aria-selected={reviewScope === 'task'}
              onClick={() => setReviewScope('task')}
            >
              By Task
            </button>
          </div>

          {/* Sub-selector for Agent Scope */}
          {reviewScope === 'agent' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '4px' }}>
              {workspaceRuns.length === 0 ? (
                <span className="review-empty-hint">
                  No agent runs recorded in this workspace.
                </span>
              ) : (
                <CustomSelect
                  aria-label="Select agent run"
                  className="review-scope-select"
                  value={selectedRunId || workspaceRuns[0]?.id || ''}
                  onChange={(v) => setSelectedRunId(v || null)}
                  capitalize={false}
                  options={workspaceRuns.map((run) => {
                    const profileName =
                      useDeckStore.getState().agentProfiles.find((ap) => ap.id === run.agentProfileId)?.name ||
                      'Agent';
                    const dateStr = new Date(run.startedAt).toLocaleString();
                    const fileCount = run.changedFiles?.length || 0;
                    const cmd = run.command.length > 30 ? `${run.command.slice(0, 30)}…` : run.command;
                    return {
                      value: run.id,
                      label: `${profileName} · ${cmd} · (${fileCount} files) · ${dateStr}`
                    };
                  })}
                />
              )}
            </div>
          )}

          {/* Sub-selector for Task Scope */}
          {reviewScope === 'task' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '4px' }}>
              {workspaceTasks.length === 0 ? (
                <span className="review-empty-hint">
                  No tasks found in this workspace.
                </span>
              ) : (
                <CustomSelect
                  aria-label="Select task"
                  className="review-scope-select"
                  value={selectedTaskId || workspaceTasks[0]?.id || ''}
                  onChange={(v) => setSelectedTaskId(v || null)}
                  capitalize={false}
                  options={workspaceTasks.map((task) => {
                    const runsForTask = workspaceRuns.filter((r) => r.taskId === task.id);
                    const fileCount = runsForTask.reduce(
                      (sum, run) => sum + (run.changedFiles?.length || 0),
                      0
                    );
                    return {
                      value: task.id,
                      label: `${task.title} (${task.priority}) · ${fileCount} changed files`
                    };
                  })}
                />
              )}
            </div>
          )}

          {processedFiles.length === 0 ? (
            <span className="review-empty-hint">
              {reviewScope === 'all'
                ? 'Working tree clean. No files changed.'
                : reviewScope === 'agent'
                ? 'No files changed in this Agent Session.'
                : 'No files changed in this Task.'}
            </span>
          ) : (
            <>
              {renderFileControls()}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px', maxHeight: '320px', overflowY: 'auto' }}>
                {processedFiles.map((item) => {
                  const { fileName, dirPath } = getFileNameAndDir(item.path);
                  const badgeInfo = getExtensionBadge(item.path);
                  const numstatInfo = item.numstat;
                  const additions = numstatInfo.additions;
                  const deletions = numstatInfo.deletions;
                  const hasNumstat = additions > 0 || deletions > 0;
                  const isReviewed = !!reviewedFiles[item.path];

                  return (
                    <div key={item.path} className="review-file-row">
                      <button
                        type="button"
                        onClick={() => toggleReviewed(item.path)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isReviewed ? '#38bdf8' : '#a1a1aa',
                          transition: 'color 0.15s',
                          flexShrink: 0
                        }}
                        title={isReviewed ? 'Mark as Unreviewed' : 'Mark as Reviewed'}
                      >
                        {isReviewed ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <div style={{ width: '11px', height: '11px', borderRadius: '2px', border: '2px solid rgba(255,255,255,0.28)' }} />
                        )}
                      </button>

                      <div
                        className={`review-file-main${isReviewed ? ' is-reviewed' : ''}`}
                        onClick={() => setSelectedFileForReview(item.path)}
                      >
                        <span
                          className="review-ext-badge"
                          style={{
                            background: badgeInfo.bgColor,
                            color: badgeInfo.color,
                            border: badgeInfo.border
                          }}
                        >
                          {badgeInfo.label}
                        </span>

                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: 1 }}>
                          <span className="review-file-name">{fileName}</span>
                          {dirPath ? <span className="review-file-dir">{dirPath}</span> : null}
                          {item.oldPath ? (
                            <span className="review-file-rename">Renamed from {item.oldPath}</span>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {hasNumstat && (
                          <div className="review-numstat">
                            {additions > 0 && <span style={{ color: '#4ade80' }}>+{additions}</span>}
                            {deletions > 0 && <span style={{ color: '#f87171' }}>-{deletions}</span>}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const confirmed = window.confirm(`Are you sure you want to discard all changes to ${fileName}? This will restore the file to HEAD and cannot be undone (a Git checkpoint backup will be created).`);
                            if (confirmed) {
                              try {
                                await discardFileChanges(item.path);
                                void loadGitStatus();
                              } catch (err) {
                                alert(`Failed to discard changes: ${err instanceof Error ? err.message : String(err)}`);
                              }
                            }
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#a1a1aa',
                            borderRadius: '4px',
                            transition: 'color 0.15s, background-color 0.15s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#ef4444';
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#a1a1aa';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          title="Discard file changes"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>

                        <span
                          className="review-status-badge"
                          style={{ background: item.badgeColor, color: item.textColor }}
                        >
                          {item.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="panel-section">
        <h2>Review flow</h2>
        <div className="task-actions">
          <button onClick={() => void createGitCheckpoint()} disabled={!activeWorkspaceId}>
            Git checkpoint
          </button>
          <button onClick={() => void generateReviewReport()} disabled={!activeWorkspaceId}>
            Generate report
          </button>
          <button onClick={() => void exportWorkspaceReport()} disabled={!activeWorkspaceId}>
            Export workspace
          </button>
          <button 
            onClick={async () => {
              const confirmed = window.confirm('Are you sure you want to discard ALL uncommitted changes in the entire workspace? This will revert all modified files to HEAD and delete all untracked files. This cannot be undone (a Git checkpoint backup will be created).');
              if (confirmed) {
                try {
                  await discardAllWorkspaceChanges();
                  void loadGitStatus();
                } catch (err) {
                  alert(`Failed to discard all changes: ${err instanceof Error ? err.message : String(err)}`);
                }
              }
            }} 
            disabled={!activeWorkspaceId}
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
          >
            Discard all
          </button>
          {Object.values(reviewedFiles).some(Boolean) && (
            <button 
              onClick={async () => {
                const message = window.prompt('Enter commit message for reviewed changes:', 'Accept and commit reviewed files');
                if (message && message.trim()) {
                  try {
                    const success = await commitReviewedFiles(message);
                    if (success) {
                      void loadGitStatus();
                      alert('Reviewed changes successfully committed!');
                    }
                  } catch (err) {
                    alert(`Failed to commit changes: ${err instanceof Error ? err.message : String(err)}`);
                  }
                }
              }} 
              disabled={!activeWorkspaceId}
              style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.15)'}
            >
              Commit Reviewed
            </button>
          )}
        </div>
        <pre className="mini-log">{gitCheckpoint || 'No git checkpoint yet.'}</pre>
      </section>

      <section className="panel-section">
        <h3>Project memory notes</h3>
        <input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Note title" />
        <textarea
          value={noteBody}
          onChange={(event) => setNoteBody(event.target.value)}
          rows={3}
          placeholder="Local note"
        />
        <button onClick={submitNote} disabled={!activeWorkspaceId}>
          Save note
        </button>
        {notes.map((note) => (
          <article className="note-card" key={note.id}>
            <input value={note.title} onChange={(event) => updateProjectNote(note.id, { title: event.target.value })} />
            <textarea
              value={note.body}
              onChange={(event) => updateProjectNote(note.id, { body: event.target.value })}
              rows={3}
            />
            <button className="danger" onClick={() => deleteProjectNote(note.id)}>
              Delete note
            </button>
          </article>
        ))}
      </section>

      <section className="panel-section">
        <h3>Review reports</h3>
        {reports.length === 0 ? <p className="muted">No reports for this workspace.</p> : null}
        {reports.map((report) => (
          <article className="report-card" key={report.id}>
            <strong>{report.title}</strong>
            <span className="muted">{new Date(report.createdAt).toLocaleString()}</span>
            <pre className="mini-log">{report.body}</pre>
            <button onClick={() => void exportReviewReport(report.id)}>Export markdown</button>
          </article>
        ))}
      </section>
    </div>
  );
}

function UpdateChecker() {
  const [checking, setChecking] = useState(false);
  const [version, setVersion] = useState('v0.1.0');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    void window.agentDeck.getVersion().then((res) => {
      if (res.ok) {
        setVersion(`v${res.data}`);
      }
    });
  }, []);

  const handleCheckUpdate = () => {
    setChecking(true);
    setStatusMsg('Checking for updates...');
    setTimeout(() => {
      setChecking(false);
      setStatusMsg(`Your app is up to date! Current version: ${version}`);
    }, 1800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className={`primary-btn ${checking ? 'pulsing-glow' : ''}`}
          onClick={handleCheckUpdate}
          disabled={checking}
          style={{ flex: 1, padding: '6px 12px', fontSize: '12px', margin: 0 }}
        >
          {checking ? 'Checking...' : 'Check for Updates'}
        </button>
      </div>
      {statusMsg && (
        <span style={{ fontSize: '11px', color: checking ? '#38bdf8' : '#22c55e', transition: 'all 0.3s ease' }}>
          {statusMsg}
        </span>
      )}
    </div>
  );
}

function SettingsPanel() {
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const activePaneId = useDeckStore((state) => state.activePaneId);
  const workspaces = useDeckStore((state) => state.workspaces);
  const metadata = useDeckStore((state) => state.metadata);
  const projects = useDeckStore((state) => state.projects);
  const tasks = useDeckStore((state) => state.tasks);
  const agentRuns = useDeckStore((state) => state.agentRuns);
  const appSettings = useDeckStore((state) => state.appSettings);
  const paneTokens = useDeckStore((state) => state.paneTokens);
  const permissionPolicy = useDeckStore((state) => state.permissionPolicy);
  const permissionRules = useDeckStore((state) => state.permissionRules);
  const permissionDecisions = useDeckStore((state) => state.permissionDecisions);
  const workspaceTemplates = useDeckStore((state) => state.workspaceTemplates);
  const updatePermissionPolicy = useDeckStore((state) => state.updatePermissionPolicy);
  const upsertWorkspaceTemplate = useDeckStore((state) => state.upsertWorkspaceTemplate);
  const deleteWorkspaceTemplate = useDeckStore((state) => state.deleteWorkspaceTemplate);
  const generateContext = useDeckStore((state) => state.generateContext);
  const mcpClients = useDeckStore((state) => state.mcpClients);
  const pricingList = useDeckStore((state) => state.pricingList) || [];
  const usageLogs = useDeckStore((state) => state.usageLogs) || [];
  const simulateUsageLog = useDeckStore((state) => state.simulateUsageLog);
  const resetUsageLogs = useDeckStore((state) => state.resetUsageLogs);

  // Simulator Form State
  const [simModelId, setSimModelId] = useState('claude-sonnet-4.6');
  const [simInput, setSimInput] = useState(1000);
  const [simOutput, setSimOutput] = useState(500);
  const [simCached, setSimCached] = useState(0);

  const [policyDraft, setPolicyDraft] = useState({
    allowedCommands: listToText(permissionPolicy.allowedCommands),
    blockedPatterns: listToText(permissionPolicy.blockedPatterns),
    reviewPatterns: listToText(permissionPolicy.reviewPatterns)
  });
  const storageInfo = appSettings.find((setting) => setting.key === 'storage.info')?.value as
    | Record<string, unknown>
    | undefined;
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const trustedWorkspace = Boolean(
    activeWorkspaceId && permissionPolicy.trustedWorkspaceIds.includes(activeWorkspaceId)
  );
  const [templateDraft, setTemplateDraft] = useState({ name: '', description: '', paneTitles: '' });

  // AI LLM configuration state
  const [llmProvider, setLlmProvider] = useState<'gemini' | 'openai' | 'anthropic' | 'ollama' | '9router'>('gemini');
  const [llmApiKey, setLlmApiKey] = useState('');

  const { 
    activeThemeId, 
    customThemes, 
    activeTheme, 
    setTheme, 
    saveCustomTheme, 
    deleteCustomTheme, 
    resetToDefault, 
    importThemeFromDESIGN 
  } = useThemeStore();

  const [themeNameInput, setThemeNameInput] = useState(activeTheme.name);
  const [designImportText, setDesignImportText] = useState('');
  
  useEffect(() => {
    setThemeNameInput(activeTheme.name);
  }, [activeTheme.id, activeTheme.name]);

  const handleNameChange = (newName: string) => {
    setThemeNameInput(newName);
    if (!activeTheme.isBuiltIn) {
      const updatedTheme = {
        ...activeTheme,
        name: newName,
        updatedAt: new Date().toISOString()
      };
      saveCustomTheme(updatedTheme);
    }
  };

  const handleColorChange = (key: string, value: string) => {
    const updatedColors = { ...activeTheme.colors, [key]: value };
    const updatedTheme = {
      ...activeTheme,
      id: activeTheme.isBuiltIn ? `custom-${Date.now()}` : activeTheme.id,
      name: activeTheme.isBuiltIn ? `Custom ${activeTheme.name}` : activeTheme.name,
      isBuiltIn: false,
      colors: updatedColors,
      updatedAt: new Date().toISOString()
    };
    saveCustomTheme(updatedTheme);
  };

  const handleRadiusChange = (radiusVal: string) => {
    const num = parseInt(radiusVal) || 0;
    const updatedRadius = {
      xs: `${Math.max(1, Math.round(num * 0.4))}px`,
      sm: `${Math.max(2, Math.round(num * 0.7))}px`,
      md: `${num}px`,
      lg: `${Math.round(num * 1.4)}px`,
      xl: `${Math.round(num * 2)}px`,
      full: '9999px'
    };
    const updatedTheme = {
      ...activeTheme,
      id: activeTheme.isBuiltIn ? `custom-${Date.now()}` : activeTheme.id,
      name: activeTheme.isBuiltIn ? `Custom ${activeTheme.name}` : activeTheme.name,
      isBuiltIn: false,
      radius: updatedRadius,
      updatedAt: new Date().toISOString()
    };
    saveCustomTheme(updatedTheme);
  };

  const handleMotionChange = (level: "none" | "subtle" | "balanced" | "expressive") => {
    const isNone = level === 'none';
    const updatedMotion = {
      enabled: !isNone,
      level,
      durationFast: isNone ? '0s' : level === 'expressive' ? '0.2s' : level === 'balanced' ? '0.15s' : '0.1s',
      durationBase: isNone ? '0s' : level === 'expressive' ? '0.35s' : level === 'balanced' ? '0.25s' : '0.2s',
      durationSlow: isNone ? '0s' : level === 'expressive' ? '0.55s' : level === 'balanced' ? '0.4s' : '0.3s',
      easing: level === 'expressive' ? 'bounce-motion' : level === 'balanced' ? 'cubic-bezier(0.4, 0, 0.2, 1)' : 'ease'
    };
    const updatedTheme = {
      ...activeTheme,
      id: activeTheme.isBuiltIn ? `custom-${Date.now()}` : activeTheme.id,
      name: activeTheme.isBuiltIn ? `Custom ${activeTheme.name}` : activeTheme.name,
      isBuiltIn: false,
      motion: updatedMotion,
      updatedAt: new Date().toISOString()
    };
    saveCustomTheme(updatedTheme);
  };

  const handleImportTheme = () => {
    if (!designImportText.trim()) return;
    importThemeFromDESIGN(designImportText, "Imported DESIGN.md Theme");
    setDesignImportText('');
    alert("Theme extracted and applied successfully!");
  };
  const [llmModel, setLlmModel] = useState('gemini-2.5-flash');
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('agentdeck_llm_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.provider) setLlmProvider(parsed.provider);
        if (parsed.apiKey) setLlmApiKey(parsed.apiKey);
        if (parsed.model) setLlmModel(parsed.model);
        if (parsed.baseUrl) setLlmBaseUrl(parsed.baseUrl);
      }
    } catch (e) {
      console.error('Failed to load LLM settings in SettingsPanel:', e);
    }
  }, []);

  // Helper to save settings and fire a custom change event to alert the blueprint panel in real-time
  const saveLlmSettings = (prov: any, key: string, mod: string, base: string) => {
    try {
      localStorage.setItem('agentdeck_llm_settings', JSON.stringify({
        provider: prov,
        apiKey: key,
        model: mod,
        baseUrl: base
      }));
      // Dispatch custom event to alert other components in the same window
      window.dispatchEvent(new Event('agentdeck_llm_settings_changed'));
    } catch (e) {
      console.error('Failed to save LLM settings in SettingsPanel:', e);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      if (!(window.agentDeck as any)?.testLLMConnection) {
        throw new Error('Test connection IPC handler is not available. Please restart the app.');
      }
      const res = await (window.agentDeck as any).testLLMConnection({
        provider: llmProvider,
        apiKey: llmApiKey,
        model: llmModel,
        baseUrl: llmBaseUrl
      });
      if (res && res.ok && res.data) {
        setTestResult({ ok: true, message: res.data.message || 'Connection successful!' });
      } else {
        throw new Error(res?.error?.message || 'LLM did not reply or returned an error.');
      }
    } catch (err) {
      console.error('LLM Connection test failed:', err);
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  useEffect(() => {
    setPolicyDraft({
      allowedCommands: listToText(permissionPolicy.allowedCommands),
      blockedPatterns: listToText(permissionPolicy.blockedPatterns),
      reviewPatterns: listToText(permissionPolicy.reviewPatterns)
    });
  }, [permissionPolicy]);

  const savePolicy = () => {
    updatePermissionPolicy({
      allowedCommands: textToList(policyDraft.allowedCommands),
      blockedPatterns: textToList(policyDraft.blockedPatterns),
      reviewPatterns: textToList(policyDraft.reviewPatterns)
    });
  };

  const toggleTrustedWorkspace = () => {
    if (!activeWorkspaceId) {
      return;
    }

    updatePermissionPolicy({
      trustedWorkspaceIds: trustedWorkspace
        ? permissionPolicy.trustedWorkspaceIds.filter((workspaceId) => workspaceId !== activeWorkspaceId)
        : [activeWorkspaceId, ...permissionPolicy.trustedWorkspaceIds]
    });
  };

  const saveTemplate = () => {
    if (!templateDraft.name.trim()) {
      return;
    }

    upsertWorkspaceTemplate({
      name: templateDraft.name,
      description: templateDraft.description,
      paneTitles: textToList(templateDraft.paneTitles)
    });
    setTemplateDraft({ name: '', description: '', paneTitles: '' });
  };

  return (
    <div className="settings-panel">
      <section className="panel-section">
        <h2>Settings</h2>
        <dl>
          <dt>Active workspace</dt>
          <dd>{activeWorkspaceId ?? 'None'}</dd>
          <dt>Active pane</dt>
          <dd>{activePaneId ?? 'None'}</dd>
          <dt>Storage</dt>
          <dd>Local JSON state, markdown review exports, and per-pane log files in Electron user data.</dd>
        </dl>
      </section>

      <section className="panel-section">
        <h3>Terminal & Platform Settings</h3>
        <p className="muted">Configure terminal environments, memory limits, and platform-specific behaviors.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', color: '#e4e4e7' }}>
              Preferred Terminal Shell
            </label>
            <select
              value={(appSettings.find((s) => s.key === 'terminal.shell')?.value as string) || 'default'}
              onChange={(e) => useDeckStore.getState().setAppSetting('terminal.shell', e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', background: '#1c1c1e', border: '1px solid #2c2c2e', color: '#fff' }}
            >
              <option value="default">Default System Shell</option>
              {window.navigator.userAgent.includes('Windows') || window.navigator.platform.includes('Win') ? (
                <>
                  <option value="pwsh">PowerShell Core (pwsh.exe)</option>
                  <option value="powershell">Windows PowerShell (powershell.exe)</option>
                  <option value="git-bash">Git Bash (bash.exe)</option>
                  <option value="wsl">WSL Bash (wsl.exe)</option>
                  <option value="cmd">Command Prompt (cmd.exe)</option>
                </>
              ) : (
                <>
                  <option value="zsh">Zsh (zsh)</option>
                  <option value="bash">Bash (bash)</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', color: '#e4e4e7' }}>
              Scrollback Buffer Size
            </label>
            <select
              value={Number(appSettings.find((s) => s.key === 'terminal.bufferSize')?.value || 2000)}
              onChange={(e) => useDeckStore.getState().setAppSetting('terminal.bufferSize', Number(e.target.value))}
              style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', background: '#1c1c1e', border: '1px solid #2c2c2e', color: '#fff' }}
            >
              <option value={1000}>1000 lines</option>
              <option value={2000}>2000 lines (Recommended)</option>
              <option value={5000}>5000 lines</option>
              <option value={10000}>10000 lines</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', color: '#e4e4e7' }}>
              App Updates
            </label>
            <UpdateChecker />
          </div>
        </div>
      </section>

      <section className="llm-engine-card" style={{ marginBottom: 16 }}>
        <div className="llm-engine-card-head">
          <div className="llm-engine-card-title-wrap">
            <h3 className="llm-engine-card-title" style={{ fontSize: 14 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              AI Design Engine
            </h3>
            <p className="llm-engine-card-desc">
              LLM credentials for theme auto-fill and Blueprint. Saved in local storage.
            </p>
          </div>
          <span className="llm-engine-badge">Saved</span>
        </div>

        <div className="llm-engine-fields">
          <div className="llm-engine-field">
            <label className="llm-engine-label">AI Provider</label>
            <select
              className="llm-engine-input"
              value={llmProvider}
              onChange={(e) => {
                const val = e.target.value as any;
                setLlmProvider(val);
                let defModel = 'gemini-2.5-flash';
                let defBaseUrl = llmBaseUrl;
                if (val === 'openai') defModel = 'gpt-4o';
                if (val === 'anthropic') defModel = 'claude-3-5-sonnet';
                if (val === 'ollama') {
                  defModel = 'llama3';
                  defBaseUrl = 'http://localhost:11434';
                }
                if (val === '9router') {
                  defModel = 'anthropic/claude-3-5-sonnet';
                  defBaseUrl = 'http://localhost:20128';
                }
                setLlmModel(defModel);
                setLlmBaseUrl(defBaseUrl);
                saveLlmSettings(val, llmApiKey, defModel, defBaseUrl);
              }}
            >
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI (or custom proxy)</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="ollama">Ollama (Local LLM)</option>
              <option value="9router">9router (Local AI Router)</option>
            </select>
          </div>

          <div className="llm-engine-field">
            <label className="llm-engine-label">Model Name</label>
            <input
              type="text"
              className="llm-engine-input"
              value={llmModel}
              onChange={(e) => {
                setLlmModel(e.target.value);
                saveLlmSettings(llmProvider, llmApiKey, e.target.value, llmBaseUrl);
              }}
              placeholder="e.g. gemini-2.5-flash"
            />
          </div>

          {llmProvider !== 'ollama' && (
            <div className="llm-engine-field">
              <label className="llm-engine-label">API Key</label>
              <input
                type="password"
                className="llm-engine-input"
                value={llmApiKey}
                onChange={(e) => {
                  setLlmApiKey(e.target.value);
                  saveLlmSettings(llmProvider, e.target.value, llmModel, llmBaseUrl);
                }}
                placeholder="Paste API key…"
              />
            </div>
          )}

          {(llmProvider === 'ollama' || llmProvider === 'openai' || llmProvider === '9router') && (
            <div className="llm-engine-field">
              <label className="llm-engine-label">
                {llmProvider === 'ollama'
                  ? 'Ollama URL'
                  : llmProvider === '9router'
                    ? '9router Base URL'
                    : 'Custom Base URL'}
              </label>
              <input
                type="text"
                className="llm-engine-input"
                value={llmBaseUrl}
                onChange={(e) => {
                  setLlmBaseUrl(e.target.value);
                  saveLlmSettings(llmProvider, llmApiKey, llmModel, e.target.value);
                }}
                placeholder={
                  llmProvider === 'ollama'
                    ? 'http://localhost:11434'
                    : llmProvider === '9router'
                      ? 'http://localhost:20128'
                      : 'https://api.openai.com'
                }
              />
            </div>
          )}

          <div className="llm-engine-field" style={{ gap: 8 }}>
            <button
              type="button"
              className={`llm-engine-test-btn${isTestingConnection ? ' is-testing' : ''}`}
              disabled={isTestingConnection || (llmProvider !== 'ollama' && llmApiKey.trim().length === 0)}
              onClick={handleTestConnection}
            >
              {isTestingConnection ? 'Testing connection…' : 'Test Connection'}
            </button>

            {testResult && (
              <div className={`llm-engine-result ${testResult.ok ? 'is-ok' : 'is-err'}`} role="status">
                <span aria-hidden>{testResult.ok ? '✓' : '!'}</span>
                <span style={{ flex: 1 }}>{testResult.message}</span>
              </div>
            )}
          </div>

          <div
            className={`llm-engine-status${
              llmProvider === 'ollama' || llmApiKey.trim().length > 0 ? ' is-ready' : ''
            }`}
          >
            <span className="llm-engine-status-dot" aria-hidden />
            <span>
              {llmProvider === 'ollama' || llmApiKey.trim().length > 0
                ? `Ready · ${llmProvider === 'ollama' ? 'Local Ollama' : llmProvider}`
                : 'Pending credentials'}
            </span>
          </div>
        </div>
      </section>

      <section className="panel-section" style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.4) 0%, rgba(30, 41, 59, 0.3) 100%)',
        border: '1px solid rgba(56, 189, 248, 0.12)',
        borderRadius: '8px',
        padding: '16px',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
      }}>
        <h3 style={{ borderBottom: '1px solid rgba(56, 189, 248, 0.2)', paddingBottom: '8px', color: '#38bdf8' }}>AI Model Pricing & Cost Configuration</h3>
        <p className="muted">Configure pricing model metrics to estimate API costs for CLI and automated agents.</p>
        
        {(() => {
          let totalRequests = usageLogs.length;
          let totalInputTokens = 0;
          let totalOutputTokens = 0;
          let totalCost = 0;

          usageLogs.forEach((log) => {
            totalInputTokens += log.inputTokens || 0;
            totalOutputTokens += log.outputTokens || 0;
            totalCost += log.cost || 0;
          });

          return (
            <>
              {/* Cost Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '14px', marginBottom: '14px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(56, 189, 248, 0.1)', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '9px', fontWeight: '600', color: '#71717a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Total Requests</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#e4e4e7', marginTop: '4px' }}>{totalRequests}</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(56, 189, 248, 0.1)', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '9px', fontWeight: '600', color: '#71717a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Total Input Tokens</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#fb923c', marginTop: '4px' }}>{totalInputTokens.toLocaleString()}</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(56, 189, 248, 0.1)', borderRadius: '6px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '9px', fontWeight: '600', color: '#71717a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Output Tokens</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#4ade80', marginTop: '4px' }}>{totalOutputTokens.toLocaleString()}</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(256, 189, 248, 0.15)', borderRadius: '6px', padding: '10px 12px', position: 'relative' }}>
                  <div style={{ fontSize: '9px', fontWeight: '600', color: '#71717a', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Est. Cost</div>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#facc15', marginTop: '4px' }}>~${totalCost.toFixed(5)}</div>
                  <div style={{ fontSize: '8px', color: '#71717a', marginTop: '2px' }}>Actual cumulative log pricing</div>
                </div>
              </div>

              {/* Reset counters button if any request/token is counted */}
              {(totalRequests > 0 || totalInputTokens > 0 || totalOutputTokens > 0) && (
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '14px' }}>
                  <button
                    className="fe-act-btn danger"
                    style={{ fontSize: '10px', padding: '4px 10px', background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.15)' }}
                    onClick={() => {
                      if (window.confirm('Reset all token & cost counters for all terminal panes and usage logs?')) {
                        Object.keys(paneTokens).forEach((id) => {
                          useDeckStore.getState().resetPaneTokens(id);
                        });
                        resetUsageLogs();
                      }
                    }}
                  >
                    Reset All Stats
                  </button>
                </div>
              )}
            </>
          );
        })()}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', color: '#e4e4e7' }}>
              Pricing Model Profile
            </label>
            <select
              value={(appSettings.find((s) => s.key === 'agent.model')?.value as string) || 'claude-sonnet-4.6'}
              onChange={(e) => useDeckStore.getState().setAppSetting('agent.model', e.target.value)}
              style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', background: '#1c1c1e', border: '1px solid #2c2c2e', color: '#fff', fontSize: '12px' }}
            >
              {pricingList.map((pricing) => (
                <option key={pricing.modelId} value={pricing.modelId}>
                  {pricing.displayName} ({pricing.billingMode === 'token' ? `In: $${pricing.inputPer1M}/1M, Out: $${pricing.outputPer1M}/1M` : pricing.billingMode === 'free' ? 'Free' : 'Quota-based'})
                </option>
              ))}
              <option value="custom">Custom Pricing (Configure below)</option>
            </select>
          </div>

          {appSettings.find((s) => s.key === 'agent.model')?.value === 'custom' && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: '#a1a1aa' }}>
                  Input Price ($/M tokens)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={Number(appSettings.find((s) => s.key === 'agent.customInputPrice')?.value || 3.0)}
                  onChange={(e) => useDeckStore.getState().setAppSetting('agent.customInputPrice', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', background: '#1c1c1e', border: '1px solid #2c2c2e', color: '#fff', fontSize: '12px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: '#a1a1aa' }}>
                  Output Price ($/M tokens)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={Number(appSettings.find((s) => s.key === 'agent.customOutputPrice')?.value || 15.0)}
                  onChange={(e) => useDeckStore.getState().setAppSetting('agent.customOutputPrice', Number(e.target.value))}
                  style={{ width: '100%', padding: '6px 8px', background: '#1c1c1e', border: '1px solid #2c2c2e', color: '#fff', fontSize: '12px' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* API Usage Call Simulation Panel */}
        <div style={{
          marginTop: '16px',
          padding: '12px',
          borderRadius: '8px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid rgba(56, 189, 248, 0.15)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
        }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: '600', color: '#e4e4e7' }}>Simulate API Request</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '10px', color: '#a1a1aa', marginBottom: '2px' }}>Model</label>
              <select
                value={simModelId}
                onChange={(e) => setSimModelId(e.target.value)}
                style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', background: '#1c1c1e', border: '1px solid #2c2c2e', color: '#fff', fontSize: '11px' }}
              >
                {pricingList.map((pricing) => (
                  <option key={pricing.modelId} value={pricing.modelId}>
                    {pricing.displayName}
                  </option>
                ))}
                <option value="custom">Custom Pricing</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '10px', color: '#a1a1aa', marginBottom: '2px' }}>Input Tokens</label>
                <input
                  type="number"
                  value={simInput}
                  onChange={(e) => setSimInput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', background: '#1c1c1e', border: '1px solid #2c2c2e', color: '#fff', fontSize: '11px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '10px', color: '#a1a1aa', marginBottom: '2px' }}>Output Tokens</label>
                <input
                  type="number"
                  value={simOutput}
                  onChange={(e) => setSimOutput(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', background: '#1c1c1e', border: '1px solid #2c2c2e', color: '#fff', fontSize: '11px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '10px', color: '#a1a1aa', marginBottom: '2px' }}>Cached Input</label>
                <input
                  type="number"
                  value={simCached}
                  onChange={(e) => setSimCached(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  style={{ width: '100%', padding: '4px 8px', borderRadius: '4px', background: '#1c1c1e', border: '1px solid #2c2c2e', color: '#fff', fontSize: '11px' }}
                />
              </div>
            </div>
            <button
              type="button"
              className="primary-btn"
              onClick={() => {
                simulateUsageLog(simModelId, simInput, simOutput, simCached);
              }}
              style={{ padding: '6px 12px', fontSize: '11px', marginTop: '4px' }}
            >
              Simulate API Call
            </button>
          </div>
        </div>

        {/* Model Pricing Directory Table */}
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#e4e4e7', marginBottom: '8px' }}>Model Pricing Directory</h3>
          <div style={{ overflowX: 'auto', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '6px', maxHeight: '180px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', color: '#d4d4d8', background: 'rgba(0, 0, 0, 0.2)' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600', color: '#a1a1aa' }}>Provider</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600', color: '#a1a1aa' }}>Model</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600', color: '#a1a1aa' }}>Billing</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600', color: '#a1a1aa' }}>Input/1M</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600', color: '#a1a1aa' }}>Cache/1M</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600', color: '#a1a1aa' }}>Output/1M</th>
                </tr>
              </thead>
              <tbody>
                {pricingList.map((pricing) => (
                  <tr key={pricing.modelId} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.02)' }}>
                    <td style={{ padding: '6px 8px', fontWeight: '500' }}>{pricing.provider}</td>
                    <td style={{ padding: '6px 8px' }}>{pricing.displayName}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{
                        padding: '2px 4px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        background: pricing.billingMode === 'token' ? 'rgba(56, 189, 248, 0.1)' : pricing.billingMode === 'free' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(251, 146, 60, 0.1)',
                        color: pricing.billingMode === 'token' ? '#38bdf8' : pricing.billingMode === 'free' ? '#4ade80' : '#fb923c'
                      }}>
                        {pricing.billingMode}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{pricing.billingMode === 'token' ? `$${pricing.inputPer1M.toFixed(2)}` : '-'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{pricing.billingMode === 'token' && pricing.cachedInp !== undefined ? `$${pricing.cachedInp.toFixed(2)}` : '-'}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right' }}>{pricing.billingMode === 'token' ? `$${pricing.outputPer1M.toFixed(2)}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* API Usage Logs Table */}
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#e4e4e7', margin: 0 }}>API Usage Logs</h3>
            {usageLogs.length > 0 && (
              <button
                type="button"
                className="fe-act-btn danger"
                onClick={resetUsageLogs}
                style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.15)' }}
              >
                Clear Logs
              </button>
            )}
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '6px', maxHeight: '220px', overflowY: 'auto' }}>
            {usageLogs.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#71717a', fontSize: '11px' }}>
                No API calls logged yet. Run a command or trigger a simulation.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', color: '#d4d4d8', background: 'rgba(0, 0, 0, 0.2)' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600', color: '#a1a1aa' }}>Model (User)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: '600', color: '#a1a1aa' }}>Actual Route</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600', color: '#a1a1aa' }}>Tokens (In / Out / Cache)</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600', color: '#a1a1aa' }}>Cost</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600', color: '#a1a1aa' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {usageLogs.map((log) => {
                    const pricingListObj = useDeckStore.getState().pricingList || seededPricing;
                    const logModel = pricingListObj.find(m => m.modelId === log.selectedModel);
                    const billingMode = logModel?.billingMode || 'token';
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.02)' }}>
                        <td style={{ padding: '6px 8px', fontWeight: '500' }}>{log.selectedModel}</td>
                        <td style={{ padding: '6px 8px' }}>
                          {log.routeProvider ? (
                            <span style={{ color: '#38bdf8' }}>
                              {log.actualProvider}/{log.actualModel} via {log.routeProvider}
                            </span>
                          ) : (
                            <span style={{ color: '#a1a1aa' }}>
                              {log.actualProvider || '-'}/{log.actualModel || '-'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                          {log.inputTokens.toLocaleString()} / {log.outputTokens.toLocaleString()} / {log.cachedInputTokens ? log.cachedInputTokens.toLocaleString() : '0'}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: '600', color: billingMode === 'free' ? '#4ade80' : billingMode === 'subscription_quota' ? '#fb923c' : '#facc15' }}>
                          {formatCost(log.cost, billingMode)}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', color: '#71717a' }}>
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {activeWorkspace && (
        <section className="panel-section">
          <h3>Project Context & MCP Server</h3>
          <p className="muted">
            The Model Context Protocol (MCP) server enables external tools (Cursor, Claude Desktop) to connect.
          </p>
          <dl style={{ marginBottom: '12px' }}>
            <dt>MCP Server URL</dt>
            <dd><code>http://localhost:8765/sse</code></dd>
            <dt>Last Scanned</dt>
            <dd>
              {activeWorkspace.context
                ? new Date(activeWorkspace.context.updatedAt).toLocaleString()
                : 'Never scanned'}
            </dd>
          </dl>

          <div style={{ marginBottom: '12px' }}>
            <strong style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '500', color: '#e4e4e7' }}>
              Connected MCP Clients
            </strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {mcpClients.length === 0 ? (
                <span className="badge mcp-badge offline" style={{ background: '#2c2c2e', color: '#a1a1aa', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a1a1aa', display: 'inline-block' }} />
                  No Connected AI Clients
                </span>
              ) : (
                mcpClients.map((client) => (
                  <span key={client.id} className="badge mcp-badge online" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.2)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }} title={client.userAgent}>
                    <span className="pulsing" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                    {client.name} (Connected)
                  </span>
                ))
              )}
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: '500', color: '#e4e4e7' }}>
              Context Exclude Folders
            </label>
            <input
              type="text"
              value={(appSettings.find((s) => s.key === 'context.excludeFolders')?.value as string) || '.git, node_modules, dist, .vite, .output, .next, out, build, .gemini'}
              onChange={(e) => useDeckStore.getState().setAppSetting('context.excludeFolders', e.target.value)}
              placeholder="e.g. .git, node_modules, dist"
              style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', background: '#1c1c1e', border: '1px solid #2c2c2e', color: '#fff', fontSize: '12px' }}
            />
            <p className="muted" style={{ fontSize: '10px', marginTop: '4px', lineHeight: '1.4' }}>
              Comma-separated folder names to exclude when scanning technology stack, directory trees, or modules.
            </p>
          </div>

          <button
            className="primary-btn"
            onClick={() => generateContext(activeWorkspace.id)}
            style={{ width: '100%', marginBottom: '12px' }}
          >
            Auto-Scan Workspace Context
          </button>
          
          {activeWorkspace.context && (
            <div className="settings-context-preview" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <strong style={{ fontSize: '11px', color: '#e4e4e7' }}>Tech Stack</strong>
                <pre className="mini-pre" style={{ margin: '4px 0 0', maxHeight: '100px', overflowY: 'auto' }}>
                  {activeWorkspace.context.techStack}
                </pre>
              </div>
              <div>
                <strong style={{ fontSize: '11px', color: '#e4e4e7' }}>Directory Tree</strong>
                <pre className="mini-pre" style={{ margin: '4px 0 0', maxHeight: '100px', overflowY: 'auto' }}>
                  {activeWorkspace.context.folderStructure}
                </pre>
              </div>
              <div>
                <strong style={{ fontSize: '11px', color: '#e4e4e7' }}>Guidelines / Rules</strong>
                <pre className="mini-pre" style={{ margin: '4px 0 0', maxHeight: '100px', overflowY: 'auto' }}>
                  {activeWorkspace.context.codingRules}
                </pre>
              </div>
              <div>
                <strong style={{ fontSize: '11px', color: '#e4e4e7' }}>Project Memory</strong>
                <pre className="mini-pre" style={{ margin: '4px 0 0', maxHeight: '100px', overflowY: 'auto' }}>
                  {activeWorkspace.context.projectMemory}
                </pre>
              </div>
              {activeWorkspace.context.envExample && (
                <div>
                  <strong style={{ fontSize: '11px', color: '#e4e4e7' }}>Environment Variables (.env.example)</strong>
                  <pre className="mini-pre" style={{ margin: '4px 0 0', maxHeight: '100px', overflowY: 'auto' }}>
                    {activeWorkspace.context.envExample}
                  </pre>
                </div>
              )}
              {activeWorkspace.context.keyModules && (
                <div>
                  <strong style={{ fontSize: '11px', color: '#e4e4e7' }}>Key Modules & Routes</strong>
                  <pre className="mini-pre" style={{ margin: '4px 0 0', maxHeight: '100px', overflowY: 'auto' }}>
                    {activeWorkspace.context.keyModules}
                  </pre>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="panel-section">
        <h3>Architecture map</h3>
        <ul className="compact-list">
          <li>Electron main: window lifecycle, IPC handlers, storage, terminal, git, workspace dialog services.</li>
          <li>
            Preload IPC layer: typed bridge exposed as <code>window.agentDeck</code>.
          </li>
          <li>React renderer: workspace shell, terminal grid, task board, agent profiles, logs, review, settings.</li>
          <li>Zustand store: workspace, layout, task, agent, permission, report, and app setting state.</li>
          <li>node-pty + xterm.js: real local shells streamed through per-pane terminal sessions.</li>
          <li>Storage phase: JSON + filesystem logs now; schema is shaped for a later SQLite migration.</li>
        </ul>
      </section>

      <section className="panel-section">
        <h3>Data model status</h3>
        <dl>
          <dt>Schema</dt>
          <dd>
            v{metadata.schemaVersion} / {metadata.storageEngine}
          </dd>
          <dt>Projects</dt>
          <dd>{projects.length}</dd>
          <dt>Tasks</dt>
          <dd>{tasks.length}</dd>
          <dt>Agent runs</dt>
          <dd>{agentRuns.length}</dd>
          <dt>Permission rules</dt>
          <dd>{permissionRules.length}</dd>
          <dt>State path</dt>
          <dd>{String(storageInfo?.statePath ?? 'Loaded after Electron startup')}</dd>
          <dt>Logs</dt>
          <dd>{String(storageInfo?.logFilePattern ?? 'logs/{paneId}.jsonl')}</dd>
        </dl>
      </section>

      <section className="panel-section">
        <h3>Locked MVP scope</h3>
        <ul className="compact-list">
          <li>Local workspaces opened from folders.</li>
          <li>Restorable terminal pane layouts with split, rename, close, clear, and restart.</li>
          <li>Manual command execution in real local shells.</li>
          <li>Task board with pane and local agent assignment.</li>
          <li>Session logs, git checkpoint, local notes, and exportable review reports.</li>
        </ul>
        <p className="muted">
          Excluded from phase 1: cloud sync, auth, remote agent hosting, team permissions, billing, marketplace
          integrations, and enterprise admin features.
        </p>
      </section>

      <section className="panel-section">
        <h3>Keyboard shortcuts</h3>
        <dl className="shortcut-list">
          <dt>Ctrl+O</dt>
          <dd>Open project folder</dd>
          <dt>Ctrl+T</dt>
          <dd>New terminal pane</dd>
          <dt>Ctrl+Shift+V</dt>
          <dd>Split active pane vertically</dd>
          <dt>Ctrl+Shift+H</dt>
          <dd>Split active pane horizontally</dd>
          <dt>Ctrl+W</dt>
          <dd>Close active pane</dd>
          <dt>Ctrl+Tab</dt>
          <dd>Focus next pane</dd>
          <dt>Ctrl+Shift+Tab</dt>
          <dd>Focus previous pane</dd>
          <dt>Ctrl+R</dt>
          <dd>Rename active session</dd>
          <dt>Ctrl+M</dt>
          <dd>Maximize or restore active pane</dd>
          <dt>Ctrl+B</dt>
          <dd>Collapse or restore workspace sidebar</dd>
          <dt>Ctrl+I</dt>
          <dd>Collapse or restore inspector panel</dd>
          <dt>Ctrl+Shift+P</dt>
          <dd>Open command palette</dd>
          <dt>Ctrl+1..5</dt>
          <dd>Switch right panel tabs</dd>
        </dl>
      </section>

      <section className="panel-section">
        <h3>Command permissions</h3>
        <p className="muted">
          Commands are categorized before launch. Block-level findings stop execution; risky commands require review and
          a Git checkpoint flow unless explicitly overridden.
        </p>
        <select
          value={permissionPolicy.mode}
          onChange={(event) => updatePermissionPolicy({ mode: event.target.value as CommandPermissionPolicy['mode'] })}
        >
          {policyModes.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
        {permissionPolicy.mode === 'bypass-permissions' && (
          <div className="warning-card" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px', borderRadius: '4px', marginTop: '8px', fontSize: '11px', color: '#f87171', lineHeight: '1.4' }}>
            <strong>Security Warning:</strong> Automatically executing all commands without approval may allow AI agents to run destructive or dangerous commands on your system without human oversight. Please exercise extreme caution!
          </div>
        )}
        <dl className="permission-mode-list">
          <dt>ask-every-time</dt>
          <dd>Every agent command opens a review prompt.</dd>
          <dt>allow-safe</dt>
          <dd>Safe read/build/test commands can run; risky or unknown commands prompt.</dd>
          <dt>workspace-trusted</dt>
          <dd>Trusted workspaces can run non-blocked commands without review.</dd>
          <dt>bypass-permissions</dt>
          <dd>Runs without prompts except detector results are still logged as overrides.</dd>
        </dl>
        <button onClick={toggleTrustedWorkspace} disabled={!activeWorkspaceId}>
          {trustedWorkspace ? 'Remove trusted workspace' : 'Trust active workspace'}
        </button>
        <p className="muted">
          Active trust:{' '}
          {activeWorkspace
            ? `${activeWorkspace.name} is ${trustedWorkspace ? 'trusted' : 'not trusted'}`
            : 'No active workspace'}
        </p>
        <label>Allowed commands</label>
        <textarea
          value={policyDraft.allowedCommands}
          onChange={(event) => setPolicyDraft({ ...policyDraft, allowedCommands: event.target.value })}
          rows={3}
        />
        <label>Blocked patterns</label>
        <textarea
          value={policyDraft.blockedPatterns}
          onChange={(event) => setPolicyDraft({ ...policyDraft, blockedPatterns: event.target.value })}
          rows={3}
        />
        <label>Review patterns</label>
        <textarea
          value={policyDraft.reviewPatterns}
          onChange={(event) => setPolicyDraft({ ...policyDraft, reviewPatterns: event.target.value })}
          rows={3}
        />
        <button onClick={savePolicy}>Save policy lists</button>
      </section>

      <section className="panel-section">
        <h3>Dangerous command detection</h3>
        <ul className="compact-list">
          <li>
            Blocks recursive deletes, disk formatting, diskpart, encoded PowerShell, curl/wget pipe shell, and
            environment exfiltration.
          </li>
          <li>
            Flags git reset/clean, node_modules deletion, package installs, network commands, file writes, and unknown
            npm scripts for review.
          </li>
          <li>
            Risky approved commands check Git status, offer a checkpoint commit, and require explicit confirmation to
            continue without one.
          </li>
        </ul>
      </section>

      <section className="panel-section">
        <h3>Permission decisions</h3>
        {permissionDecisions.length === 0 ? <p className="muted">No permission decisions recorded yet.</p> : null}
        {permissionDecisions.slice(0, 12).map((decision) => (
          <PermissionDecisionCard decision={decision} key={decision.id} />
        ))}
      </section>

      <section className="panel-section">
        <h3>Workspace templates</h3>
        <input
          value={templateDraft.name}
          onChange={(event) => setTemplateDraft({ ...templateDraft, name: event.target.value })}
          placeholder="Template name"
        />
        <input
          value={templateDraft.description}
          onChange={(event) => setTemplateDraft({ ...templateDraft, description: event.target.value })}
          placeholder="Description"
        />
        <textarea
          value={templateDraft.paneTitles}
          onChange={(event) => setTemplateDraft({ ...templateDraft, paneTitles: event.target.value })}
          rows={4}
          placeholder="One pane title per line"
        />
        <button onClick={saveTemplate}>Save template</button>
        {workspaceTemplates.map((template) => (
          <WorkspaceTemplateCard
            template={template}
            deleteWorkspaceTemplate={deleteWorkspaceTemplate}
            upsertWorkspaceTemplate={upsertWorkspaceTemplate}
            key={template.id}
          />
        ))}
      </section>

      <section className="panel-section">
        <h3>Theme & Branding</h3>
        <p className="muted" style={{ marginBottom: '10px' }}>
          Select an app-wide preset theme or customize design tokens (colors, radii, motion) to create a custom branding loop.
        </p>

        {/* Preset Selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
          <label style={{ fontSize: '9px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Theme Presets
          </label>
          <select
            value={activeThemeId}
            onChange={(e) => setTheme(e.target.value)}
            style={{ padding: '6px 8px', borderRadius: '4px', background: 'var(--bg-background-subtle, #1c1c1e)', border: '1px solid var(--border-color, #2c2c2e)', color: '#fff', fontSize: '12px', cursor: 'pointer' }}
          >
            <optgroup label="Built-in Presets" style={{ background: '#1c1c1e' }}>
              <option value="spotify-dark">Spotify Dark (Default)</option>
              <option value="sunsama-warm">Sunsama Warm</option>
              <option value="duolingo-playful">Duolingo Playful</option>
              <option value="spotify-night">Spotify Night (OLED)</option>
            </optgroup>
            {customThemes.length > 0 && (
              <optgroup label="Custom Themes" style={{ background: '#1c1c1e' }}>
                {customThemes.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Custom Theme Name (only editable if not built-in) */}
        {!activeTheme.isBuiltIn && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
            <label style={{ fontSize: '9px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Custom Theme Name
            </label>
            <input
              type="text"
              value={themeNameInput}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. My Cool Theme"
              style={{ padding: '6px 8px', borderRadius: '4px', background: 'var(--bg-background-subtle, #1c1c1e)', border: '1px solid var(--border-color, #2c2c2e)', color: '#fff', fontSize: '12px' }}
            />
          </div>
        )}

        {/* Color Palette Grid */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Color Customizer
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {[
              { key: 'background', label: 'Background' },
              { key: 'backgroundSubtle', label: 'BG Subtle' },
              { key: 'surface', label: 'Surface' },
              { key: 'text', label: 'Text Primary' },
              { key: 'textMuted', label: 'Text Muted' },
              { key: 'primary', label: 'Primary Brand' },
              { key: 'accent', label: 'Accent Highlight' },
              { key: 'border', label: 'Border Glass' },
              { key: 'codeBackground', label: 'Code Base' }
            ].map(item => (
              <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '3px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: '4px', padding: '6px' }}>
                <span style={{ fontSize: '9px', color: '#a1a1aa', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{item.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <input
                    type="color"
                    value={activeTheme.colors[item.key as keyof typeof activeTheme.colors]}
                    onChange={(e) => handleColorChange(item.key, e.target.value)}
                    style={{ width: '16px', height: '16px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '2px' }}
                  />
                  <span style={{ fontSize: '9.5px', color: '#71717a', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                    {activeTheme.colors[item.key as keyof typeof activeTheme.colors]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Radius & Motion Selectors */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '9px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Border Corners (Base)
            </label>
            <select
              value={parseInt(activeTheme.radius.md) || 6}
              onChange={(e) => handleRadiusChange(e.target.value + 'px')}
              style={{ padding: '4px 6px', borderRadius: '4px', background: 'var(--bg-background-subtle, #1c1c1e)', border: '1px solid var(--border-color, #2c2c2e)', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
            >
              <option value="0" style={{ background: '#1c1c1e' }}>0px (None)</option>
              <option value="3" style={{ background: '#1c1c1e' }}>3px (Sharp)</option>
              <option value="6" style={{ background: '#1c1c1e' }}>6px (Standard)</option>
              <option value="12" style={{ background: '#1c1c1e' }}>12px (Playful)</option>
              <option value="20" style={{ background: '#1c1c1e' }}>20px (Organic)</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '9px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Motion & Speeds
            </label>
            <select
              value={activeTheme.motion.level}
              onChange={(e) => handleMotionChange(e.target.value as any)}
              style={{ padding: '4px 6px', borderRadius: '4px', background: 'var(--bg-background-subtle, #1c1c1e)', border: '1px solid var(--border-color, #2c2c2e)', color: '#fff', fontSize: '11px', cursor: 'pointer' }}
            >
              <option value="none" style={{ background: '#1c1c1e' }}>None (Instant)</option>
              <option value="subtle" style={{ background: '#1c1c1e' }}>Subtle (Snappy)</option>
              <option value="balanced" style={{ background: '#1c1c1e' }}>Balanced (Smooth)</option>
              <option value="expressive" style={{ background: '#1c1c1e' }}>Expressive (Springy)</option>
            </select>
          </div>
        </div>

        {/* DESIGN.md Paste Importer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
          <label style={{ fontSize: '9px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Import from DESIGN.md or Figma Context
          </label>
          <textarea
            value={designImportText}
            onChange={(e) => setDesignImportText(e.target.value)}
            placeholder="Paste DESIGN.md markup or color tokens hex list here..."
            rows={2}
            style={{ padding: '6px 8px', borderRadius: '4px', background: 'var(--bg-background-subtle, #09090b)', border: '1px solid var(--border-color, #2c2c2e)', color: '#fff', fontSize: '11px' }}
          />
          <button
            onClick={handleImportTheme}
            disabled={!designImportText.trim()}
            style={{ padding: '6px 10px', fontSize: '10.5px', fontWeight: 600, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Extract & Synthesize Theme
          </button>
        </div>

        {/* Global Reset / Delete custom theme */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={resetToDefault}
            style={{ flex: 1, padding: '5px 8px', fontSize: '11px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#a1a1aa' }}
          >
            Reset all
          </button>
          {!activeTheme.isBuiltIn && (
            <button
              onClick={() => deleteCustomTheme(activeTheme.id)}
              style={{ flex: 1, padding: '5px 8px', fontSize: '11px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}
            >
              Delete custom theme
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function PermissionDecisionCard({ decision }: { decision: PermissionDecision }) {
  return (
    <article className={`permission-decision ${decision.action}`}>
      <div className="decision-header">
        <strong>{decision.action}</strong>
        <span>{decision.category}</span>
      </div>
      <code>{decision.command}</code>
      <span className="muted">{new Date(decision.createdAt).toLocaleString()}</span>
      <p className="muted">{decision.reason}</p>
      {decision.findings.length ? (
        <ul className="compact-list">
          {decision.findings.map((finding) => (
            <li key={`${decision.id}-${finding.id}`}>
              {finding.severity}: {finding.message}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function WorkspaceTemplateCard({
  template,
  upsertWorkspaceTemplate,
  deleteWorkspaceTemplate
}: {
  template: WorkspaceTemplate;
  upsertWorkspaceTemplate: (
    template: Partial<WorkspaceTemplate> & Pick<WorkspaceTemplate, 'name' | 'paneTitles'>
  ) => void;
  deleteWorkspaceTemplate: (templateId: string) => void;
}) {
  const [draft, setDraft] = useState({
    ...template,
    paneTitlesText: listToText(template.paneTitles)
  });

  useEffect(() => {
    setDraft({ ...template, paneTitlesText: listToText(template.paneTitles) });
  }, [template]);

  return (
    <article className="template-card">
      <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      <input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
      <textarea
        value={draft.paneTitlesText}
        onChange={(event) => setDraft({ ...draft, paneTitlesText: event.target.value })}
        rows={3}
      />
      <div className="task-actions">
        <button onClick={() => upsertWorkspaceTemplate({ ...draft, paneTitles: textToList(draft.paneTitlesText) })}>
          Save
        </button>
        <button className="danger" onClick={() => deleteWorkspaceTemplate(template.id)}>
          Delete
        </button>
      </div>
    </article>
  );
}

/** Virtualize skills list when many — keeps scroll smooth at 100+ items */
const SKILL_VIRTUAL_THRESHOLD = 40;

type CategoryComboboxProps = {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
};

function CategoryCombobox({
  value,
  onChange,
  options,
  placeholder = 'Select or type category...'
}: CategoryComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!value.trim()) return options;
    const q = value.trim().toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [value, options]);

  return (
    <div ref={boxRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          spellCheck={false}
          style={{
            width: '100%',
            paddingRight: '28px'
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          style={{
            position: 'absolute',
            right: '6px',
            background: 'transparent',
            border: 'none',
            color: isOpen ? '#38bdf8' : '#71717a',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
          onMouseLeave={(e) => (e.currentTarget.style.color = isOpen ? '#38bdf8' : '#71717a')}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease'
            }}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 200,
            background: '#161618',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            maxHeight: '180px',
            overflowY: 'auto',
            padding: '4px'
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '6px 8px', fontSize: '11px', color: '#71717a', fontStyle: 'italic' }}>
              Press Enter or continue typing custom category "{value}"
            </div>
          ) : (
            filtered.map((opt) => {
              const isSelected = opt === value;
              return (
                <button
                  key={opt}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(opt);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    border: 'none',
                    borderRadius: '5px',
                    color: isSelected ? '#38bdf8' : '#e4e4e7',
                    fontSize: '11px',
                    padding: '6px 8px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span>{opt}</span>
                  {isSelected && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function SkillsPanel() {
  const skills = useDeckStore((state) => state.skills);
  const pinnedSkillIds = useDeckStore((state) => state.pinnedSkillIds || []);
  const createSkill = useDeckStore((state) => state.createSkill);
  const updateSkill = useDeckStore((state) => state.updateSkill);
  const deleteSkill = useDeckStore((state) => state.deleteSkill);
  const togglePinSkill = useDeckStore((state) => state.togglePinSkill);
  const moveSkill = useDeckStore((state) => state.moveSkill);

  const [searchQuery, setSearchQuery] = useState('');
  const [skillFilter, setSkillFilter] = useState<'all' | 'system' | 'custom' | 'pinned'>('all');
  /** `default` = no forced sort — keep store order so users control arrangement */
  const [skillSort, setSkillSort] = useState<
    'default' | 'name-asc' | 'name-desc' | 'updated-desc' | 'updated-asc' | 'type'
  >('default');
  /** List = full detail · Grid = compact tiles */
  const [skillLayout, setSkillLayout] = useState<'list' | 'grid'>('list');
  /** Collapse state for section headers (Pinned / System / Custom / Categories) - saved to localStorage */
  const [collapsedSkillGroups, setCollapsedSkillGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('agentdeck_collapsed_skill_groups');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('agentdeck_collapsed_skill_groups', JSON.stringify(collapsedSkillGroups));
    } catch {
      // Ignore storage errors
    }
  }, [collapsedSkillGroups]);

  const isGroupCollapsed = useCallback(
    (key: string): boolean => {
      if (collapsedSkillGroups[key] !== undefined) {
        return Boolean(collapsedSkillGroups[key]);
      }
      return true; // Default to collapsed
    },
    [collapsedSkillGroups]
  );

  /** Custom user-created folder categories */
  const [customFolders, setCustomFolders] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('agentdeck_custom_skill_folders');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('agentdeck_custom_skill_folders', JSON.stringify(customFolders));
    } catch {
      // Ignore storage errors
    }
  }, [customFolders]);

  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [editingFolderName, setEditingFolderName] = useState<string | null>(null);
  const [renameInputValue, setRenameInputValue] = useState('');

  const [movingSkill, setMovingSkill] = useState<Skill | null>(null);
  const [targetMoveFolder, setTargetMoveFolder] = useState('');

  const [confirmDeleteFolderKey, setConfirmDeleteFolderKey] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmDeleteFolderKey) return;
    const handleGlobalClick = () => setConfirmDeleteFolderKey(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmDeleteFolderKey(null);
    };
    window.addEventListener('click', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirmDeleteFolderKey]);

  const submitCreateFolder = () => {
    if (!newFolderName || !newFolderName.trim()) return;
    const name = newFolderName.trim();
    if (!customFolders.includes(name)) {
      setCustomFolders((prev) => [...prev, name]);
    }
    setCollapsedSkillGroups((prev) => ({
      ...prev,
      [`cat-${name}`]: false
    }));
    setNewFolderName('');
    setShowCreateFolder(false);
  };

  const startRenameFolder = (oldName: string) => {
    setEditingFolderName(oldName);
    setRenameInputValue(oldName);
  };

  const submitRenameFolder = (oldPath: string) => {
    const trimmed = renameInputValue.trim();
    if (!trimmed || trimmed === oldPath) {
      setEditingFolderName(null);
      return;
    }
    const newPath = trimmed;

    setCustomFolders((prev) =>
      prev.map((f) => {
        if (f === oldPath) return newPath;
        if (f.startsWith(oldPath + '/')) return newPath + f.slice(oldPath.length);
        return f;
      })
    );

    for (const skill of skills) {
      if (skill.category) {
        const cat = skill.category.trim();
        if (cat === oldPath) {
          updateSkill(skill.id, { category: newPath });
        } else if (cat.startsWith(oldPath + '/')) {
          updateSkill(skill.id, { category: newPath + cat.slice(oldPath.length) });
        }
      }
    }
    setEditingFolderName(null);
  };

  const handleDeleteFolderClick = (folderPath: string) => {
    if (confirmDeleteFolderKey === folderPath) {
      setCustomFolders((prev) =>
        prev.filter((f) => f !== folderPath && !f.startsWith(folderPath + '/'))
      );

      const parts = folderPath.split('/');
      const parentPath = parts.length > 1 ? parts.slice(0, -1).join('/') : undefined;

      for (const skill of skills) {
        if (skill.category) {
          const cat = skill.category.trim();
          if (cat === folderPath || cat.startsWith(folderPath + '/')) {
            updateSkill(skill.id, { category: parentPath });
          }
        }
      }
      setConfirmDeleteFolderKey(null);
    } else {
      setConfirmDeleteFolderKey(folderPath);
    }
  };

  const startMoveSkill = (skill: Skill) => {
    setMovingSkill(skill);
    setTargetMoveFolder(skill.category || '');
  };

  const submitMoveSkill = () => {
    if (!movingSkill) return;
    const newCat = targetMoveFolder.trim() || undefined;
    if (newCat && !customFolders.includes(newCat)) {
      setCustomFolders((prev) => [...prev, newCat]);
    }
    updateSkill(movingSkill.id, { category: newCat });
    setMovingSkill(null);
  };

  const [isCreating, setIsCreating] = useState(false);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  /** Inline confirm delete — second click on same skill id executes */
  const [confirmDeleteSkillId, setConfirmDeleteSkillId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  /** Trello-style: card stays in list, reorders live under cursor (pointer-based, not HTML5) */
  const [draggingSkillId, setDraggingSkillId] = useState<string | null>(null);
  const dragOverRaf = useRef(0);
  const lastMoveKey = useRef('');
  const skillsListRef = useRef<HTMLDivElement | null>(null);
  /**
   * Pointer reorder via window-level listeners (not per-card capture).
   * Card-level setPointerCapture + pointer-events:none caused stuck drag
   * (pointerup never delivered after leaving the list).
   */
  const pointerReorderRef = useRef<{
    skillId: string;
    pointerId: number;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  /** Detach window listeners for the active pointer session */
  const pointerListenersCleanupRef = useRef<(() => void) | null>(null);
  /**
   * Edge auto-scroll — time-based + owned scroll position.
   * Up was unstable because live-reorder DOM shifts fought scrollTop;
   * we drive `intendedTop` ourselves so up/down stay the same speed.
   */
  const autoScrollRef = useRef({
    raf: 0,
    /** -1 up, 0 none, +1 down */
    dir: 0,
    /** px per second — constant, same for up & down */
    speed: 820,
    lastTs: 0,
    clientX: 0,
    clientY: 0,
    lastReorderTs: 0,
    /** Authoritative scroll position while auto-scrolling */
    intendedTop: 0
  });
  /**
   * While reordering: keep scrollbar visible; block wheel/touch so only our
   * edge auto-scroll moves the list.
   */
  const scrollFreezeCleanupRef = useRef<(() => void) | null>(null);
  const canReorderSkills = skillSort === 'default' && (skillFilter === 'all' || skillFilter === 'custom') && !searchQuery.trim();

  const getSkillScrollParent = useCallback((): HTMLElement | null => {
    const list = skillsListRef.current;
    if (!list) return null;
    // Prefer the skills list itself when it can scroll
    if (list.scrollHeight > list.clientHeight + 1) return list;
    let el: HTMLElement | null = list.parentElement;
    while (el) {
      const oy = window.getComputedStyle(el).overflowY;
      if (
        (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
        el.scrollHeight > el.clientHeight + 1
      ) {
        return el;
      }
      el = el.parentElement;
    }
    return list;
  }, []);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current.raf) {
      cancelAnimationFrame(autoScrollRef.current.raf);
      autoScrollRef.current.raf = 0;
    }
    autoScrollRef.current.dir = 0;
    autoScrollRef.current.lastTs = 0;
  }, []);

  /** Hit-test skill card under point, skipping the card being dragged */
  const cardAtPoint = useCallback((clientX: number, clientY: number, draggedId: string) => {
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const node of stack) {
      if (!(node instanceof Element)) continue;
      const card = node.closest('[data-skill-card-id]') as HTMLElement | null;
      if (!card) continue;
      const id = card.getAttribute('data-skill-card-id');
      if (id && id !== draggedId) return card;
    }
    return null;
  }, []);

  // Forward-declared via ref so applyReorder can pin scroll after moveSkill
  const getSkillScrollParentRef = useRef(getSkillScrollParent);
  getSkillScrollParentRef.current = getSkillScrollParent;

  /** FLIP rects captured before grid reorder — animate neighbors into place */
  const flipRectsRef = useRef<Map<string, DOMRect>>(new Map());
  /** Grid reorder stability: avoid mid-point thrash between adjacent cells */
  const gridReorderStableRef = useRef({ overId: '', since: 0, lastMoveAt: 0 });

  /** Re-apply owned scroll after DOM reorder (stops up-scroll jitter) */
  const pinIntendedScroll = useCallback(() => {
    const state = autoScrollRef.current;
    if (state.dir === 0) return;
    const scroller = getSkillScrollParentRef.current();
    if (!scroller) return;
    scroller.scrollTop = state.intendedTop;
  }, []);

  const captureFlipRects = useCallback(() => {
    const list = skillsListRef.current;
    if (!list) return;
    const map = new Map<string, DOMRect>();
    list.querySelectorAll('[data-skill-card-id]').forEach((node) => {
      const el = node as HTMLElement;
      const id = el.getAttribute('data-skill-card-id');
      if (id) map.set(id, el.getBoundingClientRect());
    });
    flipRectsRef.current = map;
  }, []);

  /** Grid: closest-center slot + dwell time so cells don’t thrash */
  const applyGridReorderAtPoint = useCallback(
    (clientX: number, clientY: number, draggedId: string) => {
      const list = skillsListRef.current;
      if (!list) return;

      const cards = Array.from(
        list.querySelectorAll('[data-skill-card-id]')
      ) as HTMLElement[];
      if (cards.length < 2) return;

      // Closest card center to pointer (include dragged — its slot is the hole)
      let bestId = '';
      let bestIdx = -1;
      let bestDist = Infinity;
      const order: string[] = [];
      for (let i = 0; i < cards.length; i++) {
        const el = cards[i];
        const id = el.getAttribute('data-skill-card-id');
        if (!id) continue;
        order.push(id);
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const d = (cx - clientX) * (cx - clientX) + (cy - clientY) * (cy - clientY);
        if (d < bestDist) {
          bestDist = d;
          bestId = id;
          bestIdx = i;
        }
      }
      if (!bestId || bestIdx < 0) return;

      const fromIdx = order.indexOf(draggedId);
      if (fromIdx < 0) return;
      // Already in that slot
      if (bestId === draggedId) {
        gridReorderStableRef.current.overId = bestId;
        return;
      }

      const now = performance.now();
      const stable = gridReorderStableRef.current;
      // Require pointer to “settle” on a cell before swapping (~2 frames)
      if (stable.overId !== bestId) {
        stable.overId = bestId;
        stable.since = now;
        return;
      }
      if (now - stable.since < 48) return;
      // Min gap between moves — prevents rapid A↔B flip
      if (now - stable.lastMoveAt < 90) return;

      const place: 'before' | 'after' = fromIdx < bestIdx ? 'after' : 'before';
      const key = `${draggedId}>${bestId}:${place}`;
      if (lastMoveKey.current === key) return;
      lastMoveKey.current = key;
      stable.lastMoveAt = now;

      if (dragOverRaf.current) cancelAnimationFrame(dragOverRaf.current);
      dragOverRaf.current = requestAnimationFrame(() => {
        dragOverRaf.current = 0;
        if (!pointerReorderRef.current?.active) return;
        captureFlipRects();
        moveSkill(draggedId, bestId, place);
        pinIntendedScroll();
        requestAnimationFrame(pinIntendedScroll);
      });
    },
    [captureFlipRects, moveSkill, pinIntendedScroll]
  );

  /** Live-move skill under pointer (shared by pointermove + auto-scroll tick) */
  const applyReorderAtPoint = useCallback(
    (clientX: number, clientY: number, draggedId: string) => {
      const isGrid = skillsListRef.current?.classList.contains('is-grid');
      if (isGrid) {
        applyGridReorderAtPoint(clientX, clientY, draggedId);
        return;
      }

      const card = cardAtPoint(clientX, clientY, draggedId);
      if (!card) return;
      const overId = card.getAttribute('data-skill-card-id');
      if (!overId || overId === draggedId) return;

      const rect = card.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const place: 'before' | 'after' = clientY < midY ? 'before' : 'after';
      const key = `${draggedId}>${overId}:${place}`;
      if (lastMoveKey.current === key) return;
      lastMoveKey.current = key;

      if (dragOverRaf.current) cancelAnimationFrame(dragOverRaf.current);
      dragOverRaf.current = requestAnimationFrame(() => {
        dragOverRaf.current = 0;
        if (!pointerReorderRef.current?.active) return;
        moveSkill(draggedId, overId, place);
        pinIntendedScroll();
        requestAnimationFrame(pinIntendedScroll);
      });
    },
    [applyGridReorderAtPoint, cardAtPoint, moveSkill, pinIntendedScroll]
  );

  const applyReorderAtPointRef = useRef(applyReorderAtPoint);
  applyReorderAtPointRef.current = applyReorderAtPoint;

  const tickAutoScroll = useCallback(() => {
    const state = autoScrollRef.current;
    state.raf = 0;
    const drag = pointerReorderRef.current;
    if (!drag?.active || state.dir === 0) {
      state.dir = 0;
      state.lastTs = 0;
      return;
    }

    const now = performance.now();
    // Cap dt so a hitch doesn’t jump; floor tiny dt for stable up speed
    const dt = state.lastTs
      ? Math.min(0.024, Math.max(0.008, (now - state.lastTs) / 1000))
      : 1 / 60;
    state.lastTs = now;

    const scroller = getSkillScrollParentRef.current();
    if (!scroller) {
      state.raf = requestAnimationFrame(tickAutoScroll);
      return;
    }

    const maxScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    // Drive intendedTop ourselves — never read scrollTop back (reorder can corrupt it)
    const next = Math.max(
      0,
      Math.min(maxScroll, state.intendedTop + state.dir * state.speed * dt)
    );

    if (next === state.intendedTop && (next === 0 || next === maxScroll)) {
      // Hit end
      state.dir = 0;
      state.lastTs = 0;
      scroller.scrollTop = next;
      return;
    }

    state.intendedTop = next;
    scroller.scrollTop = next;

    // Reorder less often while scrolling — reorder re-renders were making UP stutter
    if (now - state.lastReorderTs >= 64) {
      state.lastReorderTs = now;
      applyReorderAtPointRef.current(state.clientX, state.clientY, drag.skillId);
      // Pin again after potential sync layout
      scroller.scrollTop = state.intendedTop;
    }

    if (pointerReorderRef.current?.active && autoScrollRef.current.dir !== 0) {
      state.raf = requestAnimationFrame(tickAutoScroll);
    } else {
      state.lastTs = 0;
    }
  }, []);

  /**
   * Edge detection with hysteresis so UP near the list chrome doesn’t
   * flicker speed (enter/leave zone). Same constant speed both directions.
   */
  const updateAutoScrollFromPointer = useCallback((clientX: number, clientY: number) => {
    const state = autoScrollRef.current;
    state.clientX = clientX;
    state.clientY = clientY;

    const scroller = getSkillScrollParentRef.current();
    if (!scroller) {
      state.dir = 0;
      return;
    }

    const rect = scroller.getBoundingClientRect();
    /** Enter edge band */
    const EDGE_IN = 56;
    /** Must move further toward center to stop (kills top-edge flicker) */
    const EDGE_OUT = 88;
    const SPEED = 820;

    let dir = state.dir;

    if (state.dir === -1) {
      // Keep scrolling up until pointer is clearly below the top band
      if (clientY > rect.top + EDGE_OUT) dir = 0;
    } else if (state.dir === 1) {
      if (clientY < rect.bottom - EDGE_OUT) dir = 0;
    } else {
      // Start
      if (clientY < rect.top + EDGE_IN) dir = -1;
      else if (clientY > rect.bottom - EDGE_IN) dir = 1;
      else dir = 0;
    }

    // Seed intendedTop when engaging auto-scroll
    if (dir !== 0 && state.dir === 0) {
      state.intendedTop = scroller.scrollTop;
      state.lastTs = performance.now();
    }
    // When idle, keep intendedTop in sync with real scroll
    if (dir === 0) {
      state.intendedTop = scroller.scrollTop;
      state.lastTs = 0;
    }

    state.dir = dir;
    state.speed = SPEED;

    if (dir !== 0 && !state.raf) {
      state.lastTs = performance.now();
      state.raf = requestAnimationFrame(tickAutoScroll);
    }
  }, [tickAutoScroll]);

  const setScrollFrozen = useCallback((frozen: boolean) => {
    if (!frozen) {
      scrollFreezeCleanupRef.current?.();
      scrollFreezeCleanupRef.current = null;
      document.body.classList.remove('is-skill-reordering');
      skillsListRef.current?.classList.remove('is-reordering-scroll-frozen');
      return;
    }
    if (scrollFreezeCleanupRef.current) return;

    const list = skillsListRef.current;
    list?.classList.add('is-reordering-scroll-frozen');
    document.body.classList.add('is-skill-reordering');

    const blockScrollInput = (e: Event) => {
      e.preventDefault();
    };
    const opts: AddEventListenerOptions = { passive: false, capture: true };
    window.addEventListener('wheel', blockScrollInput, opts);
    window.addEventListener('touchmove', blockScrollInput, opts);

    scrollFreezeCleanupRef.current = () => {
      window.removeEventListener('wheel', blockScrollInput, opts);
      window.removeEventListener('touchmove', blockScrollInput, opts);
    };
  }, []);

  const detachPointerListeners = useCallback(() => {
    pointerListenersCleanupRef.current?.();
    pointerListenersCleanupRef.current = null;
  }, []);

  /** Highlight terminal / task under pointer while dragging a skill */
  const skillDropHoverRef = useRef<HTMLElement | null>(null);

  const clearSkillDropHover = useCallback(() => {
    const el = skillDropHoverRef.current;
    if (el) {
      el.classList.remove('skill-drop-target', 'skill-drop-target-before', 'skill-drop-target-after');
      el.removeAttribute('data-skill-drop-label');
      skillDropHoverRef.current = null;
    }
    document.body.classList.remove('is-skill-dragging-drop');
    document
      .querySelectorAll('.skill-drop-target, .skill-drop-target-before, .skill-drop-target-after')
      .forEach((node) => {
        node.classList.remove('skill-drop-target', 'skill-drop-target-before', 'skill-drop-target-after');
        (node as HTMLElement).removeAttribute('data-skill-drop-label');
      });
  }, []);

  const updateSkillDropHover = useCallback(
    (clientX: number, clientY: number) => {
      const stack = document.elementsFromPoint(clientX, clientY);
      let terminal: HTMLElement | null = null;
      let task: HTMLElement | null = null;
      let skillCard: HTMLElement | null = null;
      const currentDragId = pointerReorderRef.current?.skillId;

      for (const node of stack) {
        if (!(node instanceof Element)) continue;
        if (!terminal) {
          const t = node.closest('.terminal-pane') as HTMLElement | null;
          if (t) terminal = t;
        }
        if (!task) {
          const c = node.closest('.task-card') as HTMLElement | null;
          if (c) task = c;
        }
        if (!skillCard && currentDragId) {
          const s = node.closest('[data-skill-card-id]') as HTMLElement | null;
          if (s && s.getAttribute('data-skill-card-id') !== currentDragId) {
            skillCard = s;
          }
        }
        if (terminal || task) break;
      }

      const next = terminal || task;
      const prev = skillDropHoverRef.current;

      // Clean up previous terminal/task drop target if target changed
      if (prev && prev !== next && prev !== skillCard) {
        prev.classList.remove('skill-drop-target', 'skill-drop-target-before', 'skill-drop-target-after');
        prev.removeAttribute('data-skill-drop-label');
      }

      // Clean up reorder insertion lines on any card other than currently hovered skillCard
      document.querySelectorAll('.skill-drop-target-before, .skill-drop-target-after').forEach((node) => {
        if (node !== skillCard) {
          node.classList.remove('skill-drop-target-before', 'skill-drop-target-after');
        }
      });

      if (next) {
        skillDropHoverRef.current = next;
        next.classList.add('skill-drop-target');
        next.setAttribute(
          'data-skill-drop-label',
          terminal ? 'Drop to paste skill path' : 'Drop to assign skill'
        );
      } else if (skillCard) {
        skillDropHoverRef.current = skillCard;
        const rect = skillCard.getBoundingClientRect();
        const isGrid = skillsListRef.current?.classList.contains('is-grid');
        let place: 'before' | 'after' = 'after';
        if (isGrid) {
          const midX = rect.left + rect.width / 2;
          place = clientX < midX ? 'before' : 'after';
        } else {
          const midY = rect.top + rect.height / 2;
          place = clientY < midY ? 'before' : 'after';
        }

        if (place === 'before') {
          skillCard.classList.remove('skill-drop-target-after');
          skillCard.classList.add('skill-drop-target-before');
        } else {
          skillCard.classList.remove('skill-drop-target-before');
          skillCard.classList.add('skill-drop-target-after');
        }
      } else {
        skillDropHoverRef.current = null;
      }
    },
    []
  );

  const finishPointerReorder = useCallback(
    (clientX?: number, clientY?: number) => {
      const drag = pointerReorderRef.current;
      pointerReorderRef.current = null;
      const hadSession = Boolean(drag || pointerListenersCleanupRef.current);
      detachPointerListeners();
      stopAutoScroll();
      clearSkillDropHover();
      if (!hadSession) return;

      const hoverEl = skillDropHoverRef.current;
      if (dragOverRaf.current) {
        cancelAnimationFrame(dragOverRaf.current);
        dragOverRaf.current = 0;
      }
      lastMoveKey.current = '';
      setScrollFrozen(false);
      setDraggingSkillId(null);

      // Drop targets — no confirm
      if (drag?.active && clientX != null && clientY != null) {
        const under = hoverEl || (document.elementFromPoint(clientX, clientY) as HTMLElement | null);
        const paneEl = under?.closest?.('.terminal-pane') as HTMLElement | null
          || (under?.classList?.contains('terminal-pane') ? under : null);
        const taskEl = under?.closest?.('.task-card') as HTMLElement | null
          || (under?.classList?.contains('task-card') ? under : null);

        const state = useDeckStore.getState();
        const skill = state.skills.find((s) => s.id === drag.skillId);
        if (!skill) return;

        if (paneEl) {
          const paneId = paneEl.getAttribute('data-pane-id');
          if (!paneId) return;
          let inactive = false;
          let title = 'terminal';
          let rootPath = '';
          for (const ws of state.workspaces) {
            const pane = ws.panes?.[paneId as keyof typeof ws.panes];
            if (pane) {
              title = pane.title || title;
              const st = pane.processStatus;
              inactive =
                st === 'restored' || st === 'exited' || st === 'crashed' || st === 'killed';
              rootPath = (ws.rootPath || '').trim();
              break;
            }
          }
          if (!rootPath) {
            const activeWs = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
            rootPath = (activeWs?.rootPath || '').trim();
          }
          if (inactive) {
            window.alert(`Please start the terminal in '${title}' before pasting skill path.`);
            return;
          }
          if (!rootPath) {
            window.alert('No workspace root path available. Open a workspace first.');
            return;
          }

          const filename = skillFilename(skill);
          const resolvedCat = resolveSkillCategory(skill);
          const catDir = resolvedCat ? resolvedCat.replace(/[/\\]+/g, '/').replace(/^\/|\/$/g, '') : '';
          const relPath = catDir ? `.claude/skills/${catDir}/${filename}` : `.claude/skills/${filename}`;
          const mdContent = skillToSkillMd(skill);
          void window.agentDeck.writeWorkspaceFile(rootPath, relPath, mdContent);

          const isWin = navigator.userAgent.includes('Windows') || rootPath.includes('\\');
          const sep = isWin ? '\\' : '/';
          const normRoot = rootPath.replace(/[/\\]+/g, sep).replace(/[/\\]$/, '');
          const catWinDir = catDir ? `${sep}${catDir.replace(/\//g, sep)}` : '';
          const fullPath = `${normRoot}${sep}.claude${sep}skills${catWinDir}${sep}${filename}`;

          const cleanPath = fullPath.replace(/^"+|"+$/g, '');
          const formattedPath = cleanPath.includes(' ') ? `"${cleanPath}"` : cleanPath;

          state.selectPane(paneId);
          const payload = `\x1b[200~${formattedPath}\x1b[201~`;
          window.agentDeck.terminalWrite(paneId, payload);
          window.dispatchEvent(new CustomEvent('agentdeck:focus-terminal', { detail: { paneId } }));
          return;
        }

        if (taskEl) {
          const taskId = taskEl.getAttribute('data-task-id');
          if (taskId) state.updateTask(taskId, { skillId: drag.skillId });
          return;
        }

        // Drop on another skill card or category header -> Reorder skills list or change category
        if (canReorderSkills) {
          const stack = document.elementsFromPoint(clientX, clientY);
          let overSkillEl: HTMLElement | null = null;
          let overHeaderEl: HTMLElement | null = null;

          for (const node of stack) {
            if (node instanceof Element) {
              const card = node.closest('[data-skill-card-id]') as HTMLElement | null;
              if (card && card.getAttribute('data-skill-card-id') !== drag.skillId) {
                overSkillEl = card;
                break;
              }
              const header = node.closest('[data-group-key]') as HTMLElement | null;
              if (header && !overHeaderEl) {
                overHeaderEl = header;
              }
            }
          }

          if (overSkillEl) {
            const targetSkillId = overSkillEl.getAttribute('data-skill-card-id');
            if (targetSkillId && targetSkillId !== drag.skillId) {
              const targetSkill = state.skills.find((s) => s.id === targetSkillId);
              if (targetSkill && targetSkill.category !== undefined) {
                state.updateSkill(drag.skillId, { category: targetSkill.category });
              }
              const rect = overSkillEl.getBoundingClientRect();
              const isGrid = skillsListRef.current?.classList.contains('is-grid');
              let place: 'before' | 'after' = 'after';
              if (isGrid) {
                const midX = rect.left + rect.width / 2;
                place = clientX < midX ? 'before' : 'after';
              } else {
                const midY = rect.top + rect.height / 2;
                place = clientY < midY ? 'before' : 'after';
              }
              moveSkill(drag.skillId, targetSkillId, place);
            }
          } else if (overHeaderEl) {
            const groupKey = overHeaderEl.getAttribute('data-group-key') || '';
            if (groupKey.startsWith('cat-')) {
              const newCategory = groupKey.slice(4);
              state.updateSkill(drag.skillId, { category: newCategory });
            } else if (groupKey === 'custom') {
              state.updateSkill(drag.skillId, { category: '' });
            }
          }
        }
      }
    },
    [canReorderSkills, clearSkillDropHover, detachPointerListeners, moveSkill, setScrollFrozen, stopAutoScroll]
  );

  // Stable refs so window listeners always call latest handlers
  const finishPointerReorderRef = useRef(finishPointerReorder);
  finishPointerReorderRef.current = finishPointerReorder;
  const updateAutoScrollFromPointerRef = useRef(updateAutoScrollFromPointer);
  updateAutoScrollFromPointerRef.current = updateAutoScrollFromPointer;
  const updateSkillDropHoverRef = useRef(updateSkillDropHover);
  updateSkillDropHoverRef.current = updateSkillDropHover;

  /** Start window-level tracking so release anywhere always ends the drag */
  const beginPointerReorderSession = useCallback(
    (skillId: string, pointerId: number, startX: number, startY: number) => {
      // End any previous stuck session cleanly
      if (pointerReorderRef.current || pointerListenersCleanupRef.current) {
        finishPointerReorderRef.current();
      }

      pointerReorderRef.current = {
        skillId,
        pointerId,
        startX,
        startY,
        active: false
      };

      const onMove = (e: PointerEvent) => {
        const drag = pointerReorderRef.current;
        if (!drag || drag.pointerId !== e.pointerId) return;

        if (!drag.active) {
          const dx = e.clientX - drag.startX;
          const dy = e.clientY - drag.startY;
          if (dx * dx + dy * dy < 36) return; // 6px threshold
          drag.active = true;
          lastMoveKey.current = '';
          gridReorderStableRef.current = { overId: '', since: 0, lastMoveAt: 0 };
          flipRectsRef.current.clear();
          setDraggingSkillId(drag.skillId);
          setScrollFrozen(true);
          document.body.classList.add('is-skill-dragging-drop');
        }

        e.preventDefault();
        updateAutoScrollFromPointerRef.current(e.clientX, e.clientY);
        updateSkillDropHoverRef.current(e.clientX, e.clientY);
      };

      const onUp = (e: PointerEvent) => {
        const drag = pointerReorderRef.current;
        if (drag && drag.pointerId !== e.pointerId) return;
        finishPointerReorderRef.current(e.clientX, e.clientY);
      };

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') finishPointerReorderRef.current();
      };

      const onBlur = () => finishPointerReorderRef.current();

      // Also catch mouseup in case pointerup is lost (Electron edge cases)
      const onMouseUp = (e: MouseEvent) => {
        if (e.button !== 0) return;
        const drag = pointerReorderRef.current;
        if (!drag) return;
        finishPointerReorderRef.current(e.clientX, e.clientY);
      };

      const opts: AddEventListenerOptions = { capture: true };
      window.addEventListener('pointermove', onMove, opts);
      window.addEventListener('pointerup', onUp, opts);
      window.addEventListener('pointercancel', onUp, opts);
      window.addEventListener('mouseup', onMouseUp, opts);
      window.addEventListener('blur', onBlur);
      window.addEventListener('keydown', onKey);

      pointerListenersCleanupRef.current = () => {
        window.removeEventListener('pointermove', onMove, opts);
        window.removeEventListener('pointerup', onUp, opts);
        window.removeEventListener('pointercancel', onUp, opts);
        window.removeEventListener('mouseup', onMouseUp, opts);
        window.removeEventListener('blur', onBlur);
        window.removeEventListener('keydown', onKey);
      };
    },
    [setScrollFrozen]
  );

  // After React commits a live reorder, re-apply owned scroll (UP was jittery without this)
  useLayoutEffect(() => {
    if (!draggingSkillId) return;
    if (autoScrollRef.current.dir === 0) return;
    const scroller = getSkillScrollParentRef.current();
    if (scroller) scroller.scrollTop = autoScrollRef.current.intendedTop;
  }, [draggingSkillId, skills]);

  // FLIP: smooth grid neighbors sliding into the hole left by the dragged card
  useLayoutEffect(() => {
    if (!draggingSkillId) {
      flipRectsRef.current.clear();
      return;
    }
    const list = skillsListRef.current;
    if (!list?.classList.contains('is-grid')) return;
    const prev = flipRectsRef.current;
    if (prev.size === 0) return;

    list.querySelectorAll('[data-skill-card-id]').forEach((node) => {
      const el = node as HTMLElement;
      const id = el.getAttribute('data-skill-card-id');
      if (!id) return;
      // Dragged placeholder stays put visually as the “hole”
      if (id === draggingSkillId) return;
      const oldRect = prev.get(id);
      if (!oldRect) return;
      const newRect = el.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: 'translate(0, 0)' }
        ],
        { duration: 170, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'both' }
      );
    });
    prev.clear();
  }, [draggingSkillId, skills]);

  useEffect(
    () => () => {
      detachPointerListeners();
      stopAutoScroll();
      setScrollFrozen(false);
      if (dragOverRaf.current) cancelAnimationFrame(dragOverRaf.current);
    },
    [detachPointerListeners, setScrollFrozen, stopAutoScroll]
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [allowedTools, setAllowedTools] = useState('');
  const [fileScope, setFileScope] = useState('');
  const [version, setVersion] = useState('1.0.0');

  const [importJson, setImportJson] = useState('');
  const [showImport, setShowImport] = useState(false);
  /** Brief per-skill export feedback (download / copy) */
  const [exportFeedback, setExportFeedback] = useState<{ id: string; message: string } | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const exportFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashExportFeedback = (id: string, message: string) => {
    if (exportFeedbackTimer.current) clearTimeout(exportFeedbackTimer.current);
    setExportFeedback({ id, message });
    exportFeedbackTimer.current = setTimeout(() => {
      setExportFeedback(null);
      exportFeedbackTimer.current = null;
    }, 2200);
  };

  /** kebab-case id used by agent skill folders / frontmatter `name` */
  const skillSlug = (skill: Skill) =>
    skill.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'skill';

  /**
   * Standard agent skill format (Claude Code / Cursor / Grok …):
   * YAML frontmatter + markdown body — not AgentDeck-only JSON.
   */
  const skillToSkillMd = (skill: Skill) => {
    const slug = skillSlug(skill);
    const desc = (skill.description || skill.name).trim() || skill.name;
    // Fold description for YAML `>` block
    const descLines = desc
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const descBlock =
      descLines.length <= 1
        ? `description: ${JSON.stringify(desc)}`
        : ['description: >', ...descLines.map((l) => `  ${l}`)].join('\n');

    const extra: string[] = [];
    if (skill.version?.trim()) extra.push(`version: ${JSON.stringify(skill.version.trim())}`);
    if (skill.allowedTools?.trim()) extra.push(`allowed-tools: ${JSON.stringify(skill.allowedTools.trim())}`);
    if (skill.fileScope?.trim()) extra.push(`file-scope: ${JSON.stringify(skill.fileScope.trim())}`);
    if (skill.category?.trim()) extra.push(`category: ${JSON.stringify(skill.category.trim())}`);
    // Keep human title for round-trip into AgentDeck UI
    extra.push(`metadata: ${JSON.stringify({ displayName: skill.name, source: 'agentdeck' })}`);

    const body = (skill.promptTemplate || '').trim() || `# ${skill.name}\n\n(No instructions yet.)`;

    return [
      '---',
      `name: ${slug}`,
      descBlock,
      ...extra,
      '---',
      '',
      body.startsWith('#') ? body : `# ${skill.name}\n\n${body}`,
      ''
    ].join('\n');
  };

  const skillFilename = (skill: Skill) => `${skillSlug(skill)}.SKILL.md`;

  /** Parse simple YAML frontmatter value (quoted / bare / folded block handled upstream) */
  const parseFrontmatterBlock = (fm: string): Record<string, string> => {
    const out: Record<string, string> = {};
    const lines = fm.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!m) {
        i += 1;
        continue;
      }
      const key = m[1];
      let val = m[2].trim();
      if (val === '>' || val === '|') {
        const block: string[] = [];
        i += 1;
        while (i < lines.length) {
          const next = lines[i];
          if (/^[A-Za-z0-9_-]+:\s*/.test(next) && !/^\s/.test(next)) break;
          block.push(next.replace(/^\s{2}/, ''));
          i += 1;
        }
        out[key] = block.join('\n').trim();
        continue;
      }
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        try {
          val = JSON.parse(val.replace(/^'/, '"').replace(/'$/, '"'));
        } catch {
          val = val.slice(1, -1);
        }
      }
      out[key] = val;
      i += 1;
    }
    return out;
  };

  const parseSkillMd = (raw: string) => {
    const text = raw.replace(/^\uFEFF/, '').trim();
    const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (fmMatch) {
      const fm = parseFrontmatterBlock(fmMatch[1]);
      const body = (fmMatch[2] || '').trim();
      let name =
        (fm['metadata'] && (() => {
          try {
            const meta = JSON.parse(fm['metadata']) as { displayName?: string };
            return meta.displayName?.trim() || '';
          } catch {
            return '';
          }
        })()) ||
        fm.name?.trim() ||
        fm.title?.trim() ||
        '';

      if (!name) {
        const h1Match = body.match(/^#\s+(.+)$/m);
        if (h1Match) name = h1Match[1].trim();
      }

      const description = (fm.description || fm.desc || fm.summary || '').trim();
      const promptTemplate = body || description;

      if (!name) {
        throw new Error('SKILL.md frontmatter requires "name" or a "# Title" header.');
      }
      if (!promptTemplate) {
        throw new Error('SKILL.md body (instructions) is empty.');
      }

      return {
        name,
        description: description || `Skill: ${name}`,
        promptTemplate,
        allowedTools: (fm['allowed-tools'] || fm.allowedTools || fm.tools || '').trim(),
        fileScope: (fm['file-scope'] || fm.fileScope || fm.scope || '').trim(),
        version: (fm.version || '1.0.0').trim(),
        category: (fm.category || fm.group || fm.folder || '').trim() || undefined
      };
    }

    // Markdown without frontmatter ---
    const lines = text.split(/\r?\n/);
    let name = '';
    let description = '';
    for (const line of lines) {
      if (!name && line.startsWith('# ')) {
        name = line.replace(/^#\s+/, '').trim();
        continue;
      }
      if (name && !description && line.trim() && !line.startsWith('#')) {
        description = line.trim();
        break;
      }
    }

    if (!name) {
      const firstLine = lines.find((l) => l.trim());
      name = firstLine ? firstLine.replace(/^#+\s*/, '').trim() : 'Imported Skill';
    }

    return {
      name,
      description: description || `Skill: ${name}`,
      promptTemplate: text,
      allowedTools: '',
      fileScope: '',
      version: '1.0.0'
    };
  };

  const pinnedSet = useMemo(() => new Set(pinnedSkillIds), [pinnedSkillIds]);

  const skillCounts = useMemo(() => {
    let system = 0;
    let custom = 0;
    let pinned = 0;
    for (const s of skills) {
      if (s.isSystem) system += 1;
      else custom += 1;
      if (pinnedSet.has(s.id)) pinned += 1;
    }
    return { all: skills.length, system, custom, pinned };
  }, [skills, pinnedSet]);

  const filteredSkills = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = skills.filter((s) => {
      if (skillFilter === 'system' && !s.isSystem) return false;
      if (skillFilter === 'custom' && s.isSystem) return false;
      if (skillFilter === 'pinned' && !pinnedSet.has(s.id)) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.promptTemplate.toLowerCase().includes(q) ||
        s.allowedTools.toLowerCase().includes(q) ||
        s.fileScope.toLowerCase().includes(q)
      );
    });

    const byName = (a: Skill, b: Skill) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    const byUpdated = (a: Skill, b: Skill) => (b.updatedAt || 0) - (a.updatedAt || 0);

    if (skillSort !== 'default') {
      list = [...list].sort((a, b) => {
        switch (skillSort) {
          case 'name-desc':
            return byName(b, a);
          case 'updated-desc':
            return byUpdated(a, b) || byName(a, b);
          case 'updated-asc':
            return -byUpdated(a, b) || byName(a, b);
          case 'type':
            if (a.isSystem !== b.isSystem) return a.isSystem ? 1 : -1;
            return byName(a, b);
          case 'name-asc':
            return byName(a, b);
          default:
            return 0;
        }
      });
    }
    // else: preserve skills array order

    // Favorites always float to top (pinnedSkillIds order, then store order among unpinned)
    if (pinnedSkillIds.length > 0 && skillFilter !== 'pinned') {
      const pinRank = new Map(pinnedSkillIds.map((id, i) => [id, i]));
      const top: Skill[] = [];
      const rest: Skill[] = [];
      for (const s of list) {
        if (pinRank.has(s.id)) top.push(s);
        else rest.push(s);
      }
      top.sort((a, b) => (pinRank.get(a.id) ?? 0) - (pinRank.get(b.id) ?? 0));
      list = [...top, ...rest];
    } else if (skillFilter === 'pinned' && pinnedSkillIds.length > 0) {
      const pinRank = new Map(pinnedSkillIds.map((id, i) => [id, i]));
      list = [...list].sort((a, b) => (pinRank.get(a.id) ?? 0) - (pinRank.get(b.id) ?? 0));
    }

    return list;
  }, [skills, searchQuery, skillFilter, skillSort, pinnedSkillIds, pinnedSet]);

  /** Sectioned view when browsing everything in default order (not while searching) */
  const showSkillGroups =
    (skillFilter === 'all' || skillFilter === 'custom') && !searchQuery.trim() && skillSort === 'default' && filteredSkills.length > 0;

  type SkillListEntry =
    | { kind: 'header'; key: string; label: string; count: number; depth?: number; folderPath?: string }
    | { kind: 'skill'; key: string; skill: Skill; depth?: number };

  const resolveSkillCategory = (s: Skill): string => {
    if (s.category && s.category.trim()) {
      return s.category.trim();
    }
    return '';
  };

  const skillListEntries = useMemo((): SkillListEntry[] => {
    if (!showSkillGroups) {
      return filteredSkills.map((skill) => ({ kind: 'skill' as const, key: skill.id, skill }));
    }
    const entries: SkillListEntry[] = [];
    const pinned: Skill[] = [];
    const system: Skill[] = [];
    const custom: Skill[] = [];
    for (const s of filteredSkills) {
      if (pinnedSet.has(s.id)) pinned.push(s);
      else if (s.isSystem) system.push(s);
      else custom.push(s);
    }
    const pushGroup = (key: string, label: string, items: Skill[]) => {
      if (items.length === 0) return;
      entries.push({ kind: 'header', key, label, count: items.length });
      if (isGroupCollapsed(key)) return;
      for (const skill of items) {
        entries.push({ kind: 'skill', key: skill.id, skill });
      }
    };
    pushGroup('pinned', '📌 Pinned', pinned);
    pushGroup('system', '⚡ System', system);

    // Group custom skills by multi-level folder tree
    interface FolderTreeNode {
      fullPath: string;
      segmentName: string;
      depth: number;
      skills: Skill[];
      children: Map<string, FolderTreeNode>;
    }

    const rootFolderNodes = new Map<string, FolderTreeNode>();
    const uncategorized: Skill[] = [];

    const getOrCreateFolderNode = (folderPath: string): FolderTreeNode => {
      const normalized = folderPath.replace(/\\+/g, '/').replace(/^\/|\/$/g, '');
      const parts = normalized.split('/').filter(Boolean);
      let currentMap = rootFolderNodes;
      let currentPath = '';
      let currentNode: FolderTreeNode | null = null;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!currentMap.has(part)) {
          const newNode: FolderTreeNode = {
            fullPath: currentPath,
            segmentName: part,
            depth: i,
            skills: [],
            children: new Map()
          };
          currentMap.set(part, newNode);
        }
        currentNode = currentMap.get(part)!;
        currentMap = currentNode.children;
      }
      return currentNode!;
    };

    for (const folder of customFolders) {
      if (folder && folder.trim()) {
        getOrCreateFolderNode(folder.trim());
      }
    }

    for (const s of custom) {
      const cat = resolveSkillCategory(s);
      if (cat) {
        const node = getOrCreateFolderNode(cat);
        node.skills.push(s);
      } else {
        uncategorized.push(s);
      }
    }

    const traverseFolderNode = (node: FolderTreeNode, parentCollapsed: boolean) => {
      const groupKey = `cat-${node.fullPath}`;
      const selfCollapsed = isGroupCollapsed(groupKey);
      const isCollapsed = parentCollapsed || selfCollapsed;

      const countTotalSkills = (n: FolderTreeNode): number => {
        let sum = n.skills.length;
        for (const child of n.children.values()) {
          sum += countTotalSkills(child);
        }
        return sum;
      };

      const totalCount = countTotalSkills(node);

      if (!parentCollapsed) {
        entries.push({
          kind: 'header',
          key: groupKey,
          label: node.segmentName,
          count: totalCount,
          depth: node.depth,
          folderPath: node.fullPath
        });
      }

      if (!isCollapsed) {
        for (const skill of node.skills) {
          entries.push({ kind: 'skill', key: skill.id, skill, depth: node.depth + 1 });
        }

        const sortedChildren = Array.from(node.children.values()).sort((a, b) =>
          a.segmentName.localeCompare(b.segmentName, undefined, { numeric: true, sensitivity: 'base' })
        );
        for (const child of sortedChildren) {
          traverseFolderNode(child, isCollapsed);
        }
      }
    };

    const sortedRoots = Array.from(rootFolderNodes.values()).sort((a, b) =>
      a.segmentName.localeCompare(b.segmentName, undefined, { numeric: true, sensitivity: 'base' })
    );

    for (const rootNode of sortedRoots) {
      traverseFolderNode(rootNode, false);
    }

    if (uncategorized.length > 0) {
      const label = rootFolderNodes.size > 0 ? 'General' : 'Custom';
      pushGroup('custom', label, uncategorized);
    }

    return entries;
  }, [showSkillGroups, filteredSkills, pinnedSet, collapsedSkillGroups, isGroupCollapsed, customFolders]);

  // ── Virtual window (only when many skills; disabled while reordering for hit-tests) ──
  const [skillScrollTop, setSkillScrollTop] = useState(0);
  const [skillViewport, setSkillViewport] = useState({ w: 0, h: 0 });
  const skillCountForVirtual = skillListEntries.filter((e) => e.kind === 'skill').length;
  const virtualEnabled =
    skillCountForVirtual >= SKILL_VIRTUAL_THRESHOLD && !draggingSkillId && !showSkillGroups;

  useEffect(() => {
    const el = skillsListRef.current;
    if (!el) return;
    const onScroll = () => setSkillScrollTop(el.scrollTop);
    const ro = new ResizeObserver(() => {
      setSkillViewport({ w: el.clientWidth, h: el.clientHeight });
    });
    el.addEventListener('scroll', onScroll, { passive: true });
    ro.observe(el);
    setSkillViewport({ w: el.clientWidth, h: el.clientHeight });
    setSkillScrollTop(el.scrollTop);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [skillLayout, filteredSkills.length]);

  const skillVirtual = useMemo(() => {
    const n = skillListEntries.length;
    if (!virtualEnabled || n === 0) {
      return { active: false, start: 0, end: n, padTop: 0, padBottom: 0, cols: 1 };
    }
    const isGrid = skillLayout === 'grid';
    const gap = isGrid ? 6 : 10;
    const scrollTop = skillScrollTop;
    const viewH = Math.max(skillViewport.h, 200);
    const viewW = Math.max(skillViewport.w, 200);

    if (isGrid) {
      const minCol = 118;
      const cols = Math.max(1, Math.floor((viewW + gap) / (minCol + gap)));
      const rowH = 32 + gap;
      const rows = Math.ceil(n / cols);
      const startRow = Math.max(0, Math.floor(scrollTop / rowH) - 2);
      const visibleRows = Math.ceil(viewH / rowH) + 5;
      const endRow = Math.min(rows, startRow + visibleRows);
      return {
        active: true,
        start: startRow * cols,
        end: Math.min(n, endRow * cols),
        padTop: startRow * rowH,
        padBottom: Math.max(0, (rows - endRow) * rowH),
        cols
      };
    }

    // List cards — estimated height (content-visibility still helps residual cost)
    const itemH = 148 + gap;
    const start = Math.max(0, Math.floor(scrollTop / itemH) - 2);
    const visible = Math.ceil(viewH / itemH) + 5;
    const end = Math.min(n, start + visible);
    return {
      active: true,
      start,
      end,
      padTop: start * itemH,
      padBottom: Math.max(0, (n - end) * itemH),
      cols: 1
    };
  }, [
    virtualEnabled,
    skillListEntries.length,
    skillLayout,
    skillScrollTop,
    skillViewport.h,
    skillViewport.w
  ]);

  const visibleSkillEntries = useMemo(() => {
    if (!skillVirtual.active) return skillListEntries;
    return skillListEntries.slice(skillVirtual.start, skillVirtual.end);
  }, [skillListEntries, skillVirtual]);

  const [category, setCategory] = useState('');

  const categorySuggestions = useMemo(() => {
    const existingCategories = new Set<string>(customFolders);
    for (const s of skills) {
      if (s.category && s.category.trim()) {
        existingCategories.add(s.category.trim());
      }
    }
    return Array.from(existingCategories).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [skills, customFolders]);

  const handleCreate = () => {
    if (!name.trim() || !promptTemplate.trim()) {
      alert('Name and Prompt Template are required.');
      return;
    }
    createSkill({
      name,
      description,
      promptTemplate,
      allowedTools,
      fileScope,
      version,
      category: category.trim() || undefined
    });
    setName('');
    setDescription('');
    setPromptTemplate('');
    setAllowedTools('');
    setFileScope('');
    setVersion('1.0.0');
    setCategory('');
    setIsCreating(false);
  };

  const handleStartEdit = (skill: Skill) => {
    if (skill.isSystem) return;
    setEditingSkillId(skill.id);
    setName(skill.name);
    setDescription(skill.description);
    setPromptTemplate(skill.promptTemplate);
    setAllowedTools(skill.allowedTools);
    setFileScope(skill.fileScope);
    setVersion(skill.version);
    setCategory(skill.category || '');
  };

  const handleSaveEdit = () => {
    if (!editingSkillId) return;
    if (!name.trim() || !promptTemplate.trim()) {
      alert('Name and Prompt Template are required.');
      return;
    }
    updateSkill(editingSkillId, {
      name,
      description,
      promptTemplate,
      allowedTools,
      fileScope,
      version,
      category: category.trim() || undefined
    });
    setEditingSkillId(null);
    setName('');
    setDescription('');
    setPromptTemplate('');
    setAllowedTools('');
    setFileScope('');
    setVersion('1.0.0');
    setCategory('');
  };

  const handleCancelEdit = () => {
    setEditingSkillId(null);
    setName('');
    setDescription('');
    setPromptTemplate('');
    setAllowedTools('');
    setFileScope('');
    setVersion('1.0.0');
    setCategory('');
  };

  useEffect(() => {
    if (!confirmDeleteSkillId && !confirmDeleteAll) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (confirmDeleteSkillId && t?.closest?.(`[data-skill-delete="${confirmDeleteSkillId}"]`)) return;
      if (confirmDeleteAll && t?.closest?.('[data-delete-all-wrapper]')) return;
      setConfirmDeleteSkillId(null);
      setConfirmDeleteAll(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmDeleteSkillId(null);
        setConfirmDeleteAll(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [confirmDeleteSkillId, confirmDeleteAll]);

  const handleDeleteSkillClick = (skillId: string) => {
    if (confirmDeleteSkillId === skillId) {
      deleteSkill(skillId);
      setConfirmDeleteSkillId(null);
      if (editingSkillId === skillId) handleCancelEdit();
      return;
    }
    setConfirmDeleteSkillId(skillId);
  };

  const parseSingleSkillJson = (body: Record<string, unknown>) => {
    const name =
      (typeof body.name === 'string' && body.name.trim()) ||
      (typeof body.title === 'string' && body.title.trim()) ||
      (typeof body.displayName === 'string' && body.displayName.trim()) ||
      '';

    const promptTemplate =
      (typeof body.promptTemplate === 'string' && body.promptTemplate) ||
      (typeof body.prompt === 'string' && body.prompt) ||
      (typeof body.instructions === 'string' && body.instructions) ||
      (typeof body.content === 'string' && body.content) ||
      (typeof body.body === 'string' && body.body) ||
      (typeof body.template === 'string' && body.template) ||
      '';

    if (!name || !promptTemplate.trim()) {
      throw new Error('Invalid skill JSON. Fields "name" (or "title") and "promptTemplate" (or "instructions"/"prompt"/"content") are required.');
    }

    return {
      name,
      description:
        (typeof body.description === 'string' && body.description) ||
        (typeof body.desc === 'string' && body.desc) ||
        (typeof body.summary === 'string' && body.summary) ||
        `Skill: ${name}`,
      promptTemplate,
      allowedTools:
        (typeof body.allowedTools === 'string' && body.allowedTools) ||
        (typeof body['allowed-tools'] === 'string' && body['allowed-tools']) ||
        (typeof body.tools === 'string' && body.tools) ||
        '',
      fileScope:
        (typeof body.fileScope === 'string' && body.fileScope) ||
        (typeof body['file-scope'] === 'string' && body['file-scope']) ||
        (typeof body.scope === 'string' && body.scope) ||
        '',
      version: typeof body.version === 'string' && body.version.trim() ? body.version.trim() : '1.0.0',
      category:
        (typeof body.category === 'string' && body.category.trim()) ||
        (typeof body.group === 'string' && body.group.trim()) ||
        undefined
    };
  };

  const parseSkillImport = (raw: string) => {
    const text = raw.replace(/^\uFEFF/, '').trim();
    if (!text) throw new Error('Empty skill content.');

    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          return parsed.map((item: unknown) => parseSingleSkillJson(item as Record<string, unknown>));
        }
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.skills)) {
            return parsed.skills.map((item: unknown) => parseSingleSkillJson(item as Record<string, unknown>));
          }
          const body = (parsed.kind === 'agentdeck-skill' ? parsed : parsed) as Record<string, unknown>;
          return [parseSingleSkillJson(body)];
        }
      } catch (e) {
        if (text.startsWith('{') || text.startsWith('[')) {
          throw new Error(`Invalid JSON skill format: ${e instanceof Error ? e.message : 'JSON parse failed'}`);
        }
      }
    }

    return [parseSkillMd(text)];
  };

  const handleImportFolder = async () => {
    try {
      const folderPath = await window.agentDeck.selectWorkspaceFolder();
      if (!folderPath) return;

      const imported: Skill[] = [];
      const rootFolderName = folderPath.replace(/[/\\]+$/, '').split(/[/\\]+/).pop() || '';
      const isRootCategory = rootFolderName && !['skills', 'custom-skills', 'claude-skills'].includes(rootFolderName.toLowerCase());

      const scanDir = async (dir: string, baseRel: string = '') => {
        const res = await window.agentDeck.readDir(dir);
        const entries =
          res && typeof res === 'object' && 'data' in res && Array.isArray(res.data)
            ? res.data
            : Array.isArray(res)
              ? res
              : [];
        for (const entry of entries) {
          if (entry.isDirectory) {
            const subRel = baseRel ? `${baseRel}/${entry.name}` : entry.name;
            await scanDir(entry.path, subRel);
          } else if (entry.name.endsWith('.md') || entry.name.endsWith('.json')) {
            try {
              const fileRes = await window.agentDeck.readWorkspaceFile(dir, entry.name);
              const raw =
                fileRes && typeof fileRes === 'object' && 'data' in fileRes && typeof (fileRes as any).data === 'string'
                  ? (fileRes as any).data
                  : typeof fileRes === 'string'
                    ? fileRes
                    : '';
              if (!raw) continue;
              const parsedList = parseSkillImport(raw);
              for (const item of parsedList) {
                const fallbackCategory = baseRel || (isRootCategory ? rootFolderName : undefined);
                const skillCategory = item.category || fallbackCategory || undefined;
                imported.push({
                  ...item,
                  id: `skill-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  category: skillCategory,
                  isSystem: false,
                  updatedAt: Date.now()
                });
              }
            } catch {
              // Ignore unparseable files
            }
          }
        }
      };

      await scanDir(folderPath);

      if (imported.length === 0) {
        alert('No valid SKILL.md or JSON files found in selected folder.');
        return;
      }

      for (const sk of imported) {
        createSkill(sk);
      }
      setShowImport(false);
      alert(`Successfully imported ${imported.length} skills from folder!`);
    } catch (err) {
      alert(`Import folder failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /** Export as standard SKILL.md (agent-native). Optional clipboard copy of same text. */
  const handleExport = async (skill: Skill, mode: 'file' | 'clipboard' = 'file') => {
    const md = skillToSkillMd(skill);

    if (mode === 'clipboard') {
      try {
        const res = await window.agentDeck.clipboardWriteText(md);
        if (res && 'ok' in res && !res.ok) throw new Error('clipboard failed');
        flashExportFeedback(skill.id, 'SKILL.md copied');
      } catch {
        try {
          await navigator.clipboard.writeText(md);
          flashExportFeedback(skill.id, 'SKILL.md copied');
        } catch {
          flashExportFeedback(skill.id, 'Copy failed');
        }
      }
      return;
    }

    try {
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = skillFilename(skill);
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flashExportFeedback(skill.id, 'SKILL.md saved');
    } catch {
      try {
        await navigator.clipboard.writeText(md);
        flashExportFeedback(skill.id, 'Copied (download blocked)');
      } catch {
        flashExportFeedback(skill.id, 'Export failed');
      }
    }
  };

  const handleImport = (raw?: string) => {
    try {
      const drafts = parseSkillImport(raw ?? importJson);
      if (drafts.length === 0) throw new Error('No valid skills found to import.');
      for (const draft of drafts) {
        createSkill(draft);
      }
      setImportJson('');
      setShowImport(false);
      setSkillFilter('all');
      setSkillSort('default');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to import skill.';
      window.alert(msg);
    }
  };

  const handleImportFiles = (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    let importedCount = 0;
    const errors: string[] = [];

    const promises = fileArray.map(
      (file) =>
        new Promise<void>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const text = typeof reader.result === 'string' ? reader.result : '';
              const drafts = parseSkillImport(text);
              for (const draft of drafts) {
                createSkill(draft);
                importedCount++;
              }
            } catch (err) {
              errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Import failed'}`);
            }
            resolve();
          };
          reader.onerror = () => {
            errors.push(`${file.name}: Failed to read file`);
            resolve();
          };
          reader.readAsText(file);
        })
    );

    Promise.all(promises).then(() => {
      if (importedCount > 0) {
        setImportJson('');
        setShowImport(false);
        setSkillFilter('all');
        setSkillSort('default');
      }
      if (errors.length > 0) {
        window.alert(`Import results:\nImported ${importedCount} skill(s).\n\nErrors:\n${errors.join('\n')}`);
      }
    });
  };

  const handleDeleteAllCustomSkills = () => {
    const customCount = skills.filter((s) => !s.isSystem).length;
    if (customCount === 0) {
      window.alert('No custom skills to delete.');
      return;
    }
    if (confirmDeleteAll) {
      useDeckStore.getState().deleteAllCustomSkills();
      setConfirmDeleteAll(false);
      return;
    }
    setConfirmDeleteAll(true);
    setConfirmDeleteSkillId(null);
  };

  return (
    <div
      className="skills-panel"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          handleImportFiles(e.dataTransfer.files);
        }
      }}
    >
      <div className="panel-actions-row">
        <button className="primary-btn" onClick={() => { setIsCreating(!isCreating); handleCancelEdit(); }}>
          {isCreating ? 'Cancel' : 'Add'}
        </button>
        <button
          type="button"
          className={showCreateFolder ? 'primary-btn' : ''}
          onClick={() => setShowCreateFolder(!showCreateFolder)}
          title="Tạo thư mục mới để quản lý skills"
        >
          {showCreateFolder ? 'Cancel' : '+ Folder'}
        </button>
        <button onClick={() => setShowImport(!showImport)}>
          {showImport ? 'Cancel' : 'Import'}
        </button>
        {!confirmDeleteAll ? (
          <button
            type="button"
            style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5' }}
            onClick={handleDeleteAllCustomSkills}
            title="Delete all custom skills"
          >
            Del All
          </button>
        ) : (
          <div data-delete-all-wrapper className="inline-confirm-delete-group" style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-confirm-cancel"
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px'
              }}
              onClick={() => setConfirmDeleteAll(false)}
              title="Cancel"
            >
              Không
            </button>
            <button
              type="button"
              className="btn-confirm-ok"
              style={{
                padding: '3px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer'
              }}
              onClick={handleDeleteAllCustomSkills}
              title="Click OK to confirm delete all custom skills"
            >
              OK
            </button>
          </div>
        )}
      </div>

      {showCreateFolder && (
        <div
          className="create-folder-panel"
          style={{
            padding: '8px 10px',
            margin: '6px 0',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            borderRadius: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            <span>Tạo Thư Mục Mới</span>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              placeholder="Tên thư mục (ví dụ: 10. DEPLOYMENT hoặc Custom Folder)..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCreateFolder();
                if (e.key === 'Escape') setShowCreateFolder(false);
              }}
              autoFocus
              style={{
                flex: 1,
                padding: '4px 8px',
                background: '#141414',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '4px',
                color: '#f4f4f5',
                fontSize: '12px',
                outline: 'none'
              }}
            />
            <button
              type="button"
              className="primary-btn"
              onClick={submitCreateFolder}
              style={{ padding: '4px 10px', fontSize: '11px' }}
            >
              Tạo
            </button>
            <button
              type="button"
              onClick={() => setShowCreateFolder(false)}
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {isCreating && (
        <div
          className="skill-composer"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <h3>Create Custom Skill</h3>
          <label className="skill-field">
            <span className="skill-field-label">Name (display)</span>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. API Tester → exports as api-tester"
              spellCheck={false}
            />
          </label>
          <label className="skill-field">
            <span className="skill-field-label">Description (when to use — SKILL.md frontmatter)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When the agent should load this skill…"
              rows={2}
            />
          </label>
          <label className="skill-field">
            <span className="skill-field-label">Instructions (SKILL.md body)</span>
            <textarea
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              placeholder="# Title&#10;&#10;Workflow, rules, examples…"
              rows={5}
            />
          </label>
          <label className="skill-field">
            <span className="skill-field-label">Version (optional)</span>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
              spellCheck={false}
            />
          </label>
          <label className="skill-field">
            <span className="skill-field-label">Allowed tools (optional, AgentDeck)</span>
            <input
              type="text"
              value={allowedTools}
              onChange={(e) => setAllowedTools(e.target.value)}
              placeholder="e.g. grep, file_view, git"
              spellCheck={false}
            />
          </label>
          <label className="skill-field">
            <span className="skill-field-label">Category / Folder (optional)</span>
            <CategoryCombobox
              value={category}
              onChange={setCategory}
              options={categorySuggestions}
              placeholder="Chọn hoặc gõ danh mục (ví dụ: 1. Business, 4. Development...)"
            />
          </label>
          <label className="skill-field">
            <span className="skill-field-label">File scope (optional, AgentDeck)</span>
            <input
              type="text"
              value={fileScope}
              onChange={(e) => setFileScope(e.target.value)}
              placeholder="e.g. src/**/*"
              spellCheck={false}
            />
          </label>
          <button type="button" className="submit-btn" onClick={handleCreate}>
            Save Skill
          </button>
        </div>
      )}

      {showImport && (
        <div
          className="skill-composer"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <h3>Import Skill</h3>
          <p className="skill-import-hint">
            Standard agent format: <code>SKILL.md</code> (YAML frontmatter + markdown body), same as Claude Code /
            Cursor / Grok skills. Legacy AgentDeck JSON still works.
          </p>
          <input
            ref={importFileRef}
            type="file"
            multiple
            accept=".md,.markdown,.json,.skill.json,text/markdown,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              handleImportFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <div className="skill-import-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <button
              type="button"
              className="skill-import-file-btn"
              onClick={() => importFileRef.current?.click()}
            >
              Choose SKILL.md or JSON…
            </button>
            <button
              type="button"
              className="skill-import-file-btn"
              style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: '#38bdf8', color: '#bae6fd' }}
              onClick={handleImportFolder}
            >
              Sync / Import Folder (Obsidian / Categories)…
            </button>
          </div>
          <label className="skill-field">
            <span className="skill-field-label">Or paste SKILL.md / JSON</span>
            <textarea
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder={'---\nname: my-skill\ndescription: When to use…\n---\n\n# Instructions\n…'}
              rows={6}
              spellCheck={false}
            />
          </label>
          <button type="button" className="submit-btn" onClick={() => handleImport()} disabled={!importJson.trim()}>
            Import from paste
          </button>
        </div>
      )}

      {editingSkillId && (
        <div
          className="skill-composer"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <h3>Edit Custom Skill</h3>
          <label className="skill-field">
            <span className="skill-field-label">Name (display)</span>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Skill name"
              spellCheck={false}
            />
          </label>
          <label className="skill-field">
            <span className="skill-field-label">Description (when to use)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When the agent should load this skill…"
              rows={2}
            />
          </label>
          <label className="skill-field">
            <span className="skill-field-label">Instructions (SKILL.md body)</span>
            <textarea
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              placeholder="Markdown instructions…"
              rows={5}
            />
          </label>
          <label className="skill-field">
            <span className="skill-field-label">Version (optional)</span>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
              spellCheck={false}
            />
          </label>
          <label className="skill-field">
            <span className="skill-field-label">Allowed tools (optional)</span>
            <input
              type="text"
              value={allowedTools}
              onChange={(e) => setAllowedTools(e.target.value)}
              placeholder="Allowed tools"
              spellCheck={false}
            />
          </label>
          <label className="skill-field">
            <span className="skill-field-label">Category / Folder (optional)</span>
            <CategoryCombobox
              value={category}
              onChange={setCategory}
              options={categorySuggestions}
              placeholder="Chọn hoặc gõ danh mục (ví dụ: 1. Business, 4. Development...)"
            />
          </label>
          <label className="skill-field">
            <span className="skill-field-label">File scope (optional)</span>
            <input
              type="text"
              value={fileScope}
              onChange={(e) => setFileScope(e.target.value)}
              placeholder="File scope"
              spellCheck={false}
            />
          </label>
          <div className="composer-actions">
            <button type="button" className="submit-btn" onClick={handleSaveEdit}>
              Save Changes
            </button>
            <button type="button" className="cancel-btn" onClick={handleCancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="skill-toolbar">
        <div className="skill-search">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search skills..."
            spellCheck={false}
          />
        </div>

        <div className="skill-filter-row" role="group" aria-label="Filter skills">
          {(
            [
              { id: 'all' as const, label: 'All', count: skillCounts.all },
              { id: 'pinned' as const, label: 'Pinned', count: skillCounts.pinned },
              { id: 'system' as const, label: 'System', count: skillCounts.system },
              { id: 'custom' as const, label: 'Custom', count: skillCounts.custom }
            ]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              className={`skill-filter-chip${skillFilter === f.id ? ' is-active' : ''}${
                f.id === 'pinned' ? ' is-pinned-filter' : ''
              }`}
              onClick={() => setSkillFilter(f.id)}
            >
              {f.label}
              <span className="skill-filter-count">{f.count}</span>
            </button>
          ))}
        </div>

        <div className="skill-sort-row">
          <span className="skill-sort-label" id="skill-sort-label">
            Sort
          </span>
          <CustomSelect
            className="skill-sort-select"
            aria-label="Sort skills"
            capitalize={false}
            value={skillSort}
            onChange={(v) => setSkillSort(v as typeof skillSort)}
            options={[
              { value: 'default', label: 'Default order' },
              { value: 'name-asc', label: 'Name A–Z' },
              { value: 'name-desc', label: 'Name Z–A' },
              { value: 'updated-desc', label: 'Recently updated' },
              { value: 'updated-asc', label: 'Oldest updated' },
              { value: 'type', label: 'Type (Custom first)' }
            ]}
          />
          <div className="skill-layout-toggle" role="group" aria-label="Skills layout">
            <button
              type="button"
              className={`skill-layout-btn${skillLayout === 'list' ? ' is-active' : ''}`}
              title="List view"
              aria-pressed={skillLayout === 'list'}
              onClick={() => setSkillLayout('list')}
            >
              <span className="skill-layout-icon skill-layout-icon-list" aria-hidden>
                <span />
                <span />
                <span />
              </span>
            </button>
            <button
              type="button"
              className={`skill-layout-btn${skillLayout === 'grid' ? ' is-active' : ''}`}
              title="Grid view"
              aria-pressed={skillLayout === 'grid'}
              onClick={() => setSkillLayout('grid')}
            >
              <span className="skill-layout-icon skill-layout-icon-grid" aria-hidden>
                <span />
                <span />
                <span />
                <span />
              </span>
            </button>
          </div>
        </div>
      </div>

      <div
        ref={skillsListRef}
        className={`skills-list${skillLayout === 'grid' ? ' is-grid' : ''}${
          draggingSkillId ? ' is-reordering' : ''
        }${skillVirtual.active ? ' is-virtualized' : ''}`}
      >
        {filteredSkills.length === 0 ? (
          <p className="muted">
            {skills.length === 0
              ? 'No skills yet. Add a custom skill or import one.'
              : skillFilter === 'pinned'
                ? 'No pinned skills. Star a skill to pin it here.'
                : 'No skills match your search or filter.'}
          </p>
        ) : (
          <>
            {skillVirtual.active && skillVirtual.padTop > 0 ? (
              <div
                className="skills-virtual-spacer"
                style={{ height: skillVirtual.padTop }}
                aria-hidden
              />
            ) : null}
            {visibleSkillEntries.map((entry) => {
              if (entry.kind === 'header') {
                const collapsed = isGroupCollapsed(entry.key);
                const isCat = entry.key.startsWith('cat-');
                const catFolderName = isCat ? (entry.folderPath || entry.key.slice(4)) : '';
                const depth = entry.depth || 0;

                if (isCat && editingFolderName === catFolderName) {
                  return (
                    <div
                      key={entry.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        margin: '4px 0',
                        padding: '4px 8px',
                        marginLeft: `${depth * 16}px`,
                        background: 'rgba(56, 189, 248, 0.08)',
                        borderRadius: '6px',
                        border: '1px solid rgba(56, 189, 248, 0.3)'
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      <input
                        type="text"
                        value={renameInputValue}
                        onChange={(e) => setRenameInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitRenameFolder(catFolderName);
                          if (e.key === 'Escape') setEditingFolderName(null);
                        }}
                        autoFocus
                        style={{
                          flex: 1,
                          padding: '3px 8px',
                          background: '#141414',
                          border: '1px solid #38bdf8',
                          borderRadius: '4px',
                          color: '#f4f4f5',
                          fontSize: '12px',
                          outline: 'none'
                        }}
                      />
                      <button
                        type="button"
                        className="primary-btn"
                        style={{ padding: '3px 10px', fontSize: '11px' }}
                        onClick={() => submitRenameFolder(catFolderName)}
                      >
                        Lưu
                      </button>
                      <button
                        type="button"
                        style={{ padding: '3px 8px', fontSize: '11px' }}
                        onClick={() => setEditingFolderName(null)}
                      >
                        Hủy
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={entry.key}
                    className="skill-group-header-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      gap: '4px',
                      marginTop: '4px',
                      marginBottom: '2px',
                      paddingLeft: `${depth * 16}px`
                    }}
                  >
                    <button
                      data-group-key={entry.key}
                      type="button"
                      className={`skill-group-header${collapsed ? ' is-collapsed' : ''}`}
                      style={{ flex: 1, minWidth: 0, margin: 0 }}
                      onClick={() =>
                        setCollapsedSkillGroups((prev) => ({
                          ...prev,
                          [entry.key]: !collapsed
                        }))
                      }
                    >
                      <span className="skill-group-chevron" aria-hidden>
                        {collapsed ? '▸' : '▾'}
                      </span>
                      <span className="skill-group-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {isCat && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                          </svg>
                        )}
                        <span>{entry.label}</span>
                      </span>
                      <span className="skill-group-count">{entry.count}</span>
                    </button>

                    {isCat && (
                      <div
                        className={`folder-header-actions${confirmDeleteFolderKey === catFolderName ? ' confirming' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '3px', paddingRight: '2px' }}
                      >
                        {confirmDeleteFolderKey !== catFolderName && (
                          <>
                            <button
                              type="button"
                              className="icon-button"
                              title={`Thêm Subfolder hoặc Skill mới vào ${catFolderName}`}
                              style={{ width: '22px', height: '22px', padding: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#38bdf8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewFolderName(`${catFolderName}/`);
                                setShowCreateFolder(true);
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5v14M5 12h14" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              title="Đổi tên thư mục"
                              style={{ width: '22px', height: '22px', padding: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#e4e4e7', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                startRenameFolder(catFolderName);
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                              </svg>
                            </button>
                          </>
                        )}

                        {confirmDeleteFolderKey === catFolderName && (
                          <button
                            type="button"
                            className="icon-button cancel-btn"
                            title="Hủy xóa thư mục"
                            style={{ width: '22px', height: '22px', padding: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#a1a1aa', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteFolderKey(null);
                            }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}

                        <button
                          type="button"
                          className="icon-button folder-delete-btn"
                          title={confirmDeleteFolderKey === catFolderName ? "Bấm lại để xác nhận xóa thư mục!" : "Xóa thư mục"}
                          style={{
                            width: '22px',
                            height: '22px',
                            padding: 0,
                            background: confirmDeleteFolderKey === catFolderName ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.06)',
                            border: confirmDeleteFolderKey === catFolderName ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '4px',
                            color: confirmDeleteFolderKey === catFolderName ? '#ef4444' : '#fca5a5',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolderClick(catFolderName);
                          }}
                        >
                          {confirmDeleteFolderKey === catFolderName ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              }

              const skill = entry.skill;
              const isDragging = draggingSkillId === skill.id;
              const isGrid = skillLayout === 'grid';
              const isPinned = pinnedSet.has(skill.id);

              const handleDragHandlePointerDown = (e: React.PointerEvent) => {
                if (!canReorderSkills) return;
                if (e.button !== 0) return;
                e.preventDefault();
                e.stopPropagation();
                beginPointerReorderSession(skill.id, e.pointerId, e.clientX, e.clientY);
              };

              const handleDragStart = (e: React.DragEvent) => {
                if ((e.target as HTMLElement).closest('button, a, input, textarea')) {
                  e.preventDefault();
                  return;
                }
                const state = useDeckStore.getState();
                const activeWs = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
                const rootPath = (activeWs?.rootPath || '').trim();

                const filename = skillFilename(skill);
                const resolvedCat = resolveSkillCategory(skill);
                const catDir = resolvedCat ? resolvedCat.replace(/[/\\]+/g, '/').replace(/^\/|\/$/g, '') : '';
                const isWin = navigator.userAgent.includes('Windows') || rootPath.includes('\\');
                const sep = isWin ? '\\' : '/';
                const normRoot = rootPath ? rootPath.replace(/[/\\]+/g, sep).replace(/[/\\]$/, '') : '';
                const catWinDir = catDir ? `${sep}${catDir.replace(/\//g, sep)}` : '';
                const fullPath = normRoot ? `${normRoot}${sep}.claude${sep}skills${catWinDir}${sep}${filename}` : filename;
                const cleanPath = fullPath.replace(/^"+|"+$/g, '');
                const formattedPath = cleanPath.includes(' ') ? `"${cleanPath}"` : cleanPath;

                e.dataTransfer.setData('text/skill-id', skill.id);
                e.dataTransfer.setData('text/plain', formattedPath);
                e.dataTransfer.effectAllowed = 'copyMove';
              };

              const updatedDateStr =
                skill.updatedAt > 0
                  ? new Date(skill.updatedAt).toLocaleDateString()
                  : 'Preinstalled';

              const dragHandle = canReorderSkills ? (
                <button
                  type="button"
                  className="skill-drag-handle"
                  title="Drag to reorder"
                  aria-label={`Drag to reorder ${skill.name}`}
                  onPointerDown={handleDragHandlePointerDown}
                  onClick={(e) => e.preventDefault()}
                >
                  <span className="skill-drag-handle-dots" aria-hidden>
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                </button>
              ) : null;

              const pinButton = (
                <button
                  type="button"
                  className={`skill-pin-btn${isPinned ? ' is-pinned' : ''}`}
                  title={isPinned ? 'Unpin from top' : 'Pin to top'}
                  aria-label={isPinned ? `Unpin ${skill.name}` : `Pin ${skill.name}`}
                  aria-pressed={isPinned}
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePinSkill(skill.id);
                  }}
                >
                  {/* Thumbtack — clearer “pin” than a star */}
                  <svg
                    className="skill-pin-icon"
                    viewBox="0 0 24 24"
                    width="15"
                    height="15"
                    aria-hidden
                  >
                    {isPinned ? (
                      <path
                        fill="currentColor"
                        d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"
                      />
                    ) : (
                      <path
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinejoin="round"
                        d="M15.5 4.5h-7M10 4.5v5.2c0 1.4-.7 2.4-1.9 3.1-.4.2-.6.6-.6 1v.7h9v-.7c0-.4-.2-.8-.6-1-1.2-.7-1.9-1.7-1.9-3.1V4.5M12 14.5v5.5"
                      />
                    )}
                  </svg>
                </button>
              );

              const actionButtons = (
                <div className="skill-actions" onMouseDown={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => void handleExport(skill, 'file')}
                    title={`Download ${skillFilename(skill)} (agent-standard SKILL.md)`}
                  >
                    {isGrid ? 'Exp' : 'Export'}
                  </button>
                  <button
                    type="button"
                    className="skill-copy-btn"
                    onClick={() => void handleExport(skill, 'clipboard')}
                    title="Copy SKILL.md to clipboard"
                  >
                    Copy
                  </button>
                  {!skill.isSystem && (
                    <button type="button" onClick={() => handleStartEdit(skill)} title="Edit skill">
                      Edit
                    </button>
                  )}
                  {!skill.isSystem && (
                    <button
                      type="button"
                      onClick={() => startMoveSkill(skill)}
                      title="Di chuyển skill vào thư mục"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      <span>{isGrid ? 'Move' : 'Folder'}</span>
                    </button>
                  )}
                  {confirmDeleteSkillId !== skill.id ? (
                    <button
                      type="button"
                      className="danger skill-delete-btn"
                      data-skill-delete={skill.id}
                      title={skill.isSystem ? 'Remove preinstalled skill' : 'Delete skill'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSkillClick(skill.id);
                      }}
                    >
                      {isGrid ? 'Del' : 'Delete'}
                    </button>
                  ) : (
                    <div
                      data-skill-delete={skill.id}
                      style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}
                    >
                      <button
                        type="button"
                        className="btn-confirm-cancel"
                        style={{
                          padding: '2px 6px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        title="Cancel"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteSkillId(null);
                        }}
                      >
                        Không
                      </button>
                      <button
                        type="button"
                        className="btn-confirm-ok"
                        style={{
                          padding: '2px 6px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        title="Click OK to confirm delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSkillClick(skill.id);
                        }}
                      >
                        OK
                      </button>
                    </div>
                  )}
                </div>
              );

              return (
                <article
                  key={skill.id}
                  data-skill-card-id={skill.id}
                  className={`skill-card ${skill.isSystem ? 'system' : 'custom'}${
                    isGrid ? ' is-grid' : ''
                  }${canReorderSkills ? ' is-reorderable' : ''}${
                    isDragging ? ' is-dragging-placeholder' : ''
                  }${isPinned ? ' is-pinned' : ''}`}
                  style={entry.depth ? { marginLeft: `${entry.depth * 16}px` } : undefined}
                  draggable={true}
                  onDragStart={handleDragStart}
                  onDoubleClick={() => !skill.isSystem && handleStartEdit(skill)}
                  title={
                    isGrid
                      ? skill.description || skill.name
                      : !canReorderSkills
                        ? 'Drop on terminal to run'
                        : undefined
                  }
                >
                  {isGrid ? (
                    <>
                      <div className="skill-grid-top">
                        {dragHandle}
                        {pinButton}
                        <h4 className="skill-grid-name" title={skill.name}>
                          {skill.name}
                        </h4>
                        <span
                          className={`skill-badge skill-badge-dot ${
                            skill.isSystem ? 'system' : 'custom'
                          }`}
                          title={skill.isSystem ? 'System' : 'Custom'}
                        >
                          {skill.isSystem ? 'S' : 'C'}
                        </span>
                      </div>
                      {exportFeedback?.id === skill.id ? (
                        <span className="skill-export-feedback skill-grid-feedback">
                          {exportFeedback.message}
                        </span>
                      ) : null}
                      <div className="skill-grid-actions">{actionButtons}</div>
                    </>
                  ) : (
                    <>
                      <div className="skill-card-header">
                        {dragHandle}
                        <div className="skill-title-block">
                          <div className="skill-title-row">
                            <h4>{skill.name}</h4>
                            <div className="skill-card-meta">
                              {pinButton}
                              <span className={`skill-badge ${skill.isSystem ? 'system' : 'custom'}`}>
                                {skill.isSystem ? 'System' : 'Custom'}
                              </span>
                            </div>
                          </div>
                          <span className="skill-version">v{skill.version}</span>
                        </div>
                      </div>
                      <p className="skill-desc">
                        {skill.description || 'No description provided.'}
                      </p>

                      {(skill.allowedTools || skill.fileScope) && (
                        <div className="skill-meta-stack">
                          {skill.allowedTools ? (
                            <div className="skill-meta-item">
                              <strong>Tools</strong>
                              <code>{skill.allowedTools}</code>
                            </div>
                          ) : null}
                          {skill.fileScope ? (
                            <div className="skill-meta-item">
                              <strong>Files</strong>
                              <code>{skill.fileScope}</code>
                            </div>
                          ) : null}
                        </div>
                      )}

                      <div className="skill-card-footer">
                        <span className="skill-date">
                          {exportFeedback?.id === skill.id ? (
                            <span className="skill-export-feedback">{exportFeedback.message}</span>
                          ) : (
                            <>Updated {updatedDateStr}</>
                          )}
                        </span>
                        {actionButtons}
                      </div>
                    </>
                  )}
                </article>
              );
            })}
            {skillVirtual.active && skillVirtual.padBottom > 0 ? (
              <div
                className="skills-virtual-spacer"
                style={{ height: skillVirtual.padBottom }}
                aria-hidden
              />
            ) : null}
          </>
        )}
      </div>

      {movingSkill && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => setMovingSkill(null)}
        >
          <div
            className="move-skill-modal"
            style={{
              width: '360px',
              maxWidth: '90vw',
              background: '#18181b',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              <span>Di chuyển Skill vào Thư Mục</span>
            </div>
            <div style={{ fontSize: '12px', color: '#a1a1aa' }}>
              Skill: <strong style={{ color: '#f4f4f5' }}>{movingSkill.name}</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11px', color: '#a1a1aa' }}>Nhập tên thư mục mới hoặc chọn từ danh sách:</label>
              <input
                type="text"
                placeholder="Chọn hoặc nhập tên thư mục..."
                value={targetMoveFolder}
                onChange={(e) => setTargetMoveFolder(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  background: '#09090b',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '4px',
                  color: '#f4f4f5',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
            </div>

            {categorySuggestions.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '120px', overflowY: 'auto', padding: '4px 0' }}>
                {categorySuggestions.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      background: targetMoveFolder === cat ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)',
                      color: targetMoveFolder === cat ? '#000' : '#e4e4e7',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    onClick={() => setTargetMoveFolder(cat)}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <span>{cat}</span>
                  </button>
                ))}
                <button
                  type="button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    background: !targetMoveFolder ? '#f43f5e' : 'rgba(255, 255, 255, 0.05)',
                    color: '#e4e4e7',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onClick={() => setTargetMoveFolder('')}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                  </svg>
                  <span>Chưa phân loại</span>
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
              <button type="button" onClick={() => setMovingSkill(null)} style={{ padding: '6px 12px', fontSize: '12px' }}>
                Hủy
              </button>
              <button type="button" className="primary-btn" onClick={submitMoveSkill} style={{ padding: '6px 12px', fontSize: '12px' }}>
                Lưu di chuyển
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssistantPanel() {
  const messages = useDeckStore((state) => state.assistantMessages);
  const assistantBusy = useDeckStore((state) => state.assistantBusy);
  const sendAssistantMessage = useDeckStore((state) => state.sendAssistantMessage);
  const cancelAssistantRequest = useDeckStore((state) => state.cancelAssistantRequest);
  const executeAssistantAction = useDeckStore((state) => state.executeAssistantAction);
  const dismissAssistantAction = useDeckStore((state) => state.dismissAssistantAction);
  const clearAssistantMessages = useDeckStore((state) => state.clearAssistantMessages);

  const workspaces = useDeckStore((state) => state.workspaces);
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const activePaneId = useDeckStore((state) => state.activePaneId);
  const tasks = useDeckStore((state) => state.tasks);
  const agentRuns = useDeckStore((state) => state.agentRuns);

  const [inputVal, setInputVal] = useState('');
  /** Local send guard for composer (mirrors store.assistantBusy for disable UI) */
  const [isSending, setIsSending] = useState(false);
  /** Optimistic user bubble while waiting on LLM (composer only; store may already have user msg) */
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [pendingUserImages, setPendingUserImages] = useState<
    { id: string; name: string; mimeType: string; dataUrl: string }[]
  >([]);
  const [pendingImages, setPendingImages] = useState<
    { id: string; name: string; mimeType: string; dataUrl: string }[]
  >([]);
  const [thinkingLabelIdx, setThinkingLabelIdx] = useState(0);
  const [composerMenuOpen, setComposerMenuOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<{
    src: string;
    name: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const composerMenuRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const THINKING_LABELS = [
    'Thinking',
    'Reading workspace',
    'Looking at image',
    'Talking to model',
    'Almost there'
  ];

  /** Global busy includes AI Explain / external sends — show thinking bubble */
  const isThinking = isSending || assistantBusy;

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;
  const activePane = activeWorkspace && activePaneId ? activeWorkspace.panes[activePaneId] : null;
  const runningTasksCount = tasks.filter((t) => t.status === 'running').length;
  const runningAgentsCount = agentRuns.filter((r) => r.status === 'running').length;

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    const container = document.getElementById('assistant-messages-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages, pendingUserText, pendingUserImages, isThinking, thinkingLabelIdx]);

  useEffect(() => {
    if (!isThinking) {
      setThinkingLabelIdx(0);
      return;
    }
    const id = window.setInterval(() => {
      setThinkingLabelIdx((i) => (i + 1) % THINKING_LABELS.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [isThinking]);

  useEffect(() => {
    if (!composerMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (composerMenuRef.current && !composerMenuRef.current.contains(e.target as Node)) {
        setComposerMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setComposerMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [composerMenuOpen]);

  useEffect(() => {
    if (!imagePreview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setImagePreview(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [imagePreview]);

  const openImagePreview = (src: string, name: string) => {
    setImagePreview({ src, name });
  };

  const compressImageFile = (file: File): Promise<{ id: string; name: string; mimeType: string; dataUrl: string }> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image'));
      reader.onload = () => {
        const raw = String(reader.result || '');
        const img = new Image();
        img.onload = () => {
          const max = 1280;
          let { width, height } = img;
          if (width > max || height > max) {
            const scale = Math.min(max / width, max / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.name,
              mimeType: file.type || 'image/png',
              dataUrl: raw
            });
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const dataUrl = canvas.toDataURL(mime, 0.85);
          resolve({
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: file.name || 'image',
            mimeType: mime,
            dataUrl
          });
        };
        img.onerror = () => reject(new Error('Invalid image'));
        img.src = raw;
      };
      reader.readAsDataURL(file);
    });

  const addImageFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    const room = Math.max(0, 4 - pendingImages.length);
    const slice = list.slice(0, room);
    const next: typeof pendingImages = [];
    for (const file of slice) {
      try {
        next.push(await compressImageFile(file));
      } catch (err) {
        console.warn('[Assist] skip image', err);
      }
    }
    if (next.length) setPendingImages((prev) => [...prev, ...next].slice(0, 4));
  };

  const resetSendingUi = useCallback(() => {
    setPendingUserText(null);
    setPendingUserImages([]);
    setIsSending(false);
    abortRef.current = null;
    requestIdRef.current = null;
    focusInput();
  }, [focusInput]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    const rid = requestIdRef.current;
    if (rid && window.agentDeck?.cancelAssistantChat) {
      void window.agentDeck.cancelAssistantChat(rid);
    }
    cancelAssistantRequest();
    resetSendingUi();
  }, [resetSendingUi, cancelAssistantRequest]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if ((!trimmed && pendingImages.length === 0) || isSending || assistantBusy) return;
    const imgs = [...pendingImages];
    const ac = new AbortController();
    const requestId = `assist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    abortRef.current = ac;
    requestIdRef.current = requestId;
    setIsSending(true);
    setPendingUserText(trimmed || (imgs.length ? `Analyze image${imgs.length > 1 ? 's' : ''}` : ''));
    setPendingUserImages(imgs);
    setInputVal('');
    setPendingImages([]);
    try {
      const result = await sendAssistantMessage(trimmed, imgs, {
        requestId,
        signal: ac.signal
      });
      if (result === 'cancelled') return;
    } catch (err) {
      if (ac.signal.aborted) return;
      console.error(err);
    } finally {
      if (!ac.signal.aborted) {
        resetSendingUi();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSend(inputVal);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      void addImageFiles(files);
    }
  };

  return (
    <div className="assistant-panel">
      <div className="assistant-context-bar">
        <div className="context-item">
          <span className="context-label">Workspace:</span>
          <span className="context-value" title={activeWorkspace?.rootPath || ''}>
            {activeWorkspace ? activeWorkspace.name : 'None'}
          </span>
        </div>
        <div className="context-item">
          <span className="context-label">Pane:</span>
          <span className="context-value">
            {activePane ? activePane.title : 'None'}
          </span>
        </div>
        <div className="context-stats">
          <span className="stat-badge" title="Running Tasks">
            Tasks: {runningTasksCount}
          </span>
          <span className="stat-badge" title="Running Agents">
            Agents: {runningAgentsCount}
          </span>
        </div>
      </div>

      <div className="assistant-messages-header">
        <div className="assistant-messages-header-left">
          <h3>Agent Assistant</h3>
          <span
            className="assistant-history-meta"
            title="Uses Settings → AI Models when configured; otherwise offline rules"
          >
            {messages.length > 0 ? `${messages.length} · last 24` : 'LLM / offline'}
          </span>
        </div>
        {messages.length > 0 && (
          <button type="button" className="clear-history-btn" onClick={clearAssistantMessages}>
            Clear
          </button>
        )}
      </div>

      <div className="assistant-messages" id="assistant-messages-container">
        {messages.length === 0 && !pendingUserText && !isThinking ? (
          <div className="assistant-empty-state">
            <p>AgentDeck assistant</p>
            <p className="empty-sub">Use Quick Actions or type a command.</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`assistant-message-row ${isUser ? 'user-row' : 'assistant-row'}`}
                >
                  <div className={`assistant-bubble ${isUser ? 'user' : 'assistant'}`}>
                    <div className="bubble-meta">
                      <span className="bubble-sender">{isUser ? 'You' : 'Assistant'}</span>
                      <span className="bubble-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="bubble-content">
                      {msg.images && msg.images.length > 0 ? (
                        <div
                          className={`assistant-bubble-images${
                            msg.images.length === 1 ? ' is-single' : ''
                          }`}
                        >
                          {msg.images.map((img) => (
                            <button
                              key={img.id}
                              type="button"
                              className="assistant-bubble-image-btn"
                              title="Click to preview"
                              onClick={(e) => {
                                e.stopPropagation();
                                openImagePreview(img.dataUrl, img.name);
                              }}
                            >
                              <img src={img.dataUrl} alt={img.name} />
                            </button>
                          ))}
                        </div>
                      ) : null}
                      {msg.content.split('\n').map((line, idx) => (
                        <p key={idx}>{line}</p>
                      ))}
                    </div>

                    {msg.action && (
                      <div
                        className={`assistant-action-card ${msg.action.executed ? 'executed' : ''}`}
                      >
                        <div className="action-card-header">
                          <span className="action-card-title">{msg.action.label}</span>
                          {msg.action.executed && (
                            <span className="executed-badge">[Executed]</span>
                          )}
                        </div>

                        {msg.action.kind === 'create_task' && (
                          <div className="action-card-payload">
                            <div>
                              <strong>Title:</strong> {String(msg.action.payload.title || '')}
                            </div>
                            {Boolean(msg.action.payload.body) && (
                              <div>
                                <strong>Desc:</strong> {String(msg.action.payload.body || '')}
                              </div>
                            )}
                          </div>
                        )}

                        {msg.action.kind === 'run_task' && (
                          <div className="action-card-payload">
                            <div>
                              <strong>Task ID:</strong> {String(msg.action.payload.taskId || '')}
                            </div>
                          </div>
                        )}

                        {!msg.action.executed && (
                          <div className="action-card-actions">
                            <button
                              className="action-confirm-btn"
                              onClick={() => executeAssistantAction(msg.id)}
                              disabled={isThinking}
                            >
                              Confirm
                            </button>
                            <button
                              className="action-dismiss-btn"
                              onClick={() => dismissAssistantAction(msg.id)}
                              disabled={isThinking}
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Optimistic user bubble — only if store not already updated (sendAssistantMessage now inserts immediately) */}
            {(pendingUserText || pendingUserImages.length > 0) &&
            !(messages.length > 0 && messages[messages.length - 1]?.role === 'user') ? (
              <div className="assistant-message-row user-row">
                <div className="assistant-bubble user">
                  <div className="bubble-meta">
                    <span className="bubble-sender">You</span>
                    <span className="bubble-time">now</span>
                  </div>
                  <div className="bubble-content">
                    {pendingUserImages.length > 0 ? (
                      <div
                        className={`assistant-bubble-images${
                          pendingUserImages.length === 1 ? ' is-single' : ''
                        }`}
                      >
                        {pendingUserImages.map((img) => (
                          <button
                            key={img.id}
                            type="button"
                            className="assistant-bubble-image-btn"
                            title="Click to preview"
                            onClick={() => openImagePreview(img.dataUrl, img.name)}
                          >
                            <img src={img.dataUrl} alt={img.name} />
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {pendingUserText ? <p>{pendingUserText}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Thinking indicator — also for AI Explain / external sendAssistantMessage */}
            {isThinking ? (
              <div className="assistant-message-row assistant-row">
                <div className="assistant-bubble assistant assistant-thinking" aria-live="polite">
                  <div className="bubble-meta">
                    <span className="bubble-sender">Assistant</span>
                    <span className="bubble-time">…</span>
                  </div>
                  <div className="assistant-thinking-body">
                    <span className="assistant-thinking-dots" aria-hidden>
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className="assistant-thinking-label">
                      {THINKING_LABELS[thinkingLabelIdx]}
                    </span>
                    <button
                      type="button"
                      className="assistant-cancel-btn"
                      onClick={handleCancel}
                      title="Cancel request"
                    >
                      Stop
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="assistant-footer">
        <div className="assistant-quick-actions">
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => void handleSend('status')}
            disabled={isThinking}
          >
            Status
          </button>
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => void handleSend('scan')}
            disabled={isThinking}
          >
            Scan
          </button>
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => void handleSend('errors')}
            disabled={isThinking}
          >
            Errors
          </button>
          <button
            type="button"
            className="quick-action-btn"
            onClick={() => void handleSend('report')}
            disabled={isThinking}
          >
            Report
          </button>
        </div>

        {pendingImages.length > 0 ? (
          <div className="assistant-attach-preview">
            {pendingImages.map((img) => (
              <div key={img.id} className="assistant-attach-thumb">
                <button
                  type="button"
                  className="assistant-attach-thumb-open"
                  title="Preview"
                  onClick={() => openImagePreview(img.dataUrl, img.name)}
                >
                  <img src={img.dataUrl} alt={img.name} />
                </button>
                <button
                  type="button"
                  className="assistant-attach-remove"
                  title="Remove image"
                  onClick={() =>
                    setPendingImages((prev) => prev.filter((p) => p.id !== img.id))
                  }
                  disabled={isThinking}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="assistant-input-area">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="assistant-file-input"
            onChange={(e) => {
              if (e.target.files?.length) void addImageFiles(e.target.files);
              e.target.value = '';
              setComposerMenuOpen(false);
            }}
          />
          <div className="assistant-composer-shell">
            <div className="assistant-composer-menu" ref={composerMenuRef}>
              <button
                type="button"
                className={`assistant-more-btn${composerMenuOpen ? ' is-open' : ''}`}
                title="Add"
                aria-haspopup="menu"
                aria-expanded={composerMenuOpen}
                disabled={isThinking}
                onClick={() => setComposerMenuOpen((v) => !v)}
              >
                <span className="assistant-plus-glyph" aria-hidden>
                  +
                </span>
              </button>
              {composerMenuOpen ? (
                <div className="assistant-composer-dropdown" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="assistant-composer-menu-item"
                    disabled={pendingImages.length >= 4}
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span>Upload image</span>
                    {pendingImages.length > 0 ? (
                      <span className="assistant-composer-menu-hint">{pendingImages.length}/4</span>
                    ) : null}
                  </button>
                  <p className="assistant-composer-menu-note">Or paste a screenshot into the field</p>
                </div>
              ) : null}
            </div>
            <input
              ref={inputRef}
              type="text"
              className="assistant-input"
              placeholder={
                isSending
                  ? 'Waiting for reply…'
                  : pendingImages.length
                    ? 'Ask about the image…'
                    : 'Type a message…'
              }
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
            />
          </div>
          {isThinking ? (
            <button
              type="button"
              className="assistant-send-btn assistant-stop-btn"
              onClick={handleCancel}
              title="Stop generation"
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              className="assistant-send-btn"
              onClick={() => void handleSend(inputVal)}
              disabled={!inputVal.trim() && pendingImages.length === 0}
            >
              Send
            </button>
          )}
        </div>
      </div>

      {imagePreview
        ? createPortal(
            <div
              className="assistant-image-lightbox"
              role="dialog"
              aria-modal="true"
              aria-label="Image preview"
              onClick={() => setImagePreview(null)}
            >
              <div
                className="assistant-image-lightbox-panel"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="assistant-image-lightbox-bar">
                  <span className="assistant-image-lightbox-name" title={imagePreview.name}>
                    {imagePreview.name}
                  </span>
                  <button
                    type="button"
                    className="assistant-image-lightbox-close"
                    onClick={() => setImagePreview(null)}
                  >
                    Close
                  </button>
                </div>
                <div className="assistant-image-lightbox-stage">
                  <img src={imagePreview.src} alt={imagePreview.name} />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function WorkflowPanel() {
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const activePaneId = useDeckStore((state) => state.activePaneId);
  const workflows = useDeckStore((state) => state.workflows);
  const agentProfiles = useDeckStore((state) => state.agentProfiles);
  const skills = useDeckStore((state) => state.skills);
  const tasks = useDeckStore((state) => state.tasks);

  const createWorkflow = useDeckStore((state) => state.createWorkflow);
  const createWorkflowFromTemplate = useDeckStore((state) => state.createWorkflowFromTemplate);
  const deleteWorkflow = useDeckStore((state) => state.deleteWorkflow);
  const startWorkflow = useDeckStore((state) => state.startWorkflow);
  const pauseWorkflow = useDeckStore((state) => state.pauseWorkflow);
  const resumeWorkflow = useDeckStore((state) => state.resumeWorkflow);
  const retryWorkflowStep = useDeckStore((state) => state.retryWorkflowStep);
  const skipWorkflowStep = useDeckStore((state) => state.skipWorkflowStep);
  const cancelWorkflow = useDeckStore((state) => state.cancelWorkflow);

  // Active view: 'active' | 'templates' | 'custom'
  const [activeSubTab, setActiveSubTab] = useState<'active' | 'templates' | 'custom'>('active');
  const [expandedWorkflowId, setExpandedWorkflowId] = useState<string | null>(null);

  // Template select taskId
  const [selectedTaskIdForTemplate, setSelectedTaskIdForTemplate] = useState<Record<string, string>>({});

  // Custom Builder State
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customSteps, setCustomSteps] = useState<Omit<WorkflowStep, 'id' | 'status' | 'retryCount' | 'runId' | 'startedAt' | 'finishedAt' | 'errorSummary'>[]>([]);

  // Active workspace tasks
  const workspaceTasks = useMemo(() => {
    return tasks.filter((t) => t.status !== 'done');
  }, [tasks]);

  const activeWorkflows = useMemo(() => {
    if (!activeWorkspaceId) return [];
    return workflows.filter((w) => w.workspaceId === activeWorkspaceId);
  }, [workflows, activeWorkspaceId]);

  const templates = useMemo(() => getBuiltinTemplates(), []);

  const handleUseTemplate = (templateId: string) => {
    const taskId = selectedTaskIdForTemplate[templateId] || null;
    createWorkflowFromTemplate(templateId, taskId || undefined);
    setActiveSubTab('active');
  };

  const handleAddCustomStep = () => {
    const defaultAgent = agentProfiles[0]?.id || '';
    setCustomSteps([
      ...customSteps,
      {
        label: `Step ${customSteps.length + 1}`,
        agentId: defaultAgent,
        skillId: null,
        promptOverride: '',
        maxRetries: 1
      }
    ]);
  };

  const handleRemoveCustomStep = (idx: number) => {
    setCustomSteps(customSteps.filter((_, i) => i !== idx));
  };

  const handleUpdateCustomStep = (idx: number, patch: Partial<typeof customSteps[0]>) => {
    setCustomSteps(
      customSteps.map((step, i) => (i === idx ? { ...step, ...patch } : step))
    );
  };

  const handleMoveStep = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === customSteps.length - 1) return;

    const nextIndex = direction === 'up' ? idx - 1 : idx + 1;
    const nextSteps = [...customSteps];
    const temp = nextSteps[idx];
    nextSteps[idx] = nextSteps[nextIndex];
    nextSteps[nextIndex] = temp;
    setCustomSteps(nextSteps);
  };

  const handleCreateCustomWorkflow = () => {
    if (!customName.trim()) {
      alert('Vui long nhap ten workflow');
      return;
    }
    if (customSteps.length === 0) {
      alert('Vui long them it nhat 1 buoc (Step) cho workflow');
      return;
    }

    const compiledSteps: WorkflowStep[] = customSteps.map((s, idx) => ({
      id: `step-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      ...s,
      status: 'pending',
      retryCount: 0,
      runId: null,
      startedAt: null,
      finishedAt: null,
      errorSummary: ''
    }));

    createWorkflow(customName, compiledSteps);
    setCustomName('');
    setCustomDesc('');
    setCustomSteps([]);
    setActiveSubTab('active');
  };

  if (!activeWorkspaceId) {
    return (
      <div className="wf-panel empty">
        <p>Vui long chon hoac mo mot Workspace de quan ly workflows.</p>
      </div>
    );
  }

  return (
    <div className="wf-panel">
      <div className="wf-header">
        <h2>Multi-Agent Workflows</h2>
        <div className="wf-subtabs">
          <button
            className={`wf-subtab-btn ${activeSubTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('active')}
          >
            Active ({activeWorkflows.length})
          </button>
          <button
            className={`wf-subtab-btn ${activeSubTab === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('templates')}
          >
            Templates
          </button>
          <button
            className={`wf-subtab-btn ${activeSubTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('custom')}
          >
            Builder
          </button>
        </div>
      </div>

      <div className="wf-body">
        {activeSubTab === 'active' && (
          <div className="wf-active-list">
            {activeWorkflows.length === 0 ? (
              <div className="wf-empty-state">
                <p>No active workflows.</p>
                <button className="wf-primary-btn" onClick={() => setActiveSubTab('templates')}>
                  Browse templates
                </button>
              </div>
            ) : (
              activeWorkflows.map((wf) => {
                const isExpanded = expandedWorkflowId === wf.id;
                const activeStep = wf.steps[wf.currentStepIndex];

                const currentStepLabel =
                  activeStep?.label || wf.steps[0]?.label || 'No steps';

                return (
                  <div key={wf.id} className={`wf-card ${wf.status}`}>
                    <div
                      className="wf-card-header"
                      onClick={() => setExpandedWorkflowId(isExpanded ? null : wf.id)}
                    >
                      <div className="wf-card-title-section">
                        <span className={`wf-status-indicator ${wf.status}`} />
                        <div className="wf-title-block">
                          <span className="wf-name" title={wf.name}>
                            {wf.name}
                          </span>
                          <span className="wf-current-step" title={currentStepLabel}>
                            {wf.status === 'idle'
                              ? `${wf.steps.length} steps`
                              : `Step ${Math.min(wf.currentStepIndex + 1, wf.steps.length)} · ${currentStepLabel}`}
                          </span>
                        </div>
                        {wf.taskId ? <span className="wf-task-badge">Task</span> : null}
                      </div>
                      <div className="wf-card-meta">
                        <span className="wf-step-progress">
                          {wf.currentStepIndex + 1}/{wf.steps.length}
                        </span>
                        <span className={`wf-badge ${wf.status}`}>{wf.status}</span>
                      </div>
                    </div>

                    <div className="wf-card-pipeline" aria-label="Workflow steps">
                      <div className="wf-pipeline-track" aria-hidden>
                        <div
                          className="wf-pipeline-fill"
                          style={{
                            width:
                              wf.steps.length <= 1
                                ? '0%'
                                : `${(Math.max(0, Math.min(wf.currentStepIndex, wf.steps.length - 1)) / (wf.steps.length - 1)) * 100}%`
                          }}
                        />
                      </div>
                      {wf.steps.map((step, idx) => {
                        const isCurrent =
                          idx === wf.currentStepIndex &&
                          wf.status !== 'completed' &&
                          wf.status !== 'failed' &&
                          wf.status !== 'idle';
                        return (
                          <div
                            key={step.id}
                            className={`wf-pipeline-dot ${step.status}${isCurrent ? ' current' : ''}${
                              wf.status === 'idle' && idx === 0 ? ' next' : ''
                            }`}
                            title={`${idx + 1}. ${step.label} · ${step.status}`}
                          >
                            <span className="dot-index">
                              {step.status === 'completed' ? '✓' : idx + 1}
                            </span>
                            <span className="dot-label">{step.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="wf-card-controls">
                      {wf.status === 'idle' && (
                        <button
                          type="button"
                          className="wf-ctrl-btn run"
                          onClick={() => startWorkflow(wf.id, activePaneId || undefined)}
                        >
                          Start Workflow
                        </button>
                      )}
                      {wf.status === 'running' && (
                        <>
                          <button
                            type="button"
                            className="wf-ctrl-btn pause"
                            onClick={() => pauseWorkflow(wf.id)}
                          >
                            Pause
                          </button>
                          <button
                            type="button"
                            className="wf-ctrl-btn cancel"
                            onClick={() => cancelWorkflow(wf.id)}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {wf.status === 'paused' && (
                        <>
                          <button
                            type="button"
                            className="wf-ctrl-btn run"
                            onClick={() => resumeWorkflow(wf.id)}
                          >
                            Resume
                          </button>
                          <button
                            type="button"
                            className="wf-ctrl-btn cancel"
                            onClick={() => cancelWorkflow(wf.id)}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {wf.status === 'failed' && (
                        <>
                          {activeStep && activeStep.status === 'failed' && (
                            <button
                              type="button"
                              className="wf-ctrl-btn retry"
                              onClick={() => retryWorkflowStep(wf.id, wf.currentStepIndex)}
                            >
                              Retry failed step
                            </button>
                          )}
                          {activeStep && activeStep.status === 'failed' && (
                            <button
                              type="button"
                              className="wf-ctrl-btn skip"
                              onClick={() => skipWorkflowStep(wf.id, wf.currentStepIndex)}
                            >
                              Skip step
                            </button>
                          )}
                          <button className="wf-ctrl-btn delete" onClick={() => deleteWorkflow(wf.id)}>
                            Delete
                          </button>
                        </>
                      )}
                      {(wf.status === 'completed' || wf.status === 'failed') && wf.status !== 'failed' && (
                        <button className="wf-ctrl-btn delete" onClick={() => deleteWorkflow(wf.id)}>
                          Delete
                        </button>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="wf-card-details">
                        <h4>Workflow Logs & Details</h4>
                        <div className="wf-steps-detail-list">
                          {wf.steps.map((step, idx) => {
                            const stepAgent = agentProfiles.find((a) => a.id === step.agentId);
                            const stepSkill = skills.find((s) => s.id === step.skillId);
                            return (
                              <div key={step.id} className={`wf-step-detail-card ${step.status}`}>
                                <div className="step-detail-header">
                                  <span className={`step-idx-badge ${step.status}`}>{idx + 1}</span>
                                  <span className="step-label">{step.label}</span>
                                  <span className={`step-status-badge ${step.status}`}>{step.status}</span>
                                </div>
                                <div className="step-detail-body">
                                  <div><strong>Agent:</strong> {stepAgent?.name || 'N/A'}</div>
                                  {stepSkill && (
                                    <div><strong>Skill Template:</strong> {stepSkill.name}</div>
                                  )}
                                  {step.promptOverride && (
                                    <div className="prompt-meta" title={step.promptOverride}>
                                      <strong>Prompt:</strong> {step.promptOverride.substr(0, 80)}...
                                    </div>
                                  )}
                                  {step.errorSummary && (
                                    <div className="step-error-box">
                                      <strong>Error:</strong> {step.errorSummary}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <h4>Timeline Events</h4>
                        <div className="wf-timeline-log">
                          {wf.log.map((entry, idx) => (
                            <div key={idx} className={`wf-log-entry ${entry.level}`}>
                              <span className="log-time">
                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                              <span className="log-msg">{entry.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeSubTab === 'templates' && (
          <div className="wf-template-gallery">
            {templates.map((tpl) => (
              <div key={tpl.id} className="wf-template-card">
                <h3>{tpl.name}</h3>
                <p>{tpl.description}</p>
                <div className="wf-template-steps-preview">
                  <strong>Steps:</strong>{' '}
                  {tpl.steps.map((s, idx) => {
                    const full = `${s.label} (${s.agentName})`;
                    return (
                      <span key={idx} className="tpl-step-preview-tag" title={full}>
                        {full}
                      </span>
                    );
                  })}
                </div>
                <div className="wf-template-link-task">
                  <label>Assign to Task (Optional):</label>
                  <CustomSelect
                    className="wf-select"
                    aria-label="Assign workflow to task"
                    capitalize={false}
                    value={selectedTaskIdForTemplate[tpl.id] || ''}
                    onChange={(v) =>
                      setSelectedTaskIdForTemplate({
                        ...selectedTaskIdForTemplate,
                        [tpl.id]: v
                      })
                    }
                    options={[
                      { value: '', label: 'No Task / Pure Agent run' },
                      ...workspaceTasks.map((t) => ({
                        value: t.id,
                        label: t.title
                      }))
                    ]}
                  />
                </div>
                <button className="wf-primary-btn" onClick={() => handleUseTemplate(tpl.id)}>
                  Instantiate Workflow
                </button>
              </div>
            ))}
          </div>
        )}

        {activeSubTab === 'custom' && (
          <div className="wf-builder-form">
            <div className="form-group">
              <label>Workflow Name</label>
              <input
                type="text"
                placeholder="e.g. Code Review Loop"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Description (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Build, execute, and double check"
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
              />
            </div>

            <div className="wf-builder-steps-header">
              <h3>Steps / Agents Chain ({customSteps.length})</h3>
              <button className="wf-add-step-btn" onClick={handleAddCustomStep}>
                + Add Step
              </button>
            </div>

            <div className="wf-builder-steps-list">
              {customSteps.map((step, idx) => (
                <div key={idx} className="wf-builder-step-card">
                  <div className="step-card-header">
                    <h4>Step {idx + 1}</h4>
                    <div className="step-card-actions">
                      <button className="icon-btn" onClick={() => handleMoveStep(idx, 'up')} disabled={idx === 0} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => handleMoveStep(idx, 'down')}
                        disabled={idx === customSteps.length - 1}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      <button className="remove-btn" onClick={() => handleRemoveCustomStep(idx)}>
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Step Label</label>
                    <input
                      type="text"
                      value={step.label}
                      onChange={(e) => handleUpdateCustomStep(idx, { label: e.target.value })}
                    />
                  </div>

                  <div className="form-group row">
                    <div className="col">
                      <label>Agent Profile</label>
                      <CustomSelect
                        className="wf-select"
                        aria-label={`Agent for step ${idx + 1}`}
                        capitalize={false}
                        value={step.agentId}
                        onChange={(v) => handleUpdateCustomStep(idx, { agentId: v })}
                        options={agentProfiles.map((ap) => ({
                          value: ap.id,
                          label: ap.name
                        }))}
                      />
                    </div>
                    <div className="col">
                      <label>Skill Template (Optional)</label>
                      <CustomSelect
                        className="wf-select"
                        aria-label={`Skill for step ${idx + 1}`}
                        capitalize={false}
                        value={step.skillId || ''}
                        onChange={(v) =>
                          handleUpdateCustomStep(idx, { skillId: v || null })
                        }
                        options={[
                          { value: '', label: 'No Skill / Pure Agent' },
                          ...skills.map((sk) => ({
                            value: sk.id,
                            label: sk.name
                          }))
                        ]}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Prompt Override / Instructions</label>
                    <textarea
                      placeholder="Specific instructions for this agent step..."
                      rows={2}
                      value={step.promptOverride}
                      onChange={(e) => handleUpdateCustomStep(idx, { promptOverride: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Max Retries</label>
                    <CustomSelect
                      className="wf-select wf-select-narrow"
                      aria-label={`Max retries for step ${idx + 1}`}
                      capitalize={false}
                      value={String(step.maxRetries)}
                      onChange={(v) =>
                        handleUpdateCustomStep(idx, { maxRetries: parseInt(v, 10) || 0 })
                      }
                      options={[
                        { value: '0', label: '0 retries' },
                        { value: '1', label: '1 retry' },
                        { value: '2', label: '2 retries' },
                        { value: '3', label: '3 retries' }
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              className="wf-primary-btn w-full mt-4"
              onClick={handleCreateCustomWorkflow}
              disabled={customSteps.length === 0}
            >
              Create Workflow
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const FolderIcon = ({ size = 12, style = {}, className = "" }: { size?: number; style?: React.CSSProperties; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const FileIcon = ({ size = 12, style = {}, className = "" }: { size?: number; style?: React.CSSProperties; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const TrashIcon = ({ size = 12, style = {}, className = "" }: { size?: number; style?: React.CSSProperties; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const PlayIcon = ({ size = 12, style = {}, className = "" }: { size?: number; style?: React.CSSProperties; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const EditIcon = ({ size = 12, style = {}, className = "" }: { size?: number; style?: React.CSSProperties; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const MoreIcon = ({ size = 12, style = {}, className = "" }: { size?: number; style?: React.CSSProperties; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" />
    <circle cx="5" cy="12" r="1.5" fill="currentColor" />
  </svg>
);

const CopyIcon = ({ size = 12, style = {}, className = "" }: { size?: number; style?: React.CSSProperties; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const DownloadIcon = ({ size = 12, style = {}, className = "" }: { size?: number; style?: React.CSSProperties; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
    className={className}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

function tokenizeCode(code: string, ext: string): string {
  const escapeHtml = (text: string) =>
    text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  if (!code) return '';

  const cleanExt = ext.replace('.', '').toLowerCase();
  const isCodeExt = ['js', 'jsx', 'ts', 'tsx', 'css', 'json', 'html', 'md', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'yml', 'yaml', 'toml', 'xml', 'sql', 'sh'].includes(cleanExt);
  if (!isCodeExt) return escapeHtml(code);

  let i = 0;
  const len = code.length;
  let resultHtml = '';
  
  const keywords = new Set([
    'import', 'from', 'export', 'default', 'const', 'let', 'var', 'function', 'class', 'extends', 'implements',
    'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'this',
    'typeof', 'instanceof', 'void', 'delete', 'in', 'of', 'as', 'async', 'await', 'yield', 'try', 'catch',
    'finally', 'throw', 'package', 'interface', 'namespace', 'module', 'type', 'keyof', 'public', 'private',
    'protected', 'static', 'readonly', 'null', 'undefined', 'true', 'false'
  ]);
  
  const builtins = new Set([
    'useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext', 'useReducer', 'useLayoutEffect',
    'console', 'log', 'error', 'warn', 'window', 'document', 'process', 'require', 'module', 'exports',
    'Map', 'Set', 'Promise', 'JSON', 'Math', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Function'
  ]);

  while (i < len) {
    const char = code[i];
    
    // 1. Comments
    if (char === '/' && code[i + 1] === '/') {
      let start = i;
      while (i < len && code[i] !== '\n') {
        i++;
      }
      const text = code.substring(start, i);
      resultHtml += `<span style="color: #71717a; font-style: italic;">${escapeHtml(text)}</span>`;
      continue;
    }
    
    if (char === '/' && code[i + 1] === '*') {
      let start = i;
      i += 2;
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) {
        i++;
      }
      if (i < len) i += 2;
      const text = code.substring(start, i);
      resultHtml += `<span style="color: #71717a; font-style: italic;">${escapeHtml(text)}</span>`;
      continue;
    }
    
    // 2. Strings
    if (char === '"' || char === "'" || char === '`') {
      const quote = char;
      let start = i;
      i++;
      while (i < len && code[i] !== quote) {
        if (code[i] === '\\') i += 2;
        else i++;
      }
      if (i < len) i++;
      const text = code.substring(start, i);
      resultHtml += `<span style="color: #ec4899;">${escapeHtml(text)}</span>`;
      continue;
    }
    
    // 3. Numbers
    if (/\d/.test(char)) {
      let start = i;
      while (i < len && /[\d\.]/.test(code[i])) {
        i++;
      }
      const text = code.substring(start, i);
      resultHtml += `<span style="color: #f97316;">${escapeHtml(text)}</span>`;
      continue;
    }
    
    // 4. Identifiers (keywords, functions, types, builtins)
    if (/[a-zA-Z\_\$]/.test(char)) {
      let start = i;
      while (i < len && /[a-zA-Z0-9\_\$]/.test(code[i])) {
        i++;
      }
      const word = code.substring(start, i);
      
      if (keywords.has(word)) {
        resultHtml += `<span style="color: #c084fc; font-weight: 500;">${word}</span>`;
      } else if (builtins.has(word)) {
        resultHtml += `<span style="color: #38bdf8;">${word}</span>`;
      } else if (word[0] === word[0].toUpperCase() && word !== word.toUpperCase()) {
        resultHtml += `<span style="color: #fb7185;">${word}</span>`;
      } else if (code[i] === '(') {
        resultHtml += `<span style="color: #60a5fa;">${word}</span>`;
      } else {
        resultHtml += escapeHtml(word);
      }
      continue;
    }
    
    // 5. Operators and punctuation
    if (/[\+\-\*\/\=\&\|\!\?\:\;\,\.\(\)\[\]\{\}\<\>]/.test(char)) {
      resultHtml += `<span style="color: #71717a;">${char}</span>`;
      i++;
      continue;
    }
    
    resultHtml += escapeHtml(char);
    i++;
  }
  
  return resultHtml;
}

function highlightQueryInHtml(html: string, query: string, activeIndex: number): string {
  if (!query) return html;
  const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(<[^>]+>)|(${escapedQuery})`, 'gi');
  let matchCount = 0;
  return html.replace(regex, (match, tag, textMatch) => {
    if (tag) {
      return tag;
    }
    const isActive = matchCount === activeIndex;
    matchCount++;
    const style = isActive
      ? 'background: #eab308; border-bottom: 2px solid #ca8a04; color: #000; font-weight: bold; border-radius: 1px;'
      : 'background: rgba(234, 179, 8, 0.3); border-bottom: 2px solid #ca8a04; color: #fff; font-weight: 500; border-radius: 1px;';
    const activeAttr = isActive ? ' id="active-search-match"' : '';
    return `<span class="code-search-highlight${isActive ? ' active' : ''}"${activeAttr} style="${style}">${textMatch}</span>`;
  });
}

interface OpenedTab {
  path: string;
  name: string;
  content: string;
  ext: string;
}

type FeDirEntry = {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  ext: string;
};

/** Memoized code body — must not re-render when tree expand/collapse changes. */
const FeCodeReadView = memo(function FeCodeReadView({
  content,
  ext,
  findQuery,
  findMatchIndex,
  wordWrap,
  isWrapPending,
}: {
  content: string;
  ext: string;
  findQuery: string;
  findMatchIndex: number;
  wordWrap: boolean;
  isWrapPending: boolean;
}) {
  const htmlLines = useMemo(() => {
    const highlighted = highlightQueryInHtml(tokenizeCode(content, ext), findQuery, findMatchIndex);
    const out: string[] = [];
    let buf = '';
    let inTag = false;
    for (let i = 0; i < highlighted.length; i++) {
      const ch = highlighted[i];
      if (ch === '<') inTag = true;
      if (inTag) {
        buf += ch;
        if (ch === '>') inTag = false;
        continue;
      }
      if (ch === '\n') {
        out.push(buf);
        buf = '';
        continue;
      }
      buf += ch;
    }
    out.push(buf);
    const lineCount = content.split('\n').length;
    while (out.length < lineCount) out.push('');
    return out;
  }, [content, ext, findQuery, findMatchIndex]);

  return (
    <div
      style={{
        flex: 1,
        margin: 0,
        padding: '12px 12px 12px 0',
        background: '#121214',
        color: '#e4e4e7',
        fontFamily: 'Consolas, "Fira Code", Monaco, monospace',
        fontSize: '11.5px',
        lineHeight: '18px',
        overflow: 'auto',
        minWidth: 0,
        opacity: isWrapPending ? 0.72 : 1,
        transition: isWrapPending ? 'opacity 0.12s ease' : undefined,
      }}
    >
      {htmlLines.map((html, idx) => (
        <div
          key={idx}
          data-fe-line={idx}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            minHeight: '18px',
            minWidth: wordWrap ? undefined : 'max-content',
            width: wordWrap ? '100%' : 'max-content',
          }}
        >
          <div
            style={{
              width: '40px',
              flexShrink: 0,
              textAlign: 'right',
              paddingRight: '8px',
              color: '#71717a',
              userSelect: 'none',
              lineHeight: '18px',
            }}
          >
            {idx + 1}
          </div>
          <pre
            style={{
              flex: wordWrap ? 1 : 'none',
              margin: 0,
              minWidth: 0,
              padding: 0,
              paddingRight: wordWrap ? 0 : '12px',
              background: 'transparent',
              color: 'inherit',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              lineHeight: '18px',
              whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
              overflowWrap: wordWrap ? 'anywhere' : 'normal',
              wordBreak: wordWrap ? 'break-word' : 'normal',
              tabSize: 2,
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      ))}
    </div>
  );
});

const formatFeSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/** Tree row — memoized so sibling folders don't all rework on one expand. */
const FeFileNode = memo(function FeFileNode({
  node,
  depth,
  isExpanded,
  isLoading,
  isActive,
  childNodes,
  expandedDirs,
  loadingDirs,
  dirCache,
  activeTabPath,
  onToggle,
  onOpen,
  onContextMenu,
  onMoreClick,
}: {
  node: FeDirEntry;
  depth: number;
  isExpanded: boolean;
  isLoading: boolean;
  isActive: boolean;
  childNodes: FeDirEntry[];
  expandedDirs: Record<string, boolean>;
  loadingDirs: Record<string, boolean>;
  dirCache: Record<string, FeDirEntry[]>;
  activeTabPath: string | null;
  onToggle: (path: string) => void;
  onOpen: (path: string, name: string, ext: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, name: string, isDir: boolean) => void;
  onMoreClick: (e: React.MouseEvent, path: string, name: string, isDir: boolean) => void;
}) {
  const isFolder = node.isDirectory;

  return (
    <div className="fe-tree-node-wrapper">
      <div
        className={`fe-tree-node ${isFolder ? 'folder' : 'file'}${isActive ? ' active' : ''}`}
        style={{
          paddingLeft: `${depth * 12}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: isActive ? '#152028' : 'transparent',
          borderRadius: '4px',
          margin: '1px 4px',
        }}
        onContextMenu={(e) => onContextMenu(e, node.path, node.name, isFolder)}
      >
        <div
          className="fe-node-content"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', node.path);
            e.dataTransfer.effectAllowed = 'copyMove';
            const img = new Image();
            img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
            e.dataTransfer.setDragImage(img, 0, 0);
          }}
          onClick={() => {
            if (isFolder) onToggle(node.path);
            else onOpen(node.path, node.name, node.ext);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            padding: '4px 6px',
            cursor: 'pointer',
            color: isActive ? '#7dd3fc' : '#e4e4e7',
            fontSize: '12px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {isFolder ? (
            <span
              className="fe-arrow-icon"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '12px',
                height: '12px',
                marginRight: '4px',
              }}
            >
              {isExpanded ? (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              ) : (
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </span>
          ) : (
            <span className="fe-arrow-placeholder" style={{ width: '16px' }} />
          )}
          <span className="fe-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginRight: '6px' }}>
            {isFolder ? (
              <FolderIcon size={13} style={{ color: '#fbbf24' }} />
            ) : (
              <FileIcon size={13} style={{ color: isActive ? '#7dd3fc' : '#94a3b8' }} />
            )}
          </span>
          <span className="fe-node-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {node.name}
          </span>
          {!isFolder && node.size > 0 && (
            <span className="fe-node-size" style={{ marginLeft: '4px' }}>
              ({formatFeSize(node.size)})
            </span>
          )}
          {isLoading && <span className="fe-loading-spinner" style={{ marginLeft: '4px' }}>...</span>}
        </div>

        <div className="fe-node-actions" style={{ paddingRight: '4px' }}>
          <button
            className="fe-act-btn"
            onClick={(e) => onMoreClick(e, node.path, node.name, isFolder)}
            title="More Actions"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              borderRadius: '3px',
            }}
          >
            <MoreIcon size={12} />
          </button>
        </div>
      </div>

      {isFolder && isExpanded && childNodes.length > 0 && (
        <div className="fe-tree-node-children">
          {childNodes.map((child) => (
            <FeFileNode
              key={child.path}
              node={child}
              depth={depth + 1}
              isExpanded={!!expandedDirs[child.path]}
              isLoading={!!loadingDirs[child.path]}
              isActive={!child.isDirectory && activeTabPath === child.path}
              childNodes={dirCache[child.path] || EMPTY_FE_CHILDREN}
              expandedDirs={expandedDirs}
              loadingDirs={loadingDirs}
              dirCache={dirCache}
              activeTabPath={activeTabPath}
              onToggle={onToggle}
              onOpen={onOpen}
              onContextMenu={onContextMenu}
              onMoreClick={onMoreClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  // Skip re-render when another folder toggles (collapsed nodes ignore expandedDirs churn)
  if (prev.node !== next.node || prev.depth !== next.depth) return false;
  if (prev.isExpanded !== next.isExpanded || prev.isLoading !== next.isLoading || prev.isActive !== next.isActive) return false;
  if (prev.childNodes !== next.childNodes) return false;
  if (prev.activeTabPath !== next.activeTabPath) return false;
  if (
    prev.onToggle !== next.onToggle ||
    prev.onOpen !== next.onOpen ||
    prev.onContextMenu !== next.onContextMenu ||
    prev.onMoreClick !== next.onMoreClick
  ) {
    return false;
  }
  if (next.isExpanded) {
    if (
      prev.expandedDirs !== next.expandedDirs ||
      prev.loadingDirs !== next.loadingDirs ||
      prev.dirCache !== next.dirCache
    ) {
      return false;
    }
  }
  return true;
});

const EMPTY_FE_CHILDREN: FeDirEntry[] = [];

const SidebarIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
  </svg>
);

function FileExplorerPanel({ isTreeCollapsed, setIsTreeCollapsed }: { isTreeCollapsed: boolean; setIsTreeCollapsed: React.Dispatch<React.SetStateAction<boolean>> }) {
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const activePaneId = useDeckStore((state) => state.activePaneId);
  const workspaces = useDeckStore((state) => state.workspaces);

  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId);
  }, [workspaces, activeWorkspaceId]);

  const rootPath = activeWorkspace?.rootPath || '';

  const [dirCache, setDirCache] = useState<Record<string, FeDirEntry[]>>({});
  const dirCacheRef = useRef(dirCache);
  dirCacheRef.current = dirCache;

  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const [loadingDirs, setLoadingDirs] = useState<Record<string, boolean>>({});

  // Opened Tabs and Active File state
  const [openedTabs, setOpenedTabs] = useState<OpenedTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showFindWidget, setShowFindWidget] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findMatchIndex, setFindMatchIndex] = useState(0);
  const [showGoToLineWidget, setShowGoToLineWidget] = useState(false);
  const [goToLineNumber, setGoToLineNumber] = useState('');
  const [isVisualMode, setIsVisualMode] = useState(false);
  // Optimistic: button uses wordWrap instantly; content uses deferred value so large files don't block the click.
  const [wordWrap, setWordWrap] = useState(() => {
    try {
      return localStorage.getItem('agentdeck:fe-word-wrap') !== '0';
    } catch {
      return true;
    }
  });
  const contentWordWrap = useDeferredValue(wordWrap);
  const isWrapPending = contentWordWrap !== wordWrap;
  const visualIframeRef = useRef<HTMLIFrameElement>(null);

  // Tree | code splitter — DOM-only during drag to avoid re-rendering code lines
  const [treeWidth, setTreeWidth] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem('agentdeck:fe-tree-width') || '', 10);
      return Number.isFinite(saved) && saved >= 180 && saved <= 520 ? saved : 260;
    } catch {
      return 260;
    }
  });
  const fePanelRef = useRef<HTMLDivElement>(null);
  const isFeSplitResizingRef = useRef(false);
  const treeWidthRef = useRef(treeWidth);
  const feSplitRafRef = useRef(0);
  const feSplitGuideRef = useRef<HTMLDivElement | null>(null);
  const feSplitOverlayRef = useRef<HTMLDivElement | null>(null);
  const feSplitGuideXRef = useRef(0);
  const isTreeCollapsedRef = useRef(isTreeCollapsed);
  treeWidthRef.current = treeWidth;
  isTreeCollapsedRef.current = isTreeCollapsed;

  const toggleWordWrap = useCallback(() => {
    setWordWrap((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('agentdeck:fe-word-wrap', next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const cleanupFeSplitGhost = useCallback(() => {
    if (feSplitRafRef.current) {
      cancelAnimationFrame(feSplitRafRef.current);
      feSplitRafRef.current = 0;
    }
    feSplitGuideRef.current?.remove();
    feSplitGuideRef.current = null;
    feSplitOverlayRef.current?.remove();
    feSplitOverlayRef.current = null;
    fePanelRef.current?.classList.remove('is-fe-splitting');
  }, []);

  const startFeSplitResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFeSplitResizingRef.current || !fePanelRef.current) return;
    isFeSplitResizingRef.current = true;
    fePanelRef.current.classList.add('is-fe-splitting');

    const startX = e.clientX;
    feSplitGuideXRef.current = startX;

    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:999998;cursor:col-resize;user-select:none;touch-action:none;';
    document.body.appendChild(overlay);
    feSplitOverlayRef.current = overlay;

    const rect = fePanelRef.current.getBoundingClientRect();
    const guide = document.createElement('div');
    guide.style.cssText = [
      'position:fixed',
      `top:${rect.top}px`,
      `height:${rect.height}px`,
      'width:2px',
      `left:${startX}px`,
      'z-index:999999',
      'pointer-events:none',
      'background:#38bdf8',
      'box-shadow:0 0 0 1px rgba(56,189,248,0.35), 0 0 10px rgba(56,189,248,0.4)',
    ].join(';');
    document.body.appendChild(guide);
    feSplitGuideRef.current = guide;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isFeSplitResizingRef.current || !fePanelRef.current) return;
      const rect = fePanelRef.current.getBoundingClientRect();
      const next = Math.min(520, Math.max(180, e.clientX - rect.left));
      treeWidthRef.current = next;
      feSplitGuideXRef.current = rect.left + next;
      // Ghost line only — grid layout frozen until mouseup
      if (feSplitRafRef.current) return;
      feSplitRafRef.current = requestAnimationFrame(() => {
        feSplitRafRef.current = 0;
        if (feSplitGuideRef.current) {
          feSplitGuideRef.current.style.left = `${feSplitGuideXRef.current}px`;
        }
      });
    };
    const onUp = () => {
      if (!isFeSplitResizingRef.current) return;
      isFeSplitResizingRef.current = false;
      cleanupFeSplitGhost();
      const finalWidth = treeWidthRef.current;
      // One layout pass after drag
      setTreeWidth(finalWidth);
      try {
        localStorage.setItem('agentdeck:fe-tree-width', String(finalWidth));
      } catch {
        /* ignore */
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      cleanupFeSplitGhost();
    };
  }, [cleanupFeSplitGhost]);

  const activeTab = useMemo(() => {
    return openedTabs.find((t) => t.path === activeTabPath) || null;
  }, [openedTabs, activeTabPath]);

  const matchIndices = useMemo(() => {
    if (!findQuery || !activeTab) return [];
    const text = isEditing ? editDraft : activeTab.content;
    const indices: number[] = [];
    let idx = text.toLowerCase().indexOf(findQuery.toLowerCase());
    while (idx !== -1) {
      indices.push(idx);
      idx = text.toLowerCase().indexOf(findQuery.toLowerCase(), idx + findQuery.length);
    }
    return indices;
  }, [findQuery, activeTab, isEditing, editDraft]);

  useEffect(() => {
    setFindMatchIndex(0);
  }, [findQuery]);

  // Search in files state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    path: string;
    relPath: string;
    line: number;
    text: string;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Inline dialog state
  const [activeModal, setActiveModal] = useState<{
    type: 'create-file' | 'create-folder' | 'rename';
    parentPath: string;
    currentName?: string;
  } | null>(null);
  const [modalInput, setModalInput] = useState('');

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    path: string;
    name: string;
    isDirectory: boolean;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const handleGlobalClose = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClose);
    window.addEventListener('contextmenu', handleGlobalClose);
    return () => {
      window.removeEventListener('click', handleGlobalClose);
      window.removeEventListener('contextmenu', handleGlobalClose);
    };
  }, []);

  const loadDir = useCallback(async (path: string, forceReload = false) => {
    if (!forceReload && dirCacheRef.current[path]) return;
    setLoadingDirs((prev) => (prev[path] ? prev : { ...prev, [path]: true }));
    try {
      const res = await window.agentDeck.readDir(path);
      if (res.ok) {
        setDirCache((prev) => ({ ...prev, [path]: res.data as FeDirEntry[] }));
      }
    } catch (err) {
      console.error('Failed to read directory:', err);
    } finally {
      setLoadingDirs((prev) => {
        if (!prev[path]) return prev;
        const next = { ...prev };
        delete next[path];
        return next;
      });
    }
  }, []);

  useEffect(() => {
    if (rootPath) {
      void loadDir(rootPath, true);
      setExpandedDirs({ [rootPath]: true });
    }
  }, [rootPath, loadDir]);

  // Optimistic: flip chevron immediately; fetch children in background if needed.
  const toggleExpand = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const willExpand = !prev[path];
      if (willExpand && !dirCacheRef.current[path]) {
        void loadDir(path);
      }
      return { ...prev, [path]: willExpand };
    });
  }, [loadDir]);

  const openedTabsRef = useRef(openedTabs);
  openedTabsRef.current = openedTabs;

  const handleOpenFile = useCallback(async (filePath: string, fileName: string, fileExt: string) => {
    if (openedTabsRef.current.some((t) => t.path === filePath)) {
      setActiveTabPath(filePath);
      return;
    }

    setIsLoadingContent(true);
    try {
      const res = await window.agentDeck.readWorkspaceFile(rootPath, filePath);
      if (res.ok) {
        const newTab: OpenedTab = {
          path: filePath,
          name: fileName,
          content: res.data,
          ext: fileExt
        };
        setOpenedTabs((prev) => (prev.some((t) => t.path === filePath) ? prev : [...prev, newTab]));
        setActiveTabPath(filePath);
      } else {
        alert(`Failed to read file: ${res.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to read workspace file:', err);
      alert(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoadingContent(false);
    }
  }, [rootPath]);

  const handleCloseTab = (filePath: string) => {
    setOpenedTabs((prev) => prev.filter((t) => t.path !== filePath));
    if (activeTabPath === filePath) {
      const remaining = openedTabs.filter((t) => t.path !== filePath);
      setActiveTabPath(remaining.length > 0 ? remaining[remaining.length - 1].path : null);
    }
    setIsEditing(false);
    setEditDraft('');
  };

  const handleStartEdit = (content: string) => {
    setEditDraft(content);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditDraft('');
  };

  const handleSaveEdit = async () => {
    if (!activeTabPath || !rootPath) return;
    setIsSaving(true);
    try {
      const res = await window.agentDeck.writeWorkspaceFile(rootPath, activeTabPath, editDraft);
      if (res.ok) {
        setOpenedTabs((prev) => prev.map((t) =>
          t.path === activeTabPath ? { ...t, content: editDraft } : t
        ));
        setIsEditing(false);
        setEditDraft('');
      } else {
        alert(`Failed to save: ${res.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFindNext = () => {
    if (matchIndices.length === 0) return;
    setFindMatchIndex((prev) => (prev + 1) % matchIndices.length);
  };

  const handleFindPrev = () => {
    if (matchIndices.length === 0) return;
    setFindMatchIndex((prev) => (prev - 1 + matchIndices.length) % matchIndices.length);
  };

  // Sync visual editor content back to code before saving
  const handleSaveVisual = async () => {
    if (!activeTabPath || !rootPath || !visualIframeRef.current) return;
    const iframeDoc = visualIframeRef.current.contentDocument;
    if (!iframeDoc) return;
    const html = '<!DOCTYPE html>\n' + iframeDoc.documentElement.outerHTML;
    setIsSaving(true);
    try {
      const res = await window.agentDeck.writeWorkspaceFile(rootPath, activeTabPath, html);
      if (res.ok) {
        setOpenedTabs((prev) => prev.map((t) =>
          t.path === activeTabPath ? { ...t, content: html } : t
        ));
      } else {
        alert(`Failed to save: ${res.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Scroll active match in view mode
  useEffect(() => {
    if (showFindWidget && findQuery && !isEditing) {
      const activeEl = document.getElementById('active-search-match');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [showFindWidget, findQuery, findMatchIndex, isEditing]);

  // Select and scroll active match in edit mode (textarea)
  useEffect(() => {
    if (isEditing && showFindWidget && findQuery && matchIndices.length > 0) {
      const textarea = document.querySelector('.fe-panel textarea') as HTMLTextAreaElement;
      if (textarea) {
        const activeIdx = Math.abs(findMatchIndex) % matchIndices.length;
        const startPos = matchIndices[activeIdx];
        const endPos = startPos + findQuery.length;
        textarea.focus();
        textarea.setSelectionRange(startPos, endPos);
        
        // Scroll to cursor in textarea
        const fullText = textarea.value;
        const beforeText = fullText.substring(0, startPos);
        const lines = beforeText.split('\n');
        const lineCount = lines.length;
        const lineHeight = 18;
        const scrollTop = Math.max(0, (lineCount - 5) * lineHeight);
        textarea.scrollTop = scrollTop;
      }
    }
  }, [findMatchIndex, matchIndices, isEditing, showFindWidget, findQuery]);

  const handleGoToLine = (lineNumStr: string) => {
    const lineNum = parseInt(lineNumStr, 10);
    if (isNaN(lineNum) || lineNum < 1 || !activeTab) return;

    const lines = (isEditing ? editDraft : activeTab.content).split('\n');
    const targetLineIdx = Math.min(lineNum, lines.length) - 1;
    
    // Calculate character start position of targetLineIdx
    let charIdx = 0;
    for (let i = 0; i < targetLineIdx; i++) {
      charIdx += lines[i].length + 1; // +1 for '\n'
    }

    if (isEditing) {
      const textarea = document.querySelector('.fe-panel textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(charIdx, charIdx);
        // Scroll to the line
        const lineHeight = 18;
        textarea.scrollTop = Math.max(0, (targetLineIdx - 5) * lineHeight);
      }
    } else {
      const lineEl = document.querySelector(`.fe-panel [data-fe-line="${targetLineIdx}"]`) as HTMLElement | null;
      if (lineEl) {
        lineEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }

    setShowGoToLineWidget(false);
    setGoToLineNumber('');
  };

  // Global keyboard shortcuts (Ctrl+S, Ctrl+F, Ctrl+G, Ctrl+B, Ctrl+Shift+F, Escape)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      // Ctrl + B (Toggle Sidebar)
      if (isCtrl && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsTreeCollapsed((prev) => !prev);
        return;
      }

      // Ctrl + Shift + F (Search in project files)
      if (isCtrl && isShift && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setIsTreeCollapsed(false);
        setTimeout(() => {
          const searchInput = document.querySelector('.fe-search-box input') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }, 80);
        return;
      }

      if (!activeTabPath) return;

      const activeEl = document.activeElement;
      if (activeEl && (activeEl.closest('.xterm') || activeEl.closest('.terminal-pane') || activeEl.tagName === 'IFRAME')) {
        return;
      }

      // Ctrl+S
      if (isCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isEditing) {
          void handleSaveEdit();
        } else {
          if (activeTab) {
            handleStartEdit(activeTab.content);
          }
        }
        return;
      }

      // Ctrl+F (Find in file)
      if (isCtrl && !isShift && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setShowGoToLineWidget(false);
        setShowFindWidget(true);
        setTimeout(() => {
          const input = document.getElementById('code-find-input');
          if (input) {
            (input as HTMLInputElement).focus();
            (input as HTMLInputElement).select();
          }
        }, 50);
        return;
      }

      // Ctrl+G (Go to line)
      if (isCtrl && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        setShowFindWidget(false);
        setShowGoToLineWidget(true);
        setTimeout(() => {
          const input = document.getElementById('code-goto-line-input');
          if (input) {
            (input as HTMLInputElement).focus();
            (input as HTMLInputElement).select();
          }
        }, 50);
        return;
      }

      // Escape key to close Widgets
      if (e.key === 'Escape') {
        if (showFindWidget) {
          e.preventDefault();
          setShowFindWidget(false);
          setFindQuery('');
        }
        if (showGoToLineWidget) {
          e.preventDefault();
          setShowGoToLineWidget(false);
          setGoToLineNumber('');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [activeTabPath, isEditing, editDraft, activeTab, showFindWidget, showGoToLineWidget, matchIndices]);

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    // Helper to run execCommand while preserving selection and undo stack
    const insertText = (text: string) => {
      textarea.focus();
      document.execCommand('insertText', false, text);
    };

    // 1. Tab / Shift+Tab for Indent / Outdent
    if (e.key === 'Tab') {
      e.preventDefault();
      
      if (!isShift) {
        // Insert 2 spaces at cursor (replaces selection if any)
        insertText('  ');
      } else {
        // Shift+Tab: outdent current line
        const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        // Check if there are spaces at the start of current line
        const currentLine = value.substring(lineStart, selectionEnd);
        const leadingSpaces = currentLine.match(/^\s*/)?.[0] || '';
        
        if (leadingSpaces.length > 0) {
          const spacesToRemove = Math.min(leadingSpaces.length, 2);
          // Set selection to the start of the line spaces
          textarea.setSelectionRange(lineStart, lineStart + spacesToRemove);
          // Delete them
          document.execCommand('delete');
          // Restore cursor position after React completes re-rendering
          const newCursor = Math.max(lineStart, selectionStart - spacesToRemove);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(newCursor, newCursor);
          }, 0);
        }
      }
      return;
    }

    // 2. Ctrl + Shift + M (Indent / Push text)
    if (isCtrl && isShift && e.key.toLowerCase() === 'm') {
      e.preventDefault();
      insertText('  ');
      return;
    }

    // 2.1. Alt + Up Arrow (Move line up)
    if (e.altKey && !e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault();
      
      const currentLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      let currentLineEnd = value.indexOf('\n', selectionStart);
      if (currentLineEnd === -1) currentLineEnd = value.length;
      
      if (currentLineStart === 0) return; // Cannot move top line up!
      
      const prevLineStart = value.lastIndexOf('\n', currentLineStart - 2) + 1;
      const prevLineEnd = currentLineStart - 1;

      const currentLineText = value.substring(currentLineStart, currentLineEnd);
      const prevLineText = value.substring(prevLineStart, prevLineEnd);

      const totalBlockStart = prevLineStart;
      const totalBlockEnd = currentLineEnd;

      const cursorOffsetInLine = selectionStart - currentLineStart;

      textarea.setSelectionRange(totalBlockStart, totalBlockEnd);
      
      const newBlockText = currentLineText + '\n' + prevLineText;
      insertText(newBlockText);

      const newCursorPos = prevLineStart + cursorOffsetInLine;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
      return;
    }

    // 2.2. Alt + Down Arrow (Move line down)
    if (e.altKey && !e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault();
      
      const currentLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      let currentLineEnd = value.indexOf('\n', selectionStart);
      if (currentLineEnd === -1) currentLineEnd = value.length;
      
      if (currentLineEnd === value.length) return; // Cannot move bottom line down!
      
      const nextLineStart = currentLineEnd + 1;
      let nextLineEnd = value.indexOf('\n', nextLineStart);
      if (nextLineEnd === -1) nextLineEnd = value.length;

      const currentLineText = value.substring(currentLineStart, currentLineEnd);
      const nextLineText = value.substring(nextLineStart, nextLineEnd);

      const totalBlockStart = currentLineStart;
      const totalBlockEnd = nextLineEnd;

      const cursorOffsetInLine = selectionStart - currentLineStart;

      textarea.setSelectionRange(totalBlockStart, totalBlockEnd);
      
      const newBlockText = nextLineText + '\n' + currentLineText;
      insertText(newBlockText);

      const newCursorPos = currentLineStart + nextLineText.length + 1 + cursorOffsetInLine;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
      return;
    }

    // 2.3. Shift + Alt + Up (Duplicate line up)
    if (e.altKey && e.shiftKey && e.key === 'ArrowUp') {
      e.preventDefault();
      
      const currentLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      let currentLineEnd = value.indexOf('\n', selectionStart);
      if (currentLineEnd === -1) currentLineEnd = value.length;

      const currentLineText = value.substring(currentLineStart, currentLineEnd);
      
      textarea.setSelectionRange(currentLineStart, currentLineStart);
      insertText(currentLineText + '\n');
      
      const cursorOffsetInLine = selectionStart - currentLineStart;
      const newCursorPos = currentLineStart + currentLineText.length + 1 + cursorOffsetInLine;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
      return;
    }

    // 2.4. Shift + Alt + Down (Duplicate line down)
    if (e.altKey && e.shiftKey && e.key === 'ArrowDown') {
      e.preventDefault();
      
      const currentLineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      let currentLineEnd = value.indexOf('\n', selectionStart);
      if (currentLineEnd === -1) currentLineEnd = value.length;

      const currentLineText = value.substring(currentLineStart, currentLineEnd);
      
      textarea.setSelectionRange(currentLineEnd, currentLineEnd);
      insertText('\n' + currentLineText);
      
      const cursorOffsetInLine = selectionStart - currentLineStart;
      const newCursorPos = currentLineStart + cursorOffsetInLine;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
      return;
    }

    // 2.5. Ctrl + Shift + K (Delete Line)
    if (isCtrl && isShift && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      let lineEnd = value.indexOf('\n', selectionEnd);
      if (lineEnd === -1) {
        lineEnd = value.length;
      } else {
        lineEnd += 1; // Include the newline character itself
      }

      textarea.setSelectionRange(lineStart, lineEnd);
      document.execCommand('delete');
      return;
    }

    // 3. Ctrl + Enter (Insert line below)
    if (isCtrl && !isShift && e.key === 'Enter') {
      e.preventDefault();
      
      // Find end of current line
      const nextNewLine = value.indexOf('\n', selectionStart);
      const insertPos = nextNewLine === -1 ? value.length : nextNewLine;
      
      // Calculate current line indentation
      const before = value.substring(0, insertPos);
      const lastLineStart = before.lastIndexOf('\n') + 1;
      const currentLine = before.substring(lastLineStart);
      const indentMatch = currentLine.match(/^\s*/);
      const indent = indentMatch ? indentMatch[0] : '';

      // Move cursor to insertion position
      textarea.setSelectionRange(insertPos, insertPos);
      // Insert new line with indentation
      insertText('\n' + indent);

      // Force cursor to correct position after render
      const targetPos = insertPos + 1 + indent.length;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(targetPos, targetPos);
      }, 0);
      return;
    }

    // 4. Ctrl + Shift + Enter (Insert line above)
    if (isCtrl && isShift && e.key === 'Enter') {
      e.preventDefault();
      
      // Find start of current line
      const lastNewLine = value.lastIndexOf('\n', selectionStart - 1);
      const insertPos = lastNewLine === -1 ? 0 : lastNewLine + 1;
      
      // Calculate current line indentation
      const currentLineStart = lastNewLine + 1;
      const currentLineEnd = value.indexOf('\n', selectionStart);
      const currentLine = value.substring(currentLineStart, currentLineEnd === -1 ? value.length : currentLineEnd);
      const indentMatch = currentLine.match(/^\s*/);
      const indent = indentMatch ? indentMatch[0] : '';

      // Move cursor to start of line
      textarea.setSelectionRange(insertPos, insertPos);
      // Insert new line with indentation
      insertText(indent + '\n');
      
      // Place cursor at the start of the new line after render
      const cursorTarget = insertPos + indent.length;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorTarget, cursorTarget);
      }, 0);
      return;
    }

    // 5. Ctrl + / (Toggle Comment)
    if (isCtrl && e.key === '/') {
      e.preventDefault();
      
      // Find exact bounds of the current selected line(s)
      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      let lineEnd = value.indexOf('\n', selectionEnd);
      if (lineEnd === -1) lineEnd = value.length;
      
      const targetText = value.substring(lineStart, lineEnd);
      const lines = targetText.split('\n');
      
      const isShellOrPython = activeTab?.ext === '.py' || activeTab?.ext === '.sh' || activeTab?.ext === '.yaml' || activeTab?.ext === '.yml';
      const commentStr = isShellOrPython ? '# ' : '// ';
      const commentRegex = isShellOrPython ? /^\s*#\s?/ : /^\s*\/\/\s?/;

      const allCommented = lines.every(line => !line.trim() || commentRegex.test(line));
      
      let newLines: string[];
      if (allCommented) {
        newLines = lines.map(line => line.replace(commentRegex, ''));
      } else {
        newLines = lines.map(line => {
          if (!line.trim()) return line;
          const indentMatch = line.match(/^\s*/);
          const indent = indentMatch ? indentMatch[0] : '';
          const content = line.substring(indent.length);
          return indent + commentStr + content;
        });
      }
      
      const newTargetText = newLines.join('\n');
      
      // Select the entire block
      textarea.setSelectionRange(lineStart, lineEnd);
      // Replace with new commented/uncommented text
      insertText(newTargetText);
      
      // Keep block highlighted after render completes
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(lineStart, lineStart + newTargetText.length);
      }, 0);
      return;
    }
  };


  const handleCopyContent = (content: string) => {
    void navigator.clipboard.writeText(content);
    alert('Code copied to clipboard!');
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyPath = (absolutePath: string, isRelative: boolean) => {
    let pathText = absolutePath;
    if (isRelative && rootPath) {
      pathText = pathText.replace(rootPath, '');
      if (pathText.startsWith('\\') || pathText.startsWith('/')) {
        pathText = pathText.slice(1);
      }
    }
    void navigator.clipboard.writeText(pathText);
  };

  const handleInjectPath = (path: string) => {
    if (!activePaneId) {
      alert('Please select a Terminal Pane first.');
      return;
    }
    window.agentDeck.terminalWrite(activePaneId, `"${path}"`);
  };

  const getParentPath = (filePath: string) => {
    const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
    if (lastSlash === -1) return rootPath;
    return filePath.substring(0, lastSlash);
  };

  const handleDeletePath = async (targetPath: string, name: string) => {
    const confirmDelete = confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`);
    if (!confirmDelete) return;

    const parentDirPath = getParentPath(targetPath);

    try {
      const res = await window.agentDeck.deletePath(rootPath, targetPath);
      if (res.ok) {
        await loadDir(parentDirPath, true);
        handleCloseTab(targetPath);
        setExpandedDirs((prev) => {
          const next = { ...prev };
          delete next[targetPath];
          return next;
        });
        setDirCache((prev) => {
          const next = { ...prev };
          delete next[targetPath];
          return next;
        });
      } else {
        alert(`Failed to delete: ${res.error?.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error deleting path:', err);
      alert('Failed to delete path.');
    }
  };

  const handleCreateFile = (parentDirPath: string) => {
    setActiveModal({ type: 'create-file', parentPath: parentDirPath });
    setModalInput('');
  };

  const handleCreateFolder = (parentDirPath: string) => {
    setActiveModal({ type: 'create-folder', parentPath: parentDirPath });
    setModalInput('');
  };

  const handleRenamePath = (targetPath: string, currentName: string) => {
    setActiveModal({ type: 'rename', parentPath: targetPath, currentName });
    setModalInput(currentName);
  };

  const handleModalSubmit = async () => {
    if (!activeModal || !modalInput.trim()) return;
    const name = modalInput.trim();
    const targetPath = activeModal.parentPath;

    if (activeModal.type === 'create-file') {
      const separator = targetPath.includes('\\') ? '\\' : '/';
      const newPath = targetPath.endsWith(separator) 
        ? `${targetPath}${name}`
        : `${targetPath}${separator}${name}`;

      try {
        const res = await window.agentDeck.createFile(rootPath, newPath);
        if (res.ok) {
          await loadDir(targetPath, true);
          setExpandedDirs((prev) => ({ ...prev, [targetPath]: true }));
          setActiveModal(null);
        } else {
          alert(`Failed to create file: ${res.error?.message || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('Error creating file:', err);
        alert('Failed to create file.');
      }
    } else if (activeModal.type === 'create-folder') {
      const separator = targetPath.includes('\\') ? '\\' : '/';
      const newPath = targetPath.endsWith(separator) 
        ? `${targetPath}${name}`
        : `${targetPath}${separator}${name}`;

      try {
        const res = await window.agentDeck.createDir(rootPath, newPath);
        if (res.ok) {
          await loadDir(targetPath, true);
          setExpandedDirs((prev) => ({ ...prev, [targetPath]: true }));
          setActiveModal(null);
        } else {
          alert(`Failed to create folder: ${res.error?.message || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('Error creating folder:', err);
        alert('Failed to create folder.');
      }
    } else if (activeModal.type === 'rename') {
      const currentName = activeModal.currentName || '';
      if (name === currentName) {
        setActiveModal(null);
        return;
      }
      const parentDirPath = getParentPath(targetPath);
      const separator = targetPath.includes('\\') ? '\\' : '/';
      const newPath = parentDirPath.endsWith(separator)
        ? `${parentDirPath}${name}`
        : `${parentDirPath}${separator}${name}`;

      try {
        const res = await window.agentDeck.renamePath(rootPath, targetPath, newPath);
        if (res.ok) {
          await loadDir(parentDirPath, true);
          setExpandedDirs((prev) => {
            const next = { ...prev };
            delete next[targetPath];
            return next;
          });
          setDirCache((prev) => {
            const next = { ...prev };
            delete next[targetPath];
            Object.keys(next).forEach((key) => {
              if (key === targetPath || key.startsWith(targetPath + '\\') || key.startsWith(targetPath + '/')) {
                delete next[key];
              }
            });
            return next;
          });
          setActiveModal(null);
        } else {
          alert(`Failed to rename: ${res.error?.message || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('Error renaming path:', err);
        alert('Failed to rename.');
      }
    }
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, path: string, name: string, isDirectory: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    
    const menuWidth = 160;
    const menuHeight = isDirectory ? 230 : 160;
    let x = e.clientX;
    let y = e.clientY;
    
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 8;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 8;
    }
    if (x < 0) x = 8;
    if (y < 0) y = 8;

    setContextMenu({
      path,
      name,
      isDirectory,
      x,
      y
    });
  }, []);

  const handleMoreClick = useCallback((e: React.MouseEvent, path: string, name: string, isDirectory: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    
    const menuWidth = 160;
    const menuHeight = isDirectory ? 230 : 160;
    let x = rect.left;
    let y = rect.bottom + 4;
    
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 8;
    }
    if (y + menuHeight > window.innerHeight) {
      y = rect.top - menuHeight - 4;
    }
    if (x < 0) x = 8;
    if (y < 0) y = 8;

    setContextMenu({
      path,
      name,
      isDirectory,
      x,
      y
    });
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootPath) return;
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchedQuery('');
      setSearchError('');
      return;
    }
    setIsSearching(true);
    setSearchedQuery(q);
    setSearchError('');
    try {
      const res = await window.agentDeck.searchWorkspace(rootPath, q);
      if (res.ok) {
        setSearchResults(res.data);
      } else {
        setSearchError(res.error?.message || 'Error searching for files.');
      }
    } catch (err) {
      console.error('Failed to search workspace:', err);
      setSearchError('IPC connection error during search.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchedQuery('');
    setSearchResults([]);
    setSearchError('');
  };

  if (!rootPath) {
    return (
      <div className="fe-panel empty">
        <p>Workspace does not have a valid root path.</p>
      </div>
    );
  }

  const rootChildren = dirCache[rootPath] || [];

  return (
    <div
      ref={fePanelRef}
      className="fe-panel"
      style={{
        display: 'grid',
        gridTemplateColumns: isTreeCollapsed ? '1fr' : `${treeWidth}px minmax(0, 1fr)`,
        height: '100%',
        width: '100%',
        position: 'relative',
        background: '#0d0d0f'
      }}
    >
      {/* Left Column: Explorer Tree & Search */}
      {!isTreeCollapsed && (
        <div style={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #27272a',
          background: '#0d0d0f',
          height: '100%',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div className="fe-header" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>File Explorer</h2>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  className="fe-act-btn"
                  onClick={() => handleCreateFile(rootPath)}
                  title="Create File in Root"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px' }}
                >
                  <FileIcon size={11} />
                  <span>File</span>
                </button>
                <button
                  className="fe-act-btn"
                  onClick={() => handleCreateFolder(rootPath)}
                  title="Create Folder in Root"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px' }}
                >
                  <FolderIcon size={11} />
                  <span>Folder</span>
                </button>
                <button
                  onClick={() => setIsTreeCollapsed(true)}
                  title="Collapse Sidebar"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '3px',
                    background: 'transparent',
                    border: 'none',
                    color: '#a1a1aa',
                    cursor: 'pointer',
                    borderRadius: '3px',
                    marginLeft: '2px'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#e4e4e7'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#a1a1aa'}
                >
                  <SidebarIcon size={12} />
                </button>
              </div>
            </div>
          <div className="fe-root-meta" title={rootPath} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <strong>Root:</strong> {rootPath}
          </div>
        </div>

        <div className="fe-search-box" style={{ padding: '10px 12px 12px', borderBottom: '1px solid #27272a' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search in files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                height: '26px',
                padding: '0 8px',
                borderRadius: '4px',
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#f4f4f5',
                fontSize: '12px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <button
              type="submit"
              title="Search"
              disabled={!searchQuery.trim() || isSearching}
              style={{
                height: '26px',
                padding: '0 8px',
                borderRadius: '4px',
                background: searchQuery.trim() ? '#0f1f2a' : '#18181b',
                border: searchQuery.trim() ? '1px solid #1e4a5f' : '1px solid #27272a',
                color: searchQuery.trim() ? '#7dd3fc' : '#a1a1aa',
                fontSize: '11px',
                fontWeight: 500,
                cursor: searchQuery.trim() ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                flexShrink: 0,
                boxSizing: 'border-box'
              }}
            >
              <ZoomIcon size={11} />
              <span>Search</span>
            </button>
            {(searchQuery || searchedQuery) && (
              <button
                type="button"
                onClick={handleClearSearch}
                title="Clear Search"
                style={{
                  height: '26px',
                  padding: '0 8px',
                  borderRadius: '4px',
                  background: '#27272a',
                  border: '1px solid #3f3f46',
                  color: '#d4d4d8',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxSizing: 'border-box'
                }}
              >
                Clear
              </button>
            )}
          </form>
        </div>

        <div className="fe-body" style={{ flex: 1, overflowY: 'auto', paddingTop: '8px' }}>
          {searchedQuery ? (
            <div className="fe-search-results" style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ fontSize: '11.5px', color: '#a1a1aa', fontWeight: 500 }}>
                  {isSearching ? 'Searching...' : `Found ${searchResults.length} results`}
                </span>
              </div>

              {searchError && (
                <div style={{ color: '#fca5a5', fontSize: '11.5px', fontWeight: 500, padding: '8px 10px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.28)', borderRadius: '4px', lineHeight: 1.45 }}>
                  {searchError}
                </div>
              )}

              {!isSearching && searchResults.length === 0 && !searchError && (
                <div style={{ color: '#a1a1aa', fontSize: '12px', textAlign: 'center', marginTop: '15px' }}>
                  No matches for "{searchedQuery}".
                </div>
              )}

              {searchResults.map((result, idx) => (
                <div
                  key={idx}
                  className="fe-search-result-card"
                  onClick={() => {
                    const ext = result.path.substring(result.path.lastIndexOf('.'));
                    const lastSlash = Math.max(result.path.lastIndexOf('/'), result.path.lastIndexOf('\\'));
                    const name = lastSlash !== -1 ? result.path.substring(lastSlash + 1) : result.path;
                    void handleOpenFile(result.path, name, ext);
                  }}
                  style={{
                    background: '#141416',
                    border: '1px solid #27272a',
                    borderRadius: '4px',
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#1c1c1e'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#141416'}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#7dd3fc', wordBreak: 'break-all' }}>
                      {result.relPath}
                    </span>
                    <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
                      Line {result.line}
                    </span>
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: '6px',
                      background: '#0d0d0f',
                      borderLeft: '2px solid #38bdf8',
                      borderRadius: '2px',
                      fontFamily: 'monospace',
                      fontSize: '11.5px',
                      color: '#e4e4e7',
                      overflowX: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {result.text}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            rootChildren.length === 0 && loadingDirs[rootPath] ? (
              <div className="fe-loading" style={{ padding: '12px' }}>Scanning folder...</div>
            ) : rootChildren.length === 0 ? (
              <div className="fe-empty" style={{ padding: '12px' }}>Empty folder or inaccessible.</div>
            ) : (
              <div className="fe-tree-root">
                {rootChildren.map((child) => (
                  <FeFileNode
                    key={child.path}
                    node={child}
                    depth={0}
                    isExpanded={!!expandedDirs[child.path]}
                    isLoading={!!loadingDirs[child.path]}
                    isActive={!child.isDirectory && activeTabPath === child.path}
                    childNodes={dirCache[child.path] || EMPTY_FE_CHILDREN}
                    expandedDirs={expandedDirs}
                    loadingDirs={loadingDirs}
                    dirCache={dirCache}
                    activeTabPath={activeTabPath}
                    onToggle={toggleExpand}
                    onOpen={handleOpenFile}
                    onContextMenu={handleContextMenu}
                    onMoreClick={handleMoreClick}
                  />
                ))}
              </div>
            )
          )}
        </div>
          {/* Tree | code drag handle — DOM-only width during drag */}
          <div
            className="fe-split-handle"
            onMouseDown={startFeSplitResize}
            title="Drag to resize"
            style={{
              position: 'absolute',
              top: 0,
              right: -3,
              bottom: 0,
              width: '6px',
              cursor: 'col-resize',
              zIndex: 20,
              background: 'transparent'
            }}
          />
      </div>
      )}

      {/* Right Column: Code Viewer */}
      <div
        className="fe-code-column"
        style={{
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#121214',
          height: '100%',
          overflow: 'hidden',
          contain: 'layout style'
        }}
      >
        {isLoadingContent ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #1e4a5f', borderTopColor: '#38bdf8', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: '#a1a1aa', fontSize: '12px', fontWeight: 500 }}>Loading file content...</span>
          </div>
        ) : openedTabs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* 2-row chrome: tabs full-width, then actions — not cramped on one strip */}
            <div className="code-header fe-code-chrome">
              {/* Row 1 — open tabs */}
              <div className="fe-code-tabs-row">
                {isTreeCollapsed && (
                  <button
                    type="button"
                    className="fe-code-sidebar-btn"
                    onClick={() => setIsTreeCollapsed(false)}
                    title="Show File Explorer"
                  >
                    <SidebarIcon size={14} />
                  </button>
                )}
                <div className="fe-code-tabs-scroll">
                  {openedTabs.map((tab) => {
                    const isActive = tab.path === activeTabPath;
                    return (
                      <button
                        key={tab.path}
                        type="button"
                        className={`fe-code-tab${isActive ? ' is-active' : ''}`}
                        onClick={() => setActiveTabPath(tab.path)}
                        title={tab.path}
                      >
                        <span className="fe-code-tab-name">{tab.name}</span>
                        <span
                          className="fe-code-tab-close"
                          role="button"
                          tabIndex={0}
                          title="Close"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseTab(tab.path);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              handleCloseTab(tab.path);
                            }
                          }}
                        >
                          ×
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 2 — active file + actions */}
              {activeTab && (
                <div className="fe-code-actions-row">
                  <div className="fe-code-file-meta" title={activeTab.path}>
                    <FileIcon size={14} style={{ color: '#7dd3fc', flexShrink: 0 }} />
                    <span className="fe-code-file-name">{activeTab.name}</span>
                    <span className="fe-code-file-ext">{activeTab.ext || ''}</span>
                  </div>
                  <div className="fe-toolbar-actions">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="fe-toolbar-btn is-save"
                          onClick={() => void handleSaveEdit()}
                          disabled={isSaving}
                          style={{ opacity: isSaving ? 0.7 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}
                        >
                          {isSaving ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                              <polyline points="17 21 17 13 7 13 7 21" />
                              <polyline points="7 3 7 8 15 8" />
                            </svg>
                          )}
                          <span>{isSaving ? 'Saving...' : 'Save'}</span>
                        </button>
                        <button
                          type="button"
                          className="fe-toolbar-btn"
                          onClick={handleCancelEdit}
                          disabled={isSaving}
                          style={{ cursor: isSaving ? 'not-allowed' : 'pointer' }}
                        >
                          <span>Cancel</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="fe-toolbar-btn"
                        onClick={() => handleStartEdit(activeTab.content)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Edit</span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="fe-toolbar-btn"
                      onClick={() => handleCopyContent(isEditing ? editDraft : activeTab.content)}
                    >
                      <CopyIcon size={12} />
                      <span>Copy</span>
                    </button>

                    <button
                      type="button"
                      className="fe-toolbar-btn"
                      onClick={() => handleDownloadFile(activeTab.name, activeTab.content)}
                    >
                      <DownloadIcon size={12} />
                      <span>Download</span>
                    </button>

                    <button
                      type="button"
                      className={`fe-toolbar-btn${wordWrap ? ' is-active' : ''}`}
                      onClick={toggleWordWrap}
                      aria-pressed={wordWrap}
                      title={wordWrap ? 'Disable word wrap' : 'Enable word wrap'}
                      style={{ opacity: isWrapPending ? 0.85 : 1 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M3 12h15a3 3 0 1 1 0 6h-4" />
                        <path d="M14 18l-3-3 3-3" />
                      </svg>
                      <span>Wrap</span>
                    </button>

                    {['.html', '.htm'].includes(activeTab.ext) && (
                      <button
                        type="button"
                        className={`fe-toolbar-btn${isVisualMode ? ' is-visual-on' : ''}`}
                        onClick={() => {
                          if (isEditing) {
                            setIsEditing(false);
                            setEditDraft('');
                          }
                          setIsVisualMode((v) => !v);
                        }}
                        title={isVisualMode ? 'Switch to Code view' : 'Visual Edit mode'}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <path d="M3 9h18" />
                          <path d="M9 21V9" />
                        </svg>
                        <span>Visual</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Code Body Area - Visual or Code mode */}
            {activeTab && (
              isVisualMode ? (
                /* Visual Edit Mode - iframe-based WYSIWYG editor */
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
                  {/* Visual Toolbar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '4px 8px',
                    background: '#f5f5f5',
                    borderBottom: '1px solid #e0e0e0',
                    flexShrink: 0,
                    flexWrap: 'wrap',
                    minHeight: '32px'
                  }}>
                    {/* Format buttons */}
                    {([
                      { cmd: 'bold', label: 'B', title: 'Bold', style: { fontWeight: 700 } },
                      { cmd: 'italic', label: 'I', title: 'Italic', style: { fontStyle: 'italic' } },
                      { cmd: 'underline', label: 'U', title: 'Underline', style: { textDecoration: 'underline' } },
                      { cmd: 'strikeThrough', label: 'SÌ¶', title: 'Strikethrough', style: {} },
                    ] as { cmd: string; label: string; title: string; style: React.CSSProperties }[]).map(({ cmd, label, title, style: btnStyle }) => (
                      <button
                        key={cmd}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const doc = visualIframeRef.current?.contentDocument;
                          if (doc) doc.execCommand(cmd, false);
                          visualIframeRef.current?.contentWindow?.focus();
                        }}
                        title={title}
                        style={{
                          background: 'transparent',
                          border: '1px solid transparent',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '11px',
                          color: '#333',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '24px',
                          height: '22px',
                          transition: 'all 0.1s',
                          ...btnStyle
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#e0e0e0'; e.currentTarget.style.borderColor = '#ccc'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                      >
                        {label}
                      </button>
                    ))}
                    <div style={{ width: '1px', height: '14px', background: '#ccc', margin: '0 2px', flexShrink: 0 }} />
                    {/* Heading / block format */}
                    {(['H1', 'H2', 'H3', 'P'] as const).map((tag) => (
                      <button
                        key={tag}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const doc = visualIframeRef.current?.contentDocument;
                          if (doc) doc.execCommand('formatBlock', false, tag);
                          visualIframeRef.current?.contentWindow?.focus();
                        }}
                        title={tag === 'P' ? 'Paragraph' : `Heading ${tag.slice(1)}`}
                        style={{
                          background: 'transparent',
                          border: '1px solid transparent',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          padding: '2px 5px',
                          fontSize: '10px',
                          fontWeight: tag !== 'P' ? 700 : 400,
                          color: '#333',
                          height: '22px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          transition: 'all 0.1s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#e0e0e0'; e.currentTarget.style.borderColor = '#ccc'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                      >
                        {tag}
                      </button>
                    ))}
                    <div style={{ width: '1px', height: '14px', background: '#ccc', margin: '0 2px', flexShrink: 0 }} />
                    {/* Lists */}
                    {([
                      { cmd: 'insertUnorderedList', label: 'â€¢ List', title: 'Bullet List' },
                      { cmd: 'insertOrderedList', label: '1. List', title: 'Numbered List' },
                    ] as { cmd: string; label: string; title: string }[]).map(({ cmd, label, title }) => (
                      <button
                        key={cmd}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const doc = visualIframeRef.current?.contentDocument;
                          if (doc) doc.execCommand(cmd, false);
                          visualIframeRef.current?.contentWindow?.focus();
                        }}
                        title={title}
                        style={{
                          background: 'transparent',
                          border: '1px solid transparent',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          padding: '2px 6px',
                          fontSize: '10px',
                          color: '#333',
                          height: '22px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          transition: 'all 0.1s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#e0e0e0'; e.currentTarget.style.borderColor = '#ccc'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                      >
                        {label}
                      </button>
                    ))}
                    <div style={{ width: '1px', height: '14px', background: '#ccc', margin: '0 2px', flexShrink: 0 }} />
                    {/* Link */}
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const url = window.prompt('Enter URL:');
                        if (url) {
                          const doc = visualIframeRef.current?.contentDocument;
                          if (doc) doc.execCommand('createLink', false, url);
                        }
                        visualIframeRef.current?.contentWindow?.focus();
                      }}
                      title="Insert Link"
                      style={{
                        background: 'transparent',
                        border: '1px solid transparent',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        fontSize: '10px',
                        color: '#333',
                        height: '22px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        transition: 'all 0.1s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#e0e0e0'; e.currentTarget.style.borderColor = '#ccc'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                      Link
                    </button>
                    <div style={{ flex: 1 }} />
                    {/* Save button */}
                    <button
                      onMouseDown={(e) => { e.preventDefault(); void handleSaveVisual(); }}
                      disabled={isSaving}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: isSaving ? '#86efac' : '#22c55e',
                        border: 'none',
                        color: '#fff',
                        fontSize: '11px',
                        padding: '3px 10px',
                        borderRadius: '4px',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        transition: 'background 0.15s',
                        flexShrink: 0
                      }}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  {/* iframe - visual canvas */}
                  <iframe
                    ref={visualIframeRef}
                    key={`visual-${activeTabPath ?? ''}`}
                    title="Visual Editor"
                    sandbox="allow-same-origin allow-scripts"
                    style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }}
                    onLoad={(e) => {
                      const doc = e.currentTarget.contentDocument;
                      if (!doc) return;
                      // Write content & enable design mode
                      doc.open();
                      doc.write(activeTab.content);
                      doc.close();
                      doc.designMode = 'on';
                      // Inject comfortable editing styles
                      const styleEl = doc.createElement('style');
                      styleEl.id = 'visual-edit-styles';
                      styleEl.textContent = [
                        'body {',
                        '  margin: 0;',
                        '  padding: 24px 32px;',
                        '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
                        '  font-size: 14px;',
                        '  line-height: 1.6;',
                        '  color: #1a1a1a;',
                        '  min-height: calc(100vh - 48px);',
                        '  outline: none;',
                        '  max-width: 800px;',
                        '}',
                        '*:focus { outline: none; }',
                        'a { color: #2563eb; }',
                        'img { max-width: 100%; height: auto; }',
                        'h1, h2, h3 { line-height: 1.3; }',
                        'pre, code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; font-size: 13px; }',
                        'blockquote { border-left: 3px solid #e0e0e0; margin-left: 0; padding-left: 16px; color: #666; }',
                      ].join('\n');
                      doc.head.appendChild(styleEl);
                    }}
                  />
                </div>
              ) : (
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', background: '#121214' }}>
                {showFindWidget && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '24px',
                    zIndex: 100,
                    background: '#1a1a1c',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)'
                  }}>

                    <input
                      id="code-find-input"
                      type="text"
                      placeholder="Find..."
                      value={findQuery}
                      onChange={(e) => setFindQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (e.shiftKey) {
                            handleFindPrev();
                          } else {
                            handleFindNext();
                          }
                        }
                      }}
                      style={{
                        background: '#0d0d0f',
                        border: '1px solid #27272a',
                        borderRadius: '4px',
                        color: '#f4f4f5',
                        fontSize: '12px',
                        padding: '4px 8px',
                        outline: 'none',
                        width: '140px',
                        height: '26px',
                        boxSizing: 'border-box'
                      }}
                    />
                    
                    {findQuery && (
                      <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 500, userSelect: 'none', minWidth: '45px', textAlign: 'center' }}>
                        {matchIndices.length > 0 
                          ? `${(Math.abs(findMatchIndex) % matchIndices.length) + 1} of ${matchIndices.length}` 
                          : '0 of 0'}
                      </span>
                    )}

                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button
                        onClick={handleFindPrev}
                        disabled={matchIndices.length === 0}
                        title="Previous match (Shift+Enter)"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: matchIndices.length > 0 ? '#a1a1aa' : '#3f3f46',
                          cursor: matchIndices.length > 0 ? 'pointer' : 'not-allowed',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px',
                          borderRadius: '4px'
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </button>
                      <button
                        onClick={handleFindNext}
                        disabled={matchIndices.length === 0}
                        title="Next match (Enter)"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: matchIndices.length > 0 ? '#a1a1aa' : '#3f3f46',
                          cursor: matchIndices.length > 0 ? 'pointer' : 'not-allowed',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '4px',
                          borderRadius: '4px'
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        setShowFindWidget(false);
                        setFindQuery('');
                      }}
                      title="Close (Esc)"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#71717a',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        borderRadius: '4px'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}
                {showGoToLineWidget && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '24px',
                    zIndex: 100,
                    background: '#1a1a1c',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)'
                  }}>
                    <span style={{ fontSize: '11.5px', color: '#a1a1aa', fontWeight: 500, userSelect: 'none' }}>Go to line:</span>
                    <input
                      id="code-goto-line-input"
                      type="text"
                      placeholder="Line number..."
                      value={goToLineNumber}
                      onChange={(e) => setGoToLineNumber(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleGoToLine(goToLineNumber);
                        }
                      }}
                      style={{
                        background: '#0d0d0f',
                        border: '1px solid #27272a',
                        borderRadius: '4px',
                        color: '#f4f4f5',
                        fontSize: '12px',
                        padding: '4px 8px',
                        outline: 'none',
                        width: '80px',
                        height: '26px',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      onClick={() => {
                        setShowGoToLineWidget(false);
                        setGoToLineNumber('');
                      }}
                      title="Close (Esc)"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#a1a1aa',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px',
                        borderRadius: '4px'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                )}
                {isEditing ? (
                  /* Edit mode: textarea — wrap style follows deferred value */
                  <textarea
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={handleTextareaKeyDown}
                    spellCheck={false}
                    autoFocus
                    style={{
                      flex: 1,
                      margin: 0,
                      padding: '12px',
                      background: '#0e1117',
                      color: '#e4e4e7',
                      fontFamily: 'Consolas, "Fira Code", Monaco, monospace',
                      fontSize: '11.5px',
                      lineHeight: '18px',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      whiteSpace: contentWordWrap ? 'pre-wrap' : 'pre',
                      overflowWrap: contentWordWrap ? 'anywhere' : 'normal',
                      wordBreak: contentWordWrap ? 'break-word' : 'normal',
                      overflowX: contentWordWrap ? 'hidden' : 'auto',
                      overflowY: 'auto',
                      tabSize: 2,
                      boxSizing: 'border-box',
                      caretColor: '#38bdf8',
                      opacity: isWrapPending ? 0.72 : 1,
                      transition: 'opacity 0.12s ease'
                    }}
                  />
                ) : (
                  <FeCodeReadView
                    content={activeTab.content}
                    ext={activeTab.ext}
                    findQuery={findQuery}
                    findMatchIndex={findMatchIndex}
                    wordWrap={contentWordWrap}
                    isWrapPending={isWrapPending}
                  />
                )}
              </div>
              )
            )}
          </div>
        ) : (
          <div className="fe-viewer-empty" style={{ position: 'relative' }}>
            {isTreeCollapsed && (
              <button
                onClick={() => setIsTreeCollapsed(false)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 10px',
                  background: '#18181b',
                  border: '1px solid #27272a',
                  borderRadius: '4px',
                  color: '#e4e4e7',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                <SidebarIcon size={12} />
                <span>Show File Explorer</span>
              </button>
            )}
            <div className="fe-viewer-empty-card">
              <FileIcon size={28} style={{ color: '#71717a' }} />
              <span className="fe-viewer-empty-title">No file selected</span>
              <p className="fe-viewer-empty-hint">
                Select a file from the explorer to view code
              </p>
            </div>
          </div>
        )}
      </div>

      {activeModal && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 10, 12, 0.72)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#1a1a1c',
            border: '1px solid #3f3f46',
            borderRadius: '8px',
            padding: '16px',
            width: '100%',
            maxWidth: '280px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.55)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
              {activeModal.type === 'create-file' && 'Create New File'}
              {activeModal.type === 'create-folder' && 'Create New Folder'}
              {activeModal.type === 'rename' && 'Rename'}
            </h3>
            
            <input
              type="text"
              value={modalInput}
              onChange={(e) => setModalInput(e.target.value)}
              placeholder={
                activeModal.type === 'create-file' ? "file.txt" :
                activeModal.type === 'create-folder' ? "Folder Name" :
                "New Name"
              }
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleModalSubmit();
                if (e.key === 'Escape') setActiveModal(null);
              }}
              style={{
                padding: '7px 10px',
                borderRadius: '4px',
                background: '#0d0d0f',
                border: '1px solid #27272a',
                color: '#f4f4f5',
                fontSize: '12px',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  background: '#18181b',
                  border: '1px solid #27272a',
                  color: '#d4d4d8',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleModalSubmit}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  background: '#38bdf8',
                  border: 'none',
                  color: '#09090b',
                  fontWeight: 600,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            background: '#1a1a1c',
            border: '1px solid #3f3f46',
            borderRadius: '6px',
            padding: '4px',
            zIndex: 1100,
            minWidth: '160px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.55)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.isDirectory && (
            <>
              <button
                className="fe-menu-item"
                onClick={() => {
                  handleCreateFile(contextMenu.path);
                  setContextMenu(null);
                }}
              >
                <FileIcon size={12} style={{ color: '#a1a1aa' }} />
                <span>New File...</span>
              </button>

              <button
                className="fe-menu-item"
                onClick={() => {
                  handleCreateFolder(contextMenu.path);
                  setContextMenu(null);
                }}
              >
                <FolderIcon size={12} style={{ color: '#a1a1aa' }} />
                <span>New Folder...</span>
              </button>
              <div style={{ height: '1px', background: '#27272a', margin: '2px 0' }} />
            </>
          )}

          <button
            className="fe-menu-item"
            onClick={() => {
              handleRenamePath(contextMenu.path, contextMenu.name);
              setContextMenu(null);
            }}
          >
            <EditIcon size={12} style={{ color: '#a1a1aa' }} />
            <span>Rename...</span>
          </button>

          <button
            className="fe-menu-item"
            onClick={() => {
              handleCopyPath(contextMenu.path, true);
              setContextMenu(null);
            }}
          >
            <CopyIcon size={12} style={{ color: '#a1a1aa' }} />
            <span>Copy Relative Path</span>
          </button>

          <button
            className="fe-menu-item"
            onClick={() => {
              handleCopyPath(contextMenu.path, false);
              setContextMenu(null);
            }}
          >
            <CopyIcon size={12} style={{ color: '#a1a1aa' }} />
            <span>Copy Absolute Path</span>
          </button>

          <button
            className="fe-menu-item"
            onClick={() => {
              handleInjectPath(contextMenu.path);
              setContextMenu(null);
            }}
            style={{ color: '#38bdf8' }}
          >
            <PlayIcon size={10} />
            <span>Inject to Terminal</span>
          </button>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />

          <button
            className="fe-menu-item danger"
            onClick={() => {
              handleDeletePath(contextMenu.path, contextMenu.name);
              setContextMenu(null);
            }}
          >
            <TrashIcon size={12} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}

const VIEWPORT_PRESETS: Record<PreviewViewport, { width: number; height: number; label: string; renderIcon: (size?: number) => React.ReactNode }> = {
  desktop: { width: 1440, height: 900, label: 'Desktop', renderIcon: (s) => <DesktopIcon size={s} /> },
  tablet: { width: 768, height: 1024, label: 'Tablet', renderIcon: (s) => <TabletIcon size={s} /> },
  mobile: { width: 390, height: 844, label: 'Mobile', renderIcon: (s) => <MobileIcon size={s} /> }
};

type ZoomMode = 'fit' | '100%' | 'custom';

function PreviewPanel() {
  const activePaneId = useDeckStore((state) => state.activePaneId);
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const workspaces = useDeckStore((state) => state.workspaces);
  const projectRunStates = useDeckStore((state) => state.projectRunStates);
  const runProject = useDeckStore((state) => state.runProject);
  const stopProject = useDeckStore((state) => state.stopProject);
  const setShowRunConfigModalWorkspaceId = useDeckStore((state) => state.setShowRunConfigModalWorkspaceId);
  const setShowRunLogsModalWorkspaceId = useDeckStore((state) => state.setShowRunLogsModalWorkspaceId);

  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId);
  }, [workspaces, activeWorkspaceId]);

  const panes = activeWorkspace ? Object.values(activeWorkspace.panes) : [];

  const [previewTabs, setPreviewTabs] = useState<PreviewTab[]>(() => {
    const saved = localStorage.getItem('agentdeck:preview-tabs');
    return saved ? JSON.parse(saved) : [];
  });
  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    return localStorage.getItem('agentdeck:preview-active-tab-id');
  });
  const activeTab = previewTabs.find((t) => t.id === activeTabId) || null;
  const [urlInput, setUrlInput] = useState('http://localhost:3000');
  const [detectedServers, setDetectedServers] = useState<DevServerInfo[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeStatus, setIframeStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  // Display modes states
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(() => {
    return localStorage.getItem('agentdeck:preview-header-collapsed') === 'true';
  });
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [linkDropdownOpen, setLinkDropdownOpen] = useState(false);
  const [isVisualEdit, setIsVisualEdit] = useState(false);
  const [isMarginExpanded, setIsMarginExpanded] = useState(false);
  const [isPaddingExpanded, setIsPaddingExpanded] = useState(false);
  const [activeColorPickerField, setActiveColorPickerField] = useState<'text' | 'bg' | 'border' | null>(null);
  const [colorPickerTab, setColorPickerTab] = useState<'styles' | 'custom'>('styles');
  const [colorSearchQuery, setColorSearchQuery] = useState('');
  const [selectedElement, setSelectedElement] = useState<{
    tagName: string;
    elementType: string;
    content: string;
    titleText: string;
    paragraphText: string;
    buttonText: string;
    id: string;
    className: string;
    fontSize: string;
    fontWeight: string;
    fontStyle: string;
    fontFamily: string;
    textAlign: string;
    color: string;
    backgroundColor: string;
    padding: string;
    margin: string;
    borderRadius: string;
    paddingTop: string;
    paddingRight: string;
    paddingBottom: string;
    paddingLeft: string;
    marginTop: string;
    marginRight: string;
    marginBottom: string;
    marginLeft: string;
    borderWidth: string;
    borderColor: string;
    borderStyle: string;
    boxShadow: string;
    opacity: string;
    src: string;
    objectFit: string;
    href: string;
  } | null>(null);
  const selectedElementBaseRef = useRef<typeof selectedElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [aiComment, setAiComment] = useState('');

  // Visual Picker Image Capture States
  const [capturePadding, setCapturePadding] = useState<number>(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [webviewSize, setWebviewSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    setCapturedImage(null);
    setCapturePadding(0);
  }, [selectedElement]);

  useEffect(() => {
    const container = document.getElementById('agentdeck-webview-container');
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setWebviewSize({
          width: Math.round(width),
          height: Math.round(height)
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [activeTab]);

  // Visual Annotation Mode States
  const [isAnnotateMode, setIsAnnotateMode] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeAnnotationTool, setActiveAnnotationTool] = useState<AnnotationType | 'select'>('rectangle');
  const [annotationColor, setAnnotationColor] = useState('#ef4444');
  const [annotationStrokeWidth, setAnnotationStrokeWidth] = useState(3);
  const [drawingStartPoint, setDrawingStartPoint] = useState<Point | null>(null);
  const [drawingCurrentPoint, setDrawingCurrentPoint] = useState<Point | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [historyStack, setHistoryStack] = useState<Annotation[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [editingTextAnnId, setEditingTextAnnId] = useState<string | null>(null);
  const [tempTextValue, setTempTextValue] = useState('');
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [draggedAnnId, setDraggedAnnId] = useState<string | null>(null);
  const [dragStartMouse, setDragStartMouse] = useState<{ x: number; y: number } | null>(null);
  const [dragStartAnnCoords, setDragStartAnnCoords] = useState<{ x: number; y: number } | null>(null);
  const [dragStartAnnPoints, setDragStartAnnPoints] = useState<Point[] | null>(null);

  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  const [resizingAnnId, setResizingAnnId] = useState<string | null>(null);
  const [activeResizeHandle, setActiveResizeHandle] = useState<string | null>(null);
  const [resizeStartMouse, setResizeStartMouse] = useState<{ x: number; y: number } | null>(null);
  const [resizeStartAnnCoords, setResizeStartAnnCoords] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const handleAnnotationMouseDown = (annId: string, e: React.MouseEvent) => {
    if (activeAnnotationTool !== 'select') return;
    e.stopPropagation();
    const ann = annotations.find(a => a.id === annId);
    if (!ann) return;

    setSelectedAnnId(annId);
    setDraggedAnnId(annId);
    const container = document.getElementById('agentdeck-webview-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width;
    const mouseY = (e.clientY - rect.top) / rect.height;

    setDragStartMouse({ x: mouseX, y: mouseY });
    setDragStartAnnCoords({ x: ann.x, y: ann.y });
    if (ann.points) {
      setDragStartAnnPoints(ann.points);
    } else {
      setDragStartAnnPoints(null);
    }
  };

  const handleResizeMouseDown = (annId: string, handle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ann = annotations.find(a => a.id === annId);
    if (!ann) return;

    setResizingAnnId(annId);
    setActiveResizeHandle(handle);
    const container = document.getElementById('agentdeck-webview-container');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width;
    const mouseY = (e.clientY - rect.top) / rect.height;

    setResizeStartMouse({ x: mouseX, y: mouseY });
    setResizeStartAnnCoords({
      x: ann.x,
      y: ann.y,
      width: ann.width || 0,
      height: ann.height || 0
    });
  };

  useEffect(() => {
    if (!isAnnotateMode) return;
    const container = document.getElementById('agentdeck-webview-container');
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });

    observer.observe(container);
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setContainerSize({ width: rect.width, height: rect.height });
    }

    return () => observer.disconnect();
  }, [isAnnotateMode]);

  useEffect(() => {
    if (!draggedAnnId && !resizingAnnId) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('agentdeck-webview-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      if (draggedAnnId && dragStartMouse && dragStartAnnCoords) {
        const dx = x - dragStartMouse.x;
        const dy = y - dragStartMouse.y;
        const nextAnns = annotations.map((ann) => {
          if (ann.id === draggedAnnId) {
            if (ann.type === 'pen' && dragStartAnnPoints) {
              const newPoints = dragStartAnnPoints.map((p) => ({
                x: p.x + dx,
                y: p.y + dy
              }));
              return {
                ...ann,
                x: dragStartAnnCoords.x + dx,
                y: dragStartAnnCoords.y + dy,
                points: newPoints
              };
            } else {
              return {
                ...ann,
                x: dragStartAnnCoords.x + dx,
                y: dragStartAnnCoords.y + dy
              };
            }
          }
          return ann;
        });
        setAnnotations(nextAnns);
      } else if (resizingAnnId && resizeStartMouse && resizeStartAnnCoords && activeResizeHandle) {
        const dx = x - resizeStartMouse.x;
        const dy = y - resizeStartMouse.y;
        const { x: x0, y: y0, width: w0, height: h0 } = resizeStartAnnCoords;

        const nextAnns = annotations.map((ann) => {
          if (ann.id === resizingAnnId) {
            if (ann.type === 'arrow') {
              if (activeResizeHandle === 'start') {
                const ex = x0 + w0;
                const ey = y0 + h0;
                const nextX = x0 + dx;
                const nextY = y0 + dy;
                return {
                  ...ann,
                  x: nextX,
                  y: nextY,
                  width: ex - nextX,
                  height: ey - nextY
                };
              } else if (activeResizeHandle === 'end') {
                return {
                  ...ann,
                  width: w0 + dx,
                  height: h0 + dy
                };
              }
            } else {
              let nextX = ann.x;
              let nextY = ann.y;
              let nextW = ann.width || 0;
              let nextH = ann.height || 0;

              if (activeResizeHandle === 'br') {
                nextW = Math.max(0.005, w0 + dx);
                nextH = Math.max(0.005, h0 + dy);
              } else if (activeResizeHandle === 'tl') {
                let boundedDx = dx;
                if (w0 - dx < 0.005) boundedDx = w0 - 0.005;
                let boundedDy = dy;
                if (h0 - dy < 0.005) boundedDy = h0 - 0.005;

                nextX = x0 + boundedDx;
                nextY = y0 + boundedDy;
                nextW = w0 - boundedDx;
                nextH = h0 - boundedDy;
              } else if (activeResizeHandle === 'tr') {
                let boundedDy = dy;
                if (h0 - dy < 0.005) boundedDy = h0 - 0.005;

                nextY = y0 + boundedDy;
                nextW = Math.max(0.005, w0 + dx);
                nextH = h0 - boundedDy;
              } else if (activeResizeHandle === 'bl') {
                let boundedDx = dx;
                if (w0 - dx < 0.005) boundedDx = w0 - 0.005;

                nextX = x0 + boundedDx;
                nextW = w0 - boundedDx;
                nextH = Math.max(0.005, h0 + dy);
              }

              return {
                ...ann,
                x: nextX,
                y: nextY,
                width: nextW,
                height: nextH
              };
            }
          }
          return ann;
        });
        setAnnotations(nextAnns);
      }
    };

    const handleWindowMouseUp = () => {
      saveToHistory(annotations);
      setDraggedAnnId(null);
      setDragStartMouse(null);
      setDragStartAnnCoords(null);
      setDragStartAnnPoints(null);
      setResizingAnnId(null);
      setActiveResizeHandle(null);
      setResizeStartMouse(null);
      setResizeStartAnnCoords(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [draggedAnnId, resizingAnnId, dragStartMouse, dragStartAnnCoords, dragStartAnnPoints, resizeStartMouse, resizeStartAnnCoords, activeResizeHandle, annotations]);


  const saveToHistory = (newAnns: Annotation[]) => {
    const nextStack = historyStack.slice(0, historyIndex + 1);
    nextStack.push(newAnns);
    setHistoryStack(nextStack);
    setHistoryIndex(nextStack.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      setAnnotations(historyStack[nextIdx]);
    } else if (historyIndex === 0) {
      setHistoryIndex(-1);
      setAnnotations([]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setAnnotations(historyStack[nextIdx]);
    }
  };

  useEffect(() => {
    if (!isAnnotateMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (
        (isCtrlOrCmd && e.key.toLowerCase() === 'y') ||
        (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAnnotateMode, historyStack, historyIndex]);

  const handleClearAll = () => {
    if (annotations.length === 0) return;
    saveToHistory([]);
    setAnnotations([]);
  };

  const handleDeleteAnnotation = (id: string) => {
    const filtered = annotations.filter(a => a.id !== id);
    const reindexed = filtered.map((a, index) => ({
      ...a,
      order: index + 1
    }));
    saveToHistory(reindexed);
    setAnnotations(reindexed);
  };

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isAnnotateMode) return;
    if (activeAnnotationTool === 'select') {
      setSelectedAnnId(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const point = { x, y };

    if (activeAnnotationTool === 'text') {
      const newId = `ann_${Date.now()}`;
      const newAnn: Annotation = {
        id: newId,
        type: 'text',
        x,
        y,
        text: 'Note',
        color: annotationColor,
        strokeWidth: annotationStrokeWidth,
        order: annotations.length + 1,
        createdAt: Date.now()
      };
      const nextAnns = [...annotations, newAnn];
      saveToHistory(nextAnns);
      setAnnotations(nextAnns);
      setEditingTextAnnId(newId);
      setTempTextValue('Note');
      return;
    }

    setDrawingStartPoint(point);
    setDrawingCurrentPoint(point);
    if (activeAnnotationTool === 'pen') {
      setDrawingPoints([point]);
    }
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isAnnotateMode || !drawingStartPoint) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const point = { x, y };
    setDrawingCurrentPoint(point);

    if (activeAnnotationTool === 'pen') {
      setDrawingPoints((prev) => [...prev, point]);
    }
  };

  const handleSvgMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {

    if (!isAnnotateMode || !drawingStartPoint) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const endPoint = { x, y };

    const left = Math.min(drawingStartPoint.x, endPoint.x);
    const top = Math.min(drawingStartPoint.y, endPoint.y);
    const width = Math.abs(drawingStartPoint.x - endPoint.x);
    const height = Math.abs(drawingStartPoint.y - endPoint.y);

    let newAnn: Annotation | null = null;
    const newId = `ann_${Date.now()}`;

    if (activeAnnotationTool === 'rectangle' || activeAnnotationTool === 'highlight') {
      if (width > 0.005 || height > 0.005) {
        newAnn = {
          id: newId,
          type: activeAnnotationTool,
          x: left,
          y: top,
          width,
          height,
          color: annotationColor,
          strokeWidth: annotationStrokeWidth,
          order: annotations.length + 1,
          createdAt: Date.now()
        };
      }
    } else if (activeAnnotationTool === 'arrow') {
      const w = endPoint.x - drawingStartPoint.x;
      const h = endPoint.y - drawingStartPoint.y;
      if (Math.abs(w) > 0.005 || Math.abs(h) > 0.005) {
        newAnn = {
          id: newId,
          type: 'arrow',
          x: drawingStartPoint.x,
          y: drawingStartPoint.y,
          width: w,
          height: h,
          color: annotationColor,
          strokeWidth: annotationStrokeWidth,
          order: annotations.length + 1,
          createdAt: Date.now()
        };
      }
    } else if (activeAnnotationTool === 'pen') {
      const pts = [...drawingPoints, endPoint];
      if (pts.length > 1) {
        newAnn = {
          id: newId,
          type: 'pen',
          x: pts[0].x,
          y: pts[0].y,
          points: pts,
          color: annotationColor,
          strokeWidth: annotationStrokeWidth,
          order: annotations.length + 1,
          createdAt: Date.now()
        };
      }
    }

    if (newAnn) {
      const nextAnns = [...annotations, newAnn];
      saveToHistory(nextAnns);
      setAnnotations(nextAnns);
    }

    setDrawingStartPoint(null);
    setDrawingCurrentPoint(null);
    setDrawingPoints([]);
  };

  const renderAnnotationSidebar = () => {
    const sectionLabel: React.CSSProperties = {
      fontSize: '11px',
      color: '#a1a1aa',
      textTransform: 'uppercase',
      fontWeight: 600,
      marginBottom: '8px',
      letterSpacing: '0.04em',
    };
    const solidBtn = (enabled: boolean, danger = false): React.CSSProperties => ({
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '5px',
      padding: '6px 8px',
      background: '#18181b',
      border: '1px solid #27272a',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: 500,
      color: !enabled ? '#71717a' : danger ? '#f87171' : '#e4e4e7',
      cursor: enabled ? 'pointer' : 'default',
    });

    return (
      <div
        className="annotation-sidebar"
        style={{
          width: '320px',
          height: '100%',
          background: '#121214',
          borderRight: '1px solid #27272a',
          display: 'flex',
          flexDirection: 'column',
          color: '#e4e4e7',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility',
        }}
      >
        <div
          style={{
            padding: '12px 14px',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#16161a',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                background: '#0f1f1a',
                color: '#4ade80',
                border: '1px solid #166534',
                padding: '3px 7px',
                borderRadius: '4px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              Mode
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
              Annotation ({annotations.length})
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsAnnotateMode(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#27272a';
              e.currentTarget.style.color = '#f4f4f5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#a1a1aa';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div style={{ padding: '14px', borderBottom: '1px solid #27272a', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={sectionLabel}>Công cụ vẽ</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '5px' }}>
              {[
                { id: 'select', label: 'Pointer', path: <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /> },
                { id: 'rectangle', label: 'Rect', path: <rect x="3" y="3" width="18" height="18" rx="2" /> },
                { id: 'arrow', label: 'Arrow', path: <path d="M5 19L19 5M19 5H11M19 5V13" /> },
                { id: 'text', label: 'Text', path: <path d="M4 7V4h16v3M9 20h6M12 4v16" /> },
                { id: 'highlight', label: 'Highlight', path: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /> },
                { id: 'pen', label: 'Pen', path: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 0L7 19l-4 1 1-4Z" /> },
              ].map((tool) => {
                const isActive = activeAnnotationTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setActiveAnnotationTool(tool.id as any)}
                    title={tool.label}
                    style={{
                      aspectRatio: '1',
                      background: isActive ? '#2e1065' : '#18181b',
                      border: isActive ? '1px solid #7c3aed' : '1px solid #27272a',
                      borderRadius: '6px',
                      color: isActive ? '#ddd6fe' : '#d4d4d8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {tool.path}
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={sectionLabel}>Màu sắc</div>
              <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7'].map((col) => {
                  const isActive = annotationColor === col;
                  return (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setAnnotationColor(col)}
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: col,
                        border: isActive ? '2px solid #f4f4f5' : '1px solid #3f3f46',
                        cursor: 'pointer',
                        padding: 0,
                        boxShadow: isActive ? `0 0 0 2px ${col}55` : 'none',
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <div style={sectionLabel}>Độ dày</div>
              <div
                style={{
                  display: 'flex',
                  background: '#18181b',
                  borderRadius: '6px',
                  padding: '3px',
                  border: '1px solid #27272a',
                  gap: '2px',
                }}
              >
                {[1, 2, 3, 5].map((w) => {
                  const isActive = annotationStrokeWidth === w;
                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setAnnotationStrokeWidth(w)}
                      style={{
                        padding: '4px 7px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: isActive ? '#27272a' : 'transparent',
                        border: isActive ? '1px solid #3f3f46' : '1px solid transparent',
                        color: isActive ? '#f4f4f5' : '#a1a1aa',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {w}px
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={handleUndo} disabled={historyIndex < 0} style={solidBtn(historyIndex >= 0)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
              Undo
            </button>

            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= historyStack.length - 1}
              style={solidBtn(historyIndex < historyStack.length - 1)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 7v6h-6M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
              </svg>
              Redo
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              disabled={annotations.length === 0}
              style={solidBtn(annotations.length > 0, true)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
              </svg>
              Xóa hết
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {annotations.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                textAlign: 'center',
                gap: '10px',
                background: '#141416',
                border: '1px dashed rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                padding: '28px 16px',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 0L7 19l-4 1 1-4Z" />
              </svg>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>Chưa có annotation nào</div>
              <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa', lineHeight: 1.5, maxWidth: '240px' }}>
                Chọn một công cụ ở trên rồi kéo vẽ trực tiếp lên preview để bắt đầu.
              </p>
            </div>
          ) : (
            annotations.map((ann) => {
              const toolIcon =
                ann.type === 'rectangle' ? <rect x="3" y="3" width="18" height="18" rx="2" /> :
                ann.type === 'arrow' ? <path d="M5 19L19 5M19 5H11M19 5V13" /> :
                ann.type === 'text' ? <path d="M4 7V4h16v3M9 20h6M12 4v16" /> :
                ann.type === 'highlight' ? <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /> :
                <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 0L7 19l-4 1 1-4Z" />;

              return (
                <div
                  key={ann.id}
                  style={{
                    background: '#1a1a1c',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <span
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: ann.color,
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {ann.order}
                      </span>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={ann.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {toolIcon}
                      </svg>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#f4f4f5' }}>
                        {ann.type === 'text' ? 'Ghi chú text' : ann.type === 'rectangle' ? 'Khung chữ nhật' : ann.type === 'arrow' ? 'Mũi tên' : ann.type === 'highlight' ? 'Vùng Highlight' : 'Vẽ tự do'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteAnnotation(ann.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#a1a1aa',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '4px',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#a1a1aa'; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </div>

                  <textarea
                    value={ann.text || ''}
                    placeholder="Mô tả lỗi hoặc yêu cầu chỉnh sửa..."
                    onChange={(e) => {
                      const updatedText = e.target.value;
                      const nextAnns = annotations.map(a => a.id === ann.id ? { ...a, text: updatedText } : a);
                      setAnnotations(nextAnns);
                      const nextStack = [...historyStack];
                      if (historyIndex >= 0) {
                        nextStack[historyIndex] = nextAnns;
                        setHistoryStack(nextStack);
                      }
                    }}
                    style={{
                      width: '100%',
                      background: '#0d0d0f',
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      color: '#f4f4f5',
                      padding: '8px 10px',
                      fontSize: '12px',
                      outline: 'none',
                      resize: 'vertical',
                      minHeight: '48px',
                      fontFamily: 'inherit',
                      lineHeight: 1.45,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer Action */}
        <div style={{ padding: '14px', borderTop: '1px solid #27272a', background: '#16161a' }}>
          <button
            onClick={async () => {
              if (annotations.length === 0) {
                alert('Vui lòng tạo ít nhất một annotation trước khi export!');
                return;
              }
              if (!webviewRef.current || !activeTab) return;

              const workspacePath = activeWorkspace?.rootPath;
              if (!workspacePath) {
                alert('Không tìm thấy đường dẫn workspace hiện tại.');
                return;
              }

              const targetPaneId = activeTab.linkedPaneId || activePaneId;
              if (!targetPaneId) {
                alert('Vui lòng chọn hoặc liên kết một Terminal Pane trước.');
                return;
              }

              try {
                const screenshotDataUrl = await ScreenshotCaptureService.captureWebview(webviewRef.current);
                const mergedDataUrl = await ScreenshotCaptureService.mergeAnnotations(screenshotDataUrl, annotations);
                const base64Clean = mergedDataUrl.replace(/^data:image\/\w+;base64,/, '');

                const originalName = `annotation_${Date.now()}.png`;
                const saveRes = await window.agentDeck.attachmentSave({
                  workspaceId: activeWorkspaceId || '',
                  paneId: targetPaneId,
                  taskId: null,
                  originalName,
                  mimeType: 'image/png',
                  dataBase64: base64Clean
                });

                if (!saveRes.ok) {
                  alert(`Lỗi khi lưu screenshot: ${saveRes.error?.message || 'Lỗi không xác định'}`);
                  return;
                }

                const metadata = saveRes.data;
                const localPath = metadata?.localPath || originalName;

                const promptLines = [
                  `[AgentDeck Visual Annotation Change Request]`,
                  `User đã gửi yêu cầu sửa đổi giao diện được annotate trực quan từ preview tại ${activeTab.url}.`,
                  `Hình ảnh screenshot đã được vẽ annotation lưu tại:`,
                  `${localPath}`,
                  ``,
                  `### Danh sách yêu cầu chỉnh sửa (được đánh số trên hình):`,
                  ...annotations.map((ann) => {
                    const comment = ann.text ? ann.text.trim() : 'Không có mô tả chi tiết.';
                    const typeLabel =
                      ann.type === 'rectangle' ? 'Khung vùng lỗi' :
                      ann.type === 'arrow' ? 'Mũi tên' :
                      ann.type === 'text' ? 'Ghi chú text' :
                      ann.type === 'highlight' ? 'Vùng Highlight' : 'Vẽ tự do';
                    return `${ann.order}. **[${typeLabel}]**: ${comment}`;
                  }),
                  ``,
                  `Yêu cầu: Hãy xem file ảnh đã lưu để hiểu rõ vị trí cần sửa đổi, tìm file source tương ứng trong workspace và thực hiện các chỉnh sửa được liệt kê ở trên.`
                ];

                const promptText = promptLines.join('\n');
                window.agentDeck.terminalWrite(targetPaneId, `${promptText}\r`);
                alert('Đã xuất thành công yêu cầu chỉnh sửa kèm hình ảnh sang Terminal Agent!');
              } catch (err) {
                console.error(err);
                alert(`Gặp lỗi khi export: ${err instanceof Error ? err.message : String(err)}`);
              }
            }}
            disabled={annotations.length === 0}
            style={{
              width: '100%',
              background: annotations.length > 0 ? '#059669' : '#18181b',
              border: annotations.length > 0 ? '1px solid #10b981' : '1px solid #27272a',
              borderRadius: '6px',
              color: annotations.length > 0 ? '#ffffff' : '#a1a1aa',
              fontSize: '12.5px',
              fontWeight: 600,
              padding: '10px 16px',
              cursor: annotations.length > 0 ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              if (annotations.length > 0) {
                e.currentTarget.style.background = '#047857';
              }
            }}
            onMouseLeave={(e) => {
              if (annotations.length > 0) {
                e.currentTarget.style.background = '#059669';
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            Export to Agent (Terminal)
          </button>
        </div>
      </div>
    );
  };

  const displayedSelectedElement = useMemo(() => {
    if (!selectedElement) return null;
    const isBlock = selectedElement.elementType === 'block';
    return {
      ...selectedElement,
      content: isBlock ? selectedElement.titleText || selectedElement.paragraphText || selectedElement.buttonText || selectedElement.content : selectedElement.content
    };
  }, [selectedElement]);
  const displayedTitle = displayedSelectedElement?.elementType === 'block' ? displayedSelectedElement.titleText : '';
  const displayedDescription = displayedSelectedElement?.elementType === 'block' ? displayedSelectedElement.paragraphText : '';
  const displayedButtonText = displayedSelectedElement?.elementType === 'block' ? displayedSelectedElement.buttonText : '';

  // Styling and content update synchronization handlers
  const handleUpdateContent = (val: string) => {
    if (!selectedElement) return;
    setSelectedElement({ ...selectedElement, content: val });
    webviewRef.current?.executeJavaScript(`
      (function() {
        const selected = document.querySelector('.agentdeck-selected');
        if (selected) {
          selected.textContent = ${JSON.stringify(val)};
        }
      })();
      true;
    `).catch((err: any) => console.error('Failed content update', err));
  };

  const handleUpdateStyle = (
    field:
      | 'fontSize'
      | 'fontWeight'
      | 'fontStyle'
      | 'fontFamily'
      | 'textAlign'
      | 'color'
      | 'backgroundColor'
      | 'padding'
      | 'margin'
      | 'borderRadius'
      | 'paddingTop'
      | 'paddingRight'
      | 'paddingBottom'
      | 'paddingLeft'
      | 'marginTop'
      | 'marginRight'
      | 'marginBottom'
      | 'marginLeft'
      | 'borderWidth'
      | 'borderColor'
      | 'borderStyle'
      | 'boxShadow'
      | 'opacity'
      | 'src'
      | 'objectFit'
      | 'href',
    cssProp: string,
    val: string
  ) => {
    if (!selectedElement) return;
    setSelectedElement({ ...selectedElement, [field]: val });
    webviewRef.current?.executeJavaScript(`
      (function() {
        const selected = document.querySelector('.agentdeck-selected');
        if (selected) {
          if (${JSON.stringify(cssProp)} === 'src') {
            selected.src = ${JSON.stringify(val)};
          } else if (${JSON.stringify(cssProp)} === 'href') {
            selected.href = ${JSON.stringify(val)};
          } else {
            selected.style[${JSON.stringify(cssProp)}] = ${JSON.stringify(val)};
          }
        }
      })();
      true;
    `).catch((err: any) => console.error('Failed style update', err));
  };

  const handleUpdateClasses = (val: string) => {
    if (!selectedElement) return;
    setSelectedElement({ ...selectedElement, className: val });
    webviewRef.current?.executeJavaScript(`
      (function() {
        const selected = document.querySelector('.agentdeck-selected');
        if (selected) {
          selected.className = ${JSON.stringify(val)} + ' agentdeck-selected';
        }
      })();
      true;
    `).catch((err: any) => console.error('Failed classes update', err));
  };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      alert('File size exceeds the 20MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        handleUpdateStyle('src', 'src', dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCaptureElement = async (isParent: boolean) => {
    const webview = webviewRef.current;
    if (!webview) {
      alert('Không tìm thấy WebView preview.');
      return;
    }

    setIsCapturing(true);
    setCapturedImage(null);

    try {
      // 1. Tự động cuộn phần tử chọn vào vùng hiển thị
      await webview.executeJavaScript(`
        (function() {
          const selectedEl = document.querySelector('.agentdeck-selected');
          if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          }
        })()
      `).catch((err: any) => console.error('Failed to scroll element into view', err));

      // Chờ 100ms để WebView cập nhật vị trí sau khi cuộn
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 2. Lấy bounding box của element đang chọn từ WebView cùng trạng thái viewport
      const bounds = await webview.executeJavaScript(`
        (function() {
          const selectedEl = document.querySelector('.agentdeck-selected');
          if (!selectedEl) return null;
          const targetEl = ${isParent} ? (selectedEl.parentElement || selectedEl) : selectedEl;
          const rect = targetEl.getBoundingClientRect();
          
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          
          const isOutOfViewport = (
            rect.right <= 0 ||
            rect.left >= viewportWidth ||
            rect.bottom <= 0 ||
            rect.top >= viewportHeight
          );
          
          return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            tagName: targetEl.tagName,
            isOutOfViewport
          };
        })()
      `);

      if (!bounds) {
        alert('Không tìm thấy phần tử được chọn trong WebView.');
        setIsCapturing(false);
        return;
      }

      if (bounds.isOutOfViewport) {
        alert('Phần tử được chọn hiện đang nằm ngoài vùng hiển thị của Preview (có thể do slider đã chuyển động hoặc bị cuộn đi). Vui lòng cuộn trang hoặc điều chỉnh slider để phần tử hiển thị lại trên màn hình trước khi chụp!');
        setIsCapturing(false);
        return;
      }

      // Tạm thời vô hiệu hóa style của Visual Edit để chụp ảnh nguyên bản (không viền tím, không outline)
      await webview.executeJavaScript(`
        (function() {
          const style = document.getElementById('visual-edit-styles');
          if (style) style.disabled = true;
          const hoverLabel = document.getElementById('agentdeck-hover-label');
          if (hoverLabel) hoverLabel.style.display = 'none';
        })()
      `).catch((err: any) => console.error('Failed to disable styles before capture', err));

      // 2. Chụp ảnh webview
      const nativeImage = await webview.capturePage();
      const screenshotDataUrl = nativeImage.toDataURL();

      // Bật lại style của Visual Edit ngay lập tức
      await webview.executeJavaScript(`
        (function() {
          const style = document.getElementById('visual-edit-styles');
          if (style) style.disabled = false;
        })()
      `).catch((err: any) => console.error('Failed to re-enable styles after capture', err));

      // 3. Load ảnh vào HTMLImageElement
      const img = new Image();
      img.src = screenshotDataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Lỗi load ảnh chụp màn hình preview.'));
      });

      // 4. Lấy kích thước CSS của WebView trên màn hình
      const webviewBounds = webview.getBoundingClientRect();
      if (!webviewBounds.width || !webviewBounds.height) {
        throw new Error('WebView có kích thước không hợp lệ.');
      }

      // 5. Tính toán tỉ lệ scale động (bao gồm devicePixelRatio + zoom factor)
      const scaleX = img.naturalWidth / webviewBounds.width;
      const scaleY = img.naturalHeight / webviewBounds.height;

      // 6. Áp dụng padding
      const P = capturePadding;
      const left = bounds.left - P;
      const top = bounds.top - P;
      const width = bounds.width + 2 * P;
      const height = bounds.height + 2 * P;

      // 7. Chuyển đổi toạ độ sang ảnh gốc (physical pixels)
      let cropX = left * scaleX;
      let cropY = top * scaleY;
      let cropW = width * scaleX;
      let cropH = height * scaleY;

      // Giới hạn trong biên ảnh gốc
      cropX = Math.max(0, cropX);
      cropY = Math.max(0, cropY);
      cropW = Math.min(img.naturalWidth - cropX, cropW);
      cropH = Math.min(img.naturalHeight - cropY, cropH);

      if (cropW <= 0 || cropH <= 0) {
        throw new Error('Vùng crop không hợp lệ (kích thước quá nhỏ hoặc nằm ngoài khung hình).');
      }

      // 8. Tạo canvas để crop ảnh
      const canvas = document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Không thể khởi tạo Canvas 2D Context.');
      }

      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const croppedUrl = canvas.toDataURL('image/png');
      setCapturedImage(croppedUrl);
    } catch (err: any) {
      console.error('Capture element error:', err);
      alert(`Chụp ảnh vùng phần tử thất bại: ${err.message || 'Lỗi không xác định'}`);
    } finally {
      setIsCapturing(false);
    }
  };

  const saveCapturedImageInternal = async (): Promise<string | null> => {
    if (!capturedImage) return null;

    const targetPaneId = activeTab?.linkedPaneId || activePaneId;
    if (!targetPaneId) {
      alert('Vui lòng chọn hoặc liên kết một Terminal Pane trước.');
      return null;
    }

    const originalName = `component-capture-${Date.now()}.png`;
    const base64Clean = capturedImage.replace(/^data:image\/\w+;base64,/, '');
    const saveRes = await window.agentDeck.attachmentSave({
      workspaceId: activeWorkspaceId || '',
      paneId: targetPaneId,
      taskId: null,
      originalName,
      mimeType: 'image/png',
      dataBase64: base64Clean
    });

    if (!saveRes.ok) {
      throw new Error(saveRes.error?.message || 'Lỗi lưu file ảnh.');
    }

    return saveRes.data?.localPath || originalName;
  };

  const handleSaveCapturedImage = async () => {
    try {
      const localPath = await saveCapturedImageInternal();
      if (localPath) {
        alert(`Đã lưu ảnh component thành công!\nĐường dẫn: ${localPath}`);
      }
    } catch (err: any) {
      console.error('Save captured image error:', err);
      alert(`Lưu ảnh thất bại: ${err.message || 'Lỗi không xác định'}`);
    }
  };

  const handleCopyCapturedImage = async () => {
    if (!capturedImage) return;
    try {
      const res = await fetch(capturedImage);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      alert('Đã sao chép ảnh component vào Clipboard thành công!');
    } catch (err: any) {
      console.error('Clipboard copy error:', err);
      alert(`Sao chép thất bại: ${err.message || 'Thiếu quyền truy cập Clipboard.'}`);
    }
  };

  const handleExportWithPrompt = async () => {
    const targetPaneId = activeTab?.linkedPaneId || activePaneId;
    if (!targetPaneId) {
      alert('Vui lòng chọn hoặc liên kết một Terminal Pane trước.');
      return;
    }

    try {
      const localPath = await saveCapturedImageInternal();
      if (!localPath) return;

      const promptLines = [
        `[AgentDeck Component Capture Change Request]`,
        `User đã chụp ảnh component từ preview tại ${activeTab?.url || 'URL hiện tại'}.`,
        `Ảnh component đã được crop lưu tại:`,
        `Path: ${localPath}`,
        ``,
        `=== YÊU CẦU CHI TIẾT CỦA USER ===`,
        aiComment.trim() || `(Vui lòng chỉnh sửa/thiết kế lại component này như trong ảnh.)`,
        `=================================`,
        ``,
        `Vui lòng xem ảnh và thực hiện chỉnh sửa code tương ứng.`
      ];

      window.agentDeck.terminalWrite(targetPaneId, promptLines.join('\n') + '\n');
      alert('Đã xuất yêu cầu kèm hình ảnh component thành công vào Terminal!');
    } catch (err: any) {
      console.error('Export with prompt error:', err);
      alert(`Xuất yêu cầu thất bại: ${err.message || 'Lỗi không xác định'}`);
    }
  };

  const linkDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (linkDropdownRef.current?.contains(target)) return;
      // Portal menu lives under document.body
      if (target instanceof Element && target.closest('.preview-select-dropdown')) return;
      setLinkDropdownOpen(false);
    }
    if (linkDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [linkDropdownOpen]);

  // ResizeObserver state for container width
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const webviewRef = useRef<any>(null);
  const [containerWidth, setContainerWidth] = useState(400);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width || 400);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Toggle designMode and inject hover/click listeners in the webview when Visual Edit is toggled
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const isWebviewReady = () => {
      try {
        return !!webview.getWebContentsId?.();
      } catch {
        return false;
      }
    };

    const runDisable = () => {
      if (!isWebviewReady()) {
        setSelectedElement(null);
        return;
      }

      webview.executeJavaScript(`
        document.designMode = 'off';
        (function() {
          window.__visualEditInjected = false;
          const style = document.getElementById('visual-edit-styles');
          if (style) style.remove();
          const hovered = document.querySelector('.agentdeck-hover');
          if (hovered) hovered.classList.remove('agentdeck-hover');
          const selected = document.querySelector('.agentdeck-selected');
          if (selected) selected.classList.remove('agentdeck-selected');
          const label = document.getElementById('agentdeck-hover-label');
          if (label) label.remove();
        })();
        true;
      `).catch(() => {});
      setSelectedElement(null);
    };

    const runEnable = () => {
      if (!isWebviewReady()) return;

      webview.executeJavaScript(`
        document.designMode = 'off';
        (function() {
          if (window.__visualEditInjected) return;
          window.__visualEditInjected = true;
          const style = document.createElement('style');
          style.id = 'visual-edit-styles';
          style.textContent = '.agentdeck-hover{outline:2px dashed #8b5cf6 !important;outline-offset:-2px !important;cursor:pointer !important;}.agentdeck-selected{outline:2px solid #8b5cf6 !important;outline-offset:-2px !important;}';
          document.head.appendChild(style);
          let hoveredEl = null;
          let selectedEl = null;
          const hoverLabel = document.createElement('div');
          hoverLabel.id = 'agentdeck-hover-label';
          hoverLabel.style.cssText = 'position:fixed;z-index:2147483647;display:none;padding:3px 8px;border-radius:9999px;background:#2563eb;color:#fff;font:600 12px/1 system-ui,sans-serif;pointer-events:none;box-shadow:0 6px 18px rgba(0,0,0,0.35)';
          document.body.appendChild(hoverLabel);
          const updateHoverLabel = (el) => {
            if (!el || el === document.body || el === document.documentElement) { hoverLabel.style.display = 'none'; return; }
            const tagName = el.tagName.toLowerCase();
            const className = typeof el.className === 'string' ? el.className.trim() : '';
            hoverLabel.textContent = className ? tagName + '.' + className.split(/\s+/)[0] : tagName;
            const rect = el.getBoundingClientRect();
            hoverLabel.style.left = Math.max(8, Math.min(window.innerWidth - 120, rect.left)) + 'px';
            hoverLabel.style.top = Math.max(8, rect.bottom + 6) + 'px';
            hoverLabel.style.display = 'block';
          };
          document.addEventListener('mouseover', (e) => {
            if (hoveredEl) hoveredEl.classList.remove('agentdeck-hover');
            hoveredEl = e.target;
            if (hoveredEl && hoveredEl !== document.body && hoveredEl !== document.documentElement) {
              hoveredEl.classList.add('agentdeck-hover');
              updateHoverLabel(hoveredEl);
            }
          }, true);
          document.addEventListener('mousemove', () => {
            if (hoveredEl && hoveredEl !== document.body && hoveredEl !== document.documentElement) updateHoverLabel(hoveredEl);
          }, true);
          document.addEventListener('mouseout', () => { if (hoveredEl) hoveredEl.classList.remove('agentdeck-hover'); hoveredEl = null; hoverLabel.style.display = 'none'; }, true);
          document.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (selectedEl) selectedEl.classList.remove('agentdeck-selected');
            selectedEl = e.target;
            if (selectedEl && selectedEl !== document.body && selectedEl !== document.documentElement) {
              selectedEl.classList.add('agentdeck-selected');
              const computed = window.getComputedStyle(selectedEl);
              const textContent = selectedEl.textContent || '';
              const elementType = selectedEl.children.length > 0 ? 'block' : 'leaf';
              const titleText = selectedEl.querySelector('h1, h2, h3, h4, h5, h6')?.textContent?.trim() || '';
              const paragraphText = selectedEl.querySelector('p')?.textContent?.trim() || '';
              console.log('[VisualEditSelect]', JSON.stringify({
                tagName: selectedEl.tagName.toUpperCase(),
                elementType,
                content: textContent,
                titleText,
                paragraphText,
                id: selectedEl.id || '',
                className: typeof selectedEl.className === 'string' ? selectedEl.className.replace(/\bagentdeck-hover\b/g, '').replace(/\bagentdeck-selected\b/g, '').replace(/\s+/g, ' ').trim() : '',
                fontSize: computed.fontSize || '16px',
                fontWeight: computed.fontWeight || '400',
                fontStyle: computed.fontStyle || 'normal',
                fontFamily: computed.fontFamily || 'sans-serif',
                textAlign: computed.textAlign || 'left',
                color: computed.color || '',
                backgroundColor: computed.backgroundColor || '',
                padding: computed.padding || '',
                margin: computed.margin || '',
                borderRadius: computed.borderRadius || '',
                paddingTop: computed.paddingTop || '0px',
                paddingRight: computed.paddingRight || '0px',
                paddingBottom: computed.paddingBottom || '0px',
                paddingLeft: computed.paddingLeft || '0px',
                marginTop: computed.marginTop || '0px',
                marginRight: computed.marginRight || '0px',
                marginBottom: computed.marginBottom || '0px',
                marginLeft: computed.marginLeft || '0px',
                borderWidth: computed.borderWidth || '0px',
                borderColor: computed.borderColor || '',
                borderStyle: computed.borderStyle || 'none',
                boxShadow: computed.boxShadow || 'none',
                opacity: computed.opacity || '1',
                src: selectedEl.tagName === 'IMG' ? (selectedEl.getAttribute('src') || '') : '',
                objectFit: computed.objectFit || 'fill',
                href: selectedEl.tagName === 'A' ? (selectedEl.getAttribute('href') || '') : ''
              }));
            }
          }, true);
        })();
        true;
      `).catch(() => {});
    };

    const onDomReady = () => {
      if (isVisualEdit) runEnable();
    };

    const onConsoleMessage = (e: any) => {
      const message = e.message || '';
      if (!message.startsWith('[VisualEditSelect]')) return;
      try {
        const nextSelected = JSON.parse(message.substring('[VisualEditSelect]'.length));
        const rawClass = nextSelected.className || '';
        const cleanClassName = rawClass
          .replace(/\bagentdeck-hover\b/g, '')
          .replace(/\bagentdeck-selected\b/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        const normalizedSelected = {
          ...nextSelected,
          className: cleanClassName,
          elementType: nextSelected.elementType || (nextSelected.tagName === 'DIV' ? 'block' : 'leaf'),
          content: nextSelected.titleText || nextSelected.paragraphText || nextSelected.content || ''
        };
        setSelectedElement(normalizedSelected);
        selectedElementBaseRef.current = normalizedSelected;
        setAiComment('');
      } catch (err) {
        console.error('Failed to parse selected element json data', err);
      }
    };

    if (isVisualEdit) runEnable(); else runDisable();
    webview.addEventListener('dom-ready', onDomReady);
    webview.addEventListener('console-message', onConsoleMessage);
    return () => {
      webview.removeEventListener('dom-ready', onDomReady);
      webview.removeEventListener('console-message', onConsoleMessage);
    };
  }, [isVisualEdit, iframeKey, activeTabId]);
  // Exit focus mode on unmount or tab change
  useEffect(() => {
    return () => {
      document.body.classList.remove('preview-focus-active');
    };
  }, []);

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Sync URL input when active tab changes
  useEffect(() => {
    if (activeTab) {
      setUrlInput(activeTab.url);
    }
  }, [activeTabId]);

  // Zoom logic removed as per user preference for manual resize.

  // Save preview tabs and active tab ID to local storage when they change
  useEffect(() => {
    localStorage.setItem('agentdeck:preview-tabs', JSON.stringify(previewTabs));
  }, [previewTabs]);

  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem('agentdeck:preview-active-tab-id', activeTabId);
    } else {
      localStorage.removeItem('agentdeck:preview-active-tab-id');
    }
  }, [activeTabId]);

  // Reset navigation states when active tab changes
  useEffect(() => {
    setCanGoBack(false);
    setCanGoForward(false);
  }, [activeTabId]);

  // Synchronize loading, error, and navigation states for the <webview> element
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleLoadStart = () => {
      setIframeStatus('loading');
    };
    const handleLoadStop = () => {
      setIframeStatus('loaded');
    };
    const handleLoadFail = (e: any) => {
      if (e && e.errorCode === -3) {
        return;
      }
      setIframeStatus('error');
    };

    const updateNavigationState = () => {
      try {
        setCanGoBack(webview.canGoBack());
        setCanGoForward(webview.canGoForward());
        const currentUrl = webview.getURL();
        if (currentUrl) {
          setPreviewTabs((prev) => {
            const tab = prev.find((t) => t.id === activeTabId);
            if (tab && currentUrl !== tab.url) {
              setUrlInput(currentUrl);
              return prev.map((t) =>
                t.id === activeTabId
                  ? {
                      ...t,
                      url: currentUrl,
                      title: currentUrl.replace(/^https?:\/\//, '').split('/')[0] || t.title
                    }
                  : t
              );
            }
            return prev;
          });
        }
      } catch (e) {
        // ignore if webview is not fully ready
      }
    };

    const handleDomReady = () => {
      updateNavigationState();
    };

    webview.addEventListener('did-start-loading', handleLoadStart);
    webview.addEventListener('did-stop-loading', handleLoadStop);
    webview.addEventListener('did-fail-load', handleLoadFail);
    webview.addEventListener('did-navigate', updateNavigationState);
    webview.addEventListener('did-navigate-in-page', updateNavigationState);
    webview.addEventListener('dom-ready', handleDomReady);

    // Listen on the outer window for mouse side-buttons (3 = back, 4 = forward).
    // We must do this at the renderer level because Electron consumes these button
    // events before the in-page JavaScript inside the <webview> has a chance to see them.
    const handleOuterMouseUp = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        if (webviewRef.current && webviewRef.current.canGoBack()) {
          webviewRef.current.goBack();
        }
      } else if (e.button === 4) {
        e.preventDefault();
        if (webviewRef.current && webviewRef.current.canGoForward()) {
          webviewRef.current.goForward();
        }
      }
    };
    window.addEventListener('mouseup', handleOuterMouseUp);

    return () => {
      webview.removeEventListener('did-start-loading', handleLoadStart);
      webview.removeEventListener('did-stop-loading', handleLoadStop);
      webview.removeEventListener('did-fail-load', handleLoadFail);
      webview.removeEventListener('did-navigate', updateNavigationState);
      webview.removeEventListener('did-navigate-in-page', updateNavigationState);
      webview.removeEventListener('dom-ready', handleDomReady);
      window.removeEventListener('mouseup', handleOuterMouseUp);
    };
  }, [iframeKey, activeTabId]);



  const handleDetectServers = async () => {
    setIsDetecting(true);
    try {
      const res = await window.agentDeck.detectDevServers();
      if (res.ok) {
        setDetectedServers(res.data);
      }
    } catch (err) {
      console.error('Failed to detect dev servers:', err);
    } finally {
      setIsDetecting(false);
    }
  };

  useEffect(() => {
    void handleDetectServers();
  }, []);

  const handleAddTab = (url?: string) => {
    const fallbackUrl = detectedServers.length > 0 ? detectedServers[0].url : 'http://localhost:3000';
    const finalUrl = url || urlInput.trim() || fallbackUrl;

    const defaultViewport = (localStorage.getItem('agentdeck:preview-viewport') as PreviewViewport) || 'desktop';

    const newTab: PreviewTab = {
      id: `preview-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      url: finalUrl,
      title: finalUrl.replace(/^https?:\/\//, '').split('/')[0],
      linkedPaneId: activePaneId,
      viewport: defaultViewport,
      createdAt: Date.now()
    };
    setPreviewTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setIframeStatus('loading');
    setIframeKey((k) => k + 1);
  };

  const handleCloseTab = (tabId: string) => {
    setPreviewTabs((prev) => prev.filter((t) => t.id !== tabId));
    if (activeTabId === tabId) {
      const remaining = previewTabs.filter((t) => t.id !== tabId);
      setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
    }
  };

  const handleGoBack = () => {
    if (webviewRef.current && webviewRef.current.canGoBack()) {
      webviewRef.current.goBack();
    }
  };

  const handleGoForward = () => {
    if (webviewRef.current && webviewRef.current.canGoForward()) {
      webviewRef.current.goForward();
    }
  };

  const handleRefresh = () => {
    setIframeKey((k) => k + 1);
    setIframeStatus('loading');
  };

  const handleOpenExternal = () => {
    if (activeTab) {
      void window.agentDeck.openExternalUrl(activeTab.url);
    }
  };

  // Improved Popout Window with dimension preservation
  const handlePopout = () => {
    if (activeTab) {
      void window.agentDeck.popoutPreview(activeTab.url, 1200, 800, 1.0);
    }
  };

  // Toggle Focus Mode
  const toggleFocusMode = () => {
    setIsFocusMode((prev) => {
      const next = !prev;
      if (next) {
        document.body.classList.add('preview-focus-active');
      } else {
        document.body.classList.remove('preview-focus-active');
      }
      return next;
    });
  };

  // Toggle Fullscreen Mode
  const toggleFullscreen = () => {
    if (!panelRef.current) return;
    if (!document.fullscreenElement) {
      panelRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('Fullscreen failed:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };



  const handleLinkPane = (paneId: string | null) => {
    if (!activeTabId) return;
    setPreviewTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, linkedPaneId: paneId } : t))
    );
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAddTab();
  };

  const handleIframeLoad = () => {
    setIframeStatus('loaded');
  };

  const handleIframeError = () => {
    setIframeStatus('error');
  };



  return (
    <div
      className="preview-panel"
      ref={panelRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#09090b',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {linkDropdownOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
            background: 'transparent',
            cursor: 'default'
          }}
          onMouseDown={() => {
            setLinkDropdownOpen(false);
          }}
        />
      )}
      {/* Preview Tabs — crisp-text-dark-ui */}
      {previewTabs.length > 0 && (
        <div className="preview-tab-row">
          {previewTabs.map((tab) => (
            <div
              key={tab.id}
              className={`preview-tab-btn ${activeTabId === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTabId(tab.id);
                setIframeKey((k) => k + 1);
                setIframeStatus('loading');
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.title}</span>
              <span
                onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id); }}
                className="preview-tab-close"
                title="Close tab"
                style={{
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CloseIcon size={10} />
              </span>
            </div>
          ))}

          <button
            type="button"
            onClick={() => handleAddTab()}
            className="preview-new-tab-btn"
            title="New tab"
            aria-label="New tab"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M12 6v12" />
              <path d="M6 12h12" />
            </svg>
          </button>
        </div>
      )}

      {/* Toolbar — solid surfaces, legible labels */}
      {activeTab && (
        <div className="preview-toolbar">
          <button
            type="button"
            className="preview-nav-btn"
            onClick={handleGoBack}
            disabled={!canGoBack}
            title="Go back (Back)"
          >
            <BackIcon size={16} />
          </button>

          <button
            type="button"
            className="preview-nav-btn"
            onClick={handleGoForward}
            disabled={!canGoForward}
            title="Go forward (Forward)"
          >
            <ForwardIcon size={16} />
          </button>

          <button
            type="button"
            className="preview-nav-btn"
            onClick={handleRefresh}
            title="Reload preview"
          >
            <RefreshIcon size={14} />
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!urlInput.trim()) return;
              setPreviewTabs(prev =>
                prev.map(t => t.id === activeTabId ? { ...t, url: urlInput, title: urlInput.replace(/^https?:\/\//, '').split('/')[0] } : t)
              );
              handleRefresh();
            }}
            className="preview-url-form"
          >
            <input
              type="text"
              className="preview-url-input"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="http://localhost:3000"
              title={urlInput || 'Press Enter to change URL and reload'}
              spellCheck={false}
            />
          </form>

          <div className="preview-divider" />

          <button
            type="button"
            className="preview-action-btn icon-only"
            onClick={handleOpenExternal}
            title="Open in default browser"
          >
            <BrowserIcon size={13} />
          </button>

          <button
            type="button"
            className={`preview-action-btn icon-only${isFocusMode ? ' is-on' : ''}`}
            onClick={toggleFocusMode}
            title={isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode (Expand preview)'}
          >
            {isFocusMode ? <ExitFocusIcon size={13} /> : <FocusIcon size={13} />}
          </button>

          <button
            type="button"
            className={`preview-action-btn icon-only${isFullscreen ? ' is-on' : ''}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (Expand preview)'}
          >
            {isFullscreen ? <ExitFullscreenIcon size={13} /> : <FullscreenIcon size={13} />}
          </button>

          <button
            type="button"
            className="preview-action-btn icon-only is-on"
            onClick={handlePopout}
            title="Open Preview in a separate window (1200x800)"
          >
            <PopoutIcon size={13} />
          </button>

          <button
            type="button"
            className="preview-action-btn icon-only is-on"
            onClick={() => {
              if (webviewRef.current) {
                webviewRef.current.openDevTools({ mode: 'detach' });
              }
            }}
            title="Open Developer Tools for this Web Preview (Detached window)"
          >
            <InspectIcon size={13} />
          </button>

          <div className="preview-divider" />

          <button
            type="button"
            className={`preview-action-btn visual${isVisualEdit ? ' is-on' : ''}`}
            onClick={() => {
              const next = !isVisualEdit;
              setIsVisualEdit(next);
              if (next) {
                setIsAnnotateMode(false);
              }
            }}
            title={isVisualEdit ? 'Exit Visual Edit mode' : 'Visual Edit – click any element to edit it directly'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Visual
          </button>

          <div className="preview-divider" />

          <button
            type="button"
            className={`preview-action-btn annotate${isAnnotateMode ? ' is-on' : ''}`}
            onClick={() => {
              const next = !isAnnotateMode;
              setIsAnnotateMode(next);
              if (next) {
                setIsVisualEdit(false);
              }
            }}
            title={isAnnotateMode ? 'Exit Annotation mode' : 'Annotate – draw directly on the preview to request changes'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 0L7 19l-4 1 1-4Z" />
            </svg>
            Annotate
          </button>

          <div className="preview-divider" />

          {/* Custom Link Pane Dropdown — portal so panel overflow doesn't clip "No link" */}
          <div className="preview-select-container" ref={linkDropdownRef}>
            <button
              type="button"
              className="preview-action-btn link"
              onClick={() => setLinkDropdownOpen(!linkDropdownOpen)}
              title="Link to Terminal Pane"
              aria-expanded={linkDropdownOpen}
            >
              <LinkIcon size={12} />
              <span>
                {activeTab.linkedPaneId
                  ? (panes.find((p) => p.id === activeTab.linkedPaneId)?.title || 'Linked')
                  : 'No link'}
              </span>
              <ChevronDownIcon size={11} />
            </button>

            {linkDropdownOpen &&
              createPortal(
                <div
                  className="preview-select-dropdown"
                  style={(() => {
                    const rect = linkDropdownRef.current?.getBoundingClientRect();
                    const menuWidth = 176;
                    const top = (rect?.bottom ?? 0) + 6;
                    let left = (rect?.right ?? menuWidth) - menuWidth;
                    if (left < 8) left = 8;
                    if (left + menuWidth > window.innerWidth - 8) {
                      left = Math.max(8, window.innerWidth - menuWidth - 8);
                    }
                    return {
                      position: 'fixed' as const,
                      top,
                      left,
                      zIndex: 100000,
                      display: 'flex',
                      flexDirection: 'column' as const,
                      gap: '2px',
                    };
                  })()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className={!activeTab.linkedPaneId ? 'is-active' : undefined}
                    onClick={() => {
                      handleLinkPane(null);
                      setLinkDropdownOpen(false);
                    }}
                  >
                    <LinkIcon size={12} />
                    <span>No link</span>
                  </button>
                  {panes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={activeTab.linkedPaneId === p.id ? 'is-active' : undefined}
                      onClick={() => {
                        handleLinkPane(p.id);
                        setLinkDropdownOpen(false);
                      }}
                    >
                      <LinkIcon size={12} />
                      <span>{p.title}</span>
                    </button>
                  ))}
                </div>,
                document.body
              )}
          </div>
        </div>
      )}

      {/* iframe Render Area with ResizeObserver Ref */}
      <div
        className="preview-body"
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden',
          background: '#0a0a0a'
        }}
      >
        {!activeTab ? (
          <div className="preview-empty-state" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '16px',
            color: '#e4e4e7',
            padding: '24px 16px',
            textAlign: 'center',
            background: 'radial-gradient(circle at center, rgba(30, 30, 35, 0.4) 0%, rgba(10, 10, 12, 0.9) 100%)'
          }}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              maxWidth: '380px',
              width: '100%',
              background: 'rgba(20, 20, 25, 0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
            }}>
              {/* Logo / Icon */}
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                marginBottom: '2px'
              }}>
                <GlobeIcon size={20} />
              </div>

              {/* Title & Scan Button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>New Tab Dashboard</h3>
                <button
                  onClick={handleDetectServers}
                  disabled={isDetecting}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: isDetecting ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.08)',
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    color: '#38bdf8',
                    fontSize: '10px',
                    cursor: isDetecting ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RefreshIcon size={9} />
                  {isDetecting ? 'Scanning...' : 'Detect Servers'}
                </button>
              </div>

              {/* Detected Servers */}
              {detectedServers.length > 0 ? (
                <div style={{ width: '100%' }}>
                  <div style={{ fontSize: '10px', color: '#71717a', textAlign: 'left', marginBottom: '6px' }}>Detected Servers:</div>
                  <div className="detected-servers-container" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', width: '100%', margin: 0 }}>
                    {detectedServers.map((server) => (
                      <button
                        key={server.port}
                        onClick={() => handleAddTab(server.url)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: 'rgba(34, 197, 94, 0.08)',
                          border: '1px solid rgba(34, 197, 94, 0.2)',
                          color: '#22c55e',
                          fontSize: '10px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.2s ease',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                        title={`${server.name} running on port ${server.port}`}
                      >
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                        :{server.port} <span style={{ color: '#a1a1aa', fontSize: '9px' }}>({server.name})</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ width: '100%', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '6px', padding: '8px', fontSize: '10px', color: '#71717a', textAlign: 'center', border: '1px dashed rgba(255, 255, 255, 0.05)' }}>
                  {!isDetecting ? 'No servers detected yet. Run a dev server from terminal.' : 'Scanning local ports for dev servers...'}
                </div>
              )}

              {/* URL Input Form */}
              <form onSubmit={handleUrlSubmit} style={{ display: 'flex', gap: '6px', width: '100%' }}>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="http://localhost:3000"
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    borderRadius: '6px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '11px',
                    outline: 'none',
                    fontFamily: 'monospace'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.35), rgba(56, 189, 248, 0.35))',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#7dd3fc',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Open Preview
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            background: '#09090b',
            overflow: 'hidden'
          }}>
                {/* Loading Overlay */}
                {iframeStatus === 'loading' && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(10, 10, 10, 0.85)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 10,
                    gap: '10px'
                  }}>
                    <div className="pulsing-glow" style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      border: '2px solid rgba(56, 189, 248, 0.3)',
                      borderTopColor: '#38bdf8',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    <span style={{ color: '#71717a', fontSize: '11px' }}>Loading {activeTab.url}...</span>
                  </div>
                )}

                {/* Error Overlay (Premium Empty State Card) */}
                {iframeStatus === 'error' && (() => {
                  const projectState = activeWorkspaceId ? projectRunStates[activeWorkspaceId] : undefined;
                  const projectStatus = projectState?.status || 'stopped';
                  
                  let title = 'No Preview Available';
                  let description = `Unable to reach ${activeTab.url}. Ensure your local server is running on this address.`;
                  let showSpinner = false;
                  
                  if (projectStatus === 'stopped') {
                    description = 'The project is stopped. Start the project to view the live preview.';
                  } else if (projectStatus === 'starting') {
                    title = 'Booting Server...';
                    description = 'The project is starting. Live preview will load once the server becomes available.';
                    showSpinner = true;
                  } else if (projectStatus === 'stopping') {
                    title = 'Stopping Server...';
                    description = 'The project is stopping. Live preview is currently unavailable.';
                    showSpinner = true;
                  } else if (projectStatus === 'failed') {
                    description = 'The project failed to start. Review the logs for errors.';
                  } else if (projectStatus === 'running') {
                    description = `The project is running, but the dev server at ${activeTab.url} is unreachable. It might still be starting up, or is hosting on a different address/port.`;
                  }
                  
                  return (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'rgba(9, 9, 11, 0.95)',
                      zIndex: 10,
                      padding: '30px',
                      textAlign: 'center'
                    }}>
                      {/* Premium Card Container */}
                      <div style={{
                        background: 'rgba(24, 24, 27, 0.65)',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '16px',
                        padding: '32px 24px',
                        maxWidth: '420px',
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px',
                        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
                      }}>
                        {/* Icon or Spinner */}
                        {showSpinner ? (
                          <div className="pulsing-glow" style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            border: '3px solid rgba(56, 189, 248, 0.2)',
                            borderTopColor: '#38bdf8',
                            animation: 'spin 1s linear infinite'
                          }} />
                        ) : (
                          <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: projectStatus === 'failed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: projectStatus === 'failed' ? '#ef4444' : '#38bdf8'
                          }}>
                            <WarningIcon size={24} />
                          </div>
                        )}

                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f4f4f5' }}>
                          {title}
                        </h3>
                        
                        <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa', lineHeight: 1.5 }}>
                          {description}
                        </p>

                        {/* Action buttons group */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '8px', width: '100%' }}>
                          {/* Run/Restart Project Button */}
                          {(projectStatus === 'stopped' || projectStatus === 'failed') && (
                            <button
                              onClick={() => {
                                if (!activeWorkspaceId) return;
                                const ws = workspaces.find((w) => w.id === activeWorkspaceId);
                                if (!ws) return;
                                if (!ws.runConfigs || ws.runConfigs.length === 0) {
                                  setShowRunConfigModalWorkspaceId(activeWorkspaceId);
                                  return;
                                }
                                const defaultConfigId = ws.defaultConfigId || ws.runConfigs[0].id;
                                void runProject(activeWorkspaceId, defaultConfigId);
                              }}
                              style={{
                                padding: '6px 16px',
                                borderRadius: '6px',
                                background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                color: '#ffffff',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              Run Project
                            </button>
                          )}

                          {projectStatus === 'running' && (
                            <>
                              <button
                                onClick={handleRefresh}
                                style={{
                                  padding: '6px 14px',
                                  borderRadius: '6px',
                                  background: 'rgba(56, 189, 248, 0.15)',
                                  border: '1px solid rgba(56, 189, 248, 0.3)',
                                  color: '#7dd3fc',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  cursor: 'pointer'
                                }}
                              >
                                Try Again
                              </button>
                              <button
                                onClick={() => {
                                  if (activeWorkspaceId) {
                                    void stopProject(activeWorkspaceId);
                                  }
                                }}
                                style={{
                                  padding: '6px 14px',
                                  borderRadius: '6px',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  color: '#ef4444',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  cursor: 'pointer'
                                }}
                              >
                                Stop Project
                              </button>
                            </>
                          )}

                          {/* Open Logs button */}
                          <button
                            onClick={() => {
                              if (activeWorkspaceId) {
                                setShowRunLogsModalWorkspaceId(activeWorkspaceId);
                              }
                            }}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              color: '#d4d4d8',
                              fontSize: '11px',
                              fontWeight: 500,
                              cursor: 'pointer'
                            }}
                          >
                            Open Logs
                          </button>

                          {/* Configure Run Commands button */}
                          <button
                            onClick={() => {
                              if (activeWorkspaceId) {
                                setShowRunConfigModalWorkspaceId(activeWorkspaceId);
                              }
                            }}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              background: 'transparent',
                              border: '1px dashed rgba(255, 255, 255, 0.15)',
                              color: '#a1a1aa',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                          >
                            Configure
                          </button>
                        </div>

                        {/* Inline URL Changer (Change URL) */}
                        <div style={{
                          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                          paddingTop: '16px',
                          width: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <span style={{ fontSize: '10px', color: '#71717a' }}>Preview URL Address:</span>
                          <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                            <input
                              type="text"
                              value={urlInput}
                              onChange={(e) => setUrlInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  setPreviewTabs((prev) =>
                                    prev.map((t) => t.id === activeTabId ? { ...t, url: urlInput, title: urlInput.replace(/^https?:\/\//, '').split('/')[0] } : t)
                                  );
                                  setIframeStatus('loading');
                                  setIframeKey((k) => k + 1);
                                }
                              }}
                              style={{
                                flex: 1,
                                padding: '6px 10px',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                color: '#e4e4e7',
                                fontSize: '11px',
                                outline: 'none',
                                fontFamily: 'monospace'
                              }}
                              placeholder="http://localhost:3000"
                            />
                            <button
                              onClick={() => {
                                setPreviewTabs((prev) =>
                                  prev.map((t) => t.id === activeTabId ? { ...t, url: urlInput, title: urlInput.replace(/^https?:\/\//, '').split('/')[0] } : t)
                                );
                                setIframeStatus('loading');
                                setIframeKey((k) => k + 1);
                              }}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.12)',
                                color: '#f4f4f5',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: 'pointer'
                              }}
                            >
                              Update URL
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

            <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
              {/* Sidebar editing interface */}
              {isVisualEdit && (
                <div
                  className="visual-inspector-sidebar"
                  style={{
                    width: '320px',
                    height: '100%',
                    background: '#121214',
                    borderRight: '1px solid #27272a',
                    display: 'flex',
                    flexDirection: 'column',
                    color: '#e4e4e7',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    WebkitFontSmoothing: 'antialiased',
                    MozOsxFontSmoothing: 'grayscale',
                    textRendering: 'optimizeLegibility',
                  }}
                >
                  {/* Sidebar Header — crisp-text-dark-ui */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid #27272a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      background: '#16161a',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: '11px',
                          background: '#1e1530',
                          color: '#c4b5fd',
                          border: '1px solid #6d28d9',
                          padding: '3px 7px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                          flexShrink: 0,
                        }}
                      >
                        {selectedElement ? selectedElement.tagName : 'Visual'}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>Inspector</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      {/* Send to Agent Button */}
                      <button
                        type="button"
                        onClick={async () => {
                          if (!webviewRef.current || !activeTab) return;
                          try {
                            const html = await webviewRef.current.executeJavaScript('document.documentElement.outerHTML');
                            const workspacePath = activeWorkspace?.rootPath;
                            if (!workspacePath) {
                              alert('No active workspace path found.');
                              return;
                            }
                            const targetPaneId = activeTab.linkedPaneId || activePaneId;
                            if (!targetPaneId) {
                              alert('Vui lòng chọn hoặc liên kết một Terminal Pane trước.');
                              return;
                            }
                            const tempFileName = '.agentdeck_visual_edit.html';
                            const isWindows = workspacePath.includes('\\');
                            const separator = isWindows ? '\\' : '/';
                            const absoluteTempPath = workspacePath.endsWith(separator)
                              ? `${workspacePath}${tempFileName}`
                              : `${workspacePath}${separator}${tempFileName}`;
                            const writeRes = await window.agentDeck.writeWorkspaceFile(workspacePath, absoluteTempPath, html);
                            if (!writeRes.ok) {
                              alert(`Không thể lưu file chỉnh sửa visual: ${writeRes.error?.message || 'Lỗi không xác định'}`);
                              return;
                            }

                            const selected = selectedElement;
                            const base = selectedElementBaseRef.current;
                            const changedFields = selected && base ? [
                              selected.content !== base.content ? `- text: ${JSON.stringify(selected.content)}` : null,
                              selected.id !== base.id && selected.id ? `- id: ${selected.id}` : null,
                              selected.className !== base.className && selected.className ? `- class: ${selected.className}` : null,
                              selected.fontSize !== base.fontSize ? `- fontSize: ${selected.fontSize}` : null,
                              selected.fontWeight !== base.fontWeight ? `- fontWeight: ${selected.fontWeight}` : null,
                              selected.fontStyle !== base.fontStyle ? `- fontStyle: ${selected.fontStyle}` : null,
                              selected.fontFamily !== base.fontFamily ? `- fontFamily: ${selected.fontFamily}` : null,
                              selected.textAlign !== base.textAlign ? `- textAlign: ${selected.textAlign}` : null,
                              selected.color !== base.color && selected.color ? `- color: ${selected.color}` : null,
                              selected.backgroundColor !== base.backgroundColor && selected.backgroundColor ? `- backgroundColor: ${selected.backgroundColor}` : null,
                              selected.padding !== base.padding && selected.padding ? `- padding: ${selected.padding}` : null,
                              selected.margin !== base.margin && selected.margin ? `- margin: ${selected.margin}` : null,
                              selected.borderRadius !== base.borderRadius && selected.borderRadius ? `- borderRadius: ${selected.borderRadius}` : null,
                              selected.paddingTop !== base.paddingTop ? `- paddingTop: ${selected.paddingTop}` : null,
                              selected.paddingRight !== base.paddingRight ? `- paddingRight: ${selected.paddingRight}` : null,
                              selected.paddingBottom !== base.paddingBottom ? `- paddingBottom: ${selected.paddingBottom}` : null,
                              selected.paddingLeft !== base.paddingLeft ? `- paddingLeft: ${selected.paddingLeft}` : null,
                              selected.marginTop !== base.marginTop ? `- marginTop: ${selected.marginTop}` : null,
                              selected.marginRight !== base.marginRight ? `- marginRight: ${selected.marginRight}` : null,
                              selected.marginBottom !== base.marginBottom ? `- marginBottom: ${selected.marginBottom}` : null,
                              selected.marginLeft !== base.marginLeft ? `- marginLeft: ${selected.marginLeft}` : null,
                              selected.borderWidth !== base.borderWidth ? `- borderWidth: ${selected.borderWidth}` : null,
                              selected.borderColor !== base.borderColor ? `- borderColor: ${selected.borderColor}` : null,
                              selected.borderStyle !== base.borderStyle ? `- borderStyle: ${selected.borderStyle}` : null,
                              selected.boxShadow !== base.boxShadow && selected.boxShadow ? `- boxShadow: ${selected.boxShadow}` : null,
                              selected.opacity !== base.opacity ? `- opacity: ${selected.opacity}` : null,
                              selected.src !== base.src && selected.src ? `- src: ${selected.src}` : null,
                              selected.objectFit !== base.objectFit && selected.objectFit ? `- objectFit: ${selected.objectFit}` : null,
                              selected.href !== base.href && selected.href ? `- href: ${selected.href}` : null
                            ].filter(Boolean).join('\n') : 'No changed fields detected.';

                            const prompt = [
                              `You are editing the source for a visual change made in the browser preview at ${activeTab.url}.`,
                              ``,
                              `The current preview HTML snapshot is saved at: ${tempFileName}`,
                              ``,
                              `Selection type: ${selected?.elementType || 'unknown'} (${selected?.tagName || 'unknown'})`,
                              `Changed element fields only:`,
                              changedFields,
                              ``,
                              aiComment.trim() ? `User custom instructions / refinement comments:\n> "${aiComment.trim()}"\n` : ``,
                              `Task: identify the exact source component/template that renders this element, update only the code needed to match the changed fields, and then remove ${tempFileName}.`,
                              `If there are multiple plausible files, inspect the rendered structure in the repo and choose the narrowest change that reproduces the edit.`,
                              `Do not repeat unchanged attributes unless they are needed to understand the element identity.`
                            ].filter(Boolean).join('\n');

                            window.agentDeck.terminalWrite(targetPaneId, `${prompt}\r`);
                            alert('Đã gửi các thay đổi visual sang Agent ở Terminal thành công!');
                          } catch (err) {
                            console.error(err);
                            alert(`Gặp lỗi khi gửi thay đổi visual: ${err instanceof Error ? err.message : String(err)}`);
                          }
                        }}
                        id="visual-apply-header-btn"
                        style={{
                          background: '#0f1f1a',
                          border: '1px solid #166534',
                          borderRadius: '6px',
                          color: '#4ade80',
                          fontSize: '12px',
                          fontWeight: 600,
                          padding: '5px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#14532d'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#0f1f1a'; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        Apply
                      </button>

                      {/* Exit Visual Edit Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsVisualEdit(false);
                          webviewRef.current?.executeJavaScript(`
                            document.designMode = 'off';
                            if (window.__visualEditStyle) window.__visualEditStyle.disabled = true;
                            true;
                          `).catch(() => {});
                        }}
                        style={{
                          background: '#18181b',
                          border: '1px solid #27272a',
                          borderRadius: '6px',
                          color: '#e4e4e7',
                          fontSize: '12px',
                          fontWeight: 600,
                          padding: '5px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#27272a'; e.currentTarget.style.borderColor = '#3f3f46'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#18181b'; e.currentTarget.style.borderColor = '#27272a'; }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Close
                      </button>
                    </div>
                  </div>

                  {/* Sidebar Content */}
                  {!selectedElement ? (
                    <div
                      style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '24px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                      }}
                    >
                      <div
                        style={{
                          background: '#141416',
                          border: '1px dashed rgba(255, 255, 255, 0.12)',
                          borderRadius: '8px',
                          padding: '28px 18px',
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '12px',
                          maxWidth: '280px',
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                      >
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: '#1e1530',
                            border: '1px solid #4c1d95',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#c4b5fd',
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>
                          No element selected
                        </span>
                        <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa', lineHeight: 1.5 }}>
                          Click on any element in the preview panel to edit its text, typography styling, classes, padding, margin, and borders in real-time.
                        </p>
                      </div>
                    </div>
                  ) : (() => {
                    const FONT_SIZE_MAP = [
                      { label: 'XS', value: '12px' },
                      { label: 'Small', value: '14px' },
                      { label: 'Body', value: '16px' },
                      { label: 'Large', value: '18px' },
                      { label: 'Extra Large', value: '20px' },
                      { label: '2XL', value: '24px' },
                      { label: '3XL', value: '30px' },
                      { label: '4XL', value: '36px' },
                      { label: '5XL', value: '48px' },
                      { label: '6XL', value: '60px' },
                      { label: '7XL', value: '72px' },
                      { label: '8XL', value: '96px' },
                      { label: '9XL', value: '128px' }
                    ];

                    const FONT_WEIGHT_MAP = [
                      { label: 'Thin', value: '100' },
                      { label: 'Extralight', value: '200' },
                      { label: 'Light', value: '300' },
                      { label: 'Normal', value: '400' },
                      { label: 'Medium', value: '500' },
                      { label: 'Semibold', value: '600' },
                      { label: 'Bold', value: '700' },
                      { label: 'Extrabold', value: '800' }
                    ];

                    const getNormalizedWeight = (weight: string) => {
                      if (!weight) return '400';
                      const w = weight.toLowerCase();
                      if (w === 'normal') return '400';
                      if (w === 'bold') return '700';
                      const match = w.match(/\d+/);
                      return match ? match[0] : '400';
                    };

                    const currentSizeValue = selectedElement.fontSize;
                    const isPresetSize = FONT_SIZE_MAP.some(item => item.value === currentSizeValue);

                    const normalizedWeight = getNormalizedWeight(selectedElement.fontWeight);
                    const isPresetWeight = FONT_WEIGHT_MAP.some(item => item.value === normalizedWeight);

                    const PRESET_COLORS = [
                      { name: 'slate-50', hex: '#f8fafc' },
                      { name: 'slate-100', hex: '#f1f5f9' },
                      { name: 'slate-200', hex: '#e2e8f0' },
                      { name: 'slate-300', hex: '#cbd5e1' },
                      { name: 'slate-400', hex: '#94a3b8' },
                      { name: 'slate-500', hex: '#64748b' },
                      { name: 'slate-600', hex: '#475569' },
                      { name: 'slate-700', hex: '#334155' },
                      { name: 'slate-800', hex: '#1e293b' },
                      { name: 'slate-900', hex: '#0f172a' },
                      { name: 'violet-500', hex: '#8b5cf6' },
                      { name: 'indigo-500', hex: '#6366f1' },
                      { name: 'emerald-500', hex: '#10b981' },
                      { name: 'rose-500', hex: '#f43f5e' }
                    ];

                    const renderColorPickerPopover = (field: 'text' | 'bg' | 'border') => {
                      const currentValue = field === 'text' ? selectedElement.color : field === 'bg' ? selectedElement.backgroundColor : selectedElement.borderColor;
                      const filteredColors = PRESET_COLORS.filter(c => c.name.toLowerCase().includes(colorSearchQuery.toLowerCase()) || c.hex.toLowerCase().includes(colorSearchQuery.toLowerCase()));

                      return (
                        <div style={{
                          position: 'absolute',
                          bottom: '100%',
                          right: 0,
                          width: '240px',
                          background: '#18181b',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '8px',
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)',
                          zIndex: 250,
                          marginBottom: '6px',
                          padding: '10px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          fontFamily: 'system-ui, sans-serif'
                        }}>
                          {/* Tabs */}
                          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255,255,255,0.04)' }}>
                            <button
                              onClick={() => setColorPickerTab('styles')}
                              style={{
                                flex: 1,
                                background: colorPickerTab === 'styles' ? '#27272a' : 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                color: colorPickerTab === 'styles' ? '#ffffff' : '#a1a1aa',
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '4px 0',
                                cursor: 'pointer'
                              }}
                            >
                              Styles
                            </button>
                            <button
                              onClick={() => setColorPickerTab('custom')}
                              style={{
                                flex: 1,
                                background: colorPickerTab === 'custom' ? '#27272a' : 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                color: colorPickerTab === 'custom' ? '#ffffff' : '#a1a1aa',
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '4px 0',
                                cursor: 'pointer'
                              }}
                            >
                              Custom
                            </button>
                          </div>

                          {colorPickerTab === 'styles' ? (
                            <>
                              {/* Search Query */}
                              <div style={{ position: 'relative' }}>
                                <input
                                  type="text"
                                  placeholder="Search colors..."
                                  value={colorSearchQuery}
                                  onChange={(e) => setColorSearchQuery(e.target.value)}
                                  style={{
                                    width: '100%',
                                    background: '#09090b',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '4px',
                                    color: '#ffffff',
                                    padding: '4px 8px',
                                    fontSize: '11px',
                                    outline: 'none'
                                  }}
                                />
                              </div>

                              {/* Color Scroll List */}
                              <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {filteredColors.map((color) => {
                                  const isSelected = currentValue === color.hex || currentValue.toLowerCase().includes(color.name);
                                  return (
                                    <button
                                      key={color.name}
                                      onClick={() => {
                                        const cssProp = field === 'text' ? 'color' : field === 'bg' ? 'backgroundColor' : 'borderColor';
                                        handleUpdateStyle(cssProp, cssProp, color.hex);
                                        setActiveColorPickerField(null);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        width: '100%',
                                        background: isSelected ? 'rgba(139,92,246,0.1)' : 'transparent',
                                        border: 'none',
                                        borderRadius: '4px',
                                        padding: '4px 6px',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        color: isSelected ? '#ffffff' : '#d4d4d8',
                                        fontSize: '11px'
                                      }}
                                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: color.hex, border: '1px solid rgba(255,255,255,0.1)' }} />
                                      <span style={{ flex: 1, fontWeight: isSelected ? 600 : 400 }}>{color.name}</span>
                                    </button>
                                  );
                                })}
                                {filteredColors.length === 0 && (
                                  <div style={{ padding: '12px', textAlign: 'center', color: '#71717a', fontSize: '10px' }}>No matches found</div>
                                )}
                              </div>
                            </>
                          ) : (
                            /* Custom Palette */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="color"
                                  value={currentValue.startsWith('#') && currentValue.length === 7 ? currentValue : '#000000'}
                                  onChange={(e) => {
                                    const cssProp = field === 'text' ? 'color' : field === 'bg' ? 'backgroundColor' : 'borderColor';
                                    handleUpdateStyle(cssProp, cssProp, e.target.value);
                                  }}
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '4px',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    padding: 0
                                  }}
                                />
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  <span style={{ fontSize: '9px', color: '#71717a', textTransform: 'uppercase', fontWeight: 'bold' }}>Value</span>
                                  <input
                                    type="text"
                                    value={currentValue}
                                    onChange={(e) => {
                                      const cssProp = field === 'text' ? 'color' : field === 'bg' ? 'backgroundColor' : 'borderColor';
                                      handleUpdateStyle(cssProp, cssProp, e.target.value);
                                    }}
                                    style={{
                                      width: '100%',
                                      background: '#09090b',
                                      border: '1px solid rgba(255,255,255,0.08)',
                                      borderRadius: '4px',
                                      color: '#ffffff',
                                      padding: '4px 6px',
                                      fontSize: '11px',
                                      fontFamily: 'monospace',
                                      outline: 'none'
                                    }}
                                  />
                                </div>
                              </div>
                              <button
                                onClick={() => setActiveColorPickerField(null)}
                                style={{
                                  width: '100%',
                                  background: '#8b5cf6',
                                  border: 'none',
                                  borderRadius: '4px',
                                  color: '#ffffff',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '5px 0',
                                  cursor: 'pointer',
                                  marginTop: '4px'
                                }}
                              >
                                Apply
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    };

                    return (
                      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto' }}>
                      {/* Element Selector Info */}
                      <div>
                        <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#71717a', fontWeight: 'bold', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>
                          Element Identifier
                        </label>
                        <div style={{ fontSize: '12px', background: '#1c1c1e', padding: '8px 12px', borderRadius: '6px', wordBreak: 'break-all', fontFamily: 'monospace', color: '#e4e4e7', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                          <span style={{ color: '#f43f5e' }}>{selectedElement.elementType || selectedElement.tagName.toLowerCase()}</span>
                          {selectedElement.id && <span style={{ color: '#38bdf8' }}>#{selectedElement.id}</span>}
                        </div>
                      </div>

                      {/* Component Image Capture Section */}
                      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '14px' }}>
                        <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#71717a', fontWeight: 'bold', display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>
                          Component Image Capture
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {/* Padding selector */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 500 }}>Crop Padding:</span>
                            <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                              {[0, 8, 16, 24].map((p) => {
                                const active = capturePadding === p;
                                return (
                                  <button
                                    key={p}
                                    onClick={() => setCapturePadding(p)}
                                    style={{
                                      background: active ? '#8b5cf6' : 'transparent',
                                      border: 'none',
                                      borderRadius: '4px',
                                      color: active ? '#ffffff' : '#a1a1aa',
                                      fontSize: '11px',
                                      fontWeight: 600,
                                      padding: '2px 8px',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    {p}px
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Capture Actions */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            <button
                              onClick={() => handleCaptureElement(false)}
                              disabled={isCapturing}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                background: 'rgba(139, 92, 246, 0.15)',
                                border: '1px solid rgba(139, 92, 246, 0.3)',
                                borderRadius: '6px',
                                color: '#c4b5fd',
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '6px 8px',
                                cursor: isCapturing ? 'not-allowed' : 'pointer',
                                opacity: isCapturing ? 0.6 : 1,
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => { if (!isCapturing) e.currentTarget.style.background = 'rgba(139, 92, 246, 0.25)'; }}
                              onMouseLeave={(e) => { if (!isCapturing) e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)'; }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                              Capture Selected
                            </button>
                            <button
                              onClick={() => handleCaptureElement(true)}
                              disabled={isCapturing}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                background: '#1c1c1e',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '6px',
                                color: '#ffffff',
                                fontSize: '11px',
                                fontWeight: 500,
                                padding: '6px 8px',
                                cursor: isCapturing ? 'not-allowed' : 'pointer',
                                opacity: isCapturing ? 0.6 : 1,
                                transition: 'all 0.15s ease'
                              }}
                              onMouseEnter={(e) => { if (!isCapturing) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; }}
                              onMouseLeave={(e) => { if (!isCapturing) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                              Capture Parent
                            </button>
                          </div>

                          {/* Image preview & Export tools if captured */}
                          {isCapturing && (
                            <div style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: '#1c1c1e', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                              <div className="animate-spin" style={{ width: '12px', height: '12px', border: '2px solid #8b5cf6', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
                              <span style={{ fontSize: '11px', color: '#a1a1aa' }}>Chụp và trích xuất ảnh...</span>
                            </div>
                          )}

                          {capturedImage && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255, 255, 255, 0.01)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.04)', marginTop: '4px' }}>
                              {/* Crop preview box */}
                              <div style={{
                                width: '100%',
                                maxHeight: '110px',
                                background: '#141416',
                                backgroundImage: 'linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)',
                                backgroundSize: '10px 10px',
                                backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                borderRadius: '6px',
                                overflow: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '8px'
                              }}>
                                <img
                                  src={capturedImage}
                                  alt="Captured component"
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '90px',
                                    objectFit: 'contain',
                                    borderRadius: '4px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                                  }}
                                />
                              </div>

                              {/* Action buttons */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                  <button
                                    onClick={handleCopyCapturedImage}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '4px',
                                      background: '#1c1c1e',
                                      border: '1px solid rgba(255, 255, 255, 0.08)',
                                      borderRadius: '4px',
                                      color: '#ffffff',
                                      fontSize: '11px',
                                      padding: '4px 6px',
                                      cursor: 'pointer',
                                      fontWeight: 500,
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
                                  >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                    Copy image
                                  </button>
                                  <button
                                    onClick={handleSaveCapturedImage}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '4px',
                                      background: '#1c1c1e',
                                      border: '1px solid rgba(255, 255, 255, 0.08)',
                                      borderRadius: '4px',
                                      color: '#ffffff',
                                      fontSize: '11px',
                                      padding: '4px 6px',
                                      cursor: 'pointer',
                                      fontWeight: 500,
                                      transition: 'all 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
                                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
                                  >
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                                    Save image
                                  </button>
                                </div>
                                <button
                                  onClick={handleExportWithPrompt}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    background: '#8b5cf6',
                                    border: 'none',
                                    borderRadius: '4px',
                                    color: '#ffffff',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    padding: '5px 8px',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s ease'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#7c3aed'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = '#8b5cf6'}
                                >
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                  Export with prompt
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* AI Refinement / Comment block */}
                      <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '14px' }}>
                        <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#71717a', fontWeight: 'bold', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>
                          Add Comment to Agent
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <textarea
                            value={aiComment}
                            onChange={(e) => setAiComment(e.target.value)}
                            placeholder="Ví dụ: 'Bo tròn nút này thêm', 'Tạo hiệu ứng hover lấp lánh', v.v."
                            style={{
                              width: '100%',
                              height: '60px',
                              background: '#1c1c1e',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '6px',
                              color: '#ffffff',
                              padding: '8px 10px',
                              fontSize: '12px',
                              fontFamily: 'inherit',
                              resize: 'none',
                              outline: 'none',
                              transition: 'border-color 0.15s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                          />
                          {aiComment.trim() && (
                            <button
                              onClick={async () => {
                                const applyBtn = document.getElementById('visual-apply-header-btn');
                                if (applyBtn) {
                                  applyBtn.click();
                                }
                              }}
                              style={{
                                alignSelf: 'flex-end',
                                background: '#8b5cf6',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 10px',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'background 0.15s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = '#7c3aed'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#8b5cf6'}
                            >
                              Send Comment
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Text content live edit */}
                      {selectedElement.elementType !== 'block' && selectedElement.tagName !== 'IMG' && selectedElement.tagName !== 'A' && (
                        <div>
                          <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#71717a', fontWeight: 'bold', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>
                            Text Content
                          </label>
                          <textarea
                            value={selectedElement.content}
                            onChange={(e) => handleUpdateContent(e.target.value)}
                            style={{
                              width: '100%',
                              height: '70px',
                              background: '#1c1c1e',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '6px',
                              color: '#ffffff',
                              padding: '8px 10px',
                              fontSize: '13px',
                              fontFamily: 'inherit',
                              resize: 'vertical',
                              outline: 'none',
                              transition: 'border-color 0.15s'
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                          />
                        </div>
                      )}

                      {/* Specialized Link Editor for A tags */}
                      {selectedElement.tagName === 'A' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#71717a', fontWeight: 'bold', display: 'block', letterSpacing: '0.05em', marginBottom: '-2px' }}>
                            Text
                          </label>
                          <div>
                            <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Content</span>
                            <textarea
                              value={selectedElement.content}
                              onChange={(e) => handleUpdateContent(e.target.value)}
                              style={{
                                width: '100%',
                                height: '70px',
                                background: '#1c1c1e',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                color: '#ffffff',
                                padding: '8px 10px',
                                fontSize: '13px',
                                fontFamily: 'inherit',
                                resize: 'vertical',
                                outline: 'none',
                                transition: 'border-color 0.15s'
                              }}
                              onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
                              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                            />
                          </div>

                          <div>
                            <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>URL</span>
                            <input
                              type="text"
                              value={selectedElement.href || ''}
                              onChange={(e) => handleUpdateStyle('href', 'href', e.target.value)}
                              placeholder="#"
                              style={{
                                width: '100%',
                                background: '#1c1c1e',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '6px',
                                color: '#ffffff',
                                padding: '8px 10px',
                                fontSize: '13px',
                                outline: 'none',
                                transition: 'border-color 0.15s'
                              }}
                              onFocus={(e) => e.target.style.borderColor = '#8b5cf6'}
                              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'}
                            />
                          </div>
                        </div>
                      )}

                      {/* Specialized Image Editor for IMG tags */}
                      {selectedElement.tagName === 'IMG' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div>
                            <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#71717a', fontWeight: 'bold', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>
                              Image
                            </label>
                            
                            <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Preview</span>
                            <div style={{
                              width: '100%',
                              height: '140px',
                              background: '#1c1c1e',
                              border: '1px dashed rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'relative',
                              padding: '10px'
                            }}>
                              {selectedElement.src ? (
                                <img
                                  src={selectedElement.src}
                                  alt="Preview"
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: (selectedElement.objectFit as any) || 'contain',
                                    borderRadius: '4px'
                                  }}
                                />
                              ) : (
                                <div style={{ fontSize: '10px', color: '#71717a', textAlign: 'center' }}>
                                  No image source
                                </div>
                              )}
                            </div>
                            
                            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255, 255, 255, 0.02)', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                              <span style={{ fontSize: '10px', color: '#71717a', display: 'block', textAlign: 'center', fontWeight: 500 }}>
                                Replace with any JPG, PNG, WEBP, or SVG file up to 20MB
                              </span>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <input
                                  type="file"
                                  ref={imageFileInputRef}
                                  onChange={handleImageUpload}
                                  accept="image/*"
                                  style={{ display: 'none' }}
                                />
                                <button
                                  onClick={() => imageFileInputRef.current?.click()}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    background: '#1c1c1e',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '6px',
                                    color: '#ffffff',
                                    fontSize: '11px',
                                    padding: '6px 10px',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a1a1aa' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                  Upload file
                                </button>
                                <button
                                  onClick={() => {
                                    const url = prompt('Nhập URL hình ảnh mới:', selectedElement.src);
                                    if (url !== null) {
                                      handleUpdateStyle('src', 'src', url);
                                    }
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    background: '#1c1c1e',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '6px',
                                    color: '#ffffff',
                                    fontSize: '11px',
                                    padding: '6px 10px',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    transition: 'all 0.15s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
                                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                                >
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a1a1aa' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                  Add image URL
                                </button>
                              </div>
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#71717a', fontWeight: 'bold', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>
                              Layout
                            </label>
                            <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Object Fit</span>
                            <select
                              value={selectedElement.objectFit || 'fill'}
                              onChange={(e) => handleUpdateStyle('objectFit', 'objectFit', e.target.value)}
                              style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px', fontSize: '11px', outline: 'none' }}
                            >
                              <option value="fill">Fill</option>
                              <option value="contain">Contain</option>
                              <option value="cover">Cover</option>
                              <option value="scale-down">Scale down</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {/* Typography Customizers */}
                      {selectedElement.tagName !== 'IMG' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '14px' }}>
                          <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#71717a', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                            Typography Style
                          </label>
                            <div>
                              <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Font Family</span>
                              <select
                                value={selectedElement.fontFamily || 'sans-serif'}
                                onChange={(e) => handleUpdateStyle('fontFamily', 'fontFamily', e.target.value)}
                                style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px', fontSize: '11px', outline: 'none', fontFamily: 'inherit' }}
                              >
                                {[
                                  { label: 'Default Sans-serif', value: 'system-ui, -apple-system, sans-serif' },
                                  { label: 'Inter', value: 'Inter, sans-serif' },
                                  { label: 'Outfit', value: 'Outfit, sans-serif' },
                                  { label: 'Roboto', value: 'Roboto, sans-serif' },
                                  { label: 'Poppins', value: 'Poppins, sans-serif' },
                                  { label: 'Montserrat', value: 'Montserrat, sans-serif' },
                                  { label: 'Open Sans', value: 'Open Sans, sans-serif' },
                                  { label: 'Default Serif', value: 'Georgia, serif' },
                                  { label: 'Playfair Display', value: 'Playfair Display, serif' },
                                  { label: 'Default Monospace', value: 'monospace' },
                                  { label: 'JetBrains Mono', value: 'JetBrains Mono, monospace' },
                                  { label: 'Fira Code', value: 'Fira Code, monospace' }
                                ].map((f) => (
                                  <option key={f.value} value={f.value} style={{ fontFamily: f.value.includes('sans-serif') ? 'sans-serif' : f.value.includes('serif') ? 'serif' : 'monospace' }}>
                                    {f.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                              <div>
                                <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Font Size</span>
                                <select
                                  value={isPresetSize ? currentSizeValue : (FONT_SIZE_MAP.find(item => item.label.toLowerCase() === currentSizeValue.toLowerCase())?.value || currentSizeValue)}
                                  onChange={(e) => handleUpdateStyle('fontSize', 'fontSize', e.target.value)}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px', fontSize: '11px', outline: 'none' }}
                                >
                                  {!isPresetSize && <option value={currentSizeValue}>Custom ({currentSizeValue})</option>}
                                  {FONT_SIZE_MAP.map((item) => (
                                    <option key={item.value} value={item.value}>{item.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Font Style</span>
                                <select
                                  value={selectedElement.fontStyle}
                                  onChange={(e) => handleUpdateStyle('fontStyle', 'fontStyle', e.target.value)}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px', fontSize: '11px', outline: 'none' }}
                                >
                                  <option value="normal">Normal</option>
                                  <option value="italic">Italic</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Font Weight</span>
                              <select
                                  value={normalizedWeight}
                                  onChange={(e) => handleUpdateStyle('fontWeight', 'fontWeight', e.target.value)}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px', fontSize: '11px', outline: 'none' }}
                                >
                                  {!isPresetWeight && <option value={normalizedWeight}>Custom ({selectedElement.fontWeight})</option>}
                                  {FONT_WEIGHT_MAP.map((item) => (
                                    <option key={item.value} value={item.value}>{item.label}</option>
                                  ))}
                              </select>
                            </div>

                            <div>
                              <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Alignment</span>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                                {[
                                  { al: 'left', icon: '⟸' },
                                  { al: 'center', icon: '↔' },
                                  { al: 'right', icon: '⟹' },
                                  { al: 'justify', icon: '☰' }
                                ].map(({ al, icon }) => {
                                  const active = selectedElement.textAlign === al;
                                  return (
                                    <button
                                      key={al}
                                      onClick={() => handleUpdateStyle('textAlign', 'textAlign', al)}
                                      style={{
                                        padding: '6px 0',
                                        fontSize: '12px',
                                        borderRadius: '4px',
                                        background: active ? '#8b5cf6' : '#1c1c1e',
                                        color: '#ffffff',
                                        border: '1px solid rgba(255,255,255,0.08)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                      }}
                                      title={al}
                                    >
                                      {icon}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}

                      {/* Layout & Spacing */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '14px' }}>
                        <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#71717a', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                          Spacing & Layout
                        </label>

                        {/* Margin Section */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 500 }}>Margin</span>
                            <button
                              onClick={() => setIsMarginExpanded(!isMarginExpanded)}
                              style={{
                                background: isMarginExpanded ? 'rgba(59,130,246,0.2)' : 'transparent',
                                border: '1px solid ' + (isMarginExpanded ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'),
                                borderRadius: '4px',
                                color: isMarginExpanded ? '#60a5fa' : '#a1a1aa',
                                padding: '3px 6px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                transition: 'all 0.15s'
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3"/>
                                <rect x="7" y="7" width="10" height="10" rx="1"/>
                              </svg>
                              <span>{isMarginExpanded ? 'Individual' : 'Simple'}</span>
                            </button>
                          </div>

                          {!isMarginExpanded ? (
                            /* Simple Margin Mode */
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <div style={{ flex: 1, position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: '#71717a', fontWeight: 'bold' }}>↔</span>
                                <input
                                  type="text"
                                  placeholder="0"
                                  value={selectedElement.marginLeft === selectedElement.marginRight ? selectedElement.marginLeft : ''}
                                  onChange={(e) => {
                                    handleUpdateStyle('marginLeft', 'marginLeft', e.target.value);
                                    handleUpdateStyle('marginRight', 'marginRight', e.target.value);
                                  }}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px 6px 20px', fontSize: '11px', outline: 'none' }}
                                />
                              </div>
                              <div style={{ flex: 1, position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: '#71717a', fontWeight: 'bold' }}>↕</span>
                                <input
                                  type="text"
                                  placeholder="0"
                                  value={selectedElement.marginTop === selectedElement.marginBottom ? selectedElement.marginTop : ''}
                                  onChange={(e) => {
                                    handleUpdateStyle('marginTop', 'marginTop', e.target.value);
                                    handleUpdateStyle('marginBottom', 'marginBottom', e.target.value);
                                  }}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px 6px 20px', fontSize: '11px', outline: 'none' }}
                                />
                              </div>
                            </div>
                          ) : (
                            /* Individual Margin Mode */
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: '#71717a', fontWeight: 'bold' }}>T</span>
                                <input
                                  type="text"
                                  value={selectedElement.marginTop}
                                  onChange={(e) => handleUpdateStyle('marginTop', 'marginTop', e.target.value)}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px 6px 18px', fontSize: '11px', outline: 'none' }}
                                />
                              </div>
                              <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: '#71717a', fontWeight: 'bold' }}>R</span>
                                <input
                                  type="text"
                                  value={selectedElement.marginRight}
                                  onChange={(e) => handleUpdateStyle('marginRight', 'marginRight', e.target.value)}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px 6px 18px', fontSize: '11px', outline: 'none' }}
                                />
                              </div>
                              <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: '#71717a', fontWeight: 'bold' }}>B</span>
                                <input
                                  type="text"
                                  value={selectedElement.marginBottom}
                                  onChange={(e) => handleUpdateStyle('marginBottom', 'marginBottom', e.target.value)}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px 6px 18px', fontSize: '11px', outline: 'none' }}
                                />
                              </div>
                              <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: '#71717a', fontWeight: 'bold' }}>L</span>
                                <input
                                  type="text"
                                  value={selectedElement.marginLeft}
                                  onChange={(e) => handleUpdateStyle('marginLeft', 'marginLeft', e.target.value)}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px 6px 18px', fontSize: '11px', outline: 'none' }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Padding Section */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 500 }}>Padding</span>
                            <button
                              onClick={() => setIsPaddingExpanded(!isPaddingExpanded)}
                              style={{
                                background: isPaddingExpanded ? 'rgba(59,130,246,0.2)' : 'transparent',
                                border: '1px solid ' + (isPaddingExpanded ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)'),
                                borderRadius: '4px',
                                color: isPaddingExpanded ? '#60a5fa' : '#a1a1aa',
                                padding: '3px 6px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                transition: 'all 0.15s'
                              }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3"/>
                                <rect x="7" y="7" width="10" height="10" rx="1"/>
                              </svg>
                              <span>{isPaddingExpanded ? 'Individual' : 'Simple'}</span>
                            </button>
                          </div>

                          {!isPaddingExpanded ? (
                            /* Simple Padding Mode */
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <div style={{ flex: 1, position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: '#71717a', fontWeight: 'bold' }}>↔</span>
                                <input
                                  type="text"
                                  placeholder="0"
                                  value={selectedElement.paddingLeft === selectedElement.paddingRight ? selectedElement.paddingLeft : ''}
                                  onChange={(e) => {
                                    handleUpdateStyle('paddingLeft', 'paddingLeft', e.target.value);
                                    handleUpdateStyle('paddingRight', 'paddingRight', e.target.value);
                                  }}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px 6px 20px', fontSize: '11px', outline: 'none' }}
                                />
                              </div>
                              <div style={{ flex: 1, position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: '#71717a', fontWeight: 'bold' }}>↕</span>
                                <input
                                  type="text"
                                  placeholder="0"
                                  value={selectedElement.paddingTop === selectedElement.paddingBottom ? selectedElement.paddingTop : ''}
                                  onChange={(e) => {
                                    handleUpdateStyle('paddingTop', 'paddingTop', e.target.value);
                                    handleUpdateStyle('paddingBottom', 'paddingBottom', e.target.value);
                                  }}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px 6px 20px', fontSize: '11px', outline: 'none' }}
                                />
                              </div>
                            </div>
                          ) : (
                            /* Individual Padding Mode */
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                              <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: '#71717a', fontWeight: 'bold' }}>T</span>
                                <input
                                  type="text"
                                  value={selectedElement.paddingTop}
                                  onChange={(e) => handleUpdateStyle('paddingTop', 'paddingTop', e.target.value)}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px 6px 18px', fontSize: '11px', outline: 'none' }}
                                />
                              </div>
                              <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: '#71717a', fontWeight: 'bold' }}>R</span>
                                <input
                                  type="text"
                                  value={selectedElement.paddingRight}
                                  onChange={(e) => handleUpdateStyle('paddingRight', 'paddingRight', e.target.value)}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px 6px 18px', fontSize: '11px', outline: 'none' }}
                                />
                              </div>
                              <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: '#71717a', fontWeight: 'bold' }}>B</span>
                                <input
                                  type="text"
                                  value={selectedElement.paddingBottom}
                                  onChange={(e) => handleUpdateStyle('paddingBottom', 'paddingBottom', e.target.value)}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px 6px 18px', fontSize: '11px', outline: 'none' }}
                                />
                              </div>
                              <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '9px', color: '#71717a', fontWeight: 'bold' }}>L</span>
                                <input
                                  type="text"
                                  value={selectedElement.paddingLeft}
                                  onChange={(e) => handleUpdateStyle('paddingLeft', 'paddingLeft', e.target.value)}
                                  style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px 6px 18px', fontSize: '11px', outline: 'none' }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Border & Effects Section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '14px' }}>
                        <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#71717a', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                          Border
                        </label>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Border Width</span>
                            <select
                              value={selectedElement.borderWidth === '0px' || selectedElement.borderWidth === '0' ? 'none' : selectedElement.borderWidth}
                              onChange={(e) => handleUpdateStyle('borderWidth', 'borderWidth', e.target.value === 'none' ? '0px' : e.target.value)}
                              style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px', fontSize: '11px', outline: 'none' }}
                            >
                              <option value="none">None</option>
                              <option value="1px">1px</option>
                              <option value="2px">2px</option>
                              <option value="4px">4px</option>
                              <option value="8px">8px</option>
                            </select>
                          </div>

                          <div style={{ position: 'relative' }}>
                            <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Border Color</span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', position: 'relative' }}>
                              <button
                                onClick={() => setActiveColorPickerField(activeColorPickerField === 'border' ? null : 'border')}
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: selectedElement.borderColor || 'rgba(255,255,255,0.1)',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                              />
                              <input
                                type="text"
                                value={selectedElement.borderColor}
                                onChange={(e) => handleUpdateStyle('borderColor', 'borderColor', e.target.value)}
                                style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '4px 6px', fontSize: '11px', outline: 'none' }}
                              />
                              {activeColorPickerField === 'border' && renderColorPickerPopover('border')}
                            </div>
                          </div>
                        </div>

                        <div>
                          <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Border Style</span>
                          <select
                            value={selectedElement.borderStyle || 'none'}
                            onChange={(e) => handleUpdateStyle('borderStyle', 'borderStyle', e.target.value)}
                            style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px', fontSize: '11px', outline: 'none' }}
                          >
                            <option value="none">Select border style</option>
                            <option value="solid">solid</option>
                            <option value="dashed">dashed</option>
                            <option value="dotted">dotted</option>
                            <option value="double">double</option>
                          </select>
                        </div>
                      </div>

                      {/* Effects Section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '14px' }}>
                        <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#71717a', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                          Effects
                        </label>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div>
                            <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Border Radius</span>
                            <select
                              value={selectedElement.borderRadius || '0px'}
                              onChange={(e) => handleUpdateStyle('borderRadius', 'borderRadius', e.target.value)}
                              style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px', fontSize: '11px', outline: 'none' }}
                            >
                              <option value="0px">None</option>
                              <option value="2px">Small</option>
                              <option value="4px">Default</option>
                              <option value="6px">Medium</option>
                              <option value="8px">Large</option>
                              <option value="12px">Extra Large</option>
                              <option value="16px">2XL</option>
                              <option value="24px">3XL</option>
                              <option value="9999px">Full</option>
                            </select>
                          </div>

                          <div>
                            <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Opacity</span>
                            <select
                              value={(function() {
                                const opacityVal = selectedElement.opacity;
                                if (!opacityVal) return '100%';
                                const num = parseFloat(opacityVal);
                                if (isNaN(num)) return '100%';
                                const percent = Math.round(num * 100);
                                return `${percent}%`;
                              })()}
                              onChange={(e) => {
                                const pct = e.target.value;
                                const num = parseFloat(pct) / 100;
                                handleUpdateStyle('opacity', 'opacity', num.toString());
                              }}
                              style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px', fontSize: '11px', outline: 'none' }}
                            >
                              <option value="100%">100%</option>
                              <option value="95%">95%</option>
                              <option value="90%">90%</option>
                              <option value="85%">85%</option>
                              <option value="80%">80%</option>
                              <option value="75%">75%</option>
                              <option value="70%">70%</option>
                              <option value="65%">65%</option>
                              <option value="60%">60%</option>
                              <option value="50%">50%</option>
                              <option value="40%">40%</option>
                              <option value="30%">30%</option>
                              <option value="25%">25%</option>
                              <option value="20%">20%</option>
                              <option value="10%">10%</option>
                              <option value="5%">5%</option>
                              <option value="0%">0%</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '6px', fontWeight: 500 }}>Shadow</span>
                          <select
                            value={(function() {
                              const shadowVal = selectedElement.boxShadow;
                              if (!shadowVal || shadowVal === 'none') return 'none';
                              const clean = shadowVal.toLowerCase().replace(/\s+/g, '');
                              if (clean.includes('inset')) return 'inset';
                              if (clean.includes('25px') || clean.includes('50px')) return '2xl';
                              if (clean.includes('20px') || clean.includes('25px')) return 'xl';
                              if (clean.includes('10px') || clean.includes('15px')) return 'large';
                              if (clean.includes('4px') || clean.includes('6px')) return 'medium';
                              if (clean.includes('1px') && clean.includes('3px')) return 'default';
                              if (clean.includes('1px') && clean.includes('2px')) return 'small';
                              return 'none';
                            })()}
                            onChange={(e) => {
                              const opt = e.target.value;
                              const shadowMap: Record<string, string> = {
                                none: 'none',
                                small: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                default: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
                                medium: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
                                large: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                                xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                                '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                                inset: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
                              };
                              handleUpdateStyle('boxShadow', 'boxShadow', shadowMap[opt] || 'none');
                            }}
                            style={{ width: '100%', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#ffffff', padding: '6px 8px', fontSize: '11px', outline: 'none' }}
                          >
                            <option value="none">None</option>
                            <option value="small">Small</option>
                            <option value="default">Default</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                            <option value="xl">Extra Large</option>
                            <option value="2xl">2XL</option>
                            <option value="inset">Inner shadow</option>
                          </select>
                        </div>
                      </div>

                      {/* Appearance Colors Section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '14px' }}>
                        <label style={{ fontSize: '10px', textTransform: 'uppercase', color: '#71717a', fontWeight: 'bold', letterSpacing: '0.05em' }}>
                          Appearance Colors
                        </label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>Text Color</span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <button
                                onClick={() => setActiveColorPickerField(activeColorPickerField === 'text' ? null : 'text')}
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  background: selectedElement.color || '#ffffff',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                              />
                              <input
                                type="text"
                                value={selectedElement.color}
                                onChange={(e) => handleUpdateStyle('color', 'color', e.target.value)}
                                style={{
                                  width: '100%',
                                  background: '#1c1c1e',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '4px',
                                  color: '#ffffff',
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  outline: 'none'
                                }}
                              />
                            </div>
                            {activeColorPickerField === 'text' && renderColorPickerPopover('text')}
                          </div>
                          <div style={{ flex: 1, position: 'relative' }}>
                            <span style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>Background</span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <button
                                onClick={() => setActiveColorPickerField(activeColorPickerField === 'bg' ? null : 'bg')}
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  background: selectedElement.backgroundColor || 'transparent',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                              />
                              <input
                                type="text"
                                value={selectedElement.backgroundColor}
                                onChange={(e) => handleUpdateStyle('backgroundColor', 'backgroundColor', e.target.value)}
                                style={{
                                  width: '100%',
                                  background: '#1c1c1e',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: '4px',
                                  color: '#ffffff',
                                  padding: '4px 8px',
                                  fontSize: '11px',
                                  outline: 'none'
                                }}
                              />
                            </div>
                            {activeColorPickerField === 'bg' && renderColorPickerPopover('bg')}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
                </div>
              )}

              {isAnnotateMode && renderAnnotationSidebar()}

              {/* Main webview wrapper */}
              <div
                id="agentdeck-webview-container"
                style={{
                  flex: 1,
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <webview
                  key={iframeKey}
                  src={activeTab.url}
                  ref={webviewRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    background: '#fff'
                  }}
                />

                {isAnnotateMode && (
                  <svg
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      zIndex: 10,
                      pointerEvents: (activeAnnotationTool === 'select' && !draggedAnnId && !resizingAnnId) ? 'none' : 'auto',
                      cursor: activeAnnotationTool === 'select' ? (draggedAnnId ? 'grabbing' : (resizingAnnId ? 'move' : 'default')) : 'crosshair',
                      background: 'transparent'
                    }}
                    onMouseDown={handleSvgMouseDown}
                    onMouseMove={handleSvgMouseMove}
                    onMouseUp={handleSvgMouseUp}
                  >
                    {/* Markers for Arrows */}
                    <defs>
                      {annotations.filter(ann => ann.type === 'arrow').map(ann => (
                        <marker
                          key={`marker-${ann.id}`}
                          id={`arrowhead-${ann.id}`}
                          markerWidth="6"
                          markerHeight="6"
                          refX="5"
                          refY="3"
                          orient="auto"
                          markerUnits="strokeWidth"
                        >
                          <path d="M0,0 L0,6 L6,3 Z" fill={ann.color} />
                        </marker>
                      ))}
                    </defs>

                    {/* Render existing annotations */}
                    {annotations.map((ann) => {
                      const isSelect = activeAnnotationTool === 'select';
                      const annStyle: React.CSSProperties = {
                        pointerEvents: 'auto',
                        cursor: isSelect ? (draggedAnnId === ann.id ? 'grabbing' : 'grab') : 'inherit'
                      };
                      const onMouseDown = (e: React.MouseEvent) => handleAnnotationMouseDown(ann.id, e);

                      if (ann.type === 'rectangle') {
                        return (
                          <g key={ann.id} style={annStyle} onMouseDown={onMouseDown}>
                            <rect
                              x={`${ann.x * 100}%`}
                              y={`${ann.y * 100}%`}
                              width={`${ann.width! * 100}%`}
                              height={`${ann.height! * 100}%`}
                              fill={isSelect ? 'rgba(0,0,0,0)' : 'none'}
                              stroke={ann.color}
                              strokeWidth={ann.strokeWidth}
                            />
                            <circle cx={`${ann.x * 100}%`} cy={`${ann.y * 100}%`} r="12" fill={ann.color} stroke="#fff" strokeWidth="1.5" />
                            <text x={`${ann.x * 100}%`} y={`${ann.y * 100}%`} dy="3.5" fill="#fff" fontSize="10px" fontWeight="bold" textAnchor="middle">{ann.order}</text>
                            
                            {isSelect && selectedAnnId === ann.id && (
                              <g>
                                <circle cx={`${ann.x * 100}%`} cy={`${ann.y * 100}%`} r="5" fill="#fff" stroke={ann.color} strokeWidth="1.5" style={{ cursor: 'nwse-resize', pointerEvents: 'auto' }} onMouseDown={(e) => handleResizeMouseDown(ann.id, 'tl', e)} />
                                <circle cx={`${(ann.x + ann.width!) * 100}%`} cy={`${ann.y * 100}%`} r="5" fill="#fff" stroke={ann.color} strokeWidth="1.5" style={{ cursor: 'nesw-resize', pointerEvents: 'auto' }} onMouseDown={(e) => handleResizeMouseDown(ann.id, 'tr', e)} />
                                <circle cx={`${ann.x * 100}%`} cy={`${(ann.y + ann.height!) * 100}%`} r="5" fill="#fff" stroke={ann.color} strokeWidth="1.5" style={{ cursor: 'nesw-resize', pointerEvents: 'auto' }} onMouseDown={(e) => handleResizeMouseDown(ann.id, 'bl', e)} />
                                <circle cx={`${(ann.x + ann.width!) * 100}%`} cy={`${(ann.y + ann.height!) * 100}%`} r="5" fill="#fff" stroke={ann.color} strokeWidth="1.5" style={{ cursor: 'nwse-resize', pointerEvents: 'auto' }} onMouseDown={(e) => handleResizeMouseDown(ann.id, 'br', e)} />
                              </g>
                            )}
                          </g>
                        );
                      }
                      if (ann.type === 'highlight') {
                        return (
                          <g key={ann.id} style={annStyle} onMouseDown={onMouseDown}>
                            <rect
                              x={`${ann.x * 100}%`}
                              y={`${ann.y * 100}%`}
                              width={`${ann.width! * 100}%`}
                              height={`${ann.height! * 100}%`}
                              fill={ann.color}
                              fillOpacity="0.3"
                            />
                            <circle cx={`${ann.x * 100}%`} cy={`${ann.y * 100}%`} r="12" fill={ann.color} stroke="#fff" strokeWidth="1.5" />
                            <text x={`${ann.x * 100}%`} y={`${ann.y * 100}%`} dy="3.5" fill="#fff" fontSize="10px" fontWeight="bold" textAnchor="middle">{ann.order}</text>
                            
                            {isSelect && selectedAnnId === ann.id && (
                              <g>
                                <circle cx={`${ann.x * 100}%`} cy={`${ann.y * 100}%`} r="5" fill="#fff" stroke={ann.color} strokeWidth="1.5" style={{ cursor: 'nwse-resize', pointerEvents: 'auto' }} onMouseDown={(e) => handleResizeMouseDown(ann.id, 'tl', e)} />
                                <circle cx={`${(ann.x + ann.width!) * 100}%`} cy={`${ann.y * 100}%`} r="5" fill="#fff" stroke={ann.color} strokeWidth="1.5" style={{ cursor: 'nesw-resize', pointerEvents: 'auto' }} onMouseDown={(e) => handleResizeMouseDown(ann.id, 'tr', e)} />
                                <circle cx={`${ann.x * 100}%`} cy={`${(ann.y + ann.height!) * 100}%`} r="5" fill="#fff" stroke={ann.color} strokeWidth="1.5" style={{ cursor: 'nesw-resize', pointerEvents: 'auto' }} onMouseDown={(e) => handleResizeMouseDown(ann.id, 'bl', e)} />
                                <circle cx={`${(ann.x + ann.width!) * 100}%`} cy={`${(ann.y + ann.height!) * 100}%`} r="5" fill="#fff" stroke={ann.color} strokeWidth="1.5" style={{ cursor: 'nwse-resize', pointerEvents: 'auto' }} onMouseDown={(e) => handleResizeMouseDown(ann.id, 'br', e)} />
                              </g>
                            )}
                          </g>
                        );
                      }
                      if (ann.type === 'arrow') {
                        return (
                          <g key={ann.id} style={annStyle} onMouseDown={onMouseDown}>
                            {/* Hit-test line for easy grabbing */}
                            <line
                              x1={`${ann.x * 100}%`}
                              y1={`${ann.y * 100}%`}
                              x2={`${(ann.x + ann.width!) * 100}%`}
                              y2={`${(ann.y + ann.height!) * 100}%`}
                              stroke="transparent"
                              strokeWidth={Math.max(ann.strokeWidth + 8, 12)}
                            />
                            <line
                              x1={`${ann.x * 100}%`}
                              y1={`${ann.y * 100}%`}
                              x2={`${(ann.x + ann.width!) * 100}%`}
                              y2={`${(ann.y + ann.height!) * 100}%`}
                              stroke={ann.color}
                              strokeWidth={ann.strokeWidth}
                              markerEnd={`url(#arrowhead-${ann.id})`}
                            />
                            <circle cx={`${ann.x * 100}%`} cy={`${ann.y * 100}%`} r="12" fill={ann.color} stroke="#fff" strokeWidth="1.5" />
                            <text x={`${ann.x * 100}%`} y={`${ann.y * 100}%`} dy="3.5" fill="#fff" fontSize="10px" fontWeight="bold" textAnchor="middle">{ann.order}</text>
                            
                            {isSelect && selectedAnnId === ann.id && (
                              <g>
                                <circle cx={`${ann.x * 100}%`} cy={`${ann.y * 100}%`} r="5" fill="#fff" stroke={ann.color} strokeWidth="1.5" style={{ cursor: 'move', pointerEvents: 'auto' }} onMouseDown={(e) => handleResizeMouseDown(ann.id, 'start', e)} />
                                <circle cx={`${(ann.x + ann.width!) * 100}%`} cy={`${(ann.y + ann.height!) * 100}%`} r="5" fill="#fff" stroke={ann.color} strokeWidth="1.5" style={{ cursor: 'move', pointerEvents: 'auto' }} onMouseDown={(e) => handleResizeMouseDown(ann.id, 'end', e)} />
                              </g>
                            )}
                          </g>
                        );
                      }
                      if (ann.type === 'pen') {
                        return (
                          <g key={ann.id} style={annStyle} onMouseDown={onMouseDown}>
                            {/* Hit-test path for easy grabbing */}
                            <path
                              d={ann.points!.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x * containerSize.width} ${p.y * containerSize.height}`).join(' ')}
                              fill="none"
                              stroke="transparent"
                              strokeWidth={Math.max(ann.strokeWidth + 8, 12)}
                            />
                            <path
                              d={ann.points!.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x * containerSize.width} ${p.y * containerSize.height}`).join(' ')}
                              fill="none"
                              stroke={ann.color}
                              strokeWidth={ann.strokeWidth}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {ann.points && ann.points.length > 0 && (
                              <g>
                                <circle cx={`${ann.points[0].x * 100}%`} cy={`${ann.points[0].y * 100}%`} r="12" fill={ann.color} stroke="#fff" strokeWidth="1.5" />
                                <text x={`${ann.points[0].x * 100}%`} y={`${ann.points[0].y * 100}%`} dy="3.5" fill="#fff" fontSize="10px" fontWeight="bold" textAnchor="middle">{ann.order}</text>
                              </g>
                            )}
                          </g>
                        );
                      }
                      if (ann.type === 'text') {
                        return (
                          <g key={ann.id} style={annStyle} onMouseDown={onMouseDown}>
                            <circle cx={`${ann.x * 100}%`} cy={`${ann.y * 100}%`} r="12" fill={ann.color} stroke="#fff" strokeWidth="1.5" />
                            <text x={`${ann.x * 100}%`} y={`${ann.y * 100}%`} dy="3.5" fill="#fff" fontSize="10px" fontWeight="bold" textAnchor="middle">{ann.order}</text>
                          </g>
                        );
                      }
                      return null;
                    })}

                    {/* Preview current drawing */}
                    {drawingStartPoint && drawingCurrentPoint && (
                      <>
                        {activeAnnotationTool === 'rectangle' && (
                          <rect
                            x={`${Math.min(drawingStartPoint.x, drawingCurrentPoint.x) * 100}%`}
                            y={`${Math.min(drawingStartPoint.y, drawingCurrentPoint.y) * 100}%`}
                            width={`${Math.abs(drawingStartPoint.x - drawingCurrentPoint.x) * 100}%`}
                            height={`${Math.abs(drawingStartPoint.y - drawingCurrentPoint.y) * 100}%`}
                            fill="none"
                            stroke={annotationColor}
                            strokeWidth={annotationStrokeWidth}
                            strokeDasharray="4 4"
                          />
                        )}
                        {activeAnnotationTool === 'highlight' && (
                          <rect
                            x={`${Math.min(drawingStartPoint.x, drawingCurrentPoint.x) * 100}%`}
                            y={`${Math.min(drawingStartPoint.y, drawingCurrentPoint.y) * 100}%`}
                            width={`${Math.abs(drawingStartPoint.x - drawingCurrentPoint.x) * 100}%`}
                            height={`${Math.abs(drawingStartPoint.y - drawingCurrentPoint.y) * 100}%`}
                            fill={annotationColor}
                            fillOpacity="0.2"
                            stroke={annotationColor}
                            strokeWidth={1}
                            strokeDasharray="4 4"
                          />
                        )}
                        {activeAnnotationTool === 'arrow' && (
                          <>
                            <defs>
                              <marker
                                id="temp-arrowhead"
                                markerWidth="6"
                                markerHeight="6"
                                refX="5"
                                refY="3"
                                orient="auto"
                                markerUnits="strokeWidth"
                              >
                                <path d="M0,0 L0,6 L6,3 Z" fill={annotationColor} />
                              </marker>
                            </defs>
                            <line
                              x1={`${drawingStartPoint.x * 100}%`}
                              y1={`${drawingStartPoint.y * 100}%`}
                              x2={`${drawingCurrentPoint.x * 100}%`}
                              y2={`${drawingCurrentPoint.y * 100}%`}
                              stroke={annotationColor}
                              strokeWidth={annotationStrokeWidth}
                              markerEnd="url(#temp-arrowhead)"
                              strokeDasharray="4 4"
                            />
                          </>
                        )}
                        {activeAnnotationTool === 'pen' && drawingPoints.length > 1 && (
                          <path
                            d={drawingPoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x * containerSize.width} ${p.y * containerSize.height}`).join(' ')}
                            fill="none"
                            stroke={annotationColor}
                            strokeWidth={annotationStrokeWidth}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                      </>
                    )}
                  </svg>
                )}

                {/* Text boxes overlay */}
                {isAnnotateMode && annotations.filter(ann => ann.type === 'text').map(ann => {
                  const isEditing = editingTextAnnId === ann.id;
                  return (
                    <div
                      key={ann.id}
                      style={{
                        position: 'absolute',
                        left: `${ann.x * 100}%`,
                        top: `${ann.y * 100}%`,
                        transform: 'translate(14px, -12px)',
                        zIndex: 20,
                        pointerEvents: 'auto'
                      }}
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={tempTextValue}
                          onChange={(e) => setTempTextValue(e.target.value)}
                          onBlur={() => {
                            const nextAnns = annotations.map(a => a.id === ann.id ? { ...a, text: tempTextValue } : a);
                            saveToHistory(nextAnns);
                            setAnnotations(nextAnns);
                            setEditingTextAnnId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          autoFocus
                          style={{
                            background: '#1e1e24',
                            border: `1.5px solid ${ann.color}`,
                            borderRadius: '4px',
                            color: '#fff',
                            padding: '2px 8px',
                            fontSize: '12px',
                            outline: 'none',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                            minWidth: '80px'
                          }}
                        />
                      ) : (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTextAnnId(ann.id);
                            setTempTextValue(ann.text || '');
                          }}
                          onMouseDown={(e) => {
                            if (activeAnnotationTool === 'select') {
                              handleAnnotationMouseDown(ann.id, e);
                            }
                          }}
                          style={{
                            background: '#1e1e24',
                            border: `1.5px solid ${ann.color}`,
                            borderRadius: '4px',
                            color: '#fff',
                            padding: '3px 8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                            userSelect: 'none'
                          }}
                        >
                          {ann.text || 'Nhấp để ghi chú...'}
                        </div>
                      )}
                    </div>
                  );
                })}

              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status Bar — crisp-text-dark-ui */}
      {activeTab && (
        <div
          className="preview-statusbar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '6px 12px',
            borderTop: '1px solid #27272a',
            background: '#0d0d0f',
            fontSize: '11.5px',
            fontWeight: 500,
            color: '#a1a1aa',
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            boxSizing: 'border-box',
            minHeight: '28px',
          }}
        >
          <span
            title={activeTab.url}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: '1 1 auto',
              maxWidth: '55%',
              color: '#d4d4d8',
              fontFamily: 'ui-monospace, Consolas, Monaco, monospace',
              fontSize: '11.5px',
              fontWeight: 500,
            }}
          >
            {activeTab.url}
          </span>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
            {webviewSize.width > 0 && webviewSize.height > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', color: '#a1a1aa', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                {webviewSize.width} × {webviewSize.height}
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#d4d4d8' }}>
              <DesktopIcon size={12} /> Fullscreen Responsive
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: iframeStatus === 'loaded' ? '#4ade80' : iframeStatus === 'loading' ? '#fbbf24' : '#f87171',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: iframeStatus === 'loaded' ? '#22c55e' : iframeStatus === 'loading' ? '#f59e0b' : '#ef4444',
                  display: 'inline-block',
                  flexShrink: 0,
                }}
              />
              {iframeStatus === 'loaded' ? 'Ready' : iframeStatus === 'loading' ? 'Loading' : 'Error'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function McpConnectionsPanel() {
  const mcpConnections = useDeckStore((state) => state.mcpConnections) || [];
  const addMcpConnection = useDeckStore((state) => state.addMcpConnection);
  const updateMcpConnection = useDeckStore((state) => state.updateMcpConnection);
  const deleteMcpConnection = useDeckStore((state) => state.deleteMcpConnection);
  const testMcpConnection = useDeckStore((state) => state.testMcpConnection);
  const loadMcpTools = useDeckStore((state) => state.loadMcpTools);

  // State to manage adding or editing
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [transport, setTransport] = useState<'auto' | 'sse' | 'stdio'>('auto');
  const [authType, setAuthType] = useState<'none' | 'oauth' | 'bearer' | 'headers'>('none');
  const [headersJson, setHeadersJson] = useState('{\n  \n}');
  const [bearerToken, setBearerToken] = useState('');
  const [figmaToolName, setFigmaToolName] = useState('');
  const [readAllowed, setReadAllowed] = useState(true);

  const [errorText, setErrorText] = useState('');
  const [expandedConn, setExpandedConn] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [transportDropdownOpen, setTransportDropdownOpen] = useState(false);
  const [authDropdownOpen, setAuthDropdownOpen] = useState(false);
  const transportDropdownRef = useRef<HTMLDivElement>(null);
  const authDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (transportDropdownRef.current && !transportDropdownRef.current.contains(event.target as Node)) {
        setTransportDropdownOpen(false);
      }
    }
    if (transportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [transportDropdownOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (authDropdownRef.current && !authDropdownRef.current.contains(event.target as Node)) {
        setAuthDropdownOpen(false);
      }
    }
    if (authDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [authDropdownOpen]);

  const handleAutoFillFigma = () => {
    setName('Figma MCP');
    setUrl('https://mcp.figma.com/mcp');
    setAuthType('oauth');
    setTransport('auto');
    setBearerToken('');
    setHeadersJson('{\n  \n}');
  };

  const handleAddClick = () => {
    setIsAdding(true);
    setEditingId(null);
    setName('');
    setUrl('');
    setTransport('auto');
    setAuthType('none');
    setHeadersJson('{\n  \n}');
    setBearerToken('');
    setFigmaToolName('');
    setReadAllowed(true);
    setErrorText('');
    setShowAdvanced(false);
    setTransportDropdownOpen(false);
    setAuthDropdownOpen(false);
  };

  const handleEditClick = (conn: McpServerConnection) => {
    setEditingId(conn.id);
    setIsAdding(false);
    setName(conn.name);
    setUrl(conn.url);
    setTransport(conn.transport || 'auto');
    setAuthType(conn.authType || 'none');
    setHeadersJson(conn.headersJson || '{\n  \n}');
    setBearerToken(conn.bearerToken || '');
    setFigmaToolName(conn.figmaToolName || '');
    setReadAllowed(conn.permissions?.readAllowed ?? true);
    setErrorText('');
    setShowAdvanced(Boolean(conn.bearerToken || conn.figmaToolName || (conn.headersJson && conn.headersJson.trim() !== '{\n  \n}')));
    setTransportDropdownOpen(false);
    setAuthDropdownOpen(false);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setErrorText('');
    setTransportDropdownOpen(false);
    setAuthDropdownOpen(false);
  };

  const handleSaveConnection = (shouldConnect = false): string | null => {
    if (!name.trim() || !url.trim()) {
      setErrorText('Name and URL are required.');
      return null;
    }

    if (authType === 'headers' && headersJson.trim()) {
      try {
        JSON.parse(headersJson);
      } catch (err) {
        setErrorText('Headers must be a valid JSON string.');
        return null;
      }
    }

    const connectionData = {
      name: name.trim(),
      url: url.trim(),
      transport,
      authType,
      headersJson: headersJson.trim(),
      bearerToken: bearerToken.trim(),
      figmaToolName: figmaToolName.trim(),
      permissions: {
        readAllowed,
        writeConfirm: true,
        unknownConfirm: true
      }
    };

    let targetId = editingId;

    if (editingId) {
      updateMcpConnection(editingId, connectionData);
      setEditingId(null);
    } else {
      const beforeIds = new Set((useDeckStore.getState().mcpConnections || []).map((c) => c.id));
      addMcpConnection(connectionData);
      const after = useDeckStore.getState().mcpConnections || [];
      const newConn = after.find((c) => !beforeIds.has(c.id));
      if (newConn) {
        targetId = newConn.id;
      }
      setIsAdding(false);
    }

    setErrorText('');

    if (shouldConnect && targetId) {
      if (authType === 'oauth') {
        handleConnectOAuth(targetId);
      } else {
        void testMcpConnection(targetId);
      }
    }

    return targetId;
  };

  const handleConnectOAuth = (id: string) => {
    const conn = (useDeckStore.getState().mcpConnections || []).find((c) => c.id === id);
    if (!conn) return;

    const ok = window.confirm(`Authorize AgentDeck to access ${conn.name} via OAuth?`);
    if (ok) {
      updateMcpConnection(id, {
        status: 'connected',
        serverStatus: 'reachable',
        authStatus: 'authenticated',
        toolStatus: 'loaded',
        errorMessage: undefined,
        lastChecked: Date.now(),
        tools: [
          {
            name: 'get_design_context',
            description: 'Retrieves coordinate details, hierarchy, styling, and annotations from Figma designs.',
            inputSchema: {
              type: 'object',
              properties: {
                fileKey: { type: 'string', description: 'The unique Figma file identifier key' },
                nodeIds: { type: 'array', items: { type: 'string' }, description: 'Specific layer node identifiers to check' }
              },
              required: ['fileKey']
            }
          },
          {
            name: 'get_file',
            description: 'Fallback tool to query a raw Figma file JSON model.',
            inputSchema: {
              type: 'object',
              properties: {
                fileKey: { type: 'string', description: 'Figma file key' },
                ids: { type: 'string', description: 'Comma-separated node IDs' }
              },
              required: ['fileKey']
            }
          }
        ]
      });
    }
  };

  const handleConnect = (conn: McpServerConnection) => {
    if (conn.authType === 'oauth') {
      handleConnectOAuth(conn.id);
    } else {
      void testMcpConnection(conn.id);
    }
  };

  const formatLastChecked = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    if (diff < 5000) return 'Just now';
    if (diff < 60000) return 'seconds ago';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleTestConnection = async () => {
    if (!name.trim() || !url.trim()) {
      setErrorText('Name and URL are required.');
      return;
    }

    const tempId = handleSaveConnection(false);
    if (tempId) {
      if (authType === 'oauth') {
        handleConnectOAuth(tempId);
      } else {
        void testMcpConnection(tempId);
      }
    }
  };

  return (
    <div className="settings-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', height: '100%', boxSizing: 'border-box', WebkitFontSmoothing: 'antialiased', color: '#e4e4e7' }}>
      {/* Description Panel */}
      <section className="panel-section" style={{
        background: '#141416',
        border: '1px solid #27272a',
        borderRadius: '8px',
        padding: '14px'
      }}>
        <h2 style={{ 
          color: '#f4f4f5', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          margin: '0 0 6px 0',
          fontSize: '14px',
          fontWeight: 600
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          MCP Connections Manager
        </h2>
        <p className="muted" style={{ fontSize: '12px', lineHeight: '1.5', margin: 0, color: '#a1a1aa', fontWeight: 500 }}>
          Configure remote or local Model Context Protocol (MCP) servers. Connected tools can be attached inside your agent workspace prompt composer dynamically.
        </p>
      </section>

      {/* Configured Connections List */}
      <section className="panel-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '11.5px', fontWeight: 700, color: '#d4d4d8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Connections ({mcpConnections.length})
          </h3>
          {!isAdding && !editingId && (
            <button
              type="button"
              onClick={handleAddClick}
              style={{
                background: '#18181b',
                border: '1px solid #27272a',
                color: '#e4e4e7',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#27272a'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#18181b'; }}
            >
              + New Connection
            </button>
          )}
        </div>

        {mcpConnections.length === 0 && !isAdding && (
          <div style={{
            padding: '24px 16px',
            textAlign: 'center',
            background: '#141416',
            border: '1px dashed rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            color: '#a1a1aa',
            fontSize: '12px',
            fontWeight: 500,
            lineHeight: 1.5,
          }}>
            No MCP connections configured yet.
            <div style={{ marginTop: '8px' }}>
              <button 
                type="button"
                onClick={() => { handleAddClick(); handleAutoFillFigma(); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7dd3fc',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                  padding: 0
                }}
              >
                Autofill Figma MCP preset
              </button>
            </div>
          </div>
        )}

        {/* Connection Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {mcpConnections.map((conn) => {
            if (editingId === conn.id) {
              return (
                <div 
                  key={conn.id} 
                  style={{
                    background: '#141416',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <h4 style={{ margin: '0 0 2px 0', fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>Edit MCP Connection</h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: 500, color: '#a1a1aa' }}>Connection Name</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Figma MCP"
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', background: '#1c1c1e', border: '1px solid #27272a', color: '#fff', fontSize: '12px', outline: 'none' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: 500, color: '#a1a1aa' }}>
                        MCP Server URL
                      </label>
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://mcp.figma.com/mcp or stdio executable command"
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', background: '#1c1c1e', border: '1px solid #27272a', color: '#fff', fontSize: '12px', outline: 'none' }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '10px', zIndex: 20 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: 500, color: '#a1a1aa' }}>Transport</label>
                        <div ref={transportDropdownRef} style={{ position: 'relative', width: '100%' }}>
                          <button
                            className={`panel-select-trigger ${transportDropdownOpen ? 'open' : ''}`}
                            onClick={() => setTransportDropdownOpen(!transportDropdownOpen)}
                            type="button"
                            style={{
                              width: '100%',
                              padding: '5px 8px',
                              background: '#1c1c1e',
                              border: '1px solid #27272a',
                              borderRadius: '4px',
                              color: '#fff',
                              fontSize: '11.5px',
                              outline: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '4px'
                            }}
                          >
                            <span className="panel-select-trigger-text" style={{ fontSize: '11.5px', textTransform: 'none' }}>
                              {transport === 'auto' ? 'Auto-detect' : transport === 'sse' ? 'Remote HTTP / SSE' : 'Local stdio'}
                            </span>
                            <ChevronDownIcon size={12} />
                          </button>

                          {transportDropdownOpen && (
                            <div className="panel-select-dropdown" style={{ left: 0, right: 0, marginTop: '2px', padding: '2px', zIndex: 100 }}>
                              <button
                                className={`panel-select-option ${transport === 'auto' ? 'active' : ''}`}
                                onClick={() => {
                                  setTransport('auto');
                                  setTransportDropdownOpen(false);
                                }}
                                type="button"
                                style={{ padding: '4px 6px', fontSize: '11px' }}
                              >
                                <span className="panel-select-option-label" style={{ fontSize: '11px', textTransform: 'none' }}>
                                  Auto-detect
                                </span>
                                {transport === 'auto' && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                              </button>
                              <button
                                className={`panel-select-option ${transport === 'sse' ? 'active' : ''}`}
                                onClick={() => {
                                  setTransport('sse');
                                  setTransportDropdownOpen(false);
                                }}
                                type="button"
                                style={{ padding: '4px 6px', fontSize: '11px' }}
                              >
                                <span className="panel-select-option-label" style={{ fontSize: '11px', textTransform: 'none' }}>
                                  Remote HTTP / SSE
                                </span>
                                {transport === 'sse' && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                              </button>
                              <button
                                className={`panel-select-option ${transport === 'stdio' ? 'active' : ''}`}
                                onClick={() => {
                                  setTransport('stdio');
                                  setTransportDropdownOpen(false);
                                }}
                                type="button"
                                style={{ padding: '4px 6px', fontSize: '11px' }}
                              >
                                <span className="panel-select-option-label" style={{ fontSize: '11px', textTransform: 'none' }}>
                                  Local stdio
                                </span>
                                {transport === 'stdio' && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: 500, color: '#a1a1aa' }}>Authentication</label>
                        <div ref={authDropdownRef} style={{ position: 'relative', width: '100%' }}>
                          <button
                            className={`panel-select-trigger ${authDropdownOpen ? 'open' : ''}`}
                            onClick={() => setAuthDropdownOpen(!authDropdownOpen)}
                            type="button"
                            style={{
                              width: '100%',
                              padding: '5px 8px',
                              background: '#1c1c1e',
                              border: '1px solid #27272a',
                              borderRadius: '4px',
                              color: '#fff',
                              fontSize: '11.5px',
                              outline: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '4px'
                            }}
                          >
                            <span className="panel-select-trigger-text" style={{ fontSize: '11.5px', textTransform: 'none' }}>
                              {authType === 'none' ? 'None' : authType === 'oauth' ? 'OAuth / Browser Login' : authType === 'bearer' ? 'Bearer Token' : 'Custom Headers'}
                            </span>
                            <ChevronDownIcon size={12} />
                          </button>

                          {authDropdownOpen && (
                            <div className="panel-select-dropdown" style={{ left: 0, right: 0, marginTop: '2px', padding: '2px', zIndex: 100 }}>
                              <button
                                className={`panel-select-option ${authType === 'none' ? 'active' : ''}`}
                                onClick={() => {
                                  setAuthType('none');
                                  setAuthDropdownOpen(false);
                                }}
                                type="button"
                                style={{ padding: '4px 6px', fontSize: '11px' }}
                              >
                                <span className="panel-select-option-label" style={{ fontSize: '11px', textTransform: 'none' }}>
                                  None
                                </span>
                                {authType === 'none' && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                              </button>
                              <button
                                className={`panel-select-option ${authType === 'oauth' ? 'active' : ''}`}
                                onClick={() => {
                                  setAuthType('oauth');
                                  setAuthDropdownOpen(false);
                                }}
                                type="button"
                                style={{ padding: '4px 6px', fontSize: '11px' }}
                              >
                                <span className="panel-select-option-label" style={{ fontSize: '11px', textTransform: 'none' }}>
                                  OAuth / Browser Login
                                </span>
                                {authType === 'oauth' && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                              </button>
                              <button
                                className={`panel-select-option ${authType === 'bearer' ? 'active' : ''}`}
                                onClick={() => {
                                  setAuthType('bearer');
                                  setAuthDropdownOpen(false);
                                }}
                                type="button"
                                style={{ padding: '4px 6px', fontSize: '11px' }}
                              >
                                <span className="panel-select-option-label" style={{ fontSize: '11px', textTransform: 'none' }}>
                                  Bearer Token
                                </span>
                                {authType === 'bearer' && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                              </button>
                              <button
                                className={`panel-select-option ${authType === 'headers' ? 'active' : ''}`}
                                onClick={() => {
                                  setAuthType('headers');
                                  setAuthDropdownOpen(false);
                                }}
                                type="button"
                                style={{ padding: '4px 6px', fontSize: '11px' }}
                              >
                                <span className="panel-select-option-label" style={{ fontSize: '11px', textTransform: 'none' }}>
                                  Custom Headers
                                </span>
                                {authType === 'headers' && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Collapsible Advanced section */}
                    <div style={{ marginTop: '4px' }}>
                      <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#38bdf8',
                          cursor: 'pointer',
                          fontSize: '11px',
                          padding: '4px 0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontWeight: 500
                        }}
                      >
                        <svg 
                          width="8" 
                          height="8" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="3"
                          style={{ 
                            transform: showAdvanced ? 'rotate(90deg)' : 'none',
                            transition: 'transform 0.15s ease'
                          }}
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                        {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
                      </button>

                      {showAdvanced && (
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          padding: '10px',
                          background: '#141416',
                          border: '1px solid rgba(255,255,255,0.04)',
                          borderRadius: '6px',
                          marginTop: '6px'
                        }}>
                          {authType === 'bearer' && (
                            <div>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', color: '#a1a1aa' }}>Bearer Token</label>
                              <input
                                type="text"
                                value={bearerToken}
                                onChange={(e) => setBearerToken(e.target.value)}
                                placeholder="Enter token string"
                                style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', background: '#1c1c1e', border: '1px solid #27272a', color: '#fff', fontSize: '11px', outline: 'none' }}
                              />
                            </div>
                          )}

                          {authType === 'headers' && (
                            <div>
                              <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', color: '#a1a1aa' }}>Custom Request Headers (JSON)</label>
                              <textarea
                                value={headersJson}
                                onChange={(e) => setHeadersJson(e.target.value)}
                                rows={4}
                                placeholder='{ "Authorization": "Bearer token" }'
                                style={{ width: '100%', padding: '6px', borderRadius: '4px', background: '#1c1c1e', border: '1px solid #27272a', color: '#fff', fontSize: '11.5px', fontFamily: 'monospace', outline: 'none' }}
                              />
                            </div>
                          )}

                          <div>
                            <label style={{ display: 'block', marginBottom: '2px', fontSize: '11.5px', color: '#a1a1aa' }}>
                              Figma Context Tool Name override
                            </label>
                            <span style={{ fontSize: '9px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>
                              (Leave blank to auto-detect a tool matching fileKey in schema)
                            </span>
                            <input
                              type="text"
                              value={figmaToolName}
                              onChange={(e) => setFigmaToolName(e.target.value)}
                              placeholder="e.g. get_design_context"
                              style={{ width: '100%', padding: '5px 8px', borderRadius: '4px', background: '#1c1c1e', border: '1px solid #27272a', color: '#fff', fontSize: '11px', outline: 'none' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {errorText && (
                    <span style={{ fontSize: '11px', color: '#f87171' }}>{errorText}</span>
                  )}

                  {/* Form buttons */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => handleSaveConnection(false)}
                      style={{
                        flex: 1,
                        minWidth: '80px',
                        background: '#18181b',
                        border: '1px solid #27272a',
                        color: '#e4e4e7',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Save
                    </button>

                    <button
                      type="button"
                      onClick={handleTestConnection}
                      style={{
                        flex: 1,
                        minWidth: '110px',
                        background: '#18181b',
                        border: '1px solid #27272a',
                        color: '#e4e4e7',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Test Connection
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveConnection(true)}
                      style={{
                        flex: 1.2,
                        minWidth: '115px',
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                        color: '#38bdf8',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Save & Connect
                    </button>

                    <button
                      type="button"
                      onClick={handleCancel}
                      style={{
                        flex: 1,
                        minWidth: '80px',
                        background: '#141416',
                        border: '1px solid #27272a',
                        color: '#a1a1aa',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              );
            }

            const isTesting = conn.status === 'testing';
            const isFailed = conn.serverStatus === 'failed' || conn.status === 'error';
            const isAuthRequired = (conn.serverStatus === 'reachable' && conn.authStatus === 'required') || conn.status === 'auth_required';
            const isConnected = (conn.serverStatus === 'reachable' && conn.authStatus === 'authenticated') || conn.status === 'connected';

            let statusText = 'Not connected';
            let statusColor = '#a1a1aa';
            let bgBadge = '#18181b';
            let badgeBorder = '#3f3f46';

            if (isTesting) {
              statusText = 'Testing...';
              statusColor = '#7dd3fc';
              bgBadge = '#0f1f2a';
              badgeBorder = '#1e4a5f';
            } else if (isFailed) {
              statusText = 'Failed';
              statusColor = '#f87171';
              bgBadge = '#2a1414';
              badgeBorder = '#7f1d1d';
            } else if (isAuthRequired) {
              statusText = 'Auth required';
              statusColor = '#fcd34d';
              bgBadge = '#1c1408';
              badgeBorder = '#854d0e';
            } else if (isConnected) {
              statusText = 'Connected';
              statusColor = '#4ade80';
              bgBadge = '#0f1f1a';
              badgeBorder = '#166534';
            }

            return (
              <div 
                key={conn.id} 
                style={{
                  background: '#141416',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ overflow: 'hidden', marginRight: '8px', minWidth: 0 }}>
                    <h4 style={{ margin: '0 0 3px 0', fontSize: '13px', fontWeight: 600, color: '#f4f4f5' }}>{conn.name}</h4>
                    <div style={{ fontSize: '12px', color: '#a1a1aa', fontFamily: 'ui-monospace, Consolas, Monaco, monospace', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conn.url}
                    </div>
                    {isAuthRequired && (
                      <div style={{ fontSize: '12px', color: '#fcd34d', marginTop: '4px', fontWeight: 500 }}>
                        Server reachable, authentication not completed
                      </div>
                    )}
                  </div>

                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: statusColor,
                    background: bgBadge,
                    border: `1px solid ${badgeBorder}`,
                    flexShrink: 0,
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
                    {statusText}
                  </div>
                </div>

                {/* Sub-details (Transport, Auth Type, Tool Count, Last Checked) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '12px', color: '#a1a1aa', fontWeight: 500 }}>
                  <span>Transport: <strong style={{ color: '#d4d4d8', fontWeight: 600 }}>{conn.transport === 'sse' ? 'Remote SSE' : conn.transport === 'stdio' ? 'Stdio' : 'Auto-detect'}</strong></span>
                  <span style={{ color: '#52525b' }}>•</span>
                  <span>Auth: <strong style={{ color: '#d4d4d8', fontWeight: 600 }}>{conn.authType === 'oauth' ? 'OAuth' : conn.authType === 'bearer' ? 'Bearer' : conn.authType === 'headers' ? 'Custom Headers' : 'None'}</strong></span>
                  <span style={{ color: '#52525b' }}>•</span>
                  <span>Tools: <strong style={{ color: '#d4d4d8', fontWeight: 600 }}>{conn.tools?.length || 0}</strong></span>
                  <span style={{ color: '#52525b' }}>•</span>
                  <span>Last Checked: <strong style={{ color: '#d4d4d8', fontWeight: 600 }}>{formatLastChecked(conn.lastChecked)}</strong></span>
                </div>

                {conn.errorMessage && (
                  <div style={{
                    padding: '6px 8px',
                    borderRadius: '4px',
                    background: 'rgba(239, 68, 68, 0.03)',
                    border: '1px solid rgba(239, 68, 68, 0.1)',
                    color: '#f87171',
                    fontSize: '11.5px',
                    lineHeight: '1.3'
                  }}>
                    {conn.errorMessage}
                  </div>
                )}

                {/* Permissions Sub-section */}
                <div style={{
                  borderTop: '1px solid #27272a',
                  paddingTop: '6px',
                  marginTop: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#d4d4d8', marginBottom: '4px' }}>Permissions Policy</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#d4d4d8', cursor: 'pointer', fontWeight: 500 }}>
                    <input 
                      type="checkbox"
                      checked={conn.permissions?.readAllowed ?? true}
                      onChange={(e) => {
                        updateMcpConnection(conn.id, {
                          permissions: {
                            ...(conn.permissions || { readAllowed: true, writeConfirm: true, unknownConfirm: true }),
                            readAllowed: e.target.checked
                          }
                        });
                      }}
                      style={{ accentColor: '#38bdf8', width: '13px', height: '13px', margin: 0 }}
                    />
                    <span>Read tools are allowed directly</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#a1a1aa', fontWeight: 500 }}>
                    <input type="checkbox" checked disabled style={{ width: '13px', height: '13px', margin: 0 }} />
                    <span>Write tools require user confirmation</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#a1a1aa', fontWeight: 500 }}>
                    <input type="checkbox" checked disabled style={{ width: '13px', height: '13px', margin: 0 }} />
                    <span>Unknown tools require user confirmation</span>
                  </label>
                </div>

                {/* Connection Card Actions */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px', borderTop: '1px solid #27272a', paddingTop: '10px' }}>
                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={() => handleConnect(conn)}
                    style={{
                      flex: 1,
                      minWidth: '70px',
                      background: '#18181b',
                      border: '1px solid #27272a',
                      color: '#e4e4e7',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Connect
                  </button>

                  <button
                    type="button"
                    disabled={isTesting}
                    onClick={() => testMcpConnection(conn.id)}
                    style={{
                      flex: 1,
                      minWidth: '70px',
                      background: '#18181b',
                      border: '1px solid #27272a',
                      color: '#e4e4e7',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    {isTesting ? 'Testing...' : 'Test'}
                  </button>

                  {(conn.name === 'Figma MCP' || conn.url.includes('figma')) && (
                    <button
                      type="button"
                      onClick={() => useDeckStore.getState().setShowFigmaImportModal(true)}
                      style={{
                        flex: 1,
                        minWidth: '75px',
                        background: '#0f1f2a',
                        border: '1px solid #1e4a5f',
                        color: '#7dd3fc',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Import Figma
                    </button>
                  )}

                  {conn.tools && conn.tools.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedConn(expandedConn === conn.id ? null : conn.id)}
                      style={{
                        flex: 1,
                        minWidth: '85px',
                        background: '#18181b',
                        border: '1px solid #27272a',
                        color: '#e4e4e7',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer'
                      }}
                    >
                      {expandedConn === conn.id ? 'Hide Tools' : `List Tools (${conn.tools.length})`}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleEditClick(conn)}
                    style={{
                      flex: 1,
                      minWidth: '50px',
                      background: '#18181b',
                      border: '1px solid #27272a',
                      color: '#d4d4d8',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const c = window.confirm(`Delete connection "${conn.name}"?`);
                      if (c) deleteMcpConnection(conn.id);
                    }}
                    style={{
                      flex: 1,
                      minWidth: '55px',
                      background: '#2a1414',
                      border: '1px solid #7f1d1d',
                      color: '#f87171',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </div>

                {/* Nested collapsable list of tools */}
                {expandedConn === conn.id && conn.tools && conn.tools.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    padding: '10px',
                    background: '#0d0d0f',
                    border: '1px solid #27272a',
                    borderRadius: '6px',
                    marginTop: '6px',
                    maxHeight: '220px',
                    overflowY: 'auto'
                  }}>
                    {conn.tools.map((t: any) => (
                      <div key={t.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#e4e4e7', fontFamily: 'monospace' }}>{t.name}</div>
                        {t.description && <div style={{ fontSize: '11.5px', color: '#a1a1aa', marginTop: '2px' }}>{t.description}</div>}
                        {t.inputSchema && (
                          <details style={{ fontSize: '9px', color: '#52525b', marginTop: '4px' }}>
                            <summary style={{ cursor: 'pointer', outline: 'none' }}>Parameters Schema</summary>
                            <pre style={{
                              margin: '4px 0 0 0',
                              padding: '6px',
                              background: '#040405',
                              color: '#a1a1aa',
                              borderRadius: '3px',
                              overflowX: 'auto',
                              fontSize: '9px',
                              lineHeight: '1.2'
                            }}>{JSON.stringify(t.inputSchema, null, 2)}</pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Connection Add Form (only for new connection) — crisp-text-dark-ui */}
      {isAdding && (
        <section className="panel-section" style={{
          background: '#141416',
          border: '1px solid #27272a',
          borderRadius: '8px',
          padding: '14px',
          marginTop: '12px',
          WebkitFontSmoothing: 'antialiased',
        }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '12px', fontWeight: 700, color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {editingId ? 'Edit MCP Connection' : 'New MCP Server Connection'}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Connection Name</label>
                {!editingId && (
                  <button 
                    type="button" 
                    onClick={handleAutoFillFigma}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#7dd3fc',
                      fontSize: '12px',
                      fontWeight: 500,
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Autofill Figma MCP preset
                  </button>
                )}
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Figma MCP"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: '#0d0d0f', border: '1px solid #27272a', color: '#f4f4f5', fontSize: '13px', fontWeight: 500, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '11.5px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                MCP Server URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://mcp.figma.com/mcp or stdio executable command"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: '#0d0d0f', border: '1px solid #27272a', color: '#f4f4f5', fontSize: '13px', fontWeight: 500, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', zIndex: 20 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '11.5px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Transport</label>
                <div ref={transportDropdownRef} style={{ position: 'relative', width: '100%' }}>
                  <button
                    className={`panel-select-trigger ${transportDropdownOpen ? 'open' : ''}`}
                    onClick={() => setTransportDropdownOpen(!transportDropdownOpen)}
                    type="button"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: '#0d0d0f',
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      color: '#f4f4f5',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      outline: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '4px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span className="panel-select-trigger-text" style={{ fontSize: '12.5px', textTransform: 'none' }}>
                      {transport === 'auto' ? 'Auto-detect' : transport === 'sse' ? 'Remote HTTP / SSE' : 'Local stdio'}
                    </span>
                    <ChevronDownIcon size={12} />
                  </button>

                  {transportDropdownOpen && (
                    <div className="panel-select-dropdown" style={{ left: 0, right: 0, marginTop: '4px', padding: '4px', zIndex: 100, background: '#1a1a1c', border: '1px solid #3f3f46', borderRadius: '8px' }}>
                      {[
                        { v: 'auto' as const, l: 'Auto-detect' },
                        { v: 'sse' as const, l: 'Remote HTTP / SSE' },
                        { v: 'stdio' as const, l: 'Local stdio' },
                      ].map((opt) => (
                        <button
                          key={opt.v}
                          className={`panel-select-option ${transport === opt.v ? 'active' : ''}`}
                          onClick={() => {
                            setTransport(opt.v);
                            setTransportDropdownOpen(false);
                          }}
                          type="button"
                          style={{ padding: '7px 10px', fontSize: '12.5px', color: transport === opt.v ? '#7dd3fc' : '#e4e4e7', fontWeight: 500 }}
                        >
                          <span className="panel-select-option-label" style={{ fontSize: '12.5px', textTransform: 'none' }}>
                            {opt.l}
                          </span>
                          {transport === opt.v && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '11.5px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Authentication</label>
                <div ref={authDropdownRef} style={{ position: 'relative', width: '100%' }}>
                  <button
                    className={`panel-select-trigger ${authDropdownOpen ? 'open' : ''}`}
                    onClick={() => setAuthDropdownOpen(!authDropdownOpen)}
                    type="button"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      background: '#0d0d0f',
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      color: '#f4f4f5',
                      fontSize: '12.5px',
                      fontWeight: 500,
                      outline: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '4px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span className="panel-select-trigger-text" style={{ fontSize: '12.5px', textTransform: 'none' }}>
                      {authType === 'none' ? 'None' : authType === 'oauth' ? 'OAuth / Browser Login' : authType === 'bearer' ? 'Bearer Token' : 'Custom Headers'}
                    </span>
                    <ChevronDownIcon size={12} />
                  </button>

                  {authDropdownOpen && (
                    <div className="panel-select-dropdown" style={{ left: 0, right: 0, marginTop: '4px', padding: '4px', zIndex: 100, background: '#1a1a1c', border: '1px solid #3f3f46', borderRadius: '8px' }}>
                      {[
                        { v: 'none' as const, l: 'None' },
                        { v: 'oauth' as const, l: 'OAuth / Browser Login' },
                        { v: 'bearer' as const, l: 'Bearer Token' },
                        { v: 'headers' as const, l: 'Custom Headers' },
                      ].map((opt) => (
                        <button
                          key={opt.v}
                          className={`panel-select-option ${authType === opt.v ? 'active' : ''}`}
                          onClick={() => {
                            setAuthType(opt.v);
                            setAuthDropdownOpen(false);
                          }}
                          type="button"
                          style={{ padding: '7px 10px', fontSize: '12.5px', color: authType === opt.v ? '#7dd3fc' : '#e4e4e7', fontWeight: 500 }}
                        >
                          <span className="panel-select-option-label" style={{ fontSize: '12.5px', textTransform: 'none' }}>
                            {opt.l}
                          </span>
                          {authType === opt.v && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Collapsible Advanced section */}
            <div style={{ marginTop: '2px' }}>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#7dd3fc',
                  cursor: 'pointer',
                  fontSize: '12px',
                  padding: '4px 0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontWeight: 600,
                }}
              >
                <svg 
                  width="9" 
                  height="9" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="3"
                  style={{ 
                    transform: showAdvanced ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                {showAdvanced ? 'Hide Advanced Settings' : 'Show Advanced Settings'}
              </button>

              {showAdvanced && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '12px',
                  background: '#0d0d0f',
                  border: '1px solid #27272a',
                  borderRadius: '8px',
                  marginTop: '8px'
                }}>
                  {authType === 'bearer' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11.5px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bearer Token</label>
                      <input
                        type="text"
                        value={bearerToken}
                        onChange={(e) => setBearerToken(e.target.value)}
                        placeholder="Enter token string"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: '#18181b', border: '1px solid #27272a', color: '#f4f4f5', fontSize: '12.5px', fontWeight: 500, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}

                  {authType === 'headers' && (
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '11.5px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Custom Request Headers (JSON)</label>
                      <textarea
                        value={headersJson}
                        onChange={(e) => setHeadersJson(e.target.value)}
                        rows={4}
                        placeholder='{ "Authorization": "Bearer token" }'
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: '#18181b', border: '1px solid #27272a', color: '#f4f4f5', fontSize: '12.5px', fontFamily: 'ui-monospace, Consolas, Monaco, monospace', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '11.5px', fontWeight: 600, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Figma Context Tool Name override
                    </label>
                    <span style={{ fontSize: '12px', color: '#a1a1aa', display: 'block', marginBottom: '6px', lineHeight: 1.4, fontWeight: 500 }}>
                      Leave blank to auto-detect a tool matching fileKey in schema
                    </span>
                    <input
                      type="text"
                      value={figmaToolName}
                      onChange={(e) => setFigmaToolName(e.target.value)}
                      placeholder="e.g. get_design_context"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', background: '#18181b', border: '1px solid #27272a', color: '#f4f4f5', fontSize: '12.5px', fontWeight: 500, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {errorText && (
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#f87171', lineHeight: 1.4 }}>{errorText}</span>
            )}

            {/* Form buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px', borderTop: '1px solid #27272a', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => handleSaveConnection(false)}
                style={{
                  flex: 1,
                  minWidth: '80px',
                  background: '#18181b',
                  border: '1px solid #27272a',
                  color: '#e4e4e7',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Save
              </button>

              <button
                type="button"
                onClick={handleTestConnection}
                style={{
                  flex: 1,
                  minWidth: '110px',
                  background: '#18181b',
                  border: '1px solid #27272a',
                  color: '#e4e4e7',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Test Connection
              </button>

              <button
                type="button"
                onClick={() => handleSaveConnection(true)}
                style={{
                  flex: 1.2,
                  minWidth: '115px',
                  background: '#0f1f2a',
                  border: '1px solid #1e4a5f',
                  color: '#7dd3fc',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Save & Connect
              </button>

              <button
                type="button"
                onClick={handleCancel}
                style={{
                  flex: 1,
                  minWidth: '80px',
                  background: '#18181b',
                  border: '1px solid #27272a',
                  color: '#d4d4d8',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}


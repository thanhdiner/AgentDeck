import { useEffect, useState, useMemo, useRef, useCallback, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { PaneLayout, Workspace, RunConfig } from '../../shared/types';
import { useDeckStore } from '../store/deckStore';
import { PaneToolbar } from './PaneToolbar';
import { TerminalPane } from './TerminalPane';

const PlayIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const StopIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2">
    <rect x="4" y="4" width="16" height="16" rx="2" />
  </svg>
);

const LayoutGridIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const SparkleIcon = ({ size = 11 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 1L6.5 5.5A1 1 0 0 1 5.8 6.2L1 8l4.8 1.8a1 1 0 0 1 .7.7L8 15l1.5-4.5a1 1 0 0 1 .7-.7L15 8l-4.8-1.8a1 1 0 0 1-.7-.7Z" />
    <path d="M13 2c0 .6-.4 1-1 1 .6 0 1 .4 1 1 0-.6.4-1 1-1-.6 0-1-.4-1-1z" fill="currentColor" stroke="none" />
    <path d="M3.5 10.5c0 .6-.4 1-1 1 .6 0 1 .4 1 1 0-.6.4-1 1-1-.6 0-1-.4-1-1z" fill="currentColor" stroke="none" />
  </svg>
);

const RestartIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
  </svg>
);

const CloseIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const PlusIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const MoreIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

const SettingsIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const LogsIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const ComposerIcon = ({ size = 11 }: { size?: number }) => (
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
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="m7 9 3 3-3 3" />
    <path d="M13 15h4" />
  </svg>
);

const RUN_CONFIG_TYPE_OPTIONS: { value: RunConfig['type']; label: string }[] = [
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'fullstack', label: 'Full Stack' },
  { value: 'custom', label: 'Custom' }
];

const PANE_DRAG_MIME = 'application/x-agentdeck-pane';
const PANE_DRAG_END_EVENT = 'agentdeck:pane-drag-end';
let activeDraggedPaneId: string | null = null;

/** Custom type dropdown — replaces native OS select (custom-dropdown-ui). */
function RunConfigTypeSelect({
  value,
  onChange
}: {
  value: RunConfig['type'];
  onChange: (value: RunConfig['type']) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(() =>
    Math.max(0, RUN_CONFIG_TYPE_OPTIONS.findIndex((o) => o.value === value))
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

  const selected = RUN_CONFIG_TYPE_OPTIONS.find((o) => o.value === value) ?? RUN_CONFIG_TYPE_OPTIONS[0];

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      setOpen(false);
      return;
    }
    const gap = 4;
    const preferredMax = 220;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;
    setMenuPos({
      top: openUp ? rect.top - gap : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(96, Math.min(preferredMax, available)),
      openUp
    });
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const selectValue = useCallback(
    (next: RunConfig['type']) => {
      onChange(next);
      setOpen(false);
    },
    [onChange]
  );

  useEffect(() => {
    if (!open) return;
    const idx = RUN_CONFIG_TYPE_OPTIONS.findIndex((o) => o.value === value);
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
  }, [open, value, updatePosition]);

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
        setHighlight((h) => Math.min(RUN_CONFIG_TYPE_OPTIONS.length - 1, h + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const opt = RUN_CONFIG_TYPE_OPTIONS[highlight];
        if (opt) selectValue(opt.value);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, highlight, close, selectValue]);

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            className="run-config-type-menu"
            role="listbox"
            aria-label="Config type"
            style={{
              position: 'fixed',
              top: menuPos.openUp ? undefined : menuPos.top,
              bottom: menuPos.openUp ? window.innerHeight - menuPos.top : undefined,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: menuPos.maxHeight,
              zIndex: 11000
            }}
          >
            {RUN_CONFIG_TYPE_OPTIONS.map((opt, index) => {
              const isActive = opt.value === value;
              const isHighlighted = index === highlight;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`run-config-type-option${isActive ? ' is-active' : ''}${isHighlighted ? ' is-highlighted' : ''}`}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectValue(opt.value);
                  }}
                >
                  <span>{opt.label}</span>
                  {isActive ? <span className="run-config-type-check" aria-hidden>✓</span> : null}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={`run-config-type-select${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="run-config-type-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="run-config-type-value">{selected.label}</span>
        <svg
          className={`run-config-type-chevron${open ? ' is-open' : ''}`}
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
      </button>
      {menu}
    </div>
  );
}

/** Inline double-click delete for run config list (inline-confirm-delete-ux). */
function RunConfigListDelete({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!confirming) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setConfirming(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirming(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [confirming]);

  return (
    <div
      ref={rootRef}
      className={`run-config-item-actions${confirming ? ' is-confirming' : ''}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="run-config-delete-cancel"
        title="Cancel remove"
        tabIndex={confirming ? 0 : -1}
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(false);
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <button
        type="button"
        className="run-config-delete-btn"
        title={confirming ? 'Click again to confirm remove' : 'Remove config'}
        onClick={(e) => {
          e.stopPropagation();
          if (confirming) {
            onConfirm();
            setConfirming(false);
          } else {
            setConfirming(true);
          }
        }}
      >
        <svg
          className="run-config-delete-idle-icon"
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
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
        <svg
          className="run-config-delete-confirm-icon"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
  );
}

/** Crisp list/task glyph for pane linked-tasks badge (avoid 10px + thin stroke smear) */
const TaskIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    shapeRendering="geometricPrecision"
    aria-hidden
    style={{ display: 'block', flexShrink: 0 }}
  >
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <path d="M9 12h6M9 16h6" />
  </svg>
);

const GitBranchIcon = () => (
  <svg
    width="11"
    height="11"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
    aria-hidden
  >
    <path d="M5 3v10M5 8c2.5 0 3.5.5 3.5 2.5v1" />
    <circle cx="5" cy="3" r="1.5" fill="currentColor" />
    <circle cx="5" cy="13" r="1.5" fill="currentColor" />
    <circle cx="8.5" cy="12.5" r="1.5" fill="currentColor" />
  </svg>
);

/** Middle-ellipsis for Windows paths — keep drive + last folder(s) readable */
function formatWorkspacePath(path: string, compact: boolean): string {
  if (!path) return '';
  const max = compact ? 28 : 48;
  if (path.length <= max) return path;

  const normalized = path.replace(/\//g, '\\');
  const parts = normalized.split('\\').filter(Boolean);
  if (parts.length <= 2) {
    return `${path.slice(0, Math.max(8, max - 3))}…`;
  }

  // e.g. F:\ + first dir + … + last 1–2 segments
  const drive = /^[A-Za-z]:$/.test(parts[0]) ? `${parts[0]}\\` : `${parts[0]}\\`;
  const tailCount = compact ? 1 : 2;
  const tail = parts.slice(-tailCount).join('\\');
  const head = parts.length > tailCount + 1 ? parts[1] : '';
  const candidate = head
    ? `${drive}${head}\\…\\${tail}`
    : `${drive}…\\${tail}`;

  if (candidate.length <= max + 8) return candidate;
  return `${drive}…\\${parts[parts.length - 1]}`;
}

function ActiveWorkspaceBranch({ workspacePath }: { workspacePath: string }) {
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      try {
        const status = await window.agentDeck.getGitWorkspaceStatus(workspacePath);
        if (active) {
          setBranch(status.branch || null);
        }
      } catch {
        if (active) {
          setBranch(null);
        }
      }
    };

    void fetchStatus();

    const handleRefresh = () => {
      void fetchStatus();
    };

    const unsubscribe = window.agentDeck.onTerminalExit(handleRefresh);

    return () => {
      active = false;
      unsubscribe();
    };
  }, [workspacePath]);

  if (!branch) {
    return null;
  }

  return (
    <span className="workspace-branch" title={`Current git branch: ${branch}`}>
      <GitBranchIcon />
      <span className="workspace-branch-name">{branch}</span>
    </span>
  );
}

export function TerminalGrid() {
  const workspaces = useDeckStore((state) => state.workspaces);
  const tasks = useDeckStore((state) => state.tasks);
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const activePaneId = useDeckStore((state) => state.activePaneId);
  const createWorkspace = useDeckStore((state) => state.createWorkspace);
  const createPane = useDeckStore((state) => state.createPane);
  const setGridLayout = useDeckStore((state) => state.setGridLayout);
  const setRightTab = useDeckStore((state) => state.setRightTab);
  const agentProfiles = useDeckStore((state) => state.agentProfiles);
  const runAgentInAllPanes = useDeckStore((state) => state.runAgentInAllPanes);
  const stopAllPanes = useDeckStore((state) => state.stopAllPanes);
  const closeAllPanes = useDeckStore((state) => state.closeAllPanes);

  // Project Run System Hooks
  const runProject = useDeckStore((state) => state.runProject);
  const stopProject = useDeckStore((state) => state.stopProject);
  const configureProjectRunConfigs = useDeckStore((state) => state.configureProjectRunConfigs);
  const projectRunStates = useDeckStore((state) => state.projectRunStates);
  const projectLogs = useDeckStore((state) => state.projectLogs);
  const loadProjectStatus = useDeckStore((state) => state.loadProjectStatus);
  const loadProjectLogs = useDeckStore((state) => state.loadProjectLogs);
  const showRunConfigModalWorkspaceId = useDeckStore((state) => state.showRunConfigModalWorkspaceId);
  const setShowRunConfigModalWorkspaceId = useDeckStore((state) => state.setShowRunConfigModalWorkspaceId);
  const showRunLogsModalWorkspaceId = useDeckStore((state) => state.showRunLogsModalWorkspaceId);
  const setShowRunLogsModalWorkspaceId = useDeckStore((state) => state.setShowRunLogsModalWorkspaceId);

  // Modal States
  const showConfigModal = showRunConfigModalWorkspaceId === activeWorkspaceId;
  const setShowConfigModal = (show: boolean) => {
    setShowRunConfigModalWorkspaceId(show ? activeWorkspaceId : null);
  };
  const showLogsModal = showRunLogsModalWorkspaceId === activeWorkspaceId;
  const setShowLogsModal = (show: boolean) => {
    setShowRunLogsModalWorkspaceId(show ? activeWorkspaceId : null);
  };
  const overlayMouseDownRef = useRef<EventTarget | null>(null);
  const [showDropdownWorkspaceId, setShowDropdownWorkspaceId] = useState<string | null>(null);

  // Grid layout states
  const [showLayoutDropdown, setShowLayoutDropdown] = useState(false);
  const [hoveredCols, setHoveredCols] = useState(0);
  const [hoveredRows, setHoveredRows] = useState(0);
  const layoutDropdownRef = useRef<HTMLDivElement | null>(null);
  const layoutButtonRef = useRef<HTMLButtonElement | null>(null);

  // Agent dropdown states
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const agentDropdownRef = useRef<HTMLDivElement | null>(null);
  const agentButtonRef = useRef<HTMLButtonElement | null>(null);

  // Compact mode state and ResizeObserver Ref
  const [topbarWidth, setTopbarWidth] = useState(1000);
  const topbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = topbarRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTopbarWidth(entry.contentRect.width);
      }
    });
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [activeWorkspaceId]);

  const isCompact = topbarWidth < 900;

  // More actions dropdown states
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [moreMenuPos, setMoreMenuPos] = useState<{ top: number; right: number } | null>(null);
  const moreDropdownRef = useRef<HTMLDivElement | null>(null);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const nestedLayoutButtonRef = useRef<HTMLButtonElement | null>(null);
  const nestedAgentButtonRef = useRef<HTMLButtonElement | null>(null);

  // Position more menu in viewport (portal) so parent overflow cannot clip it
  useEffect(() => {
    if (!showMoreDropdown || !moreButtonRef.current) {
      setMoreMenuPos(null);
      return;
    }
    const updatePos = () => {
      const rect = moreButtonRef.current!.getBoundingClientRect();
      setMoreMenuPos({
        top: rect.bottom + 6,
        right: Math.max(8, window.innerWidth - rect.right)
      });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showMoreDropdown]);

  // Close more dropdown when clicking outside
  useEffect(() => {
    if (!showMoreDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      
      const clickedInsideNested = (layoutDropdownRef.current && layoutDropdownRef.current.contains(target)) ||
                                  (agentDropdownRef.current && agentDropdownRef.current.contains(target));
                                  
      if (
        moreDropdownRef.current &&
        !moreDropdownRef.current.contains(target) &&
        moreButtonRef.current &&
        !moreButtonRef.current.contains(target) &&
        !clickedInsideNested
      ) {
        setShowMoreDropdown(false);
        setShowLayoutDropdown(false);
        setShowAgentDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreDropdown]);

  // Close agent dropdown when clicking outside
  useEffect(() => {
    if (!showAgentDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        agentDropdownRef.current &&
        !agentDropdownRef.current.contains(target) &&
        ((agentButtonRef.current && !agentButtonRef.current.contains(target)) ||
         (nestedAgentButtonRef.current && !nestedAgentButtonRef.current.contains(target)))
      ) {
        setShowAgentDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAgentDropdown]);

  // Close layout dropdown when clicking outside
  useEffect(() => {
    if (!showLayoutDropdown) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        layoutDropdownRef.current &&
        !layoutDropdownRef.current.contains(target) &&
        ((layoutButtonRef.current && !layoutButtonRef.current.contains(target)) ||
         (nestedLayoutButtonRef.current && !nestedLayoutButtonRef.current.contains(target)))
      ) {
        setShowLayoutDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLayoutDropdown]);

  // Editing config states
  const [editingConfigId, setEditingConfigId] = useState<string | null>(null);
  const [configList, setConfigList] = useState<RunConfig[]>([]);
  const [defaultConfigId, setDefaultConfigId] = useState<string | undefined>(undefined);

  // Active workspace object
  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId) || null;
  }, [workspaces, activeWorkspaceId]);

  // Load status and logs
  useEffect(() => {
    if (activeWorkspaceId) {
      void loadProjectStatus(activeWorkspaceId);
      void loadProjectLogs(activeWorkspaceId);
    }
  }, [activeWorkspaceId]);

  // Sync modal states with active workspace runConfigs
  useEffect(() => {
    if (activeWorkspace) {
      setConfigList(activeWorkspace.runConfigs || []);
      setDefaultConfigId(activeWorkspace.defaultConfigId);
      if (activeWorkspace.runConfigs && activeWorkspace.runConfigs.length > 0) {
        setEditingConfigId(activeWorkspace.runConfigs[0].id);
      } else {
        setEditingConfigId(null);
      }
    }
  }, [activeWorkspace, showConfigModal]);

  const activeConfig = useMemo(() => {
    if (!activeWorkspace) return null;
    const projectState = projectRunStates[activeWorkspace.id];
    if (!projectState || !projectState.activeConfigId) return null;
    return activeWorkspace.runConfigs?.find((c) => c.id === projectState.activeConfigId) || null;
  }, [activeWorkspace, projectRunStates]);

  if (workspaces.length === 0) {
    return (
      <section className="terminal-grid empty-state">
        <div className="first-launch-card">
          <div className="eyebrow">First launch</div>
          <h2>Start with a local project folder</h2>
          <p>Local cockpit for workspaces, terminals, tasks, logs, and reviews.</p>
          <div className="onboarding-actions">
            <button onClick={() => void createWorkspace()}>Open project folder</button>
            <button onClick={() => setRightTab('settings')}>View MVP shortcuts</button>
          </div>
          <ol className="flow-list">
            <li>Open a local folder as workspace</li>
            <li>Split panes for frontend, backend, Git, or agents</li>
            <li>Assign tasks, review logs, then checkpoint &amp; export</li>
          </ol>
        </div>
      </section>
    );
  }

  const handleRunClick = (ws: Workspace) => {
    if (!ws.runConfigs || ws.runConfigs.length === 0) {
      setShowConfigModal(true);
      return;
    }

    // Always run the default (or first) config from the primary Run button.
    // Multi-config selection is handled by the chevron dropdown only.
    const cfgId = ws.defaultConfigId || ws.runConfigs[0].id;
    setShowDropdownWorkspaceId(null);
    void runProject(ws.id, cfgId);
  };

  const currentEditingConfig = configList.find((c) => c.id === editingConfigId) || null;

  const handleSaveConfigs = () => {
    if (activeWorkspaceId) {
      configureProjectRunConfigs(activeWorkspaceId, configList, defaultConfigId);
      setShowConfigModal(false);
    }
  };

  const handleAddConfig = () => {
    const newId = `config-${crypto.randomUUID()}`;
    const newConfig: RunConfig = {
      id: newId,
      name: `New Command ${configList.length + 1}`,
      type: 'frontend',
      workingDirectory: activeWorkspace?.rootPath || '',
      command: 'npm run dev',
      previewUrl: 'http://localhost:3000',
      autoOpenPreview: true
    };
    setConfigList([...configList, newConfig]);
    setEditingConfigId(newId);
    if (!defaultConfigId) {
      setDefaultConfigId(newId);
    }
  };

  const handleDeleteConfig = (idToDelete: string) => {
    const filtered = configList.filter((c) => c.id !== idToDelete);
    setConfigList(filtered);
    if (defaultConfigId === idToDelete) {
      setDefaultConfigId(filtered[0]?.id);
    }
    if (editingConfigId === idToDelete) {
      setEditingConfigId(filtered[0]?.id || null);
    }
  };

  const handleUpdateConfigField = (field: keyof RunConfig, value: any) => {
    if (!editingConfigId) return;
    setConfigList(configList.map((c) => {
      if (c.id === editingConfigId) {
        return { ...c, [field]: value };
      }
      return c;
    }));
  };

  return (
    <section className="terminal-grid" style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {workspaces.map((ws) => {
        const isActive = ws.id === activeWorkspaceId;
        const activeColor = ws.color || '#38bdf8';
        const paneCount = Object.keys(ws.panes).length;
        const openTaskCount = tasks.filter((task) => task.status !== 'done').length;

        const projectState = projectRunStates[ws.id] || { status: 'stopped', activeConfigId: null, errors: [] };
        const activeConfigForWs = ws.runConfigs?.find((c) => c.id === projectState.activeConfigId) || null;
        const multiRunConfig = Boolean(ws.runConfigs && ws.runConfigs.length > 1);

        return (
          <div key={ws.id} className={`workspace-container ${isActive ? 'active' : 'hidden'}`} style={{ display: isActive ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
            <div ref={isActive ? topbarRef : null} className="workspace-topbar">
              <div className="workspace-info">
                <strong className="workspace-name" style={{ color: activeColor }}>
                  {ws.name}
                </strong>
                {isActive && <ActiveWorkspaceBranch workspacePath={ws.path} />}
                <span className="workspace-path" title={ws.path}>
                  {formatWorkspacePath(ws.path, isCompact)}
                </span>
              </div>

              {/* Right cluster: run controls + meta — never shrink under the Run button */}
              <div className="workspace-topbar-actions">
              {/* Workspace Project Run System Header group */}
              <div className="workspace-run-group">
                {/* Status indicator badge (only when active or failed) */}
                {projectState.status !== 'stopped' && (
                  <div
                    className={`workspace-status-badge is-${projectState.status}`}
                    title={projectState.status}
                  >
                    <span className="status-dot" aria-hidden />
                    <span>
                      {projectState.status === 'running'
                        ? 'Running'
                        : projectState.status === 'starting'
                          ? 'Starting'
                          : projectState.status === 'stopping'
                            ? 'Stopping'
                            : projectState.status === 'failed'
                              ? 'Failed'
                              : projectState.status}
                    </span>
                    {activeConfigForWs && (
                      <span className="status-config-name" title={activeConfigForWs.name}>
                        {activeConfigForWs.name}
                      </span>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {/* Unified Project Run Button & Dropdown */}
                  <div className="workspace-run-btn-wrap" style={{ display: 'inline-flex', alignItems: 'stretch', position: 'relative', flexShrink: 0 }}>
                    {projectState.status === 'stopped' || projectState.status === 'failed' ? (
                      <button
                        type="button"
                        className="workspace-run-btn"
                        onClick={() => handleRunClick(ws)}
                      >
                        <PlayIcon size={10} /> Run
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="workspace-run-btn is-stop"
                        onClick={() => void stopProject(ws.id)}
                        disabled={projectState.status === 'stopping'}
                        style={{
                          cursor: projectState.status === 'stopping' ? 'not-allowed' : 'pointer',
                          opacity: projectState.status === 'stopping' ? 0.5 : 1
                        }}
                      >
                        <StopIcon size={10} /> Stop
                      </button>
                    )}

                    {/* Dropdown toggle for configs (only if multiple configs) */}
                    {multiRunConfig && (
                      <button
                        type="button"
                        className="workspace-run-chevron"
                        onClick={() => setShowDropdownWorkspaceId(showDropdownWorkspaceId === ws.id ? null : ws.id)}
                        disabled={projectState.status === 'starting' || projectState.status === 'stopping' || projectState.status === 'running'}
                        style={{
                          opacity: (projectState.status === 'starting' || projectState.status === 'stopping' || projectState.status === 'running') ? 0.5 : 1,
                          cursor: (projectState.status === 'starting' || projectState.status === 'stopping' || projectState.status === 'running') ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                    )}

                    {/* Dropdown overlay — kept outside button paint so it is not clipped */}
                    {showDropdownWorkspaceId === ws.id && ws.runConfigs && (
                      <div
                        role="menu"
                        style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        right: 0,
                        background: '#1c1c1e',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        padding: '4px',
                        zIndex: 1000,
                        minWidth: '180px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)'
                      }}>
                        {ws.runConfigs.map((cfg) => (
                          <button
                            key={cfg.id}
                            onClick={() => {
                              void runProject(ws.id, cfg.id);
                              setShowDropdownWorkspaceId(null);
                            }}
                            style={{
                              width: '100%',
                              padding: '5px 8px',
                              textAlign: 'left',
                              background: 'transparent',
                              border: 'none',
                              color: '#e4e4e7',
                              fontSize: '11px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              display: 'block',
                              transition: 'all 0.1s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(56, 189, 248, 0.15)'; e.currentTarget.style.color = '#7dd3fc'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#e4e4e7'; }}
                          >
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                               <span>{cfg.name}</span>
                               {ws.defaultConfigId === cfg.id && (
                                 <svg width="10" height="10" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" strokeWidth="2" style={{ marginLeft: '4px' }}>
                                   <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                 </svg>
                               )}
                             </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Restart icon button (only visible when not stopped) */}
                  {projectState.status !== 'stopped' && ws.runConfigs && ws.runConfigs.length > 0 && (
                    <button
                      type="button"
                      className="workspace-icon-btn"
                      onClick={() => {
                        const cfgId = projectState.activeConfigId || ws.defaultConfigId || (ws.runConfigs && ws.runConfigs[0]?.id);
                        if (cfgId) {
                          void runProject(ws.id, cfgId);
                        }
                      }}
                      title="Restart Project"
                    >
                      <RestartIcon size={12} />
                    </button>
                  )}

                  {/* Configure settings icon button */}
                  <button
                    type="button"
                    className="workspace-icon-btn"
                    onClick={() => setShowConfigModal(true)}
                    title="Configure Commands"
                  >
                    <SettingsIcon size={12} />
                  </button>

                  {/* Open Logs icon button */}
                  <button
                    type="button"
                    className={`workspace-icon-btn${projectState.status === 'failed' ? ' is-danger' : ''}`}
                    onClick={() => setShowLogsModal(true)}
                    title="Open Project Logs"
                  >
                    <LogsIcon size={12} />
                  </button>

                  {/* Active preview link */}
                  {projectState.status === 'running' && activeConfigForWs && activeConfigForWs.previewUrl && (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setRightTab('preview');
                      }}
                      title="Open Live Preview"
                      style={{
                        fontSize: '11px',
                        color: '#7dd3fc',
                        textDecoration: 'underline',
                        marginLeft: '4px'
                      }}
                    >
                      {activeConfigForWs.previewUrl.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </div>

              {/* Subtle indicators and new pane button */}
              <div className="workspace-flow-status">
                <span className="workspace-meta-chip">
                  {paneCount} {paneCount === 1 ? 'pane' : 'panes'}
                </span>
                <span className="workspace-meta-chip">
                  {openTaskCount} {openTaskCount === 1 ? 'task' : 'tasks'}
                </span>
                {!isCompact ? (
                  <>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '6px' }}>
                      {/* + Pane Button */}
                      <button
                        onClick={() => createPane()}
                        title="Create new terminal pane (Ctrl+T)"
                        style={{
                          height: '22px',
                          padding: '0 8px',
                          background: `${activeColor}12`,
                          border: `1px solid ${activeColor}45`,
                          borderRadius: '4px',
                          color: activeColor,
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `${activeColor}25`;
                          e.currentTarget.style.borderColor = activeColor;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = `${activeColor}12`;
                          e.currentTarget.style.borderColor = `${activeColor}45`;
                        }}
                      >
                        <PlusIcon size={11} />
                        <span>Pane</span>
                      </button>

                      {/* Visual Grid Layout Selector */}
                      <div style={{ position: 'relative', display: 'inline-flex' }}>
                        <button
                          ref={layoutButtonRef}
                          onClick={() => {
                            setShowLayoutDropdown(!showLayoutDropdown);
                            setShowAgentDropdown(false);
                          }}
                          title="Choose Grid Layout"
                          className={`workspace-icon-btn${showLayoutDropdown ? ' is-open' : ''}`}
                        >
                          <LayoutGridIcon size={13} />
                        </button>

                        {showLayoutDropdown && (
                          <div
                            ref={layoutDropdownRef}
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: '6px',
                              background: '#18181b',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px',
                              padding: '12px',
                              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
                              zIndex: 200,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px',
                              width: 'auto'
                            }}
                          >
                            <div style={{ fontSize: '10px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Grid Size
                            </div>

                            <div
                              onMouseLeave={() => {
                                setHoveredCols(0);
                                setHoveredRows(0);
                              }}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(8, 16px)',
                                gridTemplateRows: 'repeat(5, 16px)',
                                gap: '3px',
                                background: 'rgba(0,0,0,0.2)',
                                padding: '4px',
                                borderRadius: '6px',
                                border: '1px solid rgba(255,255,255,0.04)'
                              }}
                            >
                              {Array.from({ length: 5 }).map((_, r) =>
                                Array.from({ length: 8 }).map((_, c) => {
                                  const isHighlighted = c < hoveredCols && r < hoveredRows;
                                  return (
                                    <div
                                      key={`${r}-${c}`}
                                      onMouseEnter={() => {
                                        setHoveredCols(c + 1);
                                        setHoveredRows(r + 1);
                                      }}
                                      onClick={() => {
                                        setGridLayout(c + 1, r + 1);
                                        setShowLayoutDropdown(false);
                                        setHoveredCols(0);
                                        setHoveredRows(0);
                                      }}
                                      style={{
                                        width: '16px',
                                        height: '16px',
                                        border: '1px solid',
                                        borderColor: isHighlighted ? activeColor : 'rgba(255,255,255,0.08)',
                                        background: isHighlighted ? `${activeColor}33` : 'transparent',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        transition: 'all 0.05s ease'
                                      }}
                                    />
                                  );
                                })
                              )}
                            </div>

                            <div style={{
                              fontSize: '11px',
                              color: hoveredCols > 0 ? '#f4f4f5' : '#71717a',
                              fontWeight: 600,
                              textAlign: 'center',
                              background: 'rgba(255,255,255,0.02)',
                              padding: '4px',
                              borderRadius: '4px',
                              border: '1px solid rgba(255,255,255,0.04)',
                              whiteSpace: 'nowrap'
                            }}>
                              {hoveredCols > 0 && hoveredRows > 0
                                ? `${hoveredCols} x ${hoveredRows} Grid`
                                : 'Select Grid Size'}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Run Agent in All Panes Button */}
                      <div style={{ position: 'relative', display: 'inline-flex' }}>
                        <button
                          ref={agentButtonRef}
                          onClick={() => {
                            setShowAgentDropdown(!showAgentDropdown);
                            setShowLayoutDropdown(false);
                          }}
                          title="Run Agent in All Panes"
                          className={`workspace-icon-btn${showAgentDropdown ? ' is-open' : ''}`}
                          style={{ color: '#c084fc' }}
                        >
                          <SparkleIcon size={13} />
                        </button>

                        {showAgentDropdown && (
                          <div
                            ref={agentDropdownRef}
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: '6px',
                              background: '#18181b',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px',
                              padding: '6px',
                              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
                              zIndex: 200,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              minWidth: '150px',
                              width: 'max-content'
                            }}
                          >
                            <div style={{ fontSize: '9px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 8px 6px' }}>
                              Run in all panes
                            </div>

                            {agentProfiles.map((agent) => (
                              <button
                                key={agent.id}
                                onClick={() => {
                                  void runAgentInAllPanes(agent.id);
                                  setShowAgentDropdown(false);
                                }}
                                style={{
                                  width: '100%',
                                  padding: '6px 10px',
                                  textAlign: 'left',
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#e4e4e7',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  transition: 'all 0.1s ease',
                                  whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)';
                                  e.currentTarget.style.color = '#e9d5ff';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = '#e4e4e7';
                                }}
                              >
                                <SparkleIcon size={10} />
                                <span>{agent.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Toggle Composer for All Panes Button */}
                      <button
                        onClick={() => {
                          window.dispatchEvent(
                            new CustomEvent('agentdeck:set-composer-all', { detail: { toggle: true } })
                          );
                        }}
                        title="Toggle Command Composer for ALL Panes"
                        className="workspace-icon-btn"
                        style={{ color: '#38bdf8' }}
                      >
                        <ComposerIcon size={13} />
                      </button>

                      {/* Stop All Panes Button */}
                      <button
                        onClick={() => {
                          if (window.confirm('Stop all running terminal sessions in this workspace?')) {
                            void stopAllPanes();
                          }
                        }}
                        title="Stop All Panes"
                        className="workspace-icon-btn is-danger"
                      >
                        <StopIcon size={11} />
                      </button>

                      {/* Close All Panes Button */}
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to close and delete all terminal panes in this workspace?')) {
                            void closeAllPanes();
                          }
                        }}
                        title="Close All Panes"
                        className="workspace-icon-btn is-danger"
                      >
                        <CloseIcon size={11} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ position: 'relative', display: 'inline-flex' }}>
                    <button
                      type="button"
                      ref={moreButtonRef}
                      aria-expanded={showMoreDropdown}
                      aria-haspopup="menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMoreDropdown((open) => {
                          if (open) {
                            setShowLayoutDropdown(false);
                            setShowAgentDropdown(false);
                          }
                          return !open;
                        });
                      }}
                      title="More actions"
                      className={`workspace-icon-btn workspace-more-btn${showMoreDropdown ? ' is-open' : ''}`}
                      style={{
                        background: showMoreDropdown ? '#27272a' : undefined,
                        borderColor: showMoreDropdown ? 'rgba(255,255,255,0.2)' : undefined,
                        color: showMoreDropdown ? '#fafafa' : undefined
                      }}
                    >
                      <MoreIcon size={13} />
                    </button>

                    {showMoreDropdown &&
                      moreMenuPos &&
                      createPortal(
                        <div
                          ref={moreDropdownRef}
                          className="more-actions-dropdown"
                          style={{
                            position: 'fixed',
                            top: moreMenuPos.top,
                            right: moreMenuPos.right,
                            zIndex: 6000
                          }}
                        >
                          {/* + Pane */}
                          <button
                            type="button"
                            onClick={() => {
                              createPane();
                              setShowMoreDropdown(false);
                            }}
                            className="dropdown-item-btn add-pane-btn"
                            style={{ color: activeColor }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = `${activeColor}15`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <PlusIcon size={11} />
                            <span>Add Pane</span>
                          </button>

                          {/* Choose Layout */}
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              ref={nestedLayoutButtonRef}
                              onClick={() => {
                                setShowLayoutDropdown(!showLayoutDropdown);
                                setShowAgentDropdown(false);
                              }}
                              className="dropdown-item-btn layout-btn"
                              style={{
                                background: showLayoutDropdown ? 'rgba(255,255,255,0.06)' : 'transparent'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                e.currentTarget.style.color = activeColor;
                              }}
                              onMouseLeave={(e) => {
                                if (!showLayoutDropdown) {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = '#e4e4e7';
                                }
                              }}
                            >
                              <LayoutGridIcon size={11} />
                              <span>Choose Layout</span>
                            </button>

                            {showLayoutDropdown && (
                              <div
                                ref={layoutDropdownRef}
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  right: '100%',
                                  marginRight: '8px',
                                  background: '#18181b',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  borderRadius: '8px',
                                  padding: '12px',
                                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
                                  zIndex: 6010,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                  width: 'auto'
                                }}
                              >
                                <div style={{ fontSize: '10px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Grid Size
                                </div>
                                <div
                                  onMouseLeave={() => {
                                    setHoveredCols(0);
                                    setHoveredRows(0);
                                  }}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(8, 16px)',
                                    gridTemplateRows: 'repeat(5, 16px)',
                                    gap: '3px',
                                    background: 'rgba(0,0,0,0.2)',
                                    padding: '4px',
                                    borderRadius: '6px',
                                    border: '1px solid rgba(255,255,255,0.04)'
                                  }}
                                >
                                  {Array.from({ length: 5 }).map((_, r) =>
                                    Array.from({ length: 8 }).map((_, c) => {
                                      const isHighlighted = c < hoveredCols && r < hoveredRows;
                                      return (
                                        <div
                                          key={`${r}-${c}`}
                                          onMouseEnter={() => {
                                            setHoveredCols(c + 1);
                                            setHoveredRows(r + 1);
                                          }}
                                          onClick={() => {
                                            setGridLayout(c + 1, r + 1);
                                            setShowLayoutDropdown(false);
                                            setShowMoreDropdown(false);
                                            setHoveredCols(0);
                                            setHoveredRows(0);
                                          }}
                                          style={{
                                            width: '16px',
                                            height: '16px',
                                            border: '1px solid',
                                            borderColor: isHighlighted ? activeColor : 'rgba(255,255,255,0.08)',
                                            background: isHighlighted ? `${activeColor}33` : 'transparent',
                                            borderRadius: '3px',
                                            cursor: 'pointer',
                                            transition: 'all 0.05s ease'
                                          }}
                                        />
                                      );
                                    })
                                  )}
                                </div>
                                <div
                                  style={{
                                    fontSize: '11px',
                                    color: hoveredCols > 0 ? '#f4f4f5' : '#71717a',
                                    fontWeight: 600,
                                    textAlign: 'center',
                                    background: 'rgba(255,255,255,0.02)',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {hoveredCols > 0 && hoveredRows > 0
                                    ? `${hoveredCols} x ${hoveredRows} Grid`
                                    : 'Select Grid Size'}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Run Agent on All */}
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              ref={nestedAgentButtonRef}
                              onClick={() => {
                                setShowAgentDropdown(!showAgentDropdown);
                                setShowLayoutDropdown(false);
                              }}
                              className="dropdown-item-btn agent-run-btn"
                              style={{
                                background: showAgentDropdown ? 'rgba(168, 85, 247, 0.1)' : 'transparent'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)';
                                e.currentTarget.style.color = '#e9d5ff';
                              }}
                              onMouseLeave={(e) => {
                                if (!showAgentDropdown) {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = '#a855f7';
                                }
                              }}
                            >
                              <SparkleIcon size={11} />
                              <span>Run Agent on All</span>
                            </button>

                            {showAgentDropdown && (
                              <div
                                ref={agentDropdownRef}
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  right: '100%',
                                  marginRight: '8px',
                                  background: '#18181b',
                                  border: '1px solid rgba(255, 255, 255, 0.08)',
                                  borderRadius: '8px',
                                  padding: '6px',
                                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
                                  zIndex: 6010,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  minWidth: '150px',
                                  width: 'max-content',
                                  maxHeight: '280px',
                                  overflowY: 'auto'
                                }}
                              >
                                <div style={{ fontSize: '9px', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 8px 6px' }}>
                                  Run in all panes
                                </div>
                                {agentProfiles.map((agent) => (
                                  <button
                                    type="button"
                                    key={agent.id}
                                    onClick={() => {
                                      void runAgentInAllPanes(agent.id);
                                      setShowAgentDropdown(false);
                                      setShowMoreDropdown(false);
                                    }}
                                    className="dropdown-item-btn"
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)';
                                      e.currentTarget.style.color = '#e9d5ff';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent';
                                      e.currentTarget.style.color = '#e4e4e7';
                                    }}
                                  >
                                    <SparkleIcon size={10} />
                                    <span>{agent.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Stop All Panes */}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Stop all running terminal sessions in this workspace?')) {
                                void stopAllPanes();
                                setShowMoreDropdown(false);
                              }
                            }}
                            className="dropdown-item-btn stop-pane-btn"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <StopIcon size={11} />
                            <span>Stop All Panes</span>
                          </button>

                          {/* Close All Panes */}
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm('Are you sure you want to close and delete all terminal panes in this workspace?')) {
                                void closeAllPanes();
                                setShowMoreDropdown(false);
                              }
                            }}
                            className="dropdown-item-btn close-pane-btn"
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                              e.currentTarget.style.color = '#ef4444';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = '#71717a';
                            }}
                          >
                            <CloseIcon size={11} />
                            <span>Close All Panes</span>
                          </button>
                        </div>,
                        document.body
                      )}
                  </div>
                )}
              </div>
              </div>{/* end workspace-topbar-actions */}
            </div>
            {!ws.layout ? (
              <div className="workspace-empty-panes" style={{ flex: 1 }}>
                <div className="first-launch-card">
                  <h2>{ws.name}</h2>
                  <p>
                    This workspace has no panes. Create a terminal pane to start manual commands or local agent
                    sessions.
                  </p>
                  <button onClick={() => createPane()}>Create terminal pane</button>
                </div>
              </div>
            ) : (
              <div className="layout-root" style={{ flex: 1, minHeight: 0 }}>{renderLayout(ws.layout, ws, activePaneId, isActive)}</div>
            )}
          </div>
        );
      })}

      {/* 1. Configure Run Commands Modal — crisp solid UI */}
      {showConfigModal && activeWorkspace && (
        <div
          className="run-config-overlay"
          onMouseDown={(e) => {
            overlayMouseDownRef.current = e.target;
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && overlayMouseDownRef.current === e.currentTarget) {
              setShowConfigModal(false);
            }
          }}
        >
          <div
            className="run-config-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Configure Run Commands: ${activeWorkspace.name}`}
          >
            <div className="run-config-titlebar">
              <h3>
                Configure Run Commands: <span className="run-config-ws-name">{activeWorkspace.name}</span>
              </h3>
              <button
                type="button"
                className="run-config-close-btn"
                onClick={() => setShowConfigModal(false)}
                title="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="run-config-body">
              {/* Left configs list */}
              <aside className="run-config-sidebar">
                <div className="run-config-sidebar-label">Run Configurations</div>
                <div className="run-config-list">
                  {configList.map((cfg) => (
                    <div
                      key={cfg.id}
                      className={`run-config-list-item${editingConfigId === cfg.id ? ' is-active' : ''}`}
                      onClick={() => setEditingConfigId(cfg.id)}
                    >
                      <span className="run-config-list-name">{cfg.name}</span>
                      <RunConfigListDelete onConfirm={() => handleDeleteConfig(cfg.id)} />
                    </div>
                  ))}
                </div>
                <button type="button" className="run-config-add-btn" onClick={handleAddConfig}>
                  + Add Config
                </button>
              </aside>

              {/* Right form / empty */}
              <div className="run-config-main">
                {currentEditingConfig ? (
                  <div className="run-config-form">
                    <div className="run-config-row">
                      <div className="run-config-field" style={{ flex: 2 }}>
                        <label className="run-config-label">Config Name</label>
                        <input
                          type="text"
                          className="run-config-input"
                          value={currentEditingConfig.name}
                          onChange={(e) => handleUpdateConfigField('name', e.target.value)}
                        />
                      </div>
                      <div className="run-config-field" style={{ flex: 1 }}>
                        <label className="run-config-label">Type</label>
                        <RunConfigTypeSelect
                          value={currentEditingConfig.type}
                          onChange={(next) => handleUpdateConfigField('type', next)}
                        />
                      </div>
                    </div>

                    {currentEditingConfig.type === 'fullstack' ? (
                      <>
                        <div className="run-config-section">
                          <h4 className="run-config-section-title">Backend Configuration (Runs First)</h4>
                          <div className="run-config-field">
                            <label className="run-config-label">Backend Command</label>
                            <input
                              type="text"
                              className="run-config-input"
                              placeholder="e.g. npm run backend"
                              value={currentEditingConfig.backendCommand || ''}
                              onChange={(e) => handleUpdateConfigField('backendCommand', e.target.value)}
                            />
                          </div>
                          <div className="run-config-field">
                            <label className="run-config-label">Backend Working Directory</label>
                            <input
                              type="text"
                              className="run-config-input"
                              placeholder="Full path or blank for workspace root"
                              value={currentEditingConfig.backendWorkingDirectory || ''}
                              onChange={(e) => handleUpdateConfigField('backendWorkingDirectory', e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="run-config-delay-row">
                          <label className="run-config-label" style={{ marginBottom: 0 }}>
                            Startup delay before Frontend starts (ms)
                          </label>
                          <input
                            type="number"
                            className="run-config-input run-config-input-sm"
                            value={currentEditingConfig.delayBetweenMs || 2000}
                            onChange={(e) => handleUpdateConfigField('delayBetweenMs', Number(e.target.value))}
                          />
                        </div>

                        <div className="run-config-section">
                          <h4 className="run-config-section-title">Frontend Configuration</h4>
                          <div className="run-config-field">
                            <label className="run-config-label">Frontend Command</label>
                            <input
                              type="text"
                              className="run-config-input"
                              placeholder="e.g. npm run dev"
                              value={currentEditingConfig.frontendCommand || ''}
                              onChange={(e) => handleUpdateConfigField('frontendCommand', e.target.value)}
                            />
                          </div>
                          <div className="run-config-field">
                            <label className="run-config-label">Frontend Working Directory</label>
                            <input
                              type="text"
                              className="run-config-input"
                              placeholder="Full path or blank for workspace root"
                              value={currentEditingConfig.frontendWorkingDirectory || ''}
                              onChange={(e) => handleUpdateConfigField('frontendWorkingDirectory', e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="run-config-field">
                          <label className="run-config-label">Run Command</label>
                          <input
                            type="text"
                            className="run-config-input"
                            placeholder="e.g. npm run dev"
                            value={currentEditingConfig.command}
                            onChange={(e) => handleUpdateConfigField('command', e.target.value)}
                          />
                        </div>
                        <div className="run-config-field">
                          <label className="run-config-label">Working Directory</label>
                          <input
                            type="text"
                            className="run-config-input"
                            placeholder="Full path to folder (blank defaults to workspace folder)"
                            value={currentEditingConfig.workingDirectory}
                            onChange={(e) => handleUpdateConfigField('workingDirectory', e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    <div className="run-config-divider" />

                    <div className="run-config-field">
                      <label className="run-config-label">Preview URL (Optional)</label>
                      <input
                        type="text"
                        className="run-config-input"
                        placeholder="e.g. http://localhost:3000"
                        value={currentEditingConfig.previewUrl || ''}
                        onChange={(e) => handleUpdateConfigField('previewUrl', e.target.value)}
                      />
                    </div>

                    <div className="run-config-checks">
                      <label className="run-config-check">
                        <input
                          type="checkbox"
                          checked={currentEditingConfig.autoOpenPreview || false}
                          onChange={(e) => handleUpdateConfigField('autoOpenPreview', e.target.checked)}
                        />
                        Auto-open Preview panel after executing this command successfully
                      </label>
                      <label className="run-config-check">
                        <input
                          type="checkbox"
                          checked={defaultConfigId === currentEditingConfig.id}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setDefaultConfigId(currentEditingConfig.id);
                            }
                          }}
                        />
                        Set as Default command for this Workspace
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="run-config-empty">
                    <div className="run-config-empty-card">
                      <span className="run-config-empty-icon" aria-hidden>
                        <SettingsIcon size={22} />
                      </span>
                      <strong>No run configurations yet</strong>
                      <p>
                        Create a config to define how this workspace starts.
                        Use <strong>+ Add Config</strong> in the left panel.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="run-config-footer">
              <button type="button" className="run-config-btn-secondary" onClick={() => setShowConfigModal(false)}>
                Cancel
              </button>
              <button type="button" className="run-config-btn-primary" onClick={handleSaveConfigs}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Real-time Log Viewer Modal — crisp-text-dark-ui */}
      {showLogsModal && activeWorkspace && (
        <div
          className="project-logs-overlay"
          onMouseDown={(e) => {
            overlayMouseDownRef.current = e.target;
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && overlayMouseDownRef.current === e.currentTarget) {
              setShowLogsModal(false);
            }
          }}
        >
          <div
            className="project-logs-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Project Console Logs: ${activeWorkspace.name}`}
          >
            <div className="project-logs-titlebar">
              <div className="project-logs-title">
                <span className="project-logs-dot" aria-hidden />
                <h3>Project Console Logs: {activeWorkspace.name}</h3>
              </div>
              <div className="project-logs-actions">
                <button
                  type="button"
                  className="project-logs-rerun-btn"
                  onClick={() => {
                    const cfgId =
                      projectRunStates[activeWorkspace.id]?.activeConfigId ||
                      activeWorkspace.defaultConfigId ||
                      (activeWorkspace.runConfigs && activeWorkspace.runConfigs[0]?.id);
                    if (cfgId) {
                      void runProject(activeWorkspace.id, cfgId);
                    }
                  }}
                  disabled={!activeWorkspace.runConfigs || activeWorkspace.runConfigs.length === 0}
                >
                  Rerun
                </button>
                <button
                  type="button"
                  className="project-logs-close-btn"
                  onClick={() => setShowLogsModal(false)}
                  title="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            <div
              className={`project-logs-body${!projectLogs[activeWorkspace.id] ? ' is-empty' : ''}`}
              ref={(el) => {
                if (el) {
                  el.scrollTop = el.scrollHeight;
                }
              }}
            >
              {projectLogs[activeWorkspace.id] ||
                '--- No logs recorded yet. Run the project to see stdout/stderr console output. ---'}
            </div>

            <div className="project-logs-footer">
              <span
                className="project-logs-path"
                title={`C:\\Users\\Gaming 3\\.gemini\\antigravity\\logs\\project-run-${activeWorkspace.id}.log`}
              >
                {`Log Path: C:\\Users\\Gaming 3\\.gemini\\antigravity\\logs\\project-run-${activeWorkspace.id}.log`}
              </span>
              <span
                className={`project-logs-process${
                  projectRunStates[activeWorkspace.id]?.status === 'running' ||
                  projectRunStates[activeWorkspace.id]?.status === 'starting'
                    ? ' is-active'
                    : ''
                }`}
              >
                Running processes:{' '}
                {projectRunStates[activeWorkspace.id]?.status === 'running' ||
                projectRunStates[activeWorkspace.id]?.status === 'starting'
                  ? 'Active'
                  : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PaneShell({
  pane,
  activePaneId,
  isWorkspaceActive
}: {
  pane: Workspace['panes'][string];
  activePaneId: string | null;
  isWorkspaceActive: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [isComposerVisible, setIsComposerVisible] = useState(() => {
    const val = localStorage.getItem(`agentdeck:composer-visible:${pane.id}`);
    if (val !== null) return val === 'true';
    const globalVal = localStorage.getItem('agentdeck:composer-visible:all');
    return globalVal === 'true';
  });
  const [editValue, setEditValue] = useState(pane.title);
  const renamePane = useDeckStore((state) => state.renamePane);
  const swapPanePositions = useDeckStore((state) => state.swapPanePositions);

  useEffect(() => {
    const clearDragState = () => {
      setIsDragging(false);
      setIsDropTarget(false);
    };
    window.addEventListener(PANE_DRAG_END_EVENT, clearDragState);
    return () => window.removeEventListener(PANE_DRAG_END_EVENT, clearDragState);
  }, []);

  const toggleComposer = () => {
    setIsComposerVisible((prev) => {
      const next = !prev;
      localStorage.setItem(`agentdeck:composer-visible:${pane.id}`, String(next));
      return next;
    });
  };

  const toggleComposerAll = (visible?: boolean) => {
    const nextState = visible ?? !isComposerVisible;
    window.dispatchEvent(
      new CustomEvent('agentdeck:set-composer-all', { detail: { visible: nextState } })
    );
  };

  useEffect(() => {
    const handleSetAll = (e: Event) => {
      const customEvent = e as CustomEvent<{ visible?: boolean; toggle?: boolean }>;
      if (customEvent.detail.visible !== undefined) {
        setIsComposerVisible(customEvent.detail.visible);
        localStorage.setItem(`agentdeck:composer-visible:${pane.id}`, String(customEvent.detail.visible));
        localStorage.setItem('agentdeck:composer-visible:all', String(customEvent.detail.visible));
      } else if (customEvent.detail.toggle) {
        setIsComposerVisible((prev) => {
          const next = !prev;
          localStorage.setItem(`agentdeck:composer-visible:${pane.id}`, String(next));
          localStorage.setItem('agentdeck:composer-visible:all', String(next));
          return next;
        });
      }
    };
    window.addEventListener('agentdeck:set-composer-all', handleSetAll);
    return () => window.removeEventListener('agentdeck:set-composer-all', handleSetAll);
  }, [pane.id]);

  useEffect(() => {
    setEditValue(pane.title);
  }, [pane.title]);

  useEffect(() => {
    const handleTriggerRename = (e: Event) => {
      const customEvent = e as CustomEvent<{ paneId: string }>;
      if (customEvent.detail.paneId === pane.id) {
        setIsEditing(true);
      }
    };
    window.addEventListener('trigger-pane-rename', handleTriggerRename);
    return () => window.removeEventListener('trigger-pane-rename', handleTriggerRename);
  }, [pane.id]);

  const tasks = useDeckStore((state) => state.tasks);
  const agentRuns = useDeckStore((state) => state.agentRuns);
  const workspaceColor = useDeckStore((state) => {
    const ws = state.workspaces.find((w) => w.id === state.activeWorkspaceId);
    return ws?.color || '#38bdf8';
  });

  const linkedTasks = useMemo(() => {
    return tasks.filter((t) => t.paneId === pane.id && t.status !== 'done');
  }, [tasks, pane.id]);

  const isAgentRunning = useMemo(() => {
    const isAlive = pane.processStatus === 'ready' || pane.processStatus === 'running' || pane.processStatus === 'idle' || pane.processStatus === 'spawning';
    if (!isAlive) return false;

    const hasRun = agentRuns.some((run) => run.terminalSessionId === pane.id && run.status === 'running');
    const hasTask = tasks.some((t) => t.paneId === pane.id && t.status === 'running');
    const isExecuting = pane.processStatus === 'running';

    return Boolean(hasRun || hasTask || isExecuting);
  }, [agentRuns, tasks, pane.id, pane.processStatus]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed) {
      renamePane(pane.id, trimmed);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(pane.title);
      setIsEditing(false);
    }
  };

  const isActive = activePaneId === pane.id;
  const shellStyle = isActive
    ? ({ ['--pane-active-color' as string]: workspaceColor } as CSSProperties)
    : undefined;

  return (
    <div
      className={`pane-shell${isActive ? ' is-active' : ''}${isDragging ? ' is-pane-dragging' : ''}${isDropTarget ? ' is-pane-drop-target' : ''}`}
      style={shellStyle}
      onDragEnterCapture={(event) => {
        if (!event.dataTransfer.types.includes(PANE_DRAG_MIME)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const sourcePaneId = activeDraggedPaneId;
        setIsDropTarget(Boolean(sourcePaneId && sourcePaneId !== pane.id));
      }}
      onDragOverCapture={(event) => {
        if (!event.dataTransfer.types.includes(PANE_DRAG_MIME)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        const sourcePaneId = activeDraggedPaneId;
        setIsDropTarget(Boolean(sourcePaneId && sourcePaneId !== pane.id));
      }}
      onDragLeave={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          event.currentTarget.contains(event.relatedTarget)
        ) {
          return;
        }
        setIsDropTarget(false);
      }}
      onDropCapture={(event) => {
        if (!event.dataTransfer.types.includes(PANE_DRAG_MIME)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const sourcePaneId =
          event.dataTransfer.getData(PANE_DRAG_MIME) || activeDraggedPaneId;
        setIsDropTarget(false);
        if (sourcePaneId && sourcePaneId !== pane.id) {
          swapPanePositions(sourcePaneId, pane.id);
        }
        window.dispatchEvent(new Event(PANE_DRAG_END_EVENT));
      }}
    >
      <div className="pane-titlebar">
        <div
          className="pane-session-meta"
          draggable={!isEditing}
          title={isEditing ? undefined : 'Drag to swap this terminal with another'}
          onDragStart={(event) => {
            if (isEditing) {
              event.preventDefault();
              return;
            }
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData(PANE_DRAG_MIME, pane.id);
            event.dataTransfer.setData('text/plain', pane.title);
            activeDraggedPaneId = pane.id;
            setIsDragging(true);
          }}
          onDragEnd={() => {
            activeDraggedPaneId = null;
            window.dispatchEvent(new Event(PANE_DRAG_END_EVENT));
          }}
        >
          <span className={`status-dot ${isAgentRunning ? 'agent-running' : pane.processStatus}`} title={`Status: ${isAgentRunning ? 'Agent Running' : pane.processStatus}`} />
          {isEditing ? (
            <input
              className="pane-title-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          ) : (
            <span className="pane-session-title" onDoubleClick={() => setIsEditing(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {isAgentRunning && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#38bdf8" stroke="#38bdf8" strokeWidth="2">
                  <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                </svg>
              )}
              {pane.title}
            </span>
          )}
          <span className="pane-session-shell">{pane.shell ?? 'default shell'}</span>
          {linkedTasks.length > 0 && (
            <span
              className="pane-linked-tasks-badge"
              title={`Linked Tasks:\n${linkedTasks.map((t) => `- [${t.status.toUpperCase()}] ${t.title}`).join('\n')}`}
            >
              <TaskIcon />
              {linkedTasks.length}
            </span>
          )}
        </div>
        <PaneToolbar 
          pane={pane} 
          onRenameTrigger={() => setIsEditing(true)} 
          isComposerVisible={isComposerVisible}
          onToggleComposer={toggleComposer}
        />
      </div>
      <TerminalPane 
        key={pane.id} 
        pane={pane} 
        active={activePaneId === pane.id} 
        isWorkspaceActive={isWorkspaceActive} 
        isComposerVisible={isComposerVisible}
      />
    </div>
  );
}

function renderLayout(
  layout: PaneLayout,
  workspace: Workspace,
  activePaneId: string | null,
  isWorkspaceActive: boolean
): React.ReactNode {
  if (layout.type === 'pane') {
    const pane = workspace.panes[layout.paneId];
    if (!pane) {
      return null;
    }

    return (
      <PaneShell
        key={pane.id}
        pane={pane}
        activePaneId={activePaneId}
        isWorkspaceActive={isWorkspaceActive}
      />
    );
  }

  return (
    <div
      className={`split-layout ${layout.direction}`}
      style={{
        gridTemplateColumns:
          layout.direction === 'vertical' ? `${layout.ratio}fr 6px ${1 - layout.ratio}fr` : undefined,
        gridTemplateRows: layout.direction === 'horizontal' ? `${layout.ratio}fr 6px ${1 - layout.ratio}fr` : undefined
      }}
    >
      {renderLayout(layout.first, workspace, activePaneId, isWorkspaceActive)}
      <SplitHandle splitId={layout.id} direction={layout.direction} ratio={layout.ratio} />
      {renderLayout(layout.second, workspace, activePaneId, isWorkspaceActive)}
    </div>
  );
}

type SplitHandleProps = {
  splitId: string;
  direction: 'horizontal' | 'vertical';
  ratio: number;
};

function SplitHandle({ splitId, direction, ratio }: SplitHandleProps) {
  const setSplitRatio = useDeckStore((state) => state.setSplitRatio);

  return (
    <div
      className={`split-handle ${direction}`}
      onPointerDown={(event) => {
        const handle = event.currentTarget;
        const parent = handle.parentElement;
        if (!parent) {
          return;
        }

        handle.setPointerCapture(event.pointerId);
        const rect = parent.getBoundingClientRect();

        const onMove = (moveEvent: PointerEvent) => {
          const nextRatio =
            direction === 'vertical'
              ? (moveEvent.clientX - rect.left) / rect.width
              : (moveEvent.clientY - rect.top) / rect.height;
          setSplitRatio(splitId, nextRatio);
        };

        const stopResize = () => {
          if (handle.hasPointerCapture(event.pointerId)) {
            handle.releasePointerCapture(event.pointerId);
          }
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', stopResize);
          window.removeEventListener('pointercancel', stopResize);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', stopResize);
        window.addEventListener('pointercancel', stopResize);
      }}
      role="separator"
      aria-orientation={direction === 'vertical' ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(ratio * 100)}
    />
  );
}

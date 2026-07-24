import { useState, useEffect, useRef } from 'react';
import type { TerminalPaneConfig } from '../../shared/types';
import { useDeckStore } from '../store/deckStore';
import { publishTerminalClear, publishTerminalRestart, clearAllTerminals } from '../utils/terminalBus';

const SparkleIcon = () => (
  <svg
    width="13"
    height="13"
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

const SplitVIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="12" height="12" rx="1.5" />
    <path d="M8 2v12" />
  </svg>
);

const SplitHIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="12" height="12" rx="1.5" />
    <path d="M2 8h12" />
  </svg>
);

const RenameIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2l2 2-10 10H2v-2z" />
  </svg>
);

const ClearIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 6h10" />
    <path d="M5 6v8a1 1 0 001 1h4a1 1 0 001-1V6M8 3v3M10 3H6M10 3a1 1 0 00-1-1H7a1 1 0 00-1 1" />
  </svg>
);

const PauseIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="4" y="3" width="3" height="10" fill="currentColor" />
    <rect x="9" y="3" width="3" height="10" fill="currentColor" />
  </svg>
);

const PlayIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="5 3 13 8 5 13 5 3" fill="currentColor" />
  </svg>
);

const RestartIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2.5 8a5.5 5.5 0 018.25-4.76L12.5 4.5M13.5 8a5.5 5.5 0 01-8.25 4.76L3.5 11.5" />
    <path d="M12.5 2v2.5H10M3.5 14v-2.5H6" />
  </svg>
);

const MaximizeIcon = ({ maximized }: { maximized: boolean }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {maximized ? (
      <>
        <rect x="2" y="5" width="9" height="9" rx="1.5" />
        <path d="M5 5V2a1.5 1.5 0 011.5-1.5h7A1.5 1.5 0 0115 2v7a1.5 1.5 0 01-1.5 1.5H11" />
      </>
    ) : (
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
    )}
  </svg>
);

const CloseIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

const ComposerIcon = ({ size = 14 }: { size?: number }) => (
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

const MoreIcon = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 16 16"
    fill="currentColor"
  >
    <circle cx="8" cy="3" r="1.5" />
    <circle cx="8" cy="8" r="1.5" />
    <circle cx="8" cy="13" r="1.5" />
  </svg>
);


type PaneToolbarProps = {
  pane: TerminalPaneConfig;
  onRenameTrigger: () => void;
  isComposerVisible: boolean;
  onToggleComposer: () => void;
};

export function PaneToolbar({ pane, onRenameTrigger, isComposerVisible, onToggleComposer }: PaneToolbarProps) {
  const workspaces = useDeckStore((state) => state.workspaces);
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const splitPane = useDeckStore((state) => state.splitPane);
  const closePane = useDeckStore((state) => state.closePane);
  const maximizePane = useDeckStore((state) => state.maximizePane);

  const agentProfiles = useDeckStore((state) => state.agentProfiles);
  const runAgentInPane = useDeckStore((state) => state.runAgentInPane);
  const agentRuns = useDeckStore((state) => state.agentRuns);
  const pauseAgentRun = useDeckStore((state) => state.pauseAgentRun);
  const resumeAgentRun = useDeckStore((state) => state.resumeAgentRun);

  const paneTokens = useDeckStore((state) => state.paneTokens[pane.id]) || { inputChars: 0, outputChars: 0 };
  const appSettings = useDeckStore((state) => state.appSettings);
  const resetPaneTokens = useDeckStore((state) => state.resetPaneTokens);

  const modelSetting = appSettings.find((s) => s.key === 'agent.model')?.value as string || 'claude-3-5-sonnet';
  const customInputSetting = appSettings.find((s) => s.key === 'agent.customInputPrice')?.value;
  const customOutputSetting = appSettings.find((s) => s.key === 'agent.customOutputPrice')?.value;

  let modelLabel = 'Claude 3.5 Sonnet';
  let inputPrice = 3.0;
  let outputPrice = 15.0;

  if (modelSetting === 'gpt-4o') {
    modelLabel = 'GPT-4o';
    inputPrice = 2.5;
    outputPrice = 10.0;
  } else if (modelSetting === 'claude-3-opus') {
    modelLabel = 'Claude 3 Opus';
    inputPrice = 15.0;
    outputPrice = 75.0;
  } else if (modelSetting === '9router') {
    modelLabel = '9Router';
    inputPrice = 0.0;
    outputPrice = 0.0;
  } else if (modelSetting === 'custom') {
    modelLabel = 'Custom Pricing';
    inputPrice = typeof customInputSetting === 'number' ? customInputSetting : 3.0;
    outputPrice = typeof customOutputSetting === 'number' ? customOutputSetting : 15.0;
  }

  const inputTokens = Math.ceil(paneTokens.inputChars / 4);
  const outputTokens = Math.ceil(paneTokens.outputChars / 4);
  const totalTokens = inputTokens + outputTokens;
  const cost = (inputTokens * inputPrice + outputTokens * outputPrice) / 1000000;

  const formatTokens = (t: number) => {
    if (t >= 1000) {
      return `${(t / 1000).toFixed(1)}k`;
    }
    return t.toString();
  };

  const activeRun = agentRuns.find(
    (run) => run.terminalSessionId === pane.id && (run.status === 'running' || run.status === 'paused')
  );

  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const nestedAgentButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!showAgentMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current && 
        !menuRef.current.contains(target) &&
        (!nestedAgentButtonRef.current || !nestedAgentButtonRef.current.contains(target))
      ) {
        setShowAgentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showAgentMenu]);

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!showMoreMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedInsideNested = menuRef.current && menuRef.current.contains(target);
      if (
        moreMenuRef.current && 
        !moreMenuRef.current.contains(target) &&
        !clickedInsideNested
      ) {
        setShowMoreMenu(false);
        setShowAgentMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showMoreMenu]);

  // Compact mode state and ResizeObserver Ref
  const [toolbarWidth, setTopbarWidth] = useState(500);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = toolbarRef.current;
    if (!node) return;

    const targetToObserve = node.parentElement || node;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTopbarWidth(entry.contentRect.width);
      }
    });
    observer.observe(targetToObserve);

    return () => {
      observer.disconnect();
    };
  }, []);

  const isCompact = toolbarWidth < 420;

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const isMaximized = Boolean(
    activeWorkspace?.savedLayout && activeWorkspace.layout?.type === 'pane' && activeWorkspace.layout.paneId === pane.id
  );

  const rename = () => {
    onRenameTrigger();
  };

  const restart = () => {
    // TerminalPane owns the real xterm size + buffer clear + smooth overlay
    publishTerminalRestart(pane.id);
  };

  const clear = () => {
    void window.agentDeck.terminalClearLog(pane.id);
    publishTerminalClear(pane.id);
  };

  const isRestored = pane.processStatus === 'restored';

  return (
    <div ref={toolbarRef} className="pane-toolbar">
      <div 
        className="token-estimator-badge"
        onClick={() => {
          if (window.confirm('Reset token & cost counter for this pane?')) {
            resetPaneTokens(pane.id);
          }
        }}
        title={`Model: ${modelLabel}\nInput: ${paneTokens.inputChars} chars (~${inputTokens} tokens) @ $${inputPrice}/M\nOutput: ${paneTokens.outputChars} chars (~${outputTokens} tokens) @ $${outputPrice}/M\nClick to reset counter.`}
      >
        <span className="dot" />
        {formatTokens(totalTokens)} tkn {!isCompact && `($${cost.toFixed(3)})`}
      </div>

      {!isCompact ? (
        <>
          <div ref={menuRef} className="agent-menu-wrapper">
            <button onClick={() => setShowAgentMenu(!showAgentMenu)} title="Run agent in this pane" style={{ color: '#c084fc' }}>
              <SparkleIcon />
            </button>
            {showAgentMenu && (
              <div className="agent-dropdown-menu">
                {agentProfiles.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      void runAgentInPane(agent.id, pane.id);
                      setShowAgentMenu(false);
                    }}
                  >
                    {agent.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {activeRun && (
            <button
              onClick={() => {
                if (activeRun.status === 'running') {
                  pauseAgentRun(activeRun.id);
                } else {
                  resumeAgentRun(activeRun.id);
                }
              }}
              title={activeRun.status === 'running' ? 'Pause Agent' : 'Resume Agent'}
            >
              {activeRun.status === 'running' ? <PauseIcon /> : <PlayIcon />}
            </button>
          )}
          <button onClick={() => splitPane(pane.id, 'vertical')} title="Split vertically" style={{ color: '#a1a1aa' }}>
            <SplitVIcon />
          </button>
          <button onClick={() => splitPane(pane.id, 'horizontal')} title="Split horizontally" style={{ color: '#a1a1aa' }}>
            <SplitHIcon />
          </button>
          <button 
            onClick={(e) => {
              if (e.shiftKey) {
                window.dispatchEvent(
                  new CustomEvent('agentdeck:set-composer-all', { detail: { toggle: true } })
                );
              } else {
                onToggleComposer();
              }
            }} 
            title={isComposerVisible ? "Hide command composer (Shift+Click for ALL panes)" : "Show command composer (Shift+Click for ALL panes)"}
            style={{ color: '#38bdf8' }}
          >
            <ComposerIcon size={15} />
          </button>

          {/* 3-dots more menu */}
          <div ref={moreMenuRef} className="more-menu-wrapper" style={{ position: 'relative', display: 'inline-flex' }}>
            <button onClick={() => setShowMoreMenu(!showMoreMenu)} title="More actions">
              <MoreIcon />
            </button>
            {showMoreMenu && (
              <div className="pane-more-dropdown-menu">
                <button
                  type="button"
                  className={`pane-more-item${isComposerVisible ? ' is-composer-on' : ''}`}
                  onClick={() => {
                    onToggleComposer();
                    setShowMoreMenu(false);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)';
                    e.currentTarget.style.color = '#7dd3fc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#e4e4e7';
                  }}
                >
                  <span style={{ color: '#38bdf8', display: 'inline-flex', alignItems: 'center' }}>
                    <ComposerIcon size={14} />
                  </span>
                  <span>{isComposerVisible ? 'Hide composer (This pane)' : 'Show composer (This pane)'}</span>
                </button>
                <button
                  type="button"
                  className="pane-more-item"
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('agentdeck:set-composer-all', { detail: { toggle: true } })
                    );
                    setShowMoreMenu(false);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(192, 132, 252, 0.12)';
                    e.currentTarget.style.color = '#e9d5ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#e4e4e7';
                  }}
                >
                  <span style={{ color: '#c084fc', display: 'inline-flex', alignItems: 'center' }}>
                    <ComposerIcon size={14} />
                  </span>
                  <span>Toggle composer (ALL panes)</span>
                </button>
                <button
                  type="button"
                  className="pane-more-item"
                  onClick={() => {
                    rename();
                    setShowMoreMenu(false);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(251, 191, 36, 0.12)';
                    e.currentTarget.style.color = '#fde68a';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#e4e4e7';
                  }}
                >
                  <span style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center' }}>
                    <RenameIcon />
                  </span>
                  <span>Rename session</span>
                </button>
                <button
                  type="button"
                  className="pane-more-item"
                  onClick={() => {
                    clear();
                    setShowMoreMenu(false);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(96, 165, 250, 0.12)';
                    e.currentTarget.style.color = '#bfdbfe';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#e4e4e7';
                  }}
                >
                  <span style={{ color: '#60a5fa', display: 'inline-flex', alignItems: 'center' }}>
                    <ClearIcon />
                  </span>
                  <span>Clear terminal</span>
                </button>
                <button
                  type="button"
                  className="pane-more-item"
                  onClick={() => {
                    restart();
                    setShowMoreMenu(false);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(52, 211, 153, 0.12)';
                    e.currentTarget.style.color = '#a7f3d0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#e4e4e7';
                  }}
                >
                  <span style={{ color: '#34d399', display: 'inline-flex', alignItems: 'center' }}>
                    {isRestored ? <PlayIcon /> : <RestartIcon />}
                  </span>
                  <span>{isRestored ? 'Start session' : 'Restart session'}</span>
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Compact Mode: Collapse buttons into More action menu (solid crisp surface) */
        <div ref={moreMenuRef} className="more-menu-wrapper" style={{ position: 'relative', display: 'inline-flex' }}>
          <button onClick={() => setShowMoreMenu(!showMoreMenu)} title="More actions">
            <MoreIcon />
          </button>
          {showMoreMenu && (
            <div className="pane-more-dropdown-menu">
              {/* 1. Run Agent (compact mode) */}
              <div ref={menuRef} className="pane-more-submenu-anchor">
                <button
                  type="button"
                  ref={nestedAgentButtonRef}
                  className={`pane-more-item is-accent${showAgentMenu ? ' is-open' : ''}`}
                  onClick={() => setShowAgentMenu(!showAgentMenu)}
                >
                  <SparkleIcon />
                  Run Agent
                </button>
                {showAgentMenu && (
                  <div className="pane-more-submenu agent-dropdown-menu">
                    {agentProfiles.map((agent) => (
                      <button
                        type="button"
                        key={agent.id}
                        onClick={() => {
                          void runAgentInPane(agent.id, pane.id);
                          setShowAgentMenu(false);
                          setShowMoreMenu(false);
                        }}
                      >
                        {agent.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Run controls */}
              {activeRun && (
                <button
                  type="button"
                  className="pane-more-item"
                  onClick={() => {
                    if (activeRun.status === 'running') {
                      pauseAgentRun(activeRun.id);
                    } else {
                      resumeAgentRun(activeRun.id);
                    }
                    setShowMoreMenu(false);
                  }}
                >
                  {activeRun.status === 'running' ? <PauseIcon /> : <PlayIcon />}
                  {activeRun.status === 'running' ? 'Pause agent' : 'Resume agent'}
                </button>
              )}

              <button
                type="button"
                className="pane-more-item"
                onClick={() => {
                  splitPane(pane.id, 'vertical');
                  setShowMoreMenu(false);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = '#f4f4f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#e4e4e7';
                }}
              >
                <span style={{ color: '#a1a1aa', display: 'inline-flex', alignItems: 'center' }}>
                  <SplitVIcon />
                </span>
                <span>Split vertically</span>
              </button>

              <button
                type="button"
                className="pane-more-item"
                onClick={() => {
                  splitPane(pane.id, 'horizontal');
                  setShowMoreMenu(false);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.color = '#f4f4f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#e4e4e7';
                }}
              >
                <span style={{ color: '#a1a1aa', display: 'inline-flex', alignItems: 'center' }}>
                  <SplitHIcon />
                </span>
                <span>Split horizontally</span>
              </button>

              <button
                type="button"
                className={`pane-more-item${isComposerVisible ? ' is-composer-on' : ''}`}
                onClick={() => {
                  onToggleComposer();
                  setShowMoreMenu(false);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(56, 189, 248, 0.12)';
                  e.currentTarget.style.color = '#7dd3fc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#e4e4e7';
                }}
              >
                <span style={{ color: '#38bdf8', display: 'inline-flex', alignItems: 'center' }}>
                  <ComposerIcon size={14} />
                </span>
                <span>{isComposerVisible ? 'Hide composer (This pane)' : 'Show composer (This pane)'}</span>
              </button>

              <button
                type="button"
                className="pane-more-item"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('agentdeck:set-composer-all', { detail: { toggle: true } })
                  );
                  setShowMoreMenu(false);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(192, 132, 252, 0.12)';
                  e.currentTarget.style.color = '#e9d5ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#e4e4e7';
                }}
              >
                <span style={{ color: '#c084fc', display: 'inline-flex', alignItems: 'center' }}>
                  <ComposerIcon size={14} />
                </span>
                <span>Toggle composer (ALL panes)</span>
              </button>

              <button
                type="button"
                className="pane-more-item"
                onClick={() => {
                  rename();
                  setShowMoreMenu(false);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(251, 191, 36, 0.12)';
                  e.currentTarget.style.color = '#fde68a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#e4e4e7';
                }}
              >
                <span style={{ color: '#fbbf24', display: 'inline-flex', alignItems: 'center' }}>
                  <RenameIcon />
                </span>
                <span>Rename session</span>
              </button>

              <button
                type="button"
                className="pane-more-item"
                onClick={() => {
                  clear();
                  setShowMoreMenu(false);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(96, 165, 250, 0.12)';
                  e.currentTarget.style.color = '#bfdbfe';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#e4e4e7';
                }}
              >
                <span style={{ color: '#60a5fa', display: 'inline-flex', alignItems: 'center' }}>
                  <ClearIcon />
                </span>
                <span>Clear terminal</span>
              </button>

              <button
                type="button"
                className="pane-more-item"
                onClick={() => {
                  restart();
                  setShowMoreMenu(false);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(52, 211, 153, 0.12)';
                  e.currentTarget.style.color = '#a7f3d0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#e4e4e7';
                }}
              >
                <span style={{ color: '#34d399', display: 'inline-flex', alignItems: 'center' }}>
                  {isRestored ? <PlayIcon /> : <RestartIcon />}
                </span>
                <span>{isRestored ? 'Start session' : 'Restart session'}</span>
              </button>

              <button
                type="button"
                className="pane-more-item"
                onClick={() => {
                  maximizePane(pane.id);
                  setShowMoreMenu(false);
                }}
              >
                <MaximizeIcon maximized={isMaximized} />
                {isMaximized ? 'Restore layout' : 'Maximize pane'}
              </button>

              <button
                type="button"
                className="pane-more-item is-danger"
                onClick={() => {
                  closePane(pane.id);
                  setShowMoreMenu(false);
                }}
              >
                <CloseIcon />
                Close pane
              </button>
            </div>
          )}
        </div>
      )}

      {!isCompact && (
        <>
          <button onClick={() => maximizePane(pane.id)} title={isMaximized ? 'Restore layout' : 'Maximize pane'} style={{ color: '#2dd4bf' }}>
            <MaximizeIcon maximized={isMaximized} />
          </button>
          <button className="danger" onClick={() => closePane(pane.id)} title="Close pane" style={{ color: '#f87171' }}>
            <CloseIcon />
          </button>
        </>
      )}
    </div>
  );
}

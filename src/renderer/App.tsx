import { useEffect, useState, useRef } from 'react';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';
import { TerminalGrid } from './components/TerminalGrid';
import { RightPanel } from './components/RightPanel';
import { CommandPalette, type CommandPaletteCommand } from './components/CommandPalette';
import { FigmaImportModal } from './components/FigmaImportModal';
import { SettingsModal } from './components/SettingsModal';
import { AppTooltip } from './components/AppTooltip';
import { useDeckStore } from './store/deckStore';
import { clearAllTerminals, publishTerminalClear } from './utils/terminalBus';
import type { FigmaPluginSelectionPayload } from '../shared/types';

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

export function App() {
  const hydrate = useDeckStore((state) => state.hydrate);
  const loaded = useDeckStore((state) => state.loaded);
  const loadError = useDeckStore((state) => state.loadError);
  const workspaces = useDeckStore((state) => state.workspaces);
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const activePaneId = useDeckStore((state) => state.activePaneId);
  const tasks = useDeckStore((state) => state.tasks);
  const appSettings = useDeckStore((state) => state.appSettings);
  const createWorkspace = useDeckStore((state) => state.createWorkspace);
  const createPane = useDeckStore((state) => state.createPane);
  const splitPane = useDeckStore((state) => state.splitPane);
  const maximizePane = useDeckStore((state) => state.maximizePane);
  const closeActivePane = useDeckStore((state) => state.closeActivePane);
  const renameActivePane = useDeckStore((state) => state.renameActivePane);
  const focusNextPane = useDeckStore((state) => state.focusNextPane);
  const focusPreviousPane = useDeckStore((state) => state.focusPreviousPane);
  const focusPaneInDirection = useDeckStore((state) => state.focusPaneInDirection);
  const setRightTab = useDeckStore((state) => state.setRightTab);
  const rightTab = useDeckStore((state) => state.rightTab);
  const setAppSetting = useDeckStore((state) => state.setAppSetting);
  const showFigmaImportModal = useDeckStore((state) => state.showFigmaImportModal);
  const setShowFigmaImportModal = useDeckStore((state) => state.setShowFigmaImportModal);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [version, setVersion] = useState('0.1.0');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [autoSelectionPayload, setAutoSelectionPayload] = useState<FigmaPluginSelectionPayload | null>(null);
  const [toastMinimized, setToastMinimized] = useState(false);
  const [autoImportDropdownOpen, setAutoImportDropdownOpen] = useState(false);
  const autoImportDropdownRef = useRef<HTMLDivElement>(null);

  // Watch rightTab to launch tabbed settings modal instead of rendering inside narrow panel
  useEffect(() => {
    if (rightTab === 'settings') {
      setShowSettingsModal(true);
      setRightTab('tasks');
    }
  }, [rightTab, setRightTab]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (autoImportDropdownRef.current && !autoImportDropdownRef.current.contains(event.target as Node)) {
        setAutoImportDropdownOpen(false);
      }
    }
    if (autoImportDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [autoImportDropdownOpen]);

  const leftCollapsed = appSettings.find((setting) => setting.key === 'ui.leftCollapsed')?.value === true;
  const rightCollapsed = appSettings.find((setting) => setting.key === 'ui.rightCollapsed')?.value === true;

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const activePane = activeWorkspace && activePaneId ? activeWorkspace.panes[activePaneId] : null;
  const openTasks = tasks.filter((task) => task.status !== 'done').length;
  const hasActivePane = Boolean(activePaneId);
  const commands: CommandPaletteCommand[] = [
    {
      id: 'new-terminal',
      label: 'New terminal pane',
      shortcut: 'Ctrl+T',
      disabled: !activeWorkspace,
      run: () => createPane()
    },
    {
      id: 'split-vertical',
      label: 'Split active pane vertically',
      shortcut: 'Ctrl+Shift+V',
      disabled: !hasActivePane,
      run: () => activePaneId && splitPane(activePaneId, 'vertical')
    },
    {
      id: 'split-horizontal',
      label: 'Split active pane horizontally',
      shortcut: 'Ctrl+Shift+H',
      disabled: !hasActivePane,
      run: () => activePaneId && splitPane(activePaneId, 'horizontal')
    },
    {
      id: 'close-pane',
      label: 'Close active pane',
      shortcut: 'Ctrl+W',
      disabled: !hasActivePane,
      run: closeActivePane
    },
    {
      id: 'focus-next',
      label: 'Focus next pane',
      shortcut: 'Ctrl+Tab',
      disabled: !hasActivePane,
      run: focusNextPane
    },
    {
      id: 'focus-previous',
      label: 'Focus previous pane',
      shortcut: 'Ctrl+Shift+Tab',
      disabled: !hasActivePane,
      run: focusPreviousPane
    },
    {
      id: 'rename-pane',
      label: 'Rename session',
      shortcut: 'Ctrl+R',
      disabled: !hasActivePane,
      run: renameActivePane
    },
    {
      id: 'maximize-pane',
      label: 'Maximize or restore active pane',
      shortcut: 'Ctrl+M',
      disabled: !hasActivePane,
      run: () => activePaneId && maximizePane(activePaneId)
    },
    {
      id: 'toggle-sidebar',
      label: leftCollapsed ? 'Show workspace sidebar' : 'Hide workspace sidebar',
      shortcut: 'Ctrl+B',
      run: () => setAppSetting('ui.leftCollapsed', !leftCollapsed)
    },
    {
      id: 'toggle-inspector',
      label: rightCollapsed ? 'Show inspector panel' : 'Hide inspector panel',
      shortcut: 'Ctrl+I',
      run: () => setAppSetting('ui.rightCollapsed', !rightCollapsed)
    },
    {
      id: 'toggle-composer-pane',
      label: 'Toggle command composer (Active pane)',
      shortcut: 'Ctrl+Alt+I',
      disabled: !hasActivePane,
      run: () => {
        if (activePaneId) {
          const btn = document.querySelector(`[data-pane-id="${activePaneId}"] .pane-toolbar button[title*="composer"]`) as HTMLButtonElement | null;
          btn?.click();
        }
      }
    },
    {
      id: 'toggle-composer-all',
      label: 'Toggle command composer (ALL panes)',
      shortcut: 'Shift+Click',
      run: () => {
        window.dispatchEvent(
          new CustomEvent('agentdeck:set-composer-all', { detail: { toggle: true } })
        );
      }
    },
    {
      id: 'clear-pane-terminal',
      label: 'Clear active terminal pane',
      disabled: !hasActivePane,
      run: () => {
        if (activePaneId) {
          void window.agentDeck.terminalClearLog(activePaneId);
          publishTerminalClear(activePaneId);
        }
      }
    },
    {
      id: 'clear-all-terminals',
      label: 'Clear ALL terminal panes',
      run: () => {
        clearAllTerminals();
      }
    }
  ];

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    return window.agentDeck.onStateReload(() => {
      const activeEl = document.activeElement as HTMLElement | null;
      void hydrate().then(() => {
        if (activeEl && typeof activeEl.focus === 'function' && document.body.contains(activeEl)) {
          requestAnimationFrame(() => activeEl.focus());
        }
      });
    });
  }, [hydrate]);

  // Mobile Companion → desktop actions
  useEffect(() => {
    if (!window.agentDeck.onCompanionAction) return;
    return window.agentDeck.onCompanionAction((action) => {
      const store = useDeckStore.getState();
      if (action.type === 'run-task' && action.taskId) {
        void store.runTaskInPane(action.taskId);
        return;
      }
      if (action.type === 'run-agent' && action.agentId) {
        void store.runAgentInPane(action.agentId, action.paneId ?? null);
        return;
      }
      if (action.type === 'select-pane' && action.paneId) {
        store.selectPane(action.paneId);
        return;
      }
      if (action.type === 'select-workspace') {
        const wid = (action as { workspaceId?: string }).workspaceId;
        if (wid) store.selectWorkspace(wid);
        return;
      }
      if (action.type === 'create-pane') {
        const title = (action as { title?: string }).title;
        store.createPane(title);
        return;
      }
      if (action.type === 'run-project') {
        const wid = (action as { workspaceId?: string }).workspaceId;
        const configId = (action as { configId?: string }).configId;
        if (wid && configId) void store.runProject(wid, configId);
        return;
      }
      if (action.type === 'stop-project') {
        const wid = (action as { workspaceId?: string }).workspaceId;
        if (wid) void store.stopProject(wid);
        return;
      }
      if (action.type === 'write-prompt' && action.paneId && action.text != null) {
        window.agentDeck.terminalWrite(action.paneId, action.text);
      }
    });
  }, []);

  const setFigmaImportSelectionPayload = useDeckStore((state) => state.setFigmaImportSelectionPayload);
  const latestReceivedSelection = useDeckStore((state) => state.latestReceivedSelection);
  const autoImportFigma = useDeckStore((state) => state.autoImportFigma);
  const autoAttachFigma = useDeckStore((state) => state.autoAttachFigma);
  const autoImportMode = useDeckStore((state) => state.autoImportMode);
  const setAutoImportFigma = useDeckStore((state) => state.setAutoImportFigma);
  const setAutoAttachFigma = useDeckStore((state) => state.setAutoAttachFigma);
  const setAutoImportMode = useDeckStore((state) => state.setAutoImportMode);
  const importFigmaSelection = useDeckStore((state) => state.importFigmaSelection);
  const setLatestReceivedSelection = useDeckStore((state) => state.setLatestReceivedSelection);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastImportTimeRef = useRef<{ [nodeId: string]: number }>({});

  useEffect(() => {
    return window.agentDeck.onFigmaPluginSelection((payload) => {
      console.log('[APP] Received Figma Plugin selection payload:', payload);
      if (payload.trigger === 'auto') {
        // Clear any active debounce timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        // Show the toast with the received payload
        setAutoSelectionPayload(payload);
        setToastMinimized(false);

        // Start debounce of 700ms
        debounceTimerRef.current = setTimeout(() => {
          const now = Date.now();
          const lastTime = lastImportTimeRef.current[payload.nodeId] || 0;

          // Duplicate protection: 3.0s guard
          if (now - lastTime < 3000) {
            console.log(`[APP] Skipping duplicate selection for node ${payload.nodeId} (last imported ${now - lastTime}ms ago)`);
            setLatestReceivedSelection({
              id: `figma-sel-skipped-${Date.now()}`,
              source: "figma-plugin",
              trigger: "auto",
              fileKey: payload.fileKey,
              fileName: payload.fileName,
              nodeId: payload.nodeId,
              nodeName: payload.nodeName,
              nodeType: payload.nodeType,
              width: payload.width,
              height: payload.height,
              selectionUrl: payload.selectionUrl,
              receivedAt: new Date().toISOString(),
              status: "skipped_duplicate"
            });
            return;
          }

          // Record import time
          lastImportTimeRef.current[payload.nodeId] = now;

          // If autoImportFigma is ON, trigger background import
          if (useDeckStore.getState().autoImportFigma) {
            void importFigmaSelection(payload, true);
          } else {
            // Otherwise, put in 'received' state
            setLatestReceivedSelection({
              id: `figma-sel-${Date.now()}`,
              source: "figma-plugin",
              trigger: "auto",
              fileKey: payload.fileKey,
              fileName: payload.fileName,
              nodeId: payload.nodeId,
              nodeName: payload.nodeName,
              nodeType: payload.nodeType,
              width: payload.width,
              height: payload.height,
              selectionUrl: payload.selectionUrl,
              receivedAt: new Date().toISOString(),
              status: "received"
            });
          }
        }, 700);

      } else {
        // Manual triggers: immediately populate store and open import modal
        setAutoSelectionPayload(null); // Dismiss any auto toast
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        setFigmaImportSelectionPayload(payload);
        setShowFigmaImportModal(true);
      }
    });
  }, [setShowFigmaImportModal, setFigmaImportSelectionPayload, importFigmaSelection, setLatestReceivedSelection]);

  const handleAttachSelection = () => {
    if (!latestReceivedSelection || !latestReceivedSelection.importedContext) return;
    // Dispatch chip attachment event — TerminalPane.tsx will handle it by
    // creating a small chip and storing the full context in component state.
    // The full context is only appended to the agent payload on Send.
    window.dispatchEvent(
      new CustomEvent('agentdeck:attach-figma-chip', {
        detail: {
          paneId: activePaneId || undefined
        }
      })
    );
    // Status will be set to 'attached' by the chip event handler in TerminalPane.tsx.
    // We only update here as a fallback in case no pane is listening.
    setTimeout(() => {
      const current = useDeckStore.getState().latestReceivedSelection;
      if (current && current.status !== 'attached') {
        setLatestReceivedSelection({ ...current, status: 'attached' });
      }
    }, 100);
  };

  const getStatusLabel = () => {
    if (!latestReceivedSelection) return 'Debouncing selection...';
    switch (latestReceivedSelection.status) {
      case 'importing': return 'Importing context...';
      case 'imported': return 'Imported';
      case 'attached': return 'Attached';
      case 'failed': return 'Import failed';
      case 'skipped_duplicate': return 'Skipped duplicate';
      default: return 'Received selection';
    }
  };

  const getStatusColor = () => {
    if (!latestReceivedSelection) return '#fbbf24';
    switch (latestReceivedSelection.status) {
      case 'importing': return '#38bdf8';
      case 'imported': return '#10b981';
      case 'attached': return '#8b5cf6';
      case 'failed': return '#ef4444';
      case 'skipped_duplicate': return '#71717a';
      default: return '#fbbf24';
    }
  };


  useEffect(() => {
    void window.agentDeck.getVersion().then((result) => {
      if (result.ok) {
        setVersion(result.data);
      }
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (paletteOpen && event.key === 'Escape') {
        event.preventDefault();
        setPaletteOpen(false);
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTerminalFocused = Boolean(
        target && (
          target.closest('.xterm, .terminal-host, .terminal-pane, .composer-textarea, .terminal-composer-field') ||
          target.classList?.contains('xterm-helper-textarea') ||
          target.classList?.contains('composer-textarea')
        )
      );
      const isInputFocused = Boolean(
        target &&
          !isTerminalFocused &&
          (target.closest('input, textarea, select, [contenteditable="true"]') ||
            target.isContentEditable ||
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT')
      );

      // When focused in terminal or form inputs, Ctrl+O should NEVER open the folder dialog
      if (event.ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'o') {
        if (isTerminalFocused || isInputFocused) {
          return;
        }
      }

      // Let form fields receive typing
      if (isInputFocused) {
        return;
      }

      // Check Alt + Arrow keys for directional pane focusing (unless inside terminal/inputs)
      if (event.altKey && activePaneId && !isTerminalFocused) {
        const key = event.key;
        if (key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
          event.preventDefault();
          const dir = key.slice(5).toLowerCase() as 'up' | 'down' | 'left' | 'right';
          focusPaneInDirection(dir);
          return;
        }
      }

      if (!event.ctrlKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (event.shiftKey && key === 'p') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }

      if (key === 'b') {
        event.preventDefault();
        setAppSetting('ui.leftCollapsed', !leftCollapsed);
        return;
      }

      if (key === 'i') {
        event.preventDefault();
        setAppSetting('ui.rightCollapsed', !rightCollapsed);
        return;
      }

      if (key === 'o') {
        event.preventDefault();
        void createWorkspace();
        return;
      }

      if (key === 't') {
        event.preventDefault();
        createPane();
        return;
      }

      if (event.shiftKey && key === 'v' && activePaneId) {
        event.preventDefault();
        splitPane(activePaneId, 'vertical');
        return;
      }

      if (event.shiftKey && key === 'h' && activePaneId) {
        event.preventDefault();
        splitPane(activePaneId, 'horizontal');
        return;
      }

      if (key === 'w' && activePaneId) {
        event.preventDefault();
        closeActivePane();
        return;
      }

      if (key === 'tab' && activePaneId) {
        event.preventDefault();
        if (event.shiftKey) {
          focusPreviousPane();
        } else {
          focusNextPane();
        }
        return;
      }

      if (key === 'r' && activePaneId) {
        event.preventDefault();
        renameActivePane();
        return;
      }

      if (key === 'm' && activePaneId) {
        event.preventDefault();
        maximizePane(activePaneId);
        return;
      }

      const tabByKey = {
        '1': 'tasks',
        '2': 'agents',
        '3': 'logs',
        '4': 'review',
        '5': 'settings'
      } as const;
      const tab = tabByKey[event.key as keyof typeof tabByKey];
      if (tab) {
        event.preventDefault();
        setRightTab(tab);
        setAppSetting('ui.rightCollapsed', false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activePaneId,
    closeActivePane,
    createPane,
    createWorkspace,
    focusNextPane,
    focusPreviousPane,
    focusPaneInDirection,
    leftCollapsed,
    maximizePane,
    paletteOpen,
    renameActivePane,
    rightCollapsed,
    setAppSetting,
    setRightTab,
    splitPane
  ]);

  if (!loaded) {
    return <div className="loading-screen">Loading AgentDeck...</div>;
  }

  return (
    <main className={`app-shell ${leftCollapsed ? 'left-collapsed' : ''} ${rightCollapsed ? 'right-collapsed' : ''}`}>
      {loadError ? <div className="app-banner">{loadError}</div> : null}
      <header className="title-bar">
        <div>
          <strong>AgentDeck</strong>
          <span>v{version}</span>
        </div>
        <div className="title-bar-actions">
          <button onClick={() => setAppSetting('ui.leftCollapsed', !leftCollapsed)}>
            {leftCollapsed ? 'Show workspaces' : 'Hide workspaces'}
          </button>
          <button onClick={() => setAppSetting('ui.rightCollapsed', !rightCollapsed)}>
            {rightCollapsed ? 'Show inspector' : 'Hide inspector'}
          </button>
        </div>
      </header>
      <WorkspaceSidebar collapsed={leftCollapsed} />
      <TerminalGrid />
      <RightPanel collapsed={rightCollapsed} />
      {paletteOpen ? <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} /> : null}
      {showFigmaImportModal && <FigmaImportModal onClose={() => setShowFigmaImportModal(false)} />}
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}
      {autoSelectionPayload && (() => {
        const isDraggable = latestReceivedSelection && (latestReceivedSelection.status === 'imported' || latestReceivedSelection.status === 'attached');
        
        if (toastMinimized) {
          return (
            <div
              draggable={isDraggable ? "true" : "false"}
              onDragStart={(e) => {
                if (!latestReceivedSelection) return;
                const dragPayload = {
                  kind: "agentdeck-context",
                  contextType: "figma-design-context",
                  contextId: latestReceivedSelection.id,
                  nodeName: latestReceivedSelection.nodeName,
                  nodeType: latestReceivedSelection.nodeType,
                  selectionUrl: latestReceivedSelection.selectionUrl
                };
                e.dataTransfer.setData("text/plain", JSON.stringify(dragPayload));
                e.dataTransfer.effectAllowed = "copyMove";
              }}
              onClick={() => setToastMinimized(false)}
              title={latestReceivedSelection ? `Figma Selection: ${autoSelectionPayload.nodeName || 'Layer'} (${getStatusLabel()}) - Click to expand / Drag to Terminal` : 'Figma Selection Received - Click to expand'}
              style={{
                position: 'fixed',
                bottom: '40px',
                right: '24px',
                zIndex: 1000,
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'rgba(20, 20, 24, 0.95)',
                backdropFilter: 'blur(10px)',
                border: `2px solid ${getStatusColor()}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                cursor: isDraggable ? 'grab' : 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: 'slideIn 0.25s ease-out',
                color: '#38bdf8'
              }}
            >
              {/* Style snippet for keyframes */}
              <style>{`
                @keyframes slideIn {
                  from { transform: translateY(20px); opacity: 0; }
                  to { transform: translateY(0); opacity: 1; }
                }
              `}</style>

              {/* Figma SVG Icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
                <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" />
                <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z" />
                <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 0 1-3.5 3.5H8.5A3.5 3.5 0 0 1 5 19.5z" />
                <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z" />
              </svg>

              {/* Tiny pulsing status badge inside minimized state */}
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: getStatusColor(),
                boxShadow: `0 0 8px ${getStatusColor()}`,
                display: 'block',
                animation: latestReceivedSelection?.status === 'importing' ? 'pulse 1s infinite alternate' : 'none'
              }} />
            </div>
          );
        }

        return (
          <div
            draggable={isDraggable ? "true" : "false"}
            onDragStart={(e) => {
              if (!latestReceivedSelection) return;
              const dragPayload = {
                kind: "agentdeck-context",
                contextType: "figma-design-context",
                contextId: latestReceivedSelection.id,
                nodeName: latestReceivedSelection.nodeName,
                nodeType: latestReceivedSelection.nodeType,
                selectionUrl: latestReceivedSelection.selectionUrl
              };
              e.dataTransfer.setData("text/plain", JSON.stringify(dragPayload));
              e.dataTransfer.effectAllowed = "copyMove";
            }}
            style={{
              position: 'fixed',
              bottom: '40px',
              right: '24px',
              zIndex: 1000,
              background: 'rgba(20, 20, 24, 0.95)',
              backdropFilter: 'blur(10px)',
              border: isDraggable ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '8px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: isDraggable ? '0 12px 40px rgba(56, 189, 248, 0.15), 0 12px 40px rgba(0, 0, 0, 0.6)' : '0 12px 40px rgba(0, 0, 0, 0.6)',
              animation: 'slideIn 0.25s ease-out',
              color: '#f4f4f5',
              width: '320px',
              cursor: isDraggable ? 'grab' : 'default',
              userSelect: 'none'
            }}
          >
            {/* Style snippet for keyframes */}
            <style>{`
              @keyframes slideIn {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
              }
            `}</style>

            {/* Row 1: Icon, Details, and Close/Minimize Buttons */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {isDraggable && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', cursor: 'grab', color: '#38bdf8', marginRight: '2px' }} title="Drag selection directly into a Terminal Pane!">
                    <div style={{ width: '8px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
                    <div style={{ width: '8px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
                    <div style={{ width: '8px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(56, 189, 248, 0.1)',
                  borderRadius: '6px',
                  padding: '6px',
                  color: '#38bdf8'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z" />
                    <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z" />
                    <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z" />
                    <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 0 1-3.5 3.5H8.5A3.5 3.5 0 0 1 5 19.5z" />
                    <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                  <span style={{ fontSize: '10px', fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Figma Plugin Selection
                  </span>
                  <strong style={{ fontSize: '12px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                    {autoSelectionPayload.nodeName || 'Unnamed Layer'}
                  </strong>
                  <span style={{ fontSize: '9px', color: '#71717a' }}>
                    {autoSelectionPayload.nodeType || 'Layer'} • {autoSelectionPayload.width}px × {autoSelectionPayload.height}px
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setToastMinimized(true);
                  }}
                  style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                  title="Minimize"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/></svg>
                </button>
                <button
                  onClick={() => {
                    setAutoSelectionPayload(null);
                    setLatestReceivedSelection(null);
                  }}
                  style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                  title="Dismiss"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
            </div>

            {/* Row 2: Status Pill & Message */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '9px',
                fontWeight: 600,
                background: `rgba(${getStatusColor() === '#10b981' ? '16, 185, 129' : getStatusColor() === '#38bdf8' ? '56, 189, 248' : getStatusColor() === '#8b5cf6' ? '139, 92, 246' : getStatusColor() === '#ef4444' ? '239, 68, 68' : '251, 191, 36'}, 0.15)`,
                color: getStatusColor()
              }}>
                <span style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: getStatusColor(),
                  display: 'inline-block',
                  animation: latestReceivedSelection?.status === 'importing' ? 'pulse 1s infinite alternate' : 'none'
                }} />
                {getStatusLabel().toUpperCase()}
              </span>
              {latestReceivedSelection?.status === 'failed' && (
                <span style={{ fontSize: '9px', color: '#ef4444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={latestReceivedSelection.error}>
                  {latestReceivedSelection.error}
                </span>
              )}
              {latestReceivedSelection?.status === 'skipped_duplicate' && (
                <span style={{ fontSize: '9px', color: '#a1a1aa' }}>
                  Duplicate guard triggered
                </span>
              )}
            </div>

            <style>{`
              @keyframes pulse {
                from { opacity: 0.3; }
                to { opacity: 1; }
              }
            `}</style>

            {/* Row 3: Config Controls Container */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '6px',
              padding: '8px 10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#a1a1aa', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={autoImportFigma}
                    onChange={(e) => {
                      setAutoImportFigma(e.target.checked);
                      if (e.target.checked && autoSelectionPayload && (!latestReceivedSelection || latestReceivedSelection.status === 'received' || latestReceivedSelection.status === 'failed')) {
                        void importFigmaSelection(autoSelectionPayload, true);
                      }
                    }}
                    style={{ accentColor: '#38bdf8', cursor: 'pointer', margin: 0 }}
                  />
                  Auto Import
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#a1a1aa', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={autoAttachFigma}
                    onChange={(e) => {
                      setAutoAttachFigma(e.target.checked);
                    }}
                    style={{ accentColor: '#38bdf8', cursor: 'pointer', margin: 0 }}
                  />
                  Auto Attach
                </label>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px', marginTop: '2px' }}>
                <span style={{ fontSize: '9px', color: '#71717a' }}>Auto Import Mode:</span>
                <div ref={autoImportDropdownRef} style={{ position: 'relative', minWidth: '130px' }}>
                  <button
                    className={`panel-select-trigger ${autoImportDropdownOpen ? 'open' : ''}`}
                    onClick={() => setAutoImportDropdownOpen(!autoImportDropdownOpen)}
                    type="button"
                    style={{
                      width: '100%',
                      padding: '3px 6px',
                      background: '#09090b',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '4px',
                      color: '#a1a1aa',
                      fontSize: '9px',
                      outline: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    gap: '4px'
                    }}
                  >
                    <span className="panel-select-trigger-text" style={{ fontSize: '9px', textTransform: 'none' }}>
                      {autoImportMode === 'get_design_context' ? 'Design context only' : autoImportMode === 'get_svg' ? 'Vector image (SVG)' : 'Raw file fallback'}
                    </span>
                    <ChevronDownIcon size={10} />
                  </button>
 
                  {autoImportDropdownOpen && (
                    <div className="panel-select-dropdown" style={{ left: 0, right: 0, marginTop: '2px', padding: '2px', zIndex: 100 }}>
                      <button
                        className={`panel-select-option ${autoImportMode === 'get_design_context' ? 'active' : ''}`}
                        onClick={() => {
                          setAutoImportMode('get_design_context');
                          setAutoImportDropdownOpen(false);
                        }}
                        type="button"
                        style={{ padding: '4px 6px', fontSize: '9px' }}
                      >
                        <span className="panel-select-option-label" style={{ fontSize: '9px', textTransform: 'none' }}>
                          Design context only
                        </span>
                        {autoImportMode === 'get_design_context' && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                      </button>
                      <button
                        className={`panel-select-option ${autoImportMode === 'get_svg' ? 'active' : ''}`}
                        onClick={() => {
                          setAutoImportMode('get_svg');
                          setAutoImportDropdownOpen(false);
                        }}
                        type="button"
                        style={{ padding: '4px 6px', fontSize: '9px' }}
                      >
                        <span className="panel-select-option-label" style={{ fontSize: '9px', textTransform: 'none' }}>
                          Vector image (SVG)
                        </span>
                        {autoImportMode === 'get_svg' && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                      </button>
                      <button
                        className={`panel-select-option ${autoImportMode === 'get_file' ? 'active' : ''}`}
                        onClick={() => {
                          setAutoImportMode('get_file');
                          setAutoImportDropdownOpen(false);
                        }}
                        type="button"
                        style={{ padding: '4px 6px', fontSize: '9px' }}
                      >
                        <span className="panel-select-option-label" style={{ fontSize: '9px', textTransform: 'none' }}>
                          Raw file fallback
                        </span>
                        {autoImportMode === 'get_file' && <div className="active-dot" style={{ width: '4px', height: '4px' }} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 4: Primary Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              {latestReceivedSelection?.status === 'imported' ? (
                <button
                  type="button"
                  onClick={handleAttachSelection}
                  style={{
                    flex: 1,
                    background: 'rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(139, 92, 246, 0.4)',
                    borderRadius: '6px',
                    color: '#a78bfa',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    outline: 'none'
                  }}
                >
                  Attach to Prompt
                </button>
              ) : (
                <button
                  type="button"
                  disabled={latestReceivedSelection?.status === 'importing' || latestReceivedSelection?.status === 'attached'}
                  onClick={() => importFigmaSelection(autoSelectionPayload, true)}
                  style={{
                    flex: 1,
                    background: latestReceivedSelection?.status === 'attached' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(56, 189, 248, 0.15)',
                    border: latestReceivedSelection?.status === 'attached' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '6px',
                    color: latestReceivedSelection?.status === 'attached' ? '#10b981' : '#38bdf8',
                    padding: '6px 12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: latestReceivedSelection?.status === 'importing' || latestReceivedSelection?.status === 'attached' ? 'default' : 'pointer',
                    opacity: latestReceivedSelection?.status === 'importing' ? 0.6 : 1,
                    transition: 'all 0.15s ease',
                    outline: 'none'
                  }}
                >
                  {latestReceivedSelection?.status === 'attached' ? 'Attached' : latestReceivedSelection?.status === 'importing' ? 'Importing...' : 'Import Context'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setAutoSelectionPayload(null);
                  setLatestReceivedSelection(null);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: '#71717a',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        );
      })()}
      <footer className="status-bar">
        <span>{activeWorkspace ? activeWorkspace.name : 'No workspace'}</span>
        <span>{activePane ? activePane.title : 'No active pane'}</span>
        <span>{openTasks} open tasks</span>
        <span>Local mode</span>
      </footer>
      {/* Global dark tooltips — upgrades native title= across the app */}
      <AppTooltip />
    </main>
  );
}

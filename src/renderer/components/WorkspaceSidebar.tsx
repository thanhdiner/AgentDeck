import { useState, useEffect, useRef } from 'react';
import type { Workspace } from '../../shared/types';
import { useDeckStore } from '../store/deckStore';

function formatRelativeTime(dateString: string | number) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const FolderIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ marginRight: '4px', opacity: 0.6, flexShrink: 0 }}
  >
    <path d="M1.5 3.5v9a1 1 0 001 1h11a1 1 0 001-1v-7a1 1 0 00-1-1H7.5l-2-2h-3a1 1 0 00-1 1z" />
  </svg>
);

const ClockIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ marginRight: '3px', opacity: 0.6, flexShrink: 0 }}
  >
    <circle cx="8" cy="8" r="6" />
    <polyline points="8 4.5 8 8 10.5 9.5" />
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

const PlusIcon = ({ size = 14 }: { size?: number }) => (
  <svg
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
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const WORKSPACE_COLORS = [
  { name: 'blue', value: '#38bdf8' },
  { name: 'green', value: '#34d399' },
  { name: 'yellow', value: '#fbbf24' },
  { name: 'red', value: '#f87171' },
  { name: 'purple', value: '#c084fc' },
  { name: 'orange', value: '#fb923c' },
  { name: 'silver', value: '#a1a1aa' }
];

export function WorkspaceSidebar({ collapsed = false }: { collapsed?: boolean }) {
  const workspaces = useDeckStore((state) => state.workspaces);
  const workspaceTemplates = useDeckStore((state) => state.workspaceTemplates);
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const createWorkspace = useDeckStore((state) => state.createWorkspace);
  const openWorkspace = useDeckStore((state) => state.openWorkspace);
  const renameWorkspace = useDeckStore((state) => state.renameWorkspace);
  const setWorkspaceColor = useDeckStore((state) => state.setWorkspaceColor);
  const setWorkspaceNote = useDeckStore((state) => state.setWorkspaceNote);
  const setWorkspaceRestoreDirectory = useDeckStore((state) => state.setWorkspaceRestoreDirectory);
  const deleteWorkspace = useDeckStore((state) => state.deleteWorkspace);
  const reorderWorkspaces = useDeckStore((state) => state.reorderWorkspaces);
  const moveWorkspace = useDeckStore((state) => state.moveWorkspace);
  const selectWorkspace = useDeckStore((state) => state.selectWorkspace);
  const loadingWorkspace = useDeckStore((state) => state.loadingWorkspace);
  const agentRuns = useDeckStore((state) => state.agentRuns);
  const agentProfiles = useDeckStore((state) => state.agentProfiles);
  const tasks = useDeckStore((state) => state.tasks);
  const [templateId, setTemplateId] = useState('');
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [workspaceEditValue, setWorkspaceEditValue] = useState('');
  const [editingNoteWorkspaceId, setEditingNoteWorkspaceId] = useState<string | null>(null);
  const [noteEditValue, setNoteEditValue] = useState('');
  const [openMenuWorkspaceId, setOpenMenuWorkspaceId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [draggedWorkspaceId, setDraggedWorkspaceId] = useState<string | null>(null);
  const [dragOverWorkspaceId, setDragOverWorkspaceId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuWorkspaceId) return;
    const handleClose = () => {
      setOpenMenuWorkspaceId(null);
      setMenuPosition(null);
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
    };
  }, [openMenuWorkspaceId]);

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

  const selectedTemplateId = templateId || null;
  const selectedTemplate = workspaceTemplates.find((t) => t.id === templateId);
  const selectedTemplateName = selectedTemplate ? selectedTemplate.name : 'Default terminal';

  const addWorkspace = () => {
    void createWorkspace(selectedTemplateId);
  };

  const openExistingWorkspace = () => {
    void openWorkspace(selectedTemplateId);
  };

  const rename = (workspace: Workspace) => {
    setEditingWorkspaceId(workspace.id);
    setWorkspaceEditValue(workspace.name);
  };

  const handleWorkspaceRenameSave = (workspace: Workspace) => {
    const trimmed = workspaceEditValue.trim();
    if (trimmed && trimmed !== workspace.name) {
      renameWorkspace(workspace.id, trimmed);
    }
    setEditingWorkspaceId(null);
  };

  const handleWorkspaceRenameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, workspace: Workspace) => {
    if (e.key === 'Enter') {
      handleWorkspaceRenameSave(workspace);
    } else if (e.key === 'Escape') {
      setEditingWorkspaceId(null);
    }
  };

  const startEditNote = (workspace: Workspace) => {
    setEditingNoteWorkspaceId(workspace.id);
    setNoteEditValue(workspace.note || '');
  };

  const handleWorkspaceNoteSave = (workspace: Workspace) => {
    setWorkspaceNote(workspace.id, noteEditValue.trim() || null);
    setEditingNoteWorkspaceId(null);
  };

  const handleWorkspaceNoteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, workspace: Workspace) => {
    if (e.key === 'Enter') {
      handleWorkspaceNoteSave(workspace);
    } else if (e.key === 'Escape') {
      setEditingNoteWorkspaceId(null);
    }
  };

  const remove = (workspace: Workspace) => {
    setWorkspaceToDelete(workspace);
  };

  return (
    <aside className={`workspace-sidebar ${collapsed ? 'collapsed' : ''}`} aria-hidden={collapsed} style={{ position: 'relative' }}>
      <div className="sidebar-header">
        <h1>Workspaces</h1>
        <button
          type="button"
          className="icon-button"
          onClick={addWorkspace}
          title="Add workspace"
          disabled={loadingWorkspace}
          aria-label="Add workspace"
        >
          <PlusIcon />
        </button>
      </div>

      <div className="workspace-template-picker" ref={dropdownRef} style={{ position: 'relative' }}>
        <label>Template</label>
        <button
          className={`panel-select-trigger ${dropdownOpen ? 'open' : ''}`}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          type="button"
          disabled={loadingWorkspace}
          style={{ width: '100%', outline: 'none' }}
        >
          <span className="panel-select-trigger-label">
            <span className="panel-select-trigger-text">
              {selectedTemplateName}
            </span>
          </span>
          <ChevronDownIcon size={12} />
        </button>

        {dropdownOpen && (
          <div className="panel-select-dropdown" style={{ left: '14px', right: '14px', marginTop: '4px', zIndex: 100 }}>
            <button
              className={`panel-select-option ${templateId === '' ? 'active' : ''}`}
              onClick={() => {
                setTemplateId('');
                setDropdownOpen(false);
              }}
              type="button"
            >
              <span className="panel-select-option-label">
                <span>Default terminal</span>
              </span>
              {templateId === '' && <div className="active-dot" />}
            </button>
            {workspaceTemplates.map((template) => (
              <button
                key={template.id}
                className={`panel-select-option ${templateId === template.id ? 'active' : ''}`}
                onClick={() => {
                  setTemplateId(template.id);
                  setDropdownOpen(false);
                }}
                type="button"
              >
                <span className="panel-select-option-label">
                  <span>{template.name}</span>
                </span>
                {templateId === template.id && <div className="active-dot" />}
              </button>
            ))}
          </div>
        )}
        <div className="workspace-picker-actions">
          <button onClick={addWorkspace} disabled={loadingWorkspace}>Create workspace</button>
          <button onClick={openExistingWorkspace} disabled={loadingWorkspace}>Open folder</button>
        </div>
      </div>

      <div className="workspace-list">
        {workspaces.length === 0 ? (
          <button className="empty-card" onClick={addWorkspace} disabled={loadingWorkspace}>
            Select a local folder to create your first workspace.
          </button>
        ) : null}

        {workspaces.map((workspace, index) => {
          const isActive = workspace.id === activeWorkspaceId;
          const activeColor = workspace.color || '#38bdf8';
          const isPresetSelected = WORKSPACE_COLORS.some(preset => preset.value === workspace.color);
          const isCustomColor = !!workspace.color && !isPresetSelected;
          const isDragging = draggedWorkspaceId === workspace.id;
          const isDragOver = dragOverWorkspaceId === workspace.id && !isDragging;

          const cardStyle = isActive
            ? { borderColor: activeColor, background: `${activeColor}15`, boxShadow: `0 0 10px ${activeColor}33` }
            : { borderColor: `${activeColor}44`, background: '#1c1c1c' };

          return (
            <div 
              key={workspace.id} 
              className={`workspace-item ${isActive ? 'active' : ''}`} 
              draggable={!editingWorkspaceId && !editingNoteWorkspaceId}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', workspace.id);
                e.dataTransfer.effectAllowed = 'move';
                setDraggedWorkspaceId(workspace.id);
              }}
              onDragEnd={() => {
                setDraggedWorkspaceId(null);
                setDragOverWorkspaceId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (draggedWorkspaceId && draggedWorkspaceId !== workspace.id) {
                  setDragOverWorkspaceId(workspace.id);
                }
              }}
              onDragLeave={() => {
                if (dragOverWorkspaceId === workspace.id) {
                  setDragOverWorkspaceId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const sourceId = e.dataTransfer.getData('text/plain');
                if (sourceId && sourceId !== workspace.id) {
                  reorderWorkspaces(sourceId, workspace.id);
                }
                setDraggedWorkspaceId(null);
                setDragOverWorkspaceId(null);
              }}
              style={{
                ...cardStyle,
                position: 'relative',
                opacity: isDragging ? 0.4 : 1,
                outline: isDragOver ? '2px dashed #38bdf8' : 'none',
                outlineOffset: '-2px',
                transition: 'opacity 0.15s, outline 0.15s'
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!loadingWorkspace) {
                  let x = e.clientX;
                  let y = e.clientY;
                  // Adjust coordinates so it doesn't go offscreen
                  const menuHeight = 300;
                  const menuWidth = 160;
                  if (x + menuWidth > window.innerWidth) {
                    x = window.innerWidth - menuWidth - 10;
                  }
                  if (y + menuHeight > window.innerHeight) {
                    y = window.innerHeight - menuHeight - 10;
                  }
                  x = Math.max(10, x);
                  y = Math.max(10, y);
                  
                  setOpenMenuWorkspaceId(workspace.id);
                  setMenuPosition({ x, y });
                }
              }}
            >
              {/* Three-dots menu button */}
              <button
                className="workspace-dots-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuPosition(null);
                  setOpenMenuWorkspaceId(openMenuWorkspaceId === workspace.id ? null : workspace.id);
                }}
                disabled={loadingWorkspace}
                title="More actions"
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '24px',
                  height: '24px',
                  padding: 0,
                  border: 'none',
                  borderRadius: '4px',
                  background: 'transparent',
                  color: '#71717a',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                  transition: 'background 0.15s, color 0.15s'
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLButtonElement).style.color = '#e4e4e7'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = '#71717a'; }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="3" r="1.5" />
                  <circle cx="8" cy="8" r="1.5" />
                  <circle cx="8" cy="13" r="1.5" />
                </svg>
              </button>

              {/* Dropdown menu — crisp-text-dark-ui solid surface */}
              {openMenuWorkspaceId === workspace.id && (
                <div
                  className="workspace-dropdown-menu"
                  onClick={(e) => e.stopPropagation()}
                  style={
                    menuPosition
                      ? {
                          position: 'fixed',
                          left: `${menuPosition.x}px`,
                          top: `${menuPosition.y}px`,
                          zIndex: 10000
                        }
                      : {
                          position: 'absolute',
                          top: '30px',
                          right: '6px',
                          zIndex: 10
                        }
                  }
                >
                  <button
                    type="button"
                    className="workspace-dropdown-item"
                    onClick={() => {
                      setOpenMenuWorkspaceId(null);
                      rename(workspace);
                    }}
                    disabled={loadingWorkspace}
                  >
                    <span className="workspace-dropdown-icon" aria-hidden>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
                      </svg>
                    </span>
                    Rename
                  </button>
                  <button
                    type="button"
                    className="workspace-dropdown-item"
                    onClick={() => {
                      setOpenMenuWorkspaceId(null);
                      startEditNote(workspace);
                    }}
                    disabled={loadingWorkspace}
                  >
                    <span className="workspace-dropdown-icon" aria-hidden>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
                        <path d="M5 5h6M5 8h6M5 11h4" />
                      </svg>
                    </span>
                    {workspace.note ? 'Edit note' : 'Add note'}
                  </button>
                  <button
                    type="button"
                    className={`workspace-dropdown-item${workspace.restoreDirectory ? ' is-checked' : ''}`}
                    onClick={() => {
                      setOpenMenuWorkspaceId(null);
                      setWorkspaceRestoreDirectory(workspace.id, !workspace.restoreDirectory);
                    }}
                    disabled={loadingWorkspace}
                  >
                    <span className="workspace-dropdown-icon" aria-hidden>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        {workspace.restoreDirectory ? (
                          <path d="M3 8l3 3 7-7" stroke="#34d399" strokeWidth="2" />
                        ) : (
                          <rect x="3" y="3" width="10" height="10" rx="1.5" />
                        )}
                      </svg>
                    </span>
                    Continue in current folder
                  </button>

                  <div className="workspace-dropdown-divider" />

                  <button
                    type="button"
                    className="workspace-dropdown-item"
                    onClick={() => {
                      setOpenMenuWorkspaceId(null);
                      moveWorkspace(workspace.id, 'up');
                    }}
                    disabled={loadingWorkspace || index === 0}
                  >
                    <span className="workspace-dropdown-icon" aria-hidden>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 13V3M4 7l4-4 4 4" />
                      </svg>
                    </span>
                    Move Up
                  </button>
                  <button
                    type="button"
                    className="workspace-dropdown-item"
                    onClick={() => {
                      setOpenMenuWorkspaceId(null);
                      moveWorkspace(workspace.id, 'down');
                    }}
                    disabled={loadingWorkspace || index === workspaces.length - 1}
                  >
                    <span className="workspace-dropdown-icon" aria-hidden>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 3v10M4 9l4 4 4-4" />
                      </svg>
                    </span>
                    Move Down
                  </button>

                  <div className="workspace-dropdown-divider" />

                  <button
                    type="button"
                    className="workspace-dropdown-item is-danger"
                    onClick={() => {
                      setOpenMenuWorkspaceId(null);
                      remove(workspace);
                    }}
                    disabled={loadingWorkspace}
                  >
                    <span className="workspace-dropdown-icon" aria-hidden>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 011.34-1.34h2.66a1.33 1.33 0 011.34 1.34V4m2 0v9.33a1.33 1.33 0 01-1.34 1.34H4.67a1.33 1.33 0 01-1.34-1.34V4h9.34z" />
                      </svg>
                    </span>
                    Remove
                  </button>

                  <div className="workspace-dropdown-divider" />
                  <div className="workspace-dropdown-section-label">Color Tag</div>
                  <div className="workspace-color-picker">
                    {WORKSPACE_COLORS.map((colorObj) => (
                      <button
                        type="button"
                        key={colorObj.name}
                        className={`color-dot ${workspace.color === colorObj.value ? 'selected' : !workspace.color && colorObj.name === 'blue' ? 'selected' : ''}`}
                        style={{ backgroundColor: colorObj.value }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!loadingWorkspace) {
                            setWorkspaceColor(workspace.id, colorObj.value === '#38bdf8' ? null : colorObj.value);
                          }
                        }}
                        disabled={loadingWorkspace}
                        title={`Set ${colorObj.name} color`}
                      />
                    ))}

                    <button
                      type="button"
                      className={`color-dot ${isCustomColor ? 'selected' : ''}`}
                      style={{
                        position: 'relative',
                        background: isCustomColor
                          ? workspace.color!
                          : 'linear-gradient(135deg, #ff007f 0%, #7f00ff 50%, #00f0ff 100%)',
                        cursor: loadingWorkspace ? 'not-allowed' : 'pointer',
                        overflow: 'hidden'
                      }}
                      disabled={loadingWorkspace}
                      title="Choose custom color"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="color"
                        value={isCustomColor ? workspace.color! : '#38bdf8'}
                        onChange={(e) => {
                          if (!loadingWorkspace) {
                            setWorkspaceColor(workspace.id, e.target.value);
                          }
                        }}
                        disabled={loadingWorkspace}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          cursor: 'pointer',
                          border: 'none',
                          padding: 0
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </button>
                  </div>
                </div>
              )}

              <button className="workspace-select" onClick={() => selectWorkspace(workspace.id)} disabled={loadingWorkspace}>
                {editingWorkspaceId === workspace.id ? (
                  <input
                    className="workspace-name-input"
                    value={workspaceEditValue}
                    onChange={(e) => setWorkspaceEditValue(e.target.value)}
                    onBlur={() => handleWorkspaceRenameSave(workspace)}
                    onKeyDown={(e) => handleWorkspaceRenameKeyDown(e, workspace)}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                ) : (
                  <span
                    className="workspace-name"
                    style={{ color: isActive ? activeColor : `${activeColor}b3`, cursor: 'text' }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      if (!loadingWorkspace) rename(workspace);
                    }}
                    title="Double-click to rename"
                  >
                    {workspace.name}
                  </span>
                )}

                {/* Pane Status Signal Bar (Red = Off, Yellow = Standby/Idle, Green = Running Agent/Task) */}
                {(() => {
                  const panesList = Object.entries(workspace.panes || {});
                  if (panesList.length === 0) return null;

                  return (
                    <div
                      className="workspace-pane-signals"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '4px',
                        marginBottom: '2px',
                        padding: '2px 5px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        borderRadius: '4px',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        width: 'fit-content',
                        maxWidth: '100%'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        {panesList.map(([paneId, paneConfig], index) => {
                          const status = paneConfig?.processStatus;

                          let state: 'green' | 'yellow' | 'red' = 'red';
                          let tooltipText = `Tab ${index + 1}: ${paneConfig?.title || 'Terminal'}`;

                          const activeRun = agentRuns.find(
                            (r) => r.workspaceId === workspace.id && r.terminalSessionId === paneId && r.status === 'running'
                          );
                          const activeTask = tasks.find(
                            (t) => t.paneId === paneId && t.status === 'running'
                          );

                          const isAlive = status === 'ready' || status === 'running' || status === 'idle' || status === 'spawning' || status === 'new';
                          const isAgentWorking = isAlive && Boolean(activeRun || activeTask);
                          const isRunning = status === 'running' || Boolean(activeRun || activeTask);

                          if (isRunning && isAlive) {
                            state = 'green';
                            const agentName = activeRun
                              ? agentProfiles.find((a) => a.id === activeRun.agentProfileId)?.name || 'Agent'
                              : 'Running';
                            tooltipText += ` — Working (${agentName})`;
                          } else if (isAlive) {
                            state = 'yellow';
                            tooltipText += ` — Ready / Standby`;
                          } else {
                            state = 'red';
                            const label = status === 'restored' ? 'Inactive (Restored)' : (status || 'Off');
                            tooltipText += ` — Off (${label})`;
                          }

                          return (
                            <span
                              key={paneId}
                              className={`pane-signal-dot is-${state}`}
                              title={tooltipText}
                              style={{
                                width: '6.5px',
                                height: '6.5px',
                                borderRadius: '50%',
                                display: 'inline-block',
                                flexShrink: 0,
                                transition: 'all 0.2s ease',
                                backgroundColor: state === 'green' ? '#22c55e' : state === 'yellow' ? '#f59e0b' : '#ef4444',
                                boxShadow: state === 'green' ? '0 0 6px rgba(34, 197, 94, 0.9)' : state === 'yellow' ? '0 0 3px rgba(245, 158, 11, 0.4)' : 'none',
                                animation: state === 'green' ? 'pane-signal-pulse 1.4s infinite ease-in-out' : 'none'
                              }}
                            />
                          );
                        })}
                      </div>
                      <span style={{ fontSize: '9px', color: '#71717a', marginLeft: '2px', fontWeight: 600, letterSpacing: '0.02em', flexShrink: 0 }}>
                        {panesList.length} tab{panesList.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })()}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#64748b', marginTop: '2px', width: '100%', overflow: 'hidden' }}>
                  <span className="workspace-path" style={{ display: 'flex', alignItems: 'center', minWidth: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }} title={workspace.rootPath}>
                    <FolderIcon />
                    {workspace.rootPath}
                  </span>
                  <span style={{ opacity: 0.35, flexShrink: 0 }}>•</span>
                  <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: '#52525b', fontSize: '9.5px' }} title={workspace.lastOpenedAt ? `Last opened: ${new Date(workspace.lastOpenedAt).toLocaleString()}` : undefined}>
                    <ClockIcon />
                    {workspace.lastOpenedAt ? formatRelativeTime(workspace.lastOpenedAt) : 'never'}
                  </span>
                </div>

                {editingNoteWorkspaceId === workspace.id ? (
                  <div style={{ marginTop: '4px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      className="workspace-note-input"
                      placeholder="Add note..."
                      value={noteEditValue}
                      onChange={(e) => setNoteEditValue(e.target.value)}
                      onBlur={() => handleWorkspaceNoteSave(workspace)}
                      onKeyDown={(e) => handleWorkspaceNoteKeyDown(e, workspace)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.4)',
                        border: `1px solid ${activeColor}99`,
                        borderRadius: '4px',
                        color: '#e4e4e7',
                        fontSize: '11px',
                        padding: '3px 6px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                ) : workspace.note ? (
                  <div
                    className="workspace-note-tag"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '10.5px',
                      color: '#a1a1aa',
                      marginTop: '4px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px dashed rgba(255, 255, 255, 0.12)',
                      width: '100%',
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      cursor: 'pointer'
                    }}
                    title={`Note: ${workspace.note} (Click to edit)`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!loadingWorkspace) startEditNote(workspace);
                    }}
                  >
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: activeColor, flexShrink: 0 }}>
                      <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" />
                      <path d="M5 5h6M5 8h6M5 11h4" />
                    </svg>
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontStyle: 'italic', flex: 1, textAlign: 'left' }}>
                      {workspace.note}
                    </span>
                  </div>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      {loadingWorkspace && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(16, 16, 16, 0.82)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
          textAlign: 'center',
          transition: 'all 0.3s ease'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: '2.5px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: '#38bdf8',
            borderRightColor: '#34d399',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }} />
          <strong style={{ fontSize: '13px', color: '#e4e4e7', display: 'block', marginBottom: '6px' }}>
            Opening Workspace...
          </strong>
          <span style={{ fontSize: '11px', color: '#a1a1aa' }}>
            Scanning folder & scanning context
          </span>
        </div>
      )}

      {workspaceToDelete && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(10, 10, 12, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            animation: 'settingsModalFadeIn 0.15s ease-out'
          }}
          onClick={() => setWorkspaceToDelete(null)}
        >
          <div
            style={{
              background: '#18181b',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '24px',
              width: '380px',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
              animation: 'settingsModalBoxPop 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <strong style={{ fontSize: '15px', color: '#e4e4e7', fontWeight: 600 }}>Remove Workspace</strong>
            </div>

            <p style={{ fontSize: '12.5px', color: '#a1a1aa', margin: 0, lineHeight: '1.6' }}>
              Are you sure you want to remove <span style={{ color: '#ef4444', fontWeight: 500 }}>"{workspaceToDelete.name}"</span> from AgentDeck?
              <br />
              <span style={{ fontSize: '11.5px', opacity: 0.8, display: 'block', marginTop: '6px' }}>
                Your local project files will remain untouched on your hard drive.
              </span>
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setWorkspaceToDelete(null)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  background: 'transparent',
                  color: '#a1a1aa',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = '#e4e4e7';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#a1a1aa';
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteWorkspace(workspaceToDelete.id);
                  setWorkspaceToDelete(null);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ef4444';
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

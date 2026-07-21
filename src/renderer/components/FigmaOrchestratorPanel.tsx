import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useDeckStore } from '../store/deckStore';
import type { FigmaBuildPlan, FigmaBuildPlanTask, ReceivedFigmaSelection } from '../../shared/types';

export function FigmaOrchestratorPanel() {
  const workspaces = useDeckStore((state) => state.workspaces);
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const activePaneId = useDeckStore((state) => state.activePaneId);
  const figmaBuildPlans = useDeckStore((state) => state.figmaBuildPlans || []);
  const activeFigmaBuildPlanId = useDeckStore((state) => state.activeFigmaBuildPlanId);
  const latestReceivedSelection = useDeckStore((state) => state.latestReceivedSelection);
  const agentProfiles = useDeckStore((state) => state.agentProfiles || []);
  const setRightTab = useDeckStore((state) => state.setRightTab);
  const selectPane = useDeckStore((state) => state.selectPane);
  
  const createFigmaBuildPlan = useDeckStore((state) => state.createFigmaBuildPlan);
  const setActiveFigmaBuildPlan = useDeckStore((state) => state.setActiveFigmaBuildPlan);
  const updateFigmaBuildTaskStatus = useDeckStore((state) => state.updateFigmaBuildTaskStatus);
  const dispatchFigmaBuildTask = useDeckStore((state) => state.dispatchFigmaBuildTask);
  const deleteFigmaBuildPlan = useDeckStore((state) => state.deleteFigmaBuildPlan);
  const updateTask = useDeckStore((state) => state.updateTask);
  const generateContext = useDeckStore((state) => state.generateContext);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;
  const currentWorkspacePlans = useMemo(() => {
    return figmaBuildPlans.filter((p) => p.workspaceId === activeWorkspaceId);
  }, [figmaBuildPlans, activeWorkspaceId]);

  const activePlan = useMemo(() => {
    return currentWorkspacePlans.find((p) => p.id === activeFigmaBuildPlanId) || currentWorkspacePlans[0] || null;
  }, [currentWorkspacePlans, activeFigmaBuildPlanId]);

  // UI State
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selectedPaneId, setSelectedPaneId] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('agent-claude-code');
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [activePlanTab, setActivePlanTab] = useState<'analysis' | 'stepper'>('stepper');
  const [autoDispatch, setAutoDispatch] = useState<boolean>(() => {
    return localStorage.getItem('agentdeck_figma_auto_dispatch') === 'true';
  });
  const [scanningContext, setScanningContext] = useState(false);
  const prevStatusesRef = useRef<Record<string, FigmaBuildPlanTask['status']>>({});

  // Load LLM configuration from browser storage
  const [isLlmConfigured, setIsLlmConfigured] = useState(false);
  const [llmSettings, setLlmSettings] = useState<any>(null);

  const checkLlmSettings = () => {
    try {
      const saved = localStorage.getItem('agentdeck_llm_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setLlmSettings(parsed);
        const configured = parsed.provider === 'ollama' || (parsed.apiKey && parsed.apiKey.trim().length > 0);
        setIsLlmConfigured(configured);
      } else {
        setIsLlmConfigured(false);
      }
    } catch {
      setIsLlmConfigured(false);
    }
  };

  useEffect(() => {
    checkLlmSettings();
    window.addEventListener('agentdeck_llm_settings_changed', checkLlmSettings);
    return () => window.removeEventListener('agentdeck_llm_settings_changed', checkLlmSettings);
  }, []);

  // Update default pane when active workspace or active pane changes
  useEffect(() => {
    if (activePaneId) {
      setSelectedPaneId(activePaneId);
    } else if (activeWorkspace && Object.keys(activeWorkspace.panes).length > 0) {
      setSelectedPaneId(Object.keys(activeWorkspace.panes)[0]);
    }
  }, [activePaneId, activeWorkspace]);

  // Automatically update plan tasks status based on linked Kanban Tasks
  const kanbanTasks = useDeckStore((state) => state.tasks || []);
  useEffect(() => {
    if (!activePlan) return;
    
    let stateChanged = false;
    activePlan.tasks.forEach((planTask) => {
      if (planTask.kanbanTaskId) {
        const kt = kanbanTasks.find((t) => t.id === planTask.kanbanTaskId);
        if (kt) {
          let targetStatus: FigmaBuildPlanTask['status'] = 'todo';
          if (kt.status === 'todo') targetStatus = 'todo';
          else if (kt.status === 'running') targetStatus = 'running';
          else if (kt.status === 'review') targetStatus = 'completed'; // auto-complete if under review
          else if (kt.status === 'done') targetStatus = 'completed';
          
          if (planTask.status !== targetStatus) {
            updateFigmaBuildTaskStatus(activePlan.id, planTask.id, targetStatus);
            stateChanged = true;
          }
        }
      }
    });
  }, [kanbanTasks, activePlan, updateFigmaBuildTaskStatus]);


  const handleScanWorkspaceContext = async () => {
    if (!activeWorkspaceId) return;
    setScanningContext(true);
    try {
      await generateContext(activeWorkspaceId);
    } catch (err) {
      console.error('Failed to scan workspace context:', err);
    } finally {
      setScanningContext(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!latestReceivedSelection || !latestReceivedSelection.importedContext) {
      setAnalysisError('Please select a Figma layer and wait for background import to complete.');
      return;
    }

    if (!isLlmConfigured || !llmSettings) {
      setAnalysisError('LLM settings are not configured. Click Settings icon to configure your API keys.');
      return;
    }

    setAnalyzing(true);
    setAnalysisError(null);

    try {
      console.log('[ORCHESTRATOR] Analyzing Figma selection context...', latestReceivedSelection.nodeName);
      const res = await window.agentDeck.workspaceAnalyzeFigmaDesign(
        latestReceivedSelection.importedContext,
        latestReceivedSelection.selectionUrl,
        {
          provider: llmSettings.provider,
          apiKey: llmSettings.apiKey,
          model: llmSettings.model,
          baseUrl: llmSettings.baseUrl
        },
        activeWorkspace?.context || undefined
      );

      if (res.ok) {
        createFigmaBuildPlan(latestReceivedSelection, res.data);
        setActivePlanTab('stepper');
      } else {
        setAnalysisError(res.error?.message || 'Failed to analyze design context.');
      }
    } catch (err: any) {
      setAnalysisError(err.message || String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDispatchTask = useCallback(async (taskId: string) => {
    if (!activePlan) return;
    const task = activePlan.tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Apply custom prompt override if edited by user
    if (customPrompts[taskId]) {
      task.promptPayload = customPrompts[taskId];
    }

    await dispatchFigmaBuildTask(activePlan.id, taskId, selectedPaneId, selectedAgentId);
    
    // Jump directly to the terminal pane to inspect work!
    if (selectedPaneId) {
      selectPane(selectedPaneId);
    }
  }, [activePlan, customPrompts, dispatchFigmaBuildTask, selectedPaneId, selectedAgentId, selectPane]);

  // Automatically dispatch next task if autoDispatch is enabled and a task just transitioned to completed
  useEffect(() => {
    if (!activePlan) {
      prevStatusesRef.current = {};
      return undefined;
    }

    const currentStatuses: Record<string, FigmaBuildPlanTask['status']> = {};
    let justCompletedTaskId: string | null = null;

    activePlan.tasks.forEach((t) => {
      currentStatuses[t.id] = t.status;
      const prevStatus = prevStatusesRef.current[t.id];
      // Detect transition to completed
      if (prevStatus && prevStatus !== 'completed' && t.status === 'completed') {
        justCompletedTaskId = t.id;
      }
    });

    // Update the ref
    prevStatusesRef.current = currentStatuses;

    // Only auto-dispatch if autoDispatch is enabled and a transition was detected
    if (autoDispatch && justCompletedTaskId) {
      // Find the next task that is 'todo' and not blocked
      const nextTask = activePlan.tasks.find((t) => {
        if (t.status !== 'todo') return false;
        const isBlocked = (t.dependsOn || []).some((depId) => {
          const depTask = activePlan.tasks.find((dt) => dt.id === depId);
          return depTask && depTask.status !== 'completed';
        });
        return !isBlocked;
      });

      if (nextTask) {
        console.log(`[ORCHESTRATOR] Automatically dispatching next task: ${nextTask.title} (${nextTask.id})`);
        const timer = setTimeout(() => {
          handleDispatchTask(nextTask.id);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [activePlan, autoDispatch, handleDispatchTask]);

  const toggleTaskExpanded = (taskId: string) => {
    setExpandedTasks((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handlePromptChange = (taskId: string, val: string) => {
    setCustomPrompts((prev) => ({ ...prev, [taskId]: val }));
  };

  const activeWorkspacePanes = activeWorkspace ? Object.values(activeWorkspace.panes) : [];

  return (
    <div
      className="panel-container figma-orchestrator-panel"
      style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', overflowY: 'auto' }}
    >
      
      {/* 1. Header Selection Summary Banner */}
      <div className="card-custom" style={{
        background: '#1c1c1e',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ color: '#38bdf8', display: 'flex' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#fafafa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Figma Build Orchestrator
            </h3>
            <span style={{ fontSize: '11px', color: '#a1a1aa', lineHeight: 1.35 }}>
              Deconstruct layouts & step-by-step code components
            </span>
          </div>
        </div>

        {latestReceivedSelection ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '12px',
            color: '#d4d4d8'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '4px' }}>
              <span style={{ color: '#fafafa', fontWeight: 600, flex: 1, wordBreak: 'break-word' }}>
                {latestReceivedSelection.nodeName && latestReceivedSelection.nodeName.length > 70
                  ? latestReceivedSelection.nodeName.substring(0, 67) + '...'
                  : latestReceivedSelection.nodeName || 'Unnamed frame'}
              </span>
              <span className="badge-tag" style={{ color: '#7dd3fc', fontSize: '10px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.22)', padding: '2px 6px', borderRadius: '4px', flexShrink: 0, textTransform: 'uppercase' }}>
                {latestReceivedSelection.status}
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#a1a1aa' }}>
              {latestReceivedSelection.nodeType || 'FRAME'} • {latestReceivedSelection.width}px × {latestReceivedSelection.height}px
            </div>
            {latestReceivedSelection.status !== 'imported' && latestReceivedSelection.status !== 'attached' && (
              <div style={{ marginTop: '6px', color: '#fcd34d', fontSize: '11px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Selection not imported. Import context in toast first.
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: '#141416',
            border: '1px dashed rgba(255, 255, 255, 0.12)',
            borderRadius: '6px',
            padding: '12px 14px',
            textAlign: 'center',
            fontSize: '12px',
            fontWeight: 500,
            color: '#a1a1aa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            lineHeight: 1.45,
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
            textRendering: 'optimizeLegibility'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#a1a1aa', flexShrink: 0 }} aria-hidden>
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="1" />
            </svg>
            No active Figma selection. Select a frame to begin.
          </div>
        )}

        {/* 2. Build Plan Selection Picker */}
        {currentWorkspacePlans.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600 }}>Active Orchestrator Plan:</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <select
                value={activePlan?.id || ''}
                onChange={(e) => setActiveFigmaBuildPlan(e.target.value)}
                style={{
                  flex: 1,
                  background: '#0e0e11',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '6px',
                  color: '#f4f4f5',
                  fontSize: '12px',
                  padding: '7px 10px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {currentWorkspacePlans.map((p) => (
                  <option key={p.id} value={p.id}>{p.nodeName} ({new Date(p.createdAt).toLocaleTimeString()})</option>
                ))}
              </select>
              {activePlan && (
                <button
                  type="button"
                  onClick={() => deleteFigmaBuildPlan(activePlan.id)}
                  title="Delete Plan"
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.15)',
                    borderRadius: '4px',
                    color: '#f87171',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* 1.5. Codebase Stack Context — crisp-text-dark-ui */}
        <div style={{
          background: '#18181b',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '12px',
          fontSize: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          marginTop: '2px',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div style={{ color: activeWorkspace?.context ? '#34d399' : '#a1a1aa', display: 'flex', flexShrink: 0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <span style={{ fontWeight: 600, color: '#f4f4f5', fontSize: '13px' }}>
                Workspace Stack Context
              </span>
            </div>

            {activeWorkspace?.context && (
              <button
                type="button"
                onClick={handleScanWorkspaceContext}
                disabled={scanningContext}
                title="Rescan Codebase Stack"
                style={{
                  background: '#141416',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#a1a1aa',
                  cursor: scanningContext ? 'default' : 'pointer',
                  padding: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.12s ease, border-color 0.12s ease',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  if (!scanningContext) {
                    e.currentTarget.style.color = '#f4f4f5';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.16)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#a1a1aa';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                {scanningContext ? (
                  <span className="spinner" style={{ width: '10px', height: '10px', borderWidth: '1.5px' }} />
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                )}
              </button>
            )}
          </div>

          {activeWorkspace?.context ? (
            <div style={{
              background: '#141416',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '8px 10px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '11px', color: '#34d399', letterSpacing: '0.02em' }}>Detected Stack:</span>
                <span
                  title={`Last scanned: ${new Date(activeWorkspace.context.updatedAt).toLocaleString()}`}
                  style={{
                    flexShrink: 0,
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: '#d4d4d8',
                    background: '#1c1c1e',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    padding: '2px 7px',
                    lineHeight: 1.3,
                    letterSpacing: '0.01em'
                  }}
                >
                  Scanned {new Date(activeWorkspace.context.updatedAt).toLocaleTimeString()}
                </span>
              </div>
              <div style={{ color: '#e4e4e7', fontSize: '12px', fontWeight: 500, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-family-mono, ui-monospace, Consolas, monospace)', lineHeight: 1.45 }}>
                {activeWorkspace.context.techStack}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '12px',
                color: '#fcd34d',
                lineHeight: 1.45,
                fontWeight: 500
              }}>
                No stack scanned. Scan codebase first so the AI generates the correct files/languages (HTML/CSS, React, etc.).
              </div>
              <button
                type="button"
                onClick={handleScanWorkspaceContext}
                disabled={scanningContext}
                style={{
                  background: scanningContext ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.38)',
                  borderRadius: '6px',
                  color: '#7dd3fc',
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: scanningContext ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease'
                }}
              >
                {scanningContext ? (
                  <>
                    <span className="spinner" style={{ width: '10px', height: '10px' }} /> Scanning...
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    Scan Codebase Stack
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* 3. Action Button Group */}
        {latestReceivedSelection && (latestReceivedSelection.status === 'imported' || latestReceivedSelection.status === 'attached') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {!isLlmConfigured ? (
              <div style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                borderRadius: '4px',
                padding: '6px 10px',
                fontSize: '10px',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}>
                <span>LLM settings not configured. Please add an API Key first.</span>
                <button
                  onClick={() => setRightTab('settings')}
                  style={{
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    padding: '2px 8px',
                    fontSize: '9px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Configure
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={analyzing}
                onClick={handleCreatePlan}
                style={{
                  background: analyzing ? 'rgba(56, 189, 248, 0.4)' : 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: analyzing ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                {analyzing ? (
                  <>
                    <span className="spinner" style={{ width: '10px', height: '10px' }} /> Analyzing layout...
                  </>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    Create UI Build Plan
                  </span>
                )}
              </button>
            )}
          </div>
        )}

        {analysisError && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '4px',
            padding: '6px 10px',
            fontSize: '10.5px',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{analysisError}</span>
          </div>
        )}
      </div>

      {/* Loader keyframes style */}
      <style>{`
        .figma-orchestrator-panel {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s infinite linear;
          display: inline-block;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        /* Solid surfaces — no backdrop-filter (blur softens / smears text) */
        .figma-orchestrator-panel .card-custom {
          background: #1a1a1c;
          border: 1px solid rgba(255, 255, 255, 0.08);
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .figma-orchestrator-panel .card-custom:hover {
          border-color: rgba(255, 255, 255, 0.12);
          background: #1e1e20;
        }
        .figma-orchestrator-panel .badge-tag {
          font-size: 10px;
          font-weight: 600;
          padding: 2.5px 6px;
          border-radius: 4px;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
      `}</style>

      {/* 4. Active Build Plan Dashboard */}
      {activePlan ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
          
          {/* Sub Navigation Bar inside Panel */}
          <div style={{
            display: 'flex',
            background: 'rgba(9, 9, 11, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '20px',
            padding: '2px',
            gap: '2px'
          }}>
            <button
              onClick={() => setActivePlanTab('stepper')}
              style={{
                flex: 1,
                background: activePlanTab === 'stepper' ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                border: 'none',
                borderRadius: '16px',
                color: activePlanTab === 'stepper' ? '#38bdf8' : '#71717a',
                padding: '4px 10px',
                fontSize: '10.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              </svg>
              Stepper Plan ({activePlan.tasks.length})
            </button>
            <button
              onClick={() => setActivePlanTab('analysis')}
              style={{
                flex: 1,
                background: activePlanTab === 'analysis' ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                border: 'none',
                borderRadius: '16px',
                color: activePlanTab === 'analysis' ? '#38bdf8' : '#71717a',
                padding: '4px 10px',
                fontSize: '10.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Design Specs
            </button>
          </div>

          {/* TAB 1: STEP-BY-STEP ORCHESTRATION STEPPER */}
          {activePlanTab === 'stepper' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* Stepper Dispatch Configuration Control Panel */}
              <div className="card-custom" style={{
                borderRadius: '6px',
                padding: '8px 10px',
                fontSize: '10.5px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <strong style={{ color: '#fff', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                  Orchestrator Settings
                </strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ color: '#71717a', fontSize: '9.5px' }}>Target Terminal:</span>
                    <select
                      value={selectedPaneId}
                      onChange={(e) => setSelectedPaneId(e.target.value)}
                      style={{
                        background: '#09090b',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '4px',
                        color: '#a1a1aa',
                        fontSize: '10.5px',
                        padding: '3px 6px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {activeWorkspacePanes.map((pane) => (
                        <option key={pane.id} value={pane.id}>{pane.title}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ color: '#71717a', fontSize: '9.5px' }}>Coding Agent:</span>
                    <select
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                      style={{
                        background: '#09090b',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '4px',
                        color: '#a1a1aa',
                        fontSize: '10.5px',
                        padding: '3px 6px',
                        outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {agentProfiles.map((ap) => (
                        <option key={ap.id} value={ap.id}>{ap.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  paddingTop: '6px',
                  marginTop: '4px'
                }}>
                  <span style={{ color: '#71717a', fontSize: '9.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: autoDispatch ? '#38bdf8' : '#71717a' }}>
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    Auto-run next task:
                  </span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', position: 'relative' }}>
                    <input
                      type="checkbox"
                      checked={autoDispatch}
                      onChange={(e) => {
                        setAutoDispatch(e.target.checked);
                        localStorage.setItem('agentdeck_figma_auto_dispatch', String(e.target.checked));
                      }}
                      style={{
                        opacity: 0,
                        width: 0,
                        height: 0,
                        position: 'absolute'
                      }}
                    />
                    <div style={{
                      width: '28px',
                      height: '16px',
                      background: autoDispatch ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                      border: autoDispatch ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      position: 'relative',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}>
                      <div style={{
                        width: '10px',
                        height: '10px',
                        background: autoDispatch ? '#38bdf8' : '#a1a1aa',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: autoDispatch ? '14px' : '2px',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                      }} />
                    </div>
                  </label>
                </div>
              </div>

              {/* Sequential Steps Stepper List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activePlan.tasks.map((task, index) => {
                  const isExpanded = expandedTasks[task.id] || false;
                  const customPromptValue = customPrompts[task.id] !== undefined ? customPrompts[task.id] : task.promptPayload;
                  
                  // Sequential unlock logic: P0 only lets users run if dependsOn is resolved
                  const isBlocked = (task.dependsOn || []).some((depId) => {
                    const depTask = activePlan.tasks.find((t) => t.id === depId);
                    return depTask && depTask.status !== 'completed';
                  });

                  const getStatusStyle = () => {
                    switch (task.status) {
                      case 'completed': return { border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.01)' };
                      case 'running': return { border: '1px solid rgba(56, 189, 248, 0.3)', background: 'rgba(56, 189, 248, 0.01)', animation: 'pulseBorder 1.5s infinite alternate' };
                      case 'failed': return { border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.01)' };
                      default: return isBlocked ? { border: '1px solid rgba(255, 255, 255, 0.02)', opacity: 0.55 } : { border: '1px solid rgba(255, 255, 255, 0.04)' };
                    }
                  };

                  const getStatusTag = () => {
                    switch (task.status) {
                      case 'completed':
                        return (
                          <span className="badge-tag" style={{ background: 'rgba(16, 185, 129, 0.06)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '1px' }}><polyline points="20 6 9 17 4 12" /></svg>
                            DONE
                          </span>
                        );
                      case 'running':
                        return (
                          <span className="badge-tag" style={{ background: 'rgba(56, 189, 248, 0.06)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.15)' }}>
                            <span className="spinner" style={{ width: '7px', height: '7px', borderWidth: '1px', borderTopColor: '#38bdf8', marginRight: '1px' }} />
                            RUNNING
                          </span>
                        );
                      case 'failed':
                        return (
                          <span className="badge-tag" style={{ background: 'rgba(239, 68, 68, 0.06)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '1px' }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            FAILED
                          </span>
                        );
                      default:
                        return isBlocked ? (
                          <span className="badge-tag" style={{ background: 'rgba(255, 255, 255, 0.02)', color: '#71717a', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '1px' }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                            BLOCKED
                          </span>
                        ) : (
                          <span className="badge-tag" style={{ background: 'rgba(255, 255, 255, 0.04)', color: '#a1a1aa', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '1px' }}><circle cx="12" cy="12" r="10" /></svg>
                            TODO
                          </span>
                        );
                    }
                  };

                  return (
                    <div
                      key={task.id}
                      className="card-custom"
                      style={{
                        borderRadius: '6px',
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        ...getStatusStyle()
                      }}
                    >
                      {/* Pulse Border Animation Tag */}
                      <style>{`
                        @keyframes pulseBorder {
                          from { border-color: rgba(56, 189, 248, 0.2); }
                          to { border-color: rgba(56, 189, 248, 0.5); }
                        }
                      `}</style>

                      {/* Top row: Title, status indicator, expansion toggle */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            background: task.status === 'completed' ? '#10b981' : task.status === 'running' ? '#38bdf8' : 'rgba(255,255,255,0.06)',
                            fontSize: '8px',
                            color: task.status === 'completed' || task.status === 'running' ? '#000' : '#71717a',
                            fontWeight: 700
                          }}>
                            {index + 1}
                          </span>
                          <strong style={{ fontSize: '11px', color: '#fff' }}>{task.title}</strong>
                        </div>
                        {getStatusTag()}
                      </div>

                      {/* Middle description */}
                      <div style={{ fontSize: '10px', color: '#a1a1aa', paddingLeft: '20px' }}>
                        {task.description}
                      </div>

                      {/* Context badge info (e.g. target file) */}
                      {task.targetFile && (
                        <div style={{ paddingLeft: '20px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '8.5px', color: '#71717a' }}>Target File:</span>
                          <code style={{ fontSize: '9px', color: '#a78bfa', background: 'rgba(167, 139, 250, 0.06)', padding: '1.5px 5px', borderRadius: '3px', fontFamily: 'monospace' }}>
                            {task.targetFile}
                          </code>
                        </div>
                      )}

                      {/* Expanded Section: Prompt compiler editor */}
                      <div style={{ paddingLeft: '20px' }}>
                        <button
                          type="button"
                          onClick={() => toggleTaskExpanded(task.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#71717a',
                            cursor: 'pointer',
                            fontSize: '9.5px',
                            padding: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(90deg)', transition: 'transform 0.15s' }}>
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                          {isExpanded ? 'Hide Agent Prompt' : 'Review/Edit Agent Prompt'}
                        </button>

                        {isExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                            <textarea
                              value={customPromptValue}
                              onChange={(e) => handlePromptChange(task.id, e.target.value)}
                              rows={6}
                              style={{
                                width: '100%',
                                background: '#09090b',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '4px',
                                color: '#a1a1aa',
                                fontFamily: 'monospace',
                                fontSize: '10px',
                                padding: '6px',
                                boxSizing: 'border-box',
                                resize: 'vertical',
                                outline: 'none'
                              }}
                            />
                            <span style={{ fontSize: '8.5px', color: '#71717a', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                              Modifying overrides the prompt payload dispatched directly.
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Dispatch Trigger Bar */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', paddingLeft: '20px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '6px', marginTop: '2px' }}>
                        {task.status === 'running' && (
                          <button
                            type="button"
                            onClick={() => {
                              updateFigmaBuildTaskStatus(activePlan.id, task.id, 'completed');
                              if (task.kanbanTaskId) {
                                updateTask(task.kanbanTaskId, { status: 'done' });
                              }
                            }}
                            style={{
                              background: 'rgba(16, 185, 129, 0.1)',
                              border: '1px solid rgba(16, 185, 129, 0.2)',
                              borderRadius: '4px',
                              color: '#10b981',
                              fontSize: '10px',
                              fontWeight: 600,
                              padding: '3px 8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                            Approve Step
                          </button>
                        )}
                          <button
                          type="button"
                          disabled={isBlocked || task.status === 'running'}
                          onClick={() => handleDispatchTask(task.id)}
                          style={{
                            background: isBlocked ? 'rgba(255,255,255,0.01)' : task.status === 'completed' ? 'rgba(56, 189, 248, 0.06)' : 'rgba(56, 189, 248, 0.08)',
                            border: isBlocked ? '1px solid rgba(255,255,255,0.02)' : task.status === 'completed' ? '1px solid rgba(56, 189, 248, 0.15)' : '1px solid rgba(56, 189, 248, 0.25)',
                            borderRadius: '4px',
                            color: isBlocked ? '#52525b' : task.status === 'completed' ? '#38bdf8' : '#38bdf8',
                            fontSize: '10px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            cursor: isBlocked ? 'default' : 'pointer',
                            opacity: isBlocked ? 0.4 : 1,
                            transition: 'all 0.15s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                          </svg>
                          {task.status === 'completed' ? 'Dispatch Again' : 'Send to Agent'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: DETAILED DESIGN SPECIFICATIONS */}
          {activePlanTab === 'analysis' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* Dimensions Specs Row */}
              <div className="card-custom" style={{ borderRadius: '6px', padding: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: '#a1a1aa' }}>
                <div>
                  <strong>Structure Type:</strong> <span style={{ color: '#fff' }}>{activePlan.nodeType || 'FRAME'}</span>
                </div>
                <div>
                  <strong>Canvas Dimensions:</strong> <span style={{ color: '#fff' }}>{activePlan.analysis.dimensions?.width || 0}px × {activePlan.analysis.dimensions?.height || 0}px</span>
                </div>
              </div>

              {/* Color Swatch Board */}
              <div className="card-custom" style={{ borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <strong style={{ color: '#fff', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Detected Color Palette</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {activePlan.analysis.colors.map((color, idx) => (
                    <div key={idx} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '12px',
                      padding: '3px 6px',
                      fontSize: '9.5px',
                      color: '#a1a1aa'
                    }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: color,
                        border: '1px solid rgba(255,255,255,0.1)',
                        display: 'block'
                      }} />
                      <span style={{ fontFamily: 'monospace' }}>{color}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Typography Specs Table */}
              <div className="card-custom" style={{ borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <strong style={{ color: '#fff', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Typography Tokens</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {activePlan.analysis.typography.map((typo, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.01)',
                      borderBottom: '1px solid rgba(255,255,255,0.02)',
                      paddingBottom: '4px',
                      fontSize: '10.5px'
                    }}>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{typo.role?.toUpperCase() || 'ROLE'}</span>
                      <span style={{ color: '#a1a1aa', fontFamily: 'monospace', fontSize: '9.5px' }}>
                        {typo.fontFamily} • {typo.fontSize}px • W:{typo.fontWeight}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detected Components Specification */}
              <div className="card-custom" style={{ borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <strong style={{ color: '#fff', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Detected Components</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {activePlan.analysis.detectedComponents.map((comp) => (
                    <div key={comp.id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '4px', padding: '6px 8px', fontSize: '10.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <strong style={{ color: '#60a5fa' }}>{comp.name}</strong>
                        <span className="badge-tag" style={{ background: 'rgba(96, 165, 250, 0.06)', color: '#60a5fa', fontSize: '8.5px', padding: '1px 4px' }}>{comp.type}</span>
                      </div>
                      <div style={{ color: '#a1a1aa', fontSize: '10px' }}>{comp.description}</div>
                      {comp.suggestedFileName && (
                        <div style={{ fontSize: '8.5px', color: '#71717a', marginTop: '4px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                          {comp.suggestedFileName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Detected Sections Specification */}
              <div className="card-custom" style={{ borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <strong style={{ color: '#fff', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Detected Sections</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {activePlan.analysis.detectedSections.map((sec) => (
                    <div key={sec.id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '4px', padding: '6px 8px', fontSize: '10.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <strong style={{ color: '#a78bfa' }}>{sec.name}</strong>
                        <span className="badge-tag" style={{ background: 'rgba(167, 139, 250, 0.06)', color: '#a78bfa', fontSize: '8.5px', padding: '1px 4px' }}>{sec.type}</span>
                      </div>
                      <div style={{ color: '#a1a1aa', fontSize: '10px' }}>{sec.description}</div>
                      {sec.suggestedFileName && (
                        <div style={{ fontSize: '8.5px', color: '#71717a', marginTop: '4px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                          {sec.suggestedFileName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Motion Opportunities Specs */}
              <div className="card-custom" style={{ borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <strong style={{ color: '#fff', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Motion & Micro-animations</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {activePlan.analysis.motionOpportunities.map((motion, idx) => (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '4px', padding: '6px 8px', fontSize: '10.5px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <strong style={{ color: '#fb7185' }}>{motion.elementName}</strong>
                        <span className="badge-tag" style={{ background: 'rgba(251, 113, 133, 0.06)', color: '#fb7185', fontSize: '8.5px', padding: '1px 4px' }}>
                          {motion.trigger.toUpperCase()} → {motion.type.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ color: '#a1a1aa', fontSize: '10px' }}>{motion.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Layout Hints and Spacing hints */}
              <div className="card-custom" style={{ borderRadius: '6px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '10.5px' }}>
                <strong style={{ color: '#fff', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Developer Layout & Spacing Hints</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>
                    <span style={{ color: '#71717a', fontSize: '9px' }}>Layout hints:</span>
                    <ul style={{ margin: '3px 0', paddingLeft: '14px', color: '#e4e4e7', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {activePlan.analysis.layoutHints.map((hint, idx) => <li key={idx}>{hint}</li>)}
                    </ul>
                  </div>
                  <div>
                    <span style={{ color: '#71717a', fontSize: '9px' }}>Spacing guidelines:</span>
                    <ul style={{ margin: '3px 0', paddingLeft: '14px', color: '#e4e4e7', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {activePlan.analysis.spacingHints.map((hint, idx) => <li key={idx}>{hint}</li>)}
                    </ul>
                  </div>
                  {activePlan.analysis.assetHints.length > 0 && (
                    <div>
                      <span style={{ color: '#71717a', fontSize: '9px' }}>Required assets:</span>
                      <ul style={{ margin: '3px 0', paddingLeft: '14px', color: '#e4e4e7', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {activePlan.analysis.assetHints.map((hint, idx) => <li key={idx}>{hint}</li>)}
                      </ul>
                    </div>
                  )}
                  <div>
                    <span style={{ color: '#71717a', fontSize: '9px' }}>Responsive behavior:</span>
                    <ul style={{ margin: '3px 0', paddingLeft: '14px', color: '#e4e4e7', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {activePlan.analysis.responsiveHints.map((hint, idx) => <li key={idx}>{hint}</li>)}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Risks Alert box */}
              {activePlan.analysis.risks.length > 0 && (
                <div style={{
                  background: 'rgba(244, 63, 94, 0.04)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                  borderRadius: '6px',
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}>
                  <strong style={{ color: '#f43f5e', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    Implementation Risk Warnings
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: '14px', color: '#fda4af', fontSize: '10.5px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {activePlan.analysis.risks.map((risk, idx) => <li key={idx}>{risk}</li>)}
                  </ul>
                </div>
              )}

            </div>
          )}

        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '28px 16px',
          textAlign: 'center',
          background: '#141416',
          border: '1px dashed rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          color: '#a1a1aa',
          fontSize: '12px',
          gap: '10px',
          marginTop: '12px'
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#71717a', marginBottom: '2px' }}>
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          <span style={{ color: '#f4f4f5', fontWeight: 600, fontSize: '13px' }}>No UI build plan built yet</span>
          <p style={{ margin: 0, fontSize: '12px', color: '#a1a1aa', maxWidth: '300px', lineHeight: 1.5 }}>
            Select a frame in Figma and click <strong style={{ color: '#e4e4e7' }}>Create UI Build Plan</strong> above to analyze and generate modular code tasks.
          </p>
        </div>
      )}

    </div>
  );
}

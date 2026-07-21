// Đã đọc AGENTS.md
import React, { useState, useEffect, useCallback } from 'react';
import { useDeckStore } from '../store/deckStore';
import type { AndroidDevice, AndroidDeviceStatus, MobileStackDetection } from '../../shared/types';

// Subtle icons
const RefreshIcon = ({ className, spin }: { className?: string; spin?: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`${className || ''} ${spin ? 'animate-spin' : ''}`}
    style={spin ? { animation: 'spin 1s linear infinite' } : undefined}
  >
    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38" />
  </svg>
);

const HelpIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3" />
  </svg>
);

const TerminalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const MobileIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
  </svg>
);

const WarningIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export function DeviceLab() {
  const createPane = useDeckStore((state) => state.createPane);
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const workspaces = useDeckStore((state) => state.workspaces);
  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) || null;

  // States
  const [adbStatus, setAdbStatus] = useState<{ adbPath?: string; version?: string; missing: boolean }>({ missing: false });
  const [devices, setDevices] = useState<AndroidDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [activeReversePorts, setActiveReversePorts] = useState<number[]>([]);
  const [customPort, setCustomPort] = useState<string>('');
  
  // Loading & Error States — start "loading" so first paint isn't empty→scan→empty flash
  const [loadingAdb, setLoadingAdb] = useState<boolean>(true);
  const [loadingDevices, setLoadingDevices] = useState<boolean>(true);
  const [devicesHydrated, setDevicesHydrated] = useState(false);
  /** User-click refresh only — do not couple to background poll/load flags */
  const [refreshing, setRefreshing] = useState(false);
  const [loadingReversePorts, setLoadingReversePorts] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState<boolean>(false); // Collapsed by default in sidebar
  const [installingAdb, setInstallingAdb] = useState<boolean>(false);
  const [scrcpyStatus, setScrcpyStatus] = useState<{ missing: boolean; loading: boolean; installing: boolean }>({ missing: true, loading: true, installing: false });
  const [showScreenPreview, setShowScreenPreview] = useState<boolean>(false);
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [screenSize, setScreenSize] = useState<{ width: number; height: number }>({ width: 1080, height: 2400 });
  const [activeTab, setActiveTab] = useState<'screen' | 'ports' | 'mobile'>('screen');
  const [mobileStack, setMobileStack] = useState<MobileStackDetection | null>(null);
  const [detectingStack, setDetectingStack] = useState<boolean>(false);
  const [runningCommand, setRunningCommand] = useState<boolean>(false);
  const dragStart = React.useRef<{ x: number; y: number; time: number } | null>(null);

  // Check ADB status — silent keeps previous badge (no "Checking…" flash)
  const checkAdb = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoadingAdb(true);
    try {
      const res = await window.agentDeck.mobileDevices.getAdbStatus();
      if (res.ok) {
        setAdbStatus(res.data);
      } else {
        setAdbStatus({ missing: true });
      }
    } catch (err) {
      setAdbStatus({ missing: true });
    } finally {
      if (!silent) setLoadingAdb(false);
    }
  }, []);

  // Fetch device list — silent updates list without swapping empty ↔ scanning
  const fetchDevices = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoadingDevices(true);
    if (!silent) setError(null);
    try {
      const res = await window.agentDeck.mobileDevices.listAndroidDevices();
      if (res.ok) {
        setDevices(res.data);
        // Auto-select first device if none is selected
        if (res.data.length > 0) {
          if (!selectedDeviceId || !res.data.some(d => d.id === selectedDeviceId)) {
            setSelectedDeviceId(res.data[0].id);
          }
        } else {
          setSelectedDeviceId(null);
          setActiveReversePorts([]);
        }
      } else {
        setError(res.error?.message || 'Failed to list devices');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to list devices');
    } finally {
      setLoadingDevices(false);
      setDevicesHydrated(true);
    }
  }, [selectedDeviceId]);

  // Fetch active reverse ports for selected device
  const fetchReversePorts = useCallback(async (deviceId: string) => {
    setLoadingReversePorts(true);
    try {
      const res = await window.agentDeck.mobileDevices.listReversePorts(deviceId);
      if (res.ok) {
        setActiveReversePorts(res.data);
      } else {
        setActiveReversePorts([]);
      }
    } catch (err) {
      setActiveReversePorts([]);
    } finally {
      setLoadingReversePorts(false);
    }
  }, []);

  const checkScrcpy = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setScrcpyStatus(prev => ({ ...prev, loading: true }));
    try {
      const res = await window.agentDeck.mobileDevices.detectScrcpy();
      if (res.ok) {
        setScrcpyStatus(prev => ({
          missing: res.data.missing,
          loading: false,
          installing: prev.installing
        }));
      } else {
        setScrcpyStatus(prev => ({ missing: true, loading: false, installing: prev.installing }));
      }
    } catch {
      setScrcpyStatus(prev => ({ missing: true, loading: false, installing: prev.installing }));
    }
  }, []);

  const handleInstallScrcpy = async () => {
    setScrcpyStatus(prev => ({ ...prev, installing: true }));
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await window.agentDeck.mobileDevices.installScrcpy();
      if (res.ok) {
        if (res.data.ok) {
          setSuccessMessage('scrcpy screen mirror tool installed successfully!');
          await checkScrcpy();
        } else {
          setError(res.data.error || 'Failed to install scrcpy.');
        }
      } else {
        setError(res.error?.message || 'Failed to install scrcpy.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to install scrcpy.');
    } finally {
      setScrcpyStatus(prev => ({ ...prev, installing: false }));
    }
  };

  const handleLaunchScrcpy = async () => {
    if (!selectedDeviceId) return;
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await window.agentDeck.mobileDevices.launchScrcpy(selectedDeviceId);
      if (res.ok) {
        setSuccessMessage('Mirroring window launched.');
      } else {
        setError(res.error?.message || 'Failed to launch mirror window.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to launch mirror window.');
    }
  };

  // Refresh data. silent=true: no content/badge loading flash (user Refresh button).
  const handleRefreshAll = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    await checkAdb({ silent });
    await fetchDevices({ silent });
    await checkScrcpy({ silent });
  }, [checkAdb, fetchDevices, checkScrcpy]);

  // Header Refresh: only the button spins — content stays put (no empty↔scan jank)
  const handleRefreshClick = useCallback(async () => {
    if (refreshing) return;
    const startedAt = Date.now();
    const minSpinMs = 600;
    setRefreshing(true);
    try {
      // After first hydrate, always soft-refresh so empty state doesn't flip to scanning
      await handleRefreshAll({ silent: devicesHydrated });
    } catch {
      /* keep feedback; errors surface via existing state */
    } finally {
      const wait = Math.max(0, minSpinMs - (Date.now() - startedAt));
      window.setTimeout(() => setRefreshing(false), wait);
    }
  }, [refreshing, handleRefreshAll, devicesHydrated]);

  const handleInstallAdb = async () => {
    setInstallingAdb(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await window.agentDeck.mobileDevices.installAdb();
      if (res.ok) {
        if (res.data.ok) {
          setSuccessMessage('ADB Platform Tools installed successfully!');
          await handleRefreshAll();
        } else {
          setError(res.data.error || 'Failed to install ADB Tools.');
        }
      } else {
        setError(res.error?.message || 'Failed to install ADB Tools.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to install ADB Tools.');
    } finally {
      setInstallingAdb(false);
    }
  };

  // Initial load
  useEffect(() => {
    void handleRefreshAll();
  }, [activeWorkspaceId]);

  // Auto-refresh selected device reverse ports
  useEffect(() => {
    if (selectedDeviceId) {
      void fetchReversePorts(selectedDeviceId);
    } else {
      setActiveReversePorts([]);
    }
  }, [selectedDeviceId, fetchReversePorts]);

  // Screen preview polling loop
  useEffect(() => {
    let active = true;
    let timer: NodeJS.Timeout | null = null;

    const capture = async () => {
      if (!selectedDeviceId || !showScreenPreview || !active) return;
      try {
        const res = await window.agentDeck.mobileDevices.captureScreenshot(selectedDeviceId);
        if (active) {
          if (res.ok) {
            setScreenshotData(res.data);
            setError(null);
          } else {
            // Quiet fail
          }
        }
      } catch (err) {
        // Ignore
      }
      
      if (active && showScreenPreview) {
        timer = setTimeout(capture, 1000); // 1 FPS polling rate to keep things lightweight
      }
    };

    if (showScreenPreview && selectedDeviceId) {
      void capture();
    } else {
      setScreenshotData(null);
    }

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [selectedDeviceId, showScreenPreview]);

  // Fetch screen size when device changes
  useEffect(() => {
    if (selectedDeviceId) {
      void window.agentDeck.mobileDevices.getDeviceScreenSize(selectedDeviceId).then((res: any) => {
        if (res.ok) {
          setScreenSize(res.data);
        }
      });
    }
  }, [selectedDeviceId]);

  const handlePointerDown = (e: React.PointerEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    dragStart.current = {
      x: (x / rect.width) * screenSize.width,
      y: (y / rect.height) * screenSize.height,
      time: Date.now()
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLImageElement>) => {
    if (!dragStart.current || !selectedDeviceId) return;
    const start = dragStart.current;
    dragStart.current = null;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const endX = (x / rect.width) * screenSize.width;
    const endY = (y / rect.height) * screenSize.height;
    
    const dx = endX - start.x;
    const dy = endY - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const duration = Date.now() - start.time;

    try {
      if (distance < 15) {
        // Tap
        await window.agentDeck.mobileDevices.sendAdbInput(selectedDeviceId, 'tap', { x: start.x, y: start.y });
      } else {
        // Swipe
        await window.agentDeck.mobileDevices.sendAdbInput(selectedDeviceId, 'swipe', {
          x1: start.x,
          y1: start.y,
          x2: endX,
          y2: endY,
          duration: Math.max(100, duration)
        });
      }
      
      // Instantly trigger screen refresh
      const captureRes = await window.agentDeck.mobileDevices.captureScreenshot(selectedDeviceId);
      if (captureRes.ok) {
        setScreenshotData(captureRes.data);
      }
    } catch (err) {
      console.error('Failed to send ADB input:', err);
    }
  };

  const handleSendKeyevent = async (key: string) => {
    if (!selectedDeviceId) return;
    try {
      await window.agentDeck.mobileDevices.sendAdbInput(selectedDeviceId, 'keyevent', { key });
      // Instantly trigger screen refresh
      const captureRes = await window.agentDeck.mobileDevices.captureScreenshot(selectedDeviceId);
      if (captureRes.ok) {
        setScreenshotData(captureRes.data);
      }
    } catch (err) {
      console.error('Failed to send ADB keyevent:', err);
    }
  };

  const detectStack = useCallback(async () => {
    if (!activeWorkspace) {
      setMobileStack(null);
      return;
    }
    setDetectingStack(true);
    try {
      const res = await window.agentDeck.mobileDevices.detectMobileStack(activeWorkspace.rootPath);
      if (res.ok) {
        setMobileStack(res.data);
      } else {
        setMobileStack(null);
      }
    } catch {
      setMobileStack(null);
    } finally {
      setDetectingStack(false);
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeWorkspace && activeTab === 'mobile') {
      void detectStack();
    }
  }, [activeWorkspaceId, activeTab, detectStack]);

  const terminalTitle = mobileStack?.type === 'expo' ? 'Expo' :
                        mobileStack?.type === 'react-native' ? 'React Native Android' :
                        mobileStack?.type === 'flutter' ? 'Flutter Android' : 'Mobile Run';

  const findExistingPaneId = () => {
    if (!activeWorkspace) return null;
    const match = Object.values(activeWorkspace.panes).find(p => p.title === terminalTitle);
    return match ? match.id : null;
  };

  const handleRunCommand = async (cmd: string) => {
    if (!selectedDeviceId) {
      setError('Please connect and select an Android device first.');
      return;
    }
    setRunningCommand(true);
    setError(null);
    setSuccessMessage(null);
    
    let finalCmd = cmd;
    if (cmd.includes('DEVICE_ID_PLACEHOLDER')) {
      finalCmd = cmd.replace('DEVICE_ID_PLACEHOLDER', selectedDeviceId);
    } else if (mobileStack?.type === 'flutter') {
      finalCmd = `${cmd} -d ${selectedDeviceId}`;
    }

    try {
      const existingPaneId = findExistingPaneId();
      if (existingPaneId) {
        // Focus the pane
        useDeckStore.getState().selectPane(existingPaneId);
        // Run the command
        window.agentDeck.terminalWrite(existingPaneId, finalCmd + '\r');
        setSuccessMessage(`Executing command in existing "${terminalTitle}" terminal.`);
      } else {
        // Create new pane with title
        const newPaneId = createPane(terminalTitle);
        if (newPaneId) {
          // Wait for terminal initialization then write command
          setTimeout(() => {
            window.agentDeck.terminalWrite(newPaneId, finalCmd + '\r');
          }, 600);
          setSuccessMessage(`Opened new terminal "${terminalTitle}" and executing command.`);
        } else {
          throw new Error('Failed to create new terminal pane.');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to run command.');
    } finally {
      setTimeout(() => {
        setRunningCommand(false);
      }, 2000);
    }
  };

  const selectedDevice = devices.find(d => d.id === selectedDeviceId) || null;

  // Actions
  const handleReversePort = async (port: number) => {
    if (!selectedDeviceId) return;
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await window.agentDeck.mobileDevices.reversePort(selectedDeviceId, port);
      if (res.ok) {
        setSuccessMessage(`Successfully reversed port tcp:${port}`);
        void fetchReversePorts(selectedDeviceId);
      } else {
        setError(res.error?.message || `Failed to reverse port ${port}`);
      }
    } catch (err: any) {
      setError(err.message || `Failed to reverse port ${port}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveReversePort = async (port: number) => {
    if (!selectedDeviceId) return;
    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await window.agentDeck.mobileDevices.removeReversePort(selectedDeviceId, port);
      if (res.ok) {
        setSuccessMessage(`Successfully removed reverse port tcp:${port}`);
        void fetchReversePorts(selectedDeviceId);
      } else {
        setError(res.error?.message || `Failed to remove reverse port ${port}`);
      }
    } catch (err: any) {
      setError(err.message || `Failed to remove reverse port ${port}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCustomReverseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const port = parseInt(customPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      setError('Port must be an integer between 1 and 65535.');
      return;
    }
    void handleReversePort(port);
    setCustomPort('');
  };

  const handleOpenLogcat = async () => {
    if (!selectedDeviceId) return;
    try {
      const paneId = createPane();
      if (paneId) {
        setTimeout(() => {
          window.agentDeck.terminalWrite(paneId, `adb -s ${selectedDeviceId} logcat\r`);
          setSuccessMessage(`Logcat terminal opened in session.`);
        }, 600);
      } else {
        setError('Failed to create a new workspace pane.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to open logcat');
    }
  };

  const getStatusBadge = (status: AndroidDeviceStatus) => {
    // Badge chips: 11px min for multi-char status labels (crisp-text-dark-ui)
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '11px',
      fontWeight: 600
    };
    switch (status) {
      case 'device':
        return (
          <span style={{ ...base, background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.28)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            Connected
          </span>
        );
      case 'unauthorized':
        return (
          <span style={{ ...base, background: 'rgba(245, 158, 11, 0.15)', color: '#fcd34d', border: '1px solid rgba(245, 158, 11, 0.28)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
            Unauthorized
          </span>
        );
      case 'offline':
        return (
          <span style={{ ...base, background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.28)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            Offline
          </span>
        );
      default:
        return (
          <span style={{ ...base, background: 'rgba(113, 113, 122, 0.15)', color: '#d4d4d8', border: '1px solid rgba(113, 113, 122, 0.28)' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a1a1aa', display: 'inline-block' }} />
            Unknown
          </span>
        );
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: '#101010',
      color: '#e4e4e7',
      overflow: 'hidden',
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
      textRendering: 'optimizeLegibility'
    }}>
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#141416', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#f4f4f5', margin: 0 }}>Device Lab</h2>
          <div style={{ height: '12px', width: '1px', background: 'rgba(255,255,255,0.12)' }} />
          
          {/* ADB Status Badge — fixed min-width so label swap doesn't shove Refresh */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              minWidth: 92,
              fontSize: '11px',
              fontWeight: 600,
              color: loadingAdb ? '#a1a1aa' : adbStatus.missing ? '#f87171' : '#4ade80'
            }}
            title={!loadingAdb && !adbStatus.missing ? `ADB Version: ${adbStatus.version}` : undefined}
          >
            <span
              style={{
                display: 'inline-block',
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                flexShrink: 0,
                background: loadingAdb ? '#71717a' : adbStatus.missing ? '#ef4444' : '#22c55e'
              }}
            />
            {loadingAdb ? 'Checking…' : adbStatus.missing ? 'ADB Missing' : 'ADB Ready'}
          </span>
        </div>

        <button
          type="button"
          className={`refresh-btn${refreshing ? ' is-refreshing' : ''}`}
          onClick={() => void handleRefreshClick()}
          disabled={refreshing}
          aria-busy={refreshing}
          title={refreshing ? 'Refreshing…' : 'Refresh ADB & Devices'}
        >
          <span className="refresh-btn-icon-wrap" aria-hidden>
            <RefreshIcon className="refresh-btn-icon" />
          </span>
          <span className="refresh-btn-label">Refresh</span>
        </button>
      </div>

      {/* Main Panel Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Error Alert */}
        {error && (
          <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', fontSize: '11.5px', lineHeight: 1.4 }}>
            <strong>Error:</strong> {error}
          </div>
        )}
        
        {/* Success Alert */}
        {successMessage && (
          <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#34d399', fontSize: '11.5px', lineHeight: 1.4 }}>
            <strong>Success:</strong> {successMessage}
          </div>
        )}

        {/* ADB Missing Helper */}
        {adbStatus.missing && (
          <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px dashed rgba(239, 68, 68, 0.25)', borderRadius: '6px', fontSize: '11.5px', color: '#f87171', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <span style={{ fontWeight: 700, display: 'block', marginBottom: '4px' }}>ADB Command Not Found</span>
              Please make sure Android SDK Platform Tools are installed and `adb` is added to your system environment variables (PATH).
            </div>
            <button
              onClick={handleInstallAdb}
              disabled={installingAdb}
              style={{
                width: '100%',
                padding: '6px 12px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {installingAdb ? (
                <>
                  <RefreshIcon spin={true} />
                  <span>Installing Platform Tools...</span>
                </>
              ) : (
                <span>Auto-Install ADB Tools</span>
              )}
            </button>
          </div>
        )}

        {/* Device Selection Section — reserved min-height avoids scan↔empty layout jump */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '11.5px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Device
          </label>
          
          {/* Only show scan skeleton before first hydrate — never on user Refresh */}
          {!devicesHydrated ? (
            <div style={{
              minHeight: 112,
              boxSizing: 'border-box',
              padding: '28px 16px',
              fontSize: '12px',
              color: '#a1a1aa',
              textAlign: 'center',
              background: '#141416',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}>
              <RefreshIcon spin />
              <span>Scanning USB connections…</span>
            </div>
          ) : devices.length === 0 ? (
            <div style={{
              minHeight: 112,
              boxSizing: 'border-box',
              padding: '28px 16px',
              textAlign: 'center',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: 8,
              background: '#141416',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10
            }}>
              {/* Icon: mute via color only — no opacity on block (crisp-text-dark-ui) */}
              <span style={{ color: '#71717a', display: 'flex', justifyContent: 'center' }}>
                <MobileIcon size={20} />
              </span>
              <strong style={{ fontSize: 13, fontWeight: 600, display: 'block', color: '#f4f4f5' }}>No Devices Found</strong>
              <span style={{ fontSize: 12, color: '#a1a1aa', display: 'block', lineHeight: 1.5, maxWidth: 300, margin: 0 }}>
                Connect a phone via USB and enable USB Debugging.
              </span>
            </div>
          ) : (
            <select
              value={selectedDeviceId || ''}
              onChange={(e) => setSelectedDeviceId(e.target.value || null)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#1c1c1e',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12.5px',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.model || 'Unknown'} ({device.id})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Selected Device Controls */}
        {selectedDevice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Device Overview Card */}
            <div style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f4f4f5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MobileIcon />
                  {selectedDevice.model || 'Connected Device'}
                </span>
                {getStatusBadge(selectedDevice.status)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px', color: '#a1a1aa', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
                <div>
                  <span style={{ display: 'block', color: '#a1a1aa', fontWeight: 500 }}>Serial ID</span>
                  <strong style={{ color: '#e4e4e7' }}>{selectedDevice.id}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', color: '#a1a1aa', fontWeight: 500 }}>Product</span>
                  <strong style={{ color: '#e4e4e7' }}>{selectedDevice.product || 'N/A'}</strong>
                </div>
              </div>
            </div>

            {/* Segmented Tab Switcher */}
            <div style={{ display: 'flex', background: '#1c1c1e', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <button
                onClick={() => setActiveTab('screen')}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  background: activeTab === 'screen' ? '#27272a' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: activeTab === 'screen' ? '#fff' : '#a1a1aa',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="3" />
                </svg>
                Screen & Mirror
              </button>
              <button
                onClick={() => setActiveTab('ports')}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  background: activeTab === 'ports' ? '#27272a' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: activeTab === 'ports' ? '#fff' : '#a1a1aa',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1" />
                  <path d="M18 8h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4" />
                  <line x1="6" y1="12" x2="10" y2="12" />
                </svg>
                Reverse Ports
              </button>
              <button
                onClick={() => setActiveTab('mobile')}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  background: activeTab === 'mobile' ? '#27272a' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: activeTab === 'mobile' ? '#fff' : '#a1a1aa',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Mobile App
              </button>
            </div>

            {/* Tab content: Screen & Mirror */}
            {activeTab === 'screen' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Screen Mirror & Monitor */}
                <div style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Screen Mirror & Monitor
                  </h3>
                  
                  {/* Screen Mirroring (scrcpy) */}
                  <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                    {scrcpyStatus.missing ? (
                      window.navigator.userAgent.toLowerCase().includes('win') ? (
                        <button
                          onClick={handleInstallScrcpy}
                          disabled={scrcpyStatus.installing || scrcpyStatus.loading}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: 'rgba(56, 189, 248, 0.08)',
                            border: '1px solid rgba(56, 189, 248, 0.2)',
                            borderRadius: '4px',
                            color: '#7dd3fc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {scrcpyStatus.installing ? (
                            <>
                              <RefreshIcon spin={true} />
                              <span>Installing scrcpy...</span>
                            </>
                          ) : (
                            <span>Install scrcpy Mirror</span>
                          )}
                        </button>
                      ) : (
                        <div style={{ flex: 1, padding: '8px', background: '#1c1c1e', borderRadius: '4px', fontSize: '11.5px', color: '#a1a1aa', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', lineHeight: 1.4 }}>
                          Install <code>scrcpy</code> via brew/apt to mirror.
                        </div>
                      )
                    ) : (
                      <button
                        onClick={handleLaunchScrcpy}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          border: '1px solid #38bdf8',
                          borderRadius: '4px',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>Mirror Screen (scrcpy)</span>
                      </button>
                    )}

                    <button
                      onClick={() => setShowScreenPreview(!showScreenPreview)}
                      style={{
                        padding: '8px 12px',
                        background: showScreenPreview ? 'rgba(16, 185, 129, 0.15)' : '#1c1c1e',
                        border: showScreenPreview ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '4px',
                        color: showScreenPreview ? '#34d399' : '#e4e4e7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>{showScreenPreview ? 'Hide Preview' : 'Show Preview'}</span>
                    </button>
                  </div>

                  {/* Embedded Live Preview */}
                  {showScreenPreview && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: '#09090b', padding: '12px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.04)', marginTop: '4px' }}>
                      {screenshotData ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: '180px',
                            borderRadius: '12px',
                            border: '6px solid #1c1c1e',
                            background: '#000',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                            overflow: 'hidden',
                            display: 'flex',
                            justifyContent: 'center'
                          }}>
                            <img
                              src={`data:image/png;base64,${screenshotData}`}
                              alt="Phone Screen Preview"
                              onPointerDown={handlePointerDown}
                              onPointerUp={handlePointerUp}
                              style={{ width: '100%', height: 'auto', display: 'block', cursor: 'pointer', userSelect: 'none', touchAction: 'none' }}
                              draggable={false}
                            />
                          </div>

                        </div>
                      ) : (
                        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa', fontSize: '12px' }}>
                          <RefreshIcon spin={true} />
                          <span style={{ marginLeft: '6px' }}>Capturing screen...</span>
                        </div>
                      )}
                      <span style={{ fontSize: '11px', color: '#a1a1aa', textAlign: 'center', lineHeight: 1.4 }}>Click/drag on preview to tap/swipe. Use scrcpy for smooth 60 FPS.</span>
                    </div>
                  )}

                  {/* Stream Logcat */}
                  <button
                    onClick={handleOpenLogcat}
                    disabled={selectedDevice.status !== 'device'}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      background: '#1c1c1e',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '4px',
                      color: '#e4e4e7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      marginTop: '4px'
                    }}
                  >
                    <TerminalIcon />
                    <span>Stream Logcat (Terminal)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab content: Reverse Ports */}
            {activeTab === 'ports' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {selectedDevice.status !== 'device' ? (
                  <div style={{ padding: '12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '6px', color: '#fbbf24', fontSize: '11px', lineHeight: 1.4, display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                    <WarningIcon size={14} />
                    <span>ADB reverse mappings are only supported on authorized devices. Please check your phone screen to allow USB Debugging.</span>
                  </div>
                ) : (
                  <div style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Reverse Port Bindings
                    </h3>

                    {/* Presets */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '11.5px', color: '#a1a1aa', fontWeight: 500 }}>Quick Presets (PC → Phone)</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[3000, 5173, 8081].map((port) => {
                          const isReversed = activeReversePorts.includes(port);
                          return (
                            <button
                              key={port}
                              onClick={() => isReversed ? handleRemoveReversePort(port) : handleReversePort(port)}
                              disabled={actionLoading}
                              style={{
                                flex: 1,
                                padding: '6px 4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '4px',
                                cursor: 'pointer',
                                background: isReversed ? 'rgba(34, 197, 94, 0.15)' : '#1c1c1e',
                                border: isReversed ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                                color: isReversed ? '#4ade80' : '#d4d4d8',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {isReversed ? `Unbind ${port}` : `Bind ${port}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom Form */}
                    <form onSubmit={handleCustomReverseSubmit} style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11.5px', color: '#a1a1aa', fontWeight: 500, display: 'block', marginBottom: '4px' }}>Custom Port</label>
                        <input
                          type="number"
                          placeholder="e.g. 8080"
                          value={customPort}
                          onChange={(e) => setCustomPort(e.target.value)}
                          disabled={actionLoading}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            background: '#09090b',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            color: '#fff',
                            outline: 'none',
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={actionLoading || !customPort}
                        style={{
                          padding: '6px 12px',
                          background: '#38bdf8',
                          color: '#000',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          height: '28px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Reverse
                      </button>
                    </form>

                    {/* Active Binds list */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '11.5px', color: '#a1a1aa', fontWeight: 500 }}>Active Binds ({activeReversePorts.length})</span>
                      {loadingReversePorts ? (
                        <span style={{ fontSize: '12px', color: '#a1a1aa' }}>Updating...</span>
                      ) : activeReversePorts.length === 0 ? (
                        <span style={{ fontSize: '12px', color: '#a1a1aa' }}>No active reverse configurations.</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {activeReversePorts.map((port) => (
                            <div
                              key={port}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(56, 189, 248, 0.08)',
                                border: '1px solid rgba(56, 189, 248, 0.2)',
                                borderRadius: '4px',
                                padding: '3px 6px',
                                fontSize: '11px',
                                color: '#7dd3fc'
                              }}
                            >
                              <strong>tcp:{port}</strong>
                              <button
                                onClick={() => handleRemoveReversePort(port)}
                                disabled={actionLoading}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#f87171',
                                  cursor: 'pointer',
                                  padding: '0 2px',
                                  fontSize: '11px',
                                  lineHeight: 1
                                }}
                                title="Remove mapping"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* Tab content: Mobile App Session */}
            {activeTab === 'mobile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: '#141416', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h3 style={{ fontSize: '12px', fontWeight: 600, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Mobile App Session
                  </h3>

                  {/* Workspace Info */}
                  <div style={{ padding: '10px', background: '#1c1c1e', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#a1a1aa', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Workspace</span>
                    <strong style={{ fontSize: '12.5px', color: '#fff' }}>{activeWorkspace?.name || 'N/A'}</strong>
                    <span style={{ fontSize: '11px', color: '#a1a1aa', wordBreak: 'break-all' }}>{activeWorkspace?.rootPath || 'N/A'}</span>
                  </div>

                  {/* Stack Detection Status */}
                  {detectingStack ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#a1a1aa', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <RefreshIcon spin={true} />
                      <span>Detecting mobile stack...</span>
                    </div>
                  ) : mobileStack ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      
                      {/* Detected Stack & Confidence Badges */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Detected Stack</span>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            background: mobileStack.type === 'unknown' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(56, 189, 248, 0.15)',
                            color: mobileStack.type === 'unknown' ? '#ef4444' : '#38bdf8',
                            border: mobileStack.type === 'unknown' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(56, 189, 248, 0.25)',
                            textTransform: 'capitalize',
                            textAlign: 'center'
                          }}>
                            {mobileStack.type === 'react-native' ? 'React Native CLI' :
                             mobileStack.type === 'native-android' ? 'Native Android' :
                             mobileStack.type}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confidence</span>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            background: mobileStack.confidence === 'high' ? 'rgba(34, 197, 94, 0.15)' :
                                        mobileStack.confidence === 'medium' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                            color: mobileStack.confidence === 'high' ? '#4ade80' :
                                   mobileStack.confidence === 'medium' ? '#fbbf24' : '#f87171',
                            border: mobileStack.confidence === 'high' ? '1px solid rgba(34, 197, 94, 0.25)' :
                                    mobileStack.confidence === 'medium' ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)',
                            textTransform: 'uppercase',
                            textAlign: 'center'
                          }}>
                            {mobileStack.confidence}
                          </span>
                        </div>
                      </div>

                      {/* Reasons */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Detection Reasons</span>
                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '11px', color: '#a1a1aa', display: 'flex', flexDirection: 'column', gap: '4px', lineHeight: 1.4 }}>
                          {mobileStack.reasons.map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      </div>

                      {/* ADB / Device Guard warnings */}
                      {adbStatus.missing ? (
                        <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', fontSize: '11px', lineHeight: 1.4 }}>
                          <strong>ADB is missing.</strong> Device run is disabled. Please configure ADB in setup checklist.
                        </div>
                      ) : selectedDevice?.status !== 'device' ? (
                        <div style={{ padding: '10px 12px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontSize: '11px', lineHeight: 1.4 }}>
                          Connect and authorize an Android device first.
                        </div>
                      ) : null}

                      {/* Suggested Commands List */}
                      {mobileStack.type === 'unknown' ? (
                        <div style={{ padding: '12px', background: '#1c1c1e', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px', textAlign: 'center', fontSize: '12px', color: '#a1a1aa', lineHeight: 1.5 }}>
                          No mobile stack detected in this workspace. If this is a hybrid project, you can run manually in the terminal workspace.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}>
                          <span style={{ fontSize: '11px', color: '#a1a1aa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Suggested Commands</span>
                          
                          {mobileStack.suggestedCommands.map((cmdInfo, idx) => {
                            const isAlternative = idx > 0;
                            return (
                              <div key={idx} style={{
                                padding: '12px',
                                background: isAlternative ? '#18181b' : 'rgba(56, 189, 248, 0.03)',
                                border: isAlternative ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(56, 189, 248, 0.1)',
                                borderRadius: '6px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: isAlternative ? '#a1a1aa' : '#38bdf8' }}>
                                    {isAlternative ? 'Alternative Option' : cmdInfo.label}
                                  </span>
                                  {cmdInfo.requiresBuild && (
                                    <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                                      Build/Install
                                    </span>
                                  )}
                                </div>
                                
                                <div style={{
                                  padding: '6px 8px',
                                  background: '#09090b',
                                  borderRadius: '4px',
                                  fontFamily: 'monospace',
                                  fontSize: '11px',
                                  color: '#e4e4e7',
                                  border: '1px solid rgba(255,255,255,0.04)',
                                  wordBreak: 'break-all'
                                }}>
                                  {cmdInfo.command.includes('DEVICE_ID_PLACEHOLDER') && selectedDeviceId
                                    ? cmdInfo.command.replace('DEVICE_ID_PLACEHOLDER', selectedDeviceId)
                                    : cmdInfo.command}
                                </div>

                                {cmdInfo.note && (
                                  <span style={{ fontSize: '11.5px', color: '#a1a1aa', lineHeight: 1.4 }}>
                                    {cmdInfo.note}
                                  </span>
                                )}

                                <button
                                  onClick={() => handleRunCommand(cmdInfo.command)}
                                  disabled={runningCommand || adbStatus.missing || selectedDevice?.status !== 'device'}
                                  style={{
                                    width: '100%',
                                    padding: '6px 12px',
                                    background: runningCommand ? '#27272a' : (isAlternative ? '#27272a' : '#38bdf8'),
                                    color: isAlternative ? '#fff' : '#000',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    opacity: (runningCommand || adbStatus.missing || selectedDevice?.status !== 'device') ? 0.5 : 1
                                  }}
                                >
                                  {runningCommand ? (
                                    <>
                                      <RefreshIcon spin={true} />
                                      <span>Launching Session...</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ fill: isAlternative ? 'none' : 'currentColor' }}>
                                        <polygon points="5 3 19 12 5 21 5 3" />
                                      </svg>
                                      <span>Run on Android Device</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Log Action Shortcuts */}
                      <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}>
                        <button
                          onClick={handleOpenLogcat}
                          disabled={selectedDevice?.status !== 'device'}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            background: '#1c1c1e',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '4px',
                            color: '#e4e4e7',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            opacity: selectedDevice?.status !== 'device' ? 0.5 : 1
                          }}
                        >
                          <TerminalIcon />
                          <span>Open Logcat</span>
                        </button>
                        <button
                          onClick={() => {
                            const paneId = findExistingPaneId();
                            if (paneId) {
                              useDeckStore.getState().selectPane(paneId);
                              setSuccessMessage(`Switched focus to existing "${terminalTitle}" terminal.`);
                            } else {
                              setError(`No active "${terminalTitle}" terminal running yet.`);
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: '6px 12px',
                            background: '#1c1c1e',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '4px',
                            color: '#e4e4e7',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                          </svg>
                          <span>Open App Terminal</span>
                        </button>
                      </div>

                    </div>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#a1a1aa', fontSize: '12px' }}>
                      Unable to run stack detection.
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Collapsible Setup Helper */}
        <details
          style={{
            background: '#141416',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            padding: '10px'
          }}
          open={showHelp}
          onToggle={(e) => setShowHelp((e.target as HTMLDetailsElement).open)}
        >
          <summary style={{ fontSize: '12px', fontWeight: 600, color: '#f4f4f5', cursor: 'pointer', outline: 'none', userSelect: 'none' }}>
            Setup Checklist & Help
          </summary>
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <ol style={{ fontSize: '12px', color: '#a1a1aa', paddingLeft: '14px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', lineHeight: 1.5 }}>
              <li><strong style={{ color: '#e4e4e7' }}>ADB Install:</strong> Make sure <code>adb</code> is installed on your computer.</li>
              <li><strong style={{ color: '#e4e4e7' }}>PATH Check:</strong> Ensure platform-tools folder is added to system environment path.</li>
              <li><strong style={{ color: '#e4e4e7' }}>Developer Options:</strong> Open Settings, go to About Phone, and tap Build Number 7 times.</li>
              <li><strong style={{ color: '#e4e4e7' }}>USB Debugging:</strong> Toggle "USB Debugging" on in the Developer options menu.</li>
              <li><strong style={{ color: '#e4e4e7' }}>Connect:</strong> Connect your device via USB cable and select file-transfer mode.</li>
              <li><strong style={{ color: '#e4e4e7' }}>Authorize:</strong> Grant permissions when the USB Debugging fingerprint pop-up appears on your device screen.</li>
            </ol>
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingTop: '10px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#a1a1aa',
              lineHeight: 1.5
            }}>
              <strong style={{ color: '#e4e4e7' }}>Reverse Port Mapping:</strong> Essential for native frameworks (Expo, React Native). It redirects device local server calls back to your computer (e.g. phone call to <code>localhost:8081</code> goes to PC's <code>8081</code>).
            </div>
          </div>
        </details>

      </div>

    </div>
  );
}

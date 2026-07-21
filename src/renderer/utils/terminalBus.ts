import type { TerminalLifecycleEvent, TerminalOutputEvent } from '../../shared/types';

type OutputListener = (event: TerminalOutputEvent) => void;
type LifecycleListener = (event: TerminalLifecycleEvent) => void;
type ClearListener = (paneId: string) => void;
type RestartListener = (paneId: string) => void;

const outputListeners = new Set<OutputListener>();
const lifecycleListeners = new Set<LifecycleListener>();
const clearListeners = new Set<ClearListener>();
const restartListeners = new Set<RestartListener>();
let outputAttached = false;
let lifecycleAttached = false;

export function subscribeTerminalOutput(listener: OutputListener) {
  outputListeners.add(listener);

  if (!outputAttached) {
    outputAttached = true;
    window.agentDeck.onTerminalData((event) => {
      outputListeners.forEach((item) => item(event));
    });
  }

  return () => {
    outputListeners.delete(listener);
  };
}

export function subscribeTerminalLifecycle(listener: LifecycleListener) {
  lifecycleListeners.add(listener);

  if (!lifecycleAttached) {
    lifecycleAttached = true;
    window.agentDeck.onTerminalLifecycle((event) => {
      lifecycleListeners.forEach((item) => item(event));
    });
  }

  return () => {
    lifecycleListeners.delete(listener);
  };
}

export function publishTerminalClear(paneId: string) {
  clearListeners.forEach((listener) => listener(paneId));
}

export function subscribeTerminalClear(listener: ClearListener) {
  clearListeners.add(listener);

  return () => {
    clearListeners.delete(listener);
  };
}

/** Ask the live TerminalPane to restart with correct cols/rows + buffer clear. */
export function publishTerminalRestart(paneId: string) {
  restartListeners.forEach((listener) => listener(paneId));
}

export function subscribeTerminalRestart(listener: RestartListener) {
  restartListeners.add(listener);

  return () => {
    restartListeners.delete(listener);
  };
}

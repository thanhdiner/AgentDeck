import type { AgentDeckApi } from '../../preload/preload';

declare global {
  interface Window {
    agentDeck: AgentDeckApi;
  }
}

export {};

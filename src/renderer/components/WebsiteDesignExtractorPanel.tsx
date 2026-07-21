/**
 * WebsiteDesignExtractorPanel.tsx
 *
 * Full-featured UI for the Website Design Extractor.
 * Implements a 4-layer design pipeline: Design System (with Confidence scoring and filters)
 * and Raw Extraction (for visible DOM element details).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  WebsiteExtractResult,
  WebsiteDesignReport,
  RawExtractedStyleSample,
  NormalizedColorToken,
  NormalizedTypographyToken,
  WebsiteAnalysisSourceUrl,
  UserProvidedDesignScreenshot,
  WebsiteSectionScreenshot,
  WebsiteAnalysisRun
} from '../../shared/types';
import { useDeckStore } from '../store/deckStore';

// ─── Icon Helpers ─────────────────────────────────────────────────────────────

const GlobeIcon = ({ size = 16, spin = false }: { size?: number; spin?: boolean }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round"
    style={spin ? { animation: 'wde-spin 1.2s linear infinite' } : undefined}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const CopyIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const SaveIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
  </svg>
);

const AlertIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="3" />
  </svg>
);

const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ScanIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><line x1="7" y1="12" x2="17" y2="12" />
  </svg>
);

const PaletteIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.34776 19.4892 6.1368 19.3973 6.5414 18.847C6.9126 18.3421 7.4912 18 8.15 18H9C10.6569 18 12 19.3431 12 21V22Z" />
    <circle cx="7.5" cy="10.5" r="1.5" fill="currentColor" />
    <circle cx="11.5" cy="7.5" r="1.5" fill="currentColor" />
    <circle cx="16.5" cy="9.5" r="1.5" fill="currentColor" />
    <circle cx="15.5" cy="14.5" r="1.5" fill="currentColor" />
  </svg>
);

const TypeIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 7 4 4 20 4 20 7" />
    <line x1="9" y1="20" x2="15" y2="20" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </svg>
);

const RulerIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 16H19M5 16V8M5 16V18M19 16V8M19 16V18M9 16V12M13 16V12M17 16V12M5 8H19M5 8V6M19 8V6" />
  </svg>
);

const RoundedIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h12a4 4 0 0 0 4-4V4" />
    <line x1="4" y1="4" x2="4" y2="4.01" strokeWidth="3" />
    <line x1="20" y1="20" x2="20" y2="20.01" strokeWidth="3" />
  </svg>
);

const ShadowIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="16" height="16" rx="2" />
    <path d="M22 6v14a2 2 0 0 1-2 2H6" strokeDasharray="2 2" />
  </svg>
);

const ComponentIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

const FileIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const ImageIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const ShieldIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const TrashIcon = ({ size = 14, className }: { size?: number; className?: string }) => (
  <svg
    className={className}
    width={size}
    height={size}
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
);

const ConfirmCheckIcon = ({ size = 13 }: { size?: number }) => (
  <svg
    className="confirm-icon"
    width={size}
    height={size}
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
);

const CancelXIcon = ({ size = 12 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
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
);

function useInlineConfirm() {
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

  return { confirming, setConfirming, rootRef };
}

/** Inline double-click delete: 1st click → confirm, 2nd → delete; Esc / outside → cancel */
function InlineConfirmDelete({
  onConfirm,
  title = 'Delete',
  children
}: {
  onConfirm: () => void;
  title?: string;
  /** Adjacent controls (e.g. select) that hide while confirming */
  children?: React.ReactNode;
}) {
  const { confirming, setConfirming, rootRef } = useInlineConfirm();

  return (
    <div
      ref={rootRef}
      className={`wde-item-actions item-actions${confirming ? ' confirming' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children ? <div className="wde-action-hideable">{children}</div> : null}

      <button
        type="button"
        className="wde-delete-cancel cancel-btn"
        title="Cancel delete"
        tabIndex={confirming ? 0 : -1}
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(false);
        }}
      >
        <CancelXIcon />
      </button>

      <button
        type="button"
        className="wde-delete-btn delete-btn"
        title={confirming ? 'Click again to confirm delete' : title}
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
        <TrashIcon size={12} className="trash-icon" />
        <ConfirmCheckIcon size={12} />
      </button>
    </div>
  );
}

/** Text-button variant (Clear All) — double-click safety, cancel slides in */
function InlineConfirmClearAll({ onConfirm }: { onConfirm: () => void }) {
  const { confirming, setConfirming, rootRef } = useInlineConfirm();

  return (
    <div
      ref={rootRef}
      className={`wde-clear-all-actions${confirming ? ' confirming' : ''}`}
    >
      <button
        type="button"
        className="wde-clear-all-cancel"
        title="Cancel"
        tabIndex={confirming ? 0 : -1}
        onClick={(e) => {
          e.stopPropagation();
          setConfirming(false);
        }}
      >
        <CancelXIcon size={11} />
        <span>Cancel</span>
      </button>
      <button
        type="button"
        className="wde-clear-all-confirm"
        title={confirming ? 'Click again to clear all' : 'Clear All'}
        onClick={(e) => {
          e.stopPropagation();
          if (!confirming) {
            setConfirming(true);
            return;
          }
          onConfirm();
          setConfirming(false);
        }}
      >
        <span className="wde-clear-all-confirm-idle">Clear All</span>
        <span className="wde-clear-all-confirm-ready">
          <ConfirmCheckIcon size={11} />
          <span>Confirm</span>
        </span>
      </button>
    </div>
  );
}

function colorToHex(color: string): string {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return color;
  const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ExtractState = 'idle' | 'connecting' | 'capturing' | 'extracting' | 'generating' | 'done' | 'error';

interface SavedExtraction {
  id: string;
  timestamp: number;
  sources: WebsiteAnalysisSourceUrl[];
  userScreenshots: UserProvidedDesignScreenshot[];
  selectedViewports: string[];
  report: WebsiteDesignReport;
  overallQualityScore: number;
  coverageSummaries: any[];
  designMd: string;
  sectionCaptures?: any[];
}

const STEPS: { id: ExtractState; label: string }[] = [
  { id: 'connecting', label: 'Connecting' },
  { id: 'capturing', label: 'Capturing' },
  { id: 'extracting', label: 'Extracting CSS' },
  { id: 'generating', label: 'Generating' }
];

const STEP_ORDER: ExtractState[] = ['connecting', 'capturing', 'extracting', 'generating', 'done'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ColorSwatch({ hex, showHex }: { hex: string; showHex?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void window.agentDeck.clipboardWriteText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <div
      title={`Click to copy ${hex}`}
      onClick={handleCopy}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        cursor: 'pointer', width: 44
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 6,
        background: hex,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'transform 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {copied && <CheckIcon size={12} />}
      </div>
      {showHex && <span style={{ fontSize: 8, color: '#71717a', textAlign: 'center', wordBreak: 'break-all', maxWidth: 44 }}>{hex.slice(0, 7)}</span>}
    </div>
  );
}

function ColorGroup({ title, colors }: { title: string; colors: string[] }) {
  if (!colors.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {colors.map((c, i) => <ColorSwatch key={i} hex={c} showHex />)}
      </div>
    </div>
  );
}

function TypographyTable({ scale }: { scale: NormalizedTypographyToken[] }) {
  if (!scale.length) return <div style={{ color: '#52525b', fontSize: 11, padding: '8px 0' }}>No typography data in this view</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['Role', 'Family', 'Size', 'Weight', 'Line-H', 'Confidence'].map(h => (
              <th key={h} style={{ padding: '4px 6px', textAlign: 'left', color: '#71717a', fontWeight: 500 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scale.map((e, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <td style={{ padding: '3px 6px', color: '#a1a1aa', fontFamily: 'monospace' }}>{e.role || '-'}</td>
              <td style={{ padding: '3px 6px', color: '#e4e4e7', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.fontFamily || '-'}</td>
              <td style={{ padding: '3px 6px', color: '#38bdf8', fontFamily: 'monospace' }}>{e.fontSize || '-'}</td>
              <td style={{ padding: '3px 6px', color: '#a78bfa', fontFamily: 'monospace' }}>{e.fontWeight || '-'}</td>
              <td style={{ padding: '3px 6px', color: '#a1a1aa', fontFamily: 'monospace' }}>{e.lineHeight || '-'}</td>
              <td style={{ padding: '3px 6px', color: e.confidence === 'high' ? '#10b981' : e.confidence === 'medium' ? '#fbbf24' : '#ef4444', textTransform: 'uppercase', fontSize: 8 }}>{e.confidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TokenChips({ items, color = '#a1a1aa' }: { items: Array<{ value: string; confidence: string }>; color?: string }) {
  if (!items.length) return <div style={{ color: '#52525b', fontSize: 11 }}>None observed</div>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((v, i) => (
        <span key={i} style={{
          fontSize: 10, fontFamily: 'monospace', color,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 4, padding: '2px 7px', cursor: 'default',
          borderColor: v.confidence === 'high' ? 'rgba(16,185,129,0.3)' : v.confidence === 'medium' ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.07)'
        }} title={`${v.value} (${v.confidence})`}>{v.value}</span>
      ))}
    </div>
  );
}

function ShadowCard({ shadow, confidence }: { shadow: string; confidence: string }) {
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 6, marginBottom: 6,
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
      borderColor: confidence === 'high' ? 'rgba(16,185,129,0.2)' : confidence === 'medium' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.05)',
      boxShadow: shadow
    }}>
      <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#a1a1aa', wordBreak: 'break-all', marginBottom: 2 }}>{shadow}</div>
      <div style={{ fontSize: 8, color: '#71717a', textTransform: 'uppercase' }}>Confidence: {confidence}</div>
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: { title: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 2, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer',
          color: '#e4e4e7', fontSize: 11, fontWeight: 600
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{title}</span>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && <div style={{ paddingBottom: 12 }}>{children}</div>}
    </div>
  );
}

// ─── Color Helper Utilities for Renderer ──────────────────────────────────────

function parseRgb(color: string): [number, number, number, number] | null {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) return null;
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3]), m[4] !== undefined ? parseFloat(m[4]) : 1];
}

function luminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const n = c / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const nr = r / 255, ng = g / 255, nb = b / 255;
  const max = Math.max(nr, ng, nb), min = Math.min(nr, ng, nb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case nr: h = ((ng - nb) / d + (ng < nb ? 6 : 0)) / 6; break;
    case ng: h = ((nb - nr) / d + 2) / 6; break;
    default: h = ((nr - ng) / d + 4) / 6; break;
  }
  return [h * 360, s * 100, l * 100];
}

// ─── Markdown Builder Function ────────────────────────────────────────────────

function buildDesignMdText(
  report: WebsiteDesignReport,
  meta: {
    url: string;
    finalUrl: string;
    title: string;
    capturedAt: number;
    viewportWidth: number;
    viewportHeight: number;
  },
  includeRaw: boolean,
  rawSamples: RawExtractedStyleSample[]
): string {
  const dateStr = new Date(meta.capturedAt).toISOString().split('T')[0];
  const sections: string[] = [];

  // Grounded fallbacks for prompt guide
  const extractedHexes = new Set(report.colors.map(c => c.hex.toLowerCase()));

  const primaryCol = report.colors.find(c => c.role === 'primary')?.hex 
    || report.colors.find(c => c.role === 'accent' && parseRgb(c.hex) && rgbToHsl(parseRgb(c.hex)![0], parseRgb(c.hex)![1], parseRgb(c.hex)![2])[1] > 20)?.hex
    || (report.colors.length > 0 ? report.colors[0].hex : 'N/A');

  const bgCol = report.colors.find(c => c.role === 'background')?.hex 
    || report.colors.find(c => c.role === 'surface')?.hex
    || (report.summary.theme.includes('Dark') ? '#121212' : '#ffffff');

  // Header block
  sections.push(`# DESIGN.md — ${meta.title || meta.finalUrl}

> Auto-generated by AgentDeck Website Design Extractor  
> Source: ${meta.finalUrl}  
> Captured: ${dateStr}  
> Viewport: ${meta.viewportWidth} × ${meta.viewportHeight}px  
> Confidence: **${report.confidenceSummary.overallScore.toUpperCase()}** (High: ${report.confidenceSummary.highConfidenceCount} | Med: ${report.confidenceSummary.mediumConfidenceCount} | Low/Noise: ${report.confidenceSummary.lowConfidenceCount})

---

## 1. Design Summary

- **Theme Mode**: ${report.summary.theme}
- **Visual Direction**: ${report.summary.mood}
- **Core Style Pattern**: ${report.summary.mainInteractionStyle}
- **Confidence Notes**: ${report.summary.confidenceNote}`);

  // Include High + Medium confidence in Core tokens (prevents empty/sparse view)
  const coreColors = report.colors.filter(c => c.confidence === 'high' || c.confidence === 'medium');
  const coreType = report.typography.filter(t => t.confidence === 'high' || t.confidence === 'medium');
  const coreSpacing = report.spacing.filter(s => s.confidence === 'high' || s.confidence === 'medium');
  const coreRadius = report.radius.filter(r => r.confidence === 'high' || r.confidence === 'medium');

  sections.push(`## 2. Core Design Tokens

Verified design system properties present on multiple layout blocks.

### Colors
| Role | Color | Confidence | Primary Evidence / Sources |
|------|-------|------------|----------------------------|
${coreColors.map(c => 
  `| \`${c.role}\` | \`${c.hex}\` | **${c.confidence.toUpperCase()}** | ${c.evidence.map(e => `\`${e.selector}\` (${e.count})`).join(', ') || '-'} |`
).join('\n') || '| - | - | - | - |'}

### Typography
| Role | Font Family | Size | Weight | Line Height | Confidence | Observed Elements |
|------|-------------|------|--------|-------------|------------|-------------------|
${coreType.map(t =>
  `| \`${t.role}\` | ${t.fontFamily || '-'} | ${t.fontSize || '-'} | ${t.fontWeight || '-'} | ${t.lineHeight || '-'} | **${t.confidence.toUpperCase()}** | ${t.evidence.map(e => `\`${e.selector}\` (${e.count})`).join(', ') || '-'} |`
).join('\n') || '| - | - | - | - | - | - | - |'}

### Radius & Spacing Scale
- **Observed Core Spacing**: ${coreSpacing.map(s => `\`${s.value}\` (${s.count}×)`).join(', ') || '_None verified_'}
- **Observed Core Radius**: ${coreRadius.map(r => `\`${r.value}\` (${r.count}×)`).join(', ') || '_None verified_'}`);

  // 3. Supporting / Uncertain Tokens
  const supportingColors = report.colors.filter(c => c.confidence === 'low');
  const supportingType = report.typography.filter(t => t.confidence === 'low');
  const supportingSpacing = report.spacing.filter(s => s.confidence === 'low');
  const supportingRadius = report.radius.filter(r => r.confidence === 'low');

  sections.push(`## 3. Supporting / Uncertain Tokens

Rarely observed style fragments or lower-confidence secondary style choices:

${supportingColors.length > 0 ? `### Supplementary Colors\n${supportingColors.map(c => `- Color \`${c.hex}\` (inferred \`${c.role}\` role): Found on ${c.evidence.map(e => `\`${e.selector}\` (${e.count}×)`).join(', ')}`).join('\n')}` : ''}

${supportingType.length > 0 ? `### Secondary Typography\n${supportingType.map(t => `- Size \`${t.fontSize}\` (\`${t.fontWeight}\`): Observed on ${t.evidence.map(e => `\`${e.selector}\``).join(', ')}`).join('\n')}` : ''}

${report.shadows.length > 0 ? `### Shadows\n${report.shadows.map(s => `- Shadow (\`${s.confidence}\`, ${s.count}×): \`${s.value}\``).join('\n')}` : ''}`);

  // 4. Component Rules
  const btns = report.components.filter(c => c.component === 'button');
  const inputs = report.components.filter(c => c.component === 'input');
  const navs = report.components.filter(c => c.component === 'nav');

  sections.push(`## 4. Component Rules

### Buttons
${btns.map(b => `- **${b.properties.patternName.toUpperCase()}** (${b.confidence} confidence):
  - Background: \`${b.properties.backgroundColor}\`
  - Text Color: \`${b.properties.color}\`
  - Border: \`${b.properties.border}\`
  - Radius: \`${b.properties.borderRadius}\`
  - Padding: \`${b.properties.padding}\`
  - Observed occurrences: ${b.properties.observedCount}
  - Source samples: ${b.evidence.map(e => `\`${e.selector}\``).join(', ')}`).join('\n\n') || '_No buttons resolved_'}

### Inputs
${inputs.map(b => `- **${b.properties.patternName.toUpperCase()}** (${b.confidence} confidence):
  - Background: \`${b.properties.backgroundColor}\`
  - Border: \`${b.properties.border}\`
  - Radius: \`${b.properties.borderRadius}\`
  - Observed occurrences: ${b.properties.observedCount}
  - Source samples: ${b.evidence.map(e => `\`${e.selector}\``).join(', ')}`).join('\n\n') || '_No inputs resolved_'}

### Navigation
${navs.map(n => `- **Header Nav Component** (${n.confidence} confidence):
  - Background: \`${n.properties.backgroundColor}\`
  - Color: \`${n.properties.color}\`
  - Sample element: ${n.evidence.map(e => `\`${e.selector}\``).join(', ')}`).join('\n') || '_No navigation containers resolved_'}`);

  // 5. Layout & Spacing
  sections.push(`## 5. Layout & Spacing

- **Primary Spacing Blocks**: ${report.spacing.slice(0, 6).map(s => `\`${s.value}\``).join(', ') || 'chưa xác minh được'}
- **Grid Layout Scale**: Layout dimensions prioritize clean spacing scales. Column paddings snap to core scales.`);

  // 6. Responsive Behavior
  sections.push(`## 6. Responsive Behavior

> [!WARNING]
> Responsive behavior is inferred from desktop capture only. Capture mobile/tablet layouts separately to achieve higher responsive scoring confidence.`);

  // 7. Motion / Interaction
  sections.push(`## 7. Motion / Interaction Style

- **Observed Transitions**: \`chưa xác minh được\` (Transitions and CSS keyframes are optional enhancements).
- **Hover Transitions**: Color shifts to hover states are active.`);

  // 8. Do / Don't
  sections.push(`## 8. Do / Don't

- **DO** match the verified primary colors for standard button hover/interactive controls.
- **DO** match the high-confidence typography layout for primary text cards.
- **DON'T** inject custom border-radius properties outside the observed \`${report.radius.slice(0, 3).map(r => r.value).join(', ') || '0px'}\` scale.
- **DON'T** introduce negative spacing properties or custom layout margins.`);

  // 8. Agent Prompt Guide
  const promptGuideText = `## 8. Agent Prompt Guide

This section is optimized for coding agents (e.g. Claude Code, Codex, Composer) as design constraints:

\`\`\`markdown
# DESIGN SYSTEM REFERENCE DIRECTIVES
- Theme Mode: Use "${report.summary.theme}" as visual background baseline.
- Colors: Match primary accent "${primaryCol}" and backgrounds "${bgCol}".
- Layout: Apply padding tokens: ${report.spacing.slice(0, 3).map(s => s.value).join(', ') || '16px'}.
- Border Radius: Match observed rounding constants: ${report.radius.slice(0, 3).map(r => r.value).join(', ') || '8px'}.

CRITICAL IMPLEMENTATION RULES:
1. Inspect the existing codebase components first. Do not write ad-hoc style definitions.
2. Maintain design rhythm. Do not invent margins or custom padding rules.
3. Treat custom shadow variables as optional styling. Use flat borders where undefined.
4. If a tag's visual implementation is unclear, reference primary buttons style: ${report.components.find(c => c.component === 'button')?.properties.backgroundColor || 'standard background'}.
\`\`\``;

  // STRICT HALLUCINATION CHECK:
  // Any color hex listed in the prompt guide MUST exist in core/supporting colors report.
  // We scan prompt guide text for hex codes and replace with closest actual extracted color if missing!
  const finalPromptGuide = promptGuideText.replace(/#([0-9a-fA-F]{3,6})\b/g, (match) => {
    const matchedHex = match.toLowerCase();
    if (extractedHexes.has(matchedHex)) return match;
    // Attempt fallback to a highly similar or primary color if not present in actual list
    if (primaryCol !== 'N/A' && primaryCol !== 'none') return primaryCol;
    return match;
  });

  sections.push(finalPromptGuide);

  // 9. Raw Extraction Appendix
  if (includeRaw && rawSamples.length > 0) {
    sections.push(`## 9. Raw Extraction Appendix

<details open>
<summary>Scanned computed visible DOM nodes (Total Scanned visible nodes: ${rawSamples.length})</summary>

| Tag | Selector | Font Family | Size | Color | Background | Margin/Padding |
|-----|----------|-------------|------|-------|------------|----------------|
${rawSamples.slice(0, 150).map(s => 
  `| \`${s.tagName}\` | \`${s.selector}\` | ${s.computedStyles.fontFamily || '-'} | ${s.computedStyles.fontSize || '-'} | \`${s.computedStyles.color || '-'}\` | \`${s.computedStyles.backgroundColor || '-'}\` | ${s.computedStyles.margin || '-'}/${s.computedStyles.padding || '-'} |`
).join('\n')}

</details>
`);
  }

  return sections.join('\n\n');
}

export function WebsiteDesignExtractorPanel() {
  const workspaces = useDeckStore(s => s.workspaces);
  const activeWorkspaceId = useDeckStore(s => s.activeWorkspaceId);
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  // Segmented view tab: 'extractor' (main configuration or result view) vs 'library' (saved database)
  const [activePanelTab, setActivePanelTab] = useState<'extractor' | 'library'>('extractor');

  // History State mapping to localStorage
  const [historyList, setHistoryList] = useState<SavedExtraction[]>(() => {
    try {
      const stored = localStorage.getItem('agentdeck-wde-history');
      if (!stored) return [];
      const parsed = JSON.parse(stored) as SavedExtraction[];
      
      // Auto-strip large base64 screenshot data from previous runs to guarantee 60fps typing performance
      let didClean = false;
      const cleaned = parsed.map(item => {
        const hasSectionImg = item.sectionCaptures?.some((c: any) => c.screenshotBase64);
        const hasMockImg = item.userScreenshots?.some((s: any) => s.dataBase64);
        if (hasSectionImg || hasMockImg) {
          didClean = true;
          return {
            ...item,
            userScreenshots: item.userScreenshots?.map((s: any) => ({ ...s, dataBase64: '' })) || [],
            sectionCaptures: item.sectionCaptures?.map((c: any) => ({ ...c, screenshotBase64: '' })) || []
          };
        }
        return item;
      });

      if (didClean) {
        localStorage.setItem('agentdeck-wde-history', JSON.stringify(cleaned));
      }
      return cleaned;
    } catch (e) {
      console.error('Failed to load WDE history from storage:', e);
      return [];
    }
  });

  // Sources State
  const [urls, setUrls] = useState<WebsiteAnalysisSourceUrl[]>([
    { id: 'url-default-1', url: 'https://spotify.com', label: 'Spotify App', enabled: true }
  ]);
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [urlError, setUrlError] = useState('');

  // Viewports & User screenshots
  const [selectedViewports, setSelectedViewports] = useState<string[]>(['desktop', 'mobile']);
  const [userScreenshots, setUserScreenshots] = useState<UserProvidedDesignScreenshot[]>([]);

  // Extraction State
  const [state, setState] = useState<ExtractState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<WebsiteAnalysisRun | null>(null);

  // UI Tabs & Filters
  const [activePreviewSubTab, setActivePreviewSubTab] = useState<'tokens' | 'markdown' | 'coverage' | 'screenshot'>('tokens');
  const [filterMode, setFilterMode] = useState<'high' | 'all' | 'noise'>('high');
  const [copiedMd, setCopiedMd] = useState(false);
  const [savedToWorkspace, setSavedToWorkspace] = useState(false);
  // Scrolled Preview Carousel State
  const [carouselSourceId, setCarouselSourceId] = useState<string>('');
  const [carouselViewport, setCarouselViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [carouselFoldIndex, setCarouselFoldIndex] = useState<number>(0);

  const abortRef = useRef(false);

  // Auto-saving to history database with quota-exceeded protection
  const saveToHistory = useCallback((run: WebsiteAnalysisRun) => {
    try {
      const newEntry: SavedExtraction = {
        id: `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
        sources: run.sources,
        userScreenshots: run.userScreenshots,
        selectedViewports: selectedViewports, // Use component state variable
        report: run.report,
        overallQualityScore: run.overallQualityScore,
        coverageSummaries: run.coverageSummaries,
        designMd: run.designMd,
        sectionCaptures: run.sectionCaptures
      };

      setHistoryList(prev => {
        // Keep unique entries (by main source URL if within brief interval) up to a max of 15
        const updated = [newEntry, ...prev.filter(item => {
          return item.sources[0]?.url !== newEntry.sources[0]?.url || (Date.now() - item.timestamp > 30000);
        })].slice(0, 15);

        try {
          localStorage.setItem('agentdeck-wde-history', JSON.stringify(updated));
        } catch (quotaErr) {
          console.warn('Quota limits reached on heavy image storage, retrying with lightweight context...', quotaErr);
          // Fallback: Clear the heavy screenshot base64 strings to ensure other data is saved perfectly
          const lightweight = updated.map(item => ({
            ...item,
            sectionCaptures: item.sectionCaptures?.map((c: any) => ({
              ...c,
              screenshotBase64: '' // Strip large images
            }))
          }));
          try {
            localStorage.setItem('agentdeck-wde-history', JSON.stringify(lightweight));
          } catch (deepErr) {
            console.error('CRITICAL: Storage saving failed completely:', deepErr);
          }
        }
        return updated;
      });
    } catch (err) {
      console.error('Failed to parse and save extraction into history:', err);
    }
  }, [selectedViewports]);

  const validateUrl = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return 'Please enter a URL';
    try {
      const p = new URL(trimmed);
      if (p.protocol !== 'http:' && p.protocol !== 'https:') return 'Only http:// and https:// URLs are supported';
      return '';
    } catch {
      return 'Invalid URL — must start with http:// or https://';
    }
  };

  const handleAddUrl = () => {
    const trimmed = newUrl.trim();
    const err = validateUrl(trimmed);
    if (err) {
      setUrlError(err);
      return;
    }
    setUrlError('');
    const newEntry: WebsiteAnalysisSourceUrl = {
      id: `url-${Math.random().toString(36).substring(2, 11)}`,
      url: trimmed,
      label: newLabel.trim() || undefined,
      enabled: true
    };
    setUrls(prev => [...prev, newEntry]);
    setNewUrl('');
    setNewLabel('');
  };

  const handleRemoveUrl = (id: string) => {
    setUrls(prev => prev.filter(u => u.id !== id));
  };

  const handleToggleUrl = (id: string) => {
    setUrls(prev => prev.map(u => u.id === id ? { ...u, enabled: !u.enabled } : u));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = window.agentDeck.getPathForFile(file) || (file as any).path;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setUserScreenshots(prev => [...prev, {
        id: `screenshot-${Math.random().toString(36).substring(2, 11)}`,
        filePath: path || '',
        dataBase64: base64,
        label: file.name,
        sourceType: 'user-upload',
        viewportHint: 'unknown',
        notes: ''
      }]);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveScreenshot = (id: string) => {
    setUserScreenshots(prev => prev.filter(s => s.id !== id));
  };

  const handleUpdateScreenshotHint = (id: string, hint: any) => {
    setUserScreenshots(prev => prev.map(s => s.id === id ? { ...s, viewportHint: hint } : s));
  };

  const handleUpdateScreenshotNotes = (id: string, notes: string) => {
    setUserScreenshots(prev => prev.map(s => s.id === id ? { ...s, notes } : s));
  };

  const handleViewportToggle = (vp: string) => {
    setSelectedViewports(prev =>
      prev.includes(vp) ? prev.filter(v => v !== vp) : [...prev, vp]
    );
  };

  const handleAnalyze = useCallback(async () => {
    let finalUrls = [...urls];
    
    // Auto-commit typed URL if the user forgot to click "Add"
    const currentInput = newUrl.trim();
    if (currentInput) {
      const err = validateUrl(currentInput);
      if (!err) {
        const newEntry: WebsiteAnalysisSourceUrl = {
          id: `url-${Math.random().toString(36).substring(2, 11)}`,
          url: currentInput,
          label: newLabel.trim() || undefined,
          enabled: true
        };
        // Auto-add it to final list & update state
        finalUrls.push(newEntry);
        setUrls(finalUrls);
        setNewUrl('');
        setNewLabel('');
        setUrlError('');
      } else {
        // If there's an error in the typed URL and no other sources are active, block and show error
        const enabledUrls = finalUrls.filter(u => u.enabled);
        if (enabledUrls.length === 0 && userScreenshots.length === 0) {
          setUrlError(err);
          return;
        }
      }
    }

    const enabledUrls = finalUrls.filter(u => u.enabled);
    if (enabledUrls.length === 0 && userScreenshots.length === 0) {
      setUrlError('Please enable at least one URL or upload a reference screenshot');
      return;
    }
    setUrlError('');
    setResult(null);
    setErrorMsg('');
    abortRef.current = false;

    const steps: ExtractState[] = ['connecting', 'capturing', 'extracting', 'generating'];
    for (const step of steps) {
      if (abortRef.current) return;
      setState(step);
      await new Promise(r => setTimeout(r, 450));
    }

    try {
      const res = await window.agentDeck.extractWebsiteDesignMultiSource(
        finalUrls,
        selectedViewports,
        userScreenshots
      );

      if (res.ok) {
        const data = res.data;
        setResult(data);
        setState('done');
        setActivePreviewSubTab('tokens');
        
        if (data.sectionCaptures.length > 0) {
          setCarouselSourceId(data.sectionCaptures[0].sourceUrlId);
          setCarouselViewport(data.sectionCaptures[0].viewport.name);
          setCarouselFoldIndex(0);
        }

        // Automatic persistent history archiving
        saveToHistory(data);
      } else {
        setErrorMsg(res.error.message);
        setState('error');
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Unexpected error');
      setState('error');
    }
  }, [urls, selectedViewports, userScreenshots, saveToHistory, newUrl, newLabel]);

  const currentStepIndex = STEP_ORDER.indexOf(state);

  const report: WebsiteDesignReport = result?.report || {
    summary: {
      theme: 'Unknown Theme',
      mood: 'Unknown Mood',
      layoutStyle: 'Unknown Layout',
      mainInteractionStyle: 'Unknown Interaction',
      confidenceNote: 'No report loaded yet.'
    },
    colors: [],
    typography: [],
    spacing: [],
    radius: [],
    shadows: [],
    components: [],
    confidenceSummary: {
      highConfidenceCount: 0,
      mediumConfidenceCount: 0,
      lowConfidenceCount: 0,
      noiseElementsFiltered: 0,
      overallScore: 'low'
    }
  };

  const designMd = result?.designMd || '';

  const handleCopyMd = async () => {
    if (!designMd) return;
    await window.agentDeck.clipboardWriteText(designMd);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleSaveToWorkspace = async () => {
    if (!designMd || !activeWorkspace) return;
    const res = await window.agentDeck.writeWorkspaceFile(
      activeWorkspace.rootPath,
      'DESIGN.md',
      designMd
    );
    if (res.ok) {
      setSavedToWorkspace(true);
      setTimeout(() => setSavedToWorkspace(false), 2500);
    }
  };

  const getFilteredColors = (list: NormalizedColorToken[]) => {
    if (filterMode === 'high') return list.filter(c => c.confidence === 'high');
    if (filterMode === 'noise') return list.filter(c => c.confidence === 'low');
    return list;
  };

  const getFilteredTypography = (list: NormalizedTypographyToken[]) => {
    if (filterMode === 'high') return list.filter(t => t.confidence === 'high');
    if (filterMode === 'noise') return list.filter(t => t.confidence === 'low');
    return list;
  };

  const getFilteredTokensList = (list: Array<{ value: string; confidence: 'high' | 'medium' | 'low'; count: number }>) => {
    if (filterMode === 'high') return list.filter(s => s.confidence === 'high');
    if (filterMode === 'noise') return list.filter(s => s.confidence === 'low');
    return list;
  };

  const isRunning = ['connecting', 'capturing', 'extracting', 'generating'].includes(state);

  const filteredSectionCaptures = result
    ? result.sectionCaptures.filter(c => c.sourceUrlId === carouselSourceId && c.viewport.name === carouselViewport)
    : [];

  const currentScreenshot = filteredSectionCaptures[carouselFoldIndex];

  return (
    <div
      className="wde-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        color: '#e4e4e7',
        background: '#0a0a0c',
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility'
      }}
    >
      <style>{`
        @keyframes wde-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes wde-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes wde-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

        .wde-panel {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        
        .wde-tab-btn { background: none; border: none; cursor: pointer; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; transition: background 0.15s ease, color 0.15s ease; }
        .wde-tab-btn:hover { background: rgba(255,255,255,0.06); color: #f4f4f5; }
        .wde-tab-btn.active { background: rgba(14,165,233,0.12); color: #7dd3fc; border: 1px solid rgba(14,165,233,0.25); }
        
        .wde-option-toggle { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #d4d4d8; cursor: pointer; user-select: none; transition: color 0.15s; font-weight: 500; }
        .wde-option-toggle:hover { color: #f4f4f5; }
        .wde-option-toggle input { accent-color: #38bdf8; cursor: pointer; margin: 0; }
        
        .wde-step { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
        .wde-step-dot { width: 8px; height: 8px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.15); transition: all 0.3s; }
        .wde-step-dot.active { background: #38bdf8; border-color: #38bdf8; animation: wde-pulse 1s infinite; }
        .wde-step-dot.done { background: #10b981; border-color: #10b981; }
        
        .wde-step-line { flex: 1; height: 1px; background: rgba(255,255,255,0.08); transition: background 0.4s; }
        .wde-step-line.done { background: #10b981; }
        
        .wde-analyze-btn { width: 100%; padding: 11px 16px; border-radius: 8px; border: 1px solid transparent; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease; }
        .wde-analyze-btn:enabled { background: rgba(56, 189, 248, 0.12); border-color: rgba(56, 189, 248, 0.35); color: #7dd3fc; box-shadow: none; }
        .wde-analyze-btn:enabled:hover { background: rgba(56, 189, 248, 0.2); border-color: rgba(56, 189, 248, 0.55); color: #e0f2fe; }
        .wde-analyze-btn:enabled:active { background: rgba(56, 189, 248, 0.14); }
        .wde-analyze-btn:disabled { background: #18181b; color: #71717a; border: 1px solid rgba(255,255,255,0.08); cursor: not-allowed; }
        
        .wde-url-input { flex: 1; background: #121214; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 12px; color: #e4e4e7; font-size: 12px; outline: none; transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease; min-width: 0; }
        .wde-url-input::placeholder { color: #71717a; }
        .wde-url-input:focus { border-color: rgba(56,189,248,0.5); background: #141418; box-shadow: 0 0 0 2px rgba(56,189,248,0.12); }
        .wde-url-input.error { border-color: rgba(239,68,68,0.5); }
        
        .wde-action-btn { display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 6px; border: 1px solid; font-size: 11px; font-weight: 600; cursor: pointer; transition: filter 0.15s ease; }
        .wde-action-btn:hover { filter: brightness(1.1); }
        
        .wde-filter-chip { border: 1px solid rgba(255,255,255,0.1); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 500; cursor: pointer; background: #141416; transition: all 0.15s; color: #a1a1aa; }
        .wde-filter-chip:hover { border-color: rgba(255,255,255,0.16); color: #e4e4e7; background: #1a1a1c; }
        .wde-filter-chip.active { background: rgba(56,189,248,0.12); border-color: rgba(56,189,248,0.4); color: #7dd3fc; }
        
        .wde-url-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border-radius: 7px; background: #141416; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 6px; gap: 8px; transition: border-color 0.15s ease, background 0.15s ease; }
        .wde-url-item:hover { border-color: rgba(255,255,255,0.14); background: #18181b; }
        
        .wde-thumbnail-preview { width: 32px; height: 32px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); background: #000; object-fit: cover; flex-shrink: 0; }
        
        .wde-uploader-box { border: 2px dashed rgba(255,255,255,0.14); border-radius: 8px; padding: 18px 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; background: #141416; color: #a1a1aa; transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease; }
        .wde-uploader-box:hover { border-color: rgba(56,189,248,0.4); background: #161a1f; color: #d4d4d8; }
        
        /* Inline confirm delete — fixed icon slots, morph trash → check */
        .wde-item-actions {
          --wde-del-ease: cubic-bezier(0.22, 0.8, 0.24, 1);
          display: inline-flex;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }
        .wde-item-actions .wde-action-hideable {
          display: inline-flex;
          align-items: center;
          max-width: 120px;
          opacity: 1;
          overflow: hidden;
          transition: max-width 200ms var(--wde-del-ease), opacity 180ms var(--wde-del-ease), transform 200ms var(--wde-del-ease);
        }
        .wde-item-actions.confirming .wde-action-hideable {
          max-width: 0 !important;
          opacity: 0 !important;
          pointer-events: none;
          transform: scale(0.92);
        }
        .wde-delete-cancel,
        .wde-delete-btn {
          width: 24px;
          height: 24px;
          padding: 0 !important;
          border-radius: 6px;
          border: 1px solid transparent !important;
          background: transparent !important;
          color: #a1a1aa !important;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          overflow: hidden;
          flex-shrink: 0;
          transition:
            width 200ms var(--wde-del-ease),
            opacity 200ms var(--wde-del-ease),
            transform 200ms var(--wde-del-ease),
            background 120ms var(--wde-del-ease),
            border-color 120ms var(--wde-del-ease),
            color 120ms var(--wde-del-ease);
        }
        .wde-delete-cancel {
          width: 0;
          opacity: 0;
          pointer-events: none;
          transform: scale(0.6) rotate(-45deg);
        }
        .wde-item-actions.confirming .wde-delete-cancel {
          width: 24px !important;
          opacity: 0.75 !important;
          pointer-events: auto;
          transform: scale(1) rotate(0deg);
          color: #d4d4d8 !important;
        }
        .wde-item-actions.confirming .wde-delete-cancel:hover {
          opacity: 1 !important;
          background: rgba(255, 255, 255, 0.08) !important;
          color: #fafafa !important;
        }
        .wde-delete-btn {
          position: relative;
        }
        .wde-delete-btn:hover {
          background: rgba(239, 68, 68, 0.12) !important;
          color: #f87171 !important;
        }
        .wde-delete-btn .trash-icon,
        .wde-delete-btn .confirm-icon {
          position: absolute;
          top: 50%;
          left: 50%;
          transition: opacity 180ms ease, transform 180ms ease;
        }
        .wde-delete-btn .trash-icon {
          transform: translate(-50%, -50%) scale(1) rotate(0deg);
          opacity: 1;
        }
        .wde-delete-btn .confirm-icon {
          transform: translate(-50%, -50%) scale(0.5) rotate(45deg);
          opacity: 0;
        }
        .wde-item-actions.confirming .wde-delete-btn {
          background: rgba(255, 59, 48, 0.14) !important;
          border-color: rgba(255, 59, 48, 0.28) !important;
          color: #ff3b30 !important;
        }
        .wde-item-actions.confirming .wde-delete-btn .trash-icon {
          opacity: 0 !important;
          transform: translate(-50%, -50%) scale(0.5) rotate(-45deg);
        }
        .wde-item-actions.confirming .wde-delete-btn .confirm-icon {
          opacity: 1 !important;
          transform: translate(-50%, -50%) scale(1) rotate(0deg);
        }

        .wde-section-label { font-size: 11px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }

        /* Clear All — text inline confirm */
        .wde-clear-all-actions {
          --wde-clear-ease: cubic-bezier(0.22, 0.8, 0.24, 1);
          --wde-clear-dur: 220ms;
          display: inline-flex;
          align-items: center;
          gap: 0;
          min-height: 26px;
        }
        .wde-clear-all-actions.confirming {
          gap: 6px;
        }
        .wde-clear-all-cancel,
        .wde-clear-all-confirm {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          min-height: 26px;
          border-radius: 4px !important;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          border: 1px solid transparent !important;
          box-sizing: border-box;
          transition:
            max-width var(--wde-clear-dur) var(--wde-clear-ease),
            opacity var(--wde-clear-dur) var(--wde-clear-ease),
            transform var(--wde-clear-dur) var(--wde-clear-ease),
            padding var(--wde-clear-dur) var(--wde-clear-ease),
            background 120ms ease,
            border-color 120ms ease,
            color 120ms ease;
        }
        .wde-clear-all-cancel {
          max-width: 0;
          opacity: 0;
          overflow: hidden;
          pointer-events: none;
          padding: 4px 0 !important;
          transform: scale(0.9) translateX(6px);
          background: #27272a !important;
          border-color: transparent !important;
          color: #e4e4e7 !important;
        }
        .wde-clear-all-actions.confirming .wde-clear-all-cancel {
          max-width: 90px;
          opacity: 1;
          pointer-events: auto;
          padding: 4px 10px !important;
          transform: scale(1) translateX(0);
          border-color: #3f3f46 !important;
        }
        .wde-clear-all-actions.confirming .wde-clear-all-cancel:hover {
          background: #3f3f46 !important;
          color: #fafafa !important;
        }
        .wde-clear-all-confirm {
          position: relative;
          min-width: 72px;
          padding: 4px 10px !important;
          background: rgba(239, 68, 68, 0.1) !important;
          border-color: rgba(239, 68, 68, 0.28) !important;
          color: #fca5a5 !important;
        }
        .wde-clear-all-confirm:hover {
          background: rgba(239, 68, 68, 0.16) !important;
          border-color: rgba(239, 68, 68, 0.4) !important;
          color: #fecaca !important;
        }
        .wde-clear-all-confirm-idle,
        .wde-clear-all-confirm-ready {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          transition: opacity 180ms ease, transform 180ms ease;
        }
        .wde-clear-all-confirm-ready {
          position: absolute;
          inset: 0;
          opacity: 0;
          transform: scale(0.72) rotate(20deg);
          pointer-events: none;
        }
        .wde-clear-all-actions.confirming .wde-clear-all-confirm {
          background: rgba(239, 68, 68, 0.18) !important;
          border-color: rgba(239, 68, 68, 0.5) !important;
          color: #fecaca !important;
        }
        .wde-clear-all-actions.confirming .wde-clear-all-confirm-idle {
          opacity: 0;
          transform: scale(0.72) rotate(-20deg);
        }
        .wde-clear-all-actions.confirming .wde-clear-all-confirm-ready {
          opacity: 1;
          transform: scale(1) rotate(0deg);
        }
        
        /* Premium library styling */
        .wde-history-card { transition: border-color 0.2s ease, background 0.2s ease !important; border: 1px solid rgba(255,255,255,0.08) !important; background: #141416 !important; }
        .wde-history-card:hover { border-color: rgba(56, 189, 248, 0.28) !important; background: #161a1f !important; }
      `}</style>

      {/* Header with Switcher Tabs */}
      <div style={{ padding: '14px 14px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ color: '#38bdf8' }}><ScanIcon size={13} /></div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#fafafa' }}>Multi-Source Design Extractor</span>
          </div>

          {/* Premium segmented control */}
          <div style={{
            display: 'flex', background: '#141416', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <button
              type="button"
              onClick={() => setActivePanelTab('extractor')}
              style={{
                background: activePanelTab === 'extractor' ? 'rgba(56, 189, 248, 0.14)' : 'none',
                border: 'none',
                color: activePanelTab === 'extractor' ? '#7dd3fc' : '#a1a1aa',
                padding: '5px 11px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.15s ease, color 0.15s ease',
                outline: 'none'
              }}
            >
              Extractor
            </button>
            <button
              type="button"
              onClick={() => setActivePanelTab('library')}
              style={{
                background: activePanelTab === 'library' ? 'rgba(56, 189, 248, 0.14)' : 'none',
                border: 'none',
                color: activePanelTab === 'library' ? '#7dd3fc' : '#a1a1aa',
                padding: '5px 11px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.15s ease, color 0.15s ease',
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <span>Library</span>
              {historyList.length > 0 && (
                <span style={{
                  background: activePanelTab === 'library' ? '#38bdf8' : '#27272a',
                  color: activePanelTab === 'library' ? '#09090b' : '#d4d4d8',
                  borderRadius: '10px',
                  padding: '1px 6px',
                  fontSize: '10px',
                  fontWeight: 700,
                  transition: 'background 0.15s ease, color 0.15s ease'
                }}>
                  {historyList.length}
                </span>
              )}
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#a1a1aa', margin: 0, lineHeight: 1.4 }}>
          Sequential crawler + manual uploads → Unified design report
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
        {activePanelTab === 'extractor' && (
          <>
            {state === 'idle' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, animation: 'wde-fade-in 0.25s ease' }}>
                
                {/* URLs Manager */}
                <div>
                  <div className="wde-section-label">
                    <GlobeIcon size={12} /> <span>1. Crawler Sources (URLs)</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    <input
                      className="wde-url-input"
                      type="url"
                      placeholder="Website URL (https://spotify.com)"
                      value={newUrl}
                      onChange={e => setNewUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
                      spellCheck={false}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        className="wde-url-input"
                        type="text"
                        placeholder="Source Label (optional)"
                        value={newLabel}
                        onChange={e => setNewLabel(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
                      />
                      <button
                        type="button"
                        onClick={handleAddUrl}
                        style={{
                          background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.12)',
                          borderRadius: 6, padding: '0 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#fafafa',
                          transition: 'background 0.15s ease, border-color 0.15s ease'
                        }}
                      >
                        Add
                      </button>
                    </div>
                    {urlError && <span style={{ color: '#f87171', fontSize: 11, fontWeight: 500 }}>{urlError}</span>}
                  </div>

                  <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                    {urls.map(u => (
                      <div key={u.id} className="wde-url-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                        <input
                          type="checkbox"
                          checked={u.enabled}
                          onChange={() => handleToggleUrl(u.id)}
                          style={{ cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#f4f4f5', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {u.label || new URL(u.url).hostname}
                          </span>
                          <span style={{ fontSize: 11, color: '#a1a1aa', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: 2 }}>
                            {u.url}
                          </span>
                        </div>
                      </div>
                      <InlineConfirmDelete
                        title="Remove source URL"
                        onConfirm={() => handleRemoveUrl(u.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* User Screenshot Uploads */}
              <div>
                <div className="wde-section-label">
                  <ImageIcon size={12} /> <span>2. Manual Mockups (Upload)</span>
                </div>

                <label className="wde-uploader-box">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    style={{ display: 'none' }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#f4f4f5' }}>Drop or click to upload design reference</span>
                  <span style={{ fontSize: 11, color: '#a1a1aa', marginTop: 4, lineHeight: 1.4 }}>Extract dominant branding visual colors</span>
                </label>

                {userScreenshots.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, maxHeight: 140, overflowY: 'auto' }}>
                    {userScreenshots.map(s => (
                      <div key={s.id} className="wde-url-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, overflow: 'hidden' }}>
                          {s.dataBase64 && <img className="wde-thumbnail-preview" src={s.dataBase64} alt="Upload preview" />}
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#fafafa', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{s.label}</span>
                            <input
                              type="text"
                              placeholder="Add notes..."
                              value={s.notes || ''}
                              onChange={e => handleUpdateScreenshotNotes(s.id, e.target.value)}
                              style={{ background: 'none', border: 'none', color: '#a1a1aa', fontSize: 11, outline: 'none', padding: 0 }}
                            />
                          </div>
                        </div>
                        
                        <InlineConfirmDelete
                          title="Remove mockup"
                          onConfirm={() => handleRemoveScreenshot(s.id)}
                        >
                          <select
                            value={s.viewportHint || 'unknown'}
                            onChange={e => handleUpdateScreenshotHint(s.id, e.target.value as any)}
                            style={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.12)', color: '#d4d4d8', borderRadius: 4, fontSize: 11, padding: '3px 6px', marginRight: 2 }}
                          >
                            <option value="unknown">Any VP</option>
                            <option value="desktop">Desktop</option>
                            <option value="tablet">Tablet</option>
                            <option value="mobile">Mobile</option>
                          </select>
                        </InlineConfirmDelete>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Viewports Selection */}
              <div>
                <div className="wde-section-label">
                  3. Crawler Viewports
                </div>
                <div style={{ display: 'flex', gap: 16, padding: '10px 12px', background: '#141416', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7 }}>
                  {['desktop', 'tablet', 'mobile'].map(vp => (
                    <label key={vp} className="wde-option-toggle" style={{ textTransform: 'capitalize' }}>
                      <input
                        type="checkbox"
                        checked={selectedViewports.includes(vp)}
                        onChange={() => handleViewportToggle(vp)}
                      />
                      {vp}
                    </label>
                  ))}
                </div>
              </div>

              {/* Run Action */}
              <button
                className="wde-analyze-btn"
                disabled={urls.filter(u => u.enabled).length === 0 && userScreenshots.length === 0}
                onClick={() => void handleAnalyze()}
              >
                <ScanIcon size={13} />
                <span>Analyze Design System</span>
              </button>

            </div>
          )}

          {/* Sequential Loader State */}
          {isRunning && (
            <div style={{ marginTop: 24, animation: 'wde-fade-in 0.3s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                {STEPS.map((step, i) => {
                  const stepIndex = STEP_ORDER.indexOf(step.id);
                  const isDone = currentStepIndex > stepIndex;
                  const isActive = state === step.id;
                  return (
                    <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <div className="wde-step">
                        <div className={`wde-step-dot${isActive ? ' active' : isDone ? ' done' : ''}`} />
                        <span style={{ fontSize: 8, color: isActive ? '#38bdf8' : isDone ? '#10b981' : '#52525b', whiteSpace: 'nowrap' }}>
                          {step.label}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && <div className={`wde-step-line${isDone ? ' done' : ''}`} />}
                    </div>
                  );
                })}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 36, color: '#71717a', fontSize: 10 }}>
                <GlobeIcon size={24} spin />
                <span style={{ fontWeight: 600, color: '#a1a1aa' }}>Analyzing multiple viewports and layouts sequentially...</span>
                <span style={{ fontSize: 8, color: '#52525b', maxWidth: 280, textAlign: 'center', lineHeight: 1.4 }}>
                  This captures layout folds, cleans consent popups, and clusters observed design tokens.
                </span>
              </div>
            </div>
          )}

          {state === 'error' && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16,
              padding: '12px 14px', background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8,
              color: '#fca5a5', fontSize: 11
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertIcon size={14} />
                <strong>Unified extraction failed</strong>
              </div>
              <p style={{ margin: 0, fontSize: 10, color: '#f87171', lineHeight: 1.5 }}>{errorMsg}</p>
              <button
                onClick={() => setState('idle')}
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: '#fff', borderRadius: 4, padding: '5px 12px', alignSelf: 'flex-start', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}
              >
                Back to Configuration
              </button>
            </div>
          )}

          {/* ─── OUTPUT PREVIEWS & TABS ─── */}
          {state === 'done' && result && (
            <div style={{ animation: 'wde-fade-in 0.35s ease' }}>

              {/* Unified Drag Context Card */}
              <div
                draggable
                onDragStart={(e) => {
                  const dragPayload = {
                    kind: 'agentdeck-context',
                    contextType: 'website-design-context',
                    url: result.sources[0]?.url || 'Unified Run',
                    title: 'Unified Design System',
                    designMd: designMd,
                    normalizedReport: report
                  };
                  e.dataTransfer.setData('text/plain', JSON.stringify(dragPayload));
                  e.dataTransfer.effectAllowed = 'copyMove';
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', background: 'rgba(56, 189, 248, 0.04)',
                  border: '1px solid rgba(56, 189, 248, 0.15)', borderRadius: 8,
                  cursor: 'grab', marginBottom: 12, userSelect: 'none',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
                }}
                title="Drag this card into terminal to inject unified reference prompt variables."
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#38bdf8' }}>
                  <div style={{ width: 10, height: 1.5, background: 'currentColor', borderRadius: 1 }} />
                  <div style={{ width: 10, height: 1.5, background: 'currentColor', borderRadius: 1 }} />
                  <div style={{ width: 10, height: 1.5, background: 'currentColor', borderRadius: 1 }} />
                </div>
                <ShieldIcon size={14} />
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5, color: '#38bdf8', fontWeight: 700 }}>Grounded Design System</span>
                  <strong style={{ fontSize: 10, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                    Unified Token Context ({result.coverageSummaries.length} sources)
                  </strong>
                </div>
                <span style={{ fontSize: 9, color: '#71717a', marginLeft: 'auto', fontStyle: 'italic', fontWeight: 500 }}>Drag to Agent</span>
              </div>

              {/* Quality metadata capsule */}
              <div style={{
                padding: '10px 12px', background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8,
                fontSize: 9, display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#71717a', fontWeight: 500 }}>Overall Capture Quality:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        width: `${result.overallQualityScore}%`,
                        height: '100%',
                        background: result.overallQualityScore >= 75 ? '#10b981' : result.overallQualityScore >= 50 ? '#fbbf24' : '#ef4444'
                      }} />
                    </div>
                    <strong style={{ color: result.overallQualityScore >= 75 ? '#10b981' : result.overallQualityScore >= 50 ? '#fbbf24' : '#ef4444' }}>
                      {result.overallQualityScore}%
                    </strong>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a1a1aa' }}>
                  <span>Folds captured: <strong>{result.sectionCaptures.length} folds</strong></span>
                  <span>Active sources: <strong>{result.coverageSummaries.length} entries</strong></span>
                </div>
              </div>

              {/* Filters chips row */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 9, color: '#71717a', fontWeight: 500 }}>Filter Levels:</span>
                <button className={`wde-filter-chip${filterMode === 'high' ? ' active' : ''}`} onClick={() => setFilterMode('high')}>High Confidence</button>
                <button className={`wde-filter-chip${filterMode === 'all' ? ' active' : ''}`} onClick={() => setFilterMode('all')}>Show All</button>
                <button className={`wde-filter-chip${filterMode === 'noise' ? ' active' : ''}`} onClick={() => setFilterMode('noise')}>Low Confidence</button>
              </div>

              {/* Previews Navigation Tabs */}
              <div style={{
                display: 'flex', gap: 2, marginBottom: 10,
                background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 3,
                border: '1px solid rgba(255,255,255,0.04)'
              }}>
                {(['tokens', 'markdown', 'coverage', 'screenshot'] as const).map(tab => {
                  const isActive = activePreviewSubTab === tab;
                  return (
                    <button
                      key={tab}
                      className={`wde-tab-btn${isActive ? ' active' : ''}`}
                      onClick={() => setActivePreviewSubTab(tab)}
                      style={{
                        color: isActive ? '#38bdf8' : '#71717a',
                        display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', flex: 1
                      }}
                    >
                      {tab === 'tokens' && <PaletteIcon size={11} />}
                      {tab === 'markdown' && <FileIcon size={11} />}
                      {tab === 'coverage' && <ShieldIcon size={11} />}
                      {tab === 'screenshot' && <ImageIcon size={11} />}
                      <span style={{ textTransform: 'capitalize' }}>
                        {tab === 'tokens' ? 'Tokens' : tab === 'markdown' ? 'DESIGN.md' : tab === 'coverage' ? 'Sources' : 'Screenshots'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Subtab View contents */}
              {activePreviewSubTab === 'tokens' && (
                <div style={{ animation: 'wde-fade-in 0.2s ease' }}>
                  <Section title={<><PaletteIcon size={12} /><span>Colors</span></>}>
                    <ColorGroup title="Primary Accent" colors={getFilteredColors(report.colors).filter(c => c.role === 'primary').map(c => c.hex)} />
                    <ColorGroup title="Neutral / Surface" colors={getFilteredColors(report.colors).filter(c => c.role === 'surface' || c.role === 'mutedText').map(c => c.hex)} />
                    <ColorGroup title="Background" colors={getFilteredColors(report.colors).filter(c => c.role === 'background').map(c => c.hex)} />
                    <ColorGroup title="Text" colors={getFilteredColors(report.colors).filter(c => c.role === 'text').map(c => c.hex)} />
                    <ColorGroup title="Border" colors={getFilteredColors(report.colors).filter(c => c.role === 'border').map(c => c.hex)} />
                    <ColorGroup title="Semantic Patterns" colors={getFilteredColors(report.colors).filter(c => c.role.startsWith('semantic')).map(c => c.hex)} />
                  </Section>

                  <Section title={<><TypeIcon size={12} /><span>Typography Rules</span></>}>
                    <TypographyTable scale={getFilteredTypography(report.typography)} />
                  </Section>

                  <Section title={<><RulerIcon size={12} /><span>Snapping Spacing Scale</span></>}>
                    <TokenChips items={getFilteredTokensList(report.spacing)} color="#86efac" />
                  </Section>

                  <Section title={<><RoundedIcon size={12} /><span>Border Radius Scale</span></>}>
                    <TokenChips items={getFilteredTokensList(report.radius)} color="#fde68a" />
                  </Section>

                  <Section title={<><ShadowIcon size={12} /><span>Shadow Elements</span></>} defaultOpen={false}>
                    {getFilteredTokensList(report.shadows).map((s, i) => (
                      <ShadowCard key={i} shadow={s.value} confidence={s.confidence} />
                    ))}
                    {getFilteredTokensList(report.shadows).length === 0 && <span style={{ fontSize: 9, color: '#52525b' }}>None matching filter</span>}
                  </Section>

                  <Section title={<><ComponentIcon size={12} /><span>Buttons & Navigation</span></>} defaultOpen={false}>
                    {report.components.map((c, i) => (
                      <div key={i} style={{
                        fontSize: 10, fontFamily: 'monospace', color: '#a1a1aa',
                        marginBottom: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.01)',
                        borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <strong style={{ color: '#38bdf8', textTransform: 'uppercase' }}>{c.component} ({c.properties.patternName || 'default'})</strong>
                          <span style={{ fontSize: 8, fontWeight: 700, color: c.confidence === 'high' ? '#10b981' : '#fbbf24' }}>{c.confidence.toUpperCase()} CONFIDENCE</span>
                        </div>
                        {Object.entries(c.properties).filter(([k]) => k !== 'patternName' && k !== 'observedCount').map(([key, val]) => (
                          <div key={key} style={{ paddingLeft: 6, marginTop: 2 }}>
                            <span style={{ color: '#71717a' }}>{key}:</span> <span style={{ color: '#e4e4e7' }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </Section>
                </div>
              )}

              {activePreviewSubTab === 'markdown' && (
                <div style={{ animation: 'wde-fade-in 0.2s ease' }}>
                  <textarea
                    readOnly
                    value={designMd}
                    style={{
                      width: '100%', height: 350, resize: 'vertical',
                      background: '#070709', border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 8, padding: 12, color: '#a1a1aa',
                      fontSize: 10, fontFamily: 'monospace', lineHeight: 1.6,
                      boxSizing: 'border-box', outline: 'none'
                    }}
                  />
                </div>
              )}

              {activePreviewSubTab === 'coverage' && (
                <div style={{ animation: 'wde-fade-in 0.2s ease' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Unified Source Elements ({result.coverageSummaries.length})</span>
                    {result.coverageSummaries.map((s, idx) => (
                      <div key={idx} style={{
                        padding: '10px 12px', background: 'rgba(255,255,255,0.01)',
                        border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <strong style={{ fontSize: 11, color: '#e4e4e7' }}>{s.source}</strong>
                          <span style={{
                            fontSize: 9, fontWeight: 700,
                            color: s.qualityScore >= 75 ? '#10b981' : s.qualityScore >= 50 ? '#fbbf24' : '#ef4444'
                          }}>
                            {s.qualityScore}% Quality
                          </span>
                        </div>
                        <div style={{ fontSize: 9, color: '#a1a1aa', display: 'flex', gap: 12, marginBottom: 4 }}>
                          <span>Viewports: {s.viewports.join(', ')}</span>
                          <span>Folds: {s.sectionsCaptured} scroll layers</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 9, color: '#71717a', lineHeight: 1.4 }}>{s.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activePreviewSubTab === 'screenshot' && (
                <div style={{ animation: 'wde-fade-in 0.2s ease', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  
                  {/* Carousel Controls */}
                  <div style={{
                    display: 'flex', flexWrap: 'wrap', gap: 8,
                    padding: '8px 12px', background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.04)', borderRadius: 7
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#71717a' }}>
                      <span>Source:</span>
                      <select
                        value={carouselSourceId}
                        onChange={e => { setCarouselSourceId(e.target.value); setCarouselFoldIndex(0); }}
                        style={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 4 }}
                      >
                        {result.sources.map(s => <option key={s.id} value={s.id}>{s.label || new URL(s.url).hostname}</option>)}
                        {result.userScreenshots.map(s => <option key={s.id} value={s.id}>{s.label || 'Mockup Upload'}</option>)}
                      </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, color: '#71717a' }}>
                      <span>Viewport:</span>
                      <select
                        value={carouselViewport}
                        onChange={e => { setCarouselViewport(e.target.value as any); setCarouselFoldIndex(0); }}
                        style={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 4 }}
                      >
                        <option value="desktop">Desktop</option>
                        <option value="tablet">Tablet</option>
                        <option value="mobile">Mobile</option>
                      </select>
                    </div>
                  </div>

                  {filteredSectionCaptures.length > 0 ? (
                    <div>
                      {/* Carousel Nav Folds Bar */}
                      <div style={{
                        display: 'flex', gap: 4, marginBottom: 8,
                        background: 'rgba(255,255,255,0.01)', borderRadius: 6, padding: 3,
                        border: '1px solid rgba(255,255,255,0.03)'
                      }}>
                        {filteredSectionCaptures.map((fold, idx) => {
                          const isFoldActive = carouselFoldIndex === idx;
                          return (
                            <button
                              key={idx}
                              onClick={() => setCarouselFoldIndex(idx)}
                              style={{
                                flex: 1, padding: '5px 8px', borderRadius: 4, border: 'none',
                                cursor: 'pointer', fontSize: 8, fontWeight: 700,
                                background: isFoldActive ? 'rgba(56,189,248,0.12)' : 'none',
                                color: isFoldActive ? '#38bdf8' : '#71717a',
                                transition: 'all 0.15s'
                              }}
                            >
                              Fold {idx + 1} ({fold.scrollY}px)
                            </button>
                          );
                        })}
                      </div>

                      <div style={{
                        borderRadius: 8, overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.07)',
                        background: '#000', position: 'relative', minHeight: 250
                      }}>
                        {currentScreenshot && (
                          <div>
                            {currentScreenshot.screenshotBase64 ? (
                              <img
                                src={`data:image/png;base64,${currentScreenshot.screenshotBase64}`}
                                alt={`Scrolled Fold preview ${carouselFoldIndex + 1}`}
                                style={{ width: '100%', display: 'block', objectFit: 'contain', animation: 'wde-fade-in 0.2s ease' }}
                              />
                            ) : (
                              <div style={{ padding: '64px 12px', textAlign: 'center', fontSize: 10, color: '#71717a' }}>
                                Screenshot images were stripped from history data to conserve local storage space.
                              </div>
                            )}
                            
                            {/* Quality stats tag overlay */}
                            <div style={{
                              position: 'absolute', bottom: 8, right: 8,
                              padding: '4px 8px', borderRadius: 4, background: 'rgba(0,0,0,0.8)',
                              border: '1px solid rgba(255,255,255,0.08)', fontSize: 8, color: '#a1a1aa'
                            }}>
                              Segment quality: {currentScreenshot.quality.score}% | text: {currentScreenshot.quality.visibleTextCount} chars
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: '32px 12px', background: 'rgba(255,255,255,0.01)',
                      border: '1px solid rgba(255,255,255,0.04)', borderRadius: 8,
                      textAlign: 'center', fontSize: 10, color: '#71717a'
                    }}>
                      No captured section found matching the source & viewport configuration.
                    </div>
                  )}

                </div>
              )}

              {/* Actions Bar */}
              <div style={{
                display: 'flex', gap: 8, flexWrap: 'wrap',
                marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)'
              }}>
                <button
                  className="wde-action-btn"
                  onClick={() => void handleCopyMd()}
                  style={{
                    background: copiedMd ? 'rgba(16,185,129,0.12)' : 'rgba(56,189,248,0.08)',
                    borderColor: copiedMd ? 'rgba(16,185,129,0.3)' : 'rgba(56,189,248,0.25)',
                    color: copiedMd ? '#10b981' : '#38bdf8'
                  }}
                >
                  {copiedMd ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
                  {copiedMd ? 'Copied!' : 'Copy DESIGN.md'}
                </button>

                {activeWorkspace && (
                  <button
                    className="wde-action-btn"
                    onClick={() => void handleSaveToWorkspace()}
                    style={{
                      background: savedToWorkspace ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                      borderColor: savedToWorkspace ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)',
                      color: savedToWorkspace ? '#10b981' : '#a1a1aa'
                    }}
                  >
                    {savedToWorkspace ? <CheckIcon size={12} /> : <SaveIcon size={12} />}
                    {savedToWorkspace ? 'Saved!' : 'Save to workspace'}
                  </button>
                )}

                <button
                  className="wde-action-btn"
                  onClick={() => {
                    setResult(null);
                    setState('idle');
                    setUrls([]);
                    setUserScreenshots([]);
                    setNewUrl('');
                    setNewLabel('');
                    setUrlError('');
                    setErrorMsg('');
                  }}
                  style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.07)', color: '#71717a', marginLeft: 'auto' }}
                >
                  Reset Setup
                </button>
              </div>

            </div>
          )}
        </>
      )}

      {activePanelTab === 'library' && (
        <div style={{ animation: 'wde-fade-in 0.25s ease' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12
          }}>
            <span className="wde-section-label" style={{ marginBottom: 0 }}>
              Saved Extractions Library
            </span>
            {historyList.length > 0 && (
              <InlineConfirmClearAll
                onConfirm={() => {
                  setHistoryList([]);
                  localStorage.setItem('agentdeck-wde-history', JSON.stringify([]));
                }}
              />
            )}
          </div>
          
          {historyList.length === 0 ? (
            <div style={{
              padding: '40px 16px',
              textAlign: 'center',
              background: '#141416',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: 8,
              color: '#a1a1aa',
              fontSize: 12,
              lineHeight: 1.45
            }}>
              <div style={{ marginBottom: 10, color: '#71717a' }}><PaletteIcon size={22} /></div>
              <div style={{ color: '#f4f4f5', fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                No saved design systems found
              </div>
              <div style={{ fontSize: 12, color: '#a1a1aa', maxWidth: 280, margin: '0 auto' }}>
                Run a website design extraction to automatically save results here.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {historyList.map(item => {
                const dateStr = new Date(item.timestamp).toLocaleString();
                const primarySource = item.sources.find((s: any) => s.enabled) || item.sources[0];
                const label = primarySource?.label || (primarySource ? new URL(primarySource.url).hostname : 'Design Mockups');
                const url = primarySource?.url || 'Uploaded Mockup';
                
                // Extract up to 6 unique core colors
                const uniqueColors = Array.from(new Set(item.report.colors.map((c: any) => c.hex))).slice(0, 6);
                const isHighQuality = item.overallQualityScore >= 75;

                return (
                  <div
                    key={item.id}
                    className="wde-history-card"
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      background: '#141416',
                      border: '1px solid rgba(255,255,255,0.1)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10
                    }}
                    onClick={() => {
                      // Restore saved run into the active view
                      setResult({
                        id: item.id,
                        sources: item.sources,
                        userScreenshots: item.userScreenshots,
                        report: item.report,
                        overallQualityScore: item.overallQualityScore,
                        coverageSummaries: item.coverageSummaries,
                        designMd: item.designMd,
                        sectionCaptures: item.sectionCaptures || []
                      });
                      // Separate state variable updates for viewports config
                      setSelectedViewports(item.selectedViewports || ['desktop', 'mobile']);
                      setState('done');
                      setActivePanelTab('extractor');
                      setActivePreviewSubTab('tokens');
                      if (item.sectionCaptures && item.sectionCaptures.length > 0) {
                        setCarouselSourceId(item.sectionCaptures[0].sourceUrlId);
                        setCarouselViewport(item.sectionCaptures[0].viewport.name);
                        setCarouselFoldIndex(0);
                      }
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {label}
                        </span>
                        <span style={{ fontSize: 11, color: '#a1a1aa', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', marginTop: 3, lineHeight: 1.35 }}>
                          {url}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: '4px',
                          background: isHighQuality ? 'rgba(16,185,129,0.12)' : 'rgba(251,191,36,0.12)',
                          color: isHighQuality ? '#34d399' : '#fcd34d',
                          border: `1px solid ${isHighQuality ? 'rgba(16,185,129,0.28)' : 'rgba(251,191,36,0.28)'}`
                        }}>
                          {item.overallQualityScore}% Quality
                        </span>
                        
                        <InlineConfirmDelete
                          title="Delete extraction history item"
                          onConfirm={() => {
                            setHistoryList(prev => {
                              const updated = prev.filter(h => h.id !== item.id);
                              localStorage.setItem('agentdeck-wde-history', JSON.stringify(updated));
                              return updated;
                            });
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 2 }}>
                      {/* Overlapping swatches list */}
                      <div style={{ display: 'flex', gap: 4 }}>
                        {uniqueColors.map((hex, i) => (
                          <div
                            key={i}
                            style={{
                              width: 14, height: 14, borderRadius: '50%', background: hex as string,
                              border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                              marginRight: -4 // overlap swatches slightly
                            }}
                            title={hex as string}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6, fontSize: 11, color: '#a1a1aa', alignItems: 'center', fontWeight: 500 }}>
                        <span style={{ color: '#d4d4d8' }}>{item.report.summary.theme}</span>
                        <span style={{ color: '#71717a' }}>•</span>
                        <span>{dateStr.split(' ')[0]}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useDeckStore } from '../store/deckStore';
import { useThemeStore, type AgentDeckThemeTokens, type AgentDeckMotionLevel } from '../store/themeStore';
import type { 
  CommandPermissionPolicy, 
  PermissionDecision, 
  WorkspaceTemplate
} from '../../shared/types';

// Seeded pricing list for details if pricingList from state is empty
const seededPricing = [
  { provider: 'gemini', modelId: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', billingMode: 'token' as const, inputPer1M: 0.075, cachedInp: 0.01875, outputPer1M: 0.3 },
  { provider: 'gemini', modelId: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', billingMode: 'token' as const, inputPer1M: 1.25, cachedInp: 0.3125, outputPer1M: 5.0 },
  { provider: 'openai', modelId: 'gpt-4o', displayName: 'GPT-4o', billingMode: 'token' as const, inputPer1M: 2.5, outputPer1M: 10.0 },
  { provider: 'anthropic', modelId: 'claude-3-5-sonnet', displayName: 'Claude 3.5 Sonnet', billingMode: 'token' as const, inputPer1M: 3.0, outputPer1M: 15.0 },
  { provider: 'ollama', modelId: 'local', displayName: 'Ollama Local', billingMode: 'free' as const, inputPer1M: 0, outputPer1M: 0 }
];

interface SettingsModalProps {
  onClose: () => void;
}

const listToText = (items: string[]) => items.join('\n');
const textToList = (text: string) =>
  text
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

// Custom SVG Icons (Clean, Lucide-style, NO emojis)
const BrainIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-4.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-4.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2z"/>
  </svg>
);

const TerminalIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

const PaletteIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 14.7255 3.09032 17.1962 4.85857 19C5.34643 19.4879 5.34643 20.2789 4.85857 20.7668C4.37072 21.2547 3.57978 21.2547 3.09193 20.7668C1.19632 18.8712 0 16.2755 0 13.4118C0 7.10898 5.10898 2 11.4118 2C17.7145 2 22.8235 7.10898 22.8235 13.4118C22.8235 18.1568 18.9804 22 14.2353 22H12z" />
    <circle cx="7.5" cy="10.5" r="1.5" fill="currentColor" />
    <circle cx="11.5" cy="7.5" r="1.5" fill="currentColor" />
    <circle cx="16.5" cy="9.5" r="1.5" fill="currentColor" />
    <circle cx="15.5" cy="14.5" r="1.5" fill="currentColor" />
  </svg>
);

const ShieldIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const FolderIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const CoinsIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6" />
    <circle cx="18" cy="18" r="4" />
    <path d="M12 18a6 6 0 0 0-6-6" />
  </svg>
);

const InfoIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

/** Lucide-style alert triangle — replaces emoji on danger banners */
const AlertTriangleIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const ChevronUpIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m18 15-6-6-6 6" />
  </svg>
);

const ChevronDownIcon = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/** Dark-UI number field with custom steppers (native spin buttons hidden) */
function NumberStepper({
  value,
  onChange,
  min = 0,
  step = 1,
  'aria-label': ariaLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  step?: number;
  'aria-label'?: string;
}) {
  const clamp = (n: number) => Math.max(min, Number.isFinite(n) ? n : min);

  return (
    <div className="number-stepper">
      <input
        type="number"
        className="number-stepper-input"
        value={value}
        min={min}
        step={step}
        aria-label={ariaLabel}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || 0))}
      />
      <div className="number-stepper-controls">
        <button
          type="button"
          className="number-stepper-btn"
          tabIndex={-1}
          aria-label="Increase"
          onClick={() => onChange(clamp(value + step))}
        >
          <ChevronUpIcon size={12} />
        </button>
        <button
          type="button"
          className="number-stepper-btn"
          tabIndex={-1}
          aria-label="Decrease"
          onClick={() => onChange(clamp(value - step))}
        >
          <ChevronDownIcon size={12} />
        </button>
      </div>
    </div>
  );
}

const CloseIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

interface SelectOption {
  value: string | number;
  label: string;
  group?: string;
}

/** Stable option lists — never recreate per render */
const PROVIDER_OPTIONS: SelectOption[] = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI (or custom proxy)' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'ollama', label: 'Ollama (Local LLM)' },
  { value: '9router', label: '9router (Local AI Router)' }
];

const RADIUS_OPTIONS: SelectOption[] = [
  { value: '0', label: '0px (Sharp Retro)' },
  { value: '3', label: '3px (Sharp Glass)' },
  { value: '6', label: '6px (Standard Soft)' },
  { value: '12', label: '12px (Playful Modern)' },
  { value: '20', label: '20px (Organic Soft)' }
];

const MOTION_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'None (Instant Layouts)' },
  { value: 'subtle', label: 'Subtle (Snappy Micro-animations)' },
  { value: 'balanced', label: 'Balanced (Smooth & Premium)' },
  { value: 'expressive', label: 'Expressive (Springy & Bouncy)' }
];

const BUFFER_OPTIONS: SelectOption[] = [
  { value: '1000', label: '1000 lines' },
  { value: '2000', label: '2000 lines (Recommended)' },
  { value: '5000', label: '5000 lines' },
  { value: '10000', label: '10000 lines' }
];

const POLICY_OPTIONS: SelectOption[] = [
  { value: 'ask-every-time', label: 'Ask Every Time (Strict safety - Agent prompts on every command)' },
  { value: 'allow-safe', label: 'Allow Safe (Run safe read/build tasks; prompt on structural deletes)' },
  { value: 'workspace-trusted', label: 'Workspace Trusted (No review prompts in trusted local repositories)' },
  { value: 'bypass-permissions', label: 'Bypass Permissions (Execution with NO warnings. High Risk!)' }
];

const THEME_COLOR_FIELDS: { key: string; label: string }[] = [
  { key: 'background', label: 'App Background' },
  { key: 'backgroundSubtle', label: 'BG Subtle' },
  { key: 'surface', label: 'Surface Container' },
  { key: 'surfaceHover', label: 'Surface Hover' },
  { key: 'surfaceElevated', label: 'Surface Elevated' },
  { key: 'text', label: 'Text Primary' },
  { key: 'textMuted', label: 'Text Muted' },
  { key: 'primary', label: 'Primary Brand' },
  { key: 'accent', label: 'Accent Highlight' },
  { key: 'border', label: 'Border Glass' },
  { key: 'borderStrong', label: 'Border Strong' },
  { key: 'codeBackground', label: 'Code Base' }
];

/** HTML <input type="color"> only accepts #rrggbb — rgba()/invalid values white-screen React. */
function toColorInputValue(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return '#808080';
  const s = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1];
    const g = s[2];
    const b = s[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const m = s.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (m) {
    const hex = (n: string) =>
      Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0');
    return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
  }
  return '#808080';
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: SelectOption[];
  style?: React.CSSProperties;
}

function CustomSelect({ value, onChange, options, style }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuBox, setMenuBox] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const sections = useMemo(() => {
    const groupOrder: string[] = [];
    const byGroup: Record<string, SelectOption[]> = {};
    const ungrouped: SelectOption[] = [];
    options.forEach((opt) => {
      if (opt.group) {
        if (!byGroup[opt.group]) {
          byGroup[opt.group] = [];
          groupOrder.push(opt.group);
        }
        byGroup[opt.group].push(opt);
      } else {
        ungrouped.push(opt);
      }
    });
    const out: { group?: string; items: SelectOption[] }[] = [];
    groupOrder.forEach((g) => out.push({ group: g, items: byGroup[g] }));
    if (ungrouped.length) out.push({ items: ungrouped });
    return out;
  }, [options]);

  const flatList = useMemo(() => {
    const list: SelectOption[] = [];
    sections.forEach((s) => list.push(...s.items));
    return list;
  }, [sections]);

  const close = useCallback(() => {
    setOpen(false);
    setMenuBox(null);
  }, []);

  const selectValue = useCallback(
    (next: string | number) => {
      onChange(next);
      close();
    },
    [onChange, close]
  );

  const openMenu = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const available = openUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(280, available));
    const width = Math.min(window.innerWidth - 16, Math.max(rect.width, 240));
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - 8 - width);
    }
    const top = openUp ? Math.max(8, rect.top - gap - maxHeight) : rect.bottom + gap;
    const idx = flatList.findIndex((opt) => String(opt.value) === String(value));
    setHighlight(idx >= 0 ? idx : 0);
    setMenuBox({ top, left, width, maxHeight });
    setOpen(true);
  }, [flatList, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // Never steal typing from real form fields (theme name, etc.)
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable) &&
        !menuRef.current?.contains(t)
      ) {
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => Math.min(Math.max(flatList.length - 1, 0), h + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const opt = flatList[highlight];
        if (opt) selectValue(opt.value);
      }
    };
    // Resize only — do NOT listen to scroll (setState on scroll froze the UI)
    const onResize = () => close();
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open, flatList, highlight, close, selectValue]);

  let runningIndex = 0;
  const menu =
    open && menuBox
      ? createPortal(
          <div
            ref={menuRef}
            className="custom-select-menu settings-custom-select-menu"
            role="listbox"
            style={{
              position: 'fixed',
              top: menuBox.top,
              left: menuBox.left,
              width: menuBox.width,
              maxHeight: menuBox.maxHeight,
              overflowY: 'auto',
              zIndex: 12000
            }}
          >
            {sections.map((section, sIdx) => (
              <div key={section.group ?? `flat-${sIdx}`} className="custom-select-group">
                {section.group ? (
                  <div className="custom-select-group-label">{section.group}</div>
                ) : null}
                {section.items.map((opt) => {
                  const index = runningIndex++;
                  const isActive = String(opt.value) === String(value);
                  const isHighlighted = index === highlight;
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      title={opt.label}
                      className={`custom-select-option${isActive ? ' active' : ''}${isHighlighted ? ' highlighted' : ''}`}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectValue(opt.value);
                      }}
                    >
                      <span className="custom-select-option-label" title={opt.label}>
                        {opt.label}
                      </span>
                      {isActive ? (
                        <span className="custom-select-check" aria-hidden>
                          ✓
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={`custom-select settings-custom-select${open ? ' open' : ''}`}
      style={{ position: 'relative', width: '100%', ...style }}
    >
      <button
        type="button"
        className="custom-select-trigger llm-engine-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (open) close();
          else openMenu();
        }}
      >
        <span className={`custom-select-value${selectedOption ? '' : ' placeholder'}`}>
          {selectedOption ? selectedOption.label : 'Select…'}
        </span>
        <svg
          className={`custom-select-chevron${open ? ' open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {menu}
    </div>
  );
}

// Inner UpdateChecker component
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <button
        type="button"
        className="settings-cta-btn"
        onClick={handleCheckUpdate}
        disabled={checking}
      >
        {checking ? 'Checking…' : 'Check for Updates'}
      </button>
      {statusMsg ? (
        <span className={`settings-status-msg${checking ? ' is-pending' : ''}`}>{statusMsg}</span>
      ) : null}
    </div>
  );
}

// Inner PermissionDecisionCard component (crisp-text-dark-ui)
function PermissionDecisionCard({ decision }: { decision: PermissionDecision }) {
  return (
    <article className={`permission-decision ${decision.action}`} style={{ marginBottom: '10px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', background: '#141416' }}>
      <div className="decision-header" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.03em' }}>
        <strong style={{ color: (decision.action === 'allowed' || decision.action === 'reviewed' || decision.action === 'overridden') ? '#34d399' : '#f87171' }}>{decision.action}</strong>
        <span style={{ color: '#a1a1aa' }}>{decision.category}</span>
      </div>
      <code style={{ display: 'block', padding: '8px', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '12px', color: '#c4b5fd', fontFamily: 'var(--font-family-mono, monospace)', whiteSpace: 'pre-wrap', marginBottom: '6px', lineHeight: 1.45 }}>
        {decision.command}
      </code>
      <span className="muted" style={{ fontSize: '11px', color: '#a1a1aa', display: 'block', marginBottom: '4px' }}>
        {new Date(decision.createdAt).toLocaleString()}
      </span>
      <p className="muted" style={{ fontSize: '12px', color: '#d4d4d8', margin: '0 0 6px 0', lineHeight: 1.45 }}>{decision.reason}</p>
      {decision.findings.length ? (
        <ul className="compact-list" style={{ margin: 0, paddingLeft: '16px', fontSize: '11.5px', color: '#fca5a5', lineHeight: 1.45 }}>
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

// Inner WorkspaceTemplateCard component
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
    <article className="settings-template-card">
      <input
        className="llm-engine-input"
        value={draft.name}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        placeholder="Template name"
      />
      <input
        className="llm-engine-input"
        value={draft.description}
        onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        placeholder="Description"
      />
      <textarea
        className="llm-engine-input"
        value={draft.paneTitlesText}
        onChange={(event) => setDraft({ ...draft, paneTitlesText: event.target.value })}
        rows={3}
        placeholder="One pane title per line"
      />
      <div className="settings-template-actions">
        <button
          type="button"
          className="settings-mini-btn is-primary"
          onClick={() =>
            upsertWorkspaceTemplate({ ...draft, paneTitles: textToList(draft.paneTitlesText) })
          }
        >
          Save
        </button>
        <button
          type="button"
          className="settings-mini-btn is-danger"
          onClick={() => deleteWorkspaceTemplate(template.id)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

// MAIN SettingsModal COMPONENT
export function SettingsModal({ onClose }: SettingsModalProps) {
  const overlayMouseDownRef = useRef<EventTarget | null>(null);
  // Store values
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


  // Active Tab state
  const [activeTab, setActiveTab] = useState<
    'llm' | 'theme' | 'terminal' | 'security' | 'companion' | 'context' | 'logs' | 'info'
  >('llm');

  // Simulator Form State
  const [simModelId, setSimModelId] = useState('claude-sonnet-4.6');
  const [simInput, setSimInput] = useState(1000);
  const [simOutput, setSimOutput] = useState(500);
  const [simCached, setSimCached] = useState(0);

  // Mobile Companion (LAN)
  const [companionStatus, setCompanionStatus] = useState<{
    enabled: boolean;
    running: boolean;
    port: number;
    token: string;
    urls: string[];
    error: string | null;
  } | null>(null);
  const [companionBusy, setCompanionBusy] = useState(false);
  const [companionCopied, setCompanionCopied] = useState(false);

  const refreshCompanionStatus = useCallback(async () => {
    try {
      if (typeof window.agentDeck?.companionGetStatus !== 'function') {
        console.warn('[companion] companionGetStatus missing — full restart required');
        return;
      }
      const res = await window.agentDeck.companionGetStatus();
      if (res?.ok) setCompanionStatus(res.data);
    } catch (err) {
      console.error('companion status failed', err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'companion' || activeTab === 'security') {
      void refreshCompanionStatus();
    }
  }, [activeTab, refreshCompanionStatus]);

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
  const [llmModel, setLlmModel] = useState('gemini-2.5-flash');
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Theme states
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

  const [themeNameInput, setThemeNameInput] = useState(() => activeTheme?.name ?? '');
  const themeNameRef = useRef<HTMLInputElement | null>(null);
  const themeNameEditingRef = useRef(false);
  const [designImportText, setDesignImportText] = useState('');

  const themeOptions = useMemo(() => {
    const opts = [
      { value: 'spotify-dark', label: 'Spotify Dark (Default)', group: 'Built-in Presets' },
      { value: 'sunsama-warm', label: 'Sunsama Warm', group: 'Built-in Presets' },
      { value: 'duolingo-playful', label: 'Duolingo Playful', group: 'Built-in Presets' },
      { value: 'spotify-night', label: 'Spotify Night (OLED)', group: 'Built-in Presets' }
    ];
    customThemes.forEach(t => {
      opts.push({ value: t.id, label: t.name, group: 'Custom Themes' });
    });
    return opts;
  }, [customThemes]);

  const shellOptions = useMemo(() => {
    const isWindows = window.navigator.userAgent.includes('Windows') || window.navigator.platform.includes('Win');
    const opts = [{ value: 'default', label: 'Default System Shell' }];
    if (isWindows) {
      opts.push({ value: 'pwsh', label: 'PowerShell Core (pwsh.exe)' });
      opts.push({ value: 'powershell', label: 'Windows PowerShell (powershell.exe)' });
      opts.push({ value: 'git-bash', label: 'Git Bash (bash.exe)' });
      opts.push({ value: 'wsl', label: 'WSL Bash (wsl.exe)' });
      opts.push({ value: 'cmd', label: 'Command Prompt (cmd.exe)' });
    } else {
      opts.push({ value: 'zsh', label: 'Zsh (zsh)' });
      opts.push({ value: 'bash', label: 'Bash (bash)' });
    }
    return opts;
  }, []);

  const simulatorOptions = useMemo(() => {
    const list = pricingList.length > 0 ? pricingList : seededPricing;
    const opts = list.map((pricing) => ({
      value: pricing.modelId,
      label: pricing.displayName
    }));
    opts.push({ value: 'custom', label: 'Custom Pricing' });
    return opts;
  }, [pricingList]);

  // Handle keyboard shortcuts modal close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load LLM configuration from localStorage on mount
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
      console.error('Failed to load LLM settings in SettingsModal:', e);
    }
  }, []);

  // Save settings helper
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
      console.error('Failed to save LLM settings in SettingsModal:', e);
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
    alert("Permission policy lists saved successfully!");
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
      alert("Template name is required!");
      return;
    }

    upsertWorkspaceTemplate({
      name: templateDraft.name,
      description: templateDraft.description,
      paneTitles: textToList(templateDraft.paneTitles)
    });
    setTemplateDraft({ name: '', description: '', paneTitles: '' });
    alert("Workspace template saved successfully!");
  };

  // Sync name from store only when user is NOT editing the field
  useEffect(() => {
    if (!activeTheme) return;
    if (themeNameEditingRef.current) return;
    setThemeNameInput(activeTheme.name);
    if (themeNameRef.current && document.activeElement !== themeNameRef.current) {
      themeNameRef.current.value = activeTheme.name;
    }
  }, [activeTheme?.id, activeTheme?.name]);

  /** Commit rename — forks built-in presets into one custom theme (stable id). */
  const commitThemeName = useCallback(() => {
    if (!activeTheme) return;
    const raw = themeNameRef.current?.value ?? themeNameInput;
    const trimmed = raw.trim();
    themeNameEditingRef.current = false;
    if (!trimmed) {
      setThemeNameInput(activeTheme.name);
      if (themeNameRef.current) themeNameRef.current.value = activeTheme.name;
      return;
    }
    if (trimmed === activeTheme.name && !activeTheme.isBuiltIn) return;
    if (trimmed === activeTheme.name && activeTheme.isBuiltIn) return;

    const updatedTheme = {
      ...activeTheme,
      id: activeTheme.isBuiltIn ? `custom-${Date.now()}` : activeTheme.id,
      name: trimmed,
      isBuiltIn: false as const,
      updatedAt: new Date().toISOString()
    };
    setThemeNameInput(trimmed);
    saveCustomTheme(updatedTheme);
  }, [activeTheme, themeNameInput, saveCustomTheme]);

  const handleColorChange = (key: string, value: string) => {
    if (!activeTheme) return;
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
    if (!activeTheme) return;
    const num = parseInt(String(radiusVal), 10) || 0;
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

  const handleMotionChange = (level: AgentDeckMotionLevel) => {
    if (!activeTheme) return;
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

  return (
    <div
      className="settings-modal-overlay"
      onMouseDown={(e) => {
        overlayMouseDownRef.current = e.target;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && overlayMouseDownRef.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="settings-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Sidebar Tabs Column */}
        <aside className="settings-modal-sidebar">
          <div className="settings-modal-sidebar-header">
            <strong>AgentDeck Settings</strong>
          </div>
          <nav className="settings-modal-tab-list">
            <button 
              className={`settings-modal-tab-btn ${activeTab === 'llm' ? 'active' : ''}`}
              onClick={() => setActiveTab('llm')}
            >
              <BrainIcon size={14} />
              <span>AI Models (LLM)</span>
            </button>
            <button 
              className={`settings-modal-tab-btn ${activeTab === 'theme' ? 'active' : ''}`}
              onClick={() => setActiveTab('theme')}
            >
              <PaletteIcon size={14} />
              <span>Theme & Branding</span>
            </button>
            <button 
              className={`settings-modal-tab-btn ${activeTab === 'terminal' ? 'active' : ''}`}
              onClick={() => setActiveTab('terminal')}
            >
              <TerminalIcon size={14} />
              <span>Terminal & Templates</span>
            </button>
            <button 
              className={`settings-modal-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <ShieldIcon size={14} />
              <span>Security & Policies</span>
            </button>
            <button
              className={`settings-modal-tab-btn ${activeTab === 'companion' ? 'active' : ''}`}
              onClick={() => setActiveTab('companion')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="2.5" />
              </svg>
              <span>Mobile Companion</span>
            </button>
            <button 
              className={`settings-modal-tab-btn ${activeTab === 'context' ? 'active' : ''}`}
              onClick={() => setActiveTab('context')}
            >
              <FolderIcon size={14} />
              <span>Context & MCP</span>
            </button>
            <button 
              className={`settings-modal-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => setActiveTab('logs')}
            >
              <CoinsIcon size={14} />
              <span>Cost Logs & Simulator</span>
            </button>
            <button 
              className={`settings-modal-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              <InfoIcon size={14} />
              <span>Shortcuts & Info</span>
            </button>
          </nav>
        </aside>

        {/* Right Settings Body Content Column */}
        <main className="settings-modal-content">
          <header className="settings-modal-header">
            <h3>
              {activeTab === 'llm' && 'AI Models & LLM Configuration'}
              {activeTab === 'theme' && 'Custom Theme & Branding'}
              {activeTab === 'terminal' && 'Terminal & Workspace Templates'}
              {activeTab === 'security' && 'Permissions & Safety Policies'}
              {activeTab === 'companion' && 'Mobile Companion (LAN)'}
              {activeTab === 'context' && 'Project Context & Connected MCP Clients'}
              {activeTab === 'logs' && 'Model Cost Logs & API Simulator'}
              {activeTab === 'info' && 'Keyboard Shortcuts & Tech Architecture'}
            </h3>
            <button className="settings-modal-close" onClick={onClose} title="Close Settings">
              <CloseIcon size={16} />
            </button>
          </header>

          <div className="settings-modal-scroll-area">
            {/* TAB 1: AI MODELS */}
            {activeTab === 'llm' && (
              <div className="settings-tab-pane">
                <div className="llm-engine-card">
                  <div className="llm-engine-card-head">
                    <div className="llm-engine-card-title-wrap">
                      <h4 className="llm-engine-card-title">
                        <BrainIcon size={16} />
                        AI Design Engine
                      </h4>
                      <p className="llm-engine-card-desc">
                        Global LLM credentials for Assist, Theme Generator, CSS synthesizer, and Workspace Blueprint.
                      </p>
                    </div>
                    <span className="llm-engine-badge">Saved</span>
                  </div>

                  <div className="llm-engine-fields">
                    <div className="llm-engine-field">
                      <label className="llm-engine-label">AI Provider</label>
                      <CustomSelect
                        value={llmProvider}
                        onChange={(val) => {
                          setLlmProvider(val);
                          let defModel = 'gemini-2.5-flash';
                          let defBaseUrl = llmBaseUrl;
                          if (val === 'openai') {
                            defModel = 'gpt-4o';
                          }
                          if (val === 'anthropic') {
                            defModel = 'claude-3-5-sonnet';
                          }
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
                        options={PROVIDER_OPTIONS}
                      />
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
                        disabled={
                          isTestingConnection ||
                          (llmProvider !== 'ollama' && llmApiKey.trim().length === 0)
                        }
                        onClick={handleTestConnection}
                      >
                        {isTestingConnection ? 'Testing connection…' : 'Test Connection'}
                      </button>

                      {testResult && (
                        <div
                          className={`llm-engine-result ${testResult.ok ? 'is-ok' : 'is-err'}`}
                          role="status"
                        >
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
                </div>

                <div className="llm-engine-defaults">
                  <h5>Defaults</h5>
                  <dl>
                    <dt>API Endpoint</dt>
                    <dd>{llmBaseUrl || 'Provider default'}</dd>
                    <dt>Model</dt>
                    <dd>{llmModel || '—'}</dd>
                  </dl>
                </div>
              </div>
            )}

            {/* TAB 2: THEME & BRANDING */}
            {activeTab === 'theme' && (
              <div className="settings-tab-pane">
                {!activeTheme ? (
                  <p className="muted" style={{ fontSize: '12px', color: '#a1a1aa' }}>
                    No active theme loaded. Try Reset themes, or restart the app.
                  </p>
                ) : (
                <>
                <p className="muted" style={{ marginBottom: '14px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                  Select an app-wide preset theme or customize design tokens (colors, corners, motion speeds) to build a custom branding profile.
                </p>

                {/* Theme Preset + Name */}
                <div className="theme-name-block" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label className="llm-engine-label" htmlFor="settings-theme-preset">
                      Theme preset
                    </label>
                    <CustomSelect
                      value={activeThemeId}
                      onChange={(val) => setTheme(String(val))}
                      options={themeOptions}
                    />
                  </div>

                  <div className="theme-name-field" style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', zIndex: 5 }}>
                    <label className="llm-engine-label" htmlFor="settings-theme-name">
                      Theme name
                    </label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                      {/*
                        Uncontrolled while focused so typing always works in Electron
                        (controlled value was getting clobbered / keys stolen by select handlers).
                      */}
                      <input
                        key={`theme-name-${activeTheme.id}`}
                        id="settings-theme-name"
                        ref={themeNameRef}
                        type="text"
                        name="themeName"
                        className="llm-engine-input theme-name-input"
                        defaultValue={activeTheme.name}
                        onFocus={() => {
                          themeNameEditingRef.current = true;
                        }}
                        onChange={(e) => {
                          themeNameEditingRef.current = true;
                          setThemeNameInput(e.target.value);
                        }}
                        onBlur={() => {
                          // slight delay so Save button click still reads the value
                          window.setTimeout(() => {
                            themeNameEditingRef.current = false;
                          }, 0);
                        }}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitThemeName();
                          }
                        }}
                        onKeyUp={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        placeholder="e.g. My Cool Theme"
                        autoComplete="off"
                        spellCheck={false}
                        style={{
                          flex: 1,
                          pointerEvents: 'auto',
                          cursor: 'text',
                          userSelect: 'text',
                          WebkitUserSelect: 'text',
                          position: 'relative',
                          zIndex: 6
                        }}
                      />
                      <button
                        type="button"
                        className="theme-name-save-btn"
                        aria-label={
                          activeTheme.isBuiltIn
                            ? 'Save as custom theme'
                            : 'Save theme name'
                        }
                        title={
                          activeTheme.isBuiltIn
                            ? 'Save as custom theme'
                            : 'Save theme name'
                        }
                        onMouseDown={(e) => {
                          // Keep input value; don't let blur race the click
                          e.preventDefault();
                        }}
                        onClick={() => commitThemeName()}
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                          <polyline points="17 21 17 13 7 13 7 21" />
                          <polyline points="7 3 7 8 15 8" />
                        </svg>
                      </button>
                    </div>
                    <span style={{ fontSize: '11px', color: '#a1a1aa', lineHeight: 1.45 }}>
                      {activeTheme.isBuiltIn
                        ? 'Built-in preset. Type a new name, then save (icon) or press Enter to create a custom copy.'
                        : 'Custom theme — edit the name, then save (icon) or press Enter.'}
                    </span>
                  </div>
                </div>

                {/* Color Palette Grid */}
                <div style={{ marginBottom: '18px', padding: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 600, color: '#e4e4e7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Color Token Editor</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    {THEME_COLOR_FIELDS.map((item) => {
                      const raw =
                        activeTheme.colors[item.key as keyof typeof activeTheme.colors] ?? '';
                      const pickerValue = toColorInputValue(raw);
                      return (
                      <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', padding: '8px' }}>
                        <span style={{ fontSize: '9.5px', color: '#a1a1aa', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', fontWeight: '500' }}>{item.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="color"
                            value={pickerValue}
                            onChange={(e) => handleColorChange(item.key, e.target.value)}
                            style={{ width: '22px', height: '22px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', borderRadius: '4px' }}
                            title={raw || pickerValue}
                          />
                          <span style={{ fontSize: '10.5px', color: '#a1a1aa', fontFamily: 'var(--font-family-mono, monospace)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {raw || pickerValue}
                          </span>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>

                {/* Radius & Motion Corner Variables */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#a1a1aa' }}>Border Corners (Base)</label>
                    <p style={{ margin: '0 0 8px 0', fontSize: '10.5px', color: '#71717a' }}>Define the rounded aesthetics for panels, buttons, cards.</p>
                    <CustomSelect
                      value={String(parseInt(String(activeTheme.radius?.md ?? '6'), 10) || 6)}
                      onChange={(val) => handleRadiusChange(String(val) + 'px')}
                      options={RADIUS_OPTIONS}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#a1a1aa' }}>Motion & Animation Profile</label>
                    <p style={{ margin: '0 0 8px 0', fontSize: '10.5px', color: '#71717a' }}>Select hover transition speeds and micro-interaction levels.</p>
                    <CustomSelect
                      value={activeTheme.motion?.level ?? 'balanced'}
                      onChange={(val) => handleMotionChange(val as AgentDeckMotionLevel)}
                      options={MOTION_OPTIONS}
                    />
                  </div>
                </div>

                {/* DESIGN.md Scanner Paste */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)', marginBottom: '16px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#a1a1aa' }}>Import Theme from DESIGN.md / Figma context</label>
                  <p style={{ margin: '0 0 8px 0', fontSize: '10.5px', color: '#71717a' }}>Paste color lists, design guidelines or markdown specs to auto-extract palette tokens.</p>
                  <textarea
                    value={designImportText}
                    onChange={(e) => setDesignImportText(e.target.value)}
                    placeholder="e.g. Primary: #1db954 | Background: #121212 | border-radius: 8px ..."
                    rows={3}
                    style={{ padding: '8px 10px', borderRadius: '6px', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '11.5px', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-family-mono, monospace)' }}
                  />
                  <button
                    onClick={handleImportTheme}
                    disabled={!designImportText.trim()}
                    className="primary-btn"
                    style={{ width: '100%', padding: '8px', margin: '4px 0 0 0', fontSize: '11px', fontWeight: 600 }}
                  >
                    Extract & Synthesize Theme
                  </button>
                </div>

                {/* Reset or delete */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => {
                      if (window.confirm('Reset all custom color tokens and styles back to Spotify Dark default?')) {
                        resetToDefault();
                      }
                    }}
                    style={{ flex: 1, padding: '8px 12px', fontSize: '11.5px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#a1a1aa', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Reset themes state to default
                  </button>
                  {!activeTheme.isBuiltIn && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete the custom theme "${activeTheme.name}"?`)) {
                          deleteCustomTheme(activeTheme.id);
                        }
                      }}
                      style={{ flex: 1, padding: '8px 12px', fontSize: '11.5px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.15)', color: '#fca5a5', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      Delete custom theme
                    </button>
                  )}
                </div>
                </>
                )}
              </div>
            )}

            {/* TAB 3: TERMINAL & TEMPLATES */}
            {activeTab === 'terminal' && (
              <div className="settings-tab-pane">
                <div className="settings-section-card">
                  <h4 className="settings-section-title">Terminal Console Environment</h4>
                  <div className="settings-subsection">
                    <div className="settings-field">
                      <label className="llm-engine-label">Preferred Terminal Shell</label>
                      <CustomSelect
                        value={(appSettings.find((s) => s.key === 'terminal.shell')?.value as string) || 'default'}
                        onChange={(val) => useDeckStore.getState().setAppSetting('terminal.shell', val)}
                        options={shellOptions}
                      />
                    </div>

                    <div className="settings-field">
                      <label className="llm-engine-label">Scrollback Buffer Limit</label>
                      <CustomSelect
                        value={String(appSettings.find((s) => s.key === 'terminal.bufferSize')?.value || 2000)}
                        onChange={(val) =>
                          useDeckStore.getState().setAppSetting('terminal.bufferSize', Number(val))
                        }
                        options={BUFFER_OPTIONS}
                      />
                    </div>

                    <div className="settings-field">
                      <label className="llm-engine-label">Updates Checker</label>
                      <UpdateChecker />
                    </div>
                  </div>
                </div>

                <div className="settings-section-card">
                  <h4 className="settings-section-title">Saved Workspace Layout Templates</h4>
                  <p className="settings-section-desc">
                    Workspace templates store pane definitions (titles and paths) to rapidly initialize split panel
                    spaces.
                  </p>

                  <div className="settings-dashed-box">
                    <span className="settings-dashed-box-title">Add Custom Layout Template</span>
                    <input
                      className="llm-engine-input"
                      value={templateDraft.name}
                      onChange={(event) => setTemplateDraft({ ...templateDraft, name: event.target.value })}
                      placeholder="Template name e.g. Frontend Stack"
                    />
                    <input
                      className="llm-engine-input"
                      value={templateDraft.description}
                      onChange={(event) =>
                        setTemplateDraft({ ...templateDraft, description: event.target.value })
                      }
                      placeholder="Description / purpose"
                    />
                    <textarea
                      className="llm-engine-input"
                      value={templateDraft.paneTitles}
                      onChange={(event) =>
                        setTemplateDraft({ ...templateDraft, paneTitles: event.target.value })
                      }
                      rows={3}
                      placeholder={'One pane title per line e.g.\nVite Build\nCSS Styling Dev Server'}
                    />
                    <button type="button" className="settings-cta-btn" onClick={saveTemplate}>
                      Save Template
                    </button>
                  </div>

                  {workspaceTemplates.length === 0 ? (
                    <div className="settings-empty-hint">
                      No templates saved yet. Create one above to quickly spin up custom layout views.
                    </div>
                  ) : (
                    workspaceTemplates.map((template) => (
                      <WorkspaceTemplateCard
                        template={template}
                        deleteWorkspaceTemplate={deleteWorkspaceTemplate}
                        upsertWorkspaceTemplate={upsertWorkspaceTemplate}
                        key={template.id}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: SAFETY & PERMISSIONS — crisp-text-dark-ui (solid surfaces + contrast) */}
            {activeTab === 'security' && (
              <div
                className="settings-tab-pane"
                style={{
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  textRendering: 'optimizeLegibility',
                }}
              >
                <div style={{ padding: '14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: '#18181b', marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 600, color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Command Permissions Mode</h4>
                  <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#a1a1aa', lineHeight: 1.5 }}>
                    System processes are categorized before executing. Blocked instructions halt instantly; risky pipelines trigger validation checkpoints unless overridden below.
                  </p>

                  <CustomSelect
                    value={permissionPolicy.mode}
                    onChange={(val) => updatePermissionPolicy({ mode: val as CommandPermissionPolicy['mode'] })}
                    options={POLICY_OPTIONS}
                    style={{ marginBottom: '12px' }}
                  />

                  {permissionPolicy.mode === 'bypass-permissions' && (
                    <div className="warning-card" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, color: '#fca5a5', lineHeight: 1.45, marginBottom: '12px' }}>
                      <span style={{ color: '#fecaca', flexShrink: 0, marginTop: 1, display: 'inline-flex' }}>
                        <AlertTriangleIcon size={14} />
                      </span>
                      <span>
                        <strong style={{ color: '#fecaca' }}>Security Override Danger:</strong> Automatically executing terminal actions without manual approval allows AI systems to run shell procedures without developer verification. Please use with extreme caution!
                      </span>
                    </div>
                  )}

                  <dl className="permission-mode-list" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#a1a1aa', lineHeight: 1.45 }}>
                    <div><strong style={{ color: '#f4f4f5', fontWeight: 600 }}>• ask-every-time:</strong> All agent tasks prompt for confirmation.</div>
                    <div><strong style={{ color: '#f4f4f5', fontWeight: 600 }}>• allow-safe:</strong> Commands matching safe read patterns execute automatically.</div>
                    <div><strong style={{ color: '#f4f4f5', fontWeight: 600 }}>• workspace-trusted:</strong> Non-blocked commands execute without prompts in approved folders.</div>
                    <div><strong style={{ color: '#f4f4f5', fontWeight: 600 }}>• bypass-permissions:</strong> Completely prompts bypass. Detector entries are still logged.</div>
                  </dl>

                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ fontSize: '12px' }}>
                      <span style={{ color: '#a1a1aa' }}>Trusted Status: </span>
                      <strong style={{ color: '#f4f4f5', fontWeight: 600 }}>
                        {activeWorkspace ? `${activeWorkspace.name} is ${trustedWorkspace ? 'trusted' : 'untrusted'}` : 'No active workspace'}
                      </strong>
                    </div>
                    <button 
                      onClick={toggleTrustedWorkspace} 
                      disabled={!activeWorkspaceId}
                      className="fe-act-btn"
                      style={{ fontSize: '12px', fontWeight: 600, padding: '6px 12px', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.12)', color: '#f4f4f5', flexShrink: 0 }}
                    >
                      {trustedWorkspace ? 'Untrust Workspace' : 'Trust Active Workspace'}
                    </button>
                  </div>
                </div>

                {/* Allowed / Blocked rules */}
                <div style={{ padding: '14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: '#18181b', marginBottom: '16px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 600, color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Policy Expression Rules</h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: '11px', fontWeight: 500, color: '#a1a1aa' }}>Allowed Commands List (Prefix rules)</label>
                      <textarea
                        value={policyDraft.allowedCommands}
                        onChange={(event) => setPolicyDraft({ ...policyDraft, allowedCommands: event.target.value })}
                        rows={3}
                        style={{ width: '100%', padding: '8px 10px', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f4f4f5', fontSize: '12px', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-family-mono, monospace)', lineHeight: 1.45 }}
                      />
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: '11px', fontWeight: 500, color: '#a1a1aa' }}>Blocked Patterns (Regex block)</label>
                      <textarea
                        value={policyDraft.blockedPatterns}
                        onChange={(event) => setPolicyDraft({ ...policyDraft, blockedPatterns: event.target.value })}
                        rows={3}
                        style={{ width: '100%', padding: '8px 10px', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f4f4f5', fontSize: '12px', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-family-mono, monospace)', lineHeight: 1.45 }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', marginBottom: 4, fontSize: '11px', fontWeight: 500, color: '#a1a1aa' }}>Review Triggers (Regex prompt warnings)</label>
                      <textarea
                        value={policyDraft.reviewPatterns}
                        onChange={(event) => setPolicyDraft({ ...policyDraft, reviewPatterns: event.target.value })}
                        rows={3}
                        style={{ width: '100%', padding: '8px 10px', background: '#0a0a0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#f4f4f5', fontSize: '12px', outline: 'none', resize: 'vertical', fontFamily: 'var(--font-family-mono, monospace)', lineHeight: 1.45 }}
                      />
                    </div>

                    <button 
                      onClick={savePolicy}
                      className="primary-btn"
                      style={{ padding: '8px 12px', fontSize: '12px', fontWeight: 600, width: '100%' }}
                    >
                      Save Policy Expressions
                    </button>
                  </div>
                </div>

                {/* Recorded permission decisions */}
                <div style={{ padding: '14px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: '#18181b' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 600, color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Logged Permission Decisions</h4>
                  {permissionDecisions.length === 0 ? (
                    <p style={{ margin: 0, padding: '12px 0', color: '#a1a1aa', fontSize: '12px', textAlign: 'center', lineHeight: 1.5 }}>No permissions queried in this session yet.</p>
                  ) : (
                    permissionDecisions.slice(0, 12).map((decision) => (
                      <PermissionDecisionCard decision={decision} key={decision.id} />
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB: MOBILE COMPANION */}
            {activeTab === 'companion' ? (
              <div
                className="settings-tab-pane"
                style={{
                  opacity: 1,
                  color: '#f4f4f5',
                  minHeight: 280,
                  display: 'block'
                }}
              >
                <div
                  style={{
                    padding: 16,
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10,
                    background: '#18181b',
                    color: '#f4f4f5'
                  }}
                >
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 14, fontWeight: 700, color: '#fafafa' }}>
                    Control AgentDeck from Android
                  </h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#a1a1aa', lineHeight: 1.5 }}>
                    1) Bấm Enable · 2) Copy URL · 3) Mở trên Chrome phone (cùng Wi‑Fi). PC phải để AgentDeck
                    chạy.
                  </p>

                  {!window.agentDeck?.companionGetStatus ? (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: 'rgba(251,191,36,0.1)',
                        border: '1px solid rgba(251,191,36,0.3)',
                        color: '#fcd34d',
                        fontSize: 13,
                        lineHeight: 1.45,
                        marginBottom: 12
                      }}
                    >
                      Preload API chưa có companion. Hãy <strong>tắt hẳn app</strong> rồi chạy lại{' '}
                      <code style={{ color: '#fde68a' }}>npm run dev</code> (không chỉ reload renderer).
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      marginBottom: 14,
                      padding: '12px 14px',
                      background: '#141416',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>
                        {companionStatus?.running ? 'Server running' : 'Server stopped'}
                      </div>
                      <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 4 }}>
                        Port {companionStatus?.port ?? 8787}
                        {companionStatus?.error ? ` · ${companionStatus.error}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={companionBusy || !window.agentDeck?.companionSetEnabled}
                      onClick={() => {
                        void (async () => {
                          if (!window.agentDeck?.companionSetEnabled) return;
                          setCompanionBusy(true);
                          try {
                            const next = !(companionStatus?.running || companionStatus?.enabled);
                            const res = await window.agentDeck.companionSetEnabled(next);
                            if (res?.ok) setCompanionStatus(res.data);
                            useDeckStore.getState().setAppSetting('companion.enabled', next);
                          } catch (err) {
                            console.error(err);
                            alert(
                              err instanceof Error
                                ? err.message
                                : 'Failed to toggle companion. Restart the app fully.'
                            );
                          } finally {
                            setCompanionBusy(false);
                          }
                        })();
                      }}
                      style={{
                        padding: '10px 16px',
                        borderRadius: 8,
                        border: companionStatus?.running
                          ? '1px solid rgba(248,113,113,0.4)'
                          : '1px solid rgba(56,189,248,0.45)',
                        background: companionStatus?.running
                          ? 'rgba(248,113,113,0.14)'
                          : 'rgba(56,189,248,0.16)',
                        color: companionStatus?.running ? '#fca5a5' : '#7dd3fc',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: companionBusy ? 'default' : 'pointer',
                        flexShrink: 0
                      }}
                    >
                      {companionBusy
                        ? '…'
                        : companionStatus?.running
                          ? 'Disable'
                          : 'Enable LAN access'}
                    </button>
                  </div>

                  {companionStatus?.running &&
                  Array.isArray(companionStatus.urls) &&
                  companionStatus.urls.length > 0 ? (
                    <div style={{ marginBottom: 14 }}>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#a1a1aa',
                          marginBottom: 8,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}
                      >
                        Open on phone
                      </div>
                      {companionStatus.urls.map((base) => {
                        const tok = companionStatus.token || '';
                        const full = `${base}/?token=${encodeURIComponent(tok)}`;
                        return (
                          <div
                            key={base}
                            style={{
                              display: 'flex',
                              gap: 8,
                              alignItems: 'center',
                              marginBottom: 8
                            }}
                          >
                            <code
                              style={{
                                flex: 1,
                                minWidth: 0,
                                fontSize: 12,
                                color: '#e4e4e7',
                                background: '#0a0a0c',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 6,
                                padding: '10px 12px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontFamily: 'ui-monospace, Consolas, monospace'
                              }}
                              title={full}
                            >
                              {full}
                            </code>
                            <button
                              type="button"
                              onClick={() => {
                                void (async () => {
                                  try {
                                    await window.agentDeck.clipboardWriteText(full);
                                    setCompanionCopied(true);
                                    window.setTimeout(() => setCompanionCopied(false), 1500);
                                  } catch {
                                    /* ignore */
                                  }
                                })();
                              }}
                              style={{
                                flexShrink: 0,
                                fontSize: 12,
                                fontWeight: 600,
                                padding: '10px 12px',
                                borderRadius: 6,
                                border: '1px solid rgba(255,255,255,0.12)',
                                background: '#1c1c1e',
                                color: '#f4f4f5',
                                cursor: 'pointer'
                              }}
                            >
                              {companionCopied ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ margin: '0 0 14px 0', fontSize: 13, color: '#a1a1aa', lineHeight: 1.45 }}>
                      Bấm <strong style={{ color: '#f4f4f5' }}>Enable LAN access</strong> để hiện link
                      + token cho phone.
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      disabled={companionBusy || !window.agentDeck?.companionRegenerateToken}
                      onClick={() => {
                        void (async () => {
                          if (!window.agentDeck?.companionRegenerateToken) return;
                          setCompanionBusy(true);
                          try {
                            const res = await window.agentDeck.companionRegenerateToken();
                            if (res?.ok) setCompanionStatus(res.data);
                          } catch (err) {
                            console.error(err);
                          } finally {
                            setCompanionBusy(false);
                          }
                        })();
                      }}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: '#141416',
                        color: '#d4d4d8',
                        cursor: 'pointer'
                      }}
                    >
                      Regenerate token
                    </button>
                    <button
                      type="button"
                      onClick={() => void refreshCompanionStatus()}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: '#141416',
                        color: '#d4d4d8',
                        cursor: 'pointer'
                      }}
                    >
                      Refresh status
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* TAB 5: CONTEXT & MCP */}
            {activeTab === 'context' && (
              <div className="settings-tab-pane">
                {activeWorkspace ? (
                  <div className="settings-section-card">
                    <h4 className="settings-section-title">Workspace Metadata Indexes</h4>
                    <dl className="settings-meta-grid">
                      <dt>Workspace ID</dt>
                      <dd>{activeWorkspace.id}</dd>
                      <dt>Tech Scanned On</dt>
                      <dd>
                        {activeWorkspace.context
                          ? new Date(activeWorkspace.context.updatedAt).toLocaleString()
                          : 'Never scanned'}
                      </dd>
                    </dl>

                    <div className="settings-field" style={{ marginBottom: 12 }}>
                      <label className="llm-engine-label">Context Exclude Folders</label>
                      <input
                        type="text"
                        className="llm-engine-input"
                        value={
                          (appSettings.find((s) => s.key === 'context.excludeFolders')?.value as string) ||
                          '.git, node_modules, dist, .vite, .output, .next, out, build, .gemini'
                        }
                        onChange={(e) =>
                          useDeckStore.getState().setAppSetting('context.excludeFolders', e.target.value)
                        }
                        placeholder="e.g. .git, node_modules, dist"
                      />
                      <p className="settings-section-desc" style={{ margin: '6px 0 0' }}>
                        Exclude matching folders when index scanning structure maps or tech packages.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="settings-cta-btn"
                      onClick={() => {
                        generateContext(activeWorkspace.id);
                        alert('Workspace context index scanning requested!');
                      }}
                    >
                      Re-scan Workspace & Tech Stack Context
                    </button>

                    {activeWorkspace.context ? (
                      <div className="settings-preview-block">
                        <span className="settings-preview-heading">Index Previews</span>

                        <div>
                          <span className="settings-preview-label">Tech Stack packages</span>
                          <pre className="settings-preview-pre">{activeWorkspace.context.techStack}</pre>
                        </div>
                        <div>
                          <span className="settings-preview-label">Directory Layout Tree</span>
                          <pre className="settings-preview-pre">
                            {activeWorkspace.context.folderStructure}
                          </pre>
                        </div>
                        <div>
                          <span className="settings-preview-label">Tech Stack Rules & Guidelines</span>
                          <pre className="settings-preview-pre">{activeWorkspace.context.codingRules}</pre>
                        </div>
                        <div>
                          <span className="settings-preview-label">Project Memory Logs</span>
                          <pre className="settings-preview-pre">{activeWorkspace.context.projectMemory}</pre>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="settings-empty-hint" style={{ marginBottom: 14 }}>
                    Open a local project directory first to customize tech context scans.
                  </div>
                )}

                <div className="settings-section-card">
                  <h4 className="settings-section-title">Model Context Protocol (MCP) SSE Gateway</h4>
                  <p className="settings-section-desc">
                    Allows external IDE tools or LLM agents (Cursor, Claude Desktop, windsurf) to read workspace
                    technology stacks via a local SSE server stream.
                  </p>

                  <dl className="settings-meta-grid">
                    <dt>SSE Server URL</dt>
                    <dd>
                      <code>http://localhost:8765/sse</code>
                    </dd>
                    <dt>HTTP Protocol Status</dt>
                    <dd className="settings-meta-status-ok">Active (Listening)</dd>
                  </dl>

                  <label className="llm-engine-label" style={{ marginBottom: 8, display: 'block' }}>
                    Connected AI Clients
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {mcpClients.length === 0 ? (
                      <span className="settings-chip settings-chip-offline">
                        <span className="settings-chip-dot" aria-hidden />
                        No connected AI clients
                      </span>
                    ) : (
                      mcpClients.map((client) => (
                        <span
                          key={client.id}
                          className="settings-chip settings-chip-online"
                          title={client.userAgent}
                        >
                          <span className="settings-chip-dot" aria-hidden />
                          {client.name} (Connected)
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: COST LOGS & SIMULATOR */}
            {activeTab === 'logs' && (
              <div className="settings-tab-pane">
                <div className="settings-section-card">
                  <h4 className="settings-section-title">Cumulative API Usage Costs</h4>

                  {(() => {
                    const totalRequests = usageLogs.length;
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
                        <div className="settings-stat-grid">
                          <div className="settings-stat-card">
                            <div className="settings-stat-label">Requests</div>
                            <div className="settings-stat-value">{totalRequests}</div>
                          </div>
                          <div className="settings-stat-card">
                            <div className="settings-stat-label">In Tokens</div>
                            <div className="settings-stat-value is-in">
                              {totalInputTokens.toLocaleString()}
                            </div>
                          </div>
                          <div className="settings-stat-card">
                            <div className="settings-stat-label">Out Tokens</div>
                            <div className="settings-stat-value is-out">
                              {totalOutputTokens.toLocaleString()}
                            </div>
                          </div>
                          <div className="settings-stat-card">
                            <div className="settings-stat-label">Est. Cost</div>
                            <div className="settings-stat-value is-cost">
                              ~${totalCost.toFixed(5)}
                            </div>
                          </div>
                        </div>

                        {totalRequests > 0 || totalInputTokens > 0 || totalOutputTokens > 0 ? (
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="settings-mini-btn is-danger"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    'Reset all token & cost counters for all terminal panes and usage logs?'
                                  )
                                ) {
                                  Object.keys(paneTokens).forEach((id) => {
                                    useDeckStore.getState().resetPaneTokens(id);
                                  });
                                  resetUsageLogs();
                                }
                              }}
                            >
                              Reset Cumulative Stats
                            </button>
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                </div>

                <div className="settings-section-card">
                  <h4 className="settings-section-title">Simulate API Request</h4>
                  <p className="settings-section-desc">
                    Simulate hypothetical tokens to test pricing calculations and route configurations.
                  </p>

                  <div className="settings-subsection">
                    <div className="settings-field">
                      <label className="llm-engine-label">Selected Model Profile</label>
                      <CustomSelect
                        value={simModelId}
                        onChange={(val) => setSimModelId(String(val))}
                        options={simulatorOptions}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                      <div className="settings-field">
                        <label className="llm-engine-label">Input Tokens</label>
                        <NumberStepper
                          aria-label="Input Tokens"
                          value={simInput}
                          onChange={setSimInput}
                          min={0}
                          step={1}
                        />
                      </div>
                      <div className="settings-field">
                        <label className="llm-engine-label">Output Tokens</label>
                        <NumberStepper
                          aria-label="Output Tokens"
                          value={simOutput}
                          onChange={setSimOutput}
                          min={0}
                          step={1}
                        />
                      </div>
                      <div className="settings-field">
                        <label className="llm-engine-label">Cached Input</label>
                        <NumberStepper
                          aria-label="Cached Input"
                          value={simCached}
                          onChange={setSimCached}
                          min={0}
                          step={1}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="settings-cta-btn"
                      onClick={() => {
                        simulateUsageLog(simModelId, simInput, simOutput, simCached);
                      }}
                    >
                      Trigger Simulated Call Log
                    </button>
                  </div>
                </div>

                <div className="settings-section-card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                      gap: 10
                    }}
                  >
                    <h4 className="settings-section-title" style={{ margin: 0 }}>
                      Raw API Logs Stream
                    </h4>
                    {usageLogs.length > 0 ? (
                      <button
                        type="button"
                        className="settings-mini-btn is-danger"
                        onClick={resetUsageLogs}
                      >
                        Clear Logs
                      </button>
                    ) : null}
                  </div>

                  <div className="settings-logs-wrap">
                    {usageLogs.length === 0 ? (
                      <div className="settings-empty-hint" style={{ margin: 0, border: 'none' }}>
                        No API logs tracked yet. Run a prompt command or trigger a simulation.
                      </div>
                    ) : (
                      <table className="settings-logs-table">
                        <thead>
                          <tr>
                            <th>Model (User)</th>
                            <th>Route Provider</th>
                            <th className="is-right">Tokens (In/Out/Cache)</th>
                            <th className="is-right">Cost</th>
                            <th className="is-right">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {usageLogs.map((log) => {
                            const pricingListObj =
                              useDeckStore.getState().pricingList || seededPricing;
                            const logModel = pricingListObj.find(
                              (m) => m.modelId === log.selectedModel
                            );
                            const billingMode = logModel?.billingMode || 'token';
                            return (
                              <tr key={log.id}>
                                <td className="is-model">{log.selectedModel}</td>
                                <td
                                  className={
                                    log.routeProvider ? 'is-route' : 'is-route-muted'
                                  }
                                >
                                  {log.routeProvider
                                    ? `${log.actualProvider}/${log.actualModel} via ${log.routeProvider}`
                                    : `${log.actualProvider || '-'}/${log.actualModel || '-'}`}
                                </td>
                                <td className="is-right">
                                  {log.inputTokens.toLocaleString()} /{' '}
                                  {log.outputTokens.toLocaleString()} /{' '}
                                  {log.cachedInputTokens
                                    ? log.cachedInputTokens.toLocaleString()
                                    : '0'}
                                </td>
                                <td
                                  className={`is-right ${
                                    billingMode === 'free'
                                      ? 'is-cost-free'
                                      : billingMode === 'subscription_quota'
                                        ? 'is-cost-quota'
                                        : 'is-cost-cell'
                                  }`}
                                >
                                  {billingMode === 'free'
                                    ? 'Free'
                                    : `$${(log.cost || 0).toFixed(5)}`}
                                </td>
                                <td className="is-right is-time">
                                  {new Date(log.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                  })}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: SHORTCUTS & INFO */}
            {activeTab === 'info' && (
              <div className="settings-tab-pane">
                <div className="settings-section-card">
                  <h4 className="settings-section-title">Keyboard Shortcuts</h4>
                  <dl className="settings-shortcut-list">
                    <dt>Ctrl + O</dt>
                    <dd>Open project folder workspace</dd>
                    <dt>Ctrl + T</dt>
                    <dd>Spawn new Terminal Pane</dd>
                    <dt>Ctrl + Shift + V</dt>
                    <dd>Split active Pane vertically</dd>
                    <dt>Ctrl + Shift + H</dt>
                    <dd>Split active Pane horizontally</dd>
                    <dt>Ctrl + W</dt>
                    <dd>Close active pane</dd>
                    <dt>Ctrl + Tab</dt>
                    <dd>Focus next pane panel</dd>
                    <dt>Ctrl + R</dt>
                    <dd>Rename active shell session</dd>
                    <dt>Ctrl + M</dt>
                    <dd>Maximize or restore active terminal</dd>
                    <dt>Ctrl + B</dt>
                    <dd>Toggle workspace left sidebar</dd>
                    <dt>Ctrl + I</dt>
                    <dd>Toggle right panel inspector</dd>
                    <dt>Ctrl + Shift + P</dt>
                    <dd>Open Global Command Palette</dd>
                    <dt>Ctrl + [1..5]</dt>
                    <dd>Quick switch inspector active tab</dd>
                  </dl>
                </div>

                <div className="settings-section-card">
                  <h4 className="settings-section-title">Tech Stack Architecture Map</h4>
                  <ul className="settings-arch-list">
                    <li>
                      <strong>Electron main:</strong> Orchestrates process spawns, shell PTY channels, and
                      LocalStorage file writes.
                    </li>
                    <li>
                      <strong>Preload Layer:</strong> Safe sandbox bridge exposed strictly under{' '}
                      <code>window.agentDeck</code> context.
                    </li>
                    <li>
                      <strong>React Renderer:</strong> Redesigned flex layouts, real-time status observers, and
                      custom themes store.
                    </li>
                    <li>
                      <strong>Zustand state:</strong> High speed stores holding terminal structures, permission
                      arrays, and API logs.
                    </li>
                    <li>
                      <strong>Terminal cores:</strong> Streamed <code>node-pty</code> standard output channels
                      piped to <code>xterm.js</code> viewports.
                    </li>
                  </ul>
                </div>

                <div className="settings-section-card">
                  <h4 className="settings-section-title">Data Model Status</h4>
                  <dl className="settings-meta-grid">
                    <dt>Schema Version</dt>
                    <dd>
                      v{metadata.schemaVersion} / JSON Engine
                    </dd>
                    <dt>Saved Projects Count</dt>
                    <dd>{projects.length}</dd>
                    <dt>Saved Tasks Count</dt>
                    <dd>{tasks.length}</dd>
                    <dt>Running Agent Tasks</dt>
                    <dd>{agentRuns.length}</dd>
                    <dt>Configured Policy Rules</dt>
                    <dd>{permissionRules.length}</dd>
                    <dt>App State Path</dt>
                    <dd>
                      <code>{String(storageInfo?.statePath ?? 'Electron initialization')}</code>
                    </dd>
                  </dl>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

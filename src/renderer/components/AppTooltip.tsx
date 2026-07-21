import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TipState = {
  text: string;
  x: number;
  y: number;
  placement: 'top' | 'bottom';
  maxWidth: number;
} | null;

const SHOW_DELAY_MS = 420;
const HIDE_DELAY_MS = 80;
const GAP = 8;
const EDGE = 10;
const MAX_W = 280;

function shouldSkip(el: Element): boolean {
  if (el.closest('[data-no-tooltip]')) return true;
  if (el.closest('.xterm, .xterm-screen, .xterm-helper-textarea, .app-tooltip')) return true;
  if (el.closest('[contenteditable="true"]')) return true;
  return false;
}

function tipTextFrom(host: HTMLElement): string {
  return (
    host.getAttribute('data-tooltip')?.trim() ||
    host.getAttribute('title')?.trim() ||
    host.getAttribute('data-title-backup')?.trim() ||
    ''
  );
}

/**
 * Global dark-UI tooltips.
 * - Auto-upgrades native `title` (suppresses OS tooltip).
 * - Also supports `data-tooltip="..."`.
 * - Multi-line via `\n` in the string.
 * - Opt-out: `data-no-tooltip` on self/ancestor.
 */
export function AppTooltip() {
  const [tip, setTip] = useState<TipState>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const activeEl = useRef<HTMLElement | null>(null);
  const strippedTitle = useRef<{ el: HTMLElement; title: string } | null>(null);
  const tipVisible = useRef(false);

  useEffect(() => {
    tipVisible.current = Boolean(tip);
  }, [tip]);

  useEffect(() => {
    const clearTimers = () => {
      if (showTimer.current != null) {
        window.clearTimeout(showTimer.current);
        showTimer.current = null;
      }
      if (hideTimer.current != null) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };

    const restoreTitle = () => {
      const s = strippedTitle.current;
      if (s?.el?.isConnected && s.title && !s.el.getAttribute('title')) {
        s.el.setAttribute('title', s.title);
      }
      strippedTitle.current = null;
    };

    const hide = () => {
      clearTimers();
      restoreTitle();
      activeEl.current = null;
      tipVisible.current = false;
      setTip(null);
    };

    const showFor = (el: HTMLElement, text: string) => {
      const nativeTitle = el.getAttribute('title');
      if (nativeTitle) {
        strippedTitle.current = { el, title: nativeTitle };
        el.removeAttribute('title');
        if (!el.getAttribute('data-tooltip') && !el.getAttribute('data-title-backup')) {
          el.setAttribute('data-title-backup', nativeTitle);
        }
      }

      activeEl.current = el;
      const anchor = el.getBoundingClientRect();
      const preferTop = anchor.top >= 48;
      const placement: 'top' | 'bottom' = preferTop ? 'top' : 'bottom';
      const cx = anchor.left + anchor.width / 2;
      const y = placement === 'top' ? anchor.top - GAP : anchor.bottom + GAP;
      const maxWidth = Math.min(MAX_W, window.innerWidth - EDGE * 2);
      tipVisible.current = true;
      setTip({ text, x: cx, y, placement, maxWidth });
    };

    const onOver = (e: MouseEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (shouldSkip(t)) {
        if (activeEl.current) hide();
        return;
      }

      const host = t.closest(
        '[data-tooltip], [title], [data-title-backup]'
      ) as HTMLElement | null;

      if (!host || shouldSkip(host)) {
        if (activeEl.current) {
          clearTimers();
          hideTimer.current = window.setTimeout(hide, HIDE_DELAY_MS);
        }
        return;
      }

      const text = tipTextFrom(host);
      if (!text) return;

      // Still on the same host while tip is open
      if (activeEl.current === host && tipVisible.current) {
        clearTimers();
        return;
      }

      // Same host, still waiting to show
      if (activeEl.current === host && showTimer.current != null) {
        return;
      }

      clearTimers();
      if (activeEl.current && activeEl.current !== host) {
        restoreTitle();
        tipVisible.current = false;
        setTip(null);
        activeEl.current = null;
      }

      activeEl.current = host;
      showTimer.current = window.setTimeout(() => {
        if (!host.isConnected) return;
        const latest = tipTextFrom(host);
        if (!latest) return;
        showFor(host, latest);
      }, SHOW_DELAY_MS);
    };

    const onOut = (e: MouseEvent) => {
      const related = e.relatedTarget as Node | null;
      if (related && tipRef.current?.contains(related)) return;
      if (related && activeEl.current?.contains(related)) return;

      clearTimers();
      hideTimer.current = window.setTimeout(hide, HIDE_DELAY_MS);
    };

    const onScrollOrResize = () => {
      if (tipVisible.current) hide();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && tipVisible.current) hide();
    };

    const onDown = () => {
      if (tipVisible.current) hide();
    };

    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('mouseout', onOut, true);
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('keydown', onKey, true);

    return () => {
      document.removeEventListener('mouseover', onOver, true);
      document.removeEventListener('mouseout', onOut, true);
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('keydown', onKey, true);
      clearTimers();
      restoreTitle();
    };
  }, []);

  // After paint: clamp position + flip if clipped
  useEffect(() => {
    if (!tip || !tipRef.current || !activeEl.current) return;
    const el = tipRef.current;
    const anchor = activeEl.current.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    let left = tip.x - rect.width / 2;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - rect.width - EDGE));
    let top = tip.placement === 'top' ? tip.y - rect.height : tip.y;
    let placement = tip.placement;

    if (placement === 'top' && top < EDGE) {
      top = anchor.bottom + GAP;
      placement = 'bottom';
    } else if (placement === 'bottom' && top + rect.height > window.innerHeight - EDGE) {
      top = Math.max(EDGE, anchor.top - GAP - rect.height);
      placement = 'top';
    }

    el.dataset.placement = placement;
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  }, [tip]);

  if (!tip) return null;

  const lines = tip.text.split('\n');

  return createPortal(
    <div
      ref={tipRef}
      className="app-tooltip"
      data-placement={tip.placement}
      role="tooltip"
      style={{
        left: tip.x,
        top: tip.y,
        maxWidth: tip.maxWidth,
      }}
    >
      {lines.map((line, i) => (
        <span key={i} className="app-tooltip-line">
          {line || '\u00a0'}
        </span>
      ))}
    </div>,
    document.body
  );
}

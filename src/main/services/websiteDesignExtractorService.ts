/**
 * websiteDesignExtractorService.ts
 *
 * Opens an offscreen Electron BrowserWindow, captures a screenshot of the page,
 * injects a JS CSS-extraction script to gather raw DOM element styles,
 * performs noise filtering, normalises design tokens with confidence scoring,
 * and synthesises a grounded DESIGN.md document.
 */

import { BrowserWindow, nativeImage } from 'electron';
import type {
  WebsiteDesignTokens,
  WebsiteExtractResult,
  WebsiteExtractOptions,
  WebsiteTypographyEntry,
  RawExtractedStyleSample,
  NormalizedColorToken,
  NormalizedTypographyToken,
  NormalizedComponentRule,
  WebsiteDesignReport,
  WebsiteDesignConfidenceSummary,
  WebsiteCaptureMetadata,
  WebsiteAnalysisSourceUrl,
  UserProvidedDesignScreenshot,
  WebsiteSectionScreenshot,
  DesignEvidenceRef,
  WebsiteDesignCoverageSummary,
  WebsiteAnalysisRun
} from '../../shared/types.js';

// ─── CSS Extraction Script ────────────────────────────────────────────────────
// Injected into the browser to extract style samples along with rects and flags.
const CSS_EXTRACT_SCRIPT = `
(function extractRawElements() {
  const MAX_ELEMENTS = 1200;
  const elements = [];
  const allNodes = document.querySelectorAll('*');
  let count = 0;

  const isNoiseTextOrClass = (str) => {
    if (!str) return false;
    const lower = str.toLowerCase();
    return /cookie|consent|onetrust|ot-|privacy|modal|popup|ad|ads|sponsor|tracking|analytics|recaptcha|captcha/.test(lower);
  };

  const shortSelector = (el) => {
    try {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? '#' + el.id : '';
      const cls = Array.from(el.classList).slice(0, 2).map(c => '.' + c).join('');
      return (tag + id + cls).slice(0, 50);
    } catch { return 'unknown'; }
  };

  for (let i = 0; i < allNodes.length && count < MAX_ELEMENTS; i++) {
    const el = allNodes[i];
    try {
      const tag = el.tagName.toLowerCase();
      let rect = el.getBoundingClientRect();
      const isSvgChild = ['path', 'g', 'circle', 'rect', 'polygon', 'ellipse', 'line'].includes(tag);
      if (isSvgChild) {
        const parentSvg = el.closest('svg');
        if (parentSvg) {
          rect = parentSvg.getBoundingClientRect();
        }
      }
      const isZeroSize = rect.width <= 0 || rect.height <= 0;
      if (isZeroSize) continue;

      // Only extract elements visible within the current viewport fold
      const isVisibleInViewport = rect.bottom >= 0 && rect.top <= window.innerHeight;
      if (!isVisibleInViewport) continue;

      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;

      const bg = cs.backgroundColor;
      const color = cs.color;
      const bc = cs.borderColor;
      const ff = cs.fontFamily;
      const fs = cs.fontSize;
      const fw = cs.fontWeight;
      const lh = cs.lineHeight;
      const ls = cs.letterSpacing;
      const br = cs.borderRadius;
      const bs = cs.boxShadow;
      const pad = cs.padding;
      const mar = cs.margin;
      const border = cs.border;
      const fill = cs.fill;
      const stroke = cs.stroke;

      // Extract colors from background-image if it is a linear/radial gradient
      const gradientColors = [];
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        const rgbRegex = /rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*[\d.]+)?\)/g;
        let match;
        while ((match = rgbRegex.exec(cs.backgroundImage)) !== null) {
          gradientColors.push(match[0]);
        }
        const hexRegex = /#[0-9a-fA-F]{3,8}\b/g;
        while ((match = hexRegex.exec(cs.backgroundImage)) !== null) {
          gradientColors.push(match[0]);
        }
      }

      const hasBg = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
      const hasColor = color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent';
      const hasShadow = bs && bs !== 'none';
      const hasBorder = border && !border.startsWith('0px') && !border.startsWith('none');
      const hasFill = fill && fill !== 'rgba(0, 0, 0, 0)' && fill !== 'transparent' && fill !== 'none';
      const hasStroke = stroke && stroke !== 'rgba(0, 0, 0, 0)' && stroke !== 'transparent' && stroke !== 'none';

      const text = (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) ? el.textContent.trim() : '';
      
      const isInteractive = ['button', 'input', 'textarea', 'select', 'a'].includes(tag);
      const isHeading = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag);

      // Skip elements that hold no styles or text values
      if (!hasBg && !hasColor && !hasShadow && !hasBorder && !text && !isInteractive && !hasFill && !hasStroke && gradientColors.length === 0) {
        continue;
      }

      const className = el.className || '';
      const id = el.id || '';
      const textSnippet = text.slice(0, 60);

      const isNoise = isNoiseTextOrClass(className) || 
                      isNoiseTextOrClass(id) || 
                      isNoiseTextOrClass(textSnippet) || 
                      isNoiseTextOrClass(tag);

      const attrs = {};
      if (el.getAttribute('role')) attrs.role = el.getAttribute('role');
      if (el.getAttribute('type')) attrs.type = el.getAttribute('type');
      if (el.getAttribute('href')) attrs.href = el.getAttribute('href').slice(0, 100);

      elements.push({
        selector: shortSelector(el),
        tagName: tag,
        className: typeof className === 'string' ? className.slice(0, 120) : '',
        id: typeof id === 'string' ? id.slice(0, 60) : '',
        textSample: textSnippet,
        isDisplayed: true,
        rect: {
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        computedStyles: {
          color: hasColor ? color : undefined,
          backgroundColor: hasBg ? bg : undefined,
          borderColor: bc,
          fontFamily: ff,
          fontSize: fs,
          fontWeight: fw,
          lineHeight: lh,
          letterSpacing: ls !== 'normal' ? ls : undefined,
          borderRadius: br,
          boxShadow: bs,
          padding: pad,
          margin: mar,
          border: border,
          fill: hasFill ? fill : undefined,
          stroke: hasStroke ? stroke : undefined,
          gradientColors: gradientColors.length > 0 ? gradientColors : undefined
        },
        attrs,
        isNoise
      });

      count++;
    } catch (e) {
      // Ignore element error
    }
  }

  return elements;
})();
`;

// ─── Color Helper Utilities ──────────────────────────────────────────────────

type RgbTuple = [number, number, number, number]; // r, g, b, a (0–255, 0–1)

function parseRgb(color: string): RgbTuple | null {
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

function colorToHex(color: string): string | null {
  const parsed = parseRgb(color);
  if (!parsed) return null;
  const [r, g, b] = parsed;
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ─── Pipeline Stage 2: Noise Filtering ────────────────────────────────────────

function runNoiseFiltering(raw: RawExtractedStyleSample[]): { clean: RawExtractedStyleSample[]; noiseCount: number } {
  let noiseCount = 0;
  const clean: RawExtractedStyleSample[] = [];

  for (const sample of raw) {
    let isNoise = sample.isNoise || false;
    let reason = '';

    // Filter tiny components that are probably tracking nodes or layout spacers
    if (sample.rect.width < 8 && sample.rect.height < 8) {
      isNoise = true;
      reason = 'Size smaller than 8x8px';
    }

    // Filter off-screen nodes (e.g. elements used for browser measurement/extension UI)
    if (sample.rect.x + sample.rect.width < -50 || sample.rect.y + sample.rect.height < -50) {
      isNoise = true;
      reason = 'Offscreen layout coordinates';
    }

    // Filter modals or overlays that have full size but aren't standard content
    if (sample.rect.width > 2000 || sample.rect.height > 2000) {
      const className = sample.className || '';
      const id = sample.id || '';
      if (/cookie|consent|onetrust|privacy|banner/i.test(className + id)) {
        isNoise = true;
        reason = 'Overlay banner';
      }
    }

    if (isNoise) {
      noiseCount++;
    } else {
      clean.push(sample);
    }
  }

  return { clean, noiseCount };
}

// ─── Sanitizer Utilities for Spacing & Radius ──────────────────────────────────

function sanitizeSpacing(spacingStr: string | undefined): string[] {
  if (!spacingStr || spacingStr === '0px' || spacingStr === 'none' || spacingStr === 'normal') return [];
  const tokens = spacingStr.split(/\s+/);
  const result: string[] = [];
  const standardScale = [0, 1, 2, 4, 5, 6, 8, 10, 12, 16, 20, 24, 28, 30, 32, 40, 48, 56, 64];

  for (const token of tokens) {
    const match = token.match(/^(-?\d+(?:\.\d+)?)(px|rem|em)?$/);
    if (!match) continue;
    let val = parseFloat(match[1]);
    const unit = match[2] || 'px';

    if (unit === 'rem' || unit === 'em') {
      val = val * 16;
    }

    // Exclude negative or absurd values above 120px
    if (val < 0 || val > 120) continue;

    // Group near values: snap to closest standard scale value if within 2px
    const rounded = Math.round(val);
    let snapped = rounded;
    let minDiff = Infinity;
    for (const std of standardScale) {
      const diff = Math.abs(val - std);
      if (diff < minDiff && diff <= 2) {
        minDiff = diff;
        snapped = std;
      }
    }

    if (snapped > 0) {
      result.push(`${snapped}px`);
    }
  }
  return result;
}

function sanitizeRadius(radiusStr: string | undefined): string[] {
  if (!radiusStr || radiusStr === '0px' || radiusStr === 'none') return [];
  const tokens = radiusStr.split(/\s+/);
  const result: string[] = [];
  for (const token of tokens) {
    if (token.includes('%')) {
      result.push(token);
      continue;
    }
    const match = token.match(/^(\d+(?:\.\d+)?)(px|rem|em)?$/);
    if (!match) continue;
    const val = parseFloat(match[1]);
    if (val > 0 && val <= 9999) {
      const rounded = Math.round(val);
      if (rounded >= 50) {
        result.push('9999px');
      } else {
        result.push(`${rounded}px`);
      }
    }
  }
  return result;
}

// ─── Pipeline Stage 3: Token Normalization & Confidence Scoring ────────────────

function runTokenNormalization(
  cleanElements: RawExtractedStyleSample[],
  noiseCount: number
): WebsiteDesignReport {
  // 1. Dominant Theme & Viewport Background Luminance Detection
  let darkBackgroundArea = 0;
  let lightBackgroundArea = 0;

  for (const el of cleanElements) {
    if (el.computedStyles.backgroundColor) {
      const parsed = parseRgb(el.computedStyles.backgroundColor);
      if (parsed) {
        const lum = luminance(parsed[0], parsed[1], parsed[2]);
        const area = el.rect.width * el.rect.height;
        if (lum < 0.25) {
          darkBackgroundArea += area;
        } else {
          lightBackgroundArea += area;
        }
      }
    }
  }
  const isDarkFirst = darkBackgroundArea >= lightBackgroundArea;
  const detectedTheme = isDarkFirst ? 'Dark Mode' : 'Light Mode';

  // 2. COLORS CLASSIFICATION
  const colorMap = new Map<string, {
    bgCount: number;
    textCount: number;
    borderCount: number;
    weightedScore: number;
    evidence: Map<string, { selector: string; tagName: string; count: number }>
  }>();

  const getOrInitColor = (hex: string) => {
    if (!colorMap.has(hex)) {
      colorMap.set(hex, { bgCount: 0, textCount: 0, borderCount: 0, weightedScore: 0, evidence: new Map() });
    }
    return colorMap.get(hex)!;
  };

  const addColorEvidence = (
    hex: string,
    selector: string,
    tagName: string,
    type: 'bg' | 'text' | 'border',
    element: RawExtractedStyleSample
  ) => {
    const entry = getOrInitColor(hex);
    if (type === 'bg') entry.bgCount++;
    if (type === 'text') entry.textCount++;
    if (type === 'border') entry.borderCount++;

    // Calculate element weighted contribution score
    let weight = 1;
    const area = element.rect.width * element.rect.height;

    // A. Bounding area weight
    if (area >= 200000) weight += 50;
    else if (area >= 50000) weight += 15;
    else if (area >= 10000) weight += 5;

    // B. Semantic weight
    if (['button', 'input', 'select'].includes(tagName)) weight += 10;
    else if (/^h[1-6]$/.test(tagName)) weight += 8;
    else if (tagName === 'a') weight += 5;
    else if (['body', 'html', 'main', 'root'].includes(tagName)) weight += 50;

    // C. Viewport dominance
    if (element.rect.y >= 0 && element.rect.y < 900) {
      weight += 3;
    }

    entry.weightedScore += weight;

    const evKey = `${selector}:${tagName}`;
    if (!entry.evidence.has(evKey)) {
      entry.evidence.set(evKey, { selector, tagName, count: 0 });
    }
    entry.evidence.get(evKey)!.count++;
  };

  for (const el of cleanElements) {
    const s = el.selector || el.tagName;
    const tag = el.tagName;

    if (el.computedStyles.backgroundColor) {
      const hex = colorToHex(el.computedStyles.backgroundColor);
      if (hex) addColorEvidence(hex, s, tag, 'bg', el);
    }
    if (el.computedStyles.color) {
      const hex = colorToHex(el.computedStyles.color);
      if (hex) addColorEvidence(hex, s, tag, 'text', el);
    }
    if (el.computedStyles.borderColor) {
      const hex = colorToHex(el.computedStyles.borderColor);
      if (hex) addColorEvidence(hex, s, tag, 'border', el);
    }
    if (el.computedStyles.fill) {
      const hex = colorToHex(el.computedStyles.fill);
      if (hex) addColorEvidence(hex, s, tag, 'bg', el);
    }
    if (el.computedStyles.stroke) {
      const hex = colorToHex(el.computedStyles.stroke);
      if (hex) addColorEvidence(hex, s, tag, 'border', el);
    }
    if (el.computedStyles.gradientColors && Array.isArray(el.computedStyles.gradientColors)) {
      for (const gColor of el.computedStyles.gradientColors) {
        const hex = colorToHex(gColor);
        if (hex) addColorEvidence(hex, s, tag, 'bg', el);
      }
    }
  }

  const colors: NormalizedColorToken[] = [];
  for (const [hex, details] of colorMap.entries()) {
    const totalOccurrences = details.bgCount + details.textCount + details.borderCount;
    if (totalOccurrences === 0) continue;

    // Weighted Confidence evaluation
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (details.weightedScore >= 25) {
      confidence = 'high';
    } else if (details.weightedScore >= 5) {
      confidence = 'medium';
    }

    // Role classification using CSS properties & visual context
    let role: NormalizedColorToken['role'] = 'unknown';
    const parsed = parseRgb(hex.startsWith('#') ? `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})` : hex);
    
    if (parsed) {
      const [h, s, l] = rgbToHsl(parsed[0], parsed[1], parsed[2]);
      const lum = luminance(parsed[0], parsed[1], parsed[2]);

      const isFrequentBg = details.bgCount >= details.textCount && details.bgCount >= details.borderCount;
      const isFrequentText = details.textCount > details.bgCount && details.textCount >= details.borderCount;
      const isFrequentBorder = details.borderCount > details.bgCount && details.borderCount > details.textCount;

      if (isFrequentBg) {
        if (s < 15) {
          if (lum < 0.25) {
            role = lum < 0.08 ? 'background' : 'surface';
          } else if (lum > 0.8) {
            role = 'background';
          } else {
            role = 'surface';
          }
        } else {
          // Vibrant color background used on buttons or actions -> Primary
          role = details.bgCount >= 2 ? 'primary' : 'accent';
        }
      } else if (isFrequentText) {
        if (s < 15) {
          if (isDarkFirst) {
            role = lum > 0.7 ? 'text' : 'mutedText';
          } else {
            role = lum < 0.35 ? 'text' : 'mutedText';
          }
        } else {
          role = 'accent';
        }
      } else if (isFrequentBorder) {
        role = 'border';
      }

      // Check standard signals
      if (role === 'unknown' || role === 'accent') {
        if (s > 25) {
          if ((h >= 0 && h < 20) || (h > 340 && h <= 360)) {
            role = 'semanticDanger';
          } else if (h >= 80 && h < 155) {
            role = 'semanticSuccess';
          } else if (h >= 20 && h < 80) {
            role = 'semanticWarning';
          }
        }
      }

      if (role === 'unknown') {
        role = s > 15 ? 'primary' : 'accent';
      }
    }

    const evidence = Array.from(details.evidence.values())
      .map(ev => ({
        selector: ev.selector,
        tagName: ev.tagName,
        usage: details.bgCount > details.textCount ? 'background' : 'foreground',
        count: ev.count
      }))
      .slice(0, 3);

    colors.push({ hex, role, confidence, evidence });
  }

  // 3. TYPOGRAPHY NORMALIZATION
  const fontFamiliesSet = new Set<string>();
  const typeMap = new Map<string, {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    tags: Set<string>;
    selectors: Set<string>;
    textSamples: Set<string>;
    count: number;
    weightedScore: number;
  }>();

  for (const el of cleanElements) {
    const cs = el.computedStyles;
    if (!cs.fontFamily || !cs.fontSize) continue;

    const rawFamily = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    if (rawFamily) fontFamiliesSet.add(rawFamily);

    const fKey = `${rawFamily}:${cs.fontSize}:${cs.fontWeight || '400'}:${cs.lineHeight || 'normal'}`;
    if (!typeMap.has(fKey)) {
      typeMap.set(fKey, {
        fontFamily: rawFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight || 'normal',
        lineHeight: cs.lineHeight || 'normal',
        tags: new Set(),
        selectors: new Set(),
        textSamples: new Set(),
        count: 0,
        weightedScore: 0
      });
    }

    const typeEntry = typeMap.get(fKey)!;
    typeEntry.count++;
    if (el.tagName) typeEntry.tags.add(el.tagName);
    if (el.selector) typeEntry.selectors.add(el.selector);
    if (el.textSample) typeEntry.textSamples.add(el.textSample);

    // Compute element weighted score for typography
    let weight = 1;
    const area = el.rect.width * el.rect.height;
    if (area >= 200000) weight += 40;
    else if (area >= 50000) weight += 15;
    else if (area >= 10000) weight += 5;

    if (/^h[1-6]$/.test(el.tagName)) weight += 15;
    else if (['button', 'a'].includes(el.tagName)) weight += 8;
    else if (['body', 'html', 'main'].includes(el.tagName)) weight += 50;

    if (el.rect.y >= 0 && el.rect.y < 900) {
      weight += 3;
    }
    typeEntry.weightedScore += weight;
  }

  const typography: NormalizedTypographyToken[] = [];
  for (const [_, spec] of typeMap.entries()) {
    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (spec.weightedScore >= 25) confidence = 'high';
    else if (spec.weightedScore >= 5) confidence = 'medium';

    // Context-aware typography roles matcher
    let role: NormalizedTypographyToken['role'] = 'unknown';
    const numSize = parseFloat(spec.fontSize);
    const tagsArr = Array.from(spec.tags);
    const isHeadingTag = tagsArr.some(t => /^h[1-6]$/.test(t));
    const isWrapperTag = tagsArr.some(t => ['div', 'body', 'html', 'section', 'main'].includes(t));

    if (isHeadingTag) {
      if (numSize >= 32) role = 'display';
      else if (numSize >= 24) role = 'heading1';
      else if (numSize >= 20) role = 'heading2';
      else role = 'heading3';
    } else if (tagsArr.includes('button')) {
      role = 'button';
    } else if (tagsArr.includes('a')) {
      role = 'link';
    } else {
      if (numSize >= 24 && !isWrapperTag) {
        role = 'display';
      } else if (numSize <= 11) {
        role = 'caption';
      } else if (numSize <= 13) {
        role = 'bodySmall';
      } else {
        role = 'body'; // Wrapper body text (not a heading)
      }
    }

    const evidence = Array.from(spec.selectors).slice(0, 3).map(sel => {
      const matchingEl = cleanElements.find(e => e.selector === sel);
      return {
        selector: sel,
        tagName: matchingEl?.tagName,
        textSample: matchingEl?.textSample,
        count: spec.count
      };
    });

    typography.push({
      role,
      fontFamily: spec.fontFamily,
      fontSize: spec.fontSize,
      fontWeight: spec.fontWeight,
      lineHeight: spec.lineHeight,
      confidence,
      evidence
    });
  }

  // 4. SPACING, RADIUS, SHADOWS SNAPPING & SCALES
  const spacingScores = new Map<string, { count: number; weightedScore: number }>();
  const radiusScores = new Map<string, { count: number; weightedScore: number }>();
  const shadowScores = new Map<string, { count: number; weightedScore: number }>();

  for (const el of cleanElements) {
    const cs = el.computedStyles;
    let weight = 1;
    const area = el.rect.width * el.rect.height;
    if (area >= 200000) weight += 20;
    else if (area >= 50000) weight += 8;

    if (['body', 'html', 'main'].includes(el.tagName)) weight += 20;

    const cleanPads = sanitizeSpacing(cs.padding);
    for (const p of cleanPads) {
      const entry = spacingScores.get(p) || { count: 0, weightedScore: 0 };
      entry.count++;
      entry.weightedScore += weight;
      spacingScores.set(p, entry);
    }

    const cleanMars = sanitizeSpacing(cs.margin);
    for (const m of cleanMars) {
      const entry = spacingScores.get(m) || { count: 0, weightedScore: 0 };
      entry.count++;
      entry.weightedScore += weight;
      spacingScores.set(m, entry);
    }

    const cleanRadius = sanitizeRadius(cs.borderRadius);
    for (const r of cleanRadius) {
      const entry = radiusScores.get(r) || { count: 0, weightedScore: 0 };
      entry.count++;
      entry.weightedScore += weight;
      radiusScores.set(r, entry);
    }

    if (cs.boxShadow && cs.boxShadow !== 'none' && !cs.boxShadow.includes('rgba(0, 0, 0, 0)')) {
      const entry = shadowScores.get(cs.boxShadow) || { count: 0, weightedScore: 0 };
      entry.count++;
      entry.weightedScore += weight;
      shadowScores.set(cs.boxShadow, entry);
    }
  }

  const buildTokenList = (scores: Map<string, { count: number; weightedScore: number }>) => {
    return Array.from(scores.entries())
      .map(([value, details]) => {
        let confidence: 'high' | 'medium' | 'low' = 'low';
        if (details.weightedScore >= 20) confidence = 'high';
        else if (details.weightedScore >= 5) confidence = 'medium';
        return { value, confidence, count: details.count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  };

  const spacing = buildTokenList(spacingScores);
  const radius = buildTokenList(radiusScores);
  const shadows = buildTokenList(shadowScores);

  // 5. COMPONENT RULES NORMALIZATION
  const components: NormalizedComponentRule[] = [];

  // Filter visual button components only (exluding empty/invisible/decorative utility spans)
  const buttonsGroup = cleanElements.filter(e => {
    const isBtn = e.tagName === 'button' || (e.tagName === 'a' && /btn|button/i.test(e.className)) || e.attrs.role === 'button';
    if (!isBtn) return false;
    
    // Bounding Box filter
    const w = e.rect.width;
    const h = e.rect.height;
    if (w <= 12 || h <= 12) return false;

    const bg = e.computedStyles.backgroundColor || 'transparent';
    const isTransparent = bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)';
    const pad = e.computedStyles.padding || '0px';
    const hasNoPadding = pad === '0px' || pad === '0px 0px';
    const hasNoText = !e.textSample || e.textSample.trim().length === 0;

    if (isTransparent && hasNoPadding && hasNoText) {
      return false; // ignore empty decorative control wrappers
    }
    return true;
  });

  if (buttonsGroup.length > 0) {
    const buttonStyles = new Map<string, { bg: string; color: string; radius: string; padding: string; border: string; samples: RawExtractedStyleSample[] }>();
    for (const b of buttonsGroup) {
      const bg = b.computedStyles.backgroundColor || 'transparent';
      const col = b.computedStyles.color || 'inherit';
      const rad = b.computedStyles.borderRadius || '0px';
      const pad = b.computedStyles.padding || '0px';
      const bor = b.computedStyles.border || 'none';
      const sKey = `${bg}:${col}:${rad}:${pad}`;
      if (!buttonStyles.has(sKey)) {
        buttonStyles.set(sKey, { bg, color: col, radius: rad, padding: pad, border: bor, samples: [] });
      }
      buttonStyles.get(sKey)!.samples.push(b);
    }

    const sortedStyles = Array.from(buttonStyles.values()).sort((a, b) => b.samples.length - a.samples.length);
    sortedStyles.forEach((bs, index) => {
      let role = index === 0 ? 'primary pattern' : index === 1 ? 'secondary pattern' : 'icon/utility pattern';
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (bs.samples.length >= 4) confidence = 'high';
      else if (bs.samples.length >= 1) confidence = 'medium';

      components.push({
        component: 'button',
        confidence,
        properties: {
          patternName: role,
          backgroundColor: bs.bg,
          color: bs.color,
          borderRadius: bs.radius,
          padding: bs.padding,
          border: bs.border,
          observedCount: String(bs.samples.length)
        },
        evidence: bs.samples.slice(0, 3).map(s => ({ selector: s.selector, textSample: s.textSample }))
      });
    });
  }

  // Inputs Group
  const inputsGroup = cleanElements.filter(e => ['input', 'textarea', 'select'].includes(e.tagName));
  if (inputsGroup.length > 0) {
    const inputStyles = new Map<string, { border: string; bg: string; radius: string; samples: RawExtractedStyleSample[] }>();
    for (const inp of inputsGroup) {
      const bor = inp.computedStyles.border || 'none';
      const bg = inp.computedStyles.backgroundColor || 'transparent';
      const rad = inp.computedStyles.borderRadius || '0px';
      const iKey = `${bor}:${bg}:${rad}`;
      if (!inputStyles.has(iKey)) {
        inputStyles.set(iKey, { border: bor, bg, radius: rad, samples: [] });
      }
      inputStyles.get(iKey)!.samples.push(inp);
    }

    Array.from(inputStyles.values()).slice(0, 2).forEach((is, idx) => {
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (is.samples.length >= 4) confidence = 'high';
      else if (is.samples.length >= 1) confidence = 'medium';

      components.push({
        component: 'input',
        confidence,
        properties: {
          patternName: idx === 0 ? 'standard input' : 'alternative input',
          border: is.border,
          backgroundColor: is.bg,
          borderRadius: is.radius,
          observedCount: String(is.samples.length)
        },
        evidence: is.samples.slice(0, 3).map(s => ({ selector: s.selector, textSample: s.textSample }))
      });
    });
  }

  // Navigation Group
  const navGroup = cleanElements.filter(e => e.tagName === 'nav' || e.attrs.role === 'navigation' || e.selector.includes('nav') || e.className.includes('nav'));
  if (navGroup.length > 0) {
    components.push({
      component: 'nav',
      confidence: 'medium',
      properties: {
        tagName: navGroup[0].tagName,
        backgroundColor: navGroup[0].computedStyles.backgroundColor || 'transparent',
        color: navGroup[0].computedStyles.color || 'inherit',
        observedCount: String(navGroup.length)
      },
      evidence: navGroup.slice(0, 3).map(s => ({ selector: s.selector }))
    });
  }

  // 6. CONFIDENCE SUMMARY SCORE
  const highConfidenceCount = colors.filter(c => c.confidence === 'high').length +
                           typography.filter(t => t.confidence === 'high').length +
                           spacing.filter(s => s.confidence === 'high').length +
                           radius.filter(r => r.confidence === 'high').length +
                           components.filter(c => c.confidence === 'high').length;

  const mediumConfidenceCount = colors.filter(c => c.confidence === 'medium').length +
                             typography.filter(t => t.confidence === 'medium').length +
                             spacing.filter(s => s.confidence === 'medium').length +
                             radius.filter(r => r.confidence === 'medium').length +
                             components.filter(c => c.confidence === 'medium').length;

  const lowConfidenceCount = colors.filter(c => c.confidence === 'low').length +
                          typography.filter(t => t.confidence === 'low').length +
                          spacing.filter(s => s.confidence === 'low').length +
                          radius.filter(r => r.confidence === 'low').length +
                          components.filter(c => c.confidence === 'low').length;

  let overallScore: WebsiteDesignConfidenceSummary['overallScore'] = 'low';
  if (highConfidenceCount > 5 && highConfidenceCount > lowConfidenceCount) {
    overallScore = 'high';
  } else if (highConfidenceCount + mediumConfidenceCount >= 3) {
    overallScore = 'medium';
  }

  const confidenceSummary: WebsiteDesignConfidenceSummary = {
    highConfidenceCount,
    mediumConfidenceCount,
    lowConfidenceCount,
    noiseElementsFiltered: noiseCount,
    overallScore
  };

  // Summary heuristics
  const primaryCol = colors.find(c => c.role === 'primary')?.hex || colors.find(c => c.confidence === 'high' && c.role === 'accent')?.hex || 'N/A';
  const fonts = Array.from(fontFamiliesSet).slice(0, 2).join(', ');

  const summary = {
    theme: detectedTheme,
    mood: primaryCol !== 'N/A' ? `Modern Branding (Primary Accent: ${primaryCol})` : 'Minimalist Layout',
    layoutStyle: spacing.length > 0 ? `Consistent Spacing Rhythm (Tokens: ${spacing.slice(0, 3).map(s => s.value).join(', ')})` : 'Variable Flow Layout',
    mainInteractionStyle: components.some(c => c.component === 'button' && (c.properties.borderRadius === '9999px' || parseFloat(c.properties.borderRadius || '0px') > 15)) ? 'Smooth / Highly Rounded Controls' : 'Square / Angular Controls',
    confidenceNote: `Scanned ${cleanElements.length} visible styles. Evaluated ${highConfidenceCount} high-confidence layout patterns & resolved ${detectedTheme}.`
  };

  return {
    summary,
    colors,
    typography,
    spacing,
    radius,
    shadows,
    components,
    confidenceSummary
  };
}

// ─── Pipeline Stage 4: DESIGN.md Synthesis ────────────────────────────────────

function generateDesignMd(
  report: WebsiteDesignReport,
  meta: {
    url: string;
    finalUrl: string;
    title: string;
    capturedAt: number;
    viewportWidth: number;
    viewportHeight: number;
  },
  includeRawAppendix = false,
  rawSamples: RawExtractedStyleSample[] = []
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

  // 6. Motion / Interaction
  sections.push(`## 6. Motion / Interaction Style

- **Observed Transitions**: \`chưa xác minh được\` (Transitions and CSS keyframes are optional enhancements).
- **Hover Transitions**: Color shifts to hover states are active.`);

  // 7. Do / Don't
  sections.push(`## 7. Do / Don't

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
  if (includeRawAppendix && rawSamples.length > 0) {
    sections.push(`## 9. Raw Extraction Appendix

<details>
<summary>Click to expand raw computed element styles (Total visible scanned nodes: ${rawSamples.length})</summary>

| Tag | Selector | Text | Bounding Rect | Colors / Styles |
|-----|----------|------|---------------|-----------------|
${rawSamples.slice(0, 60).map(s => 
  `| \`${s.tagName}\` | \`${s.selector}\` | \`${(s.textSample || '-').replace(/\|/g, '\\|')}\` | ${s.rect.width}×${s.rect.height}px | bg:\`${s.computedStyles.backgroundColor || '-'}\` color:\`${s.computedStyles.color || '-'}\` border:\`${s.computedStyles.borderRadius || '-'}\` |`
).join('\n')}

</details>`);
  }

  return sections.join('\n\n');
}

// ─── Main Service Export ──────────────────────────────────────────────────────

export async function extractWebsiteDesign(
  url: string,
  options: WebsiteExtractOptions = {}
): Promise<WebsiteExtractResult> {
  const {
    captureScreenshot = true,
    includeDomCss = true,
    viewportWidth = 1440,
    viewportHeight = 900
  } = options;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Invalid URL: "${url}"`);
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error(`Only http:// and https:// URLs are supported. Got: ${parsedUrl.protocol}`);
  }

  const capturedAt = Date.now();
  const desktopUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  const win = new BrowserWindow({
    width: viewportWidth,
    height: viewportHeight,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      javascript: true,
      images: true,
      sandbox: true
    }
  });

  win.webContents.setUserAgent(desktopUA);
  win.webContents.setAudioMuted(true);

  try {
    // 1. STABILIZED LOAD
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Page load timed out after 30 seconds: ${url}`));
      }, 30000);

      win.webContents.once('did-finish-load', () => {
        clearTimeout(timeout);
        resolve();
      });
      win.webContents.once('did-fail-load', (_e, errCode, errDesc) => {
        clearTimeout(timeout);
        reject(new Error(`Page failed to load (${errCode}): ${errDesc}`));
      });

      win.loadURL(url).catch(reject);
    });

    // Injected stabilizer script checking document status, loaded fonts, images, and skeletons
    const STABILIZATION_SCRIPT = `
      (async function checkStability() {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        
        // Wait for basic document ready
        for (let i = 0; i < 40; i++) {
          if (document.readyState === 'complete') break;
          await sleep(150);
        }

        // Wait for fonts to load
        try {
          if (document.fonts) {
            await document.fonts.ready;
          }
        } catch (e) {}

        // Wait for images to load
        try {
          const imgs = Array.from(document.images);
          for (let i = 0; i < 20; i++) {
            const incomplete = imgs.filter(img => !img.complete);
            if (incomplete.length === 0) break;
            await sleep(150);
          }
        } catch (e) {}

        // Detect skeleton placeholders
        let skeletonFound = false;
        for (let i = 0; i < 30; i++) {
          const skeletons = document.querySelectorAll("[class*='skeleton'], [class*='shimmer'], [class*='loader'], [class*='loading'], [class*='placeholder'], [id*='skeleton'], [id*='loader']");
          if (skeletons.length === 0) {
            break;
          }
          skeletonFound = true;
          await sleep(200); // wait for placeholders to clear
        }

        return { skeletonFound };
      })();
    `;

    // 2. STABILIZATION WAIT RUN & SKELETON CHECK
    let skeletonDetected = false;
    try {
      const stabRes = await win.webContents.executeJavaScript(STABILIZATION_SCRIPT, true);
      if (stabRes && typeof stabRes === 'object') {
        skeletonDetected = stabRes.skeletonFound || false;
      }
    } catch (err) {
      console.warn('[DesignExtractor] Stabilization script execution failed:', err);
    }

    // 3. OVERLAYS CLEANUP & VARIANT GUESSTIMATING
    const CLEANUP_SCRIPT = `
      (function clearBanners() {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        let overlaysRemovedCount = 0;
        let visibleTextCount = document.body.innerText ? document.body.innerText.length : 0;
        
        // Count visual interaction tags
        const buttonCount = document.querySelectorAll("button, [role='button'], a.btn, a.button").length;
        const cardCount = document.querySelectorAll("[class*='card'], [id*='card']").length;
        const navCount = document.querySelectorAll("nav, [role='navigation']").length;

        // Detect if site rendered mobile/web-player variants instead of classic desktop layout
        let pageVariant = 'desktop';
        const mobileKeywords = /mobile|phone|android|iphone|web-player|app-install|open-app/i;
        if (mobileKeywords.test(document.body.className) || mobileKeywords.test(document.body.id) || document.querySelector("[class*='open-app'], [class*='download-app']")) {
          pageVariant = 'mobile';
        }

        // Overlay Cleanup
        const selectors = [
          // GDPR & Cookies
          "[class*='cookie']", "[class*='consent']", "[class*='onetrust']", "[class*='ot-']", "[class*='privacy']",
          "[id*='cookie']", "[id*='consent']", "[id*='onetrust']", "[id*='ot-']", "[id*='privacy']",
          // General modals & App banner blockers
          "[class*='modal']", "[class*='overlay']", "[class*='popup']", "[class*='banner']",
          "[id*='modal']", "[id*='overlay']", "[id*='popup']", "[id*='banner']",
          "[class*='open-app']", "[class*='download-app']", "[class*='install-prompt']",
          "[class*='sign-in']", "[class*='login-modal']", "[class*='interstitial']",
          // Promo widgets
          "[class*='promo']", "[class*='promo-banner']", "[class*='chat-widget']"
        ];

        selectors.forEach(sel => {
          try {
            const elements = document.querySelectorAll(sel);
            elements.forEach(el => {
              const rect = el.getBoundingClientRect();
              const area = rect.width * rect.height;
              const viewArea = window.innerWidth * window.innerHeight;

              // If zIndex is high or element covers significant area, remove or hide it
              const style = window.getComputedStyle(el);
              const isFixed = style.position === 'fixed' || style.position === 'absolute';
              const zIndex = parseInt(style.zIndex, 10);

              if ((isFixed && (zIndex >= 99 || area > viewArea * 0.35)) || (area > viewArea * 0.7)) {
                // Ensure we don't accidentally delete major app grids/containers
                if (!['body', 'html', 'main', '#app', '#root'].includes(el.tagName.toLowerCase())) {
                  el.style.display = 'none';
                  overlaysRemovedCount++;
                }
              }
            });
          } catch (e) {}
        });

        return {
          overlaysRemovedCount,
          visibleTextCount,
          buttonCount,
          cardCount,
          navCount,
          pageVariant
        };
      })();
    `;

    let cleanupRes = {
      overlaysRemovedCount: 0,
      visibleTextCount: 0,
      buttonCount: 0,
      cardCount: 0,
      navCount: 0,
      pageVariant: 'desktop' as 'desktop' | 'mobile'
    };

    try {
      const cRes = await win.webContents.executeJavaScript(CLEANUP_SCRIPT, true);
      if (cRes && typeof cRes === 'object') {
        cleanupRes = cRes;
      }
    } catch (err) {
      console.warn('[DesignExtractor] Cleanup script execution failed:', err);
    }

    // 4. QUALITY VALIDATION SCORE & RECAPTURE RETRY
    let qualityScore = 0;
    if (cleanupRes.visibleTextCount >= 200) qualityScore += 30;
    if ((cleanupRes.buttonCount + cleanupRes.cardCount + cleanupRes.navCount) >= 3) qualityScore += 30;
    if (!skeletonDetected) qualityScore += 40;

    // Trigger auto-recapture retry if quality score is low
    if (qualityScore < 50) {
      console.warn(`[DesignExtractor] Capture Quality Low (Score: ${qualityScore}). Retrying stabilization recaptures...`);
      // Wait for an extra 2500ms
      await new Promise(r => setTimeout(r, 2500));
      try {
        const newStab = await win.webContents.executeJavaScript(STABILIZATION_SCRIPT, true);
        skeletonDetected = newStab?.skeletonFound || false;
        const newCleanup = await win.webContents.executeJavaScript(CLEANUP_SCRIPT, true);
        if (newCleanup && typeof newCleanup === 'object') {
          cleanupRes = newCleanup;
        }
        // Recalculate score
        qualityScore = 0;
        if (cleanupRes.visibleTextCount >= 200) qualityScore += 30;
        if ((cleanupRes.buttonCount + cleanupRes.cardCount + cleanupRes.navCount) >= 3) qualityScore += 30;
        if (!skeletonDetected) qualityScore += 40;
      } catch (e) {
        console.warn('[DesignExtractor] Recapture retry execution failed:', e);
      }
    }

    const finalUrl = win.webContents.getURL();
    const title = win.webContents.getTitle();

    // 5. MULTI-SECTION SCREENSHOTS & STYLE EXTRACTION SCROLL LOOP
    let screenshotAboveFoldBase64: string | undefined;
    let screenshotMidPageBase64: string | undefined;
    let screenshotLowerPageBase64: string | undefined;
    let screenshotsCount = 0;
    let rawElements: RawExtractedStyleSample[] = [];

    try {
      const folds = [0, viewportHeight, viewportHeight * 2];
      for (let i = 0; i < folds.length; i++) {
        const scrollY = folds[i];
        await win.webContents.executeJavaScript(`window.scrollTo(0, ${scrollY})`);
        await new Promise(r => setTimeout(r, 400));

        let foldBase64 = '';
        if (captureScreenshot) {
          try {
            const img = await win.webContents.capturePage();
            foldBase64 = img.toPNG().toString('base64');
            screenshotsCount++;
            if (i === 0) screenshotAboveFoldBase64 = foldBase64;
            else if (i === 1) screenshotMidPageBase64 = foldBase64;
            else if (i === 2) screenshotLowerPageBase64 = foldBase64;
          } catch (e) {}
        }

        if (includeDomCss) {
          try {
            const rawRes = await win.webContents.executeJavaScript(CSS_EXTRACT_SCRIPT, true);
            if (Array.isArray(rawRes)) {
              const adjusted = (rawRes as RawExtractedStyleSample[]).map(el => ({
                ...el,
                rect: {
                  ...el.rect,
                  y: el.rect.y + scrollY
                }
              }));
              rawElements.push(...adjusted);
            }
          } catch (e) {}
        }
      }

      // Reset scroll position to top
      await win.webContents.executeJavaScript(`window.scrollTo(0, 0)`);
    } catch (err) {
      console.warn('[DesignExtractor] Multi-section captures failed:', err);
    }

    // Stage 2: Run Noise Filtering
    const { clean, noiseCount } = runNoiseFiltering(rawElements);

    // Stage 3: Normalize style nodes & score confidence
    const report = runTokenNormalization(clean, noiseCount);

    // Stage 4: Synthesise default DESIGN.md
    const designMd = generateDesignMd(report, {
      url, finalUrl, title, capturedAt, viewportWidth, viewportHeight
    }, false);

    // Build raw WebsiteDesignTokens object for backward compatibility
    const fallbackColors = {
      primary: report.colors.filter(c => c.role === 'primary').map(c => c.hex),
      neutral: report.colors.filter(c => c.role === 'border' || c.role === 'surface').map(c => c.hex),
      semantic: report.colors.filter(c => c.role.startsWith('semantic')).map(c => c.hex),
      background: report.colors.filter(c => c.role === 'background').map(c => c.hex),
      text: report.colors.filter(c => c.role === 'text' || c.role === 'mutedText').map(c => c.hex),
      border: report.colors.filter(c => c.role === 'border').map(c => c.hex)
    };

    const fallbackTypography: WebsiteDesignTokens['typography'] = {
      fontFamilies: report.typography.slice(0, 3).map(t => t.fontFamily || '').filter(Boolean),
      scale: report.typography.map((t): WebsiteTypographyEntry => ({
        role: t.role,
        fontFamily: t.fontFamily,
        fontSize: t.fontSize,
        fontWeight: t.fontWeight,
        lineHeight: t.lineHeight
      }))
    };

    const fallbackTokens: WebsiteDesignTokens = {
      colors: fallbackColors,
      typography: fallbackTypography,
      spacing: report.spacing.map(s => s.value),
      radius: report.radius.map(r => r.value),
      shadows: report.shadows.map(s => s.value),
      components: {
        buttons: report.components.filter(c => c.component === 'button').map(c => ({
          selector: c.evidence[0]?.selector || 'button',
          bg: c.properties.backgroundColor,
          color: c.properties.color,
          borderRadius: c.properties.borderRadius,
          padding: c.properties.padding,
          border: c.properties.border
        })),
        inputs: report.components.filter(c => c.component === 'input').map(c => ({
          selector: c.evidence[0]?.selector || 'input',
          bg: c.properties.backgroundColor,
          border: c.properties.border,
          borderRadius: c.properties.borderRadius
        })),
        cards: [],
        nav: report.components.filter(c => c.component === 'nav').map(c => ({
          selector: c.evidence[0]?.selector || 'nav',
          bg: c.properties.backgroundColor,
          color: c.properties.color
        })),
        badges: []
      }
    };

    // Metadata
    const captureMetadata: WebsiteCaptureMetadata = {
      viewport: `${viewportWidth}×${viewportHeight}px`,
      userAgent: desktopUA,
      pageVariant: cleanupRes.pageVariant,
      qualityScore,
      overlaysRemovedCount: cleanupRes.overlaysRemovedCount,
      skeletonDetected,
      screenshotsCount
    };

    return {
      url,
      finalUrl,
      title,
      capturedAt,
      viewportWidth,
      viewportHeight,
      screenshotAboveFoldBase64,
      screenshotMidPageBase64,
      screenshotLowerPageBase64,
      captureMetadata,
      tokens: fallbackTokens,
      normalizedReport: report,
      rawElements: rawElements,
      designMd
    };

  } finally {
    win.destroy();
  }
}

// ─── Multi-Source Analyzer Orchestrator & Helpers ─────────────────────────────

interface TaggedStyleSample extends RawExtractedStyleSample {
  sourceUrl: string;
  viewport: 'desktop' | 'tablet' | 'mobile';
  sectionIndex: number;
}

function extractDominantColorsFromBase64(base64Data: string): string[] {
  try {
    let cleanBase64 = base64Data;
    if (base64Data.startsWith('data:')) {
      const parts = base64Data.split(',');
      cleanBase64 = parts[1] || base64Data;
    }
    const buffer = Buffer.from(cleanBase64, 'base64');
    const image = nativeImage.createFromBuffer(buffer);
    if (image.isEmpty()) return [];
    
    // Resize the image to 100x100 to make scanning super fast and auto-quantize/blur noise!
    const resized = image.resize({ width: 100 });
    const bitmap = resized.toBitmap() as any; // RGBA buffer
    
    const colorCounts: { [hex: string]: number } = {};
    const rgbToHex = (r: number, g: number, b: number) => 
      '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
      
    for (let i = 0; i < bitmap.length; i += 16) { // step by 4 pixels (16 bytes)
      const r = bitmap[i];
      const g = bitmap[i + 1];
      const b = bitmap[i + 2];
      const a = bitmap[i + 3];
      if (a < 150) continue; // ignore transparent pixels
      
      // Quantize colors slightly to group similar shades (round to nearest 8)
      const qr = Math.round(r / 8) * 8;
      const qg = Math.round(g / 8) * 8;
      const qb = Math.round(b / 8) * 8;
      const hex = rgbToHex(qr, qg, qb);
      
      // Boost highly saturated/vibrant colors to prevent them from being drowned out by massive dark background fields
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const diff = max - min;
      const isVibrant = diff > 45 && max > 60;
      const weight = isVibrant ? 12 : 1;
      
      colorCounts[hex] = (colorCounts[hex] || 0) + weight;
    }
    
    const sorted = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(entry => entry[0]);
      
    return sorted;
  } catch (err) {
    console.warn('[DesignExtractor] extractDominantColorsFromBase64 failed:', err);
    return [];
  }
}

async function extractDominantColorsFromUserImage(base64Data: string): Promise<string[]> {
  return extractDominantColorsFromBase64(base64Data);
}

function mergeMultiSourceTokens(
  cleanElements: TaggedStyleSample[],
  noiseCount: number,
  userImagesColors: string[]
): WebsiteDesignReport {
  let darkBackgroundArea = 0;
  let lightBackgroundArea = 0;

  for (const el of cleanElements) {
    if (el.computedStyles.backgroundColor) {
      const parsed = parseRgb(el.computedStyles.backgroundColor);
      if (parsed) {
        const lum = luminance(parsed[0], parsed[1], parsed[2]);
        const area = el.rect.width * el.rect.height;
        if (lum < 0.25) {
          darkBackgroundArea += area;
        } else {
          lightBackgroundArea += area;
        }
      }
    }
  }
  const isDarkFirst = darkBackgroundArea >= lightBackgroundArea;
  const detectedTheme = isDarkFirst ? 'Dark Mode' : 'Light Mode';

  const colorMap = new Map<string, {
    bgCount: number;
    textCount: number;
    borderCount: number;
    weightedScore: number;
    evidence: Map<string, { selector: string; tagName: string; count: number }>;
    sources: Set<string>;
    viewports: Set<string>;
    sections: Set<number>;
  }>();

  const getOrInitColor = (hex: string) => {
    const lowerHex = hex.toLowerCase();
    if (!colorMap.has(lowerHex)) {
      colorMap.set(lowerHex, {
        bgCount: 0,
        textCount: 0,
        borderCount: 0,
        weightedScore: 0,
        evidence: new Map(),
        sources: new Set(),
        viewports: new Set(),
        sections: new Set()
      });
    }
    return colorMap.get(lowerHex)!;
  };

  const addColorEvidence = (
    hex: string,
    selector: string,
    tagName: string,
    type: 'bg' | 'text' | 'border',
    element: TaggedStyleSample
  ) => {
    const entry = getOrInitColor(hex);
    if (type === 'bg') entry.bgCount++;
    if (type === 'text') entry.textCount++;
    if (type === 'border') entry.borderCount++;

    entry.sources.add(element.sourceUrl);
    entry.viewports.add(element.viewport);
    entry.sections.add(element.sectionIndex);

    let weight = 1;
    const area = element.rect.width * element.rect.height;

    if (area >= 200000) weight += 50;
    else if (area >= 50000) weight += 15;
    else if (area >= 10000) weight += 5;

    if (['button', 'input', 'select'].includes(tagName)) weight += 10;
    else if (/^h[1-6]$/.test(tagName)) weight += 8;
    else if (tagName === 'a') weight += 5;
    else if (['body', 'html', 'main', 'root'].includes(tagName)) weight += 50;

    if (element.rect.y >= 0 && element.rect.y < 900) {
      weight += 3;
    }

    entry.weightedScore += weight;

    const evKey = `${selector}:${tagName}`;
    if (!entry.evidence.has(evKey)) {
      entry.evidence.set(evKey, { selector, tagName, count: 0 });
    }
    entry.evidence.get(evKey)!.count++;
  };

  for (const el of cleanElements) {
    const s = el.selector || el.tagName;
    const tag = el.tagName;

    if (el.computedStyles.backgroundColor) {
      const hex = colorToHex(el.computedStyles.backgroundColor);
      if (hex) addColorEvidence(hex, s, tag, 'bg', el);
    }
    if (el.computedStyles.color) {
      const hex = colorToHex(el.computedStyles.color);
      if (hex) addColorEvidence(hex, s, tag, 'text', el);
    }
    if (el.computedStyles.borderColor) {
      const hex = colorToHex(el.computedStyles.borderColor);
      if (hex) addColorEvidence(hex, s, tag, 'border', el);
    }
    if (el.computedStyles.fill) {
      const hex = colorToHex(el.computedStyles.fill);
      if (hex) addColorEvidence(hex, s, tag, 'bg', el);
    }
    if (el.computedStyles.stroke) {
      const hex = colorToHex(el.computedStyles.stroke);
      if (hex) addColorEvidence(hex, s, tag, 'border', el);
    }
    if (el.computedStyles.gradientColors && Array.isArray(el.computedStyles.gradientColors)) {
      for (const gColor of el.computedStyles.gradientColors) {
        const hex = colorToHex(gColor);
        if (hex) addColorEvidence(hex, s, tag, 'bg', el);
      }
    }
  }

  for (const uColor of userImagesColors) {
    const entry = getOrInitColor(uColor);
    entry.weightedScore += 60;
    entry.bgCount += 5;
  }

  const colors: NormalizedColorToken[] = [];
  for (const [hex, details] of colorMap.entries()) {
    const totalOccurrences = details.bgCount + details.textCount + details.borderCount;
    if (totalOccurrences === 0) continue;

    const distinctUrls = details.sources.size;
    const distinctViewports = details.viewports.size;
    const distinctSections = details.sections.size;
    let multiplier = 1.0;
    if (distinctUrls > 1) multiplier += (distinctUrls - 1) * 2.0;
    if (distinctViewports > 1) multiplier += (distinctViewports - 1) * 1.5;
    if (distinctSections > 1) multiplier += (distinctSections - 1) * 0.8;
    
    details.weightedScore *= multiplier;

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (details.weightedScore >= 25) {
      confidence = 'high';
    } else if (details.weightedScore >= 5) {
      confidence = 'medium';
    }

    let role: NormalizedColorToken['role'] = 'unknown';
    const parsed = parseRgb(hex.startsWith('#') ? `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})` : hex);
    
    if (parsed) {
      const [h, s, l] = rgbToHsl(parsed[0], parsed[1], parsed[2]);
      const lum = luminance(parsed[0], parsed[1], parsed[2]);

      const isFrequentBg = details.bgCount >= details.textCount && details.bgCount >= details.borderCount;
      const isFrequentText = details.textCount > details.bgCount && details.textCount >= details.borderCount;
      const isFrequentBorder = details.borderCount > details.bgCount && details.borderCount > details.textCount;

      if (isFrequentBg) {
        if (s < 15) {
          if (lum < 0.25) {
            role = lum < 0.08 ? 'background' : 'surface';
          } else if (lum > 0.8) {
            role = 'background';
          } else {
            role = 'surface';
          }
        } else {
          role = details.bgCount >= 2 ? 'primary' : 'accent';
        }
      } else if (isFrequentText) {
        if (s < 15) {
          if (isDarkFirst) {
            role = lum > 0.7 ? 'text' : 'mutedText';
          } else {
            role = lum < 0.35 ? 'text' : 'mutedText';
          }
        } else {
          role = 'accent';
        }
      } else if (isFrequentBorder) {
        role = 'border';
      }

      if (role === 'unknown' || role === 'accent') {
        if (s > 25) {
          if ((h >= 0 && h < 20) || (h > 340 && h <= 360)) {
            role = 'semanticDanger';
          } else if (h >= 80 && h < 155) {
            role = 'semanticSuccess';
          } else if (h >= 20 && h < 80) {
            role = 'semanticWarning';
          }
        }
      }

      if (role === 'unknown') {
        role = s > 15 ? 'primary' : 'accent';
      }
    }

    const evidence = Array.from(details.evidence.values())
      .map(ev => ({
        selector: ev.selector,
        tagName: ev.tagName,
        usage: details.bgCount > details.textCount ? 'background' : 'foreground',
        count: ev.count
      }))
      .slice(0, 3);

    colors.push({ hex, role, confidence, evidence });
  }

  const fontFamiliesSet = new Set<string>();
  const typeMap = new Map<string, {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    lineHeight: string;
    tags: Set<string>;
    selectors: Set<string>;
    textSamples: Set<string>;
    count: number;
    weightedScore: number;
    sources: Set<string>;
    viewports: Set<string>;
  }>();

  for (const el of cleanElements) {
    const cs = el.computedStyles;
    if (!cs.fontFamily || !cs.fontSize) continue;

    const rawFamily = cs.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    if (rawFamily) fontFamiliesSet.add(rawFamily);

    const fKey = `${rawFamily}:${cs.fontSize}:${cs.fontWeight || '400'}:${cs.lineHeight || 'normal'}`;
    if (!typeMap.has(fKey)) {
      typeMap.set(fKey, {
        fontFamily: rawFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight || 'normal',
        lineHeight: cs.lineHeight || 'normal',
        tags: new Set(),
        selectors: new Set(),
        textSamples: new Set(),
        count: 0,
        weightedScore: 0,
        sources: new Set(),
        viewports: new Set()
      });
    }

    const typeEntry = typeMap.get(fKey)!;
    typeEntry.count++;
    if (el.tagName) typeEntry.tags.add(el.tagName);
    if (el.selector) typeEntry.selectors.add(el.selector);
    if (el.textSample) typeEntry.textSamples.add(el.textSample);
    typeEntry.sources.add(el.sourceUrl);
    typeEntry.viewports.add(el.viewport);

    let weight = 1;
    const area = el.rect.width * el.rect.height;
    if (area >= 200000) weight += 40;
    else if (area >= 50000) weight += 15;
    else if (area >= 10000) weight += 5;

    if (/^h[1-6]$/.test(el.tagName)) weight += 15;
    else if (['button', 'a'].includes(el.tagName)) weight += 8;
    else if (['body', 'html', 'main'].includes(el.tagName)) weight += 50;

    if (el.rect.y >= 0 && el.rect.y < 900) {
      weight += 3;
    }
    typeEntry.weightedScore += weight;
  }

  const typography: NormalizedTypographyToken[] = [];
  for (const [_, spec] of typeMap.entries()) {
    const distinctUrls = spec.sources.size;
    const distinctVps = spec.viewports.size;
    let mult = 1.0;
    if (distinctUrls > 1) mult += (distinctUrls - 1) * 1.5;
    if (distinctVps > 1) mult += (distinctVps - 1) * 1.2;
    spec.weightedScore *= mult;

    let confidence: 'high' | 'medium' | 'low' = 'low';
    if (spec.weightedScore >= 25) confidence = 'high';
    else if (spec.weightedScore >= 5) confidence = 'medium';

    let role: NormalizedTypographyToken['role'] = 'unknown';
    const numSize = parseFloat(spec.fontSize);
    const tagsArr = Array.from(spec.tags);
    const isHeadingTag = tagsArr.some(t => /^h[1-6]$/.test(t));
    const isWrapperTag = tagsArr.some(t => ['div', 'body', 'html', 'section', 'main'].includes(t));

    if (isHeadingTag) {
      if (numSize >= 32) role = 'display';
      else if (numSize >= 24) role = 'heading1';
      else if (numSize >= 20) role = 'heading2';
      else role = 'heading3';
    } else if (tagsArr.includes('button')) {
      role = 'button';
    } else if (tagsArr.includes('a')) {
      role = 'link';
    } else {
      if (numSize >= 24 && !isWrapperTag) {
        role = 'display';
      } else if (numSize <= 11) {
        role = 'caption';
      } else if (numSize <= 13) {
        role = 'bodySmall';
      } else {
        role = 'body';
      }
    }

    const evidence = Array.from(spec.selectors).slice(0, 3).map(sel => {
      const matchingEl = cleanElements.find(e => e.selector === sel);
      return {
        selector: sel,
        tagName: matchingEl?.tagName,
        textSample: matchingEl?.textSample,
        count: spec.count
      };
    });

    typography.push({
      role,
      fontFamily: spec.fontFamily,
      fontSize: spec.fontSize,
      fontWeight: spec.fontWeight,
      lineHeight: spec.lineHeight,
      confidence,
      evidence
    });
  }

  const spacingScores = new Map<string, { count: number; weightedScore: number }>();
  const radiusScores = new Map<string, { count: number; weightedScore: number }>();
  const shadowScores = new Map<string, { count: number; weightedScore: number }>();

  for (const el of cleanElements) {
    const cs = el.computedStyles;
    let weight = 1;
    const area = el.rect.width * el.rect.height;
    if (area >= 200000) weight += 20;
    else if (area >= 50000) weight += 8;

    if (['body', 'html', 'main'].includes(el.tagName)) weight += 20;

    const cleanPads = sanitizeSpacing(cs.padding);
    for (const p of cleanPads) {
      const entry = spacingScores.get(p) || { count: 0, weightedScore: 0 };
      entry.count++;
      entry.weightedScore += weight;
      spacingScores.set(p, entry);
    }

    const cleanMars = sanitizeSpacing(cs.margin);
    for (const m of cleanMars) {
      const entry = spacingScores.get(m) || { count: 0, weightedScore: 0 };
      entry.count++;
      entry.weightedScore += weight;
      spacingScores.set(m, entry);
    }

    const cleanRadius = sanitizeRadius(cs.borderRadius);
    for (const r of cleanRadius) {
      const entry = radiusScores.get(r) || { count: 0, weightedScore: 0 };
      entry.count++;
      entry.weightedScore += weight;
      radiusScores.set(r, entry);
    }

    if (cs.boxShadow && cs.boxShadow !== 'none' && !cs.boxShadow.includes('rgba(0, 0, 0, 0)')) {
      const entry = shadowScores.get(cs.boxShadow) || { count: 0, weightedScore: 0 };
      entry.count++;
      entry.weightedScore += weight;
      shadowScores.set(cs.boxShadow, entry);
    }
  }

  const buildTokenList = (scores: Map<string, { count: number; weightedScore: number }>) => {
    return Array.from(scores.entries())
      .map(([value, details]) => {
        let confidence: 'high' | 'medium' | 'low' = 'low';
        if (details.weightedScore >= 20) confidence = 'high';
        else if (details.weightedScore >= 5) confidence = 'medium';
        return { value, confidence, count: details.count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  };

  const spacing = buildTokenList(spacingScores);
  const radius = buildTokenList(radiusScores);
  const shadows = buildTokenList(shadowScores);

  const components: NormalizedComponentRule[] = [];

  const buttonsGroup = cleanElements.filter(e => {
    const isBtn = e.tagName === 'button' || (e.tagName === 'a' && /btn|button/i.test(e.className)) || e.attrs.role === 'button';
    if (!isBtn) return false;
    const w = e.rect.width;
    const h = e.rect.height;
    if (w <= 12 || h <= 12) return false;

    const bg = e.computedStyles.backgroundColor || 'transparent';
    const isTransparent = bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)';
    const pad = e.computedStyles.padding || '0px';
    const hasNoPadding = pad === '0px' || pad === '0px 0px';
    const hasNoText = !e.textSample || e.textSample.trim().length === 0;

    if (isTransparent && hasNoPadding && hasNoText) return false;
    return true;
  });

  if (buttonsGroup.length > 0) {
    const buttonStyles = new Map<string, { bg: string; color: string; radius: string; padding: string; border: string; samples: TaggedStyleSample[] }>();
    for (const b of buttonsGroup) {
      const bg = b.computedStyles.backgroundColor || 'transparent';
      const col = b.computedStyles.color || 'inherit';
      const rad = b.computedStyles.borderRadius || '0px';
      const pad = b.computedStyles.padding || '0px';
      const bor = b.computedStyles.border || 'none';
      const sKey = `${bg}:${col}:${rad}:${pad}`;
      if (!buttonStyles.has(sKey)) {
        buttonStyles.set(sKey, { bg, color: col, radius: rad, padding: pad, border: bor, samples: [] });
      }
      buttonStyles.get(sKey)!.samples.push(b);
    }

    const sortedStyles = Array.from(buttonStyles.values()).sort((a, b) => b.samples.length - a.samples.length);
    sortedStyles.forEach((bs, index) => {
      let role = index === 0 ? 'primary pattern' : index === 1 ? 'secondary pattern' : 'icon/utility pattern';
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (bs.samples.length >= 4) confidence = 'high';
      else if (bs.samples.length >= 1) confidence = 'medium';

      components.push({
        component: 'button',
        confidence,
        properties: {
          patternName: role,
          backgroundColor: bs.bg,
          color: bs.color,
          borderRadius: bs.radius,
          padding: bs.padding,
          border: bs.border,
          observedCount: String(bs.samples.length)
        },
        evidence: bs.samples.slice(0, 3).map(s => ({ selector: s.selector, textSample: s.textSample }))
      });
    });
  }

  const inputsGroup = cleanElements.filter(e => ['input', 'textarea', 'select'].includes(e.tagName));
  if (inputsGroup.length > 0) {
    const inputStyles = new Map<string, { border: string; bg: string; radius: string; samples: TaggedStyleSample[] }>();
    for (const inp of inputsGroup) {
      const bor = inp.computedStyles.border || 'none';
      const bg = inp.computedStyles.backgroundColor || 'transparent';
      const rad = inp.computedStyles.borderRadius || '0px';
      const iKey = `${bor}:${bg}:${rad}`;
      if (!inputStyles.has(iKey)) {
        inputStyles.set(iKey, { border: bor, bg, radius: rad, samples: [] });
      }
      inputStyles.get(iKey)!.samples.push(inp);
    }

    Array.from(inputStyles.values()).slice(0, 2).forEach((is, idx) => {
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (is.samples.length >= 4) confidence = 'high';
      else if (is.samples.length >= 1) confidence = 'medium';

      components.push({
        component: 'input',
        confidence,
        properties: {
          patternName: idx === 0 ? 'standard input' : 'alternative input',
          border: is.border,
          backgroundColor: is.bg,
          borderRadius: is.radius,
          observedCount: String(is.samples.length)
        },
        evidence: is.samples.slice(0, 3).map(s => ({ selector: s.selector, textSample: s.textSample }))
      });
    });
  }

  const navGroup = cleanElements.filter(e => e.tagName === 'nav' || e.attrs.role === 'navigation' || e.selector.includes('nav') || e.className.includes('nav'));
  if (navGroup.length > 0) {
    components.push({
      component: 'nav',
      confidence: 'medium',
      properties: {
        tagName: navGroup[0].tagName,
        backgroundColor: navGroup[0].computedStyles.backgroundColor || 'transparent',
        color: navGroup[0].computedStyles.color || 'inherit',
        observedCount: String(navGroup.length)
      },
      evidence: navGroup.slice(0, 3).map(s => ({ selector: s.selector }))
    });
  }

  const highConfidenceCount = colors.filter(c => c.confidence === 'high').length +
                           typography.filter(t => t.confidence === 'high').length +
                           spacing.filter(s => s.confidence === 'high').length +
                           radius.filter(r => r.confidence === 'high').length +
                           components.filter(c => c.confidence === 'high').length;

  const mediumConfidenceCount = colors.filter(c => c.confidence === 'medium').length +
                             typography.filter(t => t.confidence === 'medium').length +
                             spacing.filter(s => s.confidence === 'medium').length +
                             radius.filter(r => r.confidence === 'medium').length +
                             components.filter(c => c.confidence === 'medium').length;

  const lowConfidenceCount = colors.filter(c => c.confidence === 'low').length +
                           typography.filter(t => t.confidence === 'low').length +
                           spacing.filter(s => s.confidence === 'low').length +
                           radius.filter(r => r.confidence === 'low').length +
                           components.filter(c => c.confidence === 'low').length;

  let overallScore: WebsiteDesignConfidenceSummary['overallScore'] = 'low';
  if (highConfidenceCount > 5 && highConfidenceCount > lowConfidenceCount) {
    overallScore = 'high';
  } else if (highConfidenceCount + mediumConfidenceCount >= 3) {
    overallScore = 'medium';
  }

  const confidenceSummary: WebsiteDesignConfidenceSummary = {
    highConfidenceCount,
    mediumConfidenceCount,
    lowConfidenceCount,
    noiseElementsFiltered: noiseCount,
    overallScore
  };

  const primaryCol = colors.find(c => c.role === 'primary')?.hex || colors.find(c => c.confidence === 'high' && c.role === 'accent')?.hex || 'N/A';
  const summary = {
    theme: detectedTheme,
    mood: primaryCol !== 'N/A' ? `Modern Branding (Primary Accent: ${primaryCol})` : 'Minimalist Layout',
    layoutStyle: spacing.length > 0 ? `Consistent Spacing Rhythm (Tokens: ${spacing.slice(0, 3).map(s => s.value).join(', ')})` : 'Variable Flow Layout',
    mainInteractionStyle: components.some(c => c.component === 'button' && (c.properties.borderRadius === '9999px' || parseFloat(c.properties.borderRadius || '0px') > 15)) ? 'Smooth / Highly Rounded Controls' : 'Square / Angular Controls',
    confidenceNote: `Merged style entries from multiple source folders. Scanned ${cleanElements.length} elements; evaluated ${highConfidenceCount} high-confidence layout patterns.`
  };

  return {
    summary,
    colors,
    typography,
    spacing,
    radius,
    shadows,
    components,
    confidenceSummary
  };
}

function generateMultiSourceDesignMd(
  report: WebsiteDesignReport,
  coverage: WebsiteDesignCoverageSummary[],
  overallQuality: number
): string {
  const dateStr = new Date().toISOString().split('T')[0];
  const sections: string[] = [];

  const primaryCol = report.colors.find(c => c.role === 'primary')?.hex 
    || report.colors.find(c => c.role === 'accent' && parseRgb(c.hex) && rgbToHsl(parseRgb(c.hex)![0], parseRgb(c.hex)![1], parseRgb(c.hex)![2])[1] > 20)?.hex
    || (report.colors.length > 0 ? report.colors[0].hex : 'N/A');

  const bgCol = report.colors.find(c => c.role === 'background')?.hex 
    || report.colors.find(c => c.role === 'surface')?.hex
    || (report.summary.theme.includes('Dark') ? '#121212' : '#ffffff');

  sections.push(`# UNIFIED DESIGN SYSTEM — AgentDeck Extractor

> Auto-generated by AgentDeck Multi-Source Design System Analyzer  
> Scanned Date: ${dateStr}  
> Average Quality Score: **${overallQuality} / 100**  
> Unified Confidence: **${report.confidenceSummary.overallScore.toUpperCase()}**  

---

## 0. Source Coverage

Detailed layout sources, screenshots, and visual tokens compiled into this report:

| Source Name / URL | Viewports Scanned | Sections Captured | Quality Score | Notes & Observations |
|-------------------|-------------------|-------------------|---------------|----------------------|
${coverage.map(c => 
  `| ${c.source} | ${c.viewports.join(', ')} | ${c.sectionsCaptured} folds | ${c.qualityScore} | ${c.notes} |`
).join('\n')}

---

## 1. Design Summary

- **Theme Mode**: ${report.summary.theme}
- **Visual Direction**: ${report.summary.mood}
- **Core Style Pattern**: ${report.summary.mainInteractionStyle}
- **Confidence Notes**: ${report.summary.confidenceNote}`);

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
  `| \`${c.role}\` | \`${c.hex}\` | **${c.confidence.toUpperCase()}** | ${c.evidence.map(e => `\`${e.selector}\` (${e.count})`).join(', ') || 'Visual Upload / Multi-Source Merged'} |`
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

  const supportingColors = report.colors.filter(c => c.confidence === 'low');
  const supportingType = report.typography.filter(t => t.confidence === 'low');

  sections.push(`## 3. Supporting / Uncertain Tokens

Rarely observed style fragments or lower-confidence secondary style choices:

${supportingColors.length > 0 ? `### Supplementary Colors\n${supportingColors.map(c => `- Color \`${c.hex}\` (inferred \`${c.role}\` role): Found on ${c.evidence.map(e => `\`${e.selector}\` (${e.count}×)`).join(', ')}`).join('\n')}` : ''}

${supportingType.length > 0 ? `### Secondary Typography\n${supportingType.map(t => `- Size \`${t.fontSize}\` (\`${t.fontWeight}\`): Observed on ${t.evidence.map(e => `\`${e.selector}\``).join(', ')}`).join('\n')}` : ''}

${report.shadows.length > 0 ? `### Shadows\n${report.shadows.map(s => `- Shadow (\`${s.confidence}\`, ${s.count}×): \`${s.value}\``).join('\n')}` : ''}`);

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

  sections.push(`## 5. Layout & Spacing

- **Primary Spacing Blocks**: ${report.spacing.slice(0, 6).map(s => `\`${s.value}\``).join(', ') || 'chưa xác minh được'}
- **Grid Layout Scale**: Layout dimensions prioritize clean spacing scales. Column paddings snap to core scales.`);

  sections.push(`## 6. Motion / Interaction Style

- **Observed Transitions**: \`chưa xác minh được\` (Transitions and CSS keyframes are optional enhancements).
- **Hover Transitions**: Color shifts to hover states are active.`);

  sections.push(`## 7. Do / Don't

- **DO** match the verified primary colors for standard button hover/interactive controls.
- **DO** match the high-confidence typography layout for primary text cards.
- **DON'T** inject custom border-radius properties outside the observed \`${report.radius.slice(0, 3).map(r => r.value).join(', ') || '0px'}\` scale.
- **DON'T** introduce negative spacing properties or custom layout margins.`);

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

  const extractedHexes = new Set(report.colors.map(c => c.hex.toLowerCase()));
  const finalPromptGuide = promptGuideText.replace(/#([0-9a-fA-F]{3,6})\b/g, (match) => {
    const matchedHex = match.toLowerCase();
    if (extractedHexes.has(matchedHex)) return match;
    if (primaryCol !== 'N/A' && primaryCol !== 'none') return primaryCol;
    return match;
  });

  sections.push(finalPromptGuide);

  return sections.join('\n\n');
}

export async function extractWebsiteDesignMultiSource(
  urls: WebsiteAnalysisSourceUrl[],
  viewports: string[],
  userScreenshots: UserProvidedDesignScreenshot[]
): Promise<WebsiteAnalysisRun> {
  const sectionCaptures: WebsiteSectionScreenshot[] = [];
  const coverageSummaries: WebsiteDesignCoverageSummary[] = [];
  const allTaggedElements: TaggedStyleSample[] = [];
  const userImagesColors: string[] = [];
  
  const uuidModule = await import('node:crypto');

  const activeUrls = urls.filter(u => u.enabled);

  // 1. Process User Screenshots
  for (const screenshot of userScreenshots) {
    let base64 = screenshot.dataBase64;
    if (!base64 && screenshot.filePath) {
      try {
        const fs = await import('node:fs');
        if (fs.existsSync(screenshot.filePath)) {
          base64 = 'data:image/png;base64,' + fs.readFileSync(screenshot.filePath).toString('base64');
        }
      } catch (err) {
        console.warn(`[MultiSource] Failed to read user screenshot at ${screenshot.filePath}:`, err);
      }
    }

    if (base64) {
      const colors = await extractDominantColorsFromUserImage(base64);
      userImagesColors.push(...colors);
      coverageSummaries.push({
        source: screenshot.label || screenshot.notes || 'Uploaded Screenshot',
        viewports: [screenshot.viewportHint || 'unknown'],
        sectionsCaptured: 1,
        qualityScore: 100,
        notes: `Extracted ${colors.length} dominant visual colors: ${colors.join(', ')}`
      });

      // Add to sectionCaptures so they show up in the Screenshots tab!
      sectionCaptures.push({
        id: screenshot.id,
        sourceUrlId: screenshot.id, // match select option value
        url: 'Uploaded Screenshot',
        finalUrl: screenshot.label || 'Mockup Upload',
        viewport: { name: (screenshot.viewportHint === 'unknown' ? 'desktop' : screenshot.viewportHint) as any, width: 1440, height: 900 },
        scrollY: 0,
        sectionIndex: 0,
        screenshotBase64: base64.replace(/^data:image\/[a-z]+;base64,/, ''), // clean standard base64 content
        capturedAt: new Date().toISOString(),
        quality: {
          score: 100,
          skeletonDetected: false,
          overlaysRemovedCount: 0,
          visibleTextCount: 0
        }
      });
    }
  }

  // 2. Process active URLs
  for (const src of activeUrls) {
    const crawledViewports: string[] = [];
    let urlSectionsCaptured = 0;
    let urlQualityScoreSum = 0;
    let urlQualityCount = 0;
    let finalUrlString = src.url;
    let titleString = '';

    for (const vpName of viewports) {
      if (vpName !== 'desktop' && vpName !== 'tablet' && vpName !== 'mobile') continue;
      crawledViewports.push(vpName);

      let width = 1440;
      let height = 900;
      let ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

      if (vpName === 'tablet') {
        width = 768;
        height = 1024;
        ua = "Mozilla/5.0 (iPad; CPU OS 15_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Mobile/15E148 Safari/604.1";
      } else if (vpName === 'mobile') {
        width = 390;
        height = 844;
        ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1";
      }

      const win = new BrowserWindow({
        width,
        height,
        show: false,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          javascript: true,
          images: true,
          sandbox: true
        }
      });
      win.webContents.setUserAgent(ua);
      win.webContents.setAudioMuted(true);

      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Timeout loading ${src.url} (${vpName})`));
          }, 30000);

          win.webContents.once('did-finish-load', () => {
            clearTimeout(timeout);
            resolve();
          });
          win.webContents.once('did-fail-load', (_e, errCode, errDesc) => {
            clearTimeout(timeout);
            reject(new Error(`Failed to load ${src.url}: ${errDesc} (${errCode})`));
          });

          win.loadURL(src.url).catch(reject);
        });

        const STABILIZATION_SCRIPT = `
          (async function checkStability() {
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            for (let i = 0; i < 40; i++) {
              if (document.readyState === 'complete') break;
              await sleep(150);
            }
            try { if (document.fonts) await document.fonts.ready; } catch (e) {}
            try {
              const imgs = Array.from(document.images);
              for (let i = 0; i < 20; i++) {
                const incomplete = imgs.filter(img => !img.complete);
                if (incomplete.length === 0) break;
                await sleep(150);
              }
            } catch (e) {}
            let skeletonFound = false;
            for (let i = 0; i < 30; i++) {
              const skeletons = document.querySelectorAll("[class*='skeleton'], [class*='shimmer'], [class*='loader'], [class*='loading'], [class*='placeholder'], [id*='skeleton'], [id*='loader']");
              if (skeletons.length === 0) break;
              skeletonFound = true;
              await sleep(200);
            }
            return { skeletonFound };
          })();
        `;

        let skeletonDetected = false;
        try {
          const stabRes = await win.webContents.executeJavaScript(STABILIZATION_SCRIPT, true);
          if (stabRes) skeletonDetected = stabRes.skeletonFound;
        } catch (e) {}

        const CLEANUP_SCRIPT = `
          (function clearBanners() {
            let overlaysRemovedCount = 0;
            let visibleTextCount = document.body.innerText ? document.body.innerText.length : 0;
            const buttonCount = document.querySelectorAll("button, [role='button'], a.btn, a.button").length;
            const cardCount = document.querySelectorAll("[class*='card'], [id*='card']").length;
            const navCount = document.querySelectorAll("nav, [role='navigation']").length;
            let pageVariant = 'desktop';
            const mobileKeywords = /mobile|phone|android|iphone|web-player|app-install|open-app/i;
            if (mobileKeywords.test(document.body.className) || mobileKeywords.test(document.body.id) || document.querySelector("[class*='open-app'], [class*='download-app']")) {
              pageVariant = 'mobile';
            }

            const selectors = [
              "[class*='cookie']", "[class*='consent']", "[class*='onetrust']", "[class*='ot-']", "[class*='privacy']",
              "[id*='cookie']", "[id*='consent']", "[id*='onetrust']", "[id*='ot-']", "[id*='privacy']",
              "[class*='modal']", "[class*='overlay']", "[class*='popup']", "[class*='banner']",
              "[id*='modal']", "[id*='overlay']", "[id*='popup']", "[id*='banner']",
              "[class*='open-app']", "[class*='download-app']", "[class*='install-prompt']",
              "[class*='sign-in']", "[class*='login-modal']", "[class*='interstitial']",
              "[class*='promo']", "[class*='promo-banner']", "[class*='chat-widget']"
            ];

            selectors.forEach(sel => {
              try {
                document.querySelectorAll(sel).forEach(el => {
                  const rect = el.getBoundingClientRect();
                  const area = rect.width * rect.height;
                  const viewArea = window.innerWidth * window.innerHeight;
                  const style = window.getComputedStyle(el);
                  const isFixed = style.position === 'fixed' || style.position === 'absolute';
                  const zIndex = parseInt(style.zIndex, 10);

                  if ((isFixed && (zIndex >= 99 || area > viewArea * 0.35)) || (area > viewArea * 0.7)) {
                    if (!['body', 'html', 'main', '#app', '#root'].includes(el.tagName.toLowerCase())) {
                      el.style.display = 'none';
                      overlaysRemovedCount++;
                    }
                  }
                });
              } catch (e) {}
            });

            return { overlaysRemovedCount, visibleTextCount, buttonCount, cardCount, navCount, pageVariant };
          })();
        `;

        let cleanupRes = { overlaysRemovedCount: 0, visibleTextCount: 0, buttonCount: 0, cardCount: 0, navCount: 0, pageVariant: 'desktop' };
        try {
          const cRes = await win.webContents.executeJavaScript(CLEANUP_SCRIPT, true);
          if (cRes) cleanupRes = cRes;
        } catch (e) {}

        let qualityScore = 0;
        if (cleanupRes.visibleTextCount >= 200) qualityScore += 30;
        if ((cleanupRes.buttonCount + cleanupRes.cardCount + cleanupRes.navCount) >= 3) qualityScore += 30;
        if (!skeletonDetected) qualityScore += 40;

        if (qualityScore < 50) {
          await new Promise(r => setTimeout(r, 2000));
          try {
            const stabRes = await win.webContents.executeJavaScript(STABILIZATION_SCRIPT, true);
            if (stabRes) skeletonDetected = stabRes.skeletonFound;
            const cRes = await win.webContents.executeJavaScript(CLEANUP_SCRIPT, true);
            if (cRes) cleanupRes = cRes;
            qualityScore = 0;
            if (cleanupRes.visibleTextCount >= 200) qualityScore += 30;
            if ((cleanupRes.buttonCount + cleanupRes.cardCount + cleanupRes.navCount) >= 3) qualityScore += 30;
            if (!skeletonDetected) qualityScore += 40;
          } catch (e) {}
        }

        finalUrlString = win.webContents.getURL();
        titleString = win.webContents.getTitle();
        urlQualityScoreSum += qualityScore;
        urlQualityCount++;

        const scrollHeight = await win.webContents.executeJavaScript('Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)');
        const maxFolds = Math.min(8, Math.ceil(scrollHeight / height));

        for (let i = 0; i < maxFolds; i++) {
          const scrollY = i * height;
          await win.webContents.executeJavaScript(`window.scrollTo(0, ${scrollY})`);
          await new Promise(r => setTimeout(r, 400));

          let screenshotBase64 = '';
          try {
            const img = await win.webContents.capturePage();
            screenshotBase64 = img.toPNG().toString('base64');
          } catch (e) {}

          // Extract CSS elements specifically for this fold section to handle lazy loading
          let foldElements: RawExtractedStyleSample[] = [];
          try {
            const rawRes = await win.webContents.executeJavaScript(CSS_EXTRACT_SCRIPT, true);
            if (Array.isArray(rawRes)) {
              foldElements = (rawRes as RawExtractedStyleSample[]).map(el => ({
                ...el,
                rect: {
                  ...el.rect,
                  y: el.rect.y + scrollY
                }
              }));
            }
          } catch (e) {}

          foldElements.forEach(el => {
            allTaggedElements.push({
              ...el,
              sourceUrl: src.url,
              viewport: vpName as any,
              sectionIndex: i
            });
          });

          // Perform high-performance visual color extraction on the crawled section screenshot
          if (screenshotBase64) {
            const visualColors = extractDominantColorsFromBase64(screenshotBase64);
            userImagesColors.push(...visualColors);
          }

          sectionCaptures.push({
            id: `fold-${uuidModule.randomUUID()}`,
            sourceUrlId: src.id,
            url: src.url,
            finalUrl: finalUrlString,
            viewport: { name: vpName as any, width, height },
            scrollY,
            sectionIndex: i,
            screenshotBase64,
            capturedAt: new Date().toISOString(),
            quality: {
              score: qualityScore,
              skeletonDetected,
              overlaysRemovedCount: cleanupRes.overlaysRemovedCount,
              visibleTextCount: cleanupRes.visibleTextCount
            }
          });

          urlSectionsCaptured++;
        }

        await win.webContents.executeJavaScript('window.scrollTo(0, 0)');

      } catch (err) {
        console.warn(`[MultiSource] Failed capturing URL "${src.url}" for viewport "${vpName}":`, err);
      } finally {
        win.destroy();
      }
    }

    coverageSummaries.push({
      source: src.label || src.url,
      viewports: crawledViewports,
      sectionsCaptured: urlSectionsCaptured,
      qualityScore: urlQualityCount > 0 ? Math.round(urlQualityScoreSum / urlQualityCount) : 0,
      notes: `Successfully analyzed ${urlSectionsCaptured} scroll sections. finalUrl: ${finalUrlString}`
    });
  }

  const { clean, noiseCount } = runNoiseFiltering(allTaggedElements);
  const report = mergeMultiSourceTokens(clean as TaggedStyleSample[], noiseCount, userImagesColors);

  const overallQuality = coverageSummaries.length > 0
    ? Math.round(coverageSummaries.reduce((sum, c) => sum + c.qualityScore, 0) / coverageSummaries.length)
    : 0;

  const designMd = generateMultiSourceDesignMd(report, coverageSummaries, overallQuality);

  return {
    id: `analysis-${uuidModule.randomUUID()}`,
    sources: urls,
    userScreenshots,
    sectionCaptures,
    overallQualityScore: overallQuality,
    coverageSummaries,
    report,
    designMd
  };
}

// Export options type for IPC compatibility
export type { WebsiteExtractOptions } from '../../shared/types.js';

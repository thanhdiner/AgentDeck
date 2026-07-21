import { callLLMRaw, type LLMSettings } from './projectInitService.js';
import crypto from 'node:crypto';

// ─── Design Token Extraction ─────────────────────────────────────────────────

/** Convert Figma's 0-1 RGB components to a CSS hex string */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Convert Figma's 0-1 RGBA components to a CSS rgba() string */
function rgbaToString(r: number, g: number, b: number, a: number): string {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${parseFloat(a.toFixed(2))})`;
}

interface TypographyToken {
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  lineHeightPx?: number;
  letterSpacing?: number;
  role: string;
  sampleText: string;
}

interface DesignTokens {
  colors: string[];
  gradients: string[];
  typography: TypographyToken[];
  spacing: string[];
  borderRadii: string[];
  shadows: string[];
  dimensions: { width: number; height: number };
}

/**
 * Traverses the Figma node tree and extracts exact design tokens.
 * Colors are converted from Figma's 0-1 RGB to proper CSS hex/rgba strings.
 */
function extractDesignTokens(figmaJson: any): DesignTokens {
  const tokens: DesignTokens = {
    colors: [],
    gradients: [],
    typography: [],
    spacing: [],
    borderRadii: [],
    shadows: [],
    dimensions: { width: 0, height: 0 },
  };

  const seenColors = new Set<string>();
  const seenTypo = new Set<string>();

  // Capture root canvas dimensions
  const bbox = figmaJson.absoluteBoundingBox || figmaJson.size;
  if (bbox) {
    tokens.dimensions.width = Math.round(bbox.width || 0);
    tokens.dimensions.height = Math.round(bbox.height || 0);
  }

  function traverseNode(node: any, depth: number = 0) {
    if (!node || typeof node !== 'object' || depth > 8) return;

    // ── Fills / Colors / Gradients ──────────────────────────────────────────
    if (Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill.visible === false) continue;
        if (fill.type === 'SOLID' && fill.color) {
          const { r, g, b } = fill.color;
          const a = fill.opacity !== undefined ? fill.opacity : (fill.color.a !== undefined ? fill.color.a : 1);
          const colorStr = a < 0.99 ? rgbaToString(r, g, b, a) : rgbToHex(r, g, b);
          if (!seenColors.has(colorStr)) {
            seenColors.add(colorStr);
            tokens.colors.push(colorStr);
          }
        } else if (fill.type === 'GRADIENT_LINEAR' || fill.type === 'GRADIENT_RADIAL') {
          if (Array.isArray(fill.gradientStops)) {
            const stops = fill.gradientStops.map((s: any) => {
              const hex = rgbToHex(s.color.r, s.color.g, s.color.b);
              return `${hex} ${Math.round(s.position * 100)}%`;
            }).join(', ');
            const kind = fill.type === 'GRADIENT_RADIAL' ? 'radial-gradient' : 'linear-gradient';
            tokens.gradients.push(`${kind}(${stops})`);
          }
        }
      }
    }

    // ── Strokes ─────────────────────────────────────────────────────────────
    if (Array.isArray(node.strokes)) {
      for (const stroke of node.strokes) {
        if (stroke.visible === false) continue;
        if (stroke.type === 'SOLID' && stroke.color) {
          const hex = rgbToHex(stroke.color.r, stroke.color.g, stroke.color.b);
          if (!seenColors.has(hex)) {
            seenColors.add(hex);
            tokens.colors.push(hex);
          }
        }
      }
    }

    // ── Typography ───────────────────────────────────────────────────────────
    if (node.type === 'TEXT' && node.style) {
      const s = node.style;
      const key = `${s.fontFamily}-${s.fontSize}-${s.fontWeight}`;
      if (!seenTypo.has(key)) {
        seenTypo.add(key);
        tokens.typography.push({
          fontFamily: s.fontFamily || 'inherit',
          fontSize: s.fontSize || 16,
          fontWeight: s.fontWeight || 400,
          lineHeightPx: s.lineHeightPx,
          letterSpacing: s.letterSpacing,
          role: node.name || 'text',
          sampleText: node.characters ? String(node.characters).substring(0, 80) : '',
        });
      }
    }

    // ── Layout / Spacing ─────────────────────────────────────────────────────
    if (node.layoutMode && (node.paddingTop !== undefined || node.paddingLeft !== undefined || node.itemSpacing !== undefined)) {
      const pt = node.paddingTop ?? 0;
      const pr = node.paddingRight ?? 0;
      const pb = node.paddingBottom ?? 0;
      const pl = node.paddingLeft ?? 0;
      const gap = node.itemSpacing;
      const label = node.name ? ` ("${node.name}")` : '';
      if (pt || pr || pb || pl) {
        tokens.spacing.push(`padding: ${pt}px ${pr}px ${pb}px ${pl}px${label}`);
      }
      if (gap !== undefined && gap > 0) {
        tokens.spacing.push(`gap: ${gap}px${label}`);
      }
    }

    // ── Border Radius ────────────────────────────────────────────────────────
    if (node.cornerRadius !== undefined && node.cornerRadius > 0) {
      const label = node.name ? ` ("${node.name}")` : '';
      tokens.borderRadii.push(`border-radius: ${node.cornerRadius}px${label}`);
    } else if (Array.isArray(node.rectangleCornerRadii)) {
      const [tl, tr, br, bl] = node.rectangleCornerRadii as number[];
      if (tl || tr || br || bl) {
        const label = node.name ? ` ("${node.name}")` : '';
        tokens.borderRadii.push(`border-radius: ${tl}px ${tr}px ${br}px ${bl}px${label}`);
      }
    }

    // ── Shadows / Effects ────────────────────────────────────────────────────
    if (Array.isArray(node.effects)) {
      for (const effect of node.effects) {
        if (effect.visible === false) continue;
        if ((effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') && effect.color) {
          const { r, g, b, a } = effect.color;
          const inset = effect.type === 'INNER_SHADOW' ? 'inset ' : '';
          const x = effect.offset?.x ?? 0;
          const y = effect.offset?.y ?? 0;
          const blur = effect.radius ?? 0;
          const spread = effect.spread ?? 0;
          const colorStr = rgbaToString(r, g, b, a ?? 1);
          const label = node.name ? ` (on "${node.name}")` : '';
          tokens.shadows.push(`box-shadow: ${inset}${x}px ${y}px ${blur}px ${spread}px ${colorStr}${label}`);
        }
      }
    }

    // ── Recurse ──────────────────────────────────────────────────────────────
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        traverseNode(child, depth + 1);
      }
    }
  }

  traverseNode(figmaJson, 0);

  // Limit lists to avoid bloating the prompt
  tokens.colors     = tokens.colors.slice(0, 20);
  tokens.gradients  = tokens.gradients.slice(0, 6);
  tokens.typography = tokens.typography.slice(0, 12);
  tokens.spacing    = tokens.spacing.slice(0, 20);
  tokens.borderRadii = tokens.borderRadii.slice(0, 12);
  tokens.shadows    = tokens.shadows.slice(0, 8);

  return tokens;
}

/** Format extracted tokens into a human-readable block for injection into LLM prompts */
function formatDesignTokensForPrompt(tokens: DesignTokens): string {
  const lines: string[] = [
    '=========================================',
    'PRE-EXTRACTED DESIGN TOKENS (parsed from Figma JSON)',
    '=========================================',
    `Canvas Dimensions: ${tokens.dimensions.width}px × ${tokens.dimensions.height}px`,
    '',
  ];

  if (tokens.colors.length > 0) {
    lines.push('COLORS (exact CSS values — use these verbatim):');
    tokens.colors.forEach(c => lines.push(`  • ${c}`));
    lines.push('');
  }

  if (tokens.gradients.length > 0) {
    lines.push('GRADIENTS:');
    tokens.gradients.forEach(g => lines.push(`  • ${g}`));
    lines.push('');
  }

  if (tokens.typography.length > 0) {
    lines.push('TYPOGRAPHY (exact values — do not guess or approximate):');
    tokens.typography.forEach(t => {
      const lh = t.lineHeightPx ? ` / line-height: ${t.lineHeightPx}px` : '';
      const ls = t.letterSpacing ? ` / letter-spacing: ${t.letterSpacing}px` : '';
      const sample = t.sampleText ? ` ← sample: "${t.sampleText}"` : '';
      lines.push(`  • role: "${t.role}" → font: ${t.fontWeight} ${t.fontSize}px "${t.fontFamily}"${lh}${ls}${sample}`);
    });
    lines.push('');
  }

  if (tokens.spacing.length > 0) {
    lines.push('SPACING & LAYOUT (exact values):');
    tokens.spacing.forEach(s => lines.push(`  • ${s}`));
    lines.push('');
  }

  if (tokens.borderRadii.length > 0) {
    lines.push('BORDER RADIUS (exact values):');
    tokens.borderRadii.forEach(r => lines.push(`  • ${r}`));
    lines.push('');
  }

  if (tokens.shadows.length > 0) {
    lines.push('SHADOWS (exact values):');
    tokens.shadows.forEach(s => lines.push(`  • ${s}`));
    lines.push('');
  }

  lines.push('=========================================');
  lines.push('CRITICAL RULE: The above values are extracted DIRECTLY from the Figma source.');
  lines.push('You MUST use these exact values in all CSS. Do NOT approximate, substitute, or invent alternatives.');
  lines.push('=========================================');

  return lines.join('\n');
}

// ─── System Prompts ───────────────────────────────────────────────────────────

// Thread 1: Design Spec Analyzer
const systemPrompt1 = `You are a Senior UI/UX Architect.
Your goal is to inspect the provided Figma selection context and produce a structured, high-fidelity visual design analysis in JSON.
You must output a single valid JSON object containing the "analysis" block only. Do not output any markdown text outside the JSON block. Do not wrap the JSON in markdown fences unless it's a single clean block of \`\`\`json.

IMPORTANT: The prompt will contain a "PRE-EXTRACTED DESIGN TOKENS" section with exact HEX/rgba colors, exact font sizes, exact spacing values parsed directly from Figma. You MUST reference and use these exact values in your analysis — do not re-interpret or approximate them.

Here is the exact JSON schema you must satisfy:
{
  "analysis": {
    "id": "string (generated UUID)",
    "sourceUrl": "string (the Figma selection URL)",
    "nodeName": "string (the Figma layer/frame/component name)",
    "nodeType": "string (the Figma node type, e.g. FRAME, COMPONENT)",
    "dimensions": {
      "width": "number (width of selection)",
      "height": "number (height of selection)"
    },
    "detectedSections": [
      {
        "id": "string (unique key)",
        "name": "string (e.g. Hero Section, Header, Pricing Grid)",
        "type": "string (functional type, e.g., hero, header, footer, features)",
        "description": "string (what visual content or controls it contains)"
      }
    ],
    "detectedComponents": [
      {
        "id": "string (unique key)",
        "name": "string (e.g. Primary Coral Button, Form Input, Badge)",
        "type": "string (element type, e.g., button, input, badge, card)",
        "description": "string (appearance and behaviors detailed)",
        "props": ["string (suggested component props)", "..."],
        "styles": ["string (exact CSS styling rules extracted from design tokens)", "..."]
      }
    ],
    "colors": ["string (exact HEX or RGBA CSS color values from the pre-extracted tokens section)"],
    "typography": [
      {
        "fontFamily": "string",
        "fontSize": "number",
        "fontWeight": "number or string (e.g., 600 or 'semibold')",
        "lineHeight": "number or string (optional)",
        "role": "string (e.g., heading-1, subtitle, body, button)"
      }
    ],
    "spacingHints": ["string (e.g. 'padding: 16px 24px', 'gap: 12px between items')"],
    "layoutHints": ["string (e.g. 'display: flex', 'align-items: center')"],
    "assetHints": ["string (e.g. 'needs search icon SVG', 'needs close mark')"],
    "responsiveHints": ["string (e.g. 'stacks columns to single column under 768px')"],
    "motionOpportunities": [
      {
        "elementId": "string (matches the component or section ID)",
        "elementName": "string",
        "trigger": "hover" | "scroll" | "mount" | "click" | "active",
        "type": "fade" | "slide" | "scale" | "spring" | "rotate" | "shimmer",
        "description": "string (describe how this animation behaves)"
      }
    ],
    "risks": ["string (implementation warnings, e.g., 'Ensure custom font is loaded', 'Requires SVG alignment helper')"]
  }
}`;

// Thread 2: Step-by-Step Task Planner
const systemPrompt2 = `You are a Senior Frontend Technical Implementation Lead.
Your goal is to inspect the provided Figma selection context and produce a structured, high-fidelity sequential UI build plan in JSON.
You must output a single valid JSON object containing the "tasks" array only. Do not output any markdown text outside the JSON block. Do not wrap the JSON in markdown fences unless it's a single clean block of \`\`\`json.

IMPORTANT: The prompt will contain a "PRE-EXTRACTED DESIGN TOKENS" section with exact HEX/rgba colors, exact font sizes (in px), exact padding/gap values, exact border-radius and box-shadow values — all parsed directly from Figma. You MUST embed these exact values verbatim inside every "promptPayload" string. The coding agent WILL NOT have access to the Figma file, so the prompt must be 100% self-contained with all design values included.

Here is the exact JSON schema you must satisfy:
{
  "tasks": [
    {
      "id": "string (sequential IDs: task-1, task-2, etc.)",
      "title": "string (concise task title)",
      "description": "string (concise description of what needs to be implemented in this step)",
      "status": "todo",
      "targetFile": "string (the path to the target file to create or modify, relative to workspace root)",
      "dependsOn": ["string (ids of tasks this task relies on)"],
      "promptPayload": "string (A detailed, pixel-perfect developer prompt for a coding agent like Claude Code or Codex CLI. MUST include: exact HEX colors, exact font sizes/weights/families, exact padding/margin/gap values, exact border-radius, exact box-shadow, SVG paths for decorative curves/connectors, hover animation specs with exact transform values and durations. The coding agent has NO access to Figma — every value must be spelled out explicitly in this prompt.)"
    }
  ]
}

P0 Scope Constraints & High Visual Fidelity Rules:
- Only generate tasks that build the SELECTED frame/section/component.
- Do NOT generate plans to rebuild the entire application, add routing frameworks, or create huge database tables/data models.
- STRICT DESIGN FIDELITY: Every promptPayload MUST embed the exact CSS values from the pre-extracted tokens block. Avoid vague instructions like "use a dark background" — instead write "background-color: #18181B".
- VECTOR CONNECTORS & SHAPES: If the design contains vector connecting lines, curves (like curved timeline paths, wavy background graphics, decorative lines, or connector shapes), check the "extractedVectorAssets" object in the JSON tree (which maps Figma node IDs to local workspace file paths like "figma_assets/vector-ID.svg"). You MUST explicitly instruct the developer agent in the promptPayload to use these saved SVG files directly (e.g. using <img src="figma_assets/vector-ID.svg"> or background-image: url("figma_assets/vector-ID.svg")) to preserve pixel-perfect visual similarity, instead of writing raw SVG coordinates or guessing the path data.
- TYPOGRAPHY: Every promptPayload must specify font-family, font-size in px, font-weight as a number, line-height in px, and letter-spacing in px for each text element.
- COLORS: Use only the exact HEX/rgba values from the pre-extracted tokens. Reference them by name in the prompt (e.g. "primary accent: #FF7051").
- MICRO-ANIMATIONS: Specify exact transition duration (e.g. 300ms), easing curve (e.g. cubic-bezier(0.4, 0, 0.2, 1)), transform values (e.g. translateY(-4px) scale(1.02)), and trigger (hover/mount/scroll).
- Target vanilla CSS/JS/HTML or React+Tailwind/CSS matching the workspace.
- Each promptPayload must instruct the agent to read existing style files first so it doesn't break conventions.
- Prefer 3–5 focused tasks over 1–2 very large tasks to ensure each step is completable without errors.`;

// ─── Helper to sanitize LLM response and parse as JSON ───────────────────────

async function parseLLMResponse(rawResponse: string) {
  let clean = rawResponse.trim();
  if (clean.startsWith('```json')) {
    clean = clean.slice(7);
  }
  if (clean.startsWith('```')) {
    clean = clean.slice(3);
  }
  if (clean.endsWith('```')) {
    clean = clean.slice(0, -3);
  }
  clean = clean.trim();
  return JSON.parse(clean);
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export async function analyzeFigmaDesignContext(
  importedContext: string,
  selectionUrl: string,
  settings: LLMSettings,
  workspaceContext?: any
) {
  if (!importedContext) {
    throw new Error('Imported Figma design context is empty.');
  }

  console.log(`[FIGMA ORCHESTRATOR] Starting parallel multi-threaded design analysis for url: ${selectionUrl}`);

  // ── Pre-extract design tokens from Figma JSON & clean context for LLM ──────
  let designTokensBlock = '';
  let cleanImportedContext = importedContext;
  try {
    const figmaJson = JSON.parse(importedContext);
    const tokens = extractDesignTokens(figmaJson);
    designTokensBlock = formatDesignTokensForPrompt(tokens);
    console.log(`[FIGMA ORCHESTRATOR] Pre-extracted design tokens: ${tokens.colors.length} colors, ${tokens.typography.length} type styles, ${tokens.spacing.length} spacing rules`);

    // Recursively clean heavy properties to prevent token bloat and truncation
    const cleanNode = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (Array.isArray(obj)) {
        obj.forEach(cleanNode);
        return;
      }
      
      if (typeof obj.previewImage === 'string' && obj.previewImage.startsWith('data:')) {
        delete obj.previewImage;
      }
      delete obj.previewImageBase64;
      delete obj.previewText;
      delete obj.svgContent;
      delete obj.childVectors;
      
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object') {
          cleanNode(obj[key]);
        }
      }
    };

    const cleanFigmaJson = JSON.parse(importedContext);
    cleanNode(cleanFigmaJson);
    cleanImportedContext = JSON.stringify(cleanFigmaJson, null, 2);
  } catch (err) {
    console.warn('[FIGMA ORCHESTRATOR] Could not pre-extract design tokens or clean context (non-JSON context or parse error), continuing without them:', err instanceof Error ? err.message : String(err));
  }

  // ── Workspace tech stack context ───────────────────────────────────────────
  let techStackContext = '';
  if (workspaceContext) {
    techStackContext = `
=========================================
WORKSPACE TECH STACK & ARCHITECTURE CONTEXT
=========================================
${workspaceContext.techStack ? `Detected Stack:\n${workspaceContext.techStack}` : ''}
${workspaceContext.folderStructure ? `Folder Structure:\n${workspaceContext.folderStructure}` : ''}
${workspaceContext.codingRules ? `Coding/Formatting Rules:\n${workspaceContext.codingRules}` : ''}
${workspaceContext.projectMemory ? `Project Info/Memory:\n${workspaceContext.projectMemory}` : ''}
=========================================
IMPORTANT DIRECTIVE FOR FILE & SYNTAX GENERATION:
You MUST generate the steps, target files, and prompt payloads tailored EXACTLY to the technology stack, framework, style conventions, and file paths detected in the workspace above.
For example:
- If the stack is pure HTML/CSS, target files MUST be index.html, style.css, etc., and code style must be HTML/CSS. Do NOT use React component file paths (.tsx) or TSX syntax!
- If the stack is React/TypeScript/Vite, use .tsx components and import standard styling tokens.
- Adjust the paths under 'targetFile' so they integrate seamlessly into the actual folder structure directory.
`;
  }

  const userPrompt = `Figma design node selection URL: ${selectionUrl}
Raw Figma Design Context (JSON Tree):
${cleanImportedContext.slice(0, 60000)}
${designTokensBlock ? `\n${designTokensBlock}\n` : ''}
${techStackContext}

Please analyze the selection and output the structured JSON.`;

  // Thread 1: Design Specs extraction
  const analysisPromise = (async () => {
    try {
      console.log('[FIGMA ORCHESTRATOR] Dispatching Spec Analyzer Thread...');
      const raw = await callLLMRaw(systemPrompt1, userPrompt, settings, true);
      const parsed = await parseLLMResponse(raw);
      return parsed.analysis || parsed;
    } catch (err: any) {
      console.error('[FIGMA ORCHESTRATOR] Spec Analyzer Thread failed:', err);
      throw new Error(`Design spec analysis failed: ${err.message || err}`);
    }
  })();

  // Thread 2: Step-by-Step Task sequence generation
  const tasksPromise = (async () => {
    try {
      console.log('[FIGMA ORCHESTRATOR] Dispatching Task Planner Thread...');
      const raw = await callLLMRaw(systemPrompt2, userPrompt, settings, true);
      const parsed = await parseLLMResponse(raw);
      return parsed.tasks || parsed;
    } catch (err: any) {
      console.error('[FIGMA ORCHESTRATOR] Task Planner Thread failed:', err);
      throw new Error(`Step planner failed: ${err.message || err}`);
    }
  })();

  try {
    const [analysisData, tasksData] = await Promise.all([analysisPromise, tasksPromise]);

    const plan = {
      analysis: analysisData,
      tasks: tasksData
    };

    // Ensure IDs exist and default properties are filled
    if (plan.analysis) {
      plan.analysis.id = plan.analysis.id || `analysis-${crypto.randomUUID()}`;
      plan.analysis.sourceUrl = plan.analysis.sourceUrl || selectionUrl;
    }

    if (Array.isArray(plan.tasks)) {
      plan.tasks = plan.tasks.map((task: any, index: number) => ({
        id: task.id || `task-${index + 1}`,
        title: task.title || 'Implementation Step',
        description: task.description || 'Modular task to code component.',
        status: task.status || 'todo',
        targetFile: task.targetFile || '',
        dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn : [],
        promptPayload: task.promptPayload || ''
      }));
    } else {
      plan.tasks = [];
    }

    console.log('[FIGMA ORCHESTRATOR] Parallel multi-threaded analysis finished successfully.');
    return plan;
  } catch (err: any) {
    console.error('[FIGMA ORCHESTRATOR] Parallel LLM analysis failed:', err);
    throw new Error(`Parallel LLM design analyzer failed: ${err.message || err}`);
  }
}

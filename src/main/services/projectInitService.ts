import fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectInitConfig } from '../../shared/types.js';

export async function applyInitAssets(workspacePath: string, config: ProjectInitConfig) {
  if (!workspacePath) {
    throw new Error('Workspace path is required.');
  }

  const resolvedRoot = path.resolve(workspacePath);

  // 1. Generate design-tokens.css inside the workspace root
  const mode = config.darkLightMode || 'dark';

  const darkPrimary   = config.primaryColor    || '#4f46e5';
  const darkSecondary = config.secondaryColor  || '#06b6d4';
  const darkBg        = config.backgroundColor || '#0b0d14';
  const darkText      = config.textColor       || '#f8fafc';
  const radius        = config.borderRadius    || '8px';

  const lightPrimary   = config.lightPrimaryColor   || '#4f46e5';
  const lightSecondary = config.lightSecondaryColor || '#06b6d4';
  const lightBg        = config.lightBackgroundColor || '#ffffff';
  const lightText      = config.lightTextColor      || '#0f172a';

  const primaryFont       = config.primaryFont       || 'Din Round';
  const secondaryFont     = config.secondaryFont     || 'Feather';
  const baseSpacing       = config.baseSpacing       || '8px';
  const containerMaxWidth = config.containerMaxWidth || '1200px';
  const buttonHeight      = config.buttonHeight      || '50px';
  const cardPadding       = config.cardPadding       || '24px';
  const cardShadow        = config.cardShadow        || '0px 2px 8px rgba(0, 0, 0, 0.04)';

  let cssContent = `/**
 * AgentDeck Generated Design Tokens
 * Enforced design boundaries for this project workspace.
 * Mode: ${mode}
 * Do not modify directly — regenerated when you Apply Blueprint.
 */\n`;

  if (mode === 'dark') {
    // Dark-only: define tokens directly on :root
    cssContent += `
:root {
  --primary-color: ${darkPrimary};
  --secondary-color: ${darkSecondary};
  --background-color: ${darkBg};
  --text-color: ${darkText};
  --border-radius: ${radius};
  --border-color: rgba(255, 255, 255, 0.08);
  --primary-glow: rgba(${hexToRgb(darkPrimary)}, 0.15);
  --secondary-glow: rgba(${hexToRgb(darkSecondary)}, 0.15);
  
  --primary-font: '${primaryFont}', sans-serif;
  --secondary-font: '${secondaryFont}', sans-serif;
  --base-spacing: ${baseSpacing};
  --container-max-width: ${containerMaxWidth};
  --button-height: ${buttonHeight};
  --card-padding: ${cardPadding};
  --card-shadow: ${cardShadow};

  /* Typography Scales (Duolingo-inspired Hierarchy) */
  --font-size-display: 48px;
  --font-size-h1: 32px;
  --font-size-body: 17px;
  --font-size-button: 15px;
  --font-size-caption: 15px;

  --font-weight-display: 700;
  --font-weight-h1: 700;
  --font-weight-body: 500;
  --font-weight-button: 700;
  --font-weight-caption: 700;

  --line-height-body: 24px;
  --line-height-nav: 20px;

  /* Spacing Scale (Duolingo-inspired) */
  --space-8: 8px;
  --space-12: 12px;
  --space-16: 16px;
  --space-24: 24px;
  --space-32: 32px;
  --space-40: 40px;
  --space-48: 48px;
  --space-64: 64px;
  --space-72: 72px;
  --space-80: 80px;
  --space-96: 96px;
  --space-100: 100px;

  /* Border Radius Scale */
  --radius-0: 0px;
  --radius-2: 2px;
  --radius-12: ${radius};
  --radius-full: 50%;

  /* Depth & Elevation Shadows */
  --shadow-none: none;
  --shadow-minimal: 0px 2px 4px rgba(0, 0, 0, 0.2);
  --shadow-elevated: ${cardShadow};
  --shadow-raised: 0px 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-highlight: 0px 2px 12px rgba(${hexToRgb(darkPrimary)}, 0.2);

  /* Component Tokens: Inputs & Forms */
  --input-height: 40px;
  --input-padding: 12px 16px;
  --input-border: 1px solid rgba(255, 255, 255, 0.15);
  --input-placeholder-color: #71717a;
  --input-disabled-bg: #1a1d2e;

  /* Component Tokens: Navigation */
  --nav-height: 70px;
  --nav-padding: 16px 24px;
  --nav-shadow: var(--shadow-minimal);

  /* Component Tokens: Badges & Links */
  --badge-padding: 4px 8px;
  --badge-bg: rgba(255, 255, 255, 0.08);
  --link-color: #38bdf8;
  --cta-link-height: 44px;

  /* Touch Targets (Accessibility) */
  --touch-target-min-width: 48px;
  --touch-target-min-height: 44px;
}
body {
  background-color: var(--background-color);
  color: var(--text-color);
  font-family: var(--primary-font), 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
}
`;
  } else if (mode === 'light') {
    // Light-only: define tokens directly on :root
    cssContent += `
:root {
  --primary-color: ${lightPrimary};
  --secondary-color: ${lightSecondary};
  --background-color: ${lightBg};
  --text-color: ${lightText};
  --border-radius: ${radius};
  --border-color: #E5E5E5;
  --primary-glow: rgba(${hexToRgb(lightPrimary)}, 0.12);
  --secondary-glow: rgba(${hexToRgb(lightSecondary)}, 0.12);

  --primary-font: '${primaryFont}', sans-serif;
  --secondary-font: '${secondaryFont}', sans-serif;
  --base-spacing: ${baseSpacing};
  --container-max-width: ${containerMaxWidth};
  --button-height: ${buttonHeight};
  --card-padding: ${cardPadding};
  --card-shadow: ${cardShadow};

  /* Typography Scales (Duolingo-inspired Hierarchy) */
  --font-size-display: 48px;
  --font-size-h1: 32px;
  --font-size-body: 17px;
  --font-size-button: 15px;
  --font-size-caption: 15px;

  --font-weight-display: 700;
  --font-weight-h1: 700;
  --font-weight-body: 500;
  --font-weight-button: 700;
  --font-weight-caption: 700;

  --line-height-body: 24px;
  --line-height-nav: 20px;

  /* Spacing Scale (Duolingo-inspired) */
  --space-8: 8px;
  --space-12: 12px;
  --space-16: 16px;
  --space-24: 24px;
  --space-32: 32px;
  --space-40: 40px;
  --space-48: 48px;
  --space-64: 64px;
  --space-72: 72px;
  --space-80: 80px;
  --space-96: 96px;
  --space-100: 100px;

  /* Border Radius Scale */
  --radius-0: 0px;
  --radius-2: 2px;
  --radius-12: ${radius};
  --radius-full: 50%;

  /* Depth & Elevation Shadows */
  --shadow-none: none;
  --shadow-minimal: 0px 2px 4px rgba(0, 0, 0, 0.04);
  --shadow-elevated: ${cardShadow};
  --shadow-raised: 0px 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-highlight: 0px 2px 12px rgba(${hexToRgb(lightPrimary)}, 0.12);

  /* Component Tokens: Inputs & Forms */
  --input-height: 40px;
  --input-padding: 12px 16px;
  --input-border: 1px solid #C1C1C1;
  --input-placeholder-color: #999999;
  --input-disabled-bg: #F5F5F5;

  /* Component Tokens: Navigation */
  --nav-height: 70px;
  --nav-padding: 16px 24px;
  --nav-shadow: var(--shadow-minimal);

  /* Component Tokens: Badges & Links */
  --badge-padding: 4px 8px;
  --badge-bg: #E5E5E5;
  --link-color: #0000EE;
  --cta-link-height: 44px;

  /* Touch Targets (Accessibility) */
  --touch-target-min-width: 48px;
  --touch-target-min-height: 44px;
}
body {
  background-color: var(--background-color);
  color: var(--text-color);
  font-family: var(--primary-font), 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
}
`;
  } else {
    // Both: :root = light defaults, .dark class + @media override with dark tokens
    cssContent += `
/* Light mode tokens (default) */
:root {
  --primary-color: ${lightPrimary};
  --secondary-color: ${lightSecondary};
  --background-color: ${lightBg};
  --text-color: ${lightText};
  --border-radius: ${radius};
  --border-color: #E5E5E5;
  --primary-glow: rgba(${hexToRgb(lightPrimary)}, 0.12);
  --secondary-glow: rgba(${hexToRgb(lightSecondary)}, 0.12);

  --primary-font: '${primaryFont}', sans-serif;
  --secondary-font: '${secondaryFont}', sans-serif;
  --base-spacing: ${baseSpacing};
  --container-max-width: ${containerMaxWidth};
  --button-height: ${buttonHeight};
  --card-padding: ${cardPadding};
  --card-shadow: ${cardShadow};

  /* Typography Scales (Duolingo-inspired Hierarchy) */
  --font-size-display: 48px;
  --font-size-h1: 32px;
  --font-size-body: 17px;
  --font-size-button: 15px;
  --font-size-caption: 15px;

  --font-weight-display: 700;
  --font-weight-h1: 700;
  --font-weight-body: 500;
  --font-weight-button: 700;
  --font-weight-caption: 700;

  --line-height-body: 24px;
  --line-height-nav: 20px;

  /* Spacing Scale (Duolingo-inspired) */
  --space-8: 8px;
  --space-12: 12px;
  --space-16: 16px;
  --space-24: 24px;
  --space-32: 32px;
  --space-40: 40px;
  --space-48: 48px;
  --space-64: 64px;
  --space-72: 72px;
  --space-80: 80px;
  --space-96: 96px;
  --space-100: 100px;

  /* Border Radius Scale */
  --radius-0: 0px;
  --radius-2: 2px;
  --radius-12: ${radius};
  --radius-full: 50%;

  /* Depth & Elevation Shadows */
  --shadow-none: none;
  --shadow-minimal: 0px 2px 4px rgba(0, 0, 0, 0.04);
  --shadow-elevated: ${cardShadow};
  --shadow-raised: 0px 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-highlight: 0px 2px 12px rgba(${hexToRgb(lightPrimary)}, 0.12);

  /* Component Tokens: Inputs & Forms */
  --input-height: 40px;
  --input-padding: 12px 16px;
  --input-border: 1px solid #C1C1C1;
  --input-placeholder-color: #999999;
  --input-disabled-bg: #F5F5F5;

  /* Component Tokens: Navigation */
  --nav-height: 70px;
  --nav-padding: 16px 24px;
  --nav-shadow: var(--shadow-minimal);

  /* Component Tokens: Badges & Links */
  --badge-padding: 4px 8px;
  --badge-bg: #E5E5E5;
  --link-color: #0000EE;
  --cta-link-height: 44px;

  /* Touch Targets (Accessibility) */
  --touch-target-min-width: 48px;
  --touch-target-min-height: 44px;
}

/* Dark mode tokens — applied via .dark class or system preference */
.dark,
[data-theme="dark"] {
  --primary-color: ${darkPrimary};
  --secondary-color: ${darkSecondary};
  --background-color: ${darkBg};
  --text-color: ${darkText};
  --border-color: rgba(255, 255, 255, 0.08);
  --primary-glow: rgba(${hexToRgb(darkPrimary)}, 0.15);
  --secondary-glow: rgba(${hexToRgb(darkSecondary)}, 0.15);

  --shadow-minimal: 0px 2px 4px rgba(0, 0, 0, 0.2);
  --shadow-raised: 0px 4px 12px rgba(0, 0, 0, 0.4);
  --shadow-highlight: 0px 2px 12px rgba(${hexToRgb(darkPrimary)}, 0.2);

  --input-border: 1px solid rgba(255, 255, 255, 0.15);
  --input-disabled-bg: #1a1d2e;
  --badge-bg: rgba(255, 255, 255, 0.08);
  --link-color: #38bdf8;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --primary-color: ${darkPrimary};
    --secondary-color: ${darkSecondary};
    --background-color: ${darkBg};
    --text-color: ${darkText};
    --border-color: rgba(255, 255, 255, 0.08);
    --primary-glow: rgba(${hexToRgb(darkPrimary)}, 0.15);
    --secondary-glow: rgba(${hexToRgb(darkSecondary)}, 0.15);

    --shadow-minimal: 0px 2px 4px rgba(0, 0, 0, 0.2);
    --shadow-raised: 0px 4px 12px rgba(0, 0, 0, 0.4);
    --shadow-highlight: 0px 2px 12px rgba(${hexToRgb(darkPrimary)}, 0.2);

    --input-border: 1px solid rgba(255, 255, 255, 0.15);
    --input-disabled-bg: #1a1d2e;
    --badge-bg: rgba(255, 255, 255, 0.08);
    --link-color: #38bdf8;
  }
}

body {
  background-color: var(--background-color);
  color: var(--text-color);
  font-family: var(--primary-font), 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  margin: 0;
  transition: background-color 0.2s ease, color 0.2s ease;
}
`;
  }

  // ── PREMIUM DESIGN SYSTEM COMPONENTS & UTILITIES ──
  cssContent += `
/* ==========================================================================
   DESIGN SYSTEM COMPONENTS & UTILITY CLASSES
   (Auto-generated from Blueprint)
   ========================================================================== */

/* ── Typography Utility Classes ── */
.text-display {
  font-family: var(--secondary-font);
  font-size: var(--font-size-display);
  font-weight: var(--font-weight-display);
  line-height: normal;
}
.text-h1 {
  font-family: var(--primary-font);
  font-size: var(--font-size-h1);
  font-weight: var(--font-weight-h1);
  line-height: normal;
}
.text-body {
  font-family: var(--primary-font);
  font-size: var(--font-size-body);
  font-weight: var(--font-weight-body);
  line-height: var(--line-height-body);
}
.text-button {
  font-family: var(--primary-font);
  font-size: var(--font-size-button);
  font-weight: var(--font-weight-button);
}
.text-caption {
  font-family: var(--primary-font);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-caption);
}

/* ── Container ── */
.container {
  max-width: var(--container-max-width);
  margin-left: auto;
  margin-right: auto;
  padding-left: var(--space-24);
  padding-right: var(--space-24);
  box-sizing: border-box;
}

/* ── Spacing Utilities (Paddings & Margins) ── */
.m-8 { margin: var(--space-8); }
.m-12 { margin: var(--space-12); }
.m-16 { margin: var(--space-16); }
.m-24 { margin: var(--space-24); }
.m-32 { margin: var(--space-32); }
.m-40 { margin: var(--space-40); }
.m-48 { margin: var(--space-48); }
.m-64 { margin: var(--space-64); }
.m-72 { margin: var(--space-72); }
.m-80 { margin: var(--space-80); }
.m-96 { margin: var(--space-96); }
.m-100 { margin: var(--space-100); }

.p-8 { padding: var(--space-8); }
.p-12 { padding: var(--space-12); }
.p-16 { padding: var(--space-16); }
.p-24 { padding: var(--space-24); }
.p-32 { padding: var(--space-32); }
.p-40 { padding: var(--space-40); }
.p-48 { padding: var(--space-48); }
.p-64 { padding: var(--space-64); }
.p-72 { padding: var(--space-72); }
.p-80 { padding: var(--space-80); }
.p-96 { padding: var(--space-96); }
.p-100 { padding: var(--space-100); }

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--primary-font);
  font-size: var(--font-size-button);
  font-weight: var(--font-weight-button);
  height: var(--button-height);
  padding: 0 var(--space-16);
  border-radius: var(--border-radius);
  border: none;
  cursor: pointer;
  outline: none;
  text-decoration: none;
  box-sizing: border-box;
  transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
}

.btn:active {
  transform: scale(0.97);
}

.btn:disabled {
  background-color: #CCCCCC !important;
  color: #888888 !important;
  cursor: not-allowed !important;
  transform: none !important;
  filter: none !important;
  box-shadow: none !important;
}

.btn-primary {
  background-color: var(--primary-color);
  color: #FFFFFF;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.08);
  transform: translateY(-1px) scale(1.01);
  box-shadow: 0 4px 12px var(--primary-glow);
}

.btn-secondary {
  background-color: transparent;
  color: var(--primary-color);
  border: 2px solid var(--primary-color);
}

.btn-secondary:hover:not(:disabled) {
  background-color: var(--primary-glow);
  transform: translateY(-1px);
}

.btn-tertiary {
  background-color: transparent;
  color: var(--text-color);
}

.btn-tertiary:hover:not(:disabled) {
  background-color: rgba(120, 120, 120, 0.08);
}

/* ── Cards ── */
.card {
  background-color: var(--background-color);
  border-radius: var(--border-radius);
  padding: var(--card-padding);
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.card-standard {
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-elevated);
}

.card-standard:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-raised);
}

.card-feature {
  border: 2px solid var(--primary-color);
  box-shadow: var(--shadow-highlight);
}

.card-feature:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px var(--primary-glow);
}

/* ── Inputs & Forms ── */
.form-group {
  margin-bottom: var(--space-16);
}

.input-label {
  display: block;
  font-family: var(--primary-font);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-caption);
  color: var(--text-color);
  margin-bottom: var(--space-8);
}

.input-text {
  width: 100%;
  box-sizing: border-box;
  background-color: var(--background-color);
  color: var(--text-color);
  font-family: var(--primary-font);
  font-size: var(--font-size-body);
  height: var(--input-height);
  padding: var(--input-padding);
  border: var(--input-border);
  border-radius: var(--radius-0);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.input-text:focus {
  border-color: var(--primary-color);
  box-shadow: var(--primary-glow) 0px 0px 0px 3px;
}

.input-text::placeholder {
  color: var(--input-placeholder-color);
}

.input-text:disabled {
  background-color: var(--input-disabled-bg);
  cursor: not-allowed;
  opacity: 0.6;
}

/* ── Navigation ── */
.nav-header {
  height: var(--nav-height);
  padding: var(--nav-padding);
  background-color: var(--background-color);
  box-shadow: var(--nav-shadow);
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
}

.nav-link {
  color: var(--text-color);
  font-family: var(--primary-font);
  font-size: var(--font-size-body);
  font-weight: 500;
  text-decoration: none;
  padding: var(--space-8) var(--space-12);
  border-radius: var(--radius-12);
  transition: color 0.15s ease, background-color 0.15s ease;
  line-height: var(--line-height-nav);
}

.nav-link:hover {
  color: var(--primary-color);
  background-color: var(--primary-glow);
}

.nav-link.active {
  color: var(--primary-color);
  font-weight: 700;
}

/* ── Links ── */
.link-standard {
  color: var(--link-color);
  font-family: var(--primary-font);
  font-weight: 500;
  text-decoration: none;
  transition: color 0.15s ease;
}

.link-standard:hover {
  color: var(--primary-color);
  text-decoration: underline;
}

.link-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  font-family: var(--primary-font);
  font-size: var(--font-size-caption);
  font-weight: 700;
  background-color: var(--primary-color);
  height: var(--cta-link-height);
  padding: 0 var(--space-20);
  border-radius: var(--radius-12);
  text-decoration: none;
  box-sizing: border-box;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.link-cta:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}

/* ── Badges ── */
.badge {
  display: inline-block;
  font-family: var(--primary-font);
  font-size: var(--font-size-caption);
  font-weight: 700;
  padding: var(--badge-padding);
  border-radius: var(--radius-2);
  line-height: normal;
  box-sizing: border-box;
}

.badge-standard {
  background-color: var(--badge-bg);
  color: var(--text-color);
}

.badge-success {
  background-color: var(--secondary-color);
  color: #FFFFFF;
}

/* ── Touch Target Helpers ── */
.touch-target {
  min-width: var(--touch-target-min-width);
  min-height: var(--touch-target-min-height);
}

/* ── Responsive Column Utilities (Mobile-first) ── */
.grid-responsive {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-24);
}

@media (min-width: 768px) {
  .grid-responsive {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .grid-responsive {
    grid-template-columns: repeat(3, 1fr);
  }
}
`;


  // 1.2 Extract custom CSS variables and custom rules from DESIGN_SYSTEM.md if provided
  if (config.designSystemMarkdown) {
    const customCSS = extractCustomCSSFromMarkdown(config.designSystemMarkdown);
    if (customCSS) {
      cssContent += customCSS;
    }
  }

  const cssPath = path.join(resolvedRoot, 'design-tokens.css');
  await fs.writeFile(cssPath, cssContent, 'utf8');

  // 1.5 Generate or update DESIGN_SYSTEM.md
  if (config.designSystemMarkdown) {
    const designSystemPath = path.join(resolvedRoot, 'DESIGN_SYSTEM.md');
    await fs.writeFile(designSystemPath, config.designSystemMarkdown, 'utf8');
  }

  // 2. Generate or update MEMORY.md to hold project blueprint and context instructions
  const memoryPath = path.join(resolvedRoot, 'MEMORY.md');
  let memoryGenerated = false;

  if (config.blueprintMarkdown) {
    await fs.writeFile(memoryPath, config.blueprintMarkdown, 'utf8');
  } else {
    const memoryExists = await fs.access(memoryPath).then(() => true).catch(() => false);
    if (!memoryExists) {
      const memoryContent = `# Project Memory: ${config.projectName || path.basename(workspacePath)}

## Project Identity
* Description: ${config.description || 'No description provided.'}
* Type: ${config.projectType || 'web'}
* MVP Scope: ${config.mvpScope || 'Not defined yet.'}
* Constraints: ${config.constraints || 'None specified.'}

## Technical Blueprint
* Frontend: ${config.frontendStack || 'Vanilla HTML/JS'}
* Backend: ${config.backendStack || 'None'}
* Database: ${config.database || 'None'}
* UI Framework: ${config.uiFramework || 'Vanilla CSS'}
* API Style: ${config.apiStyle || 'REST'}

## Design Rules & Theme Token Guidelines
We have generated a global \`design-tokens.css\` file. Please read the CSS variables from it and avoid hardcoding colors.
* Primary: ${config.primaryColor}
* Secondary: ${config.secondaryColor}
* Background: ${config.backgroundColor}
* Text: ${config.textColor}

## Agent Enforced Coding Conventions
${config.customAgentRules || 'Follow clean code conventions, modular layouts, and reuse UI components.'}
`;
      await fs.writeFile(memoryPath, memoryContent, 'utf8');
      memoryGenerated = true;
    }
  }

  return { cssPath, memoryGenerated };
}

function hexToRgb(hex: string): string {
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return `${r}, ${g}, ${b}`;
  } else if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return '99, 102, 241'; // Fallback indigo
}

function extractCustomCSSFromMarkdown(markdown: string): string {
  if (!markdown) return '';
  
  let extractedCSS = '\n/* ── CUSTOM USER STYLES EXTRACTED FROM DESIGN_SYSTEM.MD ── */\n';
  let hasContent = false;
  
  // 1. Regex to match ```css [content] ``` blocks
  const cssBlockRegex = /```css([\s\S]*?)```/gi;
  let match;
  let count = 0;
  
  while ((match = cssBlockRegex.exec(markdown)) !== null) {
    const blockContent = match[1].trim();
    if (blockContent) {
      extractedCSS += `\n/* Custom Style Block #${++count} */\n${blockContent}\n`;
      hasContent = true;
    }
  }
  
  // 2. Regex to extract custom bullet variables like: - **Tertiary CTA** (#ffaa00) or - **Color N** (value)
  const bulletVarRegex = /-\s+\*\*([^*]+)\*\*\s*\(\s*`?([^`()]+)`?\s*\)/g;
  let varsFound = '';
  
  while ((match = bulletVarRegex.exec(markdown)) !== null) {
    const varName = match[1].trim();
    const varValue = match[2].trim();
    
    // Ignore placeholders or template values
    if (varValue.includes('#value') || varValue.includes('`')) {
      continue;
    }
    
    // Convert "Accent Orange" -> "--accent-orange"
    const cssVarName = '--' + varName.toLowerCase().trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    
    if (cssVarName.length > 3) {
      const standardVars = [
        '--primary-color', '--secondary-color', '--background-color', '--text-color',
        '--border-radius', '--border-color', '--primary-glow', '--secondary-glow',
        '--primary-font', '--secondary-font', '--base-spacing', '--container-max-width',
        '--button-height', '--card-padding', '--card-shadow',
        '--font-size-display', '--font-size-h1', '--font-size-body', '--font-size-button', '--font-size-caption',
        '--font-weight-display', '--font-weight-h1', '--font-weight-body', '--font-weight-button', '--font-weight-caption',
        '--line-height-body', '--line-height-nav',
        '--space-8', '--space-12', '--space-16', '--space-24', '--space-32', '--space-40', '--space-48', '--space-64', '--space-72', '--space-80', '--space-96', '--space-100',
        '--radius-0', '--radius-2', '--radius-12', '--radius-full',
        '--shadow-none', '--shadow-minimal', '--shadow-elevated', '--shadow-raised', '--shadow-highlight',
        '--input-height', '--input-padding', '--input-border', '--input-placeholder-color', '--input-disabled-bg',
        '--nav-height', '--nav-padding', '--nav-shadow',
        '--badge-padding', '--badge-bg', '--link-color', '--cta-link-height',
        '--touch-target-min-width', '--touch-target-min-height'
      ];
      
      if (!standardVars.includes(cssVarName)) {
        varsFound += `  ${cssVarName}: ${varValue};\n`;
      }
    }
  }
  
  if (varsFound) {
    extractedCSS += `\n/* Custom Variables Extracted from markdown list */\n:root {\n${varsFound}}\n`;
    hasContent = true;
  }
  
  return hasContent ? extractedCSS : '';
}

export async function loadInitAssets(workspacePath: string) {
  if (!workspacePath) {
    throw new Error('Workspace path is required.');
  }

  const resolvedRoot = path.resolve(workspacePath);
  const cssPath = path.join(resolvedRoot, 'design-tokens.css');
  const designSystemPath = path.join(resolvedRoot, 'DESIGN_SYSTEM.md');
  const memoryPath = path.join(resolvedRoot, 'MEMORY.md');

  const cssExists = await fs.access(cssPath).then(() => true).catch(() => false);
  const designSystemExists = await fs.access(designSystemPath).then(() => true).catch(() => false);
  const memoryExists = await fs.access(memoryPath).then(() => true).catch(() => false);

  const parsedConfig: any = {};

  if (cssExists) {
    const cssContent = await fs.readFile(cssPath, 'utf8');

    // Parse light mode / default root variables
    const rootBlockRegex = /:root\s*\{([\s\S]*?)\}/i;
    const rootMatch = rootBlockRegex.exec(cssContent);
    
    // Parse dark mode overrides (from .dark or [data-theme="dark"] block)
    const darkBlockRegex = /(?:\.dark|\[data-theme="dark"\])\s*\{([\s\S]*?)\}/i;
    const darkMatch = darkBlockRegex.exec(cssContent);

    if (rootMatch) {
      const rootVars = rootMatch[1];
      parsedConfig.primaryColor = parseCssVar(rootVars, '--primary-color') || parsedConfig.primaryColor;
      parsedConfig.secondaryColor = parseCssVar(rootVars, '--secondary-color') || parsedConfig.secondaryColor;
      parsedConfig.backgroundColor = parseCssVar(rootVars, '--background-color') || parsedConfig.backgroundColor;
      parsedConfig.textColor = parseCssVar(rootVars, '--text-color') || parsedConfig.textColor;
      parsedConfig.borderRadius = parseCssVar(rootVars, '--border-radius') || parsedConfig.borderRadius;
      
      parsedConfig.primaryFont = parseCssVar(rootVars, '--primary-font')?.replace(/'/g, '') || parsedConfig.primaryFont;
      parsedConfig.secondaryFont = parseCssVar(rootVars, '--secondary-font')?.replace(/'/g, '') || parsedConfig.secondaryFont;
      parsedConfig.baseSpacing = parseCssVar(rootVars, '--base-spacing') || parsedConfig.baseSpacing;
      parsedConfig.containerMaxWidth = parseCssVar(rootVars, '--container-max-width') || parsedConfig.containerMaxWidth;
      parsedConfig.buttonHeight = parseCssVar(rootVars, '--button-height') || parsedConfig.buttonHeight;
      parsedConfig.cardPadding = parseCssVar(rootVars, '--card-padding') || parsedConfig.cardPadding;
      parsedConfig.cardShadow = parseCssVar(rootVars, '--card-shadow') || parsedConfig.cardShadow;
    }

    if (darkMatch) {
      const darkVars = darkMatch[1];
      // Fallback variables for single dark mode
      parsedConfig.primaryColor = parseCssVar(darkVars, '--primary-color') || parsedConfig.primaryColor;
      parsedConfig.secondaryColor = parseCssVar(darkVars, '--secondary-color') || parsedConfig.secondaryColor;
      parsedConfig.backgroundColor = parseCssVar(darkVars, '--background-color') || parsedConfig.backgroundColor;
      parsedConfig.textColor = parseCssVar(darkVars, '--text-color') || parsedConfig.textColor;
    }

    // Parse light mode equivalents if "Mode: both" was active
    if (cssContent.includes('Mode: both')) {
      parsedConfig.darkLightMode = 'both';
      if (rootMatch) {
        const rootVars = rootMatch[1];
        parsedConfig.lightPrimaryColor = parseCssVar(rootVars, '--primary-color') || parsedConfig.lightPrimaryColor;
        parsedConfig.lightSecondaryColor = parseCssVar(rootVars, '--secondary-color') || parsedConfig.lightSecondaryColor;
        parsedConfig.lightBackgroundColor = parseCssVar(rootVars, '--background-color') || parsedConfig.lightBackgroundColor;
        parsedConfig.lightTextColor = parseCssVar(rootVars, '--text-color') || parsedConfig.lightTextColor;
      }
      if (darkMatch) {
        const darkVars = darkMatch[1];
        parsedConfig.primaryColor = parseCssVar(darkVars, '--primary-color') || parsedConfig.primaryColor;
        parsedConfig.secondaryColor = parseCssVar(darkVars, '--secondary-color') || parsedConfig.secondaryColor;
        parsedConfig.backgroundColor = parseCssVar(darkVars, '--background-color') || parsedConfig.backgroundColor;
        parsedConfig.textColor = parseCssVar(darkVars, '--text-color') || parsedConfig.textColor;
      }
    } else if (cssContent.includes('Mode: light')) {
      parsedConfig.darkLightMode = 'light';
      if (rootMatch) {
        const rootVars = rootMatch[1];
        parsedConfig.lightPrimaryColor = parseCssVar(rootVars, '--primary-color') || parsedConfig.lightPrimaryColor;
        parsedConfig.lightSecondaryColor = parseCssVar(rootVars, '--secondary-color') || parsedConfig.lightSecondaryColor;
        parsedConfig.lightBackgroundColor = parseCssVar(rootVars, '--background-color') || parsedConfig.lightBackgroundColor;
        parsedConfig.lightTextColor = parseCssVar(rootVars, '--text-color') || parsedConfig.lightTextColor;
      }
    } else {
      parsedConfig.darkLightMode = 'dark';
    }
  }

  if (designSystemExists) {
    parsedConfig.designSystemMarkdown = await fs.readFile(designSystemPath, 'utf8');
  }

  if (memoryExists) {
    parsedConfig.blueprintMarkdown = await fs.readFile(memoryPath, 'utf8');
  }

  return parsedConfig;
}

function parseCssVar(block: string, name: string): string | null {
  const regex = new RegExp(`${name}\\s*:\\s*([^;\\n]+);`, 'i');
  const match = regex.exec(block);
  return match ? match[1].trim() : null;
}


// ── Shared LLM caller helper ────────────────────────────────────────────────

export type LLMSettings = {
  provider: 'gemini' | 'openai' | 'anthropic' | 'ollama' | '9router';
  apiKey: string;
  model: string;
  baseUrl?: string;
};

/**
 * Parse HTTP JSON bodies that may include trailing junk / NDJSON / SSE
 * (some local routers append extra characters after a valid JSON object).
 */
function parseLooseJson(text: string): any {
  const trimmed = text.replace(/^\uFEFF/, '').trim();
  if (!trimmed) throw new Error('Empty response body from LLM provider.');

  try {
    return JSON.parse(trimmed);
  } catch {
    /* continue */
  }

  // NDJSON / multi-line: try first non-empty line
  const firstLine = trimmed.split(/\r?\n/).find((l) => l.trim().length > 0);
  if (firstLine) {
    try {
      return JSON.parse(firstLine.trim());
    } catch {
      /* continue */
    }
  }

  // Extract first balanced { ... } object
  const start = trimmed.indexOf('{');
  if (start >= 0) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (ch === '\\') {
          escape = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          return JSON.parse(trimmed.slice(start, i + 1));
        }
      }
    }
  }

  // SSE: data: {...}
  const dataLine = trimmed.split(/\r?\n/).find((l) => l.startsWith('data:'));
  if (dataLine) {
    const payload = dataLine.replace(/^data:\s*/, '').trim();
    if (payload && payload !== '[DONE]') {
      return JSON.parse(payload);
    }
  }

  throw new Error(
    `LLM provider returned non-JSON body (first 200 chars): ${trimmed.slice(0, 200)}`
  );
}

function extractOpenAIChatContent(resJson: any): string {
  const choice = resJson?.choices?.[0];
  const msg = choice?.message ?? choice?.delta;
  if (!msg) {
    if (typeof resJson?.message?.content === 'string') return resJson.message.content;
    if (typeof resJson?.content === 'string') return resJson.content;
    return '';
  }
  const content = msg.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => {
        if (typeof part === 'string') return part;
        if (part?.text) return part.text;
        if (part?.type === 'text' && part?.text) return part.text;
        return '';
      })
      .join('');
  }
  return '';
}

export async function callLLMRaw(
  systemPrompt: string,
  userPrompt: string,
  settings: LLMSettings,
  jsonMode: boolean = true
): Promise<string> {
  const provider = settings.provider || 'gemini';
  const model = settings.model || (
    provider === 'gemini' ? 'gemini-2.5-flash' :
    provider === 'openai' ? 'gpt-4o' :
    provider === 'anthropic' ? 'claude-3-5-sonnet' :
    provider === '9router' ? 'anthropic/claude-3-5-sonnet' : 'llama3'
  );
  const apiKey = settings.apiKey || '';
  const baseUrl = settings.baseUrl || (
    provider === 'ollama' ? 'http://localhost:11434' :
    provider === '9router' ? 'http://localhost:20128' :
    'https://api.openai.com'
  );

  let responseText = '';

  if (provider === 'gemini') {
    if (!apiKey) throw new Error('API Key is required for Gemini provider.');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const bodyObj: any = {
      contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }]
    };
    if (jsonMode) bodyObj.generationConfig = { responseMimeType: 'application/json' };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj)
    });
    const rawBody = await response.text();
    if (!response.ok) {
      throw new Error(`Gemini API Error (${response.status}): ${rawBody.slice(0, 500)}`);
    }
    const resJson: any = parseLooseJson(rawBody);
    responseText = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';

  } else if (provider === 'openai' || provider === 'ollama' || provider === '9router') {
    const isOllama = provider === 'ollama';
    if (!isOllama && !apiKey) throw new Error(`API Key is required for ${provider} provider.`);
    const url = isOllama ? `${baseUrl}/api/chat` : `${baseUrl}/v1/chat/completions`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!isOllama) headers['Authorization'] = `Bearer ${apiKey}`;

    // Avoid response_format:json_object for connection tests / free models that
    // may append non-JSON chatter — callers that need JSON set jsonMode true.
    const body: any = isOllama
      ? {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          ...(jsonMode ? { format: 'json' } : {})
        }
      : {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
        };

    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const rawBody = await response.text();
    if (!response.ok) {
      throw new Error(`LLM Provider API Error (${response.status}): ${rawBody.slice(0, 500)}`);
    }
    const resJson: any = parseLooseJson(rawBody);
    responseText = isOllama
      ? resJson.message?.content || extractOpenAIChatContent(resJson)
      : extractOpenAIChatContent(resJson);

  } else if (provider === 'anthropic') {
    if (!apiKey) throw new Error('API Key is required for Anthropic provider.');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    const rawBody = await response.text();
    if (!response.ok) {
      throw new Error(`Anthropic API Error (${response.status}): ${rawBody.slice(0, 500)}`);
    }
    const resJson: any = parseLooseJson(rawBody);
    responseText = resJson.content?.[0]?.text || '';
  } else {
    throw new Error(`Unknown LLM provider: ${provider}`);
  }

  return responseText;
}

export type AssistChatImage = {
  mimeType: string;
  /** raw base64 without data: prefix, or full data URL */
  data: string;
};

export type AssistChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  /** Images only applied on user turns (vision models) */
  images?: AssistChatImage[];
};

function stripDataUrl(data: string): { mimeType: string; base64: string; dataUrl: string } {
  const m = data.match(/^data:([^;]+);base64,(.+)$/i);
  if (m) {
    return { mimeType: m[1], base64: m[2], dataUrl: data };
  }
  return { mimeType: 'image/png', base64: data, dataUrl: `data:image/png;base64,${data}` };
}

/**
 * Multi-turn chat for Assist panel (OpenAI-compatible + Gemini + Anthropic).
 * Supports optional images on the latest user message for vision models.
 */
export async function callLLMChat(
  systemPrompt: string,
  messages: AssistChatMessage[],
  settings: LLMSettings,
  signal?: AbortSignal
): Promise<string> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const provider = settings.provider || 'gemini';
  const model =
    settings.model ||
    (provider === 'gemini'
      ? 'gemini-2.5-flash'
      : provider === 'openai'
        ? 'gpt-4o'
        : provider === 'anthropic'
          ? 'claude-3-5-sonnet'
          : provider === '9router'
            ? 'anthropic/claude-3-5-sonnet'
            : 'llama3');
  const apiKey = settings.apiKey || '';
  const baseUrl =
    settings.baseUrl ||
    (provider === 'ollama'
      ? 'http://localhost:11434'
      : provider === '9router'
        ? 'http://localhost:20128'
        : 'https://api.openai.com');

  const safeMessages = messages
    .filter((m) => m.content?.trim() || (m.images && m.images.length > 0))
    .slice(-20)
    .map((m) => ({
      role: m.role,
      content: (m.content || '').trim() || (m.images?.length ? 'Please describe or analyze the attached image(s).' : ''),
      images: m.images
    }));

  if (safeMessages.length === 0) {
    throw new Error('No messages to send to the LLM.');
  }

  if (provider === 'gemini') {
    if (!apiKey) throw new Error('API Key is required for Gemini provider.');
    const contents = safeMessages.map((m) => {
      const parts: any[] = [];
      if (m.content) parts.push({ text: m.content });
      for (const img of m.images || []) {
        const parsed = stripDataUrl(img.data);
        parts.push({
          inline_data: {
            mime_type: img.mimeType || parsed.mimeType,
            data: parsed.base64
          }
        });
      }
      if (parts.length === 0) parts.push({ text: '(empty)' });
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts
      };
    });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const bodyObj: any = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
      signal
    });
    const rawBody = await response.text();
    if (!response.ok) {
      throw new Error(`Gemini API Error (${response.status}): ${rawBody.slice(0, 500)}`);
    }
    const resJson: any = parseLooseJson(rawBody);
    return resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (provider === 'openai' || provider === 'ollama' || provider === '9router') {
    const isOllama = provider === 'ollama';
    if (!isOllama && !apiKey) throw new Error(`API Key is required for ${provider} provider.`);
    const url = isOllama ? `${baseUrl}/api/chat` : `${baseUrl}/v1/chat/completions`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (!isOllama) headers['Authorization'] = `Bearer ${apiKey}`;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...safeMessages.map((m) => {
        const imgs = m.images || [];
        if (!imgs.length) {
          return { role: m.role, content: m.content };
        }
        if (isOllama) {
          // Ollama vision: text + images base64 array
          return {
            role: m.role,
            content: m.content,
            images: imgs.map((img) => stripDataUrl(img.data).base64)
          };
        }
        // OpenAI / 9router vision content parts
        return {
          role: m.role,
          content: [
            { type: 'text', text: m.content },
            ...imgs.map((img) => {
              const parsed = stripDataUrl(img.data);
              return {
                type: 'image_url',
                image_url: {
                  url: parsed.dataUrl.startsWith('data:')
                    ? parsed.dataUrl
                    : `data:${img.mimeType || parsed.mimeType};base64,${parsed.base64}`
                }
              };
            })
          ]
        };
      })
    ];

    const body: any = isOllama
      ? { model, messages: chatMessages, stream: false }
      : { model, messages: chatMessages, temperature: 0.4, stream: false };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal
    });
    const rawBody = await response.text();
    if (!response.ok) {
      throw new Error(`LLM Provider API Error (${response.status}): ${rawBody.slice(0, 500)}`);
    }
    const resJson: any = parseLooseJson(rawBody);
    return (
      (isOllama ? resJson.message?.content : null) ||
      extractOpenAIChatContent(resJson) ||
      ''
    );
  }

  if (provider === 'anthropic') {
    if (!apiKey) throw new Error('API Key is required for Anthropic provider.');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: safeMessages.map((m) => {
          const imgs = m.images || [];
          if (!imgs.length) {
            return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
          }
          const blocks: any[] = imgs.map((img) => {
            const parsed = stripDataUrl(img.data);
            return {
              type: 'image',
              source: {
                type: 'base64',
                media_type: img.mimeType || parsed.mimeType,
                data: parsed.base64
              }
            };
          });
          blocks.push({ type: 'text', text: m.content });
          return {
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: blocks
          };
        })
      }),
      signal
    });
    const rawBody = await response.text();
    if (!response.ok) {
      throw new Error(`Anthropic API Error (${response.status}): ${rawBody.slice(0, 500)}`);
    }
    const resJson: any = parseLooseJson(rawBody);
    return resJson.content?.[0]?.text || '';
  }

  throw new Error(`Unknown LLM provider: ${provider}`);
}

/** In-flight Assist LLM requests — abortable from renderer Cancel */
const assistantChatControllers = new Map<string, AbortController>();

export function cancelAssistantChat(requestId: string): { cancelled: boolean } {
  const ac = assistantChatControllers.get(requestId);
  if (!ac) return { cancelled: false };
  ac.abort();
  assistantChatControllers.delete(requestId);
  return { cancelled: true };
}

/** Assist panel: chat with configured LLM + deck context (text reply). */
export async function assistantChatLLM(payload: {
  settings: LLMSettings;
  systemPrompt: string;
  messages: AssistChatMessage[];
  requestId?: string;
}): Promise<{ content: string; cancelled?: boolean }> {
  const requestId = payload.requestId || `req-${Date.now()}`;
  const ac = new AbortController();
  assistantChatControllers.set(requestId, ac);
  try {
    const content = await callLLMChat(
      payload.systemPrompt,
      payload.messages,
      payload.settings,
      ac.signal
    );
    if (!content?.trim()) {
      throw new Error('LLM returned an empty response.');
    }
    return { content: content.trim() };
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const msg = err instanceof Error ? err.message : String(err);
    if (name === 'AbortError' || /aborted|AbortError/i.test(msg)) {
      const e = new Error('CANCELLED');
      e.name = 'AbortError';
      throw e;
    }
    throw err;
  } finally {
    assistantChatControllers.delete(requestId);
  }
}

function parseJsonResponse(raw: string): any {
  let clean = raw.trim();
  if (clean.startsWith('```json')) clean = clean.slice(7);
  if (clean.startsWith('```')) clean = clean.slice(3);
  if (clean.endsWith('```')) clean = clean.slice(0, -3);
  clean = clean.trim();
  try { return JSON.parse(clean); }
  catch { throw new Error('LLM did not return valid JSON. Please try again.'); }
}

// ── 4 individual stream tasks ────────────────────────────────────────────────

async function streamTokens(vision: string, settings: LLMSettings): Promise<any> {
  const system = `You are a professional UI design system token generator.
Return a valid JSON object ONLY — no markdown, no fences, no extra text.
Schema:
{
  "primaryColor": "#hex — vibrant primary accent",
  "secondaryColor": "#hex — supporting accent",
  "backgroundColor": "#hex — dark theme bg",
  "textColor": "#hex — dark theme text",
  "borderRadius": "e.g. 12px",
  "darkLightMode": "dark" | "light" | "both",
  "lightPrimaryColor": "#hex — light theme primary",
  "lightSecondaryColor": "#hex — light theme secondary",
  "lightBackgroundColor": "#hex — light theme bg",
  "lightTextColor": "#hex — light theme text",
  "primaryFont": "e.g. Inter",
  "secondaryFont": "e.g. Outfit",
  "baseSpacing": "e.g. 8px",
  "containerMaxWidth": "e.g. 1200px",
  "buttonHeight": "e.g. 50px",
  "cardPadding": "e.g. 24px",
  "cardShadow": "e.g. 0px 2px 8px rgba(0,0,0,0.04)"
}`;
  const user = `Design vision: "${vision}"\n\nGenerate design tokens that perfectly match this vision. Return raw JSON only.`;
  const raw = await callLLMRaw(system, user, settings, true);
  return parseJsonResponse(raw);
}

// Section 1+2: Theme & Colors (fast, focused)
async function streamSec12(vision: string, settings: LLMSettings): Promise<string> {
  const system = `You are a professional design system documentation writer.
Write ONLY sections 1 and 2 of a DESIGN_SYSTEM.md. Output plain markdown — no fences, no JSON.

# Design System Inspired by [Brand/Style Name]

## 1. Visual Theme & Atmosphere
[2-3 paragraph atmospheric description of the visual identity, mood, and user experience feel.
Then list **Key Characteristics** as 6-8 bullet points.]

## 2. Color Palette & Roles
### Primary
- **Primary Accent** (hex): role
- **Supporting Accent** (hex): role
### Interactive
- **Link Blue** (#0000EE): role
- **Button Active State** (hex): role
### Neutral Scale
- **Typography Text** (hex): role
- **Surface Background** (hex): role
- **Light Border** (#E5E5E5): role
### Surface & Borders
- **Form Border** (#C1C1C1): role
- **Clean Surface** (hex): role`;
  const user = `Design vision: "${vision}"\n\nWrite ONLY sections 1 and 2. Start with the # heading. Pure markdown.`;
  return callLLMRaw(system, user, settings, false);
}

// Section 3: Typography (medium)
async function streamSec3(vision: string, settings: LLMSettings): Promise<string> {
  const system = `You are a professional design system documentation writer.
Write ONLY section 3 of a DESIGN_SYSTEM.md. Output plain markdown — no fences, no JSON. Start from ## 3.

## 3. Typography Rules
### Font Family
**Primary:** [font] (font-family stack, fallbacks)  
**Secondary:** [font] (font-family stack, fallbacks)
### Hierarchy
| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
[at least 6 rows: Display/Hero, H1, H2, Body, Button/Label, Caption]
### Principles
[Bullet list of 6-8 specific, actionable typography principles with exact values]`;
  const user = `Design vision: "${vision}"\n\nWrite ONLY section 3 (Typography Rules). Start from ## 3. Pure markdown.`;
  return callLLMRaw(system, user, settings, false);
}

// Section 4: Components (largest individual section)
async function streamSec4(vision: string, settings: LLMSettings): Promise<string> {
  const system = `You are a professional design system documentation writer.
Write ONLY section 4 of a DESIGN_SYSTEM.md. Output plain markdown — no fences, no JSON. Start from ## 4.

## 4. Component Stylings
### Buttons
**Primary Button (CTA)** — background, text, font, size, padding, height, width, border-radius, border, shadow, hover, active, disabled
**Secondary Button (Text Link)** — same properties
**Tertiary Button (Minimal)** — same properties
### Cards & Containers
**Standard Card** — background, border, radius, padding, shadow  
**Feature Card (Highlighted)** — same + accent treatment
### Inputs & Forms
**Text Input Default** — background, border, radius, padding, text, placeholder, focus state  
**Input Label** — font, size, weight, color
### Navigation
**Header Navigation** — background, height, border treatment  
**Navigation Link** — default, hover, active states
### Links
**Standard Hyperlink** — color, decoration, hover  
**CTA Link (Colored)** — color, weight, hover
### Badges
**Standard Badge** — background, text, radius, padding  
**Success Badge** — same with success color`;
  const user = `Design vision: "${vision}"\n\nWrite ONLY section 4 (Component Stylings). Start from ## 4. Pure markdown.`;
  return callLLMRaw(system, user, settings, false);
}

// Sections 5+6: Layout & Depth (medium)
async function streamSec56(vision: string, settings: LLMSettings): Promise<string> {
  const system = `You are a professional design system documentation writer.
Write ONLY sections 5 and 6 of a DESIGN_SYSTEM.md. Output plain markdown — no fences. Start from ## 5.

## 5. Layout Principles
### Spacing System
- Base unit: [e.g. 8px]
- Scale: [8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 100px with use context for each]
### Grid & Container
[Columns, gutters, container max-width, breakpoints]
### Whitespace Philosophy
[2-3 sentences on whitespace approach]
### Border Radius Scale
[0px, 4px, 8px, 12px, 16px, 24px, 50% with use context]

## 6. Depth & Elevation
| Level | Treatment | Use |
|-------|-----------|-----|
[at least 6 levels from 0/flat to 5/overlay]

**Shadow Philosophy:** [1-2 sentence approach to shadows and depth]`;
  const user = `Design vision: "${vision}"\n\nWrite ONLY sections 5 and 6 (Layout + Depth). Start from ## 5. Pure markdown.`;
  return callLLMRaw(system, user, settings, false);
}

// Sections 7+8: Guidelines & Responsive (medium)
async function streamSec78(vision: string, settings: LLMSettings): Promise<string> {
  const system = `You are a professional design system documentation writer.
Write ONLY sections 7 and 8 of a DESIGN_SYSTEM.md. Output plain markdown — no fences. Start from ## 7.

## 7. Do's and Don'ts
### Do
[8-10 specific, actionable bullet points]
### Don't
[8-10 specific, actionable bullet points]

## 8. Responsive Behavior
### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
[Mobile, Tablet, Desktop, Wide — with specific pixel values and layout changes]
### Touch Targets
[Min sizes, spacing for touch]
### Collapsing Strategy
[Mobile: ... / Tablet: ... / Desktop: ...]`;
  const user = `Design vision: "${vision}"\n\nWrite ONLY sections 7 and 8 (Do/Don'ts + Responsive). Start from ## 7. Pure markdown.`;
  return callLLMRaw(system, user, settings, false);
}

// Helper functions to build Section 9 and Agent Prompt locally to optimize performance
function buildLocalSection9(tokens: any): string {
  return `## 9. Agent Prompt Guide

### Quick Color Reference
- **Primary Color**: \`${tokens.primaryColor || '#4f46e5'}\`
- **Secondary Color**: \`${tokens.secondaryColor || '#06b6d4'}\`
- **Background Color**: \`${tokens.backgroundColor || '#0b0d14'}\`
- **Text Color**: \`${tokens.textColor || '#f8fafc'}\`
- **Primary Font**: \`${tokens.primaryFont || 'Din Round'}\`
- **Secondary Font**: \`${tokens.secondaryFont || 'Feather'}\`
- **Border Radius**: \`${tokens.borderRadius || '8px'}\`

### Iteration Guide
1. Create or update \`design-tokens.css\` with standard CSS variables matching the token values above.
2. Read the layout rules, typography table, and component guides defined in sections 1-8 of \`DESIGN_SYSTEM.md\`.
3. Implement responsive styling rules conforming to the breakpoints.
4. Ensure dark/light mode switches are handled appropriately.
5. Create modern, beautiful component styles for buttons, cards, inputs, and badges using the color palette.`;
}

function buildLocalAgentPrompt(vision: string, tokens: any, markdownSpecs: string): string {
  return `Update this project's UI design system based on the following vision:

"${vision}"

Current design tokens:
- Primary Color: ${tokens.primaryColor || '#4f46e5'}
- Secondary Color: ${tokens.secondaryColor || '#06b6d4'}
- Background Color: ${tokens.backgroundColor || '#0b0d14'}
- Text Color: ${tokens.textColor || '#f8fafc'}
- Border Radius: ${tokens.borderRadius || '8px'}
- Mode: ${tokens.darkLightMode || 'dark'}
- Primary Font: ${tokens.primaryFont || 'Din Round'}
- Secondary Font: ${tokens.secondaryFont || 'Feather'}

Here is the design system documentation specification to guide you:

${markdownSpecs}

Please:
1. Create or update 'design-tokens.css' with all relevant CSS custom properties.
2. Update the 'DESIGN_SYSTEM.md' file with the complete documentation.
3. Apply these variables globally in your component styles.
4. Ensure all layout, spacing, components, and responsive guidelines are applied cleanly.

Only modify design-tokens.css and DESIGN_SYSTEM.md. Do not touch any other files.`;
}

// ── Parallel generator (6 streams simultaneously) ────────────────────────────

export async function generateDesignLLM(vision: string, settings: LLMSettings) {
  if (!vision) throw new Error('Design vision prompt is required.');
  const [tokens, s12, s3, s4, s56, s78] = await Promise.all([
    streamTokens(vision, settings),
    streamSec12(vision, settings),
    streamSec3(vision, settings),
    streamSec4(vision, settings),
    streamSec56(vision, settings),
    streamSec78(vision, settings),
  ]);

  const docMarkdown = [s12, s3, s4, s56, s78].join('\n\n');
  const section9 = buildLocalSection9(tokens);
  const designSystemMarkdown = docMarkdown + '\n\n' + section9;
  const agentPrompt = buildLocalAgentPrompt(vision, tokens, designSystemMarkdown);

  return {
    ...tokens,
    designSystemMarkdown,
    agentPrompt,
  };
}

// ── Single-mode stream (called individually from renderer for live progress) ──

export type StreamMode = 'tokens' | 'sec12' | 'sec3' | 'sec4' | 'sec56' | 'sec78';

export async function generateDesignStream(
  vision: string,
  mode: StreamMode,
  settings: LLMSettings
) {
  if (!vision) throw new Error('Design vision prompt is required.');
  switch (mode) {
    case 'tokens':   return { tokens:   await streamTokens(vision, settings) };
    case 'sec12':    return { sec12:    await streamSec12(vision, settings) };
    case 'sec3':     return { sec3:     await streamSec3(vision, settings) };
    case 'sec4':     return { sec4:     await streamSec4(vision, settings) };
    case 'sec56':    return { sec56:    await streamSec56(vision, settings) };
    case 'sec78':    return { sec78:    await streamSec78(vision, settings) };
    default: throw new Error(`Unknown stream mode: ${mode}`);
  }
}

export async function testLLMConnection(settings: {
  provider: 'gemini' | 'openai' | 'anthropic' | 'ollama' | '9router';
  apiKey: string;
  model: string;
  baseUrl?: string;
}) {
  // Plain text only — no JSON mode (some free/local models append non-JSON tails)
  const systemInstructions =
    'You are a connection tester. Reply with the single word OK if you can hear me. No JSON, no markdown.';
  const userPrompt = 'Test connection. Reply OK only.';
  const responseText = await callLLMRaw(
    systemInstructions,
    userPrompt,
    settings as LLMSettings,
    false
  );
  const reply = (responseText || '').trim();
  if (reply.length > 0) {
    const preview = reply.length > 120 ? `${reply.slice(0, 120)}…` : reply;
    return {
      ok: true,
      message: `Connection test successful via ${settings.provider} (${settings.model || 'default'}). LLM replied: ${preview}`
    };
  }
  throw new Error('Connection failed or LLM returned an empty response.');
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDeckStore } from '../store/deckStore.js';
import type { ProjectInitConfig, ProjectInitStep } from '../../shared/types.js';

type TabType = 'blueprint' | 'theme' | 'stack' | 'workflow';

const DEFAULT_BLUEPRINT_TEMPLATE = (projectName: string) => `# Project Blueprint: ${projectName || 'My Project'}

## Identity & Goals
<!-- What is this project? What problem does it solve? Who is it for? -->


## MVP Scope
<!-- Core features that must be delivered in the first working version -->


## Technical Stack
- **Frontend:**
- **Backend:**
- **Database:**
- **UI Framework:**
- **API Style:**


## Folder & File Structure
\`\`\`
src/
  components/   # Reusable UI components
  pages/        # Route-level pages
  services/     # Business logic & API calls
  utils/        # Pure helper functions
\`\`\`


## Naming Conventions
- Components: PascalCase (e.g. UserCard.tsx)
- Files & folders: kebab-case (e.g. user-card/)
- Hooks: camelCase prefixed with "use" (e.g. useAuth)


## Required Environment Variables
\`\`\`env
# Add all required env keys below — agent will warn if any are missing
\`\`\`


## Agent Rules & Guardrails
<!-- Strict instructions the AI must follow for this project -->
- Do not hardcode colors or spacing — always use design tokens
- Never modify .env files without explicit user approval
- Ask before installing new packages
`;

function getDesignSystemTemplate(
  brand: string,
  primary: string,
  secondary: string,
  bg: string,
  text: string,
  primaryFont: string = 'Din Round',
  secondaryFont: string = 'Feather',
  baseSpacing: string = '8px',
  containerMaxWidth: string = '1200px',
  buttonHeight: string = '50px',
  cardPadding: string = '24px',
  cardShadow: string = '0px 2px 8px rgba(0, 0, 0, 0.04)',
  borderRadius: string = '12px'
): string {
  const lower = brand.toLowerCase();
  
  let brandName = "Duolingo";
  let themeDescription = "Duolingo's design system embodies a playful, approachable, and energetic learning environment that makes education feel accessible and rewarding. The visual identity combines vibrant, friendly characters with a clean, modern interface that reduces cognitive load while maintaining strong visual hierarchy. Every interaction is designed to feel encouraging and celebratory.";
  let characteristics = [
    "Friendly, rounded typography and component design",
    "High-contrast, vibrant accent colors against neutral backgrounds",
    "Gamified interaction patterns with celebratory visual feedback",
    "Clean, spacious layouts prioritizing focus and retention",
    "Playful character illustrations and typography"
  ];
  
  let primaryAccentDesc = "Primary call-to-action buttons, key interactive elements, and primary UI accents.";
  let supportingAccentDesc = "Alternative accent and supporting UI elements for visual variety and depth.";
  let surfaceBackgroundDesc = "Primary background for cards, containers, and surfaces.";
  let typographyTextDesc = "Primary text color for headings, body copy, and high-contrast UI elements.";
  
  let displayFontSize = "48px";
  let heading1FontSize = "32px";
  let bodyFontSize = "17px";
  let labelFontSize = "15px";
  let captionFontSize = "15px";
  let displayNotes = "Primary page headings, hero sections";
  let heading1Notes = "Major section headings, call-to-action text";
  let bodyNotes = "Primary body copy, paragraphs, descriptions";
  let labelNotes = "Button text, badges, emphasis labels";
  let captionNotes = "Small emphasis text, badges, highlights";
  
  let typographyPrinciples = [
    `Use Display role (${displayFontSize}) for hero sections and major page titles to establish presence and hierarchy`,
    `Default to Body (${bodyFontSize}, 500 weight) for all descriptive text and paragraph content`,
    `Apply Button/Label weight (700) for all interactive text to signal actionability`,
    `Maintain consistent 24px line height for body text to ensure legibility and breathing room`,
    `Use ${primaryFont} as the default for all UI text—consistent, friendly, and highly legible`,
    `Reserve ${secondaryFont} for high-impact display headings that need maximum visual presence`
  ];
  
  let btnPadding = "0px 16px";
  let btnHeight = buttonHeight;
  let btnWidth = "330px";
  let btnRadius = borderRadius;
  let btnBorder = "0px solid transparent";
  let btnShadow = "none";
  let btnHover = "Brightness boost, scale 1.02";
  let btnActive = "Scale 0.98";
  
  let secBtnBg = "transparent";
  let secBtnText = primary;
  let secBtnBorder = `2px solid ${primary}`;
  let secBtnHover = "Background rgba(28, 176, 246, 0.08), text remains accent";
  let secBtnActive = "Background rgba(28, 176, 246, 0.15)";
  
  let standardCardBg = bg;
  let standardCardBorder = "1px solid #E5E5E5";
  let standardCardRadius = borderRadius;
  let standardCardShadow = cardShadow;
  let standardCardHover = "Box shadow becomes 0px 4px 12px rgba(0, 0, 0, 0.08), slight scale 1.01";
  
  let featureCardBg = bg;
  let featureCardBorder = `2px solid ${primary}`;
  let featureCardShadow = `0px 2px 12px rgba(28, 176, 246, 0.12)`;
  
  let inputBg = bg;
  let inputBorder = "1px solid #C1C1C1";
  let inputRadius = "0px";
  let inputHeight = "40px";
  let inputFocusBorder = primary;
  let inputFocusShadow = `0px 0px 0px 3px rgba(28, 176, 246, 0.1)`;
  
  let navBg = bg;
  let navBorder = "0px none";
  let navShadow = "0px 2px 4px rgba(0, 0, 0, 0.04)";
  let navActiveLinkColor = primary;
  
  let badgeRadius = "12px";
  let linkBlue = "#0000EE";
  let collapsingStrategy = "Content stacks vertically, sidebars become bottom-navigation, and max-width containers scale to 100% viewport width.";

  let spacingScale = [
    `8px — micro spacing (gaps within components)`,
    `12px — extra-small spacing`,
    `16px — small spacing`,
    `24px — base spacing (card padding, section gaps)`,
    `32px — medium spacing`,
    `40px — large spacing`,
    `48px — extra-large spacing`,
    `64px — hero spacing`,
    `80px — sectional spacing`,
    `96px — banner spacing`,
    `100px — maximum spacing`
  ];
  
  let whitespacePhilosophy = "Spacing approach prioritizes breathing room and visual clarity. Generous whitespace prevents cognitive overload and creates a calm, inviting interface.";
  
  let borderRadiusScale = [
    "0px — Form inputs, table cells, strict geometric elements",
    "2px — Badges, small labels, minimal rounding",
    `${borderRadius} — Buttons, cards, modals, primary UI elements`,
    "50% — Circular elements, avatar placeholders, full-round badges"
  ];
  
  let depthLevels = [
    { level: "Raised (Hover)", treatment: cardShadow, use: "Card hover states, lifted buttons, interactive elevation" },
    { level: "Elevated (Base)", treatment: cardShadow, use: "Standard cards, default container shadows" },
    { level: "Minimal", treatment: "0px 2px 4px rgba(0, 0, 0, 0.04)", use: "Navigation bars, subtle separation" },
    { level: "Feature Highlight", treatment: `0px 2px 12px rgba(28, 176, 246, 0.12)`, use: "Feature cards, primary highlighted containers" },
    { level: "None", treatment: "none", use: "Text inputs, buttons" }
  ];
  
  let shadowPhilosophy = "Subtle, delicate shadows create depth without visual weight. Shadows are used sparingly to lift elements slightly off the background.";
  
  let doList = [
    `Use ${primaryFont} for all UI text.`,
    `Apply ${primary} to all primary CTAs.`,
    `Maintain consistent padding inside cards for good content readability.`
  ];
  
  let dontList = [
    "Don't use more than three font sizes in a single view.",
    "Don't apply shadows to buttons.",
    "Don't place low-contrast text directly over primary colors."
  ];

  if (lower.includes('linear')) {
    brandName = "Linear";
    themeDescription = "Sleek, dark, and highly professional engineering-focused workspace. Emphasizes focus, efficiency, and premium micro-interactions. Surfaces use deep dark slates with subtle semi-transparent borders and vibrant glowing accents.";
    characteristics = [
      "Deep slates and dark backgrounds for high focus",
      "Subtle 1px semi-transparent borders for high-fidelity panels",
      "Vibrant glowing accents for interactive highlights",
      "Compact typography and efficient, high-density layouts",
      "Monospace fonts for data-heavy terminal blocks"
    ];
    primaryAccentDesc = "Indigo accent for active states, indicators, and primary action items.";
    supportingAccentDesc = "Cyan support accent for highlights, categories, and tags.";
    secBtnText = secondary;
    btnRadius = "6px";
    inputRadius = "6px";
    standardCardRadius = "6px";
    standardCardBorder = "1px solid rgba(255, 255, 255, 0.08)";
    featureCardBorder = `1px solid ${primary}`;
    featureCardShadow = `0px 0px 15px ${primary}30`;
    inputBorder = "1px solid rgba(255, 255, 255, 0.12)";
    navBorder = "1px solid rgba(255, 255, 255, 0.06)";
    navShadow = "none";
    doList = [
      `Use ${primaryFont} for terminal/data blocks.`,
      `Apply ${primary} for active states, indicators, and primary actions.`,
      "Keep layouts compact and data-dense."
    ];
    dontList = [
      "Don't use playful illustration styles.",
      "Don't use large rounded corners (stay compact).",
      "Don't use heavy, high-opacity box shadows."
    ];
    shadowPhilosophy = "Linear uses extremely delicate, low-opacity shadows combined with 1px border outlines to create layered depth in dark interfaces.";
  } else if (lower.includes('vercel')) {
    brandName = "Vercel";
    themeDescription = "Ultra-minimal, clean, and developer-centric visual theme. Relies on absolute high-contrast monochrome design, sharp geometric layouts, and vast whitespace to create a premium, high-speed aesthetic.";
    characteristics = [
      "High-contrast monochrome theme",
      "Sharp geometric layouts with strict alignments",
      "Abundant whitespace for pristine visual breathing room",
      "Zero gradients, solid backgrounds only",
      "Monospace typography accents"
    ];
    primaryAccentDesc = "High-contrast monochrome black or white action points.";
    supportingAccentDesc = "Low-emphasis borders, subtle descriptions and tags.";
    btnRadius = "8px";
    inputRadius = "8px";
    standardCardRadius = "8px";
    standardCardBorder = "1px solid rgba(255, 255, 255, 0.15)";
    featureCardBorder = `2px solid ${text}`;
    featureCardShadow = "none";
    btnShadow = "none";
    standardCardShadow = "none";
    inputBorder = "1px solid rgba(255, 255, 255, 0.15)";
    navBorder = "1px solid rgba(255, 255, 255, 0.08)";
    navShadow = "none";
    doList = [
      `Maintain strict high contrast.`,
      `Use extensive padding and margins to let elements breathe.`,
      "Keep geometry clean, sharp, and geometric."
    ];
    dontList = [
      "Don't use colorful shadows.",
      "Don't use rounded corners greater than 8px for standard UI elements.",
      "Don't add non-essential styling decorations."
    ];
    depthLevels = [
      { level: "Raised (Hover)", treatment: "none", use: "Flat visual interactions" },
      { level: "Elevated (Base)", treatment: "none", use: "Standard card boundaries" },
      { level: "Minimal", treatment: "none", use: "Standard dividers" },
      { level: "Feature Highlight", treatment: "none", use: "Sharp borders" },
      { level: "None", treatment: "none", use: "Buttons and inputs" }
    ];
    shadowPhilosophy = "Vercel design system rejects traditional shadows completely, relying instead on clean 1px borders and extreme contrast boundaries to establish visual depth.";
  } else if (lower.includes('stripe')) {
    brandName = "Stripe";
    themeDescription = "Elegant, modern, and fluid corporate developer experience. Emphasizes smooth transitions, colorful gradients, and refined typography. Beautifully balanced layouts with professional breathing room.";
    characteristics = [
      "Colorful gradients and vibrant indigo primary CTA",
      "Soft, organic depth shadows for card containers",
      "Extremely clean typography and dynamic content rhythm",
      "Fluid interactive transitions and hover states",
      "Professional visual breathing room"
    ];
    primaryAccentDesc = "Bright indigo for prominent CTA actions, primary navigation, and link indicators.";
    supportingAccentDesc = "Colorful cyan/purple highlights and gradient stops.";
    btnRadius = "8px";
    inputRadius = "8px";
    standardCardRadius = "8px";
    standardCardBorder = "1px solid rgba(255, 255, 255, 0.08)";
    featureCardBorder = `1px solid rgba(255, 255, 255, 0.15)`;
    featureCardShadow = "0px 10px 30px rgba(0, 0, 0, 0.15)";
    doList = [
      `Ensure smooth transitions on hover/focus states.`,
      `Use subtle colorful highlights for primary text selections.`,
      "Maintain a perfectly balanced visual layout."
    ];
    dontList = [
      "Don't use harsh solid borders.",
      "Don't use low-contrast primary buttons.",
      "Don't overcrowd information layers."
    ];
    shadowPhilosophy = "Stripe relies on layered, soft, organic drop shadows with wide diffusion to create an elegant, premium, floating physical card layer.";
  } else if (lower.includes('glassmorphism')) {
    brandName = "Glassmorphism";
    themeDescription = "Futuristic, depth-heavy, and translucent. Emphasizes layered frosted glass containers, colorful background glows, and highly responsive interactive states.";
    characteristics = [
      "Frosted glass translucent cards using backdrop-filter blur",
      "Glowing gradient backdrops showing through transparent panels",
      "Reflective subtle border overlays",
      "Deep visual depth and layered physical panels",
      "Futuristic micro-interactions"
    ];
    primaryAccentDesc = "Vibrant neon purple/indigo highlighting active interactive nodes.";
    supportingAccentDesc = "Translucent cyan tags and supporting labels.";
    btnRadius = "16px";
    inputRadius = "12px";
    standardCardRadius = "16px";
    standardCardBorder = "1px solid rgba(255, 255, 255, 0.12)";
    featureCardBorder = "1px solid rgba(255, 255, 255, 0.25)";
    featureCardShadow = "0px 10px 40px rgba(129, 140, 248, 0.15)";
    inputBorder = "1px solid rgba(255, 255, 255, 0.12)";
    navBg = "rgba(11, 13, 20, 0.6)";
    navBorder = "1px solid rgba(255, 255, 255, 0.08)";
    doList = [
      `Use backdrop-filter: blur(16px) on all frosted glass surfaces.`,
      `Apply subtle glowing outlines to highlight panel boundaries.`,
      "Use colorful gradients in the background to show through the glass."
    ];
    dontList = [
      "Don't use solid flat gray backgrounds.",
      "Don't use heavy opaque shadows without glass transparency.",
      "Don't use sharp corner borders."
    ];
    shadowPhilosophy = "Glassmorphism uses heavy soft shadows combined with translucent panels to simulate realistic refractions and double-layer glass depth.";
  } else if (lower.includes('neon')) {
    brandName = "Neon Cyberpunk";
    themeDescription = "Vibrant, futuristic, and high-energy. Features pure dark backgrounds accented by high-frequency glowing neon lines and interactive feedback loops.";
    characteristics = [
      "Absolute pitch black backgrounds for maximum contrast",
      "Radiant glowing borders and text shadows",
      "High-frequency cyberpunk color indicators",
      "Data-dense monospace command center console feel"
    ];
    primaryAccentDesc = "Radiant neon green/indigo for key actions.";
    supportingAccentDesc = "Glowing cyan/pink accents.";
    btnRadius = "4px";
    inputRadius = "4px";
    standardCardRadius = "4px";
    standardCardBorder = `1px solid ${primary}`;
    featureCardBorder = `2px solid ${primary}`;
    featureCardShadow = `0px 0px 15px ${primary}`;
    btnShadow = `0px 0px 8px ${primary}`;
    standardCardShadow = `0px 0px 10px ${primary}30`;
    inputBorder = `1px solid ${secondary}`;
    doList = [
      `Apply text-shadow and box-shadow neon glows to primary actions.`,
      `Keep backgrounds completely dark to let neon glow shine.`,
      "Use monospaced fonts for technical data display."
    ];
    dontList = [
      "Don't use soft pastel colors.",
      "Don't use large gradients; stay flat and radiant.",
      "Don't use large curves (keep corners sharp)."
    ];
    shadowPhilosophy = "Neon design uses additive glowing shadows that match the component color to simulate luminous light sources in dark environments.";
  } else if (lower.includes('pastel')) {
    brandName = "Pastel";
    themeDescription = "Soft, friendly, and approachable visual theme. Emphasizes warm, low-saturation pastel tones, organic rounded geometry, and a peaceful, inviting workspace atmosphere.";
    characteristics = [
      "Low-saturation organic colors",
      "Soft, approachable visual assets and icons",
      "Large, playful rounded corners on all active nodes",
      "Extremely gentle contrast borders"
    ];
    primaryAccentDesc = "Soft lilac/purple for gentle highlights and CTAs.";
    supportingAccentDesc = "Soft mint green or coral support accent.";
    btnRadius = "14px";
    inputRadius = "12px";
    standardCardRadius = "16px";
    standardCardBorder = "1px solid rgba(0, 0, 0, 0.05)";
    featureCardBorder = `2px solid ${primary}`;
    featureCardShadow = "0px 10px 25px rgba(0, 0, 0, 0.05)";
    inputBorder = "1px solid rgba(0, 0, 0, 0.08)";
    doList = [
      `Use gentle rounded corners everywhere.`,
      `Keep borders thin and low contrast.`,
      "Maintain a friendly, warm typography hierarchy."
    ];
    dontList = [
      "Don't use stark absolute blacks or hyper-saturated neons.",
      "Don't use sharp angular geometric blocks.",
      "Don't apply heavy technical shadows."
    ];
    shadowPhilosophy = "Pastel typography and card elevation use large, extremely soft, light gray shadows that feel airy, fluffy, and lightweight.";
  } else if (lower.includes('brutal')) {
    brandName = "Neo-Brutalism";
    themeDescription = "Raw, high-contrast, and unapologetic. Emphasizes solid pure black borders, vibrant primary colors, zero gradients, and offset geometric drop shadows.";
    characteristics = [
      "Thick, solid, pitch black borders (2px to 3px)",
      "High-contrast, raw, pure primary colors",
      "Offset solid geometric drop shadows (zero blur)",
      "Zero gradients or organic curves"
    ];
    primaryAccentDesc = "Bold neon yellow/indigo for key action blocks.";
    supportingAccentDesc = "Solid black or secondary high-contrast accents.";
    btnRadius = "0px";
    inputRadius = "0px";
    standardCardRadius = "0px";
    btnShadow = "4px 4px 0px #000000";
    btnBorder = "2px solid #000000";
    standardCardBorder = "3px solid #000000";
    standardCardShadow = "6px 6px 0px #000000";
    featureCardBorder = "3px solid #000000";
    featureCardShadow = `6px 6px 0px ${primary}`;
    inputBorder = "2px solid #000000";
    navBorder = "2px solid #000000";
    navShadow = "none";
    doList = [
      `Use bold 3px black borders for buttons and cards.`,
      `Use sharp, flat offset drop shadows with zero blur.`,
      "Maintain high geometric alignment without rounded corners."
    ];
    dontList = [
      "Don't use blur filters or soft fuzzy shadows.",
      "Don't use gradients or rounded buttons.",
      "Don't use subtle gray borders."
    ];
    depthLevels = [
      { level: "Raised (Hover)", treatment: "2px 2px 0px #000000", use: "Card hover active visual" },
      { level: "Elevated (Base)", treatment: "6px 6px 0px #000000", use: "Standard containers" },
      { level: "Minimal", treatment: "none", use: "No shadow layout" },
      { level: "Feature Highlight", treatment: `6px 6px 0px ${primary}`, use: "Highlighted components" },
      { level: "None", treatment: "none", use: "Buttons and inputs" }
    ];
    shadowPhilosophy = "Neo-Brutalist shadows are completely solid, flat black offsets that mimic comic book layouts and woodblock prints, rejecting real-world light physics.";
  } else if (lower.includes('minimal')) {
    brandName = "Minimalism";
    themeDescription = "Clean, spacious, and sophisticated. Relying on strict visual hierarchy, abundant breathing space, and tiny elegant borders to structure content beautifully.";
    characteristics = [
      "Strict grid alignment and typographic hierarchy",
      "Abundant white space for content focus",
      "Super-fine 1px gray borders",
      "Ultra-subtle, clean, and professional interactive cues"
    ];
    primaryAccentDesc = "Deep slate or charcoal highlight.";
    supportingAccentDesc = "Subtle gray outlines and descriptions.";
    btnRadius = "4px";
    inputRadius = "4px";
    standardCardRadius = "4px";
    standardCardBorder = "1px solid #E2E8F0";
    featureCardBorder = "1px solid #94A3B8";
    featureCardShadow = "none";
    inputBorder = "1px solid #E2E8F0";
    navBorder = "1px solid #F1F5F9";
    navShadow = "none";
    doList = [
      `Keep layout clean, focusing strictly on typography.`,
      `Use subtle gray dividers instead of heavy shadow layers.`,
      "Maximize visual spacing margins."
    ];
    dontList = [
      "Don't introduce arbitrary decorative items.",
      "Don't use complex multicolored gradients.",
      "Don't use heavy text styling (keep it simple)."
    ];
    shadowPhilosophy = "Minimalism avoids shadows completely, relying on absolute whitespace margins and razor-thin borders to separate hierarchical sections.";
  }

  // Default / Unified: Dynamic 9-section compiler
  const characteristicsMarkdown = characteristics.map(c => `- ${c}`).join('\n');
  const doMarkdown = doList.map(item => `- ${item}`).join('\n');
  const dontMarkdown = dontList.map(item => `- ${item}`).join('\n');
  const depthTable = depthLevels.map(d => `| ${d.level} | ${d.treatment} | ${d.use} |`).join('\n');
  const typographyPrinciplesMarkdown = typographyPrinciples.map(p => `- ${p}`).join('\n');

  return `# Design System Inspired by ${brandName}

## 1. Visual Theme & Atmosphere

${themeDescription}

**Key Characteristics**
${characteristicsMarkdown}

## 2. Color Palette & Roles

### Primary
- **Primary Accent** (\`${primary}\`): ${primaryAccentDesc} Use for primary CTAs, success states, and main navigation highlights.
- **Supporting Accent** (\`${secondary}\`): ${supportingAccentDesc}

### Interactive
- **Link Blue** (\`#0000EE\`): Hyperlinks and tertiary interactive elements. Used for secondary navigation and in-text actions.
- **Button Active State** (\`${primary}\`): Interactive button states and form focus indicators.

### Neutral Scale
- **Typography Text** (\`${text}\`): ${typographyTextDesc}
- **Surface Background** (\`${bg}\`): ${surfaceBackgroundDesc}
- **Light Border** (\`#E5E5E5\`): Subtle dividers, borders, and low-emphasis separators.

### Surface & Borders
- **Form Border** (\`#C1C1C1\`): Input field borders and inactive state indicators.
- **Clean Surface** (\`${bg}\`): Card backgrounds, content surfaces, and light theme foundations.

## 3. Typography Rules

### Font Family
**Primary:** ${primaryFont} (\`${primaryFont.toLowerCase().replace(/\s+/g, '-')}\`, sans-serif, fallback: \`'Segoe UI', Roboto, sans-serif\`)  
**Secondary:** ${secondaryFont} (\`${secondaryFont.toLowerCase().replace(/\s+/g, '-')}\`, sans-serif, fallback: \`'Segoe UI', Roboto, sans-serif\`)

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|-----------------|-------|
| Display/Hero | ${secondaryFont} | ${displayFontSize} | 700 | normal | normal | ${displayNotes} |
| Heading 1 | ${primaryFont} | ${heading1FontSize} | 700 | normal | normal | ${heading1Notes} |
| Body | ${primaryFont} | ${bodyFontSize} | 500 | 24px | normal | ${bodyNotes} |
| Button/Label | ${primaryFont} | ${labelFontSize} | 700 | normal | normal | ${labelNotes} |
| Caption | ${primaryFont} | ${captionFontSize} | 700 | normal | normal | ${captionNotes} |

### Principles
${typographyPrinciplesMarkdown}

## 4. Component Stylings

### Buttons

**Primary Button (Call-to-Action)**
- Background: \`${primary}\`
- Text Color: \`${bg === '#ffffff' || bg === '#fff' ? '#FFFFFF' : '#ffffff'}\`
- Font: ${primaryFont}, 15px, weight 700
- Padding: \`0px 16px\`
- Height: \`${buttonHeight}\`
- Width: \`330px\` (full-width context) or auto
- Border Radius: \`${borderRadius}\`
- Border: \`0px solid transparent\`
- Box Shadow: \`none\`
- Line Height: normal
- Hover State: Brightness boost, scale 1.02
- Active State: Scale 0.98
- Disabled State: Background \`#CCCCCC\`, cursor not-allowed

**Secondary Button (Text Link)**
- Background: transparent (\`rgba(0, 0, 0, 0)\`)
- Text Color: \`${primary}\`
- Font: ${primaryFont}, 15px, weight 700
- Padding: \`0px 16px\`
- Height: \`${buttonHeight}\`
- Width: \`330px\` (full-width context) or auto
- Border Radius: \`${borderRadius}\`
- Border: \`2px solid transparent\`
- Box Shadow: \`none\`
- Line Height: normal
- Hover State: Background \`rgba(28, 176, 246, 0.08)\`, text remains \`${primary}\`
- Active State: Background \`rgba(28, 176, 246, 0.15)\`

**Tertiary Button (Minimal)**
- Background: transparent (\`rgba(0, 0, 0, 0)\`)
- Text Color: \`${text}\`
- Font: ${primaryFont}, 15px, weight 700
- Padding: \`0px 16px\`
- Height: \`${buttonHeight}\`
- Width: auto
- Border Radius: \`${borderRadius}\`
- Border: \`0px solid transparent\`
- Box Shadow: \`none\`
- Line Height: normal
- Hover State: Background \`rgba(60, 60, 60, 0.08)\`
- Active State: Background \`rgba(60, 60, 60, 0.15)\`

### Cards & Containers

**Standard Card**
- Background: \`${bg}\`
- Border: \`1px solid #E5E5E5\`
- Border Radius: \`${borderRadius}\`
- Padding: \`${cardPadding}\`
- Box Shadow: \`${cardShadow}\`
- Hover State: Box shadow becomes \`0px 4px 12px rgba(0, 0, 0, 0.08)\`, slight scale 1.01

**Feature Card (Highlighted)**
- Background: \`${bg}\`
- Border: \`2px solid ${primary}\`
- Border Radius: \`${borderRadius}\`
- Padding: \`${cardPadding}\`
- Box Shadow: \`0px 2px 12px rgba(28, 176, 246, 0.12)\`

### Inputs & Forms

**Text Input (Default)**
- Background: \`${bg}\`
- Text Color: \`${text}\`
- Font: ${primaryFont}, 17px, weight 400
- Padding: \`12px 16px\`
- Height: \`40px\`
- Border: \`1px solid #C1C1C1\`
- Border Radius: \`0px\`
- Box Shadow: \`none\`
- Line Height: 19.55px
- Focus State: Border color becomes \`${primary}\`, box shadow \`0px 0px 0px 3px rgba(28, 176, 246, 0.1)\`
- Placeholder Color: \`#999999\`
- Disabled State: Background \`#F5F5F5\`, border \`#E5E5E5\`, text color \`#CCCCCC\`

**Input Label**
- Font: ${primaryFont}, 15px, weight 700
- Color: \`${text}\`
- Margin Bottom: \`8px\`
- Display: block

### Navigation

**Header Navigation**
- Background: \`${bg}\`
- Text Color: \`${text}\`
- Font: ${primaryFont}, 17px, weight 500
- Padding: \`16px 24px\`
- Height: \`70px\`
- Border: \`0px none\`
- Box Shadow: \`0px 2px 4px rgba(0, 0, 0, 0.04)\`
- Line Height: 20px
- Active Link Color: \`${primary}\`
- Hover State: Text color darkens to \`${primary}\`, light background \`rgba(28, 176, 246, 0.08)\`

**Navigation Link**
- Text Color: \`${text}\`
- Font: ${primaryFont}, 17px, weight 500
- Hover State: Color becomes \`${primary}\`
- Active State: Color \`${primary}\`, bottom border \`2px solid ${primary}\`
- Padding: \`8px 12px\`
- Line Height: 20px

### Links

**Standard Hyperlink**
- Text Color: \`#0000EE\`
- Font: ${primaryFont}, 17px, weight 500
- Text Decoration: underline (on hover)
- Hover State: Color becomes \`${primary}\`, text-decoration underline
- Active State: Color \`#0000CC\`

**CTA Link (Colored)**
- Text Color: \`#FFFFFF\`
- Font: ${primaryFont}, 15px, weight 700
- Background: \`${primary}\`
- Padding: \`0px 20px\`
- Height: \`44px\`
- Border Radius: \`${borderRadius}\`
- Line Height: normal
- Hover State: Background \`${primary}\`

### Badges

**Standard Badge**
- Background: \`#E5E5E5\`
- Text Color: \`${text}\`
- Font: ${primaryFont}, 15px, weight 700
- Padding: \`4px 8px\`
- Border Radius: \`2px\`
- Display: inline-block
- Line Height: normal

**Success Badge**
- Background: \`${secondary}\`
- Text Color: \`#FFFFFF\`
- Font: ${primaryFont}, 15px, weight 700
- Padding: \`4px 8px\`
- Border Radius: \`2px\`

## 5. Layout Principles

### Spacing System

Base unit: \`${baseSpacing}\`

**Scale:**
- \`8px\` — micro spacing (gaps within components)
- \`12px\` — extra-small spacing
- \`16px\` — small spacing
- \`24px\` — base spacing (card padding, section gaps)
- \`32px\` — medium spacing
- \`40px\` — large spacing
- \`48px\` — extra-large spacing
- \`64px\` — hero spacing
- \`72px\` — massive spacing
- \`80px\` — sectional spacing
- \`96px\` — banner spacing
- \`100px\` — maximum spacing

**Usage Context:**
- **8px**: Gap between button icon and text, tight list spacing
- **12px**: Form field gaps, badge margins
- **16px**: Input padding, standard button horizontal padding
- **24px**: Card padding, section spacing, standard gap
- **32px**: Component spacing within layouts
- **40px**: Section margin for clear visual separation
- **48px**: Container padding for main content areas
- **64px**: Hero section top padding
- **72px**: Large hero section padding
- **80px**: Between major page sections
- **96px**: Container horizontal padding for wide layouts
- **100px**: Maximum spacing for distinct layout zones

### Grid & Container
- **Max Width**: \`${containerMaxWidth}\` (standard content container)
- **Column Strategy**: 12-column responsive grid
- **Gutter Width**: \`24px\`
- **Padding**: \`24px\` (mobile), \`48px\` (tablet), \`96px\` (desktop)

### Whitespace Philosophy
Duolingo's spacing approach prioritizes breathing room and visual clarity. Generous whitespace prevents cognitive overload and creates a calm, inviting interface. Hero sections use maximum padding (\`96px\` to \`100px\`) to establish presence, while component spacing remains consistent at \`24px\`. The design avoids visual clutter through strategic use of empty space, allowing typography and color to guide attention naturally.

### Border Radius Scale
- \`0px\` — Form inputs, table cells, strict geometric elements
- \`2px\` — Badges, small labels, minimal rounding
- \`12px\` — Buttons, cards, modals, primary UI elements
- \`50%\` — Circular elements, avatar placeholders, full-round badges

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Raised (Hover) | \`${cardShadow}\` | Card hover states, lifted buttons, interactive elevation |
| Elevated (Base) | \`${cardShadow}\` | Standard cards, default container shadows |
| Minimal | \`0px 2px 4px rgba(0, 0, 0, 0.04)\` | Navigation bars, subtle separation |
| Feature Highlight | \`0px 2px 12px rgba(28, 176, 246, 0.12)\` | Feature cards, primary highlighted containers |
| None | \`none\` | Text inputs, buttons |

**Shadow Philosophy:**
Duolingo employs subtle, delicate shadows that create depth without visual weight. Shadows are used sparingly to lift elements slightly off the background, creating a layered appearance that guides focus. The primary shadow (\`${cardShadow}\`) is nearly imperceptible, maintaining the clean aesthetic while providing spatial context. Hover states amplify shadows slightly to signal interactivity, and feature cards use tinted shadows that reference the primary brand color for visual cohesion.

## 7. Do's and Don'ts

### Do
- **Use ${primaryFont} for all UI text.** It's friendly, consistent, and highly legible across all sizes.
- **Apply \`${primary}\` to all primary CTAs.** Consistent color signaling ensures users immediately recognize important actions.
- **Maintain \`24px\` spacing between major sections.** This establishes rhythm and prevents layout chaos.
- **Use bold, 700-weight text for all buttons and labels.** Weight signals actionability and hierarchy.
- **Keep card padding at \`24px\` minimum.** Generous internal spacing improves content readability.
- **Use full-width buttons on mobile.** Larger touch targets improve usability on small screens.
- **Apply subtle shadows (\`${cardShadow}\`) to cards by default.** This creates depth without visual clutter.
- **Center align hero section text and CTAs.** This creates a welcoming, focused entry point.
- **Use \`rgba(0, 0, 0, 0.15)\` borders for form inputs.** Light borders maintain visual hierarchy without harsh contrast.

### Don't
- **Don't use more than three font sizes in a single view.** Limit typography scale to 48px, 32px, and 17px for clarity.
- **Don't apply shadows to buttons.** Color alone should provide depth; shadows add unnecessary weight.
- **Don't use rounded corners smaller than \`2px\`.** Duolingo's minimum radius (2px on badges) maintains brand consistency.
- **Don't mix Link Blue (\`#0000EE\`) with primary CTAs.** Reserve it for tertiary navigation only; it competes with primary brand green.
- **Don't add more than \`2px\` borders to cards.** Thick borders create visual heaviness; use subtle separators instead.
- **Don't use full-width CTAs on desktop.** Limit CTA width to \`${containerMaxWidth === '1200px' ? '330px' : 'auto'}\` for optimal focus and click targeting.
- **Don't place text directly on brand green without sufficient contrast.** Always ensure text color provides WCAG AA contrast (minimum 4.5:1).
- **Don't overuse the accent green (\`${secondary}\`). Reserve it for supporting elements; use primary blue (\`${primary}\`) for main CTAs.**
- **Don't reduce input height below \`40px\`.** Small inputs feel cramped and reduce tap target size on mobile.

## 8. Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | 320px–767px | Single-column layout, full-width buttons (\`330px\` on 360px+ screens), padding \`16px\` |
| Tablet | 768px–1023px | Two-column layout, buttons \`200px\`–\`250px\`, padding \`32px\`, navigation shifts to hamburger menu |
| Desktop | 1024px+ | Multi-column layout, max-width container \`${containerMaxWidth}\`, full navigation visible, padding \`48px\`–\`96px\` |

### Touch Targets
- **Minimum Button Height**: \`${buttonHeight}\`
- **Minimum Button Width**: \`48px\`
- **Link Tap Area**: \`44px\` height minimum
- **Input Field Height**: \`40px\` minimum
- **Spacing Between Buttons**: \`12px\` minimum to prevent accidental taps

### Collapsing Strategy
- **Mobile (320px–767px)**: Stack all content vertically. Full-width buttons, \`16px\` padding, single-column cards. Navigation collapses to hamburger. Hero sections remain full-width with \`48px\` padding.
- **Tablet (768px–1023px)**: Two-column grid layout for card grids. Buttons expand to \`200px\`–\`250px\` width. Padding increases to \`32px\`. Hero text remains centered but may increase to 40px width max.
- **Desktop (1024px+)**: Multi-column layouts, max-width \`${containerMaxWidth}\` container centered. Full header navigation visible. Padding \`96px\` for hero sections, \`48px\` for standard content. Buttons remain \`330px\` for primary CTAs, smaller for secondary actions.

## 9. Agent Prompt Guide

### Quick Color Reference
- **Primary CTA**: Duolingo Green (\`${primary}\`)
- **Secondary CTA**: Link Blue (\`#0000EE\`)
- **Accent**: Brand Green (\`${secondary}\`)
- **Background**: Off-White (\`${bg}\`)
- **Text (Primary)**: Dark Charcoal (\`${text}\`)
- **Text (Secondary)**: Link Blue (\`#0000EE\`)
- **Borders**: Light Border (\`#E5E5E5\`)
- **Form Borders**: Form Border (\`#C1C1C1\`)
- **Heading Text**: Dark Charcoal (\`${text}\`)

### Iteration Guide
1. **All buttons default to ${primaryFont}, 15px, weight 700.** No exceptions. This ensures consistent, recognizable interactive elements.
2. **Primary CTAs are always \`${primary}\` background with \`#FFFFFF\` text.** Full-width on mobile (\`330px\`), auto-width on desktop, \`${buttonHeight}\` height minimum.
3. **Use \`${cardPadding}\` padding inside cards and containers.** This is the base spacing unit for all internal content.
4. **All text defaults to \`17px\` body size, \`${text}\` color, 24px line height.** Increase to \`32px\` for headings, reduce to \`15px\` only for buttons, labels, and captions.
5. **Border radius is \`${borderRadius}\` for all buttons and cards.** Use \`0px\` for form inputs, \`2px\` for badges only.
6. **Shadows on cards are \`${cardShadow}\`.** Never apply to buttons; hover states use color darkening instead.
7. **Form inputs have \`1px solid #C1C1C1\` borders and \`40px\` height minimum.** Focus state adds \`${primary}\` border and \`rgba(28, 176, 246, 0.1)\` shadow.
8. **Navigation text is \`17px\`, weight 500, \`${text}\`.** Active state becomes \`${primary}\` with underline.
9. **Hero sections use 48px display heading (${secondaryFont} font) centered, with \`96px\` top/bottom padding.** Subtext is 17px body, centered, with maximum \`600px\` width.
10. **Always maintain WCAG AA contrast (4.5:1 minimum)** between text and background. Test \`${primary}\` text on light backgrounds carefully; use \`#0000EE\` or \`${text}\` if contrast fails.
`;
}

const modeOptions = [
  { value: 'dark', label: 'Dark Mode Only' },
  { value: 'light', label: 'Light Mode Only' },
  { value: 'both', label: 'Both (Dark/Light Switch)' }
];

// ── Smart keyword auto-fill engine ─────────────────────────────────────────

type DesignPreset = {
  primary: string; secondary: string; bg: string; text: string;
  radius: string; mode: 'dark' | 'light' | 'both';
};

const BRAND_PRESETS: Record<string, DesignPreset> = {
  duolingo:      { primary: '#77e548', secondary: '#06b6d4', bg: '#0b0d14', text: '#f8fafc', radius: '12px', mode: 'both' },
  linear:        { primary: '#5E6AD2', secondary: '#55B3E0', bg: '#090A0F', text: '#F2F2F2', radius: '6px',  mode: 'dark'  },
  vercel:        { primary: '#ffffff', secondary: '#888888', bg: '#000000', text: '#EDEDED', radius: '8px',  mode: 'dark'  },
  stripe:        { primary: '#635BFF', secondary: '#00D4FF', bg: '#0a2540', text: '#FFFFFF', radius: '8px',  mode: 'dark'  },
  figma:         { primary: '#a259ff', secondary: '#1abcfe', bg: '#1e1e1e', text: '#FFFFFF', radius: '8px',  mode: 'dark'  },
  notion:        { primary: '#2EAADC', secondary: '#0F7B6C', bg: '#FFFFFF', text: '#37352F', radius: '4px',  mode: 'light' },
  github:        { primary: '#238636', secondary: '#1f6feb', bg: '#0d1117', text: '#c9d1d9', radius: '6px',  mode: 'dark'  },
  shadcn:        { primary: '#f8fafc', secondary: '#6366f1', bg: '#09090b', text: '#fafafa', radius: '8px',  mode: 'dark'  },
  tailwind:      { primary: '#38bdf8', secondary: '#818cf8', bg: '#0f172a', text: '#f8fafc', radius: '8px',  mode: 'dark'  },
  ant:           { primary: '#1677ff', secondary: '#52c41a', bg: '#ffffff', text: '#000000', radius: '6px',  mode: 'light' },
  glassmorphism: { primary: '#818cf8', secondary: '#38bdf8', bg: '#0f172a', text: '#f1f5f9', radius: '16px', mode: 'dark'  },
  neon:          { primary: '#00ff88', secondary: '#00d4ff', bg: '#05040a', text: '#ffffff', radius: '8px',  mode: 'dark'  },
  pastel:        { primary: '#c084fc', secondary: '#60d394', bg: '#faf5ff', text: '#3b0764', radius: '14px', mode: 'light' },
  retro:         { primary: '#f59e0b', secondary: '#ef4444', bg: '#1a1a2e', text: '#eab308', radius: '2px',  mode: 'dark'  },
  brutal:        { primary: '#facc15', secondary: '#000000', bg: '#ffffff', text: '#000000', radius: '0px',  mode: 'light' },
  corporate:     { primary: '#2563eb', secondary: '#1e40af', bg: '#ffffff', text: '#1e293b', radius: '4px',  mode: 'light' },
  minimal:       { primary: '#18181b', secondary: '#52525b', bg: '#fafafa', text: '#09090b', radius: '6px',  mode: 'light' },
};

const COLOR_KEYWORDS: Record<string, string> = {
  blue: '#3b82f6', 'sky blue': '#0ea5e9', navy: '#1e3a8a', cobalt: '#1d4ed8',
  purple: '#8b5cf6', violet: '#7c3aed', indigo: '#6366f1', lavender: '#a78bfa',
  green: '#10b981', emerald: '#059669', teal: '#14b8a6', cyan: '#06b6d4', mint: '#6ee7b7',
  red: '#f43f5e', rose: '#fb7185', crimson: '#dc2626', coral: '#fb923c',
  orange: '#f97316', amber: '#f59e0b', yellow: '#eab308', gold: '#ca8a04',
  pink: '#ec4899', fuchsia: '#d946ef', magenta: '#c026d3', lilac: '#c084fc',
  white: '#f8fafc', black: '#09090b', gray: '#6b7280', slate: '#64748b', zinc: '#71717a',
};

function parseDesignKeywords(text: string): Partial<DesignPreset> {
  const lower = text.toLowerCase();
  let result: Partial<DesignPreset> = {};

  // Brand / style presets (first match wins)
  for (const [brand, preset] of Object.entries(BRAND_PRESETS)) {
    if (lower.includes(brand)) {
      result = { ...preset };
      break;
    }
  }

  // Explicit mode override
  if (/(^|\s)dark(\s|$)/.test(lower) || lower.includes('dark mode'))  result.mode = 'dark';
  if (/(^|\s)light(\s|$)/.test(lower) || lower.includes('light mode')) result.mode = 'light';
  if (lower.includes('both mode') || lower.includes('adaptive') || lower.includes('toggle')) result.mode = 'both';

  // Color keywords for primary (when accompanied by "accent", "primary", or standalone)
  for (const [keyword, hex] of Object.entries(COLOR_KEYWORDS)) {
    if (lower.includes(keyword)) {
      if (lower.includes(`${keyword} accent`) || lower.includes(`${keyword} primary`) || lower.includes(`accent ${keyword}`)) {
        result.primary = hex;
      } else if (!result.primary) {
        result.primary = hex; // first color keyword as primary
      } else if (!result.secondary) {
        result.secondary = hex; // second as secondary
      }
    }
  }

  // Border radius style hints
  if (lower.includes('sharp') || lower.includes('square') || lower.includes('no-radius') || lower.includes('no radius')) result.radius = '0px';
  else if (lower.includes('pill') || lower.includes('bubbly') || lower.includes('very round')) result.radius = '20px';
  else if (lower.includes('rounded') || lower.includes('soft corner')) result.radius = '12px';
  else if (lower.includes('subtle')) result.radius = '4px';

  // Dark background inference
  if ((lower.includes('dark') || lower.includes('night') || lower.includes('midnight')) && !result.bg) {
    result.bg = '#0b0d14';
    result.text = result.text || '#f8fafc';
  }
  if ((lower.includes('light') || lower.includes('clean') || lower.includes('white')) && !result.bg) {
    result.bg = '#fafafa';
    result.text = result.text || '#09090b';
  }

  return result;
}

function buildAgentPrompt(vision: string, tokens: {
  primaryColor: string; secondaryColor: string; backgroundColor: string;
  textColor: string; borderRadius: string; darkLightMode: string;
}): string {
  return `Update this project's UI design system based on the following vision:

"${vision}"

Current design tokens:
- Primary: ${tokens.primaryColor}
- Secondary: ${tokens.secondaryColor}
- Background: ${tokens.backgroundColor}
- Text: ${tokens.textColor}
- Border Radius: ${tokens.borderRadius}
- Mode: ${tokens.darkLightMode}

Please:
1. Refine or replace these tokens to match the vision above
2. Update design-tokens.css with all CSS variables (--primary-color, --secondary-color, --bg-color, --text-color, --border-radius, plus typography and spacing tokens)
3. Update the DESIGN_SYSTEM.md document with the complete design system documentation

Only modify design-tokens.css and DESIGN_SYSTEM.md. Do not touch any other files.`;
}

const FRONTEND_TEMPLATES: Record<string, {
  name: string;
  tech: string;
  ui: string;
  folder: string;
  conventions: string;
}> = {
  nextjs: {
    name: 'Next.js App Router',
    tech: 'Next.js 15 (React), TypeScript',
    ui: 'Tailwind CSS + shadcn/ui',
    folder: `src/
  app/                 # App Router routes and pages
    layout.tsx         # Root layout
    page.tsx           # Homepage
    globals.css        # Global CSS variables
  components/          # Reusable UI components
    ui/                # Atomic design primitive UI elements
  hooks/               # Reusable stateful custom hooks
  lib/                 # Third-party configurations & fetch clients
  types/               # Global TypeScript definitions`,
    conventions: `- Component folders: kebab-case (e.g. user-profile/)
- Component files: PascalCase (e.g. UserCard.tsx)
- Helpers & Utilities: camelCase (e.g. formatCurrency.ts)
- Hooks: camelCase with 'use' prefix (e.g. useLocalStorage.ts)`
  },
  viteReact: {
    name: 'Vite + React SPA',
    tech: 'Vite, React, TypeScript',
    ui: 'Tailwind CSS',
    folder: `src/
  assets/              # Images, SVG icons, static media files
  components/          # Reusable shared React components
  contexts/            # React Context Providers for global state
  hooks/               # Reusable custom React hooks
  pages/               # Routed pages/views
  services/            # API call methods and service modules
  utils/               # Helper utilities & pure functions
  App.tsx              # Main application element
  main.tsx             # Entry-point scripting`,
    conventions: `- Component folders: kebab-case (e.g. user-profile/)
- Component files: PascalCase (e.g. UserCard.tsx)
- Helpers & Utilities: camelCase (e.g. formatCurrency.ts)
- Hooks: camelCase with 'use' prefix (e.g. useLocalStorage.ts)`
  },
  vanilla: {
    name: 'HTML5 + CSS3 + Vanilla JS',
    tech: 'HTML5, Vanilla ES6 JavaScript',
    ui: 'Vanilla CSS Variables',
    folder: `css/
  style.css            # Base stylesheet
  design-tokens.css    # Extracted custom design system variables
js/
  app.js               # Core client-side execution script
assets/                # Static images and icons
index.html             # Application homepage`,
    conventions: `- File names: kebab-case (e.g. user-card.js)
- CSS classes: kebab-case (e.g. .btn-primary)
- JavaScript functions: camelCase (e.g. fetchUserData)`
  }
};

const BACKEND_TEMPLATES: Record<string, {
  name: string;
  tech: string;
  api: string;
  folder: string;
}> = {
  express: {
    name: 'Express + Node.js (REST)',
    tech: 'Node.js, Express, Prisma ORM',
    api: 'REST API',
    folder: `src/
  controllers/         # Request handlers
  middleware/          # Custom middleware handlers (auth, logging)
  models/              # Schema/DB models
  routes/              # API router definitions
  services/            # Database transactions & core operations
  config/              # Connection variables & env configuration
  app.ts               # Express configuration setup
  server.ts            # Entrypoint listener`
  },
  nestjs: {
    name: 'NestJS Modular API',
    tech: 'NestJS, TypeScript, TypeORM',
    api: 'REST API',
    folder: `src/
  modules/             # Feature modules (Auth, Users)
    auth/              # Module directory containing controllers, services
  common/              # Shared guards, pipes, interceptors
  config/              # Environment configurations
  main.ts              # NestJS bootstrapping file`
  },
  fastapi: {
    name: 'FastAPI (Python)',
    tech: 'Python 3.11+, FastAPI, SQLAlchemy',
    api: 'REST API',
    folder: `app/
  api/                 # Routers and endpoints
  core/                # Security, settings, and databases
  models/              # SQL database schemas
  schemas/             # Pydantic schemas (request/response validation)
  crud/                # DB transactions helpers
  main.py              # Entrypoint file`
  },
  supabase: {
    name: 'Supabase / Firebase Serverless',
    tech: 'Supabase BaaS / Supabase client SDK',
    api: 'Server Actions / Supabase direct API client',
    folder: `src/
  lib/
    supabase.ts        # Supabase client instantiation
  actions/             # Next.js Server Actions (Supabase / DB operations)`
  },
  none: {
    name: 'None',
    tech: 'None',
    api: 'None',
    folder: ''
  }
};

function mergeFolderStructures(feKey: string, beKey: string): string {
  if (beKey === 'supabase' || beKey === 'none') {
    return FRONTEND_TEMPLATES[feKey]?.folder || '';
  }
  
  const feFolder = FRONTEND_TEMPLATES[feKey]?.folder || '';
  const beFolder = BACKEND_TEMPLATES[beKey]?.folder || '';
  
  const indentedFe = feFolder.split('\n').map(line => '  ' + line).join('\n');
  const indentedBe = beFolder.split('\n').map(line => '  ' + line).join('\n');
  
  return `frontend/            # Frontend project root
${indentedFe}

backend/             # Backend API root
${indentedBe}

package.json         # Workspace configuration`;
}

function getFrontendKeyFromStack(stack: string): string {
  const s = (stack || '').toLowerCase();
  if (s.includes('next.js') || s.includes('nextjs')) return 'nextjs';
  if (s.includes('vite') || s.includes('react')) return 'viteReact';
  if (s.includes('html') || s.includes('vanilla')) return 'vanilla';
  return 'viteReact';
}

function getBackendKeyFromStack(stack: string): string {
  const s = (stack || '').toLowerCase();
  if (s.includes('express') || s.includes('node')) return 'express';
  if (s.includes('nest')) return 'nestjs';
  if (s.includes('fastapi') || s.includes('python')) return 'fastapi';
  if (s.includes('supabase')) return 'supabase';
  return 'none';
}

function patchBlueprintWithArchitecture(
  currentMarkdown: string,
  params: {
    frontendStack: string;
    backendStack: string;
    database: string;
    uiFramework: string;
    apiStyle: string;
    folderStructure: string;
    namingConventions: string;
    description?: string;
    mvpScope?: string;
    envKeys?: string;
    customAgentRules?: string;
    customFields?: { key: string; value: string }[];
  }
): string {
  let md = currentMarkdown || '';

  const identityHeader = '## Identity & Goals';
  const mvpHeader = '## MVP Scope';
  const techStackHeader = '## Technical Stack';
  const folderHeader = '## Folder & File Structure';
  const namingHeader = '## Naming Conventions';
  const envHeader = '## Required Environment Variables';
  const rulesHeader = '## Agent Rules & Guardrails';

  const newIdentityContent = `## Identity & Goals
${params.description || '<!-- What is this project? What problem does it solve? Who is it for? -->'}
`;

  const newMvpContent = `## MVP Scope
${params.mvpScope || '<!-- Core features that must be delivered in the first working version -->'}
`;

  let techContentLines = [
    `## Technical Stack`,
    `- **Frontend:** ${params.frontendStack || 'Not specified'}`,
    `- **Backend:** ${params.backendStack || 'Not specified'}`,
    `- **Database:** ${params.database || 'Not specified'}`,
    `- **UI Framework:** ${params.uiFramework || 'Not specified'}`,
    `- **API Style:** ${params.apiStyle || 'Not specified'}`
  ];

  if (params.customFields && params.customFields.length > 0) {
    for (const f of params.customFields) {
      if (f.key.trim() && f.value.trim()) {
        techContentLines.push(`- **${f.key.trim()}:** ${f.value.trim()}`);
      }
    }
  }

  const newTechContent = techContentLines.join('\n') + '\n';

  const newFolderContent = `## Folder & File Structure
\`\`\`
${params.folderStructure || 'src/'}
\`\`\`
`;

  const newNamingContent = `## Naming Conventions
${params.namingConventions || '- Follow framework standards'}
`;

  const newEnvContent = `## Required Environment Variables
\`\`\`env
${params.envKeys || '# Add all required env keys below — agent will warn if any are missing'}
\`\`\`
`;

  const newRulesContent = `## Agent Rules & Guardrails
${params.customAgentRules || '<!-- Strict instructions the AI must follow for this project -->\n- Do not hardcode colors or spacing — always use design tokens\n- Never modify .env files without explicit user approval\n- Ask before installing new packages'}
`;

  const replaceSection = (content: string, header: string, newSectionContent: string): string => {
    const index = content.indexOf(header);
    if (index === -1) {
      return content + '\n\n' + newSectionContent;
    }
    
    const searchArea = content.substring(index + header.length);
    const nextHeadingMatch = searchArea.match(/\n##\s/);
    if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
      const endIndex = index + header.length + nextHeadingMatch.index;
      return content.substring(0, index) + newSectionContent + content.substring(endIndex);
    } else {
      return content.substring(0, index) + newSectionContent;
    }
  };

  md = replaceSection(md, identityHeader, newIdentityContent);
  md = replaceSection(md, mvpHeader, newMvpContent);
  md = replaceSection(md, techStackHeader, newTechContent);
  md = replaceSection(md, folderHeader, newFolderContent);
  md = replaceSection(md, namingHeader, newNamingContent);
  md = replaceSection(md, envHeader, newEnvContent);
  md = replaceSection(md, rulesHeader, newRulesContent);

  return md;
}

function parseArchitectureFromMarkdown(markdown: string) {
  const result = {
    frontendStack: '',
    backendStack: '',
    database: '',
    uiFramework: '',
    apiStyle: '',
    folderStructure: '',
    namingConventions: '',
    description: '',
    mvpScope: '',
    envKeys: '',
    customAgentRules: '',
    customFields: [] as { key: string; value: string }[]
  };

  if (!markdown) return result;
  const lines = markdown.split('\n');
  
  const extractSectionLines = (headerPrefix: string): string[] => {
    const headerIndex = lines.findIndex(l => l.trim().startsWith(headerPrefix));
    if (headerIndex === -1) return [];
    let contentLines: string[] = [];
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('##')) {
        break;
      }
      contentLines.push(line);
    }
    return contentLines;
  };

  const techLines = extractSectionLines('## Technical Stack');
  for (const line of techLines) {
    const cleanLine = line.trim();
    if (!cleanLine.startsWith('-') && !cleanLine.startsWith('*')) {
      continue;
    }
    const match = cleanLine.match(/^[-*]\s+(?:\*\*(.*?)\*\*|(.*?)):\s*(.*)$/);
    if (match) {
      const key = (match[1] || match[2] || '').trim();
      const value = (match[3] || '').trim();
      if (!key) continue;

      const lowerKey = key.toLowerCase();
      if (lowerKey === 'frontend' || lowerKey === 'frontend stack') {
        result.frontendStack = value;
      } else if (lowerKey === 'backend' || lowerKey === 'backend stack') {
        result.backendStack = value;
      } else if (lowerKey === 'database') {
        result.database = value;
      } else if (lowerKey === 'ui framework') {
        result.uiFramework = value;
      } else if (lowerKey === 'api style') {
        result.apiStyle = value;
      } else {
        result.customFields.push({ key, value });
      }
    }
  }

  const extractSectionContent = (headerPrefix: string, isCodeBlock = false): string => {
    const headerIndex = lines.findIndex(l => l.trim().startsWith(headerPrefix));
    if (headerIndex === -1) return '';
    let contentLines: string[] = [];
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim().startsWith('##')) {
        break;
      }
      contentLines.push(line);
    }
    let content = contentLines.join('\n').trim();
    if (isCodeBlock && content.startsWith('```')) {
      content = content.replace(/^```[a-zA-Z]*\r?\n/, '');
      content = content.replace(/\r?\n```$/, '');
    }
    return content.trim();
  };

  result.folderStructure = extractSectionContent('## Folder & File Structure', true);
  result.namingConventions = extractSectionContent('## Naming Conventions');
  result.description = extractSectionContent('## Identity & Goals');
  result.mvpScope = extractSectionContent('## MVP Scope');
  result.envKeys = extractSectionContent('## Required Environment Variables', true);
  result.customAgentRules = extractSectionContent('## Agent Rules & Guardrails');

  return result;
}

function scanActualFolderStructure(rootPath: string): Promise<string> {
  const ignoreList = ['.git', 'node_modules', '.next', 'dist', 'build', 'out', '.DS_Store', 'package-lock.json'];
  
  const buildTree = async (currentPath: string, indent: string = '', depth: number = 0): Promise<string> => {
    if (depth > 2) return '';
    try {
      const res = await window.agentDeck.readDir(currentPath);
      if (!res || !res.ok || !res.data) return '';
      
      const items = [...res.data].sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      
      let treeStr = '';
      for (const item of items) {
        if (ignoreList.includes(item.name)) continue;
        
        if (item.isDirectory) {
          treeStr += `${indent}${item.name}/\n`;
          const subTree = await buildTree(item.path, indent + '  ', depth + 1);
          if (subTree) treeStr += subTree;
        } else {
          treeStr += `${indent}${item.name}\n`;
        }
      }
      return treeStr;
    } catch (err) {
      console.error('Error scanning folder:', err);
      return '';
    }
  };

  return buildTree(rootPath, '');
}

export const ProjectBlueprintPanel: React.FC = () => {
  const activeWorkspaceId = useDeckStore((state) => state.activeWorkspaceId);
  const workspaces = useDeckStore((state) => state.workspaces);
  const updateWorkspaceInitConfig = useDeckStore((state) => state.updateWorkspaceInitConfig);
  const resetWorkspaceInitConfig = useDeckStore((state) => state.resetWorkspaceInitConfig);
  const activePaneId = useDeckStore((state) => state.activePaneId);
  const isAgentRunning = useDeckStore((state) =>
    state.agentRuns.some((run) => run.terminalSessionId === state.activePaneId && run.status === 'running')
  );

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const [activeSubTab, setActiveSubTab] = useState<TabType>('blueprint');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<TabType | null>(null);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const [hoveredModeOption, setHoveredModeOption] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);

  const tabSelectorRef = React.useRef<HTMLDivElement>(null);
  const modeDropdownRef = React.useRef<HTMLDivElement>(null);

  const options: { value: TabType; label: string }[] = [
    { value: 'blueprint', label: 'Blueprint Editor' },
    { value: 'theme', label: 'UI Theme & Design Tokens' },
    { value: 'stack', label: 'Architecture & Tech Stack' },
    { value: 'workflow', label: 'Pre-Run Setup Workflow' }
  ];

  // Architecture & Tech Stack state hooks
  const [frontendStack, setFrontendStack] = useState('');
  const [backendStack, setBackendStack] = useState('');
  const [database, setDatabase] = useState('');
  const [uiFramework, setUiFramework] = useState('');
  const [apiStyle, setApiStyle] = useState('');
  const [folderStructureBlueprint, setFolderStructureBlueprint] = useState('');
  const [namingConventions, setNamingConventions] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [mvpScope, setMvpScope] = useState('');
  const [envKeysText, setEnvKeysText] = useState('');
  const [customAgentRules, setCustomAgentRules] = useState('');
  const [stackApplyStatus, setStackApplyStatus] = useState<'idle' | 'applied' | 'error'>('idle');
  const [activeStackPreset, setActiveStackPreset] = useState<string | null>(null);
  const [customStackFields, setCustomStackFields] = useState<{ key: string; value: string }[]>([]);

  // Blueprint markdown state
  const [blueprintMarkdown, setBlueprintMarkdown] = useState('');

  // Theme state
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [secondaryColor, setSecondaryColor] = useState('#06b6d4');
  const [backgroundColor, setBackgroundColor] = useState('#0b0d14');
  const [textColor, setTextColor] = useState('#f8fafc');
  const [borderRadius, setBorderRadius] = useState('8px');
  const [darkLightMode, setDarkLightMode] = useState<'dark' | 'light' | 'both'>('dark');

  // Light mode colors (only active when darkLightMode === 'both')
  const [lightPrimaryColor, setLightPrimaryColor] = useState('#4f46e5');
  const [lightSecondaryColor, setLightSecondaryColor] = useState('#06b6d4');
  const [lightBackgroundColor, setLightBackgroundColor] = useState('#ffffff');
  const [lightTextColor, setLightTextColor] = useState('#0f172a');

  // Local text input states to allow free-form hex/RGB editing without HTML5 color picker coercing/freezing
  const [primaryColorInput, setPrimaryColorInput] = useState('#4f46e5');
  const [secondaryColorInput, setSecondaryColorInput] = useState('#06b6d4');
  const [backgroundColorInput, setBackgroundColorInput] = useState('#0b0d14');
  const [textColorInput, setTextColorInput] = useState('#f8fafc');
  const [lightPrimaryColorInput, setLightPrimaryColorInput] = useState('#4f46e5');
  const [lightSecondaryColorInput, setLightSecondaryColorInput] = useState('#06b6d4');
  const [lightBackgroundColorInput, setLightBackgroundColorInput] = useState('#ffffff');
  const [lightTextColorInput, setLightTextColorInput] = useState('#0f172a');

  // Rich Typography & Layout GUI states
  const [primaryFont, setPrimaryFont] = useState('Din Round');
  const [secondaryFont, setSecondaryFont] = useState('Feather');
  const [baseSpacing, setBaseSpacing] = useState('8px');
  const [containerMaxWidth, setContainerMaxWidth] = useState('1200px');
  const [buttonHeight, setButtonHeight] = useState('50px');
  const [cardPadding, setCardPadding] = useState('24px');
  const [cardShadow, setCardShadow] = useState('0px 2px 8px rgba(0, 0, 0, 0.04)');

  const [activeColorTab, setActiveColorTab] = useState<'dark' | 'light'>('dark');
  const [previewMode, setPreviewMode] = useState<'dark' | 'light'>('dark');

  // Workflow state
  const [initSteps, setInitSteps] = useState<ProjectInitStep[]>([]);

  // Vision / idea input for smart auto-fill
  const [designVision, setDesignVision] = useState('');
  const [autoFillStatus, setAutoFillStatus] = useState<'idle' | 'filled'>('idle');
  const [designSystemMarkdown, setDesignSystemMarkdown] = useState('');
  /** Local click feedback only — not tied to background saves (refresh-button-feedback skill). */
  const [syncColorsRefreshing, setSyncColorsRefreshing] = useState(false);
  /** Reset Template — inline confirm + min spin (refresh-button-feedback, no window.confirm). */
  const [resetTemplateConfirming, setResetTemplateConfirming] = useState(false);
  const [resetTemplateRefreshing, setResetTemplateRefreshing] = useState(false);
  const resetTemplateBtnRef = useRef<HTMLButtonElement | null>(null);
  /** Inline double-click delete confirm (inline-confirm-delete-ux) — one step at a time. */
  const [confirmingDeleteStepId, setConfirmingDeleteStepId] = useState<string | null>(null);
  const [agentPrompt, setAgentPrompt] = useState('');

  // Persistent AI / LLM Configurations
  const [llmProvider, setLlmProvider] = useState<'gemini' | 'openai' | 'anthropic' | 'ollama' | '9router'>('gemini');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmModel, setLlmModel] = useState('gemini-2.5-flash');
  const [llmBaseUrl, setLlmBaseUrl] = useState('');
  const [isLlmLoading, setIsLlmLoading] = useState(false);
  const [streamStates, setStreamStates] = useState<{
    tokens:   'idle' | 'loading' | 'done' | 'error';
    sec12:    'idle' | 'loading' | 'done' | 'error';
    sec3:     'idle' | 'loading' | 'done' | 'error';
    sec4:     'idle' | 'loading' | 'done' | 'error';
    sec56:    'idle' | 'loading' | 'done' | 'error';
    sec78:    'idle' | 'loading' | 'done' | 'error';
  }>({ tokens: 'idle', sec12: 'idle', sec3: 'idle', sec4: 'idle', sec56: 'idle', sec78: 'idle' });

  const prevPrimaryRef = React.useRef(primaryColor);
  const prevSecondaryRef = React.useRef(secondaryColor);
  const prevBgRef = React.useRef(backgroundColor);
  const prevTextRef = React.useRef(textColor);

  const prevPrimaryFontRef = React.useRef(primaryFont);
  const prevSecondaryFontRef = React.useRef(secondaryFont);
  const prevBaseSpacingRef = React.useRef(baseSpacing);
  const prevContainerMaxWidthRef = React.useRef(containerMaxWidth);
  const prevButtonHeightRef = React.useRef(buttonHeight);
  const prevCardPaddingRef = React.useRef(cardPadding);
  const prevCardShadowRef = React.useRef(cardShadow);
  const prevBorderRadiusRef = React.useRef(borderRadius);

  // Reset Template: cancel inline confirm on outside click / Escape
  useEffect(() => {
    if (!resetTemplateConfirming || resetTemplateRefreshing) return;
    const onDoc = (e: MouseEvent) => {
      if (resetTemplateBtnRef.current?.contains(e.target as Node)) return;
      setResetTemplateConfirming(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setResetTemplateConfirming(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [resetTemplateConfirming, resetTemplateRefreshing]);

  // Sync state from store when workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      const ic = activeWorkspace.initConfig;

      setBlueprintMarkdown(
        (ic as any)?.blueprintMarkdown ||
        DEFAULT_BLUEPRINT_TEMPLATE(activeWorkspace.name || '')
      );
      setDesignVision((ic as any)?.designVision || '');
      setAgentPrompt((ic as any)?.agentPrompt || '');

      let pCol = ic?.primaryColor || '#4f46e5';
      let sCol = ic?.secondaryColor || '#06b6d4';
      let bgCol = ic?.backgroundColor || '#0b0d14';
      let radius = ic?.borderRadius || '8px';
      if (pCol === '#6366f1') pCol = '#4f46e5';
      if (sCol === '#ec4899') sCol = '#06b6d4';
      if (bgCol === '#0f172a') bgCol = '#0b0d14';
      if (radius === '0.5rem') radius = '8px';

      const priF = (ic as any)?.primaryFont || 'Din Round';
      const secF = (ic as any)?.secondaryFont || 'Feather';
      const bSp = (ic as any)?.baseSpacing || '8px';
      const cMaxW = (ic as any)?.containerMaxWidth || '1200px';
      const btnH = (ic as any)?.buttonHeight || '50px';
      const cPad = (ic as any)?.cardPadding || '24px';
      const cShad = (ic as any)?.cardShadow || '0px 2px 8px rgba(0, 0, 0, 0.04)';

      setDesignSystemMarkdown(
        (ic as any)?.designSystemMarkdown ||
        getDesignSystemTemplate(
          'duolingo',
          pCol,
          sCol,
          bgCol,
          ic?.textColor || '#f8fafc',
          priF,
          secF,
          bSp,
          cMaxW,
          btnH,
          cPad,
          cShad,
          radius
        )
      );

      setPrimaryColor(pCol);
      setSecondaryColor(sCol);
      setBackgroundColor(bgCol);
      setTextColor(ic?.textColor || '#f8fafc');
      setBorderRadius(radius);
      setDarkLightMode(ic?.darkLightMode || 'dark');
      setLightPrimaryColor(ic?.lightPrimaryColor || '#4f46e5');
      setLightSecondaryColor(ic?.lightSecondaryColor || '#06b6d4');
      setLightBackgroundColor(ic?.lightBackgroundColor || '#ffffff');
      setLightTextColor(ic?.lightTextColor || '#0f172a');

      setPrimaryColorInput(pCol);
      setSecondaryColorInput(sCol);
      setBackgroundColorInput(bgCol);
      setTextColorInput(ic?.textColor || '#f8fafc');
      setLightPrimaryColorInput(ic?.lightPrimaryColor || '#4f46e5');
      setLightSecondaryColorInput(ic?.lightSecondaryColor || '#06b6d4');
      setLightBackgroundColorInput(ic?.lightBackgroundColor || '#ffffff');
      setLightTextColorInput(ic?.lightTextColor || '#0f172a');

      setPrimaryFont(priF);
      setSecondaryFont(secF);
      setBaseSpacing(bSp);
      setContainerMaxWidth(cMaxW);
      setButtonHeight(btnH);
      setCardPadding(cPad);
      setCardShadow(cShad);

      setFrontendStack(ic?.frontendStack || '');
      setBackendStack(ic?.backendStack || '');
      setDatabase(ic?.database || '');
      setUiFramework(ic?.uiFramework || '');
      setApiStyle(ic?.apiStyle || '');
      setFolderStructureBlueprint(ic?.folderStructureBlueprint || '');
      setNamingConventions(ic?.namingConventions || '');
      setProjectDescription(ic?.description || '');
      setMvpScope(ic?.mvpScope || '');
      setEnvKeysText(Array.isArray(ic?.envKeys) ? ic.envKeys.join('\n') : (ic as any)?.envKeys || '');
      setCustomAgentRules(ic?.customAgentRules || '');
      setCustomStackFields(ic?.customStackFields || []);

      prevPrimaryFontRef.current = priF;
      prevSecondaryFontRef.current = secF;
      prevBaseSpacingRef.current = bSp;
      prevContainerMaxWidthRef.current = cMaxW;
      prevButtonHeightRef.current = btnH;
      prevCardPaddingRef.current = cPad;
      prevCardShadowRef.current = cShad;
      prevBorderRadiusRef.current = radius;

      setActiveColorTab('dark');
      setPreviewMode('dark');

      const defaultSteps: ProjectInitStep[] = [
        { id: '1', label: 'Install Dependencies', command: 'npm install', enabled: true, status: 'pending' },
        { id: '2', label: 'Run Migrations', command: 'npx prisma migrate dev', enabled: false, status: 'pending' },
        { id: '3', label: 'Start Dev Server', command: 'npm run dev', enabled: true, status: 'pending' }
      ];
      setInitSteps(ic?.initSteps || defaultSteps);
    }
  }, [activeWorkspaceId, activeWorkspace]);

  // Synchronize stack GUI edits to blueprint markdown
  useEffect(() => {
    if (activeSubTab !== 'stack') return;
    setBlueprintMarkdown((prev) => {
      const updated = patchBlueprintWithArchitecture(prev, {
        frontendStack,
        backendStack,
        database,
        uiFramework,
        apiStyle,
        folderStructure: folderStructureBlueprint,
        namingConventions,
        description: projectDescription,
        mvpScope,
        envKeys: envKeysText,
        customAgentRules,
        customFields: customStackFields
      });
      if (updated !== prev) {
        return updated;
      }
      return prev;
    });
  }, [
    activeSubTab,
    frontendStack,
    backendStack,
    database,
    uiFramework,
    apiStyle,
    folderStructureBlueprint,
    namingConventions,
    projectDescription,
    mvpScope,
    envKeysText,
    customAgentRules,
    customStackFields
  ]);

  const syncLlmFromStorage = useCallback(() => {
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
      console.error('Failed to load LLM settings:', e);
    }
  }, []);

  useEffect(() => {
    syncLlmFromStorage();

    // Listen for local changes to storage to reactively sync
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'agentdeck_llm_settings') {
        syncLlmFromStorage();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Also, custom event for same-window updates because localStorage 'storage' event only fires in other tabs/windows
    const handleCustomSettingsChange = () => {
      syncLlmFromStorage();
    };
    window.addEventListener('agentdeck_llm_settings_changed', handleCustomSettingsChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('agentdeck_llm_settings_changed', handleCustomSettingsChange);
    };
  }, [syncLlmFromStorage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (isDropdownOpen && tabSelectorRef.current && !tabSelectorRef.current.contains(target)) {
        setIsDropdownOpen(false);
      }
      if (isModeDropdownOpen && modeDropdownRef.current && !modeDropdownRef.current.contains(target)) {
        setIsModeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen, isModeDropdownOpen]);

  // Inline delete confirm: cancel on outside click / Escape
  useEffect(() => {
    if (!confirmingDeleteStepId) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (target.closest('.workflow-step-actions.confirming')) return;
      setConfirmingDeleteStepId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmingDeleteStepId(null);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [confirmingDeleteStepId]);

  // Reactively replace hex codes in the designSystemMarkdown as they are adjusted in picker GUI
  useEffect(() => {
    const prevPri = prevPrimaryRef.current;
    const prevSec = prevSecondaryRef.current;
    const prevBg = prevBgRef.current;
    const prevText = prevTextRef.current;

    let updated = designSystemMarkdown;
    let changed = false;

    if (primaryColor.toLowerCase() !== prevPri.toLowerCase()) {
      const regex = new RegExp(prevPri.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      updated = updated.replace(regex, primaryColor);
      prevPrimaryRef.current = primaryColor;
      changed = true;
    }
    if (secondaryColor.toLowerCase() !== prevSec.toLowerCase()) {
      const regex = new RegExp(prevSec.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      updated = updated.replace(regex, secondaryColor);
      prevSecondaryRef.current = secondaryColor;
      changed = true;
    }
    if (backgroundColor.toLowerCase() !== prevBg.toLowerCase()) {
      const regex = new RegExp(prevBg.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      updated = updated.replace(regex, backgroundColor);
      prevBgRef.current = backgroundColor;
      changed = true;
    }
    if (textColor.toLowerCase() !== prevText.toLowerCase()) {
      const regex = new RegExp(prevText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      updated = updated.replace(regex, textColor);
      prevTextRef.current = textColor;
      changed = true;
    }

    if (changed) {
      setDesignSystemMarkdown(updated);
    }
  }, [primaryColor, secondaryColor, backgroundColor, textColor, designSystemMarkdown]);

  // Reactively replace typography/layout in the designSystemMarkdown as they are adjusted in GUI
  useEffect(() => {
    const prevPriFont = prevPrimaryFontRef.current;
    const prevSecFont = prevSecondaryFontRef.current;
    const prevSpacing = prevBaseSpacingRef.current;
    const prevMaxWidth = prevContainerMaxWidthRef.current;
    const prevBtnHeight = prevButtonHeightRef.current;
    const prevPad = prevCardPaddingRef.current;
    const prevShadow = prevCardShadowRef.current;
    const prevRadius = prevBorderRadiusRef.current;

    let updated = designSystemMarkdown;
    let changed = false;

    if (primaryFont !== prevPriFont) {
      const regex = new RegExp(prevPriFont.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      updated = updated.replace(regex, primaryFont);
      prevPrimaryFontRef.current = primaryFont;
      changed = true;
    }
    if (secondaryFont !== prevSecFont) {
      const regex = new RegExp(prevSecFont.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      updated = updated.replace(regex, secondaryFont);
      prevSecondaryFontRef.current = secondaryFont;
      changed = true;
    }
    if (baseSpacing !== prevSpacing) {
      const regex = new RegExp(prevSpacing.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      updated = updated.replace(regex, baseSpacing);
      prevBaseSpacingRef.current = baseSpacing;
      changed = true;
    }
    if (containerMaxWidth !== prevMaxWidth) {
      const regex = new RegExp(prevMaxWidth.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      updated = updated.replace(regex, containerMaxWidth);
      prevContainerMaxWidthRef.current = containerMaxWidth;
      changed = true;
    }
    if (buttonHeight !== prevBtnHeight) {
      const regex = new RegExp(prevBtnHeight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      updated = updated.replace(regex, buttonHeight);
      prevButtonHeightRef.current = buttonHeight;
      changed = true;
    }
    if (cardPadding !== prevPad) {
      const regex = new RegExp(prevPad.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      updated = updated.replace(regex, cardPadding);
      prevCardPaddingRef.current = cardPadding;
      changed = true;
    }
    if (cardShadow !== prevShadow) {
      const regex = new RegExp(prevShadow.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      updated = updated.replace(regex, cardShadow);
      prevCardShadowRef.current = cardShadow;
      changed = true;
    }
    if (borderRadius !== prevRadius) {
      const regex = new RegExp(prevRadius.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
      updated = updated.replace(regex, borderRadius);
      prevBorderRadiusRef.current = borderRadius;
      changed = true;
    }

    if (changed) {
      setDesignSystemMarkdown(updated);
    }
  }, [primaryFont, secondaryFont, baseSpacing, containerMaxWidth, buttonHeight, cardPadding, cardShadow, borderRadius, designSystemMarkdown]);

  if (!activeWorkspace) {
    return (
      <div style={styles.emptyContainer}>
        <div style={styles.emptyIcon}>📂</div>
        <h3>No Workspace Active</h3>
        <p>Please open or select a project workspace to configure its blueprint rules.</p>
      </div>
    );
  }

  const handleSave = async (customMarkdown?: string) => {
    const markdownToSave = typeof customMarkdown === 'string' ? customMarkdown : blueprintMarkdown;
    const envKeysArray = envKeysText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => line.split('=')[0].trim());

    const config: ProjectInitConfig = {
      projectName: activeWorkspace.name || '',
      description: projectDescription,
      projectType: 'web',
      mvpScope,
      constraints: '',
      frontendStack,
      backendStack,
      database,
      uiFramework,
      apiStyle,
      folderStructureBlueprint,
      namingConventions,
      envKeys: envKeysArray,
      customAgentRules,
      customStackFields,
      blueprintMarkdown: markdownToSave,
      designVision,
      designSystemMarkdown,
      agentPrompt,
      primaryColor,
      secondaryColor,
      backgroundColor,
      textColor,
      borderRadius,
      darkLightMode,
      lightPrimaryColor,
      lightSecondaryColor,
      lightBackgroundColor,
      lightTextColor,
      initSteps,
      primaryFont,
      secondaryFont,
      baseSpacing,
      containerMaxWidth,
      buttonHeight,
      cardPadding,
      cardShadow
    };

    updateWorkspaceInitConfig(activeWorkspace.id, config);
    setSaveStatus('saving');

    try {
      if (window.agentDeck?.applyWorkspaceInitAssets) {
        const res = await window.agentDeck.applyWorkspaceInitAssets(activeWorkspace.rootPath, config);
        if (res && !res.ok) {
          throw new Error((res as any).error?.message || 'Unknown IPC error writing files.');
        }
      }
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Failed to generate project initialization assets:', err);
      setSaveStatus('error');
      alert(`Failed to apply blueprint: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleSyncFromDisk = async () => {
    if (!activeWorkspace) return;
    if (!(window.agentDeck as any)?.loadWorkspaceInitAssets) {
      alert('Backward compatibility sync handler is not available. Please make sure the app main process is restarted.');
      return;
    }
    
    if (window.confirm('Sync back all colors, fonts, spacing, shadows, and markdown specs directly from project files on disk? This will update the editor GUI.')) {
      try {
        const res = await (window.agentDeck as any).loadWorkspaceInitAssets(activeWorkspace.rootPath);
        if (res && res.ok && res.data) {
          const parsed = res.data;
          
          // Reload color states
          if (parsed.primaryColor) {
            setPrimaryColor(parsed.primaryColor);
            setPrimaryColorInput(parsed.primaryColor);
          }
          if (parsed.secondaryColor) {
            setSecondaryColor(parsed.secondaryColor);
            setSecondaryColorInput(parsed.secondaryColor);
          }
          if (parsed.backgroundColor) {
            setBackgroundColor(parsed.backgroundColor);
            setBackgroundColorInput(parsed.backgroundColor);
          }
          if (parsed.textColor) {
            setTextColor(parsed.textColor);
            setTextColorInput(parsed.textColor);
          }
          if (parsed.borderRadius) setBorderRadius(parsed.borderRadius);
          if (parsed.darkLightMode) setDarkLightMode(parsed.darkLightMode);

          // Reload light mode colors
          if (parsed.lightPrimaryColor) {
            setLightPrimaryColor(parsed.lightPrimaryColor);
            setLightPrimaryColorInput(parsed.lightPrimaryColor);
          }
          if (parsed.lightSecondaryColor) {
            setLightSecondaryColor(parsed.lightSecondaryColor);
            setLightSecondaryColorInput(parsed.lightSecondaryColor);
          }
          if (parsed.lightBackgroundColor) {
            setLightBackgroundColor(parsed.lightBackgroundColor);
            setLightBackgroundColorInput(parsed.lightBackgroundColor);
          }
          if (parsed.lightTextColor) {
            setLightTextColor(parsed.lightTextColor);
            setLightTextColorInput(parsed.lightTextColor);
          }

          // Reload layout parameters
          if (parsed.primaryFont) setPrimaryFont(parsed.primaryFont);
          if (parsed.secondaryFont) setSecondaryFont(parsed.secondaryFont);
          if (parsed.baseSpacing) setBaseSpacing(parsed.baseSpacing);
          if (parsed.containerMaxWidth) setContainerMaxWidth(parsed.containerMaxWidth);
          if (parsed.buttonHeight) setButtonHeight(parsed.buttonHeight);
          if (parsed.cardPadding) setCardPadding(parsed.cardPadding);
          if (parsed.cardShadow) setCardShadow(parsed.cardShadow);

          // Reload stack parameters
          if (parsed.frontendStack) setFrontendStack(parsed.frontendStack);
          if (parsed.backendStack) setBackendStack(parsed.backendStack);
          if (parsed.database) setDatabase(parsed.database);
          if (parsed.uiFramework) setUiFramework(parsed.uiFramework);
          if (parsed.apiStyle) setApiStyle(parsed.apiStyle);
          if (parsed.folderStructureBlueprint) setFolderStructureBlueprint(parsed.folderStructureBlueprint);
          if (parsed.namingConventions) setNamingConventions(parsed.namingConventions);
          if (parsed.customStackFields) setCustomStackFields(parsed.customStackFields);

          // Reload markdown specs
          if (parsed.designSystemMarkdown) setDesignSystemMarkdown(parsed.designSystemMarkdown);
          if (parsed.blueprintMarkdown) {
            setBlueprintMarkdown(parsed.blueprintMarkdown);
            // Sync fields from synchronized markdown
            const parsedArch = parseArchitectureFromMarkdown(parsed.blueprintMarkdown);
            setFrontendStack(parsedArch.frontendStack || '');
            setBackendStack(parsedArch.backendStack || '');
            setDatabase(parsedArch.database || '');
            setUiFramework(parsedArch.uiFramework || '');
            setApiStyle(parsedArch.apiStyle || '');
            setFolderStructureBlueprint(parsedArch.folderStructure || '');
            setNamingConventions(parsedArch.namingConventions || '');
            setProjectDescription(parsedArch.description || '');
            setMvpScope(parsedArch.mvpScope || '');
            setEnvKeysText(parsedArch.envKeys || '');
            setCustomAgentRules(parsedArch.customAgentRules || '');
            setCustomStackFields(parsedArch.customFields || []);
          }
          if (parsed.agentPrompt) setAgentPrompt(parsed.agentPrompt);
          
          alert('✓ Reverse sync complete! Successfully reloaded all token variables and markdown specs directly from disk.');
        } else {
          throw new Error(res?.error?.message || 'Empty or corrupted design tokens file on disk.');
        }
      } catch (err) {
        console.error('Failed to sync design tokens from disk:', err);
        alert(`Failed to sync from disk: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  };
 
  const handleReset = () => {
    if (window.confirm('Reset this workspace init configuration back to default values?')) {
      resetWorkspaceInitConfig(activeWorkspace.id);
      setBlueprintMarkdown(DEFAULT_BLUEPRINT_TEMPLATE(activeWorkspace.name || ''));
      setDesignVision('');
      setAgentPrompt('');
      setDesignSystemMarkdown(
        getDesignSystemTemplate(
          'duolingo',
          '#4f46e5',
          '#06b6d4',
          '#0b0d14',
          '#f8fafc'
        )
      );
      setPrimaryFont('Din Round');
      setSecondaryFont('Feather');
      setBaseSpacing('8px');
      setContainerMaxWidth('1200px');
      setButtonHeight('50px');
      setCardPadding('24px');
      setCardShadow('0px 2px 8px rgba(0, 0, 0, 0.04)');
      setFrontendStack('');
      setBackendStack('');
      setDatabase('');
      setUiFramework('');
      setApiStyle('');
      setFolderStructureBlueprint('');
      setNamingConventions('');
      setProjectDescription('');
      setMvpScope('');
      setEnvKeysText('');
      setCustomAgentRules('');
      setCustomStackFields([]);
    }
  };

  const handleAutoFill = async () => {
    if (!designVision.trim()) return;

    const isLlmConfigured = (llmProvider === 'ollama') || (llmApiKey.trim().length > 0);

    if (isLlmConfigured) {
      const ipc = window.agentDeck as any;
      if (!ipc?.generateDesignStream) {
        alert('generateDesignStream IPC not found. Please restart the app.');
        return;
      }

      setIsLlmLoading(true);
      setAutoFillStatus('idle');
      setStreamStates({ tokens: 'loading', sec12: 'loading', sec3: 'loading', sec4: 'loading', sec56: 'loading', sec78: 'loading' });

      const settings = { provider: llmProvider, apiKey: llmApiKey, model: llmModel, baseUrl: llmBaseUrl };

      const applyTokens = (t: any) => {
        if (t.primaryColor)         { setPrimaryColor(t.primaryColor);               setPrimaryColorInput(t.primaryColor); }
        if (t.secondaryColor)       { setSecondaryColor(t.secondaryColor);           setSecondaryColorInput(t.secondaryColor); }
        if (t.backgroundColor)      { setBackgroundColor(t.backgroundColor);         setBackgroundColorInput(t.backgroundColor); }
        if (t.textColor)            { setTextColor(t.textColor);                     setTextColorInput(t.textColor); }
        if (t.borderRadius)         setBorderRadius(t.borderRadius);
        if (t.darkLightMode)        setDarkLightMode(t.darkLightMode);
        if (t.lightPrimaryColor)    { setLightPrimaryColor(t.lightPrimaryColor);     setLightPrimaryColorInput(t.lightPrimaryColor); }
        if (t.lightSecondaryColor)  { setLightSecondaryColor(t.lightSecondaryColor); setLightSecondaryColorInput(t.lightSecondaryColor); }
        if (t.lightBackgroundColor) { setLightBackgroundColor(t.lightBackgroundColor); setLightBackgroundColorInput(t.lightBackgroundColor); }
        if (t.lightTextColor)       { setLightTextColor(t.lightTextColor);           setLightTextColorInput(t.lightTextColor); }
        if (t.primaryFont)          setPrimaryFont(t.primaryFont);
        if (t.secondaryFont)        setSecondaryFont(t.secondaryFont);
        if (t.baseSpacing)          setBaseSpacing(t.baseSpacing);
        if (t.containerMaxWidth)    setContainerMaxWidth(t.containerMaxWidth);
        if (t.buttonHeight)         setButtonHeight(t.buttonHeight);
        if (t.cardPadding)          setCardPadding(t.cardPadding);
        if (t.cardShadow)           setCardShadow(t.cardShadow);
      };

      const mk = <K extends keyof typeof streamStates>(k: K, ok: boolean) =>
        setStreamStates(s => ({ ...s, [k]: ok ? 'done' : 'error' } as typeof s));

      try {
        const [r0, r1, r2, r3, r4, r5] = await Promise.allSettled([
          ipc.generateDesignStream(designVision, 'tokens',    settings).then((r: any) => { if (r?.ok && r.data?.tokens) applyTokens(r.data.tokens); mk('tokens', r?.ok); return r; }),
          ipc.generateDesignStream(designVision, 'sec12',     settings).then((r: any) => { mk('sec12',    r?.ok); return r; }),
          ipc.generateDesignStream(designVision, 'sec3',      settings).then((r: any) => { mk('sec3',     r?.ok); return r; }),
          ipc.generateDesignStream(designVision, 'sec4',      settings).then((r: any) => { mk('sec4',     r?.ok); return r; }),
          ipc.generateDesignStream(designVision, 'sec56',     settings).then((r: any) => { mk('sec56',    r?.ok); return r; }),
          ipc.generateDesignStream(designVision, 'sec78',     settings).then((r: any) => { mk('sec78',    r?.ok); return r; }),
        ]);

        const get = (r: PromiseSettledResult<any>, key: string) =>
          r.status === 'fulfilled' && (r.value as any)?.ok ? (r.value as any).data?.[key] || '' : '';

        const tokensVal = r0.status === 'fulfilled' && r0.value?.ok ? r0.value.data?.tokens : null;
        const finalTokens = {
          primaryColor: tokensVal?.primaryColor || primaryColor,
          secondaryColor: tokensVal?.secondaryColor || secondaryColor,
          backgroundColor: tokensVal?.backgroundColor || backgroundColor,
          textColor: tokensVal?.textColor || textColor,
          borderRadius: tokensVal?.borderRadius || borderRadius,
          darkLightMode: tokensVal?.darkLightMode || darkLightMode,
          primaryFont: tokensVal?.primaryFont || primaryFont,
          secondaryFont: tokensVal?.secondaryFont || secondaryFont,
        };

        const sec9Markdown = `## 9. Agent Prompt Guide

### Quick Color Reference
- **Primary Color**: \`${finalTokens.primaryColor}\`
- **Secondary Color**: \`${finalTokens.secondaryColor}\`
- **Background Color**: \`${finalTokens.backgroundColor}\`
- **Text Color**: \`${finalTokens.textColor}\`
- **Primary Font**: \`${finalTokens.primaryFont}\`
- **Secondary Font**: \`${finalTokens.secondaryFont}\`
- **Border Radius**: \`${finalTokens.borderRadius}\`

### Iteration Guide
1. Create or update \`design-tokens.css\` with standard CSS variables matching the token values above.
2. Read the layout rules, typography table, and component guides defined in sections 1-8 of \`DESIGN_SYSTEM.md\`.
3. Implement responsive styling rules conforming to the breakpoints.
4. Ensure dark/light mode switches are handled appropriately.
5. Create modern, beautiful component styles for buttons, cards, inputs, and badges using the color palette.`;

        const merged = [get(r1,'sec12'), get(r2,'sec3'), get(r3,'sec4'), get(r4,'sec56'), get(r5,'sec78')].filter(Boolean).join('\n\n');
        if (merged) {
          setDesignSystemMarkdown((merged + '\n\n' + sec9Markdown).trim());
        }

        // Build Agent Prompt locally
        const localPrompt = `Update this project's UI design system based on the following vision:

"${designVision}"

Current design tokens:
- Primary Color: ${finalTokens.primaryColor}
- Secondary Color: ${finalTokens.secondaryColor}
- Background Color: ${finalTokens.backgroundColor}
- Text Color: ${finalTokens.textColor}
- Border Radius: ${finalTokens.borderRadius}
- Mode: ${finalTokens.darkLightMode}
- Primary Font: ${finalTokens.primaryFont}
- Secondary Font: ${finalTokens.secondaryFont}

Here is the design system documentation specification to guide you:

${merged ? (merged + '\n\n' + sec9Markdown) : 'Please read the design system specifications.'}

Please:
1. Create or update 'design-tokens.css' with all relevant CSS custom properties.
2. Update the 'DESIGN_SYSTEM.md' file with the complete documentation.
3. Apply these variables globally in your component styles.
4. Ensure all layout, spacing, components, and responsive guidelines are applied cleanly.

Only modify design-tokens.css and DESIGN_SYSTEM.md. Do not touch any other files.`;

        setAgentPrompt(localPrompt);

        const allOk = [r0,r1,r2,r3,r4,r5].every(r => r.status === 'fulfilled' && (r as any).value?.ok);
        if (allOk) {
          setAutoFillStatus('filled');
          setTimeout(() => { setAutoFillStatus('idle'); setStreamStates({ tokens: 'idle', sec12: 'idle', sec3: 'idle', sec4: 'idle', sec56: 'idle', sec78: 'idle' }); }, 3500);
        } else {
          const keys: (keyof typeof streamStates)[] = ['tokens','sec12','sec3','sec4','sec56','sec78'];
          const results = [r0,r1,r2,r3,r4,r5];
          const failed = keys.filter((_,i) => results[i].status !== 'fulfilled' || !(results[i] as any).value?.ok);
          if (failed.length) alert('Some streams failed: ' + failed.join(', ') + '. Partial results applied.');
          setTimeout(() => setStreamStates({ tokens: 'idle', sec12: 'idle', sec3: 'idle', sec4: 'idle', sec56: 'idle', sec78: 'idle' }), 3500);
        }
      } catch (err) {
        console.error('Parallel generation failed:', err);
        setStreamStates({ tokens: 'error', sec12: 'error', sec3: 'error', sec4: 'error', sec56: 'error', sec78: 'error' });
        setTimeout(() => setStreamStates({ tokens: 'idle', sec12: 'idle', sec3: 'idle', sec4: 'idle', sec56: 'idle', sec78: 'idle' }), 3500);
        alert('AI Generation Failed: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setIsLlmLoading(false);
      }
      return;
    }

    // Local fallback
    const parsed = parseDesignKeywords(designVision);
    let newPri = primaryColor, newSec = secondaryColor, newBg = backgroundColor, newText = textColor;
    if (parsed.primary)   { setPrimaryColor(parsed.primary);     newPri = parsed.primary; }
    if (parsed.secondary) { setSecondaryColor(parsed.secondary); newSec = parsed.secondary; }
    if (parsed.bg)        { setBackgroundColor(parsed.bg);       newBg  = parsed.bg; }
    if (parsed.text)      { setTextColor(parsed.text);           newText = parsed.text; }
    if (parsed.radius)    setBorderRadius(parsed.radius);
    if (parsed.mode)      setDarkLightMode(parsed.mode);

    let brand = 'duolingo';
    const lowerVision = designVision.toLowerCase();
    for (const b of ['duolingo','linear','vercel','stripe','glassmorphism','neon','pastel','brutal','minimal']) {
      if (lowerVision.includes(b)) { brand = b; break; }
    }
    setDesignSystemMarkdown(getDesignSystemTemplate(brand, newPri, newSec, newBg, newText));
    setAutoFillStatus('filled');
    setTimeout(() => setAutoFillStatus('idle'), 2500);
  };
  const handleBlueprintMarkdownChange = (newVal: string) => {
    setBlueprintMarkdown(newVal);
    const parsed = parseArchitectureFromMarkdown(newVal);
    setFrontendStack(parsed.frontendStack || '');
    setBackendStack(parsed.backendStack || '');
    setDatabase(parsed.database || '');
    setUiFramework(parsed.uiFramework || '');
    setApiStyle(parsed.apiStyle || '');
    setFolderStructureBlueprint(parsed.folderStructure || '');
    setNamingConventions(parsed.namingConventions || '');
    setCustomStackFields(parsed.customFields || []);
  };

  const handleSendToAgent = async () => {
    if (!activePaneId) {
      alert('Please activate a terminal pane with an AI agent running first.');
      return;
    }

    if (!isAgentRunning) {
      const confirmSend = window.confirm(
        'Warning: No active AI Agent (e.g. Claude Code) is running in the active terminal pane.\n\nSending this design prompt now will write it directly into your raw shell prompt as commands, which can cause syntax errors or clutter your terminal.\n\nAre you sure you want to proceed?'
      );
      if (!confirmSend) {
        return;
      }
    }

    let finalPrompt = agentPrompt.trim();

    if (!finalPrompt) {
      // Fallback: compile the template prompt if state is empty
      finalPrompt = buildAgentPrompt(designVision || 'Default style', {
        primaryColor,
        secondaryColor,
        backgroundColor,
        textColor,
        borderRadius,
        darkLightMode
      });
    }

    window.agentDeck.terminalWrite(activePaneId, finalPrompt + '\r');
  };

  const executeStep = (step: ProjectInitStep) => {
    if (!activePaneId) {
      alert('Please activate or select a terminal pane first where this command should run.');
      return;
    }
    window.agentDeck.terminalWrite(activePaneId, `${step.command}\r`);
    setInitSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, status: 'running' } : s)));
    setTimeout(() => {
      setInitSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, status: 'completed' } : s)));
    }, 4000);
  };

  const lineCount = blueprintMarkdown.split('\n').length;
  const charCount = blueprintMarkdown.length;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Project Init Blueprint</h2>
          <p style={styles.subtitle}>Enforced structural styling, conventions, and pre-run startup configurations.</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.syncBtn} onClick={handleSyncFromDisk} title="Sync/Load design tokens and specs directly from files on disk">
            Sync From Disk
          </button>
          <button style={styles.resetBtn} onClick={handleReset}>Reset</button>
          <button style={styles.saveBtn} onClick={() => handleSave()}>
            {saveStatus === 'saving' ? 'Applying...' : saveStatus === 'success' ? '✓ Applied' : 'Apply Blueprint'}
          </button>
        </div>
      </div>

      {saveStatus === 'success' && (
        <div style={styles.successToast}>
          Blueprint saved to <code>MEMORY.md</code> and <code>design-tokens.css</code>
        </div>
      )}

      {/* Tab Selector Dropdown */}
      <div style={styles.tabSelectorContainer}>
        <span style={styles.tabSelectorLabel}>Blueprint Section:</span>
        <div ref={tabSelectorRef} style={styles.customDropdownContainer}>
          <button style={styles.dropdownTrigger} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
            <span>{options.find((opt) => opt.value === activeSubTab)?.label || ''}</span>
            <span style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s ease', display: 'inline-block', fontSize: '11px', color: '#a1a1aa' }}>▼</span>
          </button>

          {isDropdownOpen && (
            <div style={styles.dropdownMenu}>
              {options.map((opt) => {
                const isActive = activeSubTab === opt.value;
                const isHovered = hoveredOption === opt.value;
                return (
                  <button
                    key={opt.value}
                    style={{
                      ...styles.dropdownOption,
                      backgroundColor: isActive ? '#4f46e5' : isHovered ? '#27272a' : 'transparent',
                      color: isActive ? '#ffffff' : isHovered ? '#f4f4f5' : '#d4d4d8',
                      fontWeight: isActive ? 600 : 500
                    }}
                    onMouseEnter={() => setHoveredOption(opt.value)}
                    onMouseLeave={() => setHoveredOption(null)}
                    onClick={() => { setActiveSubTab(opt.value); setIsDropdownOpen(false); }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Panel Content */}
      <div style={styles.panelContent}>

        {/* BLUEPRINT MARKDOWN EDITOR */}
        {activeSubTab === 'blueprint' && (
          <div style={styles.blueprintEditorSection}>
            <div style={styles.editorToolbar}>
              <span style={styles.editorToolbarLabel}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: 'middle' }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                MEMORY.md
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  ref={resetTemplateBtnRef}
                  type="button"
                  className={[
                    'blueprint-reset-template-btn',
                    resetTemplateConfirming ? 'is-confirming' : '',
                    resetTemplateRefreshing ? 'is-refreshing' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={resetTemplateRefreshing}
                  aria-busy={resetTemplateRefreshing}
                  title={
                    resetTemplateRefreshing
                      ? 'Resetting…'
                      : resetTemplateConfirming
                        ? 'Click again to confirm reset'
                        : 'Restore default template'
                  }
                  onClick={() => {
                    if (resetTemplateRefreshing) return;
                    // 1st click: arm confirm (no OS dialog)
                    if (!resetTemplateConfirming) {
                      setResetTemplateConfirming(true);
                      return;
                    }
                    // 2nd click: apply + spin ≥600ms (refresh-button-feedback)
                    setResetTemplateConfirming(false);
                    const startedAt = Date.now();
                    const minSpinMs = 600;
                    setResetTemplateRefreshing(true);
                    try {
                      setBlueprintMarkdown(
                        DEFAULT_BLUEPRINT_TEMPLATE(activeWorkspace?.name || '')
                      );
                    } finally {
                      const wait = Math.max(0, minSpinMs - (Date.now() - startedAt));
                      window.setTimeout(() => setResetTemplateRefreshing(false), wait);
                    }
                  }}
                >
                  <span className="blueprint-reset-template-btn-icon-wrap" aria-hidden>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      shapeRendering="geometricPrecision"
                      className="blueprint-reset-template-btn-icon"
                    >
                      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                      <polyline points="21 3 21 9 15 9" />
                    </svg>
                  </span>
                  {/* Fixed label — no width jump while confirming / spinning */}
                  <span className="blueprint-reset-template-btn-label">Reset Template</span>
                </button>
              </div>
            </div>

            <textarea
              style={styles.markdownEditor}
              value={blueprintMarkdown}
              onChange={(e) => handleBlueprintMarkdownChange(e.target.value)}
              spellCheck={false}
              placeholder="Write your project blueprint in markdown..."
            />

            <div style={styles.editorStatusBar}>
              <span style={{ color: '#d4d4d8', fontWeight: 600 }}>Markdown</span>
              <span style={{ marginLeft: 'auto', display: 'flex', gap: '16px', color: '#a1a1aa' }}>
                <span>{lineCount} lines</span>
                <span>{charCount} chars</span>
              </span>
            </div>
          </div>
        )}

        {/* UI THEME TAB */}
        {activeSubTab === 'theme' && (
          <div style={styles.formSection}>
            {/* ── AI Design & Agent Assistant ── */}
            <div style={styles.visionCard}>
              <div style={styles.visionHeader}>
                <div style={styles.visionHeaderLeft}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                    <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5.5 5 3Z" style={{ opacity: 0.7 }}/>
                  </svg>
                  <span style={styles.visionTitle}>AI Design Generator</span>
                  {(llmProvider === 'ollama' || llmApiKey.trim().length > 0) ? (
                    <span style={{ fontSize: '11px', color: '#4ade80', background: '#0f1f1a', border: '1px solid #166534', borderRadius: '4px', padding: '2px 7px', fontWeight: 600 }}>
                      {llmProvider.toUpperCase()} · {llmModel.split('/').pop()}
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#fcd34d', background: '#1c1408', border: '1px solid #854d0e', borderRadius: '4px', padding: '2px 7px', fontWeight: 600 }}>
                      LOCAL MODE
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    style={{
                      ...styles.sendAgentBtn,
                      opacity: agentPrompt.trim() ? 1 : 0.5
                    }}
                    onClick={handleSendToAgent}
                    disabled={!agentPrompt.trim()}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    Send to Agent
                  </button>
                </div>
              </div>

              {/* Idea Input area */}
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: '#d4d4d8', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  ✦ Describe Your Design Idea
                </label>
                <div style={{ position: 'relative' }}>
                  <textarea
                    style={{
                      ...styles.visionTextarea,
                      height: '90px',
                      margin: 0,
                      width: '100%',
                      boxSizing: 'border-box',
                      paddingRight: '110px',
                      fontSize: '12px',
                      lineHeight: 1.6,
                      resize: 'vertical'
                    }}
                    value={designVision}
                    onChange={(e) => setDesignVision(e.target.value)}
                    placeholder={`Describe your design vision freely...\ne.g. "dark minimal like Linear with violet accent"\nOr paste a full design system description — AI will parse and generate everything`}
                    spellCheck={false}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !isLlmLoading && designVision.trim()) {
                        handleAutoFill();
                      }
                    }}
                  />
                  <button
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '8px',
                      padding: '5px 10px',
                      fontSize: '11px',
                      fontWeight: 700,
                      background: designVision.trim() && !isLlmLoading
                        ? 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)'
                        : 'rgba(99,102,241,0.25)',
                      color: designVision.trim() && !isLlmLoading ? '#fff' : 'rgba(255,255,255,0.4)',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: designVision.trim() && !isLlmLoading ? 'pointer' : 'not-allowed',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap',
                      boxShadow: designVision.trim() && !isLlmLoading ? '0 2px 8px rgba(99,102,241,0.35)' : 'none'
                    }}
                    onClick={handleAutoFill}
                    disabled={!designVision.trim() || isLlmLoading}
                    title="Ctrl+Enter to generate"
                  >
                    {isLlmLoading ? (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)"/>
                          <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4" fill="currentColor"/>
                        </svg>
                        AI is thinking...
                      </>
                    ) : autoFillStatus === 'filled' ? (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Done!
                      </>
                    ) : (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                        </svg>
                        Generate
                      </>
                    )}
                  </button>
                </div>

                {/* Quick style chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {[
                    {
                      label: 'Duolingo',
                      val: 'duolingo playful green',
                      icon: (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }}>
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                        </svg>
                      )
                    },
                    {
                      label: 'Linear',
                      val: 'linear dark minimal indigo',
                      icon: (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }}>
                          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                        </svg>
                      )
                    },
                    {
                      label: 'Vercel',
                      val: 'vercel monochrome dark',
                      icon: (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }}>
                          <polygon points="12 2 22 22 2 22"/>
                        </svg>
                      )
                    },
                    {
                      label: 'Stripe',
                      val: 'stripe indigo gradient professional',
                      icon: (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }}>
                          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                          <line x1="1" y1="10" x2="23" y2="10"/>
                        </svg>
                      )
                    },
                    {
                      label: 'Glassmorphism',
                      val: 'glassmorphism frosted dark',
                      icon: (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }}>
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/>
                        </svg>
                      )
                    },
                    {
                      label: 'Neon',
                      val: 'neon cyberpunk dark',
                      icon: (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }}>
                          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A7 7 0 0 0 4 8c0 1.3.5 2.6 1.5 3.5.7.8 1.3 1.5 1.5 2.5h8zM9 18h6M10 22h4"/>
                        </svg>
                      )
                    },
                    {
                      label: 'Pastel',
                      val: 'pastel soft light rounded',
                      icon: (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }}>
                          <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                          <circle cx="12" cy="12" r="4"/>
                        </svg>
                      )
                    },
                    {
                      label: 'Minimal',
                      val: 'clean minimal whitespace light',
                      icon: (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }}>
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <line x1="9" y1="3" x2="9" y2="21"/>
                        </svg>
                      )
                    },
                    {
                      label: 'Brutal',
                      val: 'neo-brutalist bold sharp',
                      icon: (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ marginRight: 4, display: 'inline-block', verticalAlign: 'middle' }}>
                          <rect x="3" y="3" width="18" height="18"/>
                        </svg>
                      )
                    }
                  ].map(({ label, val, icon }) => (
                    <button
                      key={val}
                      style={{
                        ...styles.chip,
                        fontSize: '10px',
                        padding: '2px 7px',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                      onClick={() => setDesignVision(val)}
                    >
                      {icon}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                {/* Parallel generation stream tracker */}
                {(isLlmLoading || streamStates.tokens !== 'idle') && (
                  <div style={{
                    background: 'rgba(99,102,241,0.05)',
                    border: '1px solid rgba(99,102,241,0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                  }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(165,180,252,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>
                      6 streams running in parallel
                    </div>
                    {([
                      { key: 'tokens',    label: 'Design Tokens',   desc: 'Colors / Fonts / Spacing' },
                      { key: 'sec12',     label: 'Theme + Colors',   desc: 'Sections 1-2' },
                      { key: 'sec3',      label: 'Typography',       desc: 'Section 3' },
                      { key: 'sec4',      label: 'Components',       desc: 'Section 4' },
                      { key: 'sec56',     label: 'Layout + Depth',   desc: 'Sections 5-6' },
                      { key: 'sec78',     label: 'Guidelines + UX',  desc: 'Sections 7-8' },
                    ] as { key: keyof typeof streamStates; label: string; desc: string }[]).map(({ key, label, desc }) => {
                      const st = streamStates[key];
                      const isDone = st === 'done';
                      const isErr  = st === 'error';
                      const isLoad = st === 'loading';
                      return (
                        <div key={key} style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '3px 6px', borderRadius: '5px',
                          background: isDone ? 'rgba(134,239,172,0.05)' : isErr ? 'rgba(248,113,113,0.05)' : isLoad ? 'rgba(165,180,252,0.05)' : 'transparent',
                          transition: 'background 0.3s ease',
                        }}>
                          <div style={{
                            width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isDone ? '#86efac' : isErr ? '#f87171' : isLoad ? '#818cf8' : 'rgba(255,255,255,0.08)',
                            border: `2px solid ${isDone ? '#86efac' : isErr ? '#f87171' : isLoad ? '#a5b4fc' : 'rgba(255,255,255,0.12)'}`,
                            boxShadow: isLoad ? '0 0 8px rgba(129,140,248,0.6)' : isDone ? '0 0 5px rgba(134,239,172,0.4)' : 'none',
                            transition: 'all 0.3s ease',
                          }}>
                            {isDone ? (
                              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            ) : isErr ? (
                              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            ) : isLoad ? (
                              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff', animation: 'pulse 0.9s ease-in-out infinite' }}/>
                            ) : null}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: '10px', fontWeight: 700,
                              color: isDone ? '#86efac' : isErr ? '#f87171' : isLoad ? '#c7d2fe' : 'rgba(255,255,255,0.25)',
                              transition: 'color 0.3s ease',
                            }}>{label}</div>
                            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.18)', marginTop: '1px' }}>{desc}</div>
                          </div>
                          <div style={{ fontSize: '9px', fontWeight: 600, flexShrink: 0, color: isDone ? '#86efac' : isErr ? '#f87171' : isLoad ? '#a5b4fc' : 'rgba(255,255,255,0.2)' }}>
                            {isDone ? 'Done' : isErr ? 'Error' : isLoad ? 'Running...' : 'Idle'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Output row: generated prompt */}
              {agentPrompt.trim() && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#fda4af', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      ✦ Compiled Agent Prompt
                    </label>
                    <button
                      style={{
                        ...styles.editorToolbarBtn,
                        padding: '1px 8px',
                        fontSize: '10px',
                        backgroundColor: 'rgba(253, 164, 175, 0.1)',
                        borderColor: 'rgba(253, 164, 175, 0.2)',
                        color: '#fecdd3',
                        margin: 0
                      }}
                      onClick={async () => {
                        if (!designVision.trim()) {
                          alert('Please fill out the Design Vision textarea first.');
                          return;
                        }
                        setIsLlmLoading(true);
                        try {
                          const isLlmConfigured = (llmProvider === 'ollama') || (llmApiKey.trim().length > 0);
                          if (!isLlmConfigured) {
                            const template = buildAgentPrompt(designVision, {
                              primaryColor, secondaryColor, backgroundColor,
                              textColor, borderRadius, darkLightMode
                            });
                            setAgentPrompt(template);
                            return;
                          }
                          const res = await (window.agentDeck as any).generateDesignLLM(designVision, {
                            provider: llmProvider,
                            apiKey: llmApiKey,
                            model: llmModel,
                            baseUrl: llmBaseUrl
                          });
                          if (res && res.ok && res.data && res.data.agentPrompt) {
                            setAgentPrompt(res.data.agentPrompt);
                          } else {
                            throw new Error(res?.error?.message || 'Empty prompt from LLM.');
                          }
                        } catch (e) {
                          alert(`Failed to generate prompt: ${e instanceof Error ? e.message : String(e)}`);
                        } finally {
                          setIsLlmLoading(false);
                        }
                      }}
                    >
                      Regenerate
                    </button>
                  </div>
                  <textarea
                    style={{
                      width: '100%',
                      height: '90px',
                      backgroundColor: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(253,164,175,0.15)',
                      borderRadius: '8px',
                      color: '#e2e8f0',
                      fontSize: '11px',
                      fontFamily: '"Fira Code", monospace',
                      lineHeight: 1.5,
                      padding: '8px 10px',
                      resize: 'none',
                      outline: 'none',
                      boxSizing: 'border-box',
                      margin: 0
                    }}
                    value={agentPrompt}
                    onChange={(e) => setAgentPrompt(e.target.value)}
                    spellCheck={false}
                    placeholder="AI-compiled implementation instructions for the coding agent will appear here..."
                  />
                </div>
              )}

              {/* Prompt placeholder when empty */}
              {!agentPrompt.trim() && !isLlmLoading && (
                <div style={{
                  marginTop: '10px',
                  padding: '10px 14px',
                  background: '#141416',
                  border: '1px dashed rgba(255,255,255,0.12)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px'
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span style={{ fontSize: '12px', color: '#a1a1aa', lineHeight: 1.45, fontWeight: 500 }}>
                    Describe your idea above and click <strong style={{ color: '#c7d2fe', fontWeight: 600 }}>Generate</strong> — AI will compile colors, fonts, design docs and agent instructions automatically.
                  </span>
                </div>
              )}
            </div>

            <div style={styles.themeGrid}>
              <div style={styles.colorConfig}>
                {darkLightMode === 'both' && (
                  <div style={styles.colorTabBar}>
                    <button
                      style={{ ...styles.colorTabBtn, ...(activeColorTab === 'dark' ? styles.colorTabBtnActive : {}) }}
                      onClick={() => { setActiveColorTab('dark'); setPreviewMode('dark'); }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 5, verticalAlign: 'middle' }}>
                        <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
                      </svg>
                      Dark Theme
                    </button>
                    <button
                      style={{ ...styles.colorTabBtn, ...(activeColorTab === 'light' ? styles.colorTabBtnActiveLight : {}) }}
                      onClick={() => { setActiveColorTab('light'); setPreviewMode('light'); }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5, verticalAlign: 'middle' }}>
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/>
                        <line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                      </svg>
                      Light Theme
                    </button>
                  </div>
                )}

                <div style={styles.colorPickerGroup}>
                  <label style={styles.colorLabel}>Primary Color</label>
                  <div style={styles.colorInputContainer}>
                    <input type="color" style={styles.colorDot}
                      value={darkLightMode === 'both' && activeColorTab === 'light' ? lightPrimaryColor : primaryColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (darkLightMode === 'both' && activeColorTab === 'light') {
                          setLightPrimaryColor(val);
                          setLightPrimaryColorInput(val);
                        } else {
                          setPrimaryColor(val);
                          setPrimaryColorInput(val);
                        }
                      }}
                    />
                    <input type="text" style={styles.colorText}
                      value={darkLightMode === 'both' && activeColorTab === 'light' ? lightPrimaryColorInput : primaryColorInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (darkLightMode === 'both' && activeColorTab === 'light') {
                          setLightPrimaryColorInput(val);
                          if (/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(val)) {
                            setLightPrimaryColor(val);
                          }
                        } else {
                          setPrimaryColorInput(val);
                          if (/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(val)) {
                            setPrimaryColor(val);
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <div style={styles.colorPickerGroup}>
                  <label style={styles.colorLabel}>Secondary Color</label>
                  <div style={styles.colorInputContainer}>
                    <input type="color" style={styles.colorDot}
                      value={darkLightMode === 'both' && activeColorTab === 'light' ? lightSecondaryColor : secondaryColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (darkLightMode === 'both' && activeColorTab === 'light') {
                          setLightSecondaryColor(val);
                          setLightSecondaryColorInput(val);
                        } else {
                          setSecondaryColor(val);
                          setSecondaryColorInput(val);
                        }
                      }}
                    />
                    <input type="text" style={styles.colorText}
                      value={darkLightMode === 'both' && activeColorTab === 'light' ? lightSecondaryColorInput : secondaryColorInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (darkLightMode === 'both' && activeColorTab === 'light') {
                          setLightSecondaryColorInput(val);
                          if (/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(val)) {
                            setLightSecondaryColor(val);
                          }
                        } else {
                          setSecondaryColorInput(val);
                          if (/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(val)) {
                            setSecondaryColor(val);
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <div style={styles.colorPickerGroup}>
                  <label style={styles.colorLabel}>Background Color</label>
                  <div style={styles.colorInputContainer}>
                    <input type="color" style={styles.colorDot}
                      value={darkLightMode === 'both' && activeColorTab === 'light' ? lightBackgroundColor : backgroundColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (darkLightMode === 'both' && activeColorTab === 'light') {
                          setLightBackgroundColor(val);
                          setLightBackgroundColorInput(val);
                        } else {
                          setBackgroundColor(val);
                          setBackgroundColorInput(val);
                        }
                      }}
                    />
                    <input type="text" style={styles.colorText}
                      value={darkLightMode === 'both' && activeColorTab === 'light' ? lightBackgroundColorInput : backgroundColorInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (darkLightMode === 'both' && activeColorTab === 'light') {
                          setLightBackgroundColorInput(val);
                          if (/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(val)) {
                            setLightBackgroundColor(val);
                          }
                        } else {
                          setBackgroundColorInput(val);
                          if (/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(val)) {
                            setBackgroundColor(val);
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <div style={styles.colorPickerGroup}>
                  <label style={styles.colorLabel}>Text Color</label>
                  <div style={styles.colorInputContainer}>
                    <input type="color" style={styles.colorDot}
                      value={darkLightMode === 'both' && activeColorTab === 'light' ? lightTextColor : textColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (darkLightMode === 'both' && activeColorTab === 'light') {
                          setLightTextColor(val);
                          setLightTextColorInput(val);
                        } else {
                          setTextColor(val);
                          setTextColorInput(val);
                        }
                      }}
                    />
                    <input type="text" style={styles.colorText}
                      value={darkLightMode === 'both' && activeColorTab === 'light' ? lightTextColorInput : textColorInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (darkLightMode === 'both' && activeColorTab === 'light') {
                          setLightTextColorInput(val);
                          if (/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(val)) {
                            setLightTextColor(val);
                          }
                        } else {
                          setTextColorInput(val);
                          if (/^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/.test(val)) {
                            setTextColor(val);
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                {/* Typography Settings Group */}
                <div style={styles.guiCard}>
                  <div style={styles.guiCardHeader}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                      <polyline points="4 7 4 4 20 4 20 7"/>
                      <line x1="9" y1="20" x2="15" y2="20"/>
                      <line x1="12" y1="4" x2="12" y2="20"/>
                    </svg>
                    <span>Typography & Fonts</span>
                  </div>
                  <div style={styles.guiCardBody}>
                    <div style={styles.formGroupCompact}>
                      <label style={styles.labelCompact}>Primary Font</label>
                      <input type="text" style={styles.inputCompact} value={primaryFont}
                        onChange={(e) => setPrimaryFont(e.target.value)} placeholder="e.g. Din Round, Inter"
                      />
                    </div>
                    <div style={styles.formGroupCompact}>
                      <label style={styles.labelCompact}>Secondary Font</label>
                      <input type="text" style={styles.inputCompact} value={secondaryFont}
                        onChange={(e) => setSecondaryFont(e.target.value)} placeholder="e.g. Feather, Outfit"
                      />
                    </div>
                  </div>
                </div>

                {/* Layout & Spacing Group */}
                <div style={styles.guiCard}>
                  <div style={styles.guiCardHeader}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                      <rect x="3" y="3" width="18" height="18" rx="2"/>
                      <line x1="9" y1="3" x2="9" y2="21"/>
                      <line x1="15" y1="3" x2="15" y2="21"/>
                    </svg>
                    <span>Layout & Spacing</span>
                  </div>
                  <div style={styles.guiCardBody}>
                    <div style={styles.formGroupCompact}>
                      <label style={styles.labelCompact}>Base Spacing Unit</label>
                      <input type="text" style={styles.inputCompact} value={baseSpacing}
                        onChange={(e) => setBaseSpacing(e.target.value)} placeholder="e.g. 8px"
                      />
                    </div>
                    <div style={styles.formGroupCompact}>
                      <label style={styles.labelCompact}>Container Max Width</label>
                      <input type="text" style={styles.inputCompact} value={containerMaxWidth}
                        onChange={(e) => setContainerMaxWidth(e.target.value)} placeholder="e.g. 1200px"
                      />
                    </div>
                  </div>
                </div>

                {/* Component styling & Depth Group */}
                <div style={styles.guiCard}>
                  <div style={styles.guiCardHeader}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fdba74" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                      <polyline points="2 17 12 22 22 17"/>
                      <polyline points="2 12 12 17 22 12"/>
                    </svg>
                    <span>Components & Depth</span>
                  </div>
                  <div style={styles.guiCardBody}>
                    <div style={styles.formGroupCompact}>
                      <label style={styles.labelCompact}>Button Height</label>
                      <input type="text" style={styles.inputCompact} value={buttonHeight}
                        onChange={(e) => setButtonHeight(e.target.value)} placeholder="e.g. 50px, 44px"
                      />
                    </div>
                    <div style={styles.formGroupCompact}>
                      <label style={styles.labelCompact}>Card Padding</label>
                      <input type="text" style={styles.inputCompact} value={cardPadding}
                        onChange={(e) => setCardPadding(e.target.value)} placeholder="e.g. 24px"
                      />
                    </div>
                    <div style={{ ...styles.formGroupCompact, gridColumn: 'span 2' }}>
                      <label style={styles.labelCompact}>Card Shadow Treatment</label>
                      <input type="text" style={styles.inputCompact} value={cardShadow}
                        onChange={(e) => setCardShadow(e.target.value)} placeholder="e.g. 0px 2px 8px rgba(0,0,0,0.04)"
                      />
                    </div>
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Border Radius</label>
                  <input type="text" style={styles.input} value={borderRadius}
                    onChange={(e) => setBorderRadius(e.target.value)} placeholder="e.g. 0.5rem, 8px"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Dark / Light Mode Enforced Rules</label>
                  <div ref={modeDropdownRef} style={styles.customDropdownContainer}>
                    <button style={styles.dropdownTrigger} onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}>
                      <span>{modeOptions.find((opt) => opt.value === darkLightMode)?.label || ''}</span>
                      <span style={{ transform: isModeDropdownOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s ease', display: 'inline-block', fontSize: '9px', opacity: 0.6 }}>▼</span>
                    </button>
                    {isModeDropdownOpen && (
                      <div style={{ ...styles.dropdownMenu, zIndex: 1000 }}>
                        {modeOptions.map((opt) => {
                          const isActive = darkLightMode === opt.value;
                          const isHovered = hoveredModeOption === opt.value;
                          return (
                            <button
                              key={opt.value}
                              style={{
                                ...styles.dropdownOption,
                                backgroundColor: isActive ? '#4f46e5' : isHovered ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                                color: isActive ? '#ffffff' : isHovered ? '#ffffff' : '#94a3b8',
                                fontWeight: isActive ? 600 : 500
                              }}
                              onMouseEnter={() => setHoveredModeOption(opt.value)}
                              onMouseLeave={() => setHoveredModeOption(null)}
                              onClick={() => { setDarkLightMode(opt.value as any); setIsModeDropdownOpen(false); }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* LIVE PREVIEW */}
              <div style={styles.previewContainer}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ ...styles.previewTitle, margin: 0 }}>Live Preview</h4>
                  {darkLightMode === 'both' && (
                    <div style={styles.previewToggle}>
                      <button
                        style={{ ...styles.previewToggleBtn, ...(previewMode === 'dark' ? styles.previewToggleBtnActive : {}) }}
                        onClick={() => setPreviewMode('dark')} title="Dark preview"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z"/>
                        </svg>
                      </button>
                      <button
                        style={{ ...styles.previewToggleBtn, ...(previewMode === 'light' ? styles.previewToggleBtnActiveLight : {}) }}
                        onClick={() => setPreviewMode('light')} title="Light preview"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="5"/>
                          <line x1="12" y1="1" x2="12" y2="3"/>
                          <line x1="12" y1="21" x2="12" y2="23"/>
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                          <line x1="1" y1="12" x2="3" y2="12"/>
                          <line x1="21" y1="12" x2="23" y2="12"/>
                          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                {(() => {
                  const useDark = darkLightMode === 'dark' || (darkLightMode === 'both' && previewMode === 'dark');
                  const pvBg   = useDark ? backgroundColor : (darkLightMode === 'both' ? lightBackgroundColor : backgroundColor);
                  const pvText = useDark ? textColor : (darkLightMode === 'both' ? lightTextColor : textColor);
                  const pvPri  = useDark ? primaryColor : (darkLightMode === 'both' ? lightPrimaryColor : primaryColor);
                  const pvSec  = useDark ? secondaryColor : (darkLightMode === 'both' ? lightSecondaryColor : secondaryColor);
                  const muted = useDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
                  const cardBg = useDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
                  const cardBorder = useDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
                  const r = borderRadius || '10px';
                  return (
                    <div
                      style={{
                        ...styles.previewCanvas,
                        backgroundColor: pvBg,
                        color: pvText,
                        borderRadius: r,
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div
                          title={activeWorkspace.name || 'Demo App'}
                          style={{
                            fontWeight: 700,
                            fontSize: '14px',
                            lineHeight: 1.25,
                            letterSpacing: '-0.02em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {activeWorkspace.name || 'Demo App'}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                          <span
                            style={{
                              ...styles.previewTag,
                              backgroundColor: `${pvPri}22`,
                              color: pvPri,
                              border: `1px solid ${pvPri}55`,
                            }}
                          >
                            Web App
                          </span>
                          <span
                            style={{
                              ...styles.previewTag,
                              backgroundColor: `${pvSec}22`,
                              color: pvSec,
                              border: `1px solid ${pvSec}55`,
                            }}
                          >
                            Live
                          </span>
                        </div>
                      </div>

                      <p
                        style={{
                          fontSize: '12px',
                          margin: 0,
                          lineHeight: 1.4,
                          color: muted,
                          fontWeight: 500,
                        }}
                      >
                        Updates live as you change design tokens.
                      </p>

                      <div
                        style={{
                          ...styles.previewCard,
                          backgroundColor: cardBg,
                          border: `1px solid ${cardBorder}`,
                          borderRadius: r,
                          padding: '9px 11px',
                          gap: '8px',
                        }}
                      >
                        <div style={{ ...styles.previewDot, backgroundColor: pvPri, width: 8, height: 8, flexShrink: 0 }} />
                        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ fontSize: '12.5px', fontWeight: 600, lineHeight: 1.3 }}>
                            Primary Component Action
                          </div>
                          <div style={{ fontSize: '11.5px', color: muted, lineHeight: 1.3, fontWeight: 500 }}>
                            Design token applied successfully.
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          style={{
                            ...styles.previewBtnPrimary,
                            backgroundColor: pvPri,
                            color: '#fff',
                            borderRadius: r,
                            height: '32px',
                            fontSize: '12px',
                          }}
                        >
                          Primary Button
                        </button>
                        <button
                          type="button"
                          style={{
                            ...styles.previewBtnSecondary,
                            borderColor: pvSec,
                            color: pvSec,
                            borderRadius: r,
                            height: '32px',
                            fontSize: '12px',
                            backgroundColor: 'transparent',
                          }}
                        >
                          Outline
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── Design System Markdown Spec Editor ── */}
            <div style={styles.designSystemEditorSection}>
              <div style={styles.editorToolbar}>
                <span style={styles.editorToolbarLabel}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, verticalAlign: 'middle', opacity: 0.7 }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  DESIGN_SYSTEM.md (Active Spec)
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className={`blueprint-sync-colors-btn${syncColorsRefreshing ? ' is-refreshing' : ''}`}
                    style={styles.editorToolbarBtn}
                    disabled={syncColorsRefreshing}
                    aria-busy={syncColorsRefreshing}
                    title={syncColorsRefreshing ? 'Syncing colors…' : 'Sync/Reset spec with active colors'}
                    onClick={() => {
                      if (syncColorsRefreshing) return;
                      const startedAt = Date.now();
                      const minSpinMs = 600;
                      setSyncColorsRefreshing(true);
                      try {
                        let brand = 'duolingo';
                        const lowerVision = designVision.toLowerCase();
                        for (const b of ['linear', 'vercel', 'stripe', 'glassmorphism', 'neon', 'pastel', 'brutal', 'minimal']) {
                          if (lowerVision.includes(b)) {
                            brand = b;
                            break;
                          }
                        }
                        setDesignSystemMarkdown(
                          getDesignSystemTemplate(
                            brand,
                            primaryColor,
                            secondaryColor,
                            backgroundColor,
                            textColor
                          )
                        );
                      } finally {
                        const wait = Math.max(0, minSpinMs - (Date.now() - startedAt));
                        window.setTimeout(() => setSyncColorsRefreshing(false), wait);
                      }
                    }}
                  >
                    <span className="blueprint-sync-colors-btn-icon-wrap" aria-hidden>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10"/>
                        <path d="M3.51 15a9 9 0 1 0 .49-3.42"/>
                      </svg>
                    </span>
                    <span className="blueprint-sync-colors-btn-label">Sync / Reset Colors</span>
                  </button>
                </div>
              </div>

              <textarea
                style={styles.designSystemMarkdownEditor}
                value={designSystemMarkdown}
                onChange={(e) => setDesignSystemMarkdown(e.target.value)}
                spellCheck={false}
                placeholder="Write your custom design system spec in markdown..."
              />

              <div style={styles.editorStatusBar}>
                <span style={{ color: '#d4d4d8', fontWeight: 600 }}>Markdown Spec</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: '16px', color: '#a1a1aa' }}>
                  <span>{designSystemMarkdown.split('\n').length} lines</span>
                  <span>{designSystemMarkdown.length} chars</span>
                </span>
              </div>
            </div>
          </div>
        )}



        {/* ARCHITECTURE & TECH STACK TAB */}
        {activeSubTab === 'stack' && (
          <div style={styles.formSection}>

            {/* ── Project Goals & Scope ── */}
            <div style={styles.stackSection}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                  <path d="m9 12 2 2 4-4"/>
                </svg>
                <span style={{ ...styles.stackSectionTitle, color: '#7dd3fc' }}>Project Goals & Scope</span>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Identity & Goals</label>
                <textarea
                  style={{
                    ...styles.input,
                    height: '70px',
                    padding: '8px 10px',
                    fontFamily: 'inherit',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    resize: 'vertical'
                  }}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="e.g. cafecore is a coffee shop ordering system..."
                />
              </div>

              <div style={{ ...styles.formGroup, marginBottom: 0 }}>
                <label style={styles.label}>MVP Scope</label>
                <textarea
                  style={{
                    ...styles.input,
                    height: '90px',
                    padding: '8px 10px',
                    fontFamily: 'inherit',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    resize: 'vertical'
                  }}
                  value={mvpScope}
                  onChange={(e) => setMvpScope(e.target.value)}
                  placeholder="e.g. - Menu selection&#10;- Checkout flow&#10;- Employee Dashboard"
                />
              </div>
            </div>

            {/* ── Fullstack Quick Presets ── */}
            <div style={styles.stackSection}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                  <polyline points="2 17 12 22 22 17"/>
                  <polyline points="2 12 12 17 22 12"/>
                </svg>
                <span style={styles.stackSectionTitle}>Fullstack Presets</span>
                <span style={{ ...styles.stackHint, marginLeft: '4px' }}>— pick a combo to auto-fill everything</span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {/* Next.js + Express */}
                <button
                  style={{
                    background: activeStackPreset === 'nextjs-express'
                      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(6, 182, 212, 0.15))'
                      : '#18181b',
                    border: activeStackPreset === 'nextjs-express'
                      ? '1px solid rgba(99, 102, 241, 0.4)'
                      : '1px solid #27272a',
                    borderRadius: '8px',
                    color: activeStackPreset === 'nextjs-express' ? '#c7d2fe' : '#d4d4d8',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '7px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    fontFamily: 'Outfit, Inter, sans-serif'
                  }}
                  onClick={() => {
                    const fe = FRONTEND_TEMPLATES['nextjs'];
                    const be = BACKEND_TEMPLATES['express'];
                    setFrontendStack(fe.tech); setUiFramework(fe.ui); setNamingConventions(fe.conventions);
                    setBackendStack(be.tech); setApiStyle(be.api); setDatabase('PostgreSQL (Prisma)');
                    setFolderStructureBlueprint(mergeFolderStructures('nextjs', 'express'));
                    setActiveStackPreset('nextjs-express');
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>
                  Next.js + Express
                </button>

                {/* Next.js + Supabase */}
                <button
                  style={{
                    background: activeStackPreset === 'nextjs-supabase'
                      ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(16, 185, 129, 0.15))'
                      : '#18181b',
                    border: activeStackPreset === 'nextjs-supabase'
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : '1px solid #27272a',
                    borderRadius: '8px',
                    color: activeStackPreset === 'nextjs-supabase' ? '#a7f3d0' : '#d4d4d8',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '7px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    fontFamily: 'Outfit, Inter, sans-serif'
                  }}
                  onClick={() => {
                    const fe = FRONTEND_TEMPLATES['nextjs'];
                    const be = BACKEND_TEMPLATES['supabase'];
                    setFrontendStack(fe.tech); setUiFramework(fe.ui); setNamingConventions(fe.conventions);
                    setBackendStack(be.tech); setApiStyle(be.api); setDatabase('Supabase PostgreSQL');
                    setFolderStructureBlueprint(mergeFolderStructures('nextjs', 'supabase'));
                    setActiveStackPreset('nextjs-supabase');
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                  Next.js + Supabase
                </button>

                {/* Vite + FastAPI */}
                <button
                  style={{
                    background: activeStackPreset === 'vite-fastapi'
                      ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(139, 92, 246, 0.15))'
                      : '#18181b',
                    border: activeStackPreset === 'vite-fastapi'
                      ? '1px solid rgba(251, 191, 36, 0.4)'
                      : '1px solid #27272a',
                    borderRadius: '8px',
                    color: activeStackPreset === 'vite-fastapi' ? '#fde68a' : '#d4d4d8',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '7px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    fontFamily: 'Outfit, Inter, sans-serif'
                  }}
                  onClick={() => {
                    const fe = FRONTEND_TEMPLATES['viteReact'];
                    const be = BACKEND_TEMPLATES['fastapi'];
                    setFrontendStack(fe.tech); setUiFramework(fe.ui); setNamingConventions(fe.conventions);
                    setBackendStack(be.tech); setApiStyle(be.api); setDatabase('SQLite / PostgreSQL (SQLAlchemy)');
                    setFolderStructureBlueprint(mergeFolderStructures('viteReact', 'fastapi'));
                    setActiveStackPreset('vite-fastapi');
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Vite React + FastAPI
                </button>

                {/* Vite + NestJS */}
                <button
                  style={{
                    background: activeStackPreset === 'vite-nestjs'
                      ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(99, 102, 241, 0.15))'
                      : '#18181b',
                    border: activeStackPreset === 'vite-nestjs'
                      ? '1px solid rgba(236, 72, 153, 0.4)'
                      : '1px solid #27272a',
                    borderRadius: '8px',
                    color: activeStackPreset === 'vite-nestjs' ? '#fbcfe8' : '#d4d4d8',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '7px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    fontFamily: 'Outfit, Inter, sans-serif'
                  }}
                  onClick={() => {
                    const fe = FRONTEND_TEMPLATES['viteReact'];
                    const be = BACKEND_TEMPLATES['nestjs'];
                    setFrontendStack(fe.tech); setUiFramework(fe.ui); setNamingConventions(fe.conventions);
                    setBackendStack(be.tech); setApiStyle(be.api); setDatabase('PostgreSQL (TypeORM)');
                    setFolderStructureBlueprint(mergeFolderStructures('viteReact', 'nestjs'));
                    setActiveStackPreset('vite-nestjs');
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
                  Vite React + NestJS
                </button>

                {/* Vanilla HTML */}
                <button
                  style={{
                    background: activeStackPreset === 'vanilla'
                      ? 'linear-gradient(135deg, rgba(251, 146, 60, 0.2), rgba(234, 88, 12, 0.15))'
                      : '#18181b',
                    border: activeStackPreset === 'vanilla'
                      ? '1px solid rgba(251, 146, 60, 0.4)'
                      : '1px solid #27272a',
                    borderRadius: '8px',
                    color: activeStackPreset === 'vanilla' ? '#fed7aa' : '#d4d4d8',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '7px 14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    fontFamily: 'Outfit, Inter, sans-serif'
                  }}
                  onClick={() => {
                    const fe = FRONTEND_TEMPLATES['vanilla'];
                    setFrontendStack(fe.tech); setUiFramework(fe.ui); setNamingConventions(fe.conventions);
                    setBackendStack('None'); setApiStyle('None'); setDatabase('');
                    setFolderStructureBlueprint(fe.folder);
                    setActiveStackPreset('vanilla');
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                  Vanilla HTML/CSS/JS
                </button>
              </div>
            </div>

            {/* ── Individual Pickers (2 rows) ── */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '10px'
            }}>
              {/* Frontend picker */}
              <div style={{
                background: '#141416',
                border: '1px solid #27272a',
                borderRadius: '9px',
                padding: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="9" y1="21" x2="9" y2="9"/>
                  </svg>
                  <span style={{ ...styles.stackSectionTitle, color: '#a5b4fc' }}>Frontend</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Object.entries(FRONTEND_TEMPLATES).map(([key, item]) => {
                    const isActive = frontendStack === item.tech;
                    return (
                      <button
                        key={key}
                        type="button"
                        style={{
                          background: isActive ? '#1e1b4b' : '#18181b',
                          border: isActive ? '1px solid #4338ca' : '1px solid #27272a',
                          borderRadius: '7px',
                          padding: '8px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          textAlign: 'left',
                          fontFamily: 'Outfit, Inter, sans-serif',
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                        onClick={() => {
                          setFrontendStack(item.tech);
                          setUiFramework(item.ui);
                          setNamingConventions(item.conventions);
                          const merged = mergeFolderStructures(key, getBackendKeyFromStack(backendStack));
                          setFolderStructureBlueprint(merged);
                          setActiveStackPreset(null);
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '12.5px', fontWeight: 600, color: isActive ? '#c7d2fe' : '#e4e4e7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                          <div style={{ fontSize: '11.5px', color: isActive ? '#a5b4fc' : '#a1a1aa', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.ui}</div>
                        </div>
                        {isActive && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: '6px' }}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Backend picker */}
              <div style={{
                background: '#141416',
                border: '1px solid #27272a',
                borderRadius: '9px',
                padding: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                    <line x1="6" y1="6" x2="6.01" y2="6"/>
                    <line x1="6" y1="18" x2="6.01" y2="18"/>
                  </svg>
                  <span style={{ ...styles.stackSectionTitle, color: '#4ade80' }}>Backend</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Object.entries(BACKEND_TEMPLATES).map(([key, item]) => {
                    const isActive = backendStack === item.tech;
                    return (
                      <button
                        key={key}
                        type="button"
                        style={{
                          background: isActive ? '#0f1f1a' : '#18181b',
                          border: isActive ? '1px solid #166534' : '1px solid #27272a',
                          borderRadius: '7px',
                          padding: '8px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          textAlign: 'left',
                          fontFamily: 'Outfit, Inter, sans-serif',
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                        onClick={() => {
                          setBackendStack(item.tech);
                          setApiStyle(item.api);
                          if (key === 'express') setDatabase('PostgreSQL (Prisma)');
                          else if (key === 'nestjs') setDatabase('PostgreSQL (TypeORM)');
                          else if (key === 'fastapi') setDatabase('SQLite / PostgreSQL (SQLAlchemy)');
                          else if (key === 'supabase') setDatabase('Supabase PostgreSQL');
                          else setDatabase('');
                          const merged = mergeFolderStructures(getFrontendKeyFromStack(frontendStack), key);
                          setFolderStructureBlueprint(merged);
                          setActiveStackPreset(null);
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: isActive ? '#a7f3d0' : '#e4e4e7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                          <div style={{ fontSize: '11.5px', color: isActive ? '#4ade80' : '#a1a1aa', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.api}</div>
                        </div>
                        {isActive && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: '6px' }}>
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Tech Stack Details ── */}
            <div style={styles.stackSection}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                <span style={styles.stackSectionTitle}>Stack Configuration</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Frontend Stack</label>
                  <input type="text" style={styles.input} value={frontendStack} onChange={(e) => setFrontendStack(e.target.value)} placeholder="e.g. Next.js 15, TypeScript" />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Backend Stack</label>
                  <input type="text" style={styles.input} value={backendStack} onChange={(e) => setBackendStack(e.target.value)} placeholder="e.g. Express, FastAPI" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Database</label>
                  <input type="text" style={styles.input} value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="PostgreSQL" />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>UI Framework</label>
                  <input type="text" style={styles.input} value={uiFramework} onChange={(e) => setUiFramework(e.target.value)} placeholder="Tailwind CSS" />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>API Style</label>
                  <input type="text" style={styles.input} value={apiStyle} onChange={(e) => setApiStyle(e.target.value)} placeholder="REST API" />
                </div>
              </div>

              {/* Custom Stack Fields */}
              {customStackFields.map((field, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto', gap: '10px', alignItems: 'flex-end', marginTop: '10px' }}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Custom Stack Item</label>
                    <input
                      type="text"
                      style={styles.input}
                      value={field.key}
                      onChange={(e) => {
                        const updated = [...customStackFields];
                        updated[idx].key = e.target.value;
                        setCustomStackFields(updated);
                      }}
                      placeholder="e.g. Auth, Caching"
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Value</label>
                    <input
                      type="text"
                      style={styles.input}
                      value={field.value}
                      onChange={(e) => {
                        const updated = [...customStackFields];
                        updated[idx].value = e.target.value;
                        setCustomStackFields(updated);
                      }}
                      placeholder="e.g. Supabase Auth, Redis"
                    />
                  </div>
                  <button
                    onClick={() => {
                      setCustomStackFields(customStackFields.filter((_, i) => i !== idx));
                    }}
                    style={{
                      background: 'rgba(244, 63, 94, 0.15)',
                      border: '1px solid rgba(244, 63, 94, 0.3)',
                      borderRadius: '6px',
                      color: '#f43f5e',
                      height: '34px',
                      padding: '0 12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '1px',
                      transition: 'all 0.15s ease'
                    }}
                    title="Delete custom stack item"
                  >
                    ✕
                  </button>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  onClick={() => {
                    setCustomStackFields([...customStackFields, { key: '', value: '' }]);
                  }}
                  style={{
                    background: '#18181b',
                    border: '1px solid #27272a',
                    borderRadius: '6px',
                    color: '#d4d4d8',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '6px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Custom Stack Item
                </button>
              </div>
            </div>

            {/* ── Folder Structure Editor ── */}
            <div style={styles.stackMonoBox}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#141416',
                borderBottom: '1px solid #27272a'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7' }}>Folder & File Structure</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {activeWorkspace && (
                    <button
                      onClick={async () => {
                        try {
                          setScanLoading(true);
                          const tree = await scanActualFolderStructure(activeWorkspace.rootPath);
                          if (tree) {
                            setFolderStructureBlueprint(tree);
                          } else {
                            alert('Failed to scan workspace folder.');
                          }
                        } catch (err) {
                          alert('Error scanning workspace folder.');
                        } finally {
                          setScanLoading(false);
                        }
                      }}
                      style={{
                        background: '#18181b',
                        border: '1px solid #27272a',
                        borderRadius: '4px',
                        color: '#cbd5e1',
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '4px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        transition: 'all 0.12s'
                      }}
                      title="Scan the actual folder structure of your active workspace directory on disk"
                      disabled={scanLoading}
                    >
                      {scanLoading ? 'Scanning...' : 'Scan Actual Folder'}
                    </button>
                  )}
                  <span style={{ fontSize: '11.5px', color: '#a1a1aa', fontWeight: 500 }}>
                    {folderStructureBlueprint.split('\n').length} lines
                  </span>
                </div>
              </div>
              <textarea
                style={{
                  width: '100%',
                  minHeight: '180px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#e4e4e7',
                  fontSize: '12px',
                  fontFamily: '"Fira Code", "Consolas", "Cascadia Code", monospace',
                  lineHeight: 1.65,
                  padding: '12px 14px',
                  resize: 'vertical',
                  outline: 'none',
                  overflowY: 'auto',
                  whiteSpace: 'pre',
                  tabSize: 2,
                  boxSizing: 'border-box'
                }}
                value={folderStructureBlueprint}
                onChange={(e) => setFolderStructureBlueprint(e.target.value)}
                placeholder="project-root/&#10;  src/&#10;    components/&#10;    pages/&#10;    services/"
                spellCheck={false}
              />
            </div>

            {/* ── Naming Conventions Editor ── */}
            <div style={styles.stackMonoBox}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: '#141416',
                borderBottom: '1px solid #27272a'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 7 4 4 20 4 20 7"/>
                    <line x1="9" y1="20" x2="15" y2="20"/>
                    <line x1="12" y1="4" x2="12" y2="20"/>
                  </svg>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#e4e4e7' }}>Naming Conventions</span>
                </div>
              </div>
              <textarea
                style={{
                  width: '100%',
                  minHeight: '100px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#e4e4e7',
                  fontSize: '12px',
                  fontFamily: '"Fira Code", "Consolas", "Cascadia Code", monospace',
                  lineHeight: 1.65,
                  padding: '12px 14px',
                  resize: 'vertical',
                  outline: 'none',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  tabSize: 2,
                  boxSizing: 'border-box'
                }}
                value={namingConventions}
                onChange={(e) => setNamingConventions(e.target.value)}
                placeholder="- Components: PascalCase (UserCard.tsx)&#10;- Hooks: camelCase with 'use' prefix (useAuth.ts)&#10;- Files & folders: kebab-case (user-card/)"
                spellCheck={false}
              />
            </div>

            {/* ── Environment & AI Rules ── */}
            <div style={styles.stackSection}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <span style={{ ...styles.stackSectionTitle, color: '#fb7185' }}>Environment & Guardrails</span>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Required Environment Variables</label>
                <textarea
                  style={{
                    ...styles.input,
                    height: '70px',
                    padding: '8px 10px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    resize: 'vertical'
                  }}
                  value={envKeysText}
                  onChange={(e) => setEnvKeysText(e.target.value)}
                  placeholder="NEXT_PUBLIC_SUPABASE_URL=&#10;NEXT_PUBLIC_SUPABASE_ANON_KEY="
                />
              </div>

              <div style={{ ...styles.formGroup, marginBottom: 0 }}>
                <label style={styles.label}>Agent Rules & Guardrails</label>
                <textarea
                  style={{
                    ...styles.input,
                    height: '90px',
                    padding: '8px 10px',
                    fontFamily: 'inherit',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    resize: 'vertical'
                  }}
                  value={customAgentRules}
                  onChange={(e) => setCustomAgentRules(e.target.value)}
                  placeholder="e.g. - Never edit .env files&#10;- Ask before installing dependencies"
                />
              </div>
            </div>

            {/* ── Apply to Blueprint action bar ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                background: '#141416',
                border: '1px solid #27272a',
                borderRadius: '8px',
                padding: '8px 12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M12 20h9"/>
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                  </svg>
                  <span style={{ fontSize: '12px', color: '#d4d4d8', lineHeight: 1.2, fontWeight: 500 }}>
                    Apply stack to <strong style={{ color: '#f4f4f5', fontWeight: 600 }}>MEMORY.md</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '6px',
                      color: '#d4d4d8',
                      padding: '5px 10px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: 500,
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap'
                    }}
                    onClick={() => {
                      setFrontendStack(''); setBackendStack(''); setDatabase('');
                      setUiFramework(''); setApiStyle('');
                      setFolderStructureBlueprint(''); setNamingConventions('');
                      setProjectDescription(''); setMvpScope(''); setEnvKeysText(''); setCustomAgentRules('');
                      setActiveStackPreset(null);
                      setStackApplyStatus('idle');
                    }}
                  >
                    Clear Stack
                  </button>
                  <button
                    style={{
                      background: !frontendStack.trim() && !backendStack.trim()
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'linear-gradient(135deg, #4f46e5, #6366f1)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      padding: '5px 12px',
                      fontSize: '12px',
                      cursor: !frontendStack.trim() && !backendStack.trim() ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: !frontendStack.trim() && !backendStack.trim()
                        ? 'none'
                        : '0 2px 10px rgba(79, 70, 229, 0.25)',
                      transition: 'all 0.15s ease',
                      whiteSpace: 'nowrap',
                      opacity: !frontendStack.trim() && !backendStack.trim() ? 0.5 : 1
                    }}
                    disabled={!frontendStack.trim() && !backendStack.trim()}
                    onClick={async () => {
                      if (!frontendStack.trim() && !backendStack.trim()) return;
                      try {
                        const updatedMd = patchBlueprintWithArchitecture(blueprintMarkdown, {
                          frontendStack,
                          backendStack,
                          database,
                          uiFramework,
                          apiStyle,
                          folderStructure: folderStructureBlueprint,
                          namingConventions,
                          description: projectDescription,
                          mvpScope,
                          envKeys: envKeysText,
                          customAgentRules,
                          customFields: customStackFields
                        });
                        setBlueprintMarkdown(updatedMd);
                        setStackApplyStatus('applied');
                        setTimeout(() => setStackApplyStatus('idle'), 4000);
                        
                        // Automatically save the patched blueprint directly to files on disk
                        await handleSave(updatedMd);
                      } catch {
                        setStackApplyStatus('error');
                        setTimeout(() => setStackApplyStatus('idle'), 4000);
                      }
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Apply to Blueprint
                  </button>
                </div>
              </div>

              {/* Inline feedback toast */}
              {stackApplyStatus === 'applied' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#6ee7b7',
                  fontWeight: 500
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Architecture sections successfully patched and saved to MEMORY.md!
                </div>
              )}
              {stackApplyStatus === 'error' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#fca5a5',
                  fontWeight: 500
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  Failed to patch blueprint. Please check your markdown structure.
                </div>
              )}
            </div>

          </div>
        )}



        {/* WORKFLOW TAB */}
        {activeSubTab === 'workflow' && (
          <div style={styles.formSection}>
            <p style={styles.tabIntro}>
              Click the step name or command to edit. Delete: click trash once, then the checkmark (or cancel with ✕ / Esc).
            </p>

            <div style={styles.workflowStepsList}>
              {initSteps.map((step, idx) => {
                const isConfirmingDelete = confirmingDeleteStepId === step.id;
                return (
                <div key={step.id} style={styles.stepCard} data-workflow-step-id={step.id}>
                  <div style={styles.stepHeader}>
                    <div style={styles.stepLabelContainer}>
                      <span style={styles.stepBadge}>{idx + 1}</span>
                      <input
                        type="text"
                        style={styles.stepInputLabel}
                        value={step.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInitSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, label: val } : s)));
                        }}
                        placeholder="Step name…"
                        title="Click to rename this step"
                        aria-label={`Step ${idx + 1} name`}
                      />
                    </div>
                    <div
                      className={`workflow-step-actions${isConfirmingDelete ? ' confirming' : ''}`}
                      data-step-actions
                    >
                      <label
                        className="workflow-step-enabled"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          userSelect: 'none',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: step.enabled ? '#d4d4d8' : '#a1a1aa',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={step.enabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setInitSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, enabled: val } : s)));
                          }}
                        />
                        Enabled
                      </label>
                      <button
                        type="button"
                        className="workflow-step-cancel-btn"
                        title="Cancel delete"
                        aria-label="Cancel delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingDeleteStepId(null);
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="workflow-step-delete-btn"
                        title={isConfirmingDelete ? 'Click again to confirm delete' : 'Delete this step'}
                        aria-label={isConfirmingDelete ? `Confirm delete step ${idx + 1}` : `Delete step ${idx + 1}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isConfirmingDelete) {
                            setInitSteps((prev) => prev.filter((s) => s.id !== step.id));
                            setConfirmingDeleteStepId(null);
                          } else {
                            setConfirmingDeleteStepId(step.id);
                          }
                        }}
                      >
                        <svg className="trash-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                        <svg className="confirm-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div style={styles.stepBody}>
                    <input
                      type="text"
                      style={styles.stepInputCmd}
                      value={step.command}
                      onChange={(e) => {
                        const val = e.target.value;
                        setInitSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, command: val } : s)));
                      }}
                      placeholder="Shell command, e.g. npm install"
                      title="Click to edit command"
                      aria-label={`Step ${idx + 1} command`}
                      spellCheck={false}
                    />
                    <button
                      type="button"
                      style={{
                        ...styles.stepRunBtn,
                        backgroundColor:
                          step.status === 'running'
                            ? '#d97706'
                            : step.status === 'completed'
                              ? '#059669'
                              : step.enabled
                                ? '#3f3f46'
                                : '#27272a',
                        color: step.enabled ? '#f4f4f5' : '#71717a',
                        cursor: step.enabled ? 'pointer' : 'not-allowed',
                      }}
                      disabled={!step.enabled || step.status === 'running'}
                      onClick={() => executeStep(step)}
                    >
                      {step.status === 'running' ? 'Running…' : step.status === 'completed' ? '✓ Re-Run' : '▶ Run in Pane'}
                    </button>
                  </div>
                </div>
                );
              })}
            </div>

            <button
              type="button"
              style={styles.addStepBtn}
              onClick={() => {
                setConfirmingDeleteStepId(null);
                const newStep: ProjectInitStep = {
                  id: String(Date.now()),
                  label: 'Custom Setup Step',
                  command: '',
                  enabled: true,
                  status: 'pending'
                };
                setInitSteps((prev) => [...prev, newStep]);
              }}
            >
              + Add New Step
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Styles
// Project Init Blueprint chrome — crisp-text-dark-ui
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#121214',
    color: '#e4e4e7',
    fontFamily: 'Outfit, Inter, sans-serif',
    borderRadius: '12px',
    border: '1px solid #27272a',
    overflow: 'hidden',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    textRendering: 'optimizeLegibility',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '14px 16px 12px',
    borderBottom: '1px solid #27272a',
    backgroundColor: '#0d0d0f',
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    color: '#f4f4f5',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: '12px',
    color: '#a1a1aa',
    lineHeight: 1.45,
    fontWeight: 500,
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexShrink: 0,
  },
  resetBtn: {
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '7px',
    color: '#d4d4d8',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 500,
  },
  syncBtn: {
    backgroundColor: '#1e1b4b',
    border: '1px solid #4338ca',
    borderRadius: '7px',
    color: '#c7d2fe',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 600,
    fontFamily: 'Outfit, Inter, sans-serif',
  },
  saveBtn: {
    backgroundColor: '#4f46e5',
    border: '1px solid #6366f1',
    borderRadius: '7px',
    color: '#ffffff',
    padding: '6px 14px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  successToast: {
    margin: '0 16px',
    padding: '8px 12px',
    backgroundColor: '#0f1f1a',
    border: '1px solid #166534',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 500,
    color: '#4ade80',
    flexShrink: 0,
  },
  tabSelectorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 16px',
    borderBottom: '1px solid #27272a',
    backgroundColor: '#0d0d0f',
    flexShrink: 0,
  },
  tabSelectorLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#a1a1aa',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  customDropdownContainer: {
    position: 'relative',
    flex: 1,
    minWidth: 0,
  },
  dropdownTrigger: {
    width: '100%',
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    color: '#f4f4f5',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontFamily: 'Outfit, Inter, sans-serif',
    boxSizing: 'border-box',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1c',
    border: '1px solid #3f3f46',
    borderRadius: '10px',
    padding: '4px',
    zIndex: 999,
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.55)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    overflowY: 'auto',
    maxHeight: '220px',
  },
  dropdownOption: {
    border: 'none',
    borderRadius: '7px',
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'Outfit, Inter, sans-serif',
  },
  panelContent: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },

  // ── Blueprint markdown editor ──────────────────────────────────────
  blueprintEditorSection: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    padding: '12px 16px 16px',
  },
  editorToolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  editorToolbarLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#d4d4d8',
    letterSpacing: '0.03em',
    display: 'flex',
    alignItems: 'center',
  },
  editorToolbarBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#18181b',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    color: '#d4d4d8',
    fontSize: '12px',
    fontWeight: 600,
    padding: '6px 10px',
    cursor: 'pointer',
    fontFamily: 'Outfit, Inter, sans-serif',
    lineHeight: 1.2,
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  },
  markdownEditor: {
    flex: 1,
    minHeight: '420px',
    backgroundColor: '#0d0d0f',
    border: '1px solid #27272a',
    borderRadius: '10px',
    color: '#e4e4e7',
    fontSize: '13px',
    fontFamily: '"Fira Code", "Consolas", "Cascadia Code", monospace',
    lineHeight: 1.7,
    padding: '14px 16px',
    resize: 'vertical',
    outline: 'none',
    overflowY: 'auto',
    whiteSpace: 'pre',
    tabSize: 2,
  },
  editorStatusBar: {
    display: 'flex',
    alignItems: 'center',
    marginTop: '8px',
    padding: '6px 10px',
    fontSize: '11.5px',
    fontWeight: 500,
    color: '#a1a1aa',
    letterSpacing: '0.02em',
    backgroundColor: '#141416',
    border: '1px solid #27272a',
    borderRadius: '8px',
  },

  // ── Theme tab — crisp-text-dark-ui ────────────────────────────────
  formSection: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    flex: 1,
  },
  visionCard: {
    background: '#141416',
    border: '1px solid #27272a',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  visionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  visionHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  visionTitle: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#e4e4e7',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  visionHint: {
    fontSize: '12px',
    color: '#a1a1aa',
    fontWeight: 500,
    lineHeight: 1.45,
  },
  visionTextarea: {
    background: '#0d0d0f',
    border: '1px solid #27272a',
    borderRadius: '8px',
    color: '#e4e4e7',
    fontSize: '12.5px',
    fontFamily: 'Outfit, Inter, sans-serif',
    lineHeight: 1.55,
    padding: '10px 12px',
    resize: 'none',
    outline: 'none',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px',
  },
  chipLabel: {
    fontSize: '11px',
    color: '#a1a1aa',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  chip: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '100px',
    color: '#d4d4d8',
    fontSize: '11.5px',
    fontWeight: 500,
    padding: '4px 10px',
    cursor: 'pointer',
    fontFamily: 'Outfit, Inter, sans-serif',
  },
  autoFillBtn: {
    display: 'flex',
    alignItems: 'center',
    background: '#1e1b4b',
    border: '1px solid #4338ca',
    borderRadius: '7px',
    color: '#c7d2fe',
    fontSize: '12px',
    fontWeight: 600,
    padding: '5px 12px',
    cursor: 'pointer',
    fontFamily: 'Outfit, Inter, sans-serif',
  },
  autoFillBtnDone: {
    background: '#0f1f1a',
    borderColor: '#166534',
    color: '#4ade80',
  },
  sendAgentBtn: {
    display: 'flex',
    alignItems: 'center',
    background: '#4f46e5',
    border: '1px solid #6366f1',
    borderRadius: '7px',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 600,
    padding: '6px 12px',
    cursor: 'pointer',
    fontFamily: 'Outfit, Inter, sans-serif',
  },
  designSystemEditorSection: {
    display: 'flex',
    flexDirection: 'column',
    marginTop: '16px',
    borderTop: '1px solid #27272a',
    paddingTop: '16px',
  },
  designSystemMarkdownEditor: {
    minHeight: '320px',
    backgroundColor: '#0d0d0f',
    border: '1px solid #27272a',
    borderRadius: '10px',
    color: '#e4e4e7',
    fontSize: '12.5px',
    fontFamily: '"Fira Code", "Consolas", "Cascadia Code", monospace',
    lineHeight: 1.6,
    padding: '14px 16px',
    resize: 'vertical',
    outline: 'none',
    overflowY: 'auto',
  },
  themeGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: '16px',
  },
  colorConfig: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  colorTabBar: {
    display: 'flex',
    gap: '4px',
    backgroundColor: '#18181b',
    borderRadius: '8px',
    padding: '3px',
    marginBottom: '2px',
    border: '1px solid #27272a',
  },
  colorTabBtn: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#a1a1aa',
    fontSize: '11.5px',
    fontWeight: 600,
    padding: '6px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    letterSpacing: '0.02em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorTabBtnActive: {
    backgroundColor: '#1e1b4b',
    color: '#c7d2fe',
  },
  colorTabBtnActiveLight: {
    backgroundColor: '#422006',
    color: '#fcd34d',
  },
  colorPickerGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  colorLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  colorInputContainer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  colorDot: {
    width: '40px',
    height: '34px',
    border: '1px solid #3f3f46',
    borderRadius: '7px',
    padding: '2px',
    cursor: 'pointer',
    backgroundColor: 'transparent',
  },
  colorText: {
    flex: 1,
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '7px',
    color: '#f4f4f5',
    fontSize: '13px',
    fontWeight: 500,
    padding: '6px 10px',
    outline: 'none',
    fontFamily: 'ui-monospace, Consolas, Monaco, monospace',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    color: '#f4f4f5',
    fontSize: '13px',
    fontWeight: 500,
    padding: '8px 12px',
    outline: 'none',
    fontFamily: 'Outfit, Inter, sans-serif',
  },
  previewContainer: {
    display: 'flex',
    flexDirection: 'column',
    padding: '12px',
    backgroundColor: '#141416',
    borderRadius: '10px',
    border: '1px solid #27272a',
    minWidth: 0,
  },
  previewTitle: {
    fontSize: '11px',
    fontWeight: 700,
    margin: '0 0 8px 0',
    color: '#d4d4d8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  previewCanvas: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
    border: '1px solid #27272a',
    minHeight: 0,
    minWidth: 0,
    boxSizing: 'border-box',
    /* content-sized — no forced tall empty area */
    height: 'auto',
  },
  previewHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minWidth: 0,
  },
  previewTag: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: '999px',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  },
  previewCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    minWidth: 0,
  },
  previewDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  previewBtnPrimary: {
    flex: 1,
    border: 'none',
    padding: '0 12px',
    fontSize: '12.5px',
    fontWeight: 600,
    cursor: 'default',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBtnSecondary: {
    flex: 1,
    backgroundColor: 'transparent',
    border: '1.5px solid',
    padding: '0 12px',
    fontSize: '12.5px',
    fontWeight: 600,
    cursor: 'default',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewToggle: {
    display: 'flex',
    gap: '2px',
    backgroundColor: '#18181b',
    borderRadius: '6px',
    padding: '2px',
    border: '1px solid #27272a',
  },
  previewToggleBtn: {
    background: 'transparent',
    border: 'none',
    padding: '4px 7px',
    borderRadius: '4px',
    cursor: 'pointer',
    lineHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#a1a1aa',
  },
  previewToggleBtnActive: { backgroundColor: '#1e1b4b', color: '#c7d2fe' },
  previewToggleBtnActiveLight: { backgroundColor: '#422006', color: '#fcd34d' },

  // ── Architecture / stack tab — crisp-text-dark-ui ─────────────────
  stackSection: {
    background: '#141416',
    border: '1px solid #27272a',
    borderRadius: '10px',
    padding: '14px',
  },
  stackSectionTitle: {
    fontSize: '11px',
    fontWeight: 700,
    color: '#d4d4d8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  stackHint: {
    fontSize: '12px',
    color: '#a1a1aa',
    fontWeight: 500,
  },
  stackPresetChip: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    color: '#d4d4d8',
    fontSize: '12px',
    fontWeight: 600,
    padding: '7px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'Outfit, Inter, sans-serif',
  },
  stackChoiceCard: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '8px',
    padding: '10px 12px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  stackChoiceTitle: {
    fontSize: '12.5px',
    fontWeight: 600,
    color: '#e4e4e7',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stackChoiceSub: {
    fontSize: '11.5px',
    color: '#a1a1aa',
    marginTop: '2px',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  stackMonoBox: {
    background: '#0d0d0f',
    border: '1px solid #27272a',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  stackMonoHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: '#141416',
    borderBottom: '1px solid #27272a',
  },

  // ── Workflow tab ───────────────────────────────────────────────────
  tabIntro: {
    fontSize: '13px',
    color: '#a1a1aa',
    margin: '0 0 16px 0',
    lineHeight: 1.5,
  },
  workflowStepsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  stepCard: {
    backgroundColor: '#141416',
    border: '1px solid #27272a',
    borderRadius: '10px',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  stepHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
  },
  stepLabelContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    minWidth: 0,
  },
  stepBadge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    backgroundColor: '#1e1b4b',
    color: '#c7d2fe',
    border: '1px solid #4338ca',
    borderRadius: '50%',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0,
  },
  stepInputLabel: {
    backgroundColor: '#18181b',
    border: '1px solid #27272a',
    borderRadius: '6px',
    color: '#f4f4f5',
    fontSize: '13px',
    fontWeight: 600,
    outline: 'none',
    flex: 1,
    minWidth: 0,
    padding: '6px 10px',
    boxSizing: 'border-box',
  },
  stepBody: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  stepInputCmd: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#0d0d0f',
    border: '1px solid #27272a',
    borderRadius: '6px',
    padding: '8px 12px',
    color: '#f4f4f5',
    fontSize: '13px',
    fontFamily: 'ui-monospace, Consolas, Monaco, monospace',
    fontWeight: 500,
    outline: 'none',
    boxSizing: 'border-box',
  },
  stepRunBtn: {
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '12px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  addStepBtn: {
    backgroundColor: '#141416',
    color: '#d4d4d8',
    border: '1px dashed rgba(255, 255, 255, 0.14)',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'center',
  },

  // ── Empty state ────────────────────────────────────────────────────
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '40px',
    textAlign: 'center',
    color: '#94a3b8'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
    opacity: 0.6
  },
  guiCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  guiCardHeader: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '11px',
    fontWeight: 700,
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
    paddingBottom: '6px',
    marginBottom: '2px'
  },
  guiCardBody: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px 10px'
  },
  formGroupCompact: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px'
  },
  labelCompact: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#64748b'
  },
  inputCompact: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.07)',
    borderRadius: '6px',
    color: '#e2e8f0',
    fontSize: '12px',
    padding: '5px 8px',
    outline: 'none',
    fontFamily: 'Outfit, Inter, sans-serif',
    width: '100%',
    boxSizing: 'border-box'
  }
};

import { create } from 'zustand';

export type AgentDeckThemeMode = "light" | "dark" | "system";
export type AgentDeckMotionLevel = "none" | "subtle" | "balanced" | "expressive";

export type AgentDeckThemeTokens = {
  id: string;
  name: string;
  mode: AgentDeckThemeMode;
  isBuiltIn?: boolean;
  createdAt?: string;
  updatedAt?: string;

  colors: {
    background: string;
    backgroundSubtle: string;
    surface: string;
    surfaceHover: string;
    surfaceElevated: string;
    border: string;
    borderStrong: string;

    text: string;
    textMuted: string;
    textSubtle: string;
    textInverse: string;

    primary: string;
    primaryHover: string;
    primaryText: string;

    accent: string;
    accentHover: string;

    success: string;
    warning: string;
    danger: string;
    info: string;

    codeBackground: string;
    codeText: string;
  };

  typography: {
    fontFamily: string;
    monoFontFamily: string;
    fontSizeBase: string;
    fontSizeSm: string;
    fontSizeLg: string;
    fontWeightNormal: string;
    fontWeightMedium: string;
    fontWeightBold: string;
    lineHeightBase: string;
  };

  radius: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };

  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };

  shadow: {
    sm: string;
    md: string;
    lg: string;
  };

  motion: {
    enabled: boolean;
    level: AgentDeckMotionLevel;
    durationFast: string;
    durationBase: string;
    durationSlow: string;
    easing: string;
  };
};

// 1. Built-in Preset Themes
export const PRESET_THEMES: Record<string, AgentDeckThemeTokens> = {
  "spotify-dark": {
    id: "spotify-dark",
    name: "Spotify Dark (Default)",
    mode: "dark",
    isBuiltIn: true,
    colors: {
      background: "#121212",
      backgroundSubtle: "#181818",
      surface: "#282828",
      surfaceHover: "#3e3e3e",
      surfaceElevated: "#2d2d2d",
      border: "rgba(255, 255, 255, 0.08)",
      borderStrong: "rgba(255, 255, 255, 0.16)",
      text: "#ffffff",
      textMuted: "#b3b3b3",
      textSubtle: "#7f7f7f",
      textInverse: "#121212",
      primary: "#1db954",
      primaryHover: "#1ed760",
      primaryText: "#ffffff",
      accent: "#38bdf8",
      accentHover: "#0284c7",
      success: "#1db954",
      warning: "#fbbf24",
      danger: "#ef4444",
      info: "#3b82f6",
      codeBackground: "#181818",
      codeText: "#a1a1aa"
    },
    typography: {
      fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      monoFontFamily: "'JetBrains Mono', Consolas, monospace",
      fontSizeBase: "12px",
      fontSizeSm: "11px",
      fontSizeLg: "14px",
      fontWeightNormal: "400",
      fontWeightMedium: "500",
      fontWeightBold: "600",
      lineHeightBase: "1.5"
    },
    radius: {
      xs: "2px",
      sm: "4px",
      md: "6px",
      lg: "8px",
      xl: "12px",
      full: "9999px"
    },
    spacing: {
      xs: "4px",
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "24px"
    },
    shadow: {
      sm: "0 1px 2px 0 rgba(0, 0, 0, 0.5)",
      md: "0 4px 6px -1px rgba(0, 0, 0, 0.5)",
      lg: "0 10px 15px -3px rgba(0, 0, 0, 0.5)"
    },
    motion: {
      enabled: true,
      level: "balanced",
      durationFast: "0.15s",
      durationBase: "0.25s",
      durationSlow: "0.4s",
      easing: "cubic-bezier(0.4, 0, 0.2, 1)"
    }
  },

  "sunsama-warm": {
    id: "sunsama-warm",
    name: "Sunsama Warm",
    mode: "light",
    isBuiltIn: true,
    colors: {
      background: "#fcfbfa",
      backgroundSubtle: "#f5f4f0",
      surface: "#ebeae4",
      surfaceHover: "#dfded8",
      surfaceElevated: "#ffffff",
      border: "rgba(0, 0, 0, 0.08)",
      borderStrong: "rgba(0, 0, 0, 0.15)",
      text: "#2c2c2c",
      textMuted: "#6b6a65",
      textSubtle: "#9c9a94",
      textInverse: "#fcfbfa",
      primary: "#e26d5c",
      primaryHover: "#d95f4c",
      primaryText: "#ffffff",
      accent: "#4f772d",
      accentHover: "#3f5e24",
      success: "#38b000",
      warning: "#f5a623",
      danger: "#d90429",
      info: "#0077b6",
      codeBackground: "#f5f4f0",
      codeText: "#c15c3d"
    },
    typography: {
      fontFamily: "'Outfit', 'Inter', sans-serif",
      monoFontFamily: "'Fira Code', Consolas, monospace",
      fontSizeBase: "12px",
      fontSizeSm: "11px",
      fontSizeLg: "14px",
      fontWeightNormal: "400",
      fontWeightMedium: "500",
      fontWeightBold: "600",
      lineHeightBase: "1.5"
    },
    radius: {
      xs: "3px",
      sm: "5px",
      md: "8px",
      lg: "12px",
      xl: "18px",
      full: "9999px"
    },
    spacing: {
      xs: "5px",
      sm: "9px",
      md: "14px",
      lg: "18px",
      xl: "26px"
    },
    shadow: {
      sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
      md: "0 4px 6px -1px rgba(0, 0, 0, 0.08)",
      lg: "0 10px 15px -3px rgba(0, 0, 0, 0.12)"
    },
    motion: {
      enabled: true,
      level: "subtle",
      durationFast: "0.1s",
      durationBase: "0.2s",
      durationSlow: "0.3s",
      easing: "cubic-bezier(0.25, 0.8, 0.25, 1)"
    }
  },

  "duolingo-playful": {
    id: "duolingo-playful",
    name: "Duolingo Playful",
    mode: "light",
    isBuiltIn: true,
    colors: {
      background: "#ffffff",
      backgroundSubtle: "#f1f1f1",
      surface: "#e5e5e5",
      surfaceHover: "#d9d9d9",
      surfaceElevated: "#ffffff",
      border: "rgba(0, 0, 0, 0.1)",
      borderStrong: "rgba(0, 0, 0, 0.2)",
      text: "#3c3c3c",
      textMuted: "#777777",
      textSubtle: "#afafaf",
      textInverse: "#ffffff",
      primary: "#58cc02",
      primaryHover: "#46a302",
      primaryText: "#ffffff",
      accent: "#ffc800",
      accentHover: "#e6b400",
      success: "#58cc02",
      warning: "#ff9600",
      danger: "#ea2b2b",
      info: "#1cb0f6",
      codeBackground: "#f1f1f1",
      codeText: "#46a302"
    },
    typography: {
      fontFamily: "'Outfit', system-ui, sans-serif",
      monoFontFamily: "'JetBrains Mono', monospace",
      fontSizeBase: "12px",
      fontSizeSm: "11px",
      fontSizeLg: "14px",
      fontWeightNormal: "400",
      fontWeightMedium: "600",
      fontWeightBold: "800",
      lineHeightBase: "1.6"
    },
    radius: {
      xs: "4px",
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "22px",
      full: "9999px"
    },
    spacing: {
      xs: "6px",
      sm: "10px",
      md: "16px",
      lg: "20px",
      xl: "30px"
    },
    shadow: {
      sm: "0 2px 0px rgba(0,0,0,0.1)",
      md: "0 4px 0px rgba(0,0,0,0.15)",
      lg: "0 8px 0px rgba(0,0,0,0.15)"
    },
    motion: {
      enabled: true,
      level: "expressive",
      durationFast: "0.2s",
      durationBase: "0.35s",
      durationSlow: "0.55s",
      easing: "bounce-motion" // mapped visually in css transition
    }
  },

  "spotify-night": {
    id: "spotify-night",
    name: "Spotify Night (OLED)",
    mode: "dark",
    isBuiltIn: true,
    colors: {
      background: "#000000",
      backgroundSubtle: "#0a0a0a",
      surface: "#121212",
      surfaceHover: "#1c1c1c",
      surfaceElevated: "#181818",
      border: "rgba(255, 255, 255, 0.05)",
      borderStrong: "rgba(255, 255, 255, 0.12)",
      text: "#f4f4f5",
      textMuted: "#a1a1aa",
      textSubtle: "#52525b",
      textInverse: "#000000",
      primary: "#1db954",
      primaryHover: "#1ed760",
      primaryText: "#ffffff",
      accent: "#a855f7",
      accentHover: "#9333ea",
      success: "#22c55e",
      warning: "#eab308",
      danger: "#ef4444",
      info: "#3b82f6",
      codeBackground: "#0a0a0a",
      codeText: "#1db954"
    },
    typography: {
      fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
      monoFontFamily: "'JetBrains Mono', Consolas, monospace",
      fontSizeBase: "12px",
      fontSizeSm: "11px",
      fontSizeLg: "14px",
      fontWeightNormal: "400",
      fontWeightMedium: "500",
      fontWeightBold: "600",
      lineHeightBase: "1.5"
    },
    radius: {
      xs: "2px",
      sm: "4px",
      md: "6px",
      lg: "8px",
      xl: "12px",
      full: "9999px"
    },
    spacing: {
      xs: "4px",
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "24px"
    },
    shadow: {
      sm: "0 1px 2px 0 rgba(0, 0, 0, 0.8)",
      md: "0 4px 6px -1px rgba(0, 0, 0, 0.8)",
      lg: "0 10px 15px -3px rgba(0, 0, 0, 0.9)"
    },
    motion: {
      enabled: true,
      level: "balanced",
      durationFast: "0.15s",
      durationBase: "0.25s",
      durationSlow: "0.4s",
      easing: "cubic-bezier(0.4, 0, 0.2, 1)"
    }
  }
};

// 2. Global Helper to dynamically compile & inject Theme Custom Variables into the document <head>
export const applyThemeVariables = (theme: AgentDeckThemeTokens) => {
  if (typeof document === 'undefined') return;

  let styleEl = document.getElementById('agentdeck-theme-variables') as HTMLStyleElement;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'agentdeck-theme-variables';
    document.head.appendChild(styleEl);
  }

  // Handle Duolingo spring easing or default cubic bezier
  const easingValue = theme.motion.level === 'expressive' 
    ? 'cubic-bezier(0.34, 1.56, 0.64, 1)' 
    : theme.motion.easing;

  const rules = `
    :root {
      --bg-background: ${theme.colors.background};
      --bg-background-subtle: ${theme.colors.backgroundSubtle};
      --surf-surface: ${theme.colors.surface};
      --surf-surface-hover: ${theme.colors.surfaceHover};
      --surf-surface-elevated: ${theme.colors.surfaceElevated};
      --border-color: ${theme.colors.border};
      --border-strong: ${theme.colors.borderStrong};
      
      --text-color: ${theme.colors.text};
      --text-muted: ${theme.colors.textMuted};
      --text-subtle: ${theme.colors.textSubtle};
      --text-inverse: ${theme.colors.textInverse};
      
      --primary-color: ${theme.colors.primary};
      --primary-hover: ${theme.colors.primaryHover};
      --primary-text: ${theme.colors.primaryText};
      
      --accent-color: ${theme.colors.accent};
      --accent-hover: ${theme.colors.accentHover};
      
      --color-success: ${theme.colors.success};
      --color-warning: ${theme.colors.warning};
      --color-danger: ${theme.colors.danger};
      --color-info: ${theme.colors.info};
      
      --code-background: ${theme.colors.codeBackground};
      --code-text: ${theme.colors.codeText};
      
      --font-family: ${theme.typography.fontFamily};
      --font-family-mono: ${theme.typography.monoFontFamily};
      --font-size-base: ${theme.typography.fontSizeBase};
      --font-size-sm: ${theme.typography.fontSizeSm};
      --font-size-lg: ${theme.typography.fontSizeLg};
      --font-weight-normal: ${theme.typography.fontWeightNormal};
      --font-weight-medium: ${theme.typography.fontWeightMedium};
      --font-weight-bold: ${theme.typography.fontWeightBold};
      --line-height-base: ${theme.typography.lineHeightBase};
      
      --radius-xs: ${theme.radius.xs};
      --radius-sm: ${theme.radius.sm};
      --radius-md: ${theme.radius.md};
      --radius-lg: ${theme.radius.lg};
      --radius-xl: ${theme.radius.xl};
      --radius-full: ${theme.radius.full};
      
      --spacing-xs: ${theme.spacing.xs};
      --spacing-sm: ${theme.spacing.sm};
      --spacing-md: ${theme.spacing.md};
      --spacing-lg: ${theme.spacing.lg};
      --spacing-xl: ${theme.spacing.xl};
      
      --shadow-sm: ${theme.shadow.sm};
      --shadow-md: ${theme.shadow.md};
      --shadow-lg: ${theme.shadow.lg};
      
      --motion-duration-fast: ${theme.motion.enabled ? theme.motion.durationFast : '0s'};
      --motion-duration-base: ${theme.motion.enabled ? theme.motion.durationBase : '0s'};
      --motion-duration-slow: ${theme.motion.enabled ? theme.motion.durationSlow : '0s'};
      --motion-easing: ${easingValue};
    }
  `;
  styleEl.textContent = rules;
};

// 3. Smart Regex design parser for DESIGN.md / Figma context payload
export const parseThemeFromMarkdown = (markdown: string, themeName = "Imported Theme"): AgentDeckThemeTokens => {
  const defaultBase = PRESET_THEMES["spotify-dark"];
  
  // Regex patterns to match typical Hex code declarations in documents
  const hexPattern = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
  const allHexes = Array.from(new Set(markdown.match(hexPattern) || []));

  // Determine standard colors from matches or fallbacks
  let background = "#121212";
  let text = "#ffffff";
  let primary = "#38bdf8";
  let accent = "#a855f7";

  if (allHexes.length > 0) {
    // If background is defined explicitly in document, e.g. "Background: #0a0a0c"
    const bgMatch = markdown.match(/(?:background|bg|page|canvas|screen)\s*[:=-]\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})/i);
    const primaryMatch = markdown.match(/(?:primary|brand|main|highlight|accent-color)\s*[:=-]\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})/i);
    const textMatch = markdown.match(/(?:text|foreground|body|font-color)\s*[:=-]\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})/i);
    const accentMatch = markdown.match(/(?:accent|link|secondary)\s*[:=-]\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})/i);

    background = bgMatch ? bgMatch[1] : allHexes[0];
    primary = primaryMatch ? primaryMatch[1] : (allHexes[1] || "#38bdf8");
    text = textMatch ? textMatch[1] : (allHexes[2] || "#ffffff");
    accent = accentMatch ? accentMatch[1] : (allHexes[3] || "#fbbf24");
  }

  // Parse custom font-family or default to base system
  const fontMatch = markdown.match(/(?:font-family|font|typography|typeface)\s*[:=-]\s*['"]?([a-zA-Z\s,]+)['"]?/i);
  const fontFamily = fontMatch ? fontMatch[1].split(',')[0].trim() : defaultBase.typography.fontFamily;

  // Parse radius matching e.g. "border-radius: 8px" or "rounded: 12px"
  const radiusMatch = markdown.match(/(?:border-radius|radius|rounded)\s*[:=-]\s*([0-9]+px|[0-9]+rem)/i);
  const detectedRadiusVal = radiusMatch ? radiusMatch[1] : "6px";
  const numRadius = parseInt(detectedRadiusVal) || 6;

  // Determine light or dark mode based on background luminance
  // Calculate relative luminance: Y = 0.2126*R + 0.7152*G + 0.0722*B
  const isLight = (() => {
    let hex = background.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(x => x + x).join('');
    }
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luma > 128;
  })();

  // Intelligently synthesize a harmonic layout
  const backgroundSubtle = isLight ? "#f4f4f5" : "#1a1a1c";
  const surface = isLight ? "#e4e4e7" : "#27272a";
  const surfaceHover = isLight ? "#d4d4d8" : "#3f3f46";
  const surfaceElevated = isLight ? "#ffffff" : "#18181b";
  const border = isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.06)";
  const borderStrong = isLight ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";
  const textMuted = isLight ? "#71717a" : "#a1a1aa";
  const textSubtle = isLight ? "#a1a1aa" : "#52525b";
  const textInverse = isLight ? "#ffffff" : "#000000";

  return {
    id: `custom-imported-${Date.now()}`,
    name: themeName,
    mode: isLight ? "light" : "dark",
    colors: {
      background,
      backgroundSubtle,
      surface,
      surfaceHover,
      surfaceElevated,
      border,
      borderStrong,
      text,
      textMuted,
      textSubtle,
      textInverse,
      primary,
      primaryHover: primary, // fallback
      primaryText: isLight ? "#000000" : "#ffffff",
      accent,
      accentHover: accent,
      success: "#10b981",
      warning: "#f59e0b",
      danger: "#ef4444",
      info: "#3b82f6",
      codeBackground: backgroundSubtle,
      codeText: primary
    },
    typography: {
      fontFamily: fontFamily.includes("inherit") ? defaultBase.typography.fontFamily : fontFamily,
      monoFontFamily: defaultBase.typography.monoFontFamily,
      fontSizeBase: "12px",
      fontSizeSm: "11px",
      fontSizeLg: "14px",
      fontWeightNormal: "400",
      fontWeightMedium: "500",
      fontWeightBold: "700",
      lineHeightBase: "1.5"
    },
    radius: {
      xs: `${Math.max(1, Math.round(numRadius * 0.4))}px`,
      sm: `${Math.max(2, Math.round(numRadius * 0.7))}px`,
      md: `${numRadius}px`,
      lg: `${Math.round(numRadius * 1.4)}px`,
      xl: `${Math.round(numRadius * 2)}px`,
      full: "9999px"
    },
    spacing: defaultBase.spacing,
    shadow: {
      sm: isLight ? "0 1px 2px rgba(0,0,0,0.05)" : "0 1px 2px rgba(0,0,0,0.4)",
      md: isLight ? "0 4px 6px rgba(0,0,0,0.05)" : "0 4px 6px rgba(0,0,0,0.4)",
      lg: isLight ? "0 10px 15px rgba(0,0,0,0.08)" : "0 10px 15px rgba(0,0,0,0.5)"
    },
    motion: defaultBase.motion
  };
};

// 4. State Management Interface Store using Zustand
interface ThemeStore {
  activeThemeId: string;
  customThemes: AgentDeckThemeTokens[];
  activeTheme: AgentDeckThemeTokens;
  
  // Actions
  setTheme: (themeId: string) => void;
  saveCustomTheme: (theme: AgentDeckThemeTokens) => void;
  deleteCustomTheme: (themeId: string) => void;
  resetToDefault: () => void;
  importThemeFromDESIGN: (content: string, name?: string) => void;
}

export const useThemeStore = create<ThemeStore>((set, get) => {
  // Load initial settings from LocalStorage
  const loadSavedSettings = (): { activeId: string; custom: AgentDeckThemeTokens[] } => {
    if (typeof localStorage === 'undefined') {
      return { activeId: "spotify-dark", custom: [] };
    }
    
    try {
      const activeId = localStorage.getItem("agentdeck_active_theme_id") || "spotify-dark";
      const customString = localStorage.getItem("agentdeck_custom_themes");
      const custom = customString ? JSON.parse(customString) : [];
      return { activeId, custom };
    } catch {
      return { activeId: "spotify-dark", custom: [] };
    }
  };

  const { activeId, custom } = loadSavedSettings();
  
  // Resolve starting active theme object
  const resolveActiveTheme = (id: string, customList: AgentDeckThemeTokens[]): AgentDeckThemeTokens => {
    if (PRESET_THEMES[id]) {
      return PRESET_THEMES[id];
    }
    const found = customList.find(x => x.id === id);
    return found || PRESET_THEMES["spotify-dark"];
  };

  const initialTheme = resolveActiveTheme(activeId, custom);
  applyThemeVariables(initialTheme);

  return {
    activeThemeId: activeId,
    customThemes: custom,
    activeTheme: initialTheme,

    setTheme: (themeId) => {
      const { customThemes } = get();
      const nextTheme = resolveActiveTheme(themeId, customThemes);
      
      applyThemeVariables(nextTheme);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem("agentdeck_active_theme_id", themeId);
      }
      
      set({ activeThemeId: themeId, activeTheme: nextTheme });
    },

    saveCustomTheme: (theme) => {
      const { customThemes } = get();
      const updatedCustom = [...customThemes.filter(x => x.id !== theme.id), theme];
      
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem("agentdeck_custom_themes", JSON.stringify(updatedCustom));
        localStorage.setItem("agentdeck_active_theme_id", theme.id);
      }

      applyThemeVariables(theme);
      set({ 
        customThemes: updatedCustom, 
        activeThemeId: theme.id, 
        activeTheme: theme 
      });
    },

    deleteCustomTheme: (themeId) => {
      const { customThemes, activeThemeId } = get();
      const updatedCustom = customThemes.filter(x => x.id !== themeId);
      
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem("agentdeck_custom_themes", JSON.stringify(updatedCustom));
      }

      set({ customThemes: updatedCustom });
      
      // Fallback if current active theme was deleted
      if (activeThemeId === themeId) {
        get().setTheme("spotify-dark");
      }
    },

    resetToDefault: () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem("agentdeck_custom_themes");
        localStorage.setItem("agentdeck_active_theme_id", "spotify-dark");
      }
      
      const defaultTheme = PRESET_THEMES["spotify-dark"];
      applyThemeVariables(defaultTheme);
      
      set({ 
        customThemes: [], 
        activeThemeId: "spotify-dark", 
        activeTheme: defaultTheme 
      });
    },

    importThemeFromDESIGN: (content, name = "Imported Theme") => {
      const parsedTheme = parseThemeFromMarkdown(content, name);
      get().saveCustomTheme(parsedTheme);
    }
  };
});

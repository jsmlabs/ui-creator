import type { DesignToken, Theme } from "./types.js";

export const DEFAULT_BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536
} as const;

export const DEFAULT_TOKENS: Record<string, DesignToken> = {
  "color.surface.canvas": { id: "color.surface.canvas", category: "color", value: "#101014" },
  "color.surface.control": { id: "color.surface.control", category: "color", value: "#17171b" },
  "color.text.primary": { id: "color.text.primary", category: "color", value: "#e4e4e7" },
  "color.accent.primary": { id: "color.accent.primary", category: "color", value: "#7c8cff" },
  "spacing.sm": { id: "spacing.sm", category: "spacing", value: "8px" },
  "spacing.md": { id: "spacing.md", category: "spacing", value: "16px" },
  "radius.md": { id: "radius.md", category: "radius", value: "6px" }
};

export const DEFAULT_THEMES: Record<string, Theme> = {
  "theme-dark": { id: "theme-dark", name: "Dark", tokenOverrides: {} },
  "theme-light": {
    id: "theme-light",
    name: "Light",
    tokenOverrides: {
      "color.surface.canvas": "#ffffff",
      "color.surface.control": "#f4f4f5",
      "color.text.primary": "#18181b",
      "color.accent.primary": "#5967d8"
    }
  }
};

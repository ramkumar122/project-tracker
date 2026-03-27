export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  border: string;
  primary: string;
  primaryLight: string;
  text: string;
  textMuted: string;
  textDim: string;
  error: string;
  success: string;
  warning: string;
  headerBg: string;
  inputBg: string;
}

export const darkColors: ThemeColors = {
  background: '#0f0e17',
  surface: '#1a1a2e',
  card: '#1e2a45',
  border: '#2d3748',
  primary: '#6366f1',
  primaryLight: '#818cf8',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDim: '#64748b',
  error: '#f87171',
  success: '#34d399',
  warning: '#fbbf24',
  headerBg: '#1a1a2e',
  inputBg: '#0f0e17',
};

export const lightColors: ThemeColors = {
  background: '#f1f5f9',
  surface: '#ffffff',
  card: '#ffffff',
  border: '#e2e8f0',
  primary: '#6366f1',
  primaryLight: '#818cf8',
  text: '#1e293b',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  error: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  headerBg: '#ffffff',
  inputBg: '#f8fafc',
};

// Default export for legacy static imports (dark theme)
export const colors = darkColors;

// Vibrant column colors matching the modern Kanban aesthetic
export const columnConfig = {
  todo: { label: 'To Do', color: '#f43f5e' },
  inprogress: { label: 'In Progress', color: '#f59e0b' },
  onhold: { label: 'On Hold', color: '#8b5cf6' },
  done: { label: 'Done', color: '#10b981' },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.5 },
};

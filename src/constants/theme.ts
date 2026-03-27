export const colors = {
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
};

export const columnConfig = {
  todo: { label: 'To Do', color: '#94a3b8' },
  inprogress: { label: 'In Progress', color: '#60a5fa' },
  onhold: { label: 'On Hold', color: '#fbbf24' },
  done: { label: 'Done', color: '#34d399' },
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

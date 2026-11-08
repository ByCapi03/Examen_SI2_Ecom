export const colors = {
  primary: '#182D2A',
  primaryDark: '#102421',
  primarySoft: '#213936',

  gold: '#C9904A',
  beige: '#CFC1A5',
  cream: '#F5F2EB',

  white: '#FFFFFF',
  text: '#1D2926',
  muted: '#837A6D',
  border: 'rgba(207, 193, 165, 0.28)',
  
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#3b82f6',

  transparent: 'transparent',
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
  sm: 6,
  md: 12,
  lg: 20,
  full: 9999,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: colors.primary,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  h3: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.primary,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.muted,
  },
  body: {
    fontSize: 14,
    color: colors.text,
  },
  caption: {
    fontSize: 12,
    color: colors.muted,
  }
};

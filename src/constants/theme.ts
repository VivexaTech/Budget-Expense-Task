export const COLORS = {
  // Brand / Primary
  primary: '#1A73E8',
  primaryDark: '#1557B0',
  primaryLight: '#E8F0FE',
  primaryHover: '#174EA6',

  // Semantic Statuses
  success: '#188038',
  successLight: '#E6F4EA',
  warning: '#F9AB00',
  warningDark: '#B06000',
  warningLight: '#FEF7E0',
  error: '#D93025',
  errorLight: '#FCE8E6',
  info: '#1A73E8',
  infoLight: '#E8F0FE',

  // Surfaces & Backgrounds
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceVariant: '#F1F3F4',
  surfaceHover: '#F5F5F5',

  // Text Hierarchy
  text: '#202124',
  textPrimary: '#202124',
  textSecondary: '#5F6368',
  textTertiary: '#80868B',
  textInverse: '#FFFFFF',

  // Borders & Dividers
  divider: '#DADCE0',
  border: '#E8EAED',
  borderDark: '#BDC1C6',

  // Status badges
  badgePending: '#5F6368',
  badgePendingBg: '#F1F3F4',
  badgeReady: '#188038',
  badgeReadyBg: '#E6F4EA',
  badgeCompleted: '#1A73E8',
  badgeCompletedBg: '#E8F0FE',
  badgeCancelled: '#D93025',
  badgeCancelledBg: '#FCE8E6',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  minTouchTarget: 48,
};

export const TYPOGRAPHY = {
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
  },
  // Display / Large Amounts
  displayLarge: {
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    color: COLORS.textPrimary,
  },
  displayMedium: {
    fontSize: 26,
    fontWeight: '700' as const,
    letterSpacing: -0.25,
    color: COLORS.textPrimary,
  },
  // Headings
  h1: {
    fontSize: 22,
    fontWeight: '700' as const,
    lineHeight: 28,
    color: COLORS.textPrimary,
  },
  h2: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
    color: COLORS.textPrimary,
  },
  h3: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: COLORS.textPrimary,
  },
  // Body text
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    color: COLORS.textPrimary,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    color: COLORS.textPrimary,
  },
  bodySmall: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
    color: COLORS.textSecondary,
  },
  // Labels & Buttons
  labelLarge: {
    fontSize: 14,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontSize: 12,
    fontWeight: '500' as const,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 11,
    fontWeight: '500' as const,
    letterSpacing: 0.5,
  },
  // Monospace / Tabular for Currency
  amountHero: {
    fontSize: 30,
    fontWeight: '700' as const,
    fontVariant: ['tabular-nums' as const],
    color: COLORS.textPrimary,
  },
  amountLarge: {
    fontSize: 22,
    fontWeight: '700' as const,
    fontVariant: ['tabular-nums' as const],
    color: COLORS.textPrimary,
  },
  amountMedium: {
    fontSize: 16,
    fontWeight: '600' as const,
    fontVariant: ['tabular-nums' as const],
    color: COLORS.textPrimary,
  },
};

export const SHADOWS = {
  elevation1: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  elevation2: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  elevation3: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

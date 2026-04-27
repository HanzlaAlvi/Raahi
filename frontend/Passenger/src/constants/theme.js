// ─────────────────────────────────────────────────────────────────────────────
// THEME CONSTANTS — Forest Green palette (matches LoginScreen)
// ─────────────────────────────────────────────────────────────────────────────

export const COLORS = {
  // ── Brand greens ──────────────────────────────────────────────
  primary:      '#415844',   // main green
  primaryDark:  '#2e6b37',   // dark green (gradient end)
  primaryDeep:  '#1e4d25',   // deepest green (accents)
  primaryLight: '#EAF4EB',   // soft green tint
  primaryFaint: '#F0F9F1',   // near-white green

  // ── Semantic ──────────────────────────────────────────────────
  danger:      '#EF4444',
  dangerDark:  '#B91C1C',
  dangerBg:    '#FEF2F2',

  warning:     '#FF9800',
  warningDark: '#F57C00',
  warningBg:   '#FFF3E0',

  info:        '#3B82F6',
  infoDark:    '#1D4ED8',
  infoBg:      '#EFF6FF',

  success:     '#22C55E',
  successDark: '#15803D',
  successBg:   '#F0FDF4',

  purple:      '#8B5CF6',
  purpleDark:  '#6D28D9',
  purpleBg:    '#F5F3FF',

  teal:        '#4ECDC4',

  // ── Neutral ───────────────────────────────────────────────────
  white:      '#FFFFFF',
  black:      '#000000',

  text:          '#1A2E1C',
  textSecondary: '#5A7A5C',
  textLight:     '#9DB89A',

  background:    '#EEF7EF',
  backgroundAlt: '#F0F9F1',
  card:          '#FFFFFF',

  border:  '#D4E8D5',
  divider: '#EAF4EB',
};

export const GRADIENTS = {
  primary: [COLORS.primary,  COLORS.primaryDark],
  danger:  [COLORS.danger,   COLORS.dangerDark],
  warning: [COLORS.warning,  COLORS.warningDark],
  info:    [COLORS.info,     COLORS.infoDark],
  success: [COLORS.success,  COLORS.successDark],
};

export const FONT_SIZES = {
  xs:   10,
  sm:   12,
  md:   14,
  base: 15,
  lg:   16,
  xl:   18,
  xxl:  20,
  xxxl: 24,
};

export const SPACING = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  xxl:  32,
};

export const RADIUS = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  full: 9999,
};
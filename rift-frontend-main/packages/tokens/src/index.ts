/**
 * The same tokens as literal values.
 *
 * CSS custom properties are the source of truth for anything the browser
 * paints. This module exists for the places that cannot read a CSS variable:
 * chart scales, SVG gradient stops, and series assignment.
 */

/** Material Design 3 colour roles, seeded from #6750A4. */
export const md = {
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',

  secondary: '#625B71',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1D192B',

  tertiary: '#7D5260',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFD8E4',
  onTertiaryContainer: '#31111D',

  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',

  success: '#3B6939',
  successContainer: '#BCF0B4',
  onSuccessContainer: '#002105',

  warning: '#7D5700',
  warningContainer: '#FFDEA0',
  onWarningContainer: '#271900',

  background: '#FFFBFE',
  onBackground: '#1C1B1F',
  surface: '#FFFBFE',
  onSurface: '#1C1B1F',
  surfaceVariant: '#E7E0EC',
  onSurfaceVariant: '#49454F',

  surfaceLowest: '#FFFFFF',
  surfaceLow: '#F7F2FA',
  surfaceContainer: '#F3EDF7',
  surfaceHigh: '#ECE6F0',
  surfaceHighest: '#E6E0E9',

  inverseSurface: '#313033',
  inverseOnSurface: '#F4EFF4',
  inversePrimary: '#D0BCFF',

  outline: '#79747E',
  outlineVariant: '#CAC4D0',
} as const;

/**
 * A tone role plus the container it paints on. Status is never colour alone —
 * every consumer pairs these with an icon and a label.
 *
 * `neutral` is the tone for uncertainty. It is deliberately the surface
 * variant, not a warning: an unresolved finding is not a problem.
 */
export const tone = {
  success:  { base: md.success, container: md.successContainer, on: md.onSuccessContainer },
  warning:  { base: md.warning, container: md.warningContainer, on: md.onWarningContainer },
  neutral:  { base: md.onSurfaceVariant, container: md.surfaceVariant, on: md.onSurfaceVariant },
  error:    { base: md.error, container: md.errorContainer, on: md.onErrorContainer },
  primary:  { base: md.primary, container: md.primaryContainer, on: md.onPrimaryContainer },
  tertiary: { base: md.tertiary, container: md.tertiaryContainer, on: md.onTertiaryContainer },
} as const;

export type Tone = keyof typeof tone;

/**
 * Categorical series colours, assigned in fixed order and never cycled.
 * A fourth series folds into "Other" or small multiples rather than
 * inventing a hue.
 */
export const series = ['#6750A4', '#B3487A', '#4C9A2A'] as const;

export const font = {
  sans: 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif',
  mono: '"Roboto Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

export const radius = {
  xs: 8, sm: 12, md: 16, lg: 24, xl: 28, xxl: 32, xxxl: 48, full: 9999,
} as const;

export const motion = {
  /** MD3 "emphasized decelerate". */
  ease: 'cubic-bezier(0.2, 0, 0, 1)',
  fast: 200,
  base: 300,
  slow: 400,
} as const;

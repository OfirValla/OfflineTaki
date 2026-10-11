/** Blue-felt table look: translucent white surfaces over a radial blue gradient, gold accents. */
export const colors = {
  background: '#124A8C',
  backgroundDeep: '#0A2F5E',
  surface: 'rgba(255,255,255,0.12)',
  surfaceRaised: 'rgba(255,255,255,0.22)',
  surfaceSolid: '#174F92',
  border: 'rgba(255,255,255,0.28)',
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.72)',
  textOnLight: '#1B2B4B',
  accent: '#FFC845',
  accentText: '#1A1204',
  success: '#3DDC84',
  danger: '#FF5A5F',
  info: '#8FD3FF',
  plate: '#FFFFFF',
  // TAKI card colours and the darker shade used for the 3D numeral extrusion
  red: '#E63946',
  blue: '#2A7DE1',
  green: '#2BB673',
  yellow: '#F5C518',
  redDark: '#9E1B2B',
  blueDark: '#174E93',
  greenDark: '#1B7A4C',
  yellowDark: '#B98A00',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
} as const;

export const typography = {
  title: { fontSize: 44, fontWeight: '800' as const, letterSpacing: 4 },
  heading: { fontSize: 22, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.5 },
  mono: { fontSize: 14, fontFamily: 'monospace' },
} as const;

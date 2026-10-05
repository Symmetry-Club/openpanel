/**
 * Symmetry branding for this fork of the dashboard.
 *
 * Every user-visible product name, logo path and head meta lives here so the
 * divergence from upstream stays in one place.
 */
export const BRAND = {
  name: 'Symmetry Analytics',
  shortName: 'Symmetry',
  description: 'Internal analytics for Symmetry.',
  themeColor: '#121212',
  /** Square app icon (dark background), works on light and dark themes. */
  logoSquare: '/logo.svg',
  /** Symbol + wordmark in light ink, meant for dark backgrounds. */
  logoWordmark: '/logo-wordmark.svg',
  favicon: '/favicon.ico',
  appleTouchIcon: '/apple-touch-icon.png',
  manifest: '/manifest.json',
  ogImage: '/logo512.png',
} as const;

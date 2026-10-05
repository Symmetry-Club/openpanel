/**
 * Symmetry branding for this fork of the dashboard.
 *
 * Every user-visible product name, logo path and head meta lives here so the
 * divergence from upstream stays in one place. Brand files live under
 * `/brand/` (not the upstream `/logo.svg`…) so CDN caches that still hold the
 * old OpenPanel files at those paths can never serve them for ours.
 */
export const BRAND = {
  name: 'Symmetry Analytics',
  shortName: 'Symmetry',
  description: 'Internal analytics for Symmetry.',
  themeColor: '#121212',
  /** Square app icon (dark background), works on light and dark themes. */
  logoSquare: '/brand/symmetry-mark.svg',
  /** Symbol + wordmark in light ink, meant for dark backgrounds. */
  logoWordmark: '/brand/symmetry-wordmark.svg',
  favicon: '/brand/favicon.ico',
  appleTouchIcon: '/brand/apple-touch-icon.png',
  manifest: '/brand/manifest.json',
  ogImage: '/brand/icon-512.png',
} as const;

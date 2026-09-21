// Phase N — security headers. Scoped against every external origin this app
// actually calls from the BROWSER, found by grepping the codebase for
// script/style/img/fetch targets: js.stripe.com (Stripe Terminal SDK),
// unpkg.com + basemaps.cartocdn.com (Leaflet tiles/assets — VanMapPublic /
// LiveVanTracker), *.supabase.co incl. wss:// (Supabase client + Realtime),
// maps.googleapis.com / lh3.googleusercontent.com (Google Places photos,
// already in images.remotePatterns below). next/font/google self-hosts
// fonts at build time, so no fonts.googleapis.com/fonts.gstatic.com calls
// happen at runtime. 'unsafe-inline'/'unsafe-eval' are kept on script-src
// because this pass has no browser available to verify a stricter,
// nonce-based CSP wouldn't silently break Next.js hydration or a chart/map
// library — see docs/SECURITY.md for the live-verification + tightening
// follow-up this requires before relying on a stricter policy.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: blob: https://*.supabase.co https://*.basemaps.cartocdn.com https://unpkg.com https://maps.googleapis.com https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://js.stripe.com",
  "frame-src https://js.stripe.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'maps.googleapis.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self)' },
          // Vercel adds HSTS automatically for production HTTPS custom
          // domains; set explicitly too so it's present in any environment
          // that doesn't auto-add it (self-hosted, preview edge cases).
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ]
  },
}

module.exports = nextConfig

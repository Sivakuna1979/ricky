/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // The ffmpeg core is large and versioned by package.json, so let browsers cache it.
        source: '/ffmpeg/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
      },
    ]
  },
}

module.exports = nextConfig

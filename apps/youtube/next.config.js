/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'images.pexels.com' },
    ],
  },
  webpack: (config) => {
    // bullmq optionally supports Valkey's Glide client; we only use ioredis,
    // so silence the resulting "module not found" build warning.
    config.resolve.alias['@valkey/valkey-glide'] = false
    return config
  },
}

module.exports = nextConfig

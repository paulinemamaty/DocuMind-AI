/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Fix webpack cache warning
    config.cache = {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    }
    
    // Optimize large asset handling
    config.performance = {
      maxAssetSize: 512000,
      maxEntrypointSize: 512000,
    }
    
    // Fix Supabase websocket warning
    config.module = {
      ...config.module,
      exprContextCritical: false,
    }
    
    return config
  },
}

module.exports = nextConfig
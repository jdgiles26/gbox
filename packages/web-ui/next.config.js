/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',
  experimental: {
    appDir: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.GBOX_API_URL 
          ? `${process.env.GBOX_API_URL}/api/:path*`
          : 'http://localhost:8080/api/:path*',
      },
    ];
  },
  env: {
    GBOX_API_URL: process.env.GBOX_API_URL || 'http://localhost:8080',
  },
};

module.exports = nextConfig;
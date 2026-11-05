/** Next.js configuration for static GitHub Pages deployment and local development. */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost', '*.e2b.app'],
  images: { unoptimized: true },
  output: 'export',
  basePath,
  trailingSlash: true,
};
module.exports = nextConfig;

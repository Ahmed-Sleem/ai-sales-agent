/** Next.js configuration for the Sara prototype server runtime. */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost', '*.e2b.app'],
  images: { unoptimized: true },
};
module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  images: {
    unoptimized: true
  },
  productionBrowserSourceMaps: false
};

module.exports = nextConfig;

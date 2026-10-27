const { securityHeaders } = require("./lib/securityHeaders.cjs");
/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  outputFileTracingExcludes: {
    "/**": [
      "./data/player-progression.json*",
      "./data/player-accounts.json*",
      "./data/player-account-ledger.json*",
      "./data/player-reports.json*",
      "./data/contact-submissions.json*",
      "./data/account-prayer-seeds.json*",
      "./data/ship-economy.json*",
      "./data/launch-records.json*",
      "./.env", "./.env.*",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          https:
            String(
              process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "",
            ).startsWith("https://") || process.env.VERCEL === "1",
        }),
      },
    ];
  },
  compress: true,
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  productionBrowserSourceMaps: false,
  experimental: {
    cpus: 1,
  },
};

module.exports = nextConfig;

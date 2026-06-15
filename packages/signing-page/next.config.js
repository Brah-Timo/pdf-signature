/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["jsonwebtoken"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  // Disable x-powered-by header
  poweredByHeader: false,
  // Strict mode for React
  reactStrictMode: true,
};

module.exports = nextConfig;

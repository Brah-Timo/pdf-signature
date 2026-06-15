/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@pdf-signature/core'],
  experimental: {
    serverComponentsExternalPackages: ['node-forge'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.pdf-signature.dev' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001',
  },
};

export default nextConfig;

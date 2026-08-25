import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '*.trycloudflare.com',
  ],
  rewrites: async () => [
    {
      source: '/api/:path*',
      destination: `${backendUrl}/:path*`,
    },
    {
      source: '/uploads/:path*',
      destination: `${backendUrl}/uploads/:path*`,
    },
  ],
};

export default nextConfig;

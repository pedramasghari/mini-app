import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'enhanced-forward-compromise-hudson.trycloudflare.com',
  ],
  rewrites: async () => [
    {
      source: '/api/:path*',
      destination: `http://localhost:4000/:path*`,
    },
    {
      source: '/uploads/:path*',
      destination: `http://localhost:4000/uploads/:path*`,
    },
  ],
};

export default nextConfig;

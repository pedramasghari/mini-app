import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'footage-module-encoding-privileges.trycloudflare.com',
  ],
  rewrites: async () => [
    {
      source: '/api/:path*',
      destination: `http://localhost:4000/:path*`,
    },
  ],
};

export default nextConfig;

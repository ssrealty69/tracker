import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.1.8',
    '192.168.1.8:3000',
    'localhost:3000',
    '127.0.0.1:3000',
    '*.local',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: ['*'],
    },
  },
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '192.168.1.64',
    '192.168.1.64:3000',
    '192.168.1.8',
    '192.168.1.8:3000',
    '192.168.1.*',
    '192.168.*.*',
    'localhost:3000',
    '127.0.0.1:3000',
    '*.local',
    '*.trycloudflare.com',
    '*.loca.lt',
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: ['*'],
    },
  },
};

export default nextConfig;

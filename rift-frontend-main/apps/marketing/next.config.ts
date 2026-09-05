import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@rift/ui', '@rift/tokens'],
  typedRoutes: true,
};

export default config;

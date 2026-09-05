import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship as source; Next compiles them with the app.
  transpilePackages: ['@rift/ui', '@rift/tokens', '@rift/consent-ui'],
  typedRoutes: true,
};

export default config;

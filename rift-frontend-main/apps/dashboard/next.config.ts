import type { NextConfig } from 'next';

/**
 * Hosts a Server Action may be submitted from.
 *
 * Next refuses a Server Action whose `Origin` does not match the host it
 * believes it is served on — a CSRF defence, and the right default. Behind any
 * deployment that is not `localhost` it has to be told what that host is, or
 * every action fails in a particularly unhelpful way: the request 500s, the
 * rejection is swallowed by the transition that called it, and the button
 * appears to do nothing at all. Nothing is logged client-side and no error
 * reaches the screen.
 *
 * `RIFT_PUBLIC_HOST` is the deployment's own host and port, e.g.
 * `rift.example.com` or `rift-dash.southindia.azurecontainer.io:3100`. Left
 * unset, only the localhost defaults apply, which is correct for development.
 */
const allowedOrigins = [process.env.RIFT_PUBLIC_HOST]
  .filter((h): h is string => Boolean(h && h.trim()))
  .map((h) => h.trim().replace(/^https?:\/\//, ''));

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship as source; Next compiles them with the app.
  transpilePackages: ['@rift/ui', '@rift/tokens', '@rift/consent-ui'],
  typedRoutes: true,
  ...(allowedOrigins.length > 0
    ? { experimental: { serverActions: { allowedOrigins } } }
    : {}),
};

export default config;

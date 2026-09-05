import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Rift', template: '%s · Rift' },
  description: 'Website privacy control plane — scan, determine, configure, install once.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Swap for next/font/google once your build environment has network
            access at build time — it self-hosts and removes this round trip. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--md-inverse-surface)',
              color: 'var(--md-inverse-on-surface)',
              border: 'none',
              borderRadius: 'var(--md-radius-md)',
              fontFamily: 'var(--md-font-sans)',
            },
          }}
        />
      </body>
    </html>
  );
}

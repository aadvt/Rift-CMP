import * as React from 'react';
import { RiftMark, Button } from '@rift/ui';

const NAV = [
  ['How it works', '#how'],
  ['What Rift decides', '#confidence'],
  ['Regulations', '#regulations'],
  ['Install', '#install'],
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-md-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1280px] items-center gap-8 px-5 md:px-8">
        <a href="#top" className="flex shrink-0 items-center gap-3 rounded-full">
          <RiftMark size={34} />
          <span className="text-title-large font-medium tracking-tight text-md-on-surface">Rift</span>
        </a>

        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {NAV.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="inline-flex h-11 items-center rounded-full px-4 text-label-medium font-medium text-md-on-surface-variant transition-colors duration-[--md-duration-fast] ease-md hover:bg-md-primary/10 hover:text-md-on-surface"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <a href="#top" className="hidden sm:block">
            <Button variant="text">Sign in</Button>
          </a>
          <a href="#top">
            <Button variant="filled">Get started</Button>
          </a>
        </div>
      </div>
    </header>
  );
}

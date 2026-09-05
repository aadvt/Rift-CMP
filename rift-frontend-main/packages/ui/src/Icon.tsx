import * as React from 'react';

/* Stroke icons on a 20px grid, 1.5 stroke, round caps.
   No shields, no padlocks, no cookies. */
const PATHS = {
  overview:  <path d="M3 3h6.4v5.2H3zM3 11.4h6.4V17H3zM11.6 3H17v3.4h-5.4zM11.6 9.2H17V17h-5.4z" />,
  sites:     <><circle cx="10" cy="10" r="7.2" /><path d="M2.8 10h14.4M10 2.8c1.9 2 2.9 4.5 2.9 7.2s-1 5.2-2.9 7.2c-1.9-2-2.9-4.5-2.9-7.2s1-5.2 2.9-7.2z" /></>,
  scans:     <><circle cx="10" cy="10" r="2.1" /><path d="M10 2.6v2.8M10 14.6v2.8M2.6 10h2.8M14.6 10h2.8" /><circle cx="10" cy="10" r="6.6" strokeDasharray="2.6 3" /></>,
  consent:   <><rect x="2.8" y="4.2" width="14.4" height="4.4" rx="2.2" /><rect x="2.8" y="11.4" width="14.4" height="4.4" rx="2.2" /><circle cx="13.6" cy="6.4" r="1.1" fill="currentColor" stroke="none" /><circle cx="6.4" cy="13.6" r="1.1" fill="currentColor" stroke="none" /></>,
  analytics: <path d="M3.4 16.6h13.2M6.2 16.6V9.8M10 16.6V4.6M13.8 16.6v-4.4" />,
  settings:  <><path d="M3.2 6h13.6M3.2 14h13.6" /><circle cx="7.6" cy="6" r="2.1" /><circle cx="12.4" cy="14" r="2.1" /></>,

  chevronDown:   <path d="M5.5 8l4.5 4.4L14.5 8" />,
  chevronRight:  <path d="M8 5.5l4.4 4.5L8 14.5" />,
  chevronLeft:   <path d="M12 5.5L7.6 10l4.4 4.5" />,
  chevronUpDown: <path d="M6.8 8.4L10 5.2l3.2 3.2M6.8 11.6L10 14.8l3.2-3.2" />,
  arrowRight:    <path d="M3.6 10h12.8M11.6 5.2l4.8 4.8-4.8 4.8" />,
  arrowUpRight:  <path d="M6.4 13.6l7.2-7.2M7.6 6.4h6v6" />,
  check:         <path d="M4.2 10.4l3.8 3.8 8-8.4" />,
  x:             <path d="M5.4 5.4l9.2 9.2M14.6 5.4l-9.2 9.2" />,
  plus:          <path d="M10 4.2v11.6M4.2 10h11.6" />,
  minus:         <path d="M4.6 10h10.8" />,
  search:        <><circle cx="9" cy="9" r="5.4" /><path d="M13 13l4 4" /></>,
  copy:          <><rect x="6.6" y="6.6" width="9.4" height="9.4" rx="2.2" /><path d="M13.4 4H5.6A1.6 1.6 0 004 5.6v7.8" /></>,
  external:      <path d="M11.6 4h4.4v4.4M16 4l-6.4 6.4M14 11.6v3.2a1.6 1.6 0 01-1.6 1.6H5.2a1.6 1.6 0 01-1.6-1.6V7.6A1.6 1.6 0 015.2 6h3.2" />,
  clock:         <><circle cx="10" cy="10" r="7.2" /><path d="M10 5.8V10l2.8 1.8" /></>,
  refresh:       <><path d="M16.4 8.4A6.6 6.6 0 005 5.6L3.6 7M3.6 11.6a6.6 6.6 0 0011.4 2.8L16.4 13" /><path d="M3.6 3.4V7h3.6M16.4 16.6V13h-3.6" /></>,
  alert:         <><path d="M10 4.6L2.8 16.4h14.4z" /><path d="M10 8.8v3.2M10 14.2v.1" /></>,
  info:          <><circle cx="10" cy="10" r="7.2" /><path d="M10 9.2v4.4M10 6.6v.1" /></>,
  question:      <><circle cx="10" cy="10" r="7.2" /><path d="M8.2 8a1.9 1.9 0 013.7.6c0 1.3-1.9 1.7-1.9 3M10 14.2v.1" /></>,
  filter:        <path d="M3.4 5.2h13.2M6 10h8M8.4 14.8h3.2" />,
  download:      <path d="M10 3.6v8.8M6.4 9.2L10 12.8l3.6-3.6M4 15.4h12" />,
  file:          <><path d="M11.2 3.2H6.4A1.6 1.6 0 004.8 4.8v10.4a1.6 1.6 0 001.6 1.6h7.2a1.6 1.6 0 001.6-1.6V7.2z" /><path d="M11.2 3.2v4h4" /></>,
  code:          <path d="M7 6.8L3.6 10 7 13.2M13 6.8L16.4 10 13 13.2" />,
  layers:        <><path d="M10 3.2l6.8 3.4L10 10 3.2 6.6z" /><path d="M3.2 10.4L10 13.8l6.8-3.4M3.2 14l6.8 3.4 6.8-3.4" /></>,
  user:          <><circle cx="10" cy="7.2" r="3" /><path d="M4.4 16.4a5.8 5.8 0 0111.2 0" /></>,
  dots:          <><circle cx="4.6" cy="10" r="1.2" fill="currentColor" stroke="none" /><circle cx="10" cy="10" r="1.2" fill="currentColor" stroke="none" /><circle cx="15.4" cy="10" r="1.2" fill="currentColor" stroke="none" /></>,
  sidebar:       <><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M8 4v12" /></>,
  restore:       <><path d="M4 10a6 6 0 106-6 6 6 0 00-4.4 1.9L4 7.4" /><path d="M4 4v3.6h3.6" /></>,
  bell:          <><path d="M6 8.4a4 4 0 018 0c0 3.4 1.4 4.6 1.4 4.6H4.6S6 11.8 6 8.4z" /><path d="M8.8 15.6a1.4 1.4 0 002.4 0" /></>,
  menu:          <path d="M3.2 6h13.6M3.2 10h13.6M3.2 14h13.6" />,
  wave:          <path d="M3.6 11.4c1.6-3.2 3.2-3.2 4.8 0s3.2 3.2 4.8 0 3.2-3.2 3.2-1.6" />,
  sparkle:       <path d="M10 3.2l1.7 4.6 4.6 1.7-4.6 1.7-1.7 4.6-1.7-4.6L3.7 9.5l4.6-1.7z" />,
  shieldCheck:   <path d="M10 3.2l5.4 2v4.4c0 3.2-2.2 5.8-5.4 6.8-3.2-1-5.4-3.6-5.4-6.8V5.2z" />,
} as const;

export type IconName = keyof typeof PATHS;

export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, strokeWidth = 1.5, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

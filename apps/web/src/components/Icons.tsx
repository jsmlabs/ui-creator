import type { SVGProps } from "react";

function IconBase(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props} />;
}

export function LayersIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></IconBase>;
}

export function PagesIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="M6 2h9l3 3v17H6z"/><path d="M15 2v4h4"/></IconBase>;
}

export function ComponentsIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></IconBase>;
}

export function AssetsIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></IconBase>;
}

export function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="m9 18 6-6-6-6"/></IconBase>;
}

export function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></IconBase>;
}

export function LockIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></IconBase>;
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return <IconBase {...props}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></IconBase>;
}

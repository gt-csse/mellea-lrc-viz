"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "../components/primitives";

export default function Nav() {
  const pathname = usePathname();
  return <>
    <a className="skip-link" href="#main-content">Skip to review</a>
    <nav className="site-nav" aria-label="Workspaces">
      <Link className="brand" href="/" aria-label="Mellea citation review"><span className="brand-symbol" aria-hidden="true">m</span><span className="brand-name">mellea</span></Link>
      <span className="brand-rule" aria-hidden="true" /><span className="brand-caption">Legal reference checking</span>
      <div className="site-nav-links"><Link href="/" aria-current={pathname === "/" ? "page" : undefined}>Citation review</Link><Link href="/dataset" aria-current={pathname.startsWith("/dataset") ? "page" : undefined}>Annotations</Link></div>
      <span className="nav-local"><Icon name="lock" size={12} />Read-only workspace</span>
    </nav>
  </>;
}

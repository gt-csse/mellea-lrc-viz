"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The two workspaces answer different questions over the same corpus: one reads
// what the pipeline concluded, the other what the dataset claims and on what
// evidence. This is the only thing they share on screen.
const ROUTES = [
  { href: "/", label: "Result viewer", hint: "what the pipeline concluded about one filing" },
  { href: "/dataset", label: "Dataset reviewer", hint: "what the annotation store records, and its evidence" }
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="site-nav" aria-label="Workspaces">
      {ROUTES.map((route) => {
        const active = route.href === "/" ? pathname === "/" : pathname.startsWith(route.href);
        return (
          <Link
            key={route.href}
            href={route.href}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
            title={route.hint}
          >
            {route.label}
          </Link>
        );
      })}
    </nav>
  );
}

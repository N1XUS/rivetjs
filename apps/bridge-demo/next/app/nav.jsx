"use client";
// Sidebar links with the active state (usePathname needs a client component). `BD_PREFETCH=off` (server env) turns
// Next's default <Link> prefetch off for the no-prefetch row.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "../../data.ts";

export function Nav({ prefetch }) {
  const path = usePathname();
  return (
    <nav className="side" aria-label="Main">
      <strong>Ops</strong>
      {NAV.map((item) => (
        <Link key={item.href} href={item.href} prefetch={prefetch ? undefined : false} aria-current={path === item.href ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

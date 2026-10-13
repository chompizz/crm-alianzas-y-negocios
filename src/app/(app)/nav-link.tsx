"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, exact, children }: { href: string; exact?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" || exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`relative whitespace-nowrap rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "bg-indigo-50 font-medium text-indigo-700 shadow-[inset_2px_0_0_var(--color-neon-cyan),0_0_20px_-8px_rgb(34_211_238/0.8)]"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </Link>
  );
}

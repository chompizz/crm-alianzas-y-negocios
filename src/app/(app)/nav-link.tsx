"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, soon, children }: { href: string; soon?: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  if (soon) {
    return (
      <span className="flex items-center justify-between whitespace-nowrap rounded-md px-3 py-2 text-sm text-slate-400">
        {children}
        <span className="ml-2 text-[10px] uppercase">pronto</span>
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-md px-3 py-2 text-sm ${active ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700 hover:bg-slate-100"}`}
    >
      {children}
    </Link>
  );
}

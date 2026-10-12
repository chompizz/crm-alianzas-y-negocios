import Link from "next/link";
import { auth, signOut } from "@/auth";
import { NavLink } from "./nav-link";

const NAV = [
  { href: "/", label: "Tablero" },
  { href: "/organizaciones", label: "Organizaciones" },
  { href: "/contactos", label: "Contactos" },
  { href: "/alianzas", label: "Alianzas" },
  { href: "/oportunidades", label: "Oportunidades" },
  { href: "/iniciativas", label: "Iniciativas" },
  { href: "/compromisos", label: "Compromisos" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-5 py-4">
          <Link href="/" className="text-xl font-semibold text-indigo-700">Nexo</Link>
          <p className="text-xs text-slate-500">Alianzas y negocios</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
          <NavLink href="/perfil">Conectar con Claude</NavLink>
          {isAdmin && <NavLink href="/usuarios">Usuarios</NavLink>}
        </nav>
        <div className="hidden border-t border-slate-100 px-5 py-4 text-sm md:block">
          <Link href="/perfil" className="block truncate font-medium text-slate-700 hover:text-indigo-700">{session?.user?.name}</Link>
          <p className="truncate text-xs text-slate-500">{session?.user?.email}</p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="mt-2 text-xs text-slate-500 hover:text-slate-800">Cerrar sesión</button>
          </form>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}

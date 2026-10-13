"use client";

import Link from "next/link";

// Lápiz para editar y X para eliminar (con confirmación), iguales en todo el sistema.

type DeleteProps = {
  action: (formData: FormData) => void | Promise<void>;
  confirm: string;
  label: string;
  // "icon": X chica para filas y tarjetas; "button": botón rojo para encabezados.
  variant?: "icon" | "button";
};

const iconBtn =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100";

export function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-4 w-4" aria-hidden>
      <path d="M13.6 3.6a1.9 1.9 0 0 1 2.8 2.8L7 15.8l-3.5.9.9-3.5 9.2-9.6Z" strokeLinejoin="round" />
      <path d="m12.3 5 2.7 2.7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" aria-hidden>
      <path d="M5 5l10 10M15 5 5 15" strokeLinecap="round" />
    </svg>
  );
}

export function EditLink({ href, label, scroll }: { href: string; label: string; scroll?: boolean }) {
  return (
    <Link href={href} scroll={scroll} className={`${iconBtn} hover:text-indigo-600`} aria-label={`Editar ${label}`} title="Editar">
      <PencilIcon />
    </Link>
  );
}

export function DeleteButton({ action, confirm: message, label, variant = "icon" }: DeleteProps) {
  return (
    <form action={action} className="inline-flex">
      <button
        className={variant === "button" ? "btn-danger" : `${iconBtn} hover:text-red-600`}
        aria-label={`Eliminar ${label}`}
        title="Eliminar"
        onClick={(e) => {
          e.stopPropagation();
          if (!window.confirm(message)) e.preventDefault();
        }}
      >
        {variant === "button" ? "Eliminar" : <XIcon />}
      </button>
    </form>
  );
}

export function RowActions({
  editHref,
  deleteAction,
  confirm,
  label,
  scroll,
  className = "",
}: {
  editHref?: string;
  scroll?: boolean;
  deleteAction?: DeleteProps["action"];
  confirm?: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-end gap-0.5 ${className}`}>
      {editHref && <EditLink href={editHref} label={label} scroll={scroll} />}
      {deleteAction && <DeleteButton action={deleteAction} confirm={confirm ?? `¿Eliminar ${label}?`} label={label} />}
    </div>
  );
}

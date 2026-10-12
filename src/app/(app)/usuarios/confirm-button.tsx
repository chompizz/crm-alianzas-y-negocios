"use client";

export function ConfirmButton({ message }: { message: string }) {
  return (
    <button
      className="text-xs text-red-600 hover:underline"
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      Eliminar
    </button>
  );
}

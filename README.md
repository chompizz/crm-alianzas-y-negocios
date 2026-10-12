# Nexo

CRM interno para gestionar alianzas, estrategia y negocios: organizaciones del ecosistema (con presencia en uno o varios países), contactos, alianzas por país, oportunidades, iniciativas y compromisos.

## Estado

Etapa 1 (base): login, usuarios, organizaciones multipaís, contactos y tablero inicial. El modelo de datos completo (alianzas, oportunidades, iniciativas, interacciones, compromisos) ya está en `prisma/schema.prisma`; sus pantallas llegan en las etapas siguientes.

## Requisitos

- Node.js 20 o superior
- PostgreSQL 14 o superior

## Puesta en marcha

```bash
cp .env.example .env        # completar DATABASE_URL, AUTH_SECRET y el admin inicial
npm install
npx prisma migrate deploy   # crea las tablas
npm run db:seed             # carga países y crea el usuario administrador
npm run dev                 # http://localhost:3000
```

El administrador crea al resto del equipo desde **Usuarios**.

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS · PostgreSQL + Prisma · Auth.js (email y contraseña).

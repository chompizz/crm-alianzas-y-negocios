# Nexo

CRM interno para gestionar alianzas, estrategia y negocios: organizaciones del ecosistema (con presencia en uno o varios países), contactos, alianzas por país, oportunidades, iniciativas y compromisos.

## Estado

MVP completo: organizaciones multipaís y contactos, alianzas por país (tablero por etapas, participantes, interacciones y compromisos), oportunidades, iniciativas con hitos y un tablero de portafolio. Siguiente paso: piloto con datos reales.

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

`npm start` aplica las migraciones pendientes y carga los países antes de arrancar, así que cada despliegue deja la base al día sin pasos manuales.

El administrador crea al resto del equipo desde **Usuarios**.

## Publicar en Railway

1. Entrar a [railway.com](https://railway.com) con la cuenta de GitHub.
2. **New Project → Deploy from GitHub repo** y elegir `chompizz/crm-alianzas-y-negocios` (Railway pide permiso para leer el repositorio).
3. En el mismo proyecto: **Create → Database → PostgreSQL**.
4. En el servicio de la aplicación, pestaña **Variables**, agregar:

   | Variable | Valor |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `AUTH_SECRET` | una cadena aleatoria de al menos 32 caracteres |
   | `AUTH_TRUST_HOST` | `true` |
   | `SEED_ADMIN_EMAIL` | el email del primer administrador |
   | `SEED_ADMIN_PASSWORD` | su contraseña inicial |

5. **Settings → Networking → Generate Domain** para obtener la dirección pública.
6. Ingresar con el administrador, crear al resto del equipo en **Usuarios** y después borrar `SEED_ADMIN_PASSWORD` de las variables.

Cada push a `main` vuelve a publicar la aplicación.

## Stack

Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS · PostgreSQL + Prisma · Auth.js (email y contraseña).

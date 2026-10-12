// Carga los países y, si están definidas SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD,
// crea el usuario administrador. Es idempotente: se puede correr en cada arranque.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const COUNTRIES = [
  ["AR", "Argentina"],
  ["BO", "Bolivia"],
  ["BR", "Brasil"],
  ["CL", "Chile"],
  ["CO", "Colombia"],
  ["CR", "Costa Rica"],
  ["CU", "Cuba"],
  ["DO", "República Dominicana"],
  ["EC", "Ecuador"],
  ["SV", "El Salvador"],
  ["ES", "España"],
  ["US", "Estados Unidos"],
  ["GT", "Guatemala"],
  ["HN", "Honduras"],
  ["MX", "México"],
  ["NI", "Nicaragua"],
  ["PA", "Panamá"],
  ["PY", "Paraguay"],
  ["PE", "Perú"],
  ["PT", "Portugal"],
  ["PR", "Puerto Rico"],
  ["UY", "Uruguay"],
  ["VE", "Venezuela"],
  ["CA", "Canadá"],
  ["GB", "Reino Unido"],
  ["DE", "Alemania"],
  ["FR", "Francia"],
  ["IT", "Italia"],
  ["CN", "China"],
];

async function main() {
  for (const [code, name] of COUNTRIES) {
    await prisma.country.upsert({ where: { code }, update: { name }, create: { code, name } });
  }

  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (email && password) {
    // La contraseña de la variable siempre se aplica: cambiarla y redesplegar resetea el acceso del admin.
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash, role: "ADMIN" },
      create: { email, name: "Administrador", role: "ADMIN", passwordHash },
    });
    console.log(`Usuario administrador listo: ${email}`);
  }
}

main().finally(() => prisma.$disconnect());

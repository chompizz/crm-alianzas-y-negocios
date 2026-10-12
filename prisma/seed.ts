import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const COUNTRIES: [string, string][] = [
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

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: "Administrador",
        role: "ADMIN",
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
    console.log(`Usuario administrador listo: ${email}`);
  } else {
    console.log("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD no definidos: no se creó administrador.");
  }
}

main().finally(() => prisma.$disconnect());

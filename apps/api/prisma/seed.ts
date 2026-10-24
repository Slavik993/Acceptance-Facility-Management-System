// seed.ts — создаёт организацию и первого пользователя (OWNER) для dev-стенда
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Creating seed data...");

  // Создаём организацию
  const org = await prisma.organization.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "DOLGIY STUDIO",
      timeZone: "Europe/Moscow",
    },
    update: {},
  });

  console.log(`Organization: ${org.name}`);

  // Создаём пользователя-руководителя
  const user = await prisma.user.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      orgId: org.id,
      role: "OWNER",
      name: "Руководитель",
      phone: "+79692803998",
    },
    update: {},
  });

  console.log(`User: ${user.name} (${user.role})`);
  console.log("Seed data created successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

async function seed() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  console.log('Seeding example database...');

  const users = [
    { email: 'alice@example.com', name: 'Alice Martin', organizationId: 'org-1', password: 'password' },
    { email: 'bob@example.com', name: 'Bob Dupont', organizationId: 'org-1', password: 'password' },
    { email: 'charlie@example.com', name: 'Charlie Durand', organizationId: 'org-1', password: 'password' },
    { email: 'diana@example.com', name: 'Diana Petit', organizationId: 'org-1', password: 'password' },
    { email: 'eve@example.com', name: 'Eve Bernard', organizationId: 'org-2', password: 'password' },
  ];

  for (const user of users) {
    const created = await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name },
      create: user,
    });
    console.log(`  User: ${created.name} (${created.email}) — id: ${created.id}`);
  }

  console.log('\nSeed complete. Use these credentials to login:');
  console.log('  POST /chat/auth/login { "email": "alice@example.com", "password": "password" }');
  console.log('  → returns { user, token }');

  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});

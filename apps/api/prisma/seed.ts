import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const NODE_ID = process.env.NODE_ID ?? 'LIMEIRA';
const SEED_PASSWORD = 'foodshare123';

async function upsertUser(email: string, name: string, role: UserRole) {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, passwordHash, nodeId: NODE_ID },
  });
}

async function main() {
  const admin = await upsertUser('admin@foodshare.org', 'Administrador FoodShare', UserRole.ADMIN);
  console.log(`Usuário admin pronto: ${admin.email} / senha: ${SEED_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

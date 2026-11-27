/**
 * Demo OWNER account: owner@growlyze.com / Password123!
 *
 * Creates (or refreshes) the owner user and makes them the owner of record
 * for every demo rental. Managers keep managing the same rentals and admins
 * still see everything, so no other account's view changes.
 * Safe to run more than once. Runs after `db:seed:demo`.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'owner@growlyze.com';
  const password = await bcrypt.hash('Password123!', 10);
  const managerRole = await prisma.role.findUnique({ where: { name: 'PROPERTY_MANAGER' } });

  const owner = await prisma.user.upsert({
    where: { email },
    update: { role: 'OWNER', isActive: true },
    create: {
      email,
      password,
      firstName: 'Olivia',
      lastName: 'Owens',
      phone: '555-123-9000',
      role: 'OWNER',
      isActive: true,
      ...(managerRole ? { Role: { connect: { id: managerRole.id } } } : {}),
    },
  });

  const { count } = await prisma.rental.updateMany({ data: { ownerId: owner.id } });
  console.log(`Owner ${email} ready; owner of ${count} rentals.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

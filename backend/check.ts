import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      name: { contains: 'anderson', mode: 'insensitive' }
    }
  });
  console.log(users);
  
  // also check if exact match fails
  if (users.length === 0) {
    const all = await prisma.user.findMany();
    console.log("All users:", all.map(u => ({name: u.name, pass: u.passwordHash})));
  }
}
main();

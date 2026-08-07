"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const client_1 = require("@prisma/client");
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new adapter_pg_1.PrismaPg(pool);
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    await prisma.appointment.deleteMany();
    await prisma.service.deleteMany();
    await prisma.user.deleteMany();
    const service = await prisma.service.create({
        data: {
            name: 'Corte + Barba',
            durationMinutes: 45,
            price: 70.00,
        },
    });
    const barber = await prisma.user.create({
        data: {
            name: 'João Barbeiro',
            email: 'joao@barbearia.com',
            passwordHash: 'hashed123',
            role: 'BARBER',
            isAdmin: true,
        },
    });
    const client = await prisma.user.create({
        data: {
            name: 'Visitante (Web)',
            email: 'visitante@web.com',
            passwordHash: 'hashed123',
            role: 'CLIENT',
        },
    });
    console.log({ service, barber, client });
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map
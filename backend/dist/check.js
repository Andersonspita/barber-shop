"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const users = await prisma.user.findMany({
        where: {
            name: { contains: 'anderson', mode: 'insensitive' }
        }
    });
    console.log(users);
    if (users.length === 0) {
        const all = await prisma.user.findMany();
        console.log("All users:", all.map(u => ({ name: u.name, pass: u.passwordHash })));
    }
}
main();
//# sourceMappingURL=check.js.map
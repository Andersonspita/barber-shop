import { Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly prisma;
    constructor(prisma: PrismaService);
    validate(payload: {
        sub: string;
        email: string;
        role: string;
    }): Promise<{
        id: string;
        name: string;
        email: string;
        passwordHash: string;
        phoneNumber: string | null;
        birthDate: Date | null;
        role: import("@prisma/client").$Enums.Role;
        isAdmin: boolean;
        commissionRate: import("@prisma/client-runtime-utils").Decimal | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
export {};

import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    login(email: string, pass: string): Promise<{
        access_token: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: import("@prisma/client").$Enums.Role;
            isAdmin: boolean;
        };
    }>;
    signup(name: string, email: string, pass: string, birthDate?: string): Promise<{
        access_token: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: import("@prisma/client").$Enums.Role;
            isAdmin: boolean;
        };
    }>;
    changePassword(email: string, currentPass: string, newPass: string): Promise<{
        message: string;
    }>;
}

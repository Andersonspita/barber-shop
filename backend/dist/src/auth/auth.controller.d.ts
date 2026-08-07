import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(body: {
        email: string;
        pass: string;
    }): Promise<{
        access_token: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: import("@prisma/client").$Enums.Role;
            isAdmin: boolean;
        };
    }>;
    signup(body: {
        name: string;
        email: string;
        pass: string;
        birthDate?: string;
    }): Promise<{
        access_token: string;
        user: {
            id: string;
            name: string;
            email: string;
            role: import("@prisma/client").$Enums.Role;
            isAdmin: boolean;
        };
    }>;
    changePassword(body: {
        currentPass: string;
        newPass: string;
    }, req: any): Promise<{
        message: string;
    }>;
}

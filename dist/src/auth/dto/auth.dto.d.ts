export declare class RegisterDto {
    name: string;
    phone: string;
    email: string;
    password: string;
    role?: 'USER' | 'CHEF' | 'ADMIN';
}
export declare class LoginDto {
    email: string;
    password: string;
}

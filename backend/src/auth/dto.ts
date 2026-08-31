import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** Regra única de senha, aplicada no cadastro, na troca e na recuperação. */
const PASSWORD_RULES = [
  MinLength(8, { message: 'A senha precisa ter ao menos 8 caracteres.' }),
  MaxLength(72, { message: 'A senha pode ter no máximo 72 caracteres.' }),
  Matches(/[A-Za-zÀ-ÿ]/, {
    message: 'A senha precisa conter ao menos uma letra.',
  }),
  Matches(/\d/, { message: 'A senha precisa conter ao menos um número.' }),
];

function IsStrongPassword() {
  return (target: object, key: string) => {
    for (const rule of PASSWORD_RULES) rule(target, key);
  };
}

export class LoginDto {
  @Transform(normalizeEmail) @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @IsString() @MinLength(1, { message: 'Informe sua senha.' })
  pass!: string;
}

export class SignupDto {
  @IsString() @MinLength(2, { message: 'Informe seu nome.' }) @MaxLength(120)
  name!: string;

  @Transform(normalizeEmail) @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @IsStrongPassword()
  pass!: string;

  /**
   * Obrigatório: é por ele que saem a confirmação e o lembrete de 2 horas —
   * o dado mais importante de um cliente de barbearia.
   */
  @IsString()
  @Matches(/^\+?[\d\s().-]{10,20}$/, {
    message: 'Informe um telefone válido com DDD.',
  })
  phoneNumber!: string;

  @IsOptional() @IsString() birthDate?: string;
}

export class ChangePasswordDto {
  @IsString() currentPass!: string;

  @IsStrongPassword()
  newPass!: string;
}

export class ForgotPasswordDto {
  @Transform(normalizeEmail) @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;
}

export class ResetPasswordDto {
  @IsString() @MinLength(20) token!: string;

  @IsStrongPassword()
  newPass!: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s().-]{10,20}$/, {
    message: 'Informe um telefone válido com DDD.',
  })
  phoneNumber?: string;

  @IsOptional() @IsString() birthDate?: string;
}

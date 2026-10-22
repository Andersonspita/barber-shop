import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateShopDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  /** Endereço público: /<slug>. Validado em `assertValidSlug`. */
  @IsString()
  @MaxLength(40)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  /** Primeiro administrador, que recebe uma senha temporária. */
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  adminName!: string;

  @Transform(normalizeEmail)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  adminEmail!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[\d\s().-]{10,20}$/, {
    message: 'Informe um telefone válido com DDD.',
  })
  adminPhone?: string;
}

export class UpdateShopDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  slug?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Ativar o plano de uma barbearia em teste ou vencida (conversão manual). */
  @IsOptional()
  @IsIn(['ACTIVE'])
  subscriptionStatus?: 'ACTIVE';

  @IsOptional()
  @IsIn(['SOLO', 'SQUAD', 'PRO', 'EMPIRE'])
  plan?: 'SOLO' | 'SQUAD' | 'PRO' | 'EMPIRE';

  /** Instância da Evolution API; string vazia volta para a padrão. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  whatsappInstance?: string;
}

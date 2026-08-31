import { randomInt } from 'node:crypto';

// Sem caracteres ambíguos (0/O, 1/l/I): a senha é ditada em voz alta no balcão.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Senha temporária de uso único, sorteada por usuário. Substitui a constante
 * `Mudar@123` que era igual para toda conta criada pelo admin.
 */
export function generateTemporaryPassword(length = 10): string {
  let password = '';
  for (let i = 0; i < length; i++) {
    password += ALPHABET[randomInt(ALPHABET.length)];
  }
  // Garante que atende à regra de "ao menos uma letra e um número".
  return `${password}${randomInt(10)}`;
}

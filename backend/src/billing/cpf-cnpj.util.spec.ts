import { isValidCpfCnpj, onlyDigits } from './cpf-cnpj.util';

describe('isValidCpfCnpj', () => {
  it('aceita CPF e CNPJ válidos, com ou sem máscara', () => {
    expect(isValidCpfCnpj('529.982.247-25')).toBe(true);
    expect(isValidCpfCnpj('52998224725')).toBe(true);
    expect(isValidCpfCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('recusa dígito verificador errado, sequências repetidas e tamanhos inválidos', () => {
    expect(isValidCpfCnpj('529.982.247-24')).toBe(false);
    expect(isValidCpfCnpj('111.111.111-11')).toBe(false);
    expect(isValidCpfCnpj('11.222.333/0001-82')).toBe(false);
    expect(isValidCpfCnpj('00.000.000/0000-00')).toBe(false);
    expect(isValidCpfCnpj('123')).toBe(false);
  });

  it('onlyDigits remove a máscara', () => {
    expect(onlyDigits('11.222.333/0001-81')).toBe('11222333000181');
  });
});

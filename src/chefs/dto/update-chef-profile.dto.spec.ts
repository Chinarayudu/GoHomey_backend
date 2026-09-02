import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateChefProfileDto } from './update-chef-profile.dto';

async function check(body: Record<string, unknown>) {
  const dto = plainToInstance(UpdateChefProfileDto, body);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: false,
  });
  return { dto, errors };
}

describe('UpdateChefProfileDto', () => {
  it('accepts a partial update with no bank fields', async () => {
    const { errors } = await check({ bio: 'New bio' });
    expect(errors).toHaveLength(0);
  });

  it('strips unknown fields instead of rejecting', async () => {
    const { dto, errors } = await check({
      bank_name: 'HDFC Bank',
      id: 'chef-1',
      application_status: 'APPROVED',
      phone: '+919999999999',
    });
    expect(errors).toHaveLength(0);
    expect(dto).not.toHaveProperty('id');
    expect(dto).not.toHaveProperty('application_status');
    expect(dto).not.toHaveProperty('phone');
  });

  it('normalises IFSC: strips whitespace and uppercases', async () => {
    const { dto, errors } = await check({ ifsc_code: ' hdfc 0001234 ' });
    expect(errors).toHaveLength(0);
    expect(dto.ifsc_code).toBe('HDFC0001234');
  });

  it('rejects a malformed IFSC', async () => {
    const { errors } = await check({ ifsc_code: 'HDFC123' });
    expect(errors.map((e) => e.property)).toContain('ifsc_code');
  });

  it('strips spaces and dashes from the account number', async () => {
    const { dto, errors } = await check({
      bank_account_number: '1234 5678-9012',
    });
    expect(errors).toHaveLength(0);
    expect(dto.bank_account_number).toBe('123456789012');
  });

  it('accepts a numeric account number and coerces to a digit string', async () => {
    const { dto, errors } = await check({ bank_account_number: 123456789 });
    expect(errors).toHaveLength(0);
    expect(dto.bank_account_number).toBe('123456789');
  });

  it('rejects an account number that is too short / non-numeric', async () => {
    const { errors: short } = await check({ bank_account_number: '12345' });
    expect(short.map((e) => e.property)).toContain('bank_account_number');

    const { errors: alpha } = await check({ bank_account_number: 'ABCD12345' });
    expect(alpha.map((e) => e.property)).toContain('bank_account_number');
  });
});

import { publicChefSelect, publicChefSelectWithUser } from './chef.select';

describe('publicChefSelect', () => {
  it('exposes the food safety (FSSAI) certificate', () => {
    expect(publicChefSelect.food_safety_cert_url).toBe(true);
  });

  it('never exposes credentials, government ID, or bank details', () => {
    const forbidden = [
      'password',
      'government_id_url',
      'bank_name',
      'bank_account_number',
      'ifsc_code',
    ] as const;
    for (const field of forbidden) {
      expect(field in publicChefSelect).toBe(false);
    }
  });

  it('publicChefSelectWithUser adds only the linked User display name', () => {
    expect(publicChefSelectWithUser.user).toEqual({ select: { name: true } });
    expect(publicChefSelectWithUser.food_safety_cert_url).toBe(true);
  });
});

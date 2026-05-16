import 'dotenv/config';
import {
  ShadowfaxClient,
  resolveShadowfaxApiMode,
  resolveShadowfaxBaseUrl,
} from '../src/delivery/shadowfax.client';

async function main() {
  const token = process.env.SHADOWFAX_API_TOKEN;
  const creditsKey =
    process.env.SHADOWFAX_CREDITS_KEY ||
    process.env.SHADOWFAX_CLIENT_CODE ||
    token;
  const storeBrandId = process.env.SHADOWFAX_CLIENT_CODE || creditsKey;
  const baseUrl = resolveShadowfaxBaseUrl();
  const mode = resolveShadowfaxApiMode();

  console.log('Shadowfax credential check');
  console.log('  API_MODE:', mode, '(testing = portal Testing Environment)');
  console.log('  BASE_URL:', baseUrl);
  console.log('  API_TOKEN:', token ? `${token.slice(0, 8)}…` : '(missing)');

  if (!token) {
    console.error('\nSet SHADOWFAX_API_TOKEN (Get Testing Token in portal)');
    process.exit(1);
  }

  const client = new ShadowfaxClient(token, baseUrl);
  const body = await client.validateCreditsKey(creditsKey!, storeBrandId!);
  console.log('\nValidate response:', body);

  if (body.is_valid) {
    console.log('\nOK — dispatch will call the testing Shadowfax API.');
  } else if (JSON.stringify(body).includes('inactive or expired')) {
    console.log('\nToken rejected by Shadowfax. Click "Get Testing Token" again in the portal.');
  }
}

main().catch((e) => {
  console.error('\nFailed:', e.message);
  if ((e as { body?: unknown }).body) console.error('Body:', (e as any).body);
  process.exit(1);
});

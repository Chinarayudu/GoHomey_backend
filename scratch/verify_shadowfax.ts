import 'dotenv/config';

const token = process.env.SHADOWFAX_API_TOKEN;
const creditsKey =
  process.env.SHADOWFAX_CREDITS_KEY ||
  process.env.SHADOWFAX_CLIENT_CODE ||
  token;
const baseUrl =
  process.env.SHADOWFAX_BASE_URL || 'https://flash-api.shadowfax.in';

async function main() {
  console.log('Shadowfax API check (use BASE_URL from your portal API docs)');
  console.log('  BASE_URL:', baseUrl);
  console.log('  API_TOKEN:', token ? `${token.slice(0, 8)}…` : '(missing)');
  console.log('  CREDITS_KEY:', creditsKey ? `${creditsKey.slice(0, 8)}…` : '(missing)');

  if (!token) {
    console.error('\nSet SHADOWFAX_API_TOKEN in .env');
    process.exit(1);
  }

  const res = await fetch(`${baseUrl}/order/credits/key/validate/`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      credits_key: creditsKey,
      store_brand_id: process.env.SHADOWFAX_CLIENT_CODE || creditsKey,
    }),
  });

  const body = await res.json();
  console.log('\nValidate response:', res.status, body);

  if (body.message?.includes('inactive or expired')) {
    console.log(
      '\n→ Token rejected. In the Shadowfax portal, copy the exact "Staging URL" from',
    );
    console.log('  Resources → API Documentation into SHADOWFAX_BASE_URL (not hlbackend.staging.* unless that is what they show).');
    console.log('  Then click "Get Testing Token" again if needed.');
  } else if (body.is_valid) {
    console.log('\n→ Credentials look good. Try admin dispatch on READY_FOR_PICKUP orders.');
  }
}

main().catch(console.error);

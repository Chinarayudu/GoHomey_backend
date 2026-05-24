import 'dotenv/config';

function mask(value?: string) {
  if (!value) return '(missing)';
  return `${value.slice(0, 4)}...${value.slice(-4)} len=${value.length}`;
}

async function main() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromPhone = process.env.TWILIO_PHONE_NUMBER?.trim();
  const toPhone = process.argv[2]?.trim() || fromPhone;

  console.log('Twilio local credential check');
  console.log('TWILIO_ACCOUNT_SID:', mask(accountSid));
  console.log('TWILIO_AUTH_TOKEN:', mask(authToken));
  console.log('TWILIO_PHONE_NUMBER:', mask(fromPhone));
  console.log('Test To:', mask(toPhone));

  if (!accountSid || !authToken || !fromPhone || !toPhone) {
    throw new Error('Missing one or more Twilio env values');
  }

  if (!accountSid.startsWith('AC')) {
    throw new Error('TWILIO_ACCOUNT_SID should start with AC');
  }

  if (authToken.length !== 32) {
    throw new Error(`TWILIO_AUTH_TOKEN should normally be 32 characters, got ${authToken.length}`);
  }

  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: toPhone,
        From: fromPhone,
        Body: 'Homey local Twilio credential test',
      }),
    },
  );

  const data = await response.json().catch(() => ({}));
  console.log('HTTP status:', response.status);
  console.log('Twilio response:', data);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function testWebhook() {
  const url = 'http://localhost:3000/api/v1/webhooks/shadowfax';

  const payload = {
    coid: 'REPLACE_WITH_ORDER_UUID',
    status: 'COLLECTED',
    action_time: new Date().toISOString(),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log('Status:', response.status);
  console.log('Body:', await response.json());
}

testWebhook().catch(console.error);

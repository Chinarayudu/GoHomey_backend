import crypto from 'crypto';

async function testWebhook() {
  const secret = 'F5FFB065D65BDC556FA4863443ECCA91E2571588';
  const url = 'http://localhost:3000/api/v1/webhooks/borzo';
  
  const payload = {
    order: {
      order_id: 1234567, // Replace with a real Borzo order ID from your DB if testing actual DB update
      status: 'active'
    }
  };
  
  const body = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  const signature = hmac.digest('hex');
  
  console.log('Sending Webhook with signature:', signature);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-dv-signature': signature
      },
      body: body
    });
    
    const data = await response.json();
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
}

testWebhook();

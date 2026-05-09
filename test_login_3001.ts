async function testLogin() {
  const payload = {
    email: 'admin@gohomeyy.com',
    password: 'AdminPassword123!'
  };

  try {
    const response = await fetch('http://127.0.0.1:3001/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    console.log('Response Status:', response.status);
    const data = await response.json();
    console.log('Response Body:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error during login test:', error);
  }
}

testLogin();

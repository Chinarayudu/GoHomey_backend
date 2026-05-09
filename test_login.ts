async function testLogin() {
  const payload = {
    email: 'admin@gohomeyy.com',
    password: 'AdminPassword123!'
  };

  try {
    const response = await fetch('http://localhost:3000/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Response Status:', response.status);
    console.log('Response Body:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error during login test:', error);
  }
}

testLogin();

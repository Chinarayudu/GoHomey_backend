async function testHealth() {
  try {
    const response = await fetch('http://127.0.0.1:3000/api/v1/health');
    const data = await response.json();
    console.log('Health Check Status:', response.status);
    console.log('Health Check Body:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Health Check Error:', error);
  }
}

testHealth();

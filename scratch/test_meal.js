const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIyOGU3YmY4OS1kZGFjLTQ3MjctODkzYS1jMGU3NjFiOGMzOGMiLCJlbWFpbCI6ImF1Z3VzdGVAY3Vpc2luZS5jb20iLCJwaG9uZSI6Iis5MTg2ODgyNjExNjUiLCJyb2xlIjoiQ0hFRiIsImlhdCI6MTc3NjEzMzE4MCwiZXhwIjoxNzc2MjE5NTgwfQ.58_B51JGu2I91g2lwSIo4cqllQS2rFGvp1mNY_0Zv9c';

async function testCreateMeal() {
  const form = new FormData();
  form.append('meal_name', 'South Indian Thali');
  form.append('type', 'VEG');
  form.append('service_window', 'LUNCH');
  form.append('price', '150');
  form.append('slots_total', '20');
  form.append('date', new Date().toISOString());
  // Omitting meal_image first to see if it's optional, 
  // or we can append a dummy text file if required by multer.

  try {
    const res = await fetch('http://localhost:3000/api/v1/meals', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form
    });

    console.log(`Status: ${res.status}`);
    const data = await res.text();
    console.log('Response:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

testCreateMeal();

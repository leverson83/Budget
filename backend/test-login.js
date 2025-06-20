const fetch = require('node-fetch');

async function testLogin() {
  try {
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'leverson83@gmail.com'
      })
    });

    const data = await response.json();
    console.log('Login Response:', JSON.stringify(data, null, 2));
    
    if (data.user) {
      console.log('\nUser object:');
      console.log('- id:', data.user.id);
      console.log('- name:', data.user.name);
      console.log('- email:', data.user.email);
      console.log('- admin:', data.user.admin);
      console.log('- admin type:', typeof data.user.admin);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLogin(); 
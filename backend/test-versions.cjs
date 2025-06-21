const fetch = require('node-fetch');

async function testVersionsAPI() {
  const baseURL = 'http://localhost:8585/api';
  
  try {
    // First, login to get a token
    console.log('Logging in...');
    const loginResponse = await fetch(`${baseURL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'leverson83@gmail.com'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    console.log('Login successful, token received');
    
    // Test getting versions
    console.log('\nTesting GET /api/versions...');
    const versionsResponse = await fetch(`${baseURL}/versions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!versionsResponse.ok) {
      throw new Error(`Versions request failed: ${versionsResponse.status} ${versionsResponse.statusText}`);
    }
    
    const versionsData = await versionsResponse.json();
    console.log('Versions response:', JSON.stringify(versionsData, null, 2));
    
    // Test getting active version
    console.log('\nTesting GET /api/versions/active...');
    const activeResponse = await fetch(`${baseURL}/versions/active`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!activeResponse.ok) {
      throw new Error(`Active version request failed: ${activeResponse.status} ${activeResponse.statusText}`);
    }
    
    const activeData = await activeResponse.json();
    console.log('Active version response:', JSON.stringify(activeData, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testVersionsAPI(); 
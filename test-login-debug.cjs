const https = require('https');
const http = require('http');

async function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data, headers: res.headers });
      });
    });
    
    req.on('error', (err) => {
      reject(err);
    });
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function testLoginFlow() {
  try {
    console.log('Testing login flow...\n');
    
    // Test 1: Try to login with leverson83@gmail.com (no password)
    console.log('1. Testing login with leverson83@gmail.com (no password)...');
    const loginResponse1 = await makeRequest('http://localhost:8585/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'leverson83@gmail.com'
      })
    });
    
    console.log('Status:', loginResponse1.status);
    console.log('Response:', loginResponse1.data);
    console.log('');
    
    // Test 2: Set password
    console.log('2. Setting password...');
    const setPasswordResponse = await makeRequest('http://localhost:8585/api/auth/set-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'leverson83@gmail.com',
        password: 'test123'
      })
    });
    
    console.log('Status:', setPasswordResponse.status);
    console.log('Response:', setPasswordResponse.data);
    console.log('');
    
    // Test 3: Login with password
    console.log('3. Testing login with password...');
    const loginResponse2 = await makeRequest('http://localhost:8585/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'leverson83@gmail.com',
        password: 'test123'
      })
    });
    
    console.log('Status:', loginResponse2.status);
    console.log('Response:', loginResponse2.data);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testLoginFlow(); 
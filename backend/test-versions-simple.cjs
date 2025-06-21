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
        resolve({ status: res.statusCode, data: data });
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

async function testVersionsAPI() {
  try {
    // First, set password to get a token
    console.log('Setting password...');
    const setPasswordResponse = await makeRequest('http://localhost:3001/api/auth/set-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'leverson83@gmail.com',
        password: 'test123'
      })
    });
    
    console.log('Set password response:', setPasswordResponse.status);
    const setPasswordData = JSON.parse(setPasswordResponse.data);
    console.log('Set password data:', setPasswordData);
    
    if (setPasswordData.token) {
      const token = setPasswordData.token;
      console.log('Token received, length:', token.length);
      
      // Test getting versions
      console.log('\nTesting GET /api/versions...');
      const versionsResponse = await makeRequest('http://localhost:3001/api/versions', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Versions response status:', versionsResponse.status);
      console.log('Versions response data:', versionsResponse.data);
      
      if (versionsResponse.status === 200) {
        const versionsData = JSON.parse(versionsResponse.data);
        console.log('Versions:', JSON.stringify(versionsData, null, 2));
      }
      
      // Test getting active version
      console.log('\nTesting GET /api/versions/active...');
      const activeResponse = await makeRequest('http://localhost:3001/api/versions/active', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Active version response status:', activeResponse.status);
      console.log('Active version response data:', activeResponse.data);
      
      if (activeResponse.status === 200) {
        const activeData = JSON.parse(activeResponse.data);
        console.log('Active version:', JSON.stringify(activeData, null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testVersionsAPI(); 
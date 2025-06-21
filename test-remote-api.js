const http = require('http');

// Configuration - update these for your remote machine
const HOST = 'YOUR_MACHINE_IP'; // Replace with your machine's IP
const PORT = 8585;

// Test functions
function testHealth() {
  console.log('Testing health endpoint...');
  makeRequest('/api/health', 'GET', null, (status, data) => {
    console.log(`Health check: ${status} - ${JSON.stringify(data)}`);
  });
}

function testLogin(email, password) {
  console.log(`Testing login for ${email}...`);
  const data = JSON.stringify({ email, password });
  makeRequest('/api/auth/login', 'POST', data, (status, data) => {
    console.log(`Login: ${status} - ${JSON.stringify(data)}`);
    if (data.token) {
      console.log('Login successful! Token received.');
      if (data.user) {
        console.log(`User admin status: ${data.user.admin ? 'Yes' : 'No'}`);
      }
      // Test version creation with the token
      testCreateVersion(data.token);
    }
  });
}

function testCreateVersion(token) {
  console.log('Testing version creation...');
  const data = JSON.stringify({ 
    name: 'Test Version', 
    description: 'Test version created via API' 
  });
  makeRequest('/api/versions', 'POST', data, token, (status, data) => {
    console.log(`Create version: ${status} - ${JSON.stringify(data)}`);
  });
}

function testGetVersions(token) {
  console.log('Testing get versions...');
  makeRequest('/api/versions', 'GET', null, token, (status, data) => {
    console.log(`Get versions: ${status} - ${JSON.stringify(data)}`);
  });
}

function makeRequest(path, method, data, authToken, callback) {
  const options = {
    hostname: HOST,
    port: PORT,
    path: path,
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (authToken) {
    options.headers['Authorization'] = `Bearer ${authToken}`;
  }

  const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      try {
        const parsed = JSON.parse(responseData);
        callback(res.statusCode, parsed);
      } catch (e) {
        callback(res.statusCode, responseData);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Request error: ${e.message}`);
    callback(0, { error: e.message });
  });

  if (data) {
    req.write(data);
  }
  req.end();
}

// Run tests
console.log(`Testing API at ${HOST}:${PORT}`);
console.log('=====================================');

// Test 1: Health check
testHealth();

// Test 2: Login (update with your credentials)
setTimeout(() => {
  testLogin('leverson83@gmail.com', 'your_password_here');
}, 1000);

// Test 3: Get versions (will run after login)
setTimeout(() => {
  console.log('\nNote: To test with a token, update the script with your actual token');
}, 2000); 
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_URL = 'http://localhost:3001/api';

async function testAPI() {
  console.log('=== Testing API Authentication and User Filtering ===\n');

  // Test 1: Login as leverson83@gmail.com
  console.log('1. Testing login for leverson83@gmail.com...');
  const loginResponse1 = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'leverson83@gmail.com' })
  });
  
  const loginData1 = await loginResponse1.json();
  console.log('   Login response:', loginData1);
  
  if (loginData1.needsPassword) {
    console.log('   User needs to set password first');
    return;
  }

  const token1 = loginData1.token;
  console.log('   Token received:', token1 ? 'Yes' : 'No');

  // Test 2: Get expenses for leverson83@gmail.com
  console.log('\n2. Testing expenses for leverson83@gmail.com...');
  const expensesResponse1 = await fetch(`${API_URL}/expenses`, {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    }
  });
  
  const expenses1 = await expensesResponse1.json();
  console.log(`   Expenses count: ${expenses1.length}`);
  console.log(`   Response status: ${expensesResponse1.status}`);

  // Test 3: Get accounts for leverson83@gmail.com
  console.log('\n3. Testing accounts for leverson83@gmail.com...');
  const accountsResponse1 = await fetch(`${API_URL}/accounts`, {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token1}`
    }
  });
  
  const accounts1 = await accountsResponse1.json();
  console.log(`   Accounts count: ${accounts1.length}`);
  console.log(`   Response status: ${accountsResponse1.status}`);

  // Test 4: Login as marinahu1990@hotmail.com
  console.log('\n4. Testing login for marinahu1990@hotmail.com...');
  const loginResponse2 = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'marinahu1990@hotmail.com' })
  });
  
  const loginData2 = await loginResponse2.json();
  console.log('   Login response:', loginData2);
  
  if (loginData2.needsPassword) {
    console.log('   User needs to set password first');
    return;
  }

  const token2 = loginData2.token;
  console.log('   Token received:', token2 ? 'Yes' : 'No');

  // Test 5: Get expenses for marinahu1990@hotmail.com
  console.log('\n5. Testing expenses for marinahu1990@hotmail.com...');
  const expensesResponse2 = await fetch(`${API_URL}/expenses`, {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token2}`
    }
  });
  
  const expenses2 = await expensesResponse2.json();
  console.log(`   Expenses count: ${expenses2.length}`);
  console.log(`   Response status: ${expensesResponse2.status}`);

  // Test 6: Get accounts for marinahu1990@hotmail.com
  console.log('\n6. Testing accounts for marinahu1990@hotmail.com...');
  const accountsResponse2 = await fetch(`${API_URL}/accounts`, {
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token2}`
    }
  });
  
  const accounts2 = await accountsResponse2.json();
  console.log(`   Accounts count: ${accounts2.length}`);
  console.log(`   Response status: ${accountsResponse2.status}`);

  // Test 7: Test without authentication
  console.log('\n7. Testing without authentication...');
  const noAuthResponse = await fetch(`${API_URL}/expenses`, {
    headers: { 'Content-Type': 'application/json' }
  });
  
  console.log(`   Response status: ${noAuthResponse.status}`);
  const noAuthData = await noAuthResponse.json();
  console.log('   Response:', noAuthData);

  console.log('\n=== Test completed ===');
}

testAPI().catch(console.error); 
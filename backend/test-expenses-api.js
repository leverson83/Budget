const fetch = require('node-fetch');

async function testExpensesAPI() {
  console.log('=== TESTING EXPENSES API ===\n');
  
  try {
    // First, get a JWT token by logging in
    console.log('1. Logging in to get JWT token...');
    const loginResponse = await fetch('http://localhost:8585/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'leverson83@gmail.com',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Login successful, got JWT token');
    
    // Test the expenses endpoint
    console.log('\n2. Testing /api/expenses endpoint...');
    const expensesResponse = await fetch('http://localhost:8585/api/expenses', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!expensesResponse.ok) {
      throw new Error(`Expenses API failed: ${expensesResponse.status} ${expensesResponse.statusText}`);
    }
    
    const expensesData = await expensesResponse.json();
    console.log(`✅ Expenses API returned ${expensesData.length} expenses`);
    
    if (expensesData.length > 0) {
      console.log('\n📝 First 5 expenses:');
      expensesData.slice(0, 5).forEach((expense, index) => {
        console.log(`  ${index + 1}. ID: ${expense.id}, Description: "${expense.description}", Amount: $${expense.amount}, Frequency: ${expense.frequency}, Tags: [${expense.tags?.join(', ') || 'none'}]`);
      });
    }
    
    // Test the versions endpoint
    console.log('\n3. Testing /api/versions endpoint...');
    const versionsResponse = await fetch('http://localhost:8585/api/versions', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!versionsResponse.ok) {
      throw new Error(`Versions API failed: ${versionsResponse.status} ${versionsResponse.statusText}`);
    }
    
    const versionsData = await versionsResponse.json();
    console.log(`✅ Versions API returned ${versionsData.length} versions`);
    
    console.log('\n📋 All versions:');
    versionsData.forEach(version => {
      console.log(`  ID: ${version.id}, Name: "${version.name}", Active: ${version.is_active}, Created: ${version.created_at}`);
    });
    
    // Test the active version endpoint
    console.log('\n4. Testing /api/versions/active endpoint...');
    const activeVersionResponse = await fetch('http://localhost:8585/api/versions/active', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (!activeVersionResponse.ok) {
      throw new Error(`Active version API failed: ${activeVersionResponse.status} ${activeVersionResponse.statusText}`);
    }
    
    const activeVersionData = await activeVersionResponse.json();
    console.log(`✅ Active version: ID ${activeVersionData.id}, Name "${activeVersionData.name}"`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testExpensesAPI(); 
import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:8585/api';

async function testImportExport() {
  try {
    console.log('Testing Import/Export functionality...\n');

    // First, login to get a token
    console.log('1. Logging in...');
    const loginResponse = await fetch(`${BASE_URL}/login`, {
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
      throw new Error('Login failed');
    }

    const loginData = await loginResponse.json();
    const token = loginData.token;
    console.log('✅ Login successful\n');

    // Test export
    console.log('2. Testing export...');
    const exportResponse = await fetch(`${BASE_URL}/export`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    if (!exportResponse.ok) {
      throw new Error('Export failed');
    }

    const exportData = await exportResponse.json();
    console.log('✅ Export successful');
    console.log(`   - Accounts: ${exportData.accounts.length}`);
    console.log(`   - Income: ${exportData.income.length}`);
    console.log(`   - Expenses: ${exportData.expenses.length}`);
    console.log(`   - Tags: ${exportData.tags.length}`);
    console.log(`   - Settings: ${exportData.settings.length}`);
    console.log(`   - Expense-Tag relationships: ${exportData.expenseTags.length}\n`);

    // Test import with the exported data
    console.log('3. Testing import...');
    const importResponse = await fetch(`${BASE_URL}/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(exportData)
    });

    if (!importResponse.ok) {
      const errorData = await importResponse.json();
      throw new Error(`Import failed: ${errorData.error}`);
    }

    const importResult = await importResponse.json();
    console.log('✅ Import successful');
    console.log(`   - Created version ID: ${importResult.versionId}`);
    console.log(`   - Imported: ${importResult.imported.accounts} accounts, ${importResult.imported.income} income, ${importResult.imported.expenses} expenses, ${importResult.imported.tags} tags, ${importResult.imported.settings} settings, ${importResult.imported.expenseTags} expense-tag relationships\n`);

    console.log('🎉 All tests passed! Import/Export functionality is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testImportExport(); 
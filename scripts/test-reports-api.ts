async function testReportsAPI() {
  try {
    console.log('🧪 Testing Reports API with admin auth...\n');

    // Step 1: Login
    console.log('1️⃣ Logging in as admin@hotelmanager.com...');
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@hotelmanager.com',
        password: 'Admin@123456'
      })
    });

    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      console.error('❌ Login failed:', loginData);
      return;
    }

    console.log('✅ Login successful');
    console.log(`   User roles: ${loginData.data?.roles?.join(', ') || 'none'}\n`);

    // Step 2: Test reports endpoint without auth (should fail)
    console.log('2️⃣ Testing /api/reports/pos without auth...');
    const noAuthRes = await fetch('http://localhost:3000/api/reports/pos', {
      method: 'GET'
    });
    console.log(`   Status: ${noAuthRes.status} (expected 401)`);
    const noAuthData = await noAuthRes.json();
    console.log(`   Response: ${noAuthData.message || JSON.stringify(noAuthData).substring(0, 100)}\n`);

    // Step 3: Extract cookie from login response and use it
    console.log('3️⃣ Testing /api/reports/pos with auth cookie...');
    
    // Get auth_token from login response headers
    const setCookieHeader = loginRes.headers.get('set-cookie');
    console.log(`   Auth cookie: ${setCookieHeader ? 'Found' : 'Not found in headers'}`);

    // Try with Authorization header instead
    const authRes = await fetch('http://localhost:3000/api/reports/pos', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${loginData.data?.token || 'test'}`
      }
    });

    console.log(`   Status: ${authRes.status}`);
    const authData = await authRes.json();
    
    if (authRes.ok) {
      console.log('✅ Reports API accessible!');
      console.log(`   Data: ${JSON.stringify(authData).substring(0, 200)}...`);
    } else {
      console.log('❌ Permission denied');
      console.log(`   Response: ${JSON.stringify(authData)}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testReportsAPI();

async function testAuthAndReports() {
  try {
    console.log('🧪 Testing Auth and Reports API...\n');

    // Step 1: Login
    console.log('1️⃣ Logging in...');
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@hotelmanager.com',
        password: 'Admin@123456'
      })
    });

    const loginData: any = await loginRes.json();
    console.log(`   Status: ${loginRes.status}`);
    console.log(`   User roles: ${loginData.user?.roles?.join(', ')}`);
    
    // Extract auth_token from Set-Cookie header
    const setCookieHeader = loginRes.headers.get('set-cookie') || '';
    console.log(`   Set-Cookie header: ${setCookieHeader.substring(0, 80)}...`);
    
    // Parse cookie value
    const cookieMatch = setCookieHeader.match(/auth_token=([^;]+)/);
    const authToken = cookieMatch ? cookieMatch[1] : null;
    console.log(`   Extracted token: ${authToken ? 'Yes (' + authToken.substring(0, 20) + '...)' : 'No'}\n`);

    if (!authToken) {
      console.log('❌ No auth token found');
      return;
    }

    // Step 2: Test reports endpoint with token in cookie header
    console.log('2️⃣ Testing /api/reports/pos with auth_token cookie...');
    const reportsRes = await fetch('http://localhost:3000/api/reports/pos', {
      method: 'GET',
      headers: {
        'Cookie': `auth_token=${authToken}`
      }
    });

    console.log(`   Status: ${reportsRes.status}`);
    const reportsData: any = await reportsRes.json();
    
    if (reportsRes.ok) {
      console.log('✅ Reports API accessible!');
      if (reportsData.data && Array.isArray(reportsData.data)) {
        console.log(`   Records found: ${reportsData.data.length}`);
      }
    } else {
      console.log('❌ Error');
      console.log(`   Response: ${JSON.stringify(reportsData)}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testAuthAndReports();

async function testOrderCreation() {
  try {
    console.log('🧪 Testing Order Creation API...\n');

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
    if (!loginRes.ok) {
      console.log('   ❌ Login failed:', loginData);
      return;
    }

    console.log(`   ✅ Logged in as: ${loginData.user?.email}`);
    console.log(`   Roles: ${loginData.user?.roles?.join(', ')}`);

    // Extract token
    const setCookieHeader = loginRes.headers.get('set-cookie') || '';
    const cookieMatch = setCookieHeader.match(/auth_token=([^;]+)/);
    const authToken = cookieMatch ? cookieMatch[1] : null;

    if (!authToken) {
      console.log('   ❌ No auth token found');
      return;
    }

    // Step 2: Create an order
    console.log('\n2️⃣ Creating test order...');
    const orderRes = await fetch('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth_token=${authToken}`
      },
      body: JSON.stringify({
        items: [
          {
            productId: 'test-item-1',
            productName: 'Test Product',
            productType: 'food',
            quantity: 2,
            unitPrice: 10.50,
            departmentCode: 'kitchen'
          }
        ],
        notes: 'Test order from admin'
      })
    });

    console.log(`   Status: ${orderRes.status}`);
    const orderData: any = await orderRes.json();

    if (orderRes.ok) {
      console.log(`   ✅ Order created successfully!`);
      console.log(`   Order ID: ${orderData.data?.id}`);
      console.log(`   Status: ${orderData.data?.status}`);
    } else {
      console.log(`   ❌ Failed to create order`);
      console.log(`   Error: ${orderData.error?.message || JSON.stringify(orderData)}`);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

testOrderCreation();

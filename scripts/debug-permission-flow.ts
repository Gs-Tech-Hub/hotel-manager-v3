import { prisma } from '@/lib/auth/prisma';
import { verifyToken } from '@/lib/auth/session';

async function debugPermissionFlow() {
  try {
    console.log('🔍 Debugging permission flow...\n');

    // Step 1: Simulate token extraction
    console.log('1️⃣ Getting admin user...');
    const admin = await prisma.adminUser.findUnique({
      where: { email: 'admin@hotelmanager.com' },
      include: {
        roles: {
          include: { permissions: true },
        },
      },
    });

    if (!admin) {
      console.log('   ❌ Admin not found');
      return;
    }

    console.log(`   ✅ Found admin: ${admin.email}`);
    console.log(`   Has roles: ${admin.roles.map(r => r.code).join(', ')}`);

    // Step 2: Check permission logic manually
    console.log('\n2️⃣ Simulating permission check logic...');
    
    const action = 'reports.read';
    const subject = 'reports';
    
    console.log(`   Checking: ${action}:${subject}`);

    for (const role of admin.roles) {
      console.log(`\n   Checking role: ${role.code}`);
      let foundExact = false;
      let foundWildcard = false;

      for (const perm of role.permissions) {
        // Check exact match
        if (perm.action === action && (perm.subject || null) === (subject || null)) {
          foundExact = true;
          console.log(`     ✅ Found exact match: ${perm.action}:${perm.subject}`);
        }

        // Check wildcard
        if (perm.action === '*' && (perm.subject === '*' || perm.subject === null)) {
          foundWildcard = true;
          console.log(`     ✅ Found wildcard: ${perm.action}:${perm.subject}`);
        }
      }

      if (!foundExact && !foundWildcard) {
        console.log(`     ❌ No match found`);
      }
    }

    // Step 3: Actual permission check
    console.log('\n3️⃣ Running actual checkPermission...');
    const { checkPermission } = await import('@/lib/auth/rbac');
    
    const result = await checkPermission(
      { userId: admin.id, userType: 'admin' },
      'reports.read',
      'reports'
    );

    console.log(`   Result: ${result ? '✅ GRANTED' : '❌ DENIED'}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugPermissionFlow();

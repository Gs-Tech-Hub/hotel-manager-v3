import { prisma } from '@/lib/auth/prisma';

async function checkAdminPermissions() {
  try {
    console.log('🔍 Checking admin permissions in database...\n');

    // Find admin user
    const admin = await prisma.adminUser.findUnique({
      where: { email: 'admin@hotelmanager.com' },
      include: {
        roles: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!admin) {
      console.log('❌ Admin user not found');
      return;
    }

    console.log(`✅ Admin user found: ${admin.email}`);
    console.log(`📋 Roles assigned: ${admin.roles.length}`);

    for (const role of admin.roles) {
      console.log(`\n  📌 Role: ${role.code} (${role.id})`);
      console.log(`     Permissions: ${role.permissions.length}`);
      
      // Check specifically for wildcard and reports.read
      const wildcard = role.permissions.find(p => p.action === '*' && p.subject === '*');
      const wildcard2 = role.permissions.find(p => p.action === '*' && p.subject === null);
      const reportsRead = role.permissions.find(p => p.action === 'reports.read');
      
      if (wildcard) console.log(`     ✅ Wildcard (*:*) found`);
      if (wildcard2) console.log(`     ✅ Wildcard (*:null) found`);
      if (reportsRead) console.log(`     ✅ reports.read found: ${reportsRead.action}:${reportsRead.subject}`);
      
      // List all permissions
      console.log('\n     All permissions:');
      role.permissions.slice(0, 5).forEach(p => {
        console.log(`       - ${p.action}:${p.subject}`);
      });
      if (role.permissions.length > 5) {
        console.log(`       ... and ${role.permissions.length - 5} more`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminPermissions();

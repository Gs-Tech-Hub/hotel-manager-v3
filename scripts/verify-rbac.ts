import { prisma } from '@/lib/auth/prisma';

async function verifyRBACSetup() {
  console.log('\n🔍 Verifying RBAC Setup...\n');

  try {
    // 1. Check Organization
    const org = await prisma.organisationInfo.findUnique({
      where: { id: '1' },
    });
    console.log('✓ Organization:', org?.name || 'NOT FOUND');

    // 2. Check Admin Roles (Legacy)
    const adminRoles = await prisma.adminRole.findMany();
    console.log(`✓ Admin Roles (Legacy): ${adminRoles.length} roles`);
    adminRoles.forEach(role => {
      console.log(`  - ${role.code}: ${role.name}`);
    });

    // 3. Check Admin Permissions
    const adminPerms = await prisma.adminPermission.findMany();
    console.log(`✓ Admin Permissions (Legacy): ${adminPerms.length} permissions`);

    // 4. Check Unified Roles
    const roles = await prisma.role.findMany({
      include: {
        rolePermissions: true,
      },
    });
    console.log(`✓ Unified Roles: ${roles.length} roles`);
    roles.forEach(role => {
      console.log(`  - ${role.code}: ${role.name} (${role.rolePermissions.length} permissions)`);
    });

    // 5. Check Permissions
    const permissions = await prisma.permission.findMany();
    console.log(`✓ Unified Permissions: ${permissions.length} total`);

    // 6. Check Admin User
    const adminUser = await prisma.adminUser.findUnique({
      where: { email: 'admin@hotel.test' },
      include: {
        roles: true,
      },
    });
    console.log(`✓ Admin User: ${adminUser?.email || 'NOT FOUND'}`);
    if (adminUser?.roles) {
      console.log(`  - Legacy roles assigned: ${adminUser.roles.length}`);
    }

    // 7. Check User Roles (Unified)
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId: adminUser?.id,
        userType: 'admin',
      },
      include: {
        role: true,
      },
    });
    console.log(`✓ User Roles (Unified): ${userRoles.length}`);
    userRoles.forEach(ur => {
      console.log(`  - ${ur.role.code}: ${ur.role.name}`);
    });

    // 8. Check Departments
    const departments = await prisma.department.findMany();
    console.log(`✓ Canonical Departments: ${departments.length}`);
    departments.forEach(dept => {
      console.log(`  - ${dept.code}: ${dept.name}`);
    });

    console.log('\n✅ RBAC Setup Verification Complete!\n');
    console.log('Admin Login Credentials:');
    console.log('  📧 Email: admin@hotel.test');
    console.log('  🔑 Password: admin123\n');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyRBACSetup();

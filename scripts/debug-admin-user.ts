import { prisma } from '@/lib/auth/prisma';

async function debugAdminUser() {
  try {
    const admin = await prisma.adminUser.findUnique({
      where: { id: '1' },
      include: {
        roles: {
          include: {
            permissions: true,
          },
        },
      },
    });

    console.log('Admin user found:', !!admin);
    if (admin) {
      console.log('Admin email:', admin.email);
      console.log('Admin roles:', admin.roles?.map(r => r.code) || []);
      console.log('Total roles:', admin.roles?.length || 0);
      if (admin.roles && admin.roles[0]) {
        console.log('First role permissions:', admin.roles[0].permissions?.length || 0);
      }
    } else {
      console.log('Admin user not found with ID "1"');
      
      // Try to find by email
      const adminByEmail = await prisma.adminUser.findUnique({
        where: { email: 'admin@hotelmanager.com' },
        include: {
          roles: {
            include: {
              permissions: true,
            },
          },
        },
      });
      
      if (adminByEmail) {
        console.log('Found by email. ID:', adminByEmail.id);
        console.log('Email:', adminByEmail.email);
        console.log('Roles:', adminByEmail.roles?.map(r => r.code) || []);
      } else {
        console.log('Admin user not found by email either');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAdminUser();

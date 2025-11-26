import { prisma } from "@/lib/auth/prisma";
import { hashPassword } from "@/lib/auth/credentials";

async function seedAuthUsers() {
  console.log("🌱 Seeding test users with RBAC roles...\n");

  try {
    // Create test admin user
    const adminEmail = "admin@hotelmanager.local";
    const existingAdmin = await prisma.adminUser.findUnique({
      where: { email: adminEmail },
    });

    let adminUser = existingAdmin;
    if (!existingAdmin) {
      const hashedPassword = await hashPassword("admin123456");
      adminUser = await prisma.adminUser.create({
        data: {
          email: adminEmail,
          username: "admin",
          password: hashedPassword,
          firstname: "Admin",
          lastname: "User",
          isActive: true,
        },
      });
      console.log("✅ Created admin user: admin@hotelmanager.local");
    } else {
      console.log("⏭️  Admin user already exists");
    }

    // Get or create admin role
    let adminRole = await prisma.role.findUnique({
      where: { code: "admin" },
    });

    if (!adminRole) {
      adminRole = await prisma.role.create({
        data: {
          code: "admin",
          name: "Administrator",
          description: "Full system access",
          type: "admin",
          isActive: true,
        },
      });
      console.log("✅ Created admin role");
    } else {
      console.log("⏭️  Admin role already exists");
    }

    // Ensure adminUser is present
    if (!adminUser) {
      throw new Error('Failed to create or find admin user')
    }

    // Grant admin user the admin role
    const existingAdminRole = await prisma.userRole.findFirst({
      where: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    });

    if (!existingAdminRole) {
      await prisma.userRole.create({
        data: {
          userId: adminUser.id,
          userType: "admin",
          roleId: adminRole.id,
          grantedAt: new Date(),
          grantedBy: "system",
        },
      });
      console.log("✅ Granted admin role to admin user\n");
    } else {
      console.log("⏭️  Admin user already has admin role\n");
    }

    // Create test employee users
    const employees = [
      {
        email: "manager@hotelmanager.local",
        username: "manager",
        password: "manager123456",
        firstname: "John",
        lastname: "Manager",
        role: "manager",
      },
      {
        email: "kitchen@hotelmanager.local",
        username: "kitchen_staff",
        password: "kitchen123456",
        firstname: "Chef",
        lastname: "Kitchen",
        role: "kitchen_staff",
      },
      {
        email: "front_desk@hotelmanager.local",
        username: "front_desk",
        password: "desk123456",
        firstname: "Front",
        lastname: "Desk",
        role: "front_desk",
      },
      {
        email: "inventory@hotelmanager.local",
        username: "inventory_staff",
        password: "inventory123456",
        firstname: "Stock",
        lastname: "Manager",
        role: "inventory_staff",
      },
    ];

    for (const emp of employees) {
      // Create or get employee user
      let employee = await prisma.pluginUsersPermissionsUser.findUnique({
        where: { email: emp.email },
      });

      if (!employee) {
        const hashedPassword = await hashPassword(emp.password);
        employee = await prisma.pluginUsersPermissionsUser.create({
          data: {
            email: emp.email,
            username: emp.username,
            password: hashedPassword,
            firstname: emp.firstname,
            lastname: emp.lastname,
          },
        });
        console.log(`✅ Created employee: ${emp.email}`);
      } else {
        console.log(`⏭️  Employee already exists: ${emp.email}`);
      }

      // Create or get role
      let role = await prisma.role.findUnique({
        where: { code: emp.role },
      });

      if (!role) {
        role = await prisma.role.create({
          data: {
            code: emp.role,
            name: emp.role
              .split("_")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" "),
            description: `Employee role for ${emp.role}`,
            type: "employee",
            isActive: true,
          },
        });
        console.log(`✅ Created role: ${emp.role}`);
      } else {
        console.log(`⏭️  Role already exists: ${emp.role}`);
      }

      // Grant role to employee
      const existingEmpRole = await prisma.userRole.findFirst({
        where: {
          userId: employee.id,
          roleId: role.id,
        },
      });

      if (!existingEmpRole) {
        await prisma.userRole.create({
          data: {
            userId: employee.id,
            userType: "employee",
            roleId: role.id,
            grantedAt: new Date(),
            grantedBy: "system",
          },
        });
        console.log(`✅ Granted ${emp.role} role to ${emp.email}\n`);
      } else {
        console.log(
          `⏭️  ${emp.email} already has ${emp.role} role\n`
        );
      }
    }

    console.log("🎉 Seeding complete!\n");
    console.log("📋 Test Credentials:");
    console.log("   Admin: admin@hotelmanager.local / admin123456");
    console.log("   Manager: manager@hotelmanager.local / manager123456");
    console.log("   Kitchen: kitchen@hotelmanager.local / kitchen123456");
    console.log("   Front Desk: front_desk@hotelmanager.local / desk123456");
    console.log("   Inventory: inventory@hotelmanager.local / inventory123456\n");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  }
}

// Run the seed
seedAuthUsers()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

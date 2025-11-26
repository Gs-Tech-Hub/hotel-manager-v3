import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { createToken, createRefreshToken, AuthSession, setAuthCookie } from "./session";

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare password with hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Login user and create session
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; token?: string }> {
  try {
    // Try to find admin user first
    const user = await prisma.adminUser.findUnique({
      where: { email },
      include: { roles: true },
    });

    let userType: "admin" | "employee" = "admin";

    // If not found, try employee user
    if (!user) {
      const employeeUser = await prisma.pluginUsersPermissionsUser.findUnique({
        where: { email },
      });

      if (!employeeUser) {
        return { success: false, error: "Invalid email or password" };
      }

      // Verify employee password
      const isValid = await comparePassword(password, employeeUser.password);
      if (!isValid) {
        return { success: false, error: "Invalid email or password" };
      }

      userType = "employee";

      // Create session for employee
      const session: AuthSession = {
        userId: employeeUser.id,
        userType: "employee",
        email: employeeUser.email,
        firstName: employeeUser.firstname || undefined,
        lastName: employeeUser.lastname || undefined,
      };

      const accessToken = await createToken(session);
      const refreshToken = await createRefreshToken(employeeUser.id);
      await setAuthCookie(accessToken, refreshToken);

      return { success: true, token: accessToken };
    }

    // Verify admin password
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return { success: false, error: "Invalid email or password" };
    }

    // Create session for admin
    const session: AuthSession = {
      userId: user.id,
      userType: "admin",
      email: user.email,
      firstName: user.firstname || undefined,
      lastName: user.lastname || undefined,
    };

    const accessToken = await createToken(session);
    const refreshToken = await createRefreshToken(user.id);
    await setAuthCookie(accessToken, refreshToken);

    return { success: true, token: accessToken };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "Login failed" };
  }
}

/**
 * Register new employee user
 */
export async function registerEmployee(
  email: string,
  username: string,
  password: string,
  firstname?: string,
  lastname?: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  try {
    // Check if user already exists
    const existing = await prisma.pluginUsersPermissionsUser.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      return {
        success: false,
        error: "User with this email or username already exists",
      };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create employee user
    const user = await prisma.pluginUsersPermissionsUser.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstname,
        lastname,
      },
    });

    return { success: true, userId: user.id };
  } catch (error) {
    console.error("Registration error:", error);
    return { success: false, error: "Registration failed" };
  }
}

/**
 * Create admin user (for seeding)
 */
export async function createAdminUser(
  email: string,
  password: string,
  firstname?: string,
  lastname?: string,
  username?: string
): Promise<{
  success: boolean;
  error?: string;
  userId?: string;
}> {
  try {
    // Check if admin already exists
    const existing = await prisma.adminUser.findUnique({
      where: { email },
    });

    if (existing) {
      return { success: false, error: "Admin user already exists" };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create admin user
    const user = await prisma.adminUser.create({
      data: {
        email,
        password: hashedPassword,
        firstname,
        lastname,
        username: username || email.split("@")[0],
        isActive: true,
      },
    });

    return { success: true, userId: user.id };
  } catch (error) {
    console.error("Create admin error:", error);
    return { success: false, error: "Failed to create admin user" };
  }
}

/**
 * Create employee user (for seeding)
 */
export async function createEmployeeUser(
  email: string,
  password: string,
  firstname?: string,
  lastname?: string,
  username?: string
): Promise<{
  success: boolean;
  error?: string;
  userId?: string;
}> {
  try {
    // Check if employee already exists
    const existing = await prisma.pluginUsersPermissionsUser.findFirst({
      where: { OR: [{ email }, { username: username || email.split("@")[0] }] },
    });

    if (existing) {
      return { success: false, error: "Employee user already exists" };
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create employee user
    const user = await prisma.pluginUsersPermissionsUser.create({
      data: {
        email,
        password: hashedPassword,
        firstname,
        lastname,
        username: username || email.split("@")[0],
      },
    });

    return { success: true, userId: user.id };
  } catch (error) {
    console.error("Create employee error:", error);
    return { success: false, error: "Failed to create employee user" };
  }
}

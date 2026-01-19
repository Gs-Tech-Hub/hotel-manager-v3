/**
 * Role Management Service
 * Handles role creation, assignment, and management
 */

import { prisma } from '@/lib/auth/prisma';
import { errorResponse, ErrorCodes } from '@/lib/api-response';

export class RoleManagementService {
  /**
   * Get all roles
   */
  async getAllRoles() {
    try {
      return await prisma.adminRole.findMany({
        include: {
          permissions: true,
          users: {
            select: { id: true, email: true, username: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      console.error('Error fetching roles:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch roles');
    }
  }

  /**
   * Get role by code
   */
  async getRoleByCode(code: string) {
    try {
      return await prisma.adminRole.findUnique({
        where: { code },
        include: {
          permissions: true,
          users: {
            select: { id: true, email: true, username: true },
          },
        },
      });
    } catch (error) {
      console.error('Error fetching role:', error);
      return null;
    }
  }

  /**
   * Create a new role
   */
  async createRole(code: string, name: string, description?: string) {
    try {
      // Check if role already exists
      const existing = await prisma.adminRole.findUnique({ where: { code } });
      if (existing) {
        return errorResponse(ErrorCodes.RESOURCE_ALREADY_EXISTS, `Role "${code}" already exists`);
      }

      const role = await prisma.adminRole.create({
        data: {
          code,
          name,
          description,
        },
        include: {
          permissions: true,
          users: true,
        },
      });

      return role;
    } catch (error) {
      console.error('Error creating role:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create role');
    }
  }

  /**
   * Update role
   */
  async updateRole(id: string, data: { name?: string; description?: string }) {
    try {
      const role = await prisma.adminRole.update({
        where: { id },
        data,
        include: {
          permissions: true,
          users: true,
        },
      });
      return role;
    } catch (error) {
      console.error('Error updating role:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update role');
    }
  }

  /**
   * Delete role
   */
  async deleteRole(id: string) {
    try {
      // Check if role has users assigned
      const usersCount = await prisma.adminUser.count({
        where: { roles: { some: { id } } },
      });

      if (usersCount > 0) {
        return errorResponse(
          ErrorCodes.CONFLICT,
          `Cannot delete role. It is assigned to ${usersCount} user(s).`
        );
      }

      await prisma.adminRole.delete({ where: { id } });
      return { success: true };
    } catch (error) {
      console.error('Error deleting role:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to delete role');
    }
  }

  /**
   * Assign role to user
   */
  async assignRoleToUser(userId: string, roleId: string) {
    try {
      // Verify user exists
      const user = await prisma.adminUser.findUnique({ where: { id: userId } });
      if (!user) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'User not found');
      }

      // Verify role exists
      const role = await prisma.adminRole.findUnique({ where: { id: roleId } });
      if (!role) {
        return errorResponse(ErrorCodes.NOT_FOUND, 'Role not found');
      }

      // Check if user already has this role
      const userWithRole = await prisma.adminUser.findFirst({
        where: {
          id: userId,
          roles: { some: { id: roleId } },
        },
      });

      if (userWithRole) {
        return errorResponse(ErrorCodes.RESOURCE_ALREADY_EXISTS, 'User already has this role');
      }

      // Assign role
      const updated = await prisma.adminUser.update({
        where: { id: userId },
        data: {
          roles: { connect: { id: roleId } },
        },
        include: { roles: true },
      });

      return updated;
    } catch (error) {
      console.error('Error assigning role:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to assign role');
    }
  }

  /**
   * Revoke role from user
   */
  async revokeRoleFromUser(userId: string, roleId: string) {
    try {
      const updated = await prisma.adminUser.update({
        where: { id: userId },
        data: {
          roles: { disconnect: { id: roleId } },
        },
        include: { roles: true },
      });

      return updated;
    } catch (error) {
      console.error('Error revoking role:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to revoke role');
    }
  }

  /**
   * Get user roles
   */
  async getUserRoles(userId: string) {
    try {
      const user = await prisma.adminUser.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: { permissions: true },
          },
        },
      });

      return user?.roles || [];
    } catch (error) {
      console.error('Error fetching user roles:', error);
      return [];
    }
  }

  /**
   * Batch assign roles to user (overwrites existing)
   */
  async setUserRoles(userId: string, roleIds: string[]) {
    try {
      const updated = await prisma.adminUser.update({
        where: { id: userId },
        data: {
          roles: {
            set: roleIds.map(id => ({ id })),
          },
        },
        include: { roles: true },
      });

      return updated;
    } catch (error) {
      console.error('Error setting user roles:', error);
      return errorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to set user roles');
    }
  }
}

export const roleManagementService = new RoleManagementService();

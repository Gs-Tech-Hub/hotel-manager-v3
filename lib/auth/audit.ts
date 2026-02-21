/**
 * RBAC Audit Logger
 * 
 * Tracks role and permission changes for compliance and debugging.
 * Logs to console, file, or external service.
 * 
 * Usage:
 *   await logAudit({
 *     action: 'role_granted',
 *     targetUserId: 'user123',
 *     roleId: 'role456',
 *     grantedBy: 'admin123'
 *   });
 */

export interface AuditLog {
  // RBAC actions
  action: "role_granted" | "role_revoked" | "permission_granted" | "permission_revoked" | "role_created" | "role_updated" | 
    // Generic service actions
    string;
  userId?: string;
  targetUserId?: string;
  roleId?: string;
  permissionId?: string;
  departmentId?: string;
  resourceType?: string;
  resourceId?: string;
  grantedBy?: string;
  revokedBy?: string;
  metadata?: Record<string, any>;
  changes?: Record<string, any>;
  timestamp?: Date;
}

interface AuditConfig {
  enableConsole?: boolean;
  enableFile?: boolean;
  enableExternal?: boolean;
  filePath?: string;
  externalService?: (log: AuditLog) => Promise<void>;
}

let auditConfig: AuditConfig = {
  enableConsole: true,
  enableFile: false,
};

/**
 * Configure audit logging.
 * 
 * @param config Audit configuration
 */
export function configureAudit(config: AuditConfig) {
  auditConfig = { ...auditConfig, ...config };
  console.log("[AUDIT] Audit logging configured:", auditConfig);
}

/**
 * Log an audit event.
 * 
 * @param log Audit log entry
 */
export async function logAudit(log: AuditLog): Promise<void> {
  const timestamp = log.timestamp || new Date();
  const auditEntry = {
    ...log,
    timestamp,
    formattedTime: timestamp.toISOString(),
  };

  try {
    // Log to console
    if (auditConfig.enableConsole) {
      const color = getColorForAction(log.action);
      console.log(`${color}[AUDIT]${reset} ${formatAuditLog(auditEntry)}`);
    }

    // Log to file
    if (auditConfig.enableFile && auditConfig.filePath) {
      // Implementation for file logging would go here
      // For now, just mark as available
    }

    // Log to external service
    if (auditConfig.enableExternal && auditConfig.externalService) {
      await auditConfig.externalService(auditEntry);
    }
  } catch (error) {
    console.error("[AUDIT] Error logging audit entry:", error);
  }
}

/**
 * Log role grant.
 * 
 * @param targetUserId User receiving the role
 * @param roleId Role ID
 * @param grantedBy Admin user granting the role
 * @param departmentId Optional department scope
 */
export async function logRoleGranted(
  targetUserId: string,
  roleId: string,
  grantedBy: string,
  departmentId?: string
): Promise<void> {
  await logAudit({
    action: "role_granted",
    targetUserId,
    roleId,
    grantedBy,
    departmentId,
  });
}

/**
 * Log role revocation.
 * 
 * @param targetUserId User losing the role
 * @param roleId Role ID
 * @param revokedBy Admin user revoking the role
 * @param departmentId Optional department scope
 */
export async function logRoleRevoked(
  targetUserId: string,
  roleId: string,
  revokedBy: string,
  departmentId?: string
): Promise<void> {
  await logAudit({
    action: "role_revoked",
    targetUserId,
    roleId,
    revokedBy,
    departmentId,
  });
}

/**
 * Log permission grant.
 * 
 * @param targetUserId User receiving the permission
 * @param permissionId Permission ID
 * @param grantedBy Admin user granting the permission
 * @param departmentId Optional department scope
 */
export async function logPermissionGranted(
  targetUserId: string,
  permissionId: string,
  grantedBy: string,
  departmentId?: string
): Promise<void> {
  await logAudit({
    action: "permission_granted",
    targetUserId,
    permissionId,
    grantedBy,
    departmentId,
  });
}

/**
 * Log permission revocation.
 * 
 * @param targetUserId User losing the permission
 * @param permissionId Permission ID
 * @param revokedBy Admin user revoking the permission
 * @param departmentId Optional department scope
 */
export async function logPermissionRevoked(
  targetUserId: string,
  permissionId: string,
  revokedBy: string,
  departmentId?: string
): Promise<void> {
  await logAudit({
    action: "permission_revoked",
    targetUserId,
    permissionId,
    revokedBy,
    departmentId,
  });
}

/**
 * Log role creation.
 * 
 * @param roleId New role ID
 * @param roleCode Role code
 * @param roleName Role name
 * @param createdBy User creating the role
 */
export async function logRoleCreated(
  roleId: string,
  roleCode: string,
  roleName: string,
  createdBy: string
): Promise<void> {
  await logAudit({
    action: "role_created",
    targetUserId: roleId,
    grantedBy: createdBy,
    metadata: { roleCode, roleName },
  });
}

/**
 * Format audit log entry for console output.
 * 
 * @param log Audit log entry
 * @returns Formatted string
 */
function formatAuditLog(log: AuditLog & { formattedTime: string }): string {
  const { action, targetUserId, roleId, permissionId, grantedBy, revokedBy, departmentId, formattedTime } = log;

  const actor = grantedBy || revokedBy || "system";
  const scope = departmentId ? ` [dept: ${departmentId}]` : "";

  switch (action) {
    case "role_granted":
      return `${action}: ${actor} → ${targetUserId} (role: ${roleId})${scope} at ${formattedTime}`;
    case "role_revoked":
      return `${action}: ${actor} ← ${targetUserId} (role: ${roleId})${scope} at ${formattedTime}`;
    case "permission_granted":
      return `${action}: ${actor} → ${targetUserId} (perm: ${permissionId})${scope} at ${formattedTime}`;
    case "permission_revoked":
      return `${action}: ${actor} ← ${targetUserId} (perm: ${permissionId})${scope} at ${formattedTime}`;
    case "role_created":
      return `${action}: ${actor} created new role (id: ${targetUserId}) at ${formattedTime}`;
    case "role_updated":
      return `${action}: ${actor} updated role (id: ${targetUserId}) at ${formattedTime}`;
    default:
      return `${action} on ${targetUserId} by ${actor} at ${formattedTime}`;
  }
}

/**
 * Get console color code for action type.
 * 
 * @param action Audit action type
 * @returns ANSI color code
 */
function getColorForAction(action: string): string {
  switch (action) {
    case "role_granted":
    case "permission_granted":
      return "\x1b[32m"; // Green
    case "role_revoked":
    case "permission_revoked":
      return "\x1b[31m"; // Red
    case "role_created":
    case "role_updated":
      return "\x1b[36m"; // Cyan
    default:
      return "\x1b[33m"; // Yellow
  }
}

const reset = "\x1b[0m";

/**
 * Query audit logs (placeholder for external audit system).
 * 
 * @param filters Query filters (userId, action, dateRange, etc.)
 * @returns Array of audit logs
 */
export async function queryAuditLogs(filters?: {
  targetUserId?: string;
  action?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<AuditLog[]> {
  // This is a placeholder. In production, you'd query your audit log storage
  // (database, external service, etc.)
  console.log("[AUDIT] Query logs called with filters:", filters);
  return [];
}

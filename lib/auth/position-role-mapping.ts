/**
 * Position-to-Role Mapping Configuration
 * 
 * Defines standardized employee positions and their corresponding system roles.
 * Positions are used as a dropdown in employee forms to ensure consistency.
 * This prevents role assignment mismatches due to typos or variations.
 * 
 * Example:
 * - Position "Chef" → role "kitchen_staff"
 * - Position "Manager" → role "manager"
 * - Position "Bartender" → role "bar_staff"
 */

import { prisma } from "@/lib/auth/prisma";

export type Position = {
  id: string;
  name: string;
  roleCode: string;
  description?: string;
};

export type PositionRoleMapping = {
  position: string;
  roleCode: string;
};

/**
 * Standardized positions available in the system
 * These are the ONLY positions that can be assigned to employees
 * To add a new position, add it here and deploy
 */
export const STANDARDIZED_POSITIONS: Position[] = [
  // Management
  { id: "manager", name: "Manager", roleCode: "manager", description: "Hotel/Department Manager" },
  { id: "assistant_manager", name: "Assistant Manager", roleCode: "staff", description: "Assistant Manager" },
  
  // Kitchen
  { id: "chef", name: "Chef", roleCode: "kitchen_staff", description: "Head Chef / Kitchen Manager" },
  { id: "kitchen_staff", name: "Kitchen Staff", roleCode: "kitchen_staff", description: "Kitchen Cook/Prep" },
  { id: "sous_chef", name: "Sous Chef", roleCode: "kitchen_staff", description: "Sous Chef" },
  
  // Bar
  { id: "bartender", name: "Bartender", roleCode: "bar_staff", description: "Bartender" },
  { id: "bar_staff", name: "Bar Staff", roleCode: "bar_staff", description: "Bar Assistant" },
  { id: "mixologist", name: "Mixologist", roleCode: "bar_staff", description: "Mixologist / Bartender" },
  
  // POS / Cashier
  { id: "cashier", name: "Cashier", roleCode: "cashier", description: "POS Cashier / Register Operator" },
  { id: "pos_operator", name: "POS Operator", roleCode: "pos_staff", description: "Point of Sale Operator" },
  
  // Customer Service
  { id: "customer_service", name: "Customer Service", roleCode: "customer_service", description: "Customer Service Representative" },
  { id: "receptionist", name: "Receptionist", roleCode: "front_desk", description: "Front Desk Receptionist" },
  
  // Front Desk
  { id: "front_desk", name: "Front Desk", roleCode: "front_desk", description: "Front Desk Staff" },
  { id: "concierge", name: "Concierge", roleCode: "front_desk", description: "Concierge" },
  
  // Housekeeping
  { id: "housekeeping", name: "Housekeeping", roleCode: "housekeeping_staff", description: "Housekeeper" },
  { id: "housekeeper", name: "Housekeeper", roleCode: "housekeeping_staff", description: "Housekeeping Staff" },
  { id: "housekeeping_supervisor", name: "Housekeeping Supervisor", roleCode: "housekeeping_staff", description: "Housekeeping Supervisor" },
  
  // General
  { id: "staff", name: "Staff", roleCode: "staff", description: "General Staff Member" },
  { id: "employee", name: "Employee", roleCode: "employee", description: "Employee" },
];

/**
 * Get role code for a position
 * Matches against standardized positions only
 */
export function getRoleForPosition(position: string): string | null {
  if (!position) return null;

  // Find exact match (case-insensitive)
  const positionRecord = STANDARDIZED_POSITIONS.find(
    (p) => p.name.toLowerCase() === position.toLowerCase()
  );

  return positionRecord?.roleCode || null;
}

/**
 * Get all standardized positions
 */
export function getAllPositions(): Position[] {
  return STANDARDIZED_POSITIONS;
}

/**
 * Get position by ID
 */
export function getPositionById(id: string): Position | undefined {
  return STANDARDIZED_POSITIONS.find((p) => p.id === id);
}

/**
 * Get position by name
 */
export function getPositionByName(name: string): Position | undefined {
  return STANDARDIZED_POSITIONS.find(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Validate if a position is in the standardized list
 */
export function isValidPosition(position: string): boolean {
  return !!STANDARDIZED_POSITIONS.find(
    (p) => p.name.toLowerCase() === position.toLowerCase()
  );
}

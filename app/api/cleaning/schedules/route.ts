import { NextRequest } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { sendSuccess, sendError } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

/**
 * GET /api/rooms/maintenance
 * Get all maintenance tasks for rooms
 * 
 * Query params:
 * - unitId: Filter by unit ID
 * - status: Filter by status (CLEANING, MAINTENANCE, etc)
 */
export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const status = searchParams.get('status');

		const where: any = {};
		if (status) where.status = status;

		// Get units with specific status (CLEANING, MAINTENANCE, etc.)
		const units = await prisma.unit.findMany({
			where,
			include: {
				roomType: true,
				department: true,
			},
			orderBy: { roomNumber: 'asc' },
		});

		return sendSuccess(units, 'Maintenance tasks fetched');
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to fetch maintenance tasks';
		return sendError(ErrorCodes.INTERNAL_ERROR, message);
	}
}


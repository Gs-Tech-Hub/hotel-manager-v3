import { NextRequest } from 'next/server';
import { prisma } from '@/lib/auth/prisma';
import { sendSuccess, sendError } from '@/lib/api-handler';
import { ErrorCodes } from '@/lib/api-response';

/**
 * GET /api/cleaning/schedules
 * Get cleaning schedules for a unit
 * 
 * Query params:
 * - unitId: Filter by unit ID
 * - status: Filter by status (pending, in_progress, completed)
 */
export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const unitId = searchParams.get('unitId');
		const status = searchParams.get('status');

		const where: any = {};
		if (unitId) where.unitId = unitId;
		if (status) where.status = status;

		const schedules = await prisma.cleaningSchedule.findMany({
			where,
			orderBy: { scheduledDate: 'desc' },
		});

		return sendSuccess(schedules, 'Cleaning schedules fetched');
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to fetch schedules';
		return sendError(ErrorCodes.INTERNAL_ERROR, message);
	}
}

/**
 * POST /api/cleaning/schedules
 * Create a new cleaning schedule
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();

		if (!body.unitId || !body.scheduledDate) {
			return sendError(
				ErrorCodes.BAD_REQUEST,
				'Missing required fields: unitId, scheduledDate'
			);
		}

		const schedule = await prisma.cleaningSchedule.create({
			data: {
				unitId: body.unitId,
				scheduledDate: new Date(body.scheduledDate),
				status: body.status || 'pending',
				notes: body.notes || null,
				assignedTo: body.assignedTo || null,
			},
		});

		return sendSuccess(schedule, 'Cleaning schedule created', 201);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to create schedule';
		return sendError(ErrorCodes.INTERNAL_ERROR, message);
	}
}

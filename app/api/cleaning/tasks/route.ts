/**
 * GET /api/cleaning/tasks - List cleaning tasks
 * POST /api/cleaning/tasks - Create cleaning task
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractUserContext } from '@/lib/user-context';
import { cleaningService } from '@/src/services/CleaningService';
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const departmentId = searchParams.get('departmentId');
    const status = searchParams.get('status');

    // Get pending tasks
    const tasks = await cleaningService.getPendingTasks(departmentId || undefined);

    // Filter by status if provided
    const filtered = status
      ? tasks.filter((t) => t.status === status)
      : tasks;

    return NextResponse.json(
      successResponse({ data: filtered }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching cleaning tasks:', error);
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, error instanceof Error ? error.message : 'Unknown error'),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Extract user context
    const ctx = await extractUserContext(request);
    if (!ctx.userId) {
      return NextResponse.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { unitId, taskType, priority, notes } = body;

    // Validate required fields
    if (!unitId || !taskType) {
      return NextResponse.json(
        errorResponse(ErrorCodes.BAD_REQUEST, 'unitId and taskType are required'),
        { status: 400 }
      );
    }

    // Create task
    const task = await cleaningService.createTask(
      { unitId, taskType, priority, notes },
      { userId: ctx.userId, userType: (ctx.userRole as any) || 'employee' }
    );

    return NextResponse.json(
      successResponse({ data: task, message: 'Cleaning task created successfully' }),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating cleaning task:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    if (errorMsg.includes('Insufficient permissions')) {
      return NextResponse.json(
        errorResponse(ErrorCodes.FORBIDDEN, errorMsg),
        { status: 403 }
      );
    }

    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, errorMsg),
      { status: 500 }
    );
  }
}

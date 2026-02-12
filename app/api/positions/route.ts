import { NextResponse } from 'next/server';
import { getAllPositions } from '@/lib/auth/position-role-mapping';
import { successResponse } from '@/lib/api-response';

/**
 * GET /api/positions
 * Returns all standardized positions available in the system
 * Used by employee form dropdowns to ensure position consistency
 */
export async function GET() {
  try {
    const positions = getAllPositions();
    
    return NextResponse.json(
      successResponse({
        data: {
          positions: positions.map(p => ({
            id: p.id,
            name: p.name,
            roleCode: p.roleCode,
            description: p.description,
          })),
          total: positions.length,
        },
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching positions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}

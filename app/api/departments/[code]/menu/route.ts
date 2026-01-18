import { NextRequest, NextResponse } from 'next/server'
import { departmentService } from '@/services/department.service'
import { getStatusCode } from '@/src/lib/api-response'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params

    // Normalize/decode the incoming code param like other department routes.
    // Some clients double-encode path segments which leads to mismatches
    // against stored department codes (which may contain ':' characters).
    // Decode repeatedly until stable (max 3 iterations) to be robust.
    let lookupCode = code
    try {
      for (let i = 0; i < 3; i++) {
        const decoded = decodeURIComponent(lookupCode)
        if (decoded === lookupCode) break
        lookupCode = decoded
      }
    } catch (e) {
      // ignore decode errors and fall back to raw code
      lookupCode = code
    }

    const menu = await departmentService.getDepartmentMenu(lookupCode)
    if (!menu) {
      return NextResponse.json(
        { success: false, error: 'No menu available' },
        { status: 404 }
      )
    }

    // If errorResponse shape returned (object with error), forward it with appropriate status
    if ((menu as any)?.error) {
      const errorCode = (menu as any)?.error?.code || 'INTERNAL_ERROR'
      const statusCode = getStatusCode(errorCode)
      return NextResponse.json(
        { success: false, error: (menu as any).error },
        { status: statusCode }
      )
    }

    return NextResponse.json({ success: true, department: code, data: menu })
  } catch (err) {
    console.error('GET /api/departments/[code]/menu error', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

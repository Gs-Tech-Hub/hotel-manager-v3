import { NextRequest, NextResponse } from 'next/server'
import { departmentService } from '@/services/department.service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params

    const menu = await departmentService.getDepartmentMenu(code)
    if (!menu) return NextResponse.json({ success: false, error: 'No menu available' }, { status: 404 })

    // If errorResponse shape returned (object with error), forward it
    if ((menu as any)?.error) {
      return NextResponse.json({ success: false, error: (menu as any).error }, { status: 400 })
    }

    return NextResponse.json({ success: true, department: code, data: menu })
  } catch (err) {
    console.error('GET /api/departments/[code]/menu error', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const terminals = await prisma.terminal.findMany({ include: { department: true }, take: 20 })
    const departments = await prisma.department.findMany({
      where: {
        OR: [
          { code: { startsWith: 'restaurant' } },
          { code: { startsWith: 'bar' } },
          { code: 'restaurant' },
          { code: 'bar-and-clubs' },
        ],
      },
      take: 30,
    })

    return NextResponse.json({
      terminalsCount: terminals.length,
      terminals: terminals.map((t) => ({ id: t.id, name: t.name, departmentId: t.departmentId, dept: t.department?.code })),
      departmentsCount: departments.length,
      departments: departments.map((d) => ({ id: d.id, code: d.code, name: d.name })),
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

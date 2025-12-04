import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/middleware';
import { deleteSection } from '@/src/services/admin/departmentSections';

export const DELETE = withPermission(
  async (req, ctx) => {
    try {
      const { params } = ctx;
      const id = params?.id;
      
      if (!id) return NextResponse.json({ error: 'Missing section id' }, { status: 400 });

      const section = await deleteSection(id, { userId: ctx.userId, userType: ctx.userType });

      return NextResponse.json({ success: true, data: section }, { status: 200 });
    } catch (error) {
      console.error('[ADMIN] Delete department section error:', error);
      return NextResponse.json({ error: 'Failed to delete department section' }, { status: 500 });
    }
  },
  'department_sections.delete'
);

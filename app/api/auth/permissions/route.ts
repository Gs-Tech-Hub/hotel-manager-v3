import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getUserPermissions } from '@/lib/auth/rbac';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ permissions: [] }, { status: 200 });
    }

    const ctx = {
      userId: session.userId,
      userType: session.userType,
      departmentId: session.departmentId || undefined,
    };

    const perms = await getUserPermissions(ctx);

    return NextResponse.json({ permissions: perms }, { status: 200 });
  } catch (err) {
    console.error('[AUTH] Failed to fetch permissions:', err);
    return NextResponse.json({ permissions: [] }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { logUserActivity } from '@/lib/logger';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, details } = await req.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    await logUserActivity(session.user.id, action, details);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to log action:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

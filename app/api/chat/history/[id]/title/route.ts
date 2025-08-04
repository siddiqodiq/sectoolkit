import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/db'
import { authOptions } from '@/lib/auth'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const { title } = await request.json();

    if (!title || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Update chat title
    const updatedChat = await prisma.chat.update({
      where: {
        id,
        userId: session.user.id, // Ensure user owns the chat
      },
      data: {
        title: title.trim(),
      },
    });

    return NextResponse.json({ success: true, chat: updatedChat });
  } catch (error) {
    console.error('Error updating chat title:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
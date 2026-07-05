import prisma from './db';

export async function logUserActivity(userId: string, action: string, details?: string) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        details,
      },
    });
  } catch (error) {
    console.error('Failed to log user activity:', error);
  }
}

import prisma from './db';

// Audit log bersifat fire-and-forget: penulisan ke DB TIDAK boleh memblok
// aksi user (mis. start scan). Kalau koneksi Postgres lambat/macet di
// production, request tetap lanjut ke backend tanpa menunggu log selesai.
// Await pada pemanggil akan resolve seketika karena kita tidak menunggu
// promise DB di sini.
export async function logUserActivity(userId: string, action: string, details?: string) {
  const TIMEOUT_MS = 5000;

  const write = prisma.activityLog.create({
    data: {
      userId,
      action,
      details,
    },
  });

  // Batasi umur promise agar koneksi "basi" tidak menggantung selamanya,
  // dan pastikan setiap error/timeout tertangkap (bukan unhandled rejection).
  const guarded = Promise.race([
    write,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('activity log write timed out')), TIMEOUT_MS),
    ),
  ]).catch((error) => {
    console.error('Failed to log user activity:', error);
  });

  // Sengaja TIDAK di-await: biarkan berjalan di background.
  void guarded;
}

import prisma from '@/lib/db'

// Fungsi untuk mendapatkan ringkasan percakapan
export async function getChatSummary(chatId: string): Promise<string> {
  const messages = await prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: 'asc' },
    take: 5, // Ambil 5 pesan pertama untuk ringkasan
    select: { content: true, role: true }
  })

  return messages.map(msg => 
    `${msg.role === 'USER' ? 'User' : 'AI'}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`
  ).join('\n')
}

// Fungsi untuk membersihkan history yang lama
export async function cleanupOldMessages(chatId: string, maxMessages = 100): Promise<void> {
  const messageCount = await prisma.message.count({
    where: { chatId }
  })

  if (messageCount <= maxMessages) return

  // Hitung berapa banyak yang perlu dihapus
  const deleteCount = messageCount - maxMessages

  // Dapatkan ID pesan terlama
  const oldestMessages = await prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: 'asc' },
    take: deleteCount,
    select: { id: true }
  })

  // Hapus pesan terlama
  await prisma.message.deleteMany({
    where: {
      id: { in: oldestMessages.map(m => m.id) }
    }
  })
}

// Fungsi untuk mendapatkan konteks relevan
export async function getRelevantContext(chatId: string, currentMessage: string): Promise<any[]> {
  // Pertama dapatkan pesan terakhir sebagai konteks dasar
  const lastMessages = await prisma.message.findMany({
    where: { chatId },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { content: true, role: true }
  })

  // Kemudian cari pesan relevan berdasarkan kesamaan kata kunci
  const keywords = currentMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  
  if (keywords.length > 0) {
    const relevantMessages = await prisma.message.findMany({
      where: {
        chatId,
        OR: keywords.map(keyword => ({
          content: { contains: keyword, mode: 'insensitive' }
        }))
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { content: true, role: true }
    })

    // Gabungkan hasil, hilangkan duplikat
    const uniqueMessages = [...lastMessages, ...relevantMessages].reduce((acc, msg) => {
      if (!acc.some(m => m.content === msg.content)) {
        acc.push(msg)
      }
      return acc
    }, [] as any[])

    return uniqueMessages.slice(0, 8) // Batasi maksimal 8 pesan konteks
  }

  return lastMessages
}
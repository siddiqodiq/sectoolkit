/*
  Warnings:

  - You are about to drop the `chats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `knowledge_files` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `messages` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "chats" DROP CONSTRAINT "chats_userId_fkey";

-- DropForeignKey
ALTER TABLE "knowledge_files" DROP CONSTRAINT "knowledge_files_userId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_chatId_fkey";

-- DropTable
DROP TABLE "chats";

-- DropTable
DROP TABLE "knowledge_files";

-- DropTable
DROP TABLE "messages";

-- DropEnum
DROP TYPE "MessageRole";

#!/bin/sh
# ... (bagian copy .env tidak berubah)
if [ ! -f .env ]; then
  echo "Copying .env.example to .env"
  cp .env.example .env
fi

# Wait for PostgreSQL
echo "Waiting for PostgreSQL to be ready..."
while ! nc -z postgres 5432; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done
echo "PostgreSQL is up!"

# ✅ Tunggu ChromaDB service siap
echo "Waiting for ChromaDB to be ready..."
while ! nc -z chromadb 8000; do
  echo "ChromaDB is unavailable - sleeping"
  sleep 2
done
echo "ChromaDB is up!"

# ❌ Hapus semua bagian yang menjalankan server chroma
# mkdir -p ./db/chroma_langchain_db (HAPUS)
# nohup python3 -m chromadb.cli.cli run ... (HAPUS)

# Deploy migrations
echo "Deploying migrations..."
pnpm prisma migrate deploy

# Generate Prisma client
echo "Generating Prisma client..."
pnpm prisma generate

# Start Next.js app
echo "Starting Next.js application..."
exec pnpm start
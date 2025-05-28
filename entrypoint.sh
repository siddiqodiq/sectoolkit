#!/bin/sh

# Tunggu database siap
while ! nc -z postgres 5432; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done

# Jalankan migrasi database
pnpm prisma migrate deploy

# Start aplikasi
exec pnpm start
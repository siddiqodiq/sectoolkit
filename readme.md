# 🕵️ Pungoe – Setup & Instalasi Docker
EN [Read English Version](readme.en.md)

Repositori ini merupakan proyek `Pungoe`, aplikasi uji penetrasi web dengan arsitektur berbasis layanan terpisah (multi-container) menggunakan Docker Compose.

---
## 🎬 Video Overview

[![Video Overview](https://img.youtube.com/vi/Pf6gngLtV3E/0.jpg)](https://youtu.be/Pf6gngLtV3E)

## 🎬 Panduan Instalasi

### 📺 Video Tutorial Singkat

👉 [Tonton di YouTube](https://youtu.be/zldi5sw7ACU)

---

## 📋 Prasyarat Sistem

### 💻 Sistem Operasi

* Windows
* Linux
* macOS

### 🔧 Perangkat Lunak

| Software           | Fungsi                                                                                              |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| **Docker**         | Menyediakan lingkungan kontainerisasi untuk menjalankan aplikasi tanpa instalasi manual dependensi. |
| **Docker Compose** | Menjalankan dan mengelola beberapa container sekaligus.                                             |
| **Git**            | Untuk mengkloning repositori dari GitHub.                                                           |
| **Web Browser**    | Untuk mengakses aplikasi di `localhost:3000`. Bebas menggunakan Chrome, Firefox, Edge, Safari, dll. |

### 🌐 Koneksi Internet

* Disarankan menggunakan **VPN**, terutama pada jaringan terbatas seperti **WiFi Kampus**.
* Pastikan port berikut **tidak bentrok** dengan aplikasi lain:

  * `3000` → Aplikasi utama
  * `5000` → Tools pentest (Flask)
  * `5432` → PostgreSQL

> ❗ **Catatan penting:** Anda **wajib menggunakan VPN** agar dependensi dan koneksi yang dibutuhkan dapat berjalan dengan baik.

---

## 🛠️ Langkah Instalasi

### 1. Clone Repositori

```bash
git clone https://github.com/siddiqodiq/pungoe.git
cd pungoe
```

### 2. Siapkan File Environment

```bash
cp .env.example .env
```

Edit file `.env` sesuai kebutuhan, misalnya untuk konfigurasi database atau endpoint tools.

---

### 3. Jalankan Docker Compose

```bash
docker compose build
```

Kemudian jalankan container:

```bash
docker compose up -d
```

Docker akan mem-build dan menjalankan 3 layanan:

* `postgres` → Database PostgreSQL
* `app` → Frontend + backend (Next.js)
* `kali-tools` → Tools uji penetrasi berbasis Flask (Kali Linux)


#### 🔍 Cek Status Container

* **GUI**: Cek lewat Docker Desktop lewat menu container.
* **CLI**: Jalankan `docker ps`.

---



## 📂 Struktur Layanan

```yaml
- postgres     (Port 5432)
- app          (Port 3000)
- kali-tools   (Port 5000)
```

---

## 🧪 Akses Aplikasi

Setelah semua container berjalan, buka:

* Aplikasi utama:

  ```
  http://localhost:3000
  ```

* API Tools Pentest (Flask):

  ```
  http://localhost:5000
  ```

---

## 🐘 Error: PostgreSQL Authentication Failed

<img src="https://github.com/user-attachments/assets/eb0126c9-a22f-47b4-b934-dc9fe23e0586" width="300" />

Jika Anda melihat error seperti:

```bash
FATAL:  password authentication failed for user "postgres"
DETAIL:  Connection matched pg_hba.conf line 100: "host all all all scram-sha-256"
```

Dan aplikasi gagal konek ke database, kemungkinan besar **PostgreSQL lokal Anda bentrok** dengan container PostgreSQL.

### 🛠️ Solusi

1. Buka `services.msc` (Win + R), cari layanan **PostgreSQL**.

2. Klik kanan → **Stop** atau **Disable**.

3. Jalankan ulang Docker:

   ```bash
   docker compose down
   docker compose up --build
   ```

4. Jika masih error, hapus container:

   ```bash
   docker compose down -v
   docker compose up --build
   ```

---

## ❓ Troubleshooting

* Pastikan `.env` sesuai konfigurasi jaringan dan database.
* Gunakan `docker logs <nama_container>` untuk melihat log error.
* Rebuild paksa jika perlu:

  ```bash
  docker compose down -v
  docker compose up --build
  ```

---


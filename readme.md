Berikut adalah contoh isi README dalam **Bahasa Indonesia** untuk panduan instalasi dan penggunaan Docker Compose proyek **[pungoe](https://github.com/siddiqodiq/pungoe)**, lengkap dengan catatan penting mengenai penggunaan VPN dan integrasi manual `ollama` dan `pentest-ai`.

---

# 🐘 Pungoe – Setup & Instalasi Docker

Repositori ini merupakan proyek `Pungoe`, aplikasi uji penetrasi web dengan arsitektur berbasis layanan terpisah (multi-container) menggunakan Docker Compose.

## 📋 Prasyarat

Pastikan Anda sudah menginstal:

* [Docker](https://www.docker.com/)
* [Docker Compose](https://docs.docker.com/compose/)
* [Git](https://git-scm.com/)
* VPN aktif jika Anda menggunakan jaringan **WiFi PSSN**

> ❗ **Catatan penting:** Jika Anda menggunakan WiFi PSSN, Anda **wajib menggunakan VPN** agar dependensi dan koneksi yang dibutuhkan dapat berjalan dengan baik.

---

## 🛠️ Langkah Instalasi

### 1. Clone repositori

```bash
git clone https://github.com/siddiqodiq/pungoe.git
cd pungoe
```

### 2. Siapkan file environment

Ubah nama file `.env.example` menjadi `.env`:

```bash
cp .env.example .env
```

Edit nilai-nilai yang diperlukan di dalam `.env` sesuai kebutuhan Anda.

---

### 3. Jalankan Docker Compose

```bash
docker compose build
```

Setelah proses build selesai, jalankan container dengan:

```bash
docker compose up -d
```

Docker akan mem-build dan menjalankan 3 layanan:

* `postgres`: Database PostgreSQL
* `app`: Aplikasi frontend + backend Next.js
* `kali-tools`: Layanan tools uji penetrasi berbasis Flask + Kali Linux

> 📦 Folder `uploads/` dan `kali-tools/` otomatis akan di-mount ke dalam kontainer `kali-tools`.

---

Siap! Berikut pembaruan penjelasan di README (dalam Bahasa Indonesia) untuk penggunaan **Ollama** dan model **Pentest-AI** berbasis Hugging Face, **dengan perintah `ollama run` dan `ollama serve`**:

---

## 🧠 Pentest-AI dan Ollama (Manual) -> instalasi manual tanpa docker

Layanan **Ollama** dan model **Pentest-AI** tidak disertakan dalam Docker Compose. Anda perlu menginstalnya **secara manual di luar container**.

### 🔧 Langkah Instalasi Model Pentest-AI

1. **Install Ollama** terlebih dahulu sesuai sistem operasi Anda:
   👉 [https://ollama.com/download](https://ollama.com/download)

2. **Download model Pentest-AI dari Hugging Face** menggunakan perintah:

   ```bash
   ollama run hf.co/mav23/Pentest_AI-GGUF:Q4_K_M
   ```

   Ini akan mengunduh dan menyiapkan model.

3. Setelah model berhasil diunduh, jalankan **Ollama sebagai server**:

   ```bash
   ollama serve
   ```

   Server akan berjalan di `http://localhost:11434` secara default.

---

### 🌐 Mengakses dari Dalam Docker (masih dalam tahap perbaikan) 🟨

Karena **Ollama berjalan di luar container**, aplikasi di dalam Docker harus menggunakan alamat khusus ini untuk mengakses Ollama:

```bash
http://host.docker.internal:11434
```

> Pastikan port 11434 tidak diblokir oleh firewall dan model sudah aktif (`ollama serve` sedang berjalan).

---

Jika kamu ingin, saya juga bisa bantu membuat [script startup otomatis](f) untuk menjalankan `ollama serve` saat booting atau [template koneksi Ollama di kode Next.js](f).


## 📂 Struktur Layanan

```yaml
- postgres (Port 5432)
- app (Port 3000)
- kali-tools (Port 5000)
```

---

## 🧪 Akses Aplikasi

Setelah semua container berjalan, buka aplikasi Anda di:

```
http://localhost:3000
```

Endpoint API `kali-tools` dapat diakses di:

```
http://localhost:5000
```

---

## ❓ Troubleshooting

* Pastikan VPN aktif saat menggunakan jaringan terbatas seperti WiFi kampus/PSSN.
* Cek `.env` jika koneksi ke database atau tools gagal.
* Untuk rebuild paksa:

  ```bash
  docker compose down -v
  docker compose up --build
  ```


Berikut revisi lanjutan bagian dokumentasi yang menjelaskan solusi saat terjadi error pada koneksi ke PostgreSQL:

---

## 🐘 Error: PostgreSQL Authentication Failed
![Screenshot 2025-05-31 133147](https://github.com/user-attachments/assets/eb0126c9-a22f-47b4-b934-dc9fe23e0586)

Jika Anda melihat error seperti berikut pada log saat menjalankan Docker:

```bash
pungoe_postgres    | FATAL:  password authentication failed for user "postgres"
pungoe_postgres    | DETAIL:  Connection matched pg_hba.conf line 100: "host all all all scram-sha-256"
```

Atau:

```bash
pungoe_app         |  ✓ Ready in 543ms
```

Namun aplikasi tidak dapat terkoneksi ke database, **kemungkinan besar PostgreSQL di sistem lokal Anda sedang berjalan sebagai layanan (service)** dan bentrok dengan container PostgreSQL.

### 🛠️ Solusi:

1. Tekan `Win + R`, lalu ketik:

   ```
   services.msc
   ```
2. Cari layanan bernama **PostgreSQL**.
3. Klik kanan → **Stop** atau atur ke **Disabled** agar tidak otomatis berjalan.
4. Jalankan ulang Docker Compose Anda:

   ```bash
   docker-compose down
   docker-compose up --build
   ```
5. Jika masih error, hapus container dan build ulang
Hal ini akan memastikan koneksi database mengarah ke PostgreSQL dalam Docker, bukan layanan lokal di Windows.


---

Jika Anda butuh panduan tambahan seperti struktur `.env` atau cara testing koneksi antar service, beri tahu saya! Saya bisa bantu buat [contoh isi .env](f) atau [diagram arsitektur Docker](f).

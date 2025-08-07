# 🕵️ Pungoe – Setup & Instalasi Docker
EN [Read English Version](README.en.md)

Repositori ini merupakan proyek `Pungoe`, aplikasi uji penetrasi web dengan arsitektur berbasis layanan terpisah (multi-container) menggunakan Docker Compose. Aplikasi ini juga mengintegrasikan fitur AI (chatbot pentest) berbasis LLM melalui **Ollama**.

---

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
| **Ollama**         | Menjalankan model LLM lokal untuk fitur chatbot Pentest-AI.                                         |
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

Edit file `.env` sesuai kebutuhan, misalnya untuk konfigurasi database, endpoint tools, atau koneksi Ollama.

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
* `app` → Frontend + backend (Next.js) + ChromaDB (vector store)
* `kali-tools` → Tools uji penetrasi berbasis Flask (Kali Linux)


#### 🔍 Cek Status Container

* **GUI**: Cek lewat Docker Desktop lewat menu container.
* **CLI**: Jalankan `docker ps`.

---

## 🧠 Instalasi Pentest-AI & Ollama (Manual di Luar Docker)

Fitur chatbot AI di Pungoe **tidak dijalankan dalam container**. Anda harus menginstal dan menjalankan **Ollama** secara manual di host machine.

### 🔧 Langkah Instalasi Ollama

1. **Install Ollama**:
   👉 [https://ollama.com/download](https://ollama.com/download)

2. **Unduh Model Pentest-AI** dari Hugging Face:

   ```bash
   ollama run hf.co/mav23/Pentest_AI-GGUF:Q5_0
   ```

   Opsional: Model kuantisasi lainnya tersedia di:
   👉 [https://huggingface.co/mav23/Pentest\_AI-GGUF](https://huggingface.co/mav23/Pentest_AI-GGUF)

3. **Unduh model untuk embedding** (digunakan oleh Chroma):

   ```bash
   ollama pull nomic-embed-text
   ```

4. **Jalankan Ollama sebagai server**:

   ```bash
   ollama serve
   ```

> Server Ollama akan aktif di `http://localhost:11434`.

---

### 🌐 Akses Ollama dari Dalam Docker

Karena Ollama berjalan di host machine, gunakan alamat ini dari dalam container:

```
http://host.docker.internal:11434
```

> Pastikan:
>
> * Port `11434` tidak diblokir firewall.
> * Server Ollama aktif (`ollama serve` sedang berjalan).
> * Model Pentest-AI sudah ter-load.

---

## 📂 Struktur Layanan

```yaml
- postgres     (Port 5432)
- app          (Port 3000)
- kali-tools   (Port 5000)
```

---

## 🧪 Akses Aplikasi

Setelah semua container berjalan dan Ollama aktif, buka:

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

* Cek koneksi ke `host.docker.internal:11434` dari container.
* Pastikan `.env` sesuai konfigurasi jaringan dan database.
* Gunakan `docker logs <nama_container>` untuk melihat log error.
* Rebuild paksa jika perlu:

  ```bash
  docker compose down -v
  docker compose up --build
  ```

---


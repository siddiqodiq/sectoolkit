# 🕵️ Pungoe – Docker Setup & Installation

This repository is for the `Pungoe` project, a web penetration testing application with a service-oriented architecture (multi-container) powered by Docker Compose. The application also integrates AI-powered features (pentest chatbot) using **LLM via Ollama**.

---
## 🎬 Video Overview

[![Video Overview](https://img.youtube.com/vi/Pf6gngLtV3E/0.jpg)](https://youtu.be/Pf6gngLtV3E)

## 🎬 Installation Guide

### 📺 Quick Video Tutorial

👉 [Watch on YouTube](https://youtu.be/zldi5sw7ACU)

---

## 📋 System Requirements

### 💻 Operating Systems

* Windows
* Linux
* macOS

### 🔧 Required Software

| Software           | Description                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------- |
| **Docker**         | Provides containerized environments to run the app without manually installing dependencies. |
| **Docker Compose** | Orchestrates and manages multiple containers.                                                |
| **Git**            | Used to clone the source code repository from GitHub.                                        |
| **Ollama**         | Runs the local LLM models used by the Pentest-AI chatbot.                                    |
| **Web Browser**    | Used to access the app at `localhost:3000` (Chrome, Firefox, Edge, Safari, etc.).            |

### 🌐 Internet & Network Notes

* **VPN is strongly recommended**, especially when using restricted networks like campus WiFi.
* Make sure the following ports are **not in use** by other applications:

  * `3000` → Main Application
  * `5000` → Pentest Tools (Flask)
  * `5432` → PostgreSQL

> ❗ **Important Note:** If you're using restricted networks like campus WiFi, using a VPN is **required** to ensure proper dependency resolution and connectivity.

---

## 🛠️ Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/siddiqodiq/pungoe.git
cd pungoe
```

### 2. Prepare the Environment File

```bash
cp .env.example .env
```

Edit the `.env` file according to your configuration, e.g. database credentials, tool endpoints, or Ollama connection.

---

### 3. Run Docker Compose

First, build the images:

```bash
docker compose build
```

Then start the containers:

```bash
docker compose up -d
```

Docker will build and run 3 services:

* `postgres` → PostgreSQL Database
* `app` → Frontend + Backend (Next.js) + ChromaDB (Vector Store)
* `kali-tools` → Pentest tools API (Flask-based, Kali Linux utilities)

#### 🔍 Check Container Status

* **GUI**: Check through Docker Desktop.
* **CLI**: Run `docker ps` to view running containers.

---

## 🧠 Pentest-AI & Ollama Installation (Outside Docker)

The AI chatbot feature in Pungoe is **not containerized**. You must install and run **Ollama manually** on the host machine.

### 🔧 Ollama Setup Instructions

1. **Install Ollama**:
   👉 [https://ollama.com/download](https://ollama.com/download)

2. **Download the Pentest-AI model** from Hugging Face:

   ```bash
   ollama run hf.co/mav23/Pentest_AI-GGUF:Q5_0
   ```

   Optional: Browse other quantized versions here:
   👉 [https://huggingface.co/mav23/Pentest\_AI-GGUF](https://huggingface.co/mav23/Pentest_AI-GGUF)

3. **Download embedding model** (used by Chroma):

   ```bash
   ollama pull nomic-embed-text
   ```

4. **Start Ollama server**:

   ```bash
   ollama serve
   ```

> The Ollama server runs by default at `http://localhost:11434`.

---

### 🌐 Accessing Ollama from Inside Docker

Since Ollama runs on the host machine, containers must use the following address to access it:

```
http://host.docker.internal:11434
```

> Make sure:
>
> * Port `11434` is not blocked by a firewall.
> * The Ollama server is running (`ollama serve`).
> * The Pentest-AI model is already downloaded and ready.

---

## 📂 Service Structure

```yaml
- postgres     (Port 5432)
- app          (Port 3000)
- kali-tools   (Port 5000)
```

---

## 🧪 Accessing the Application

Once all containers are running and Ollama is active, open your browser and go to:

* Main App:

  ```
  http://localhost:3000
  ```

* Pentest Tools API (Flask):

  ```
  http://localhost:5000
  ```

---

## 🐘 Error: PostgreSQL Authentication Failed

<img src="https://github.com/user-attachments/assets/eb0126c9-a22f-47b4-b934-dc9fe23e0586" width="300" />

If you encounter the following error:

```bash
FATAL:  password authentication failed for user "postgres"
DETAIL:  Connection matched pg_hba.conf line 100: "host all all all scram-sha-256"
```

But your app still fails to connect to the database, it is likely that **a local PostgreSQL service is conflicting** with the Docker PostgreSQL container.

### 🛠️ Solution

1. Press `Win + R`, type:

   ```
   services.msc
   ```

2. Find the **PostgreSQL** service.

3. Right-click → **Stop** or set it to **Disabled**.

4. Restart Docker:

   ```bash
   docker compose down
   docker compose up --build
   ```

5. If it still fails, remove the volumes and rebuild:

   ```bash
   docker compose down -v
   docker compose up --build
   ```

---

## ❓ Troubleshooting

* Check connectivity to `host.docker.internal:11434` from inside the container.
* Double-check `.env` configurations (DB, ports, tools).
* Use `docker logs <container_name>` to inspect runtime errors.
* To force a full rebuild:

  ```bash
  docker compose down -v
  docker compose up --build
  ```

---

## 🌍 Language

* 🇮🇩 [Baca versi Bahasa Indonesia (default)](readme.md)

---

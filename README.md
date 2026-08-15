# LogScan

Aplikasi digitalisasi Form Checking Ulang Panjang Log 260 CM.

Checker lapangan foto form fisik -> OCR/AI baca data otomatis -> tabel yang bisa dicari & diedit.

## Stack
- **Backend:** Node.js + Express
- **Database:** SQLite (better-sqlite3)
- **OCR:** Tesseract.js (lokal)
- **AI Fallback:** Google Gemini Flash API
- **Frontend:** Vanilla JS + PWA (Progressive Web App)
- **Server:** STB Armbian ARM64, RAM 1GB

## Docs
- [PRD](docs/PRD.md) — Product Requirements Document
- [PLAN](docs/PLAN.md) — Implementation Plan
- [TASKS](docs/TASKS.md) — Task Tracker

## Issues
| ID | Judul | Status |
|---|---|---|
| [ISS-001](issues/ISS-001-setup-project.md) | Setup Project & Struktur Direktori | Open |
| [ISS-002](issues/ISS-002-backend-core.md) | Backend Core: Database & REST API | Open |
| [ISS-003](issues/ISS-003-ocr-integration.md) | Integrasi OCR Lokal (Tesseract.js) | Open |
| [ISS-004](issues/ISS-004-ai-fallback.md) | AI Fallback: Gemini Flash API | Open |
| [ISS-005](issues/ISS-005-frontend-pwa.md) | Frontend PWA: Upload & Struktur Dasar | Open |
| [ISS-006](issues/ISS-006-tabel-dan-pencarian.md) | Tabel Data & Kolom Pencarian | Open |
| [ISS-007](issues/ISS-007-edit-dan-verifikasi.md) | Edit Inline & Verifikasi Foto | Open |

## Quick Start (setelah dev)
```bash
cp .env.example .env
# edit .env: tambahkan GEMINI_API_KEY
npm install
node server/index.js
# buka http://<IP-server>:3000
```

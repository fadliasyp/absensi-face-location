# Absensi Face & Location

Aplikasi web absensi peserta/pegawai dengan verifikasi wajah, pemeriksaan gerakan wajah, geolokasi, waktu server WIB, kalender hari kerja, izin manual, laporan, dan administrasi pengguna.

## Stack

- HTML, CSS, dan JavaScript statis
- Supabase Auth, Postgres, Storage, RPC, dan Edge Functions
- Cloudflare R2 untuk foto bukti absensi
- face-api.js dan MediaPipe Tasks Vision
- SweetAlert2
- jsPDF, jsPDF AutoTable, dan ExcelJS
- Gmail SMTP untuk notifikasi akun
- Vercel untuk frontend

Tidak ada framework frontend atau proses build yang ditemukan. `package-lock.json` tidak memuat dependency aplikasi; library browser dimuat melalui CDN dan dependency Edge Function didefinisikan pada masing-masing `deno.json`.

## Fitur Utama

- Registrasi email/password dan login Google melalui Supabase Auth
- Approval akun oleh admin dan email notifikasi
- Role `admin` dan `user`, dengan status `pending`, `aktif`, atau `ditolak`
- Pendaftaran wajah satu kali dan reset wajah oleh admin
- Face matching, pemeriksaan gerakan/liveness, geolokasi, dan foto bukti saat absen
- Jadwal masuk, batas telat, jendela absensi, serta popup keterlambatan/penolakan
- Sabtu–Minggu libur default dan override tanggal khusus oleh admin
- Alfa otomatis setelah pukul 12.00 WIB pada hari kerja
- Izin manual dengan bukti gambar
- Riwayat dan monitoring absensi
- Export PDF/Excel dengan tautan foto absensi
- Pengelolaan lokasi/radius dan pembersihan foto R2 yang diaudit

## Struktur

```text
admin/                 Halaman admin
user/                  Halaman peserta
assets/css/            Stylesheet utama
assets/js/             Logic browser per halaman
assets/models/         Model face-api lokal
supabase/functions/    Supabase Edge Functions
supabase/migrations/   Migration database
tests/                 Static contract/regression tests
docs/                  Project memory dan dokumentasi teknis
```

## Requirement

- Browser modern dengan izin kamera dan geolokasi
- HTTPS pada production agar kamera/geolokasi dapat digunakan dengan benar
- Project Supabase dengan Auth, Database, Storage, dan Edge Functions
- Cloudflare R2 bucket untuk foto absensi
- Node.js untuk menjalankan contract test
- Supabase CLI jika ingin deploy migration/function melalui terminal

## Konfigurasi

Frontend membaca konfigurasi public Supabase dari `assets/js/supabase-config.js`. Jangan menaruh secret server di file browser.

Environment variable Edge Function yang ditemukan:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SERVICE_ROLE_KEY` sebagai fallback/custom name pada beberapa function
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

Nilai secret harus disimpan di Supabase Edge Function Secrets, bukan di repository.

## Menjalankan Frontend

Serve root repository menggunakan static web server pilihan Anda, lalu buka `index.html`. Tidak ada build step.

Untuk alur lengkap, Supabase remote/local harus memiliki schema, function, policy, bucket, dan secret yang sesuai. Initial schema serta policy lengkap belum tersedia di repository, sehingga setup database baru belum dapat direproduksi hanya dari migration yang ada.

## Testing

```bash
node tests/session-routing.test.cjs
node tests/attendance-policy.test.cjs
node tests/integrity-hardening.test.cjs
```

Test saat ini adalah contract test berbasis source/migration serta unit test routing sederhana. Test tersebut tidak menggantikan pengujian runtime Supabase, kamera, geolokasi, Storage, R2, email, atau browser end-to-end.

## Database Migration

Migration terversi harus dijalankan berurutan berdasarkan nama file di `supabase/migrations/`.

Sebelum `db push` ke production:

1. Pastikan initial schema production cocok dengan asumsi migration.
2. Periksa duplikasi `(user_id, tanggal)` sebelum migration unique index.
3. Jalankan dry-run jika menggunakan Supabase CLI.
4. Backup database dan verifikasi function/trigger/cron setelah deployment.

Status penerapan migration terbaru pada production belum diketahui.

## Deployment

Deployment terbagi menjadi tiga bagian:

1. Frontend statis ke Vercel.
2. Migration/RPC ke database Supabase.
3. Edge Functions ke Supabase.

Deploy Vercel tidak otomatis menerapkan migration atau memperbarui Edge Function. Tidak ada konfigurasi CI/CD atau `vercel.json` yang terversi saat ini.

## Dokumentasi

- [Project Context](docs/PROJECT_CONTEXT.md)
- [Current Task](docs/CURRENT_TASK.md)
- [Feature Baseline](docs/FEATURE_BASELINE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database](docs/DATABASE.md)
- [Decisions](docs/DECISIONS.md)
- [Changelog](docs/CHANGELOG.md)

Aturan permanen untuk Codex dan kontributor otomatis berada di [AGENTS.md](AGENTS.md).

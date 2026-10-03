# Project Instructions

## Project Identity

`absensi-face-location` adalah aplikasi web absensi peserta/pegawai berbasis pemindaian wajah, pemeriksaan gerakan wajah, geolokasi, kalender kerja, dan waktu server WIB. Aplikasi memiliki area peserta dan admin.

## Required Reading

Sebelum perubahan nontrivial, baca:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/CURRENT_TASK.md`
3. `docs/FEATURE_BASELINE.md`
4. Dokumentasi domain yang relevan, khususnya `docs/ARCHITECTURE.md` dan `docs/DATABASE.md`

Jika fakta dokumentasi bertentangan dengan source code atau migration terbaru, source code dan migration menjadi bukti utama. Perbarui dokumentasi setelah perubahan selesai.

## Technology Stack

- Frontend statis: HTML, CSS, dan JavaScript browser tanpa bundler.
- Backend platform: Supabase Auth, Postgres, Storage, RPC, dan Edge Functions.
- Face processing: `face-api.js` dengan model lokal serta MediaPipe Tasks Vision dari CDN.
- Foto absensi: private Cloudflare R2, diakses melalui Supabase Edge Functions.
- Export: jsPDF, jsPDF AutoTable, dan ExcelJS dari CDN.
- Email: Gmail SMTP melalui Edge Function.
- Deployment frontend: Vercel, berdasarkan workflow operasional yang dikonfirmasi pengguna.

## Project Structure

- Halaman publik/auth berada di root.
- Halaman admin berada di `admin/`.
- Halaman peserta berada di `user/`.
- CSS utama berada di `assets/css/style.css`.
- JavaScript per halaman berada di `assets/js/`.
- Model face-api berada di `assets/models/`.
- Edge Functions dan konfigurasi Supabase berada di `supabase/functions/` dan `supabase/config.toml`.
- Perubahan database berada di `supabase/migrations/`.
- Contract test berada di `tests/`.
- Memory project berada di `docs/`.

## Coding Rules

- Pertahankan pola aplikasi statis; jangan menambahkan framework atau build system tanpa kebutuhan yang disetujui.
- Buat perubahan sekecil mungkin dan hindari refactor yang tidak terkait task.
- Pertahankan UI, logic, dan fitur yang tidak diminta berubah.
- Gunakan waktu server `Asia/Jakarta` untuk keputusan absensi. Waktu perangkat hanya boleh untuk tampilan nonotoritatif.
- Escape data database sebelum dimasukkan ke `innerHTML`; validasi dan escape URL sebelum dimasukkan ke atribut HTML.
- Jangan mempercayai role, user ID, status kehadiran, waktu, atau jarak yang dikirim browser untuk operasi sensitif.
- Hindari duplikasi handler inline baru. Untuk area yang sudah memakai inline handler, jangan memasukkan teks database mentah ke dalam handler.

## Database Rules

- Semua perubahan schema, constraint, trigger, function, grant, atau policy harus melalui migration baru.
- Jangan mengedit migration yang sudah dipastikan diterapkan pada production; buat migration lanjutan.
- Status penerapan migration `202610030003` dan `202610030004` pada production belum diketahui. Konfirmasi sebelum menganggapnya aktif.
- Gunakan schema qualification pada function `security definer` dan pertahankan `set search_path = ''`.
- Validasi identitas serta role/status akun di database untuk RPC dengan hak tinggi.
- Pertahankan invariant satu baris `absensi` per `(user_id, tanggal)`.
- Penghapusan lokasi tidak boleh menghapus riwayat absensi; FK lokasi memakai `ON DELETE SET NULL` dan snapshot `nama_tempat` harus dipertahankan.
- Jangan menjalankan reset, seed, migration destruktif, atau operasi data massal tanpa persetujuan eksplisit.
- Base schema dan policy RLS awal belum lengkap di repository. Jangan mengarang policy production; minta schema dump bila pekerjaan bergantung padanya.

## API and Edge Function Rules

- Edge Function deployment terpisah dari deployment frontend Vercel.
- Pertahankan JWT verification untuk function yang memerlukan login.
- `delete-user`, `send-approval-email`, `r2-signed-url`, dan `r2-cleanup` harus memverifikasi pengguna/role di server.
- `r2-public-view` sengaja dapat dipanggil tanpa login untuk mendukung tautan foto pada hasil export; jangan mengubah keputusan ini tanpa persetujuan pengguna.
- Jangan mengembalikan credential atau raw secret dalam response maupun log.

## Security Rules

- Jangan commit password, token, private key, service-role key, app password, atau credential R2.
- Dokumentasikan hanya nama environment variable, tidak pernah nilainya.
- Public Supabase client configuration bukan pengganti RLS. Semua akses browser harus tetap dibatasi oleh RLS/grant/RPC.
- Validasi kepemilikan object key foto dan batasi path traversal.
- Perubahan auth, role, RLS, `security definer`, public photo access, atau penghapusan data memerlukan security review terfokus.

## Testing Rules

Setelah perubahan yang relevan, jalankan:

```bash
node tests/session-routing.test.cjs
node tests/attendance-policy.test.cjs
node tests/integrity-hardening.test.cjs
node tests/icon-performance.test.cjs
```

Jalankan `node --check` pada setiap JavaScript browser yang diubah. Jalankan contract ikon ketika HTML admin/user atau aset ikon berubah. Jika Edge Function berubah, gunakan Deno/Supabase tooling bila tersedia; jika tidak tersedia, nyatakan verification gap secara eksplisit.

Jangan menyatakan production berhasil hanya dari static contract test. Migration dan Edge Function tetap perlu diverifikasi pada project Supabase remote.

## Documentation Rules

- Setelah task signifikan, perbarui minimal `docs/PROJECT_CONTEXT.md`, `docs/CURRENT_TASK.md`, dan `docs/CHANGELOG.md`.
- Jika perilaku stabil berubah, perbarui `docs/FEATURE_BASELINE.md`.
- Jika arsitektur berubah, perbarui `docs/ARCHITECTURE.md`.
- Jika database berubah, perbarui `docs/DATABASE.md`.
- Catat keputusan penting di `docs/DECISIONS.md` tanpa membuat alasan historis yang tidak terbukti.
- Tandai fakta yang tidak dapat dibuktikan sebagai `Belum diketahui / perlu dikonfirmasi`.

## Feature Regression Protection

Hal berikut dilindungi:

- Foto absensi tetap dapat dibuka oleh penerima hasil export melalui public viewer yang menghasilkan signed URL sementara.
- Peserta tetap dapat mengirim izin manual untuk sakit/berhalangan.
- Sabtu dan Minggu libur secara default, dengan override `libur` atau `masuk` per tanggal oleh admin.
- Absensi dibuka satu jam sebelum Jam Masuk, berstatus Hadir sampai Batas Masuk, Terlambat setelahnya, lalu ditutup pada Jam Generate Alfa; seluruh keputusan memakai waktu server.
- Peserta tanpa absensi/izin pada hari kerja mendapat Alfa pada Jam Generate Alfa dinamis; fallback jika belum dikonfigurasi adalah pukul 12.00 WIB.
- Navbar mode laptop tetap fixed dan tidak ikut turun saat halaman di-scroll.
- Gunakan icon statis `*-static.png` pada konten dan `*-nav.png` pada navigasi; jangan mengembalikan GIF looping berat tanpa alasan terukur.

Sebelum mengubah salah satu area tersebut, baca `docs/FEATURE_BASELINE.md`, telusuri consumer, dan jalankan regression test terkait.

## Git Safety

- Jangan membuat commit, push, checkout branch, rewrite history, reset, atau menghapus perubahan pengguna tanpa instruksi eksplisit.
- Perlakukan dirty working tree sebagai pekerjaan pengguna.
- Jangan memasukkan file sementara Supabase/Vercel baru ke Git.

## Session Handoff

Saat berhenti setelah pekerjaan signifikan:

1. Ringkas hasil dan verification evidence.
2. Catat blocker serta status deploy yang belum diketahui.
3. Perbarui `docs/CURRENT_TASK.md`.
4. Sinkronkan context, baseline, architecture, database, decision log, dan changelog sesuai dampak.

## Project-Specific Unknowns

- Initial/base database schema, seluruh RLS policy, dan Storage policy belum terversi lengkap.
- `supabase/config.toml` merujuk `supabase/seed.sql`, tetapi seed tersebut belum tersedia.
- Status deployment remote untuk migration dan Edge Function terbaru harus dikonfirmasi dari Supabase Dashboard/CLI.
- Tidak ada konfigurasi CI/CD atau `vercel.json` yang terversi.

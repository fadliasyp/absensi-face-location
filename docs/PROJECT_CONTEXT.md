# Project Context

## Project Overview

`absensi-face-location` adalah aplikasi web existing untuk mencatat kehadiran peserta/pegawai dengan face scan, pemeriksaan gerakan wajah, geolokasi, waktu server WIB, serta titik lokasi dan radius yang ditentukan admin.

Frontend berupa halaman statis. Supabase menjadi backend untuk Auth, Postgres, Storage, RPC, cron, dan Edge Functions. Foto absensi disimpan di private Cloudflare R2 dan dibuka melalui signed URL sementara.

## Tujuan

- Mengurangi absensi di luar waktu dan lokasi yang ditentukan.
- Mengaitkan kehadiran dengan akun aktif, wajah terdaftar, bukti foto, dan lokasi.
- Memberikan administrasi user, jadwal, kalender kerja, lokasi, laporan, dan retensi foto.

## Target User

- Peserta/pegawai yang melakukan absensi dan izin.
- Admin yang menyetujui akun, mengatur kebijakan, memonitor absensi, membuat laporan, dan mengelola storage.

## Current Status

- Status repository: existing project aktif.
- Branch yang diamati: `main`.
- Commit terbaru saat bootstrap: `51d0995` (2026-10-03).
- Source code berada dalam kondisi bersih saat bootstrap; `CODEX_PROJECT_SETUP.md` adalah file bootstrap yang belum dilacak Git.
- Contract tests tersedia untuk routing sesi, kebijakan absensi, kalender kerja, dan integrity hardening.
- Status deployment production untuk migration `202610030003`, `202610030004`, serta Edge Function `delete-user` terbaru: **Belum diketahui / perlu dikonfirmasi**.

## Completed Features

| Fitur | Status repository | Bukti |
| --- | --- | --- |
| Login email/password | WORKING | Alur tersedia di `auth.js`; keberhasilan runtime bergantung pada konfigurasi Supabase Auth. |
| Remembered-session routing | STABLE | `session-routing.js`, `session-routing.test.cjs` |
| Login Google dan pelengkapan profil pending | WORKING | `login.html`, `oauth-callback.html`, `lengkapi-profil.js` |
| Approval/status/role user dan email notifikasi | WORKING | `admin-users.js`, `send-approval-email` |
| Daftar wajah dan reset wajah | WORKING | `user-daftar-wajah.js`, `admin-users.js` |
| Absensi wajah + liveness + geolokasi | WORKING | `user-verifikasi.js`, `catat_absensi` |
| Jendela absensi berbasis waktu server WIB | STABLE | migration `001`, `attendance-policy.test.cjs` |
| Kalender kerja dan override admin | STABLE | migration `002`, `attendance-policy.test.cjs` |
| Alfa otomatis dan fallback admin | STABLE pada contract | migration `001/002`, contract test |
| Izin manual dengan bukti | STABLE pada contract | migration `004`, `integrity-hardening.test.cjs` |
| Riwayat dan monitoring absensi | WORKING | `user-riwayat.js`, `admin-list-absen.js` |
| Export PDF/Excel | WORKING | `admin-export-pdf.js`, Git history 2026-08-09 |
| Foto absensi R2 dan public viewer untuk export | PROTECTED | R2 functions, keputusan eksplisit pengguna |
| Penghapusan lokasi tanpa menghapus riwayat | STABLE pada contract | migration `003`, integrity test |
| Cleanup foto R2 dengan audit | WORKING | `r2-cleanup`, `foto_cleanup_logs` migration |
| Navbar desktop fixed | PROTECTED | commit `b66d574`, requirement pengguna |
| Icon statis ringan | PROTECTED | Snapshot `*-static.png` pada konten dan `*-nav.png` pada navigasi |

`WORKING` berarti implementasi nyata ditemukan, tetapi belum memiliki bukti runtime/end-to-end pada sesi bootstrap ini. Status production tetap harus diverifikasi terpisah.

## Current Work

Perbaikan performa ikon tahap pertama telah dilakukan. Seluruh GIF looping pada halaman admin dan peserta diganti referensinya dengan snapshot PNG dari visual yang sama. Logic aplikasi, CSS, database, dan Edge Function tidak diubah.

## Pending Work

- Konfirmasi apakah migration `003` dan `004` telah diterapkan ke Supabase production.
- Konfirmasi/deploy ulang Edge Function `delete-user` jika versi remote belum memuat validasi admin aktif.
- Ambil schema dump production agar base schema, RLS policy, Storage policy, dan grants dapat terversi.
- Buat atau nonaktifkan referensi `supabase/seed.sql`; file tersebut dirujuk config tetapi belum ada.
- Tambahkan browser/runtime test untuk kamera, geolokasi, R2, export, dan email bila diperlukan.
- Ukur ulang respons UI pada perangkat pengguna setelah deploy ikon statis. Kurangi efek blur/transisi mobile hanya jika jank masih terukur.

## Business Logic

- Hanya akun `aktif` yang dapat menggunakan area sesuai role.
- User tanpa data wajah diarahkan ke dashboard/pendaftaran wajah; user dengan wajah terdaftar diarahkan ke verifikasi absensi.
- Absensi hanya berlaku pada hari kerja.
- Sabtu dan Minggu libur default; admin dapat menetapkan tanggal khusus sebagai `libur` atau `masuk`.
- Jendela absensi dibuka satu jam sebelum `jam_masuk` dan ditutup pukul 12.00 WIB.
- Waktu sampai `batas_telat` berstatus `hadir`; setelahnya hingga sebelum 12.00 berstatus `terlambat`.
- Status/tanggal/waktu/jarak absensi dihitung ulang oleh server; browser tidak menentukan status final.
- Maksimal satu data `absensi` per peserta per tanggal.
- Peserta aktif tanpa hadir/terlambat/izin pada hari kerja dibuatkan `alfa` setelah pukul 12.00 WIB.
- Izin manual tetap diperbolehkan untuk sakit/berhalangan, tetapi hanya pada hari kerja dan dicatat melalui RPC.
- Penghapusan lokasi melepaskan FK lokasi aktif, bukan menghapus riwayat absensi.

## Technical Facts

- Tidak ada frontend build step atau `package.json` yang ditemukan.
- Library browser dimuat dari CDN; model face-api berada lokal di `assets/models/`.
- Tanggal default UI menggunakan helper `Asia/Jakarta` pada halaman sensitif tanggal.
- `pg_cron` menjadwalkan Alfa pukul `05:00 UTC`, setara `12:00 WIB`.
- R2 object key foto mengikuti prefix `foto-absen/{user_id}/...`.
- Public viewer tidak membuat bucket R2 publik; function menghasilkan signed URL sementara dari object key.

## Constraints

- Foto absensi harus tetap dapat dibuka oleh penerima hasil export tanpa sesi login.
- Fitur izin manual peserta harus tetap ada.
- UI, logic, dan fitur yang stabil tidak boleh dirombak tanpa kebutuhan task.
- Keputusan absensi harus memakai waktu server WIB.
- Deployment frontend, database, dan Edge Functions adalah proses terpisah.

## Known Issues and Risks

1. **Base schema/RLS tidak lengkap di repository.** Tabel inti sudah dipakai, tetapi migration pembuat awal `profiles`, `absensi`, `lokasi_absen`, dan `pengaturan_absen` tidak tersedia. Policy production tidak dapat dipastikan dari repository.
2. **Seed hilang.** `supabase/config.toml` mengaktifkan seed `./seed.sql`, tetapi file tidak ditemukan.
3. **Client-side biometric trust.** Face matching dan liveness dilakukan di browser. RPC memastikan akun memiliki descriptor dan memvalidasi waktu/lokasi, tetapi tidak menerima bukti kriptografis bahwa face/liveness benar-benar dijalankan.
4. **Public photo capability.** Siapa pun yang memiliki object key valid dapat meminta signed view URL melalui `r2-public-view`. Ini disengaja untuk export, tetapi object key harus diperlakukan sebagai capability link.
5. **Edge secret naming.** `delete-user` membaca `SERVICE_ROLE_KEY`, sedangkan function lain memakai `SUPABASE_SERVICE_ROLE_KEY` atau fallback. Deployment harus memastikan custom secret tersedia atau kode diseragamkan pada task terpisah.
6. **Direct browser mutations.** Beberapa operasi admin mengubah `profiles`, `lokasi_absen`, dan `pengaturan_absen` langsung dari browser; keamanannya bergantung pada RLS yang belum terversi.
7. **HTML rendering risk tersisa.** Sebagian modul lama masih membangun `innerHTML` dan inline handler dari data database. Halaman lokasi/list/riwayat telah diperkeras, tetapi audit menyeluruh semua halaman belum selesai.
8. **Runtime verification gap.** Supabase CLI/Deno tidak tersedia pada sesi perbaikan sebelumnya; Edge Function dan migration belum dibuktikan terhadap remote runtime.
9. **Deployment automation belum ada.** Tidak ditemukan CI/CD atau `vercel.json` yang terversi.

## Important Files

- `assets/js/user-verifikasi.js`: orchestration absensi peserta.
- `assets/js/user-daftar-wajah.js`: pendaftaran descriptor/foto wajah.
- `assets/js/auth.js` dan `assets/js/session-routing.js`: auth dan routing.
- `assets/js/admin-users.js`: lifecycle akun peserta.
- `assets/js/admin-waktu.js`: jadwal dan kalender khusus.
- `assets/js/admin-lokasi.js`: titik/radius absensi.
- `assets/js/admin-list-absen.js`: monitoring dan fallback Alfa.
- `assets/js/admin-export-pdf.js`: laporan PDF/Excel.
- `supabase/migrations/`: aturan data dan RPC.
- `supabase/functions/`: email, user deletion, dan R2.
- `tests/`: regression contracts.

## External Services

- Supabase Auth/Postgres/Storage/Edge Functions.
- Cloudflare R2 melalui S3-compatible API.
- Gmail SMTP.
- Google OAuth melalui Supabase provider configuration.
- Vercel untuk frontend.
- jsDelivr dan Google Storage untuk dependency/model browser.

## Things We Must Not Break

- Lihat daftar lengkap di `docs/FEATURE_BASELINE.md`.
- Secara khusus: public photo viewing untuk export, izin manual, waktu server WIB, kalender akhir pekan/override, unique attendance per day, riwayat lokasi, fixed desktop navbar, dan icon optimized.

## Session Handoff

- Dokumentasi bootstrap dibuat pada 2026-10-03.
- Tidak ada task implementasi aktif setelah bootstrap.
- Sebelum task berikutnya, baca `AGENTS.md`, context ini, `CURRENT_TASK.md`, dan `FEATURE_BASELINE.md`.
- Konfirmasi status remote Supabase sebelum melakukan perubahan yang bergantung pada migration/function terbaru.

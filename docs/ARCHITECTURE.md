# Architecture

## High-Level Architecture

```text
Browser (HTML/CSS/JS statis)
  |-- Supabase JS SDK ------------------------------+
  |                                                 |
  |   Auth / table reads / allowed mutations / RPC  v
  +------------------------------------------- Supabase
  |                                             |-- Auth
  |                                             |-- Postgres + RLS/grants
  |                                             |-- Storage (foto wajah, bukti izin)
  |                                             |-- pg_cron
  |                                             `-- Edge Functions (Deno)
  |                                                   |-- Gmail SMTP
  |                                                   `-- Cloudflare R2 (S3 API)
  |
  |-- face-api.js + model lokal
  |-- MediaPipe Tasks Vision CDN/model
  `-- jsPDF / ExcelJS / SweetAlert2 CDN

Frontend deployment: Vercel
Backend deployment: Supabase migration + Edge Function deploy (terpisah)
```

## Frontend

Frontend adalah multi-page static application:

- Public/auth: `index.html`, `login.html`, `register.html`, `oauth-callback.html`, `lengkapi-profil.html`.
- Peserta: dashboard, daftar wajah, verifikasi/absen, izin, riwayat.
- Admin: dashboard, user, waktu/kalender, lokasi, list absen, export, storage.

Setiap halaman memuat Supabase JS dari CDN, config client, dan script halaman. Tidak ada bundler, framework, router SPA, atau build artifact.

## Backend

Backend terbagi menjadi:

- Direct Supabase client calls yang tunduk pada RLS/grants.
- Postgres RPC `security definer` untuk operasi absensi dan admin yang sensitif.
- Trigger database sebagai defense-in-depth.
- Edge Functions untuk operasi yang membutuhkan secret/service role atau integrasi eksternal.

## Authentication and Authorization

### Email/password

```text
Register -> Supabase Auth signUp -> insert profiles(status=pending)
         -> send-approval-email(new_registration) -> admin notification
         -> admin activates/updates -> notification email -> user login
```

### Google OAuth

```text
Google login -> oauth-callback.html
  -> profile absent: create pending partial profile -> lengkapi-profil.html
  -> profile pending/incomplete: complete profile / wait admin
  -> active profile: route by role and face registration state
```

Authorization di UI melakukan redirect, tetapi keamanan data tetap harus ditegakkan oleh RLS, grants, RPC, dan Edge Function server checks.

## Face Enrollment

```text
Active user -> camera -> face-api detection + landmarks + descriptor
            -> JPEG snapshot -> Supabase Storage bucket foto-wajah
            -> profiles.face_descriptor + profiles.foto_wajah_url
```

Pendaftaran ulang diblokir di UI sampai admin mereset descriptor/foto pada profil.

## Attendance Data Flow

```text
User opens verification
  -> RPC cek_hari_absensi (server date + work calendar)
  -> RPC cek_jendela_absensi (server time + duplicate check)
       - Hadir sampai Batas Masuk
       - Terlambat setelah Batas Masuk sampai sebelum Jam Generate Alfa
       - Closed mulai Jam Generate Alfa
  -> initial face match (threshold 0.5, browser)
  -> active liveness state machine (browser)
       - capture neutral pose and open-eye baseline from the first valid frame
       - skip the former multi-frame stabilization wait
       - read MediaPipe eyeBlinkLeft/eyeBlinkRight against participant baseline
       - fuse fresh MediaPipe and face-api EAR so fast blinks can use either signal
       - bind reopen validation to the signal that detected both eyes closed
       - ignore MediaPipe blink samples older than 200 ms
       - detect fast head turns from two same-direction frames with one full peak
       - reject a single yaw spike and require neutral return after the turn
       - select three random blink/right/left steps with repetition allowed
       - guarantee at least one blink and require only one blink per step
       - wait a random delay before exposing each prompt
       - enforce order, response deadline, consecutive frames, and neutral return
       - reject early head movement and repeated opposite-direction movement
       - reject multiple faces, lost continuity, hidden tab, or stopped camera
  -> final face match (threshold 0.5, browser)
  -> browser geolocation
  -> choose nearest configured location (browser pre-check)
  -> capture/compress photo
  -> Edge Function r2-signed-url uploads to private R2
  -> RPC catat_absensi
       - auth + active user + face descriptor exists
       - server WIB time/window/status
       - per-user/date lock and duplicate check
       - coordinate validation
       - configured location lookup
       - Haversine distance/radius validation
       - insert attendance snapshot
  -> success/late/rejected popup
```

`liveness-engine.js` berisi state machine murni yang diuji tanpa kamera. `user-verifikasi.js` mengubah landmark face-api menjadi sampel yaw/EAR dan menggabungkan sampel blendshape terbaru dari `mediapipe-face-guide.js`. Baseline relatif ditangkap sekali dari frame wajah valid pertama sehingga tidak ada penantian stabilisasi awal. Selama challenge, MediaPipe tetap melakukan inferensi `eyeBlinkLeft`/`eyeBlinkRight` dengan interval 80 ms, sementara gambar panduan disembunyikan. Generator memilih tiga langkah secara acak dengan pengulangan yang diperbolehkan, lalu menjamin minimal satu langkah kedip; setiap langkah kedip hanya membutuhkan satu kedipan normal. Engine menerima penutupan kedua mata dari MediaPipe atau EAR, lalu mengutamakan sumber yang sama untuk memastikan mata terbuka kembali dengan fallback EAR jika MediaPipe hilang; batas minimum 25 ms menerima kedipan cepat yang tertangkap antar-frame. Sampel MediaPipe di atas 200 ms diabaikan sehingga EAR terbaru dapat mengambil alih. Gerakan tengok memakai dua frame searah dengan ambang pendukung 65%; sedikitnya satu frame wajib mencapai ambang penuh sebelum peserta kembali netral. State `prompt_delay` memisahkan waktu menunggu dari waktu respons supaya gerakan video yang terjadi sebelum instruksi tidak dapat dihitung; pilihan langkah dan jeda memakai Web Crypto.

Server tidak menerima hasil face matching/liveness sebagai proof tersendiri; tahap biometrik merupakan kontrol browser Tahap 1. Active liveness meningkatkan pertahanan terhadap foto diam dan video replay biasa, tetapi bukan server-verifiable attestation dan tidak diklaim kebal terhadap browser termodifikasi, virtual camera, atau replay/deepfake canggih.

## Manual Leave Flow

```text
Active user -> choose date/description/image
  -> client duplicate pre-check
  -> upload public proof to Supabase Storage bucket bukti-izin
  -> RPC catat_izin
       - derives user from auth.uid()
       - validates active role user
       - validates date/description/HTTPS URL
       - requires workday
       - reads dynamic Jam Generate Alfa with 12.00 fallback
       - advisory lock + duplicate/Alfa check
       - rejects today at/after deadline and rejects past dates
       - atomically changes today's Alfa to Izin when a later deadline is still open
       - otherwise inserts status izin
  -> formal success/rejection popup
  -> remove uploaded proof best-effort when RPC rejects/fails
```

## Work Calendar and Alfa

- `attendance_day_info(date)` checks explicit `kalender_absen` override first.
- Without override, ISO weekday 6/7 is holiday and 1–5 is workday.
- `generate_alfa_harian(date)` keluar sebelum deadline atau pada hari libur; setelah deadline function memasukkan Alfa untuk peserta aktif tanpa record.
- `pg_cron` memeriksa setiap menit agar deadline yang diatur admin dapat berlaku sampai ketelitian menit.
- Jika belum tersedia pada data lama, Jam Generate Alfa menggunakan fallback 12.00 WIB.
- Admin dapat memanggil `generate_alfa_hari_ini_admin()` setelah deadline dinamis sebagai fallback.

## Photo Storage and Viewing

- Face enrollment photo: Supabase Storage `foto-wajah`, public URL stored on profile.
- Leave proof: Supabase Storage `bukti-izin`, public URL stored on attendance.
- Attendance proof: private Cloudflare R2, object key stored in `absensi.foto_absen_key`.
- Authenticated upload/private view: `r2-signed-url`.
- Export/public view: `r2-public-view`, which validates object-key shape then creates a five-minute signed URL.
- Cleanup: `r2-cleanup` deletes selected objects in batches, nulls photo references, and records audit history.

## Reporting

Admin selects a date range/status. Browser fetches attendance and related profiles, renders preview, then generates:

- PDF via jsPDF + AutoTable.
- Excel via ExcelJS.

Photo references are links to `foto-absen.html?key=...`, not permanent R2 URLs.

## Edge Functions

| Function | Auth config | Purpose |
| --- | --- | --- |
| `send-approval-email` | JWT required | Registration, activation, role/status notification via Gmail SMTP |
| `delete-user` | JWT required | Delete Supabase Auth user after active-admin validation |
| `r2-signed-url` | JWT required | Upload/view R2 objects for active user/admin |
| `r2-public-view` | JWT disabled | Public capability viewer for export links |
| `r2-cleanup` | JWT disabled at gateway; function verifies bearer token itself | Admin preview/delete/history for R2 cleanup |

## Deployment

- Frontend deploy: Vercel.
- Database deploy: Supabase migration/SQL.
- Edge deploy: Supabase Edge Functions.
- Secrets: Supabase Edge Function Secrets.

Tidak ada CI/CD yang terversi. Deployment production saat ini merupakan proses manual berdasarkan bukti repository dan percakapan.

## Architectural Rules

- Server WIB adalah authority untuk tanggal/waktu/status kehadiran.
- Sensitive writes menggunakan RPC/Edge Function dan harus fail closed.
- Database menyimpan snapshot riwayat yang tidak bergantung pada keberadaan master location.
- Private R2 credentials hanya boleh digunakan di Edge Function.
- Public viewing hanya memberikan signed URL sementara, tidak membuka bucket.
- UI checks tidak dianggap sebagai authorization boundary.

## Risks

- Initial schema/RLS/Storage policies tidak terversi lengkap.
- Face/liveness tidak memiliki server-verifiable attestation.
- Public viewer adalah capability link berbasis object key.
- Direct browser admin mutations bergantung pada RLS remote.
- CDN availability memengaruhi dependency browser.
- Tidak ada automated E2E test atau deployment pipeline yang ditemukan.

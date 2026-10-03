# Database

## Platform

- Database: PostgreSQL melalui Supabase.
- Auth: Supabase Auth.
- Object storage: Supabase Storage untuk foto wajah/bukti izin; Cloudflare R2 untuk foto absensi.
- ORM: tidak ada.
- Migration runner: Supabase migrations.
- Scheduler: `pg_cron` pada Postgres.

## Schema Coverage

Repository **tidak memiliki initial migration lengkap** untuk tabel inti. Dokumentasi tabel di bawah berasal dari pemakaian aktual pada source code serta migration tambahan. Tipe, default, constraint, FK, grant, dan RLS yang tidak terlihat harus dianggap **Belum diketahui / perlu dikonfirmasi** melalui schema dump production.

Tabel inti yang pembuatannya tidak terversi:

- `profiles`
- `absensi`
- `lokasi_absen`
- `pengaturan_absen`

Tabel yang pembuatannya terversi:

- `kalender_absen`
- `foto_cleanup_logs`

## Tables

### `profiles`

Kolom yang terkonfirmasi dari source/migration:

| Kolom | Kegunaan |
| --- | --- |
| `id` | Identitas user, digunakan bersama Supabase Auth UUID |
| `nama_lengkap` | Nama peserta/admin |
| `nik` | Identitas pegawai/peserta |
| `tanggal_lahir` | Data profil |
| `gender` | Data profil |
| `bagian` | Bagian/unit kerja |
| `email` | Email akun/notifikasi |
| `role` | `user` atau `admin` |
| `status_akun` | `pending`, `aktif`, atau `ditolak` |
| `face_descriptor` | Array descriptor wajah dari face-api |
| `foto_wajah_url` | URL foto wajah pada Supabase Storage |
| `created_at` | Digunakan untuk urutan daftar user |

Relasi ke `auth.users` sangat mungkin berdasarkan pemakaian ID yang sama, tetapi definisi FK tidak tersedia di repository.

### `absensi`

Kolom yang terkonfirmasi:

| Kolom | Kegunaan |
| --- | --- |
| `id` | Primary identifier record |
| `user_id` | Peserta pemilik record |
| `tanggal` | Tanggal WIB kehadiran/izin/Alfa |
| `waktu_masuk` | Waktu server untuk hadir/terlambat |
| `latitude`, `longitude` | Koordinat perangkat saat absensi |
| `lokasi_absen_id` | Referensi lokasi aktif, nullable setelah migration `003` |
| `nama_tempat` | Snapshot nama lokasi |
| `jarak_meter` | Hasil kalkulasi Haversine server |
| `status` | `hadir`, `terlambat`, `izin`, atau `alfa` |
| `keterangan` | Deskripsi record |
| `validasi_wajah` | `valid`/`tidak_valid` pada data yang dibuat sistem |
| `validasi_lokasi` | `valid`/`tidak_valid` pada data yang dibuat sistem |
| `bukti_izin_url` | URL bukti izin |
| `foto_absen_url` | URL foto legacy/fallback |
| `foto_absen_key` | Object key foto pada private R2 |
| `foto_dihapus_at` | Waktu cleanup foto |
| `foto_dihapus_oleh` | Admin yang melakukan cleanup |

Constraint/index yang terversi:

- Unique index `absensi_user_tanggal_unique_idx` pada `(user_id, tanggal)`.
- FK `absensi_lokasi_absen_id_fkey` menggunakan `ON DELETE SET NULL`.
- FK `foto_dihapus_oleh -> profiles(id)` menggunakan `ON DELETE SET NULL`.

Migration `003` berhenti dengan error jika duplicate `(user_id, tanggal)` sudah ada; migration tidak menghapus record secara otomatis.

### `lokasi_absen`

Kolom yang terkonfirmasi:

- `id`
- `nama_lokasi`
- `latitude`
- `longitude`
- `radius_meter`

Lokasi dipakai RPC `catat_absensi` untuk kalkulasi radius. Saat lokasi dihapus, riwayat pada `absensi` tetap ada dan hanya FK-nya yang menjadi `NULL`.

### `pengaturan_absen`

Kolom yang terkonfirmasi:

- `id`
- `jam_masuk`
- `batas_telat`
- `jam_generate_alfa` (default `12:00:00` setelah migration `202610040001`)

Logic server membaca baris pertama berdasarkan `id ASC LIMIT 1`. Konfigurasi dianggap invalid jika:

- Nilai waktu kosong.
- Batas Masuk (`batas_telat`) lebih awal dari Jam Masuk.
- Jam Generate Alfa sama dengan atau lebih awal dari Batas Masuk.

Nama kolom `batas_telat` dipertahankan untuk kompatibilitas, tetapi label produk dan maknanya adalah **Batas Masuk**: peserta masih berstatus Hadir sampai waktu tersebut.

Constraint `pengaturan_absen_urutan_waktu_check` menegakkan urutan
`jam_masuk <= batas_telat < jam_generate_alfa` untuk data baru/perubahan.
Constraint ditambahkan sebagai `NOT VALID` agar migration tidak merusak deployment
yang mungkin memiliki data legacy invalid; function server tetap fail closed sampai
baris tersebut diperbaiki admin.

### `kalender_absen`

Dibuat oleh migration `202610030002`.

| Kolom | Constraint/kegunaan |
| --- | --- |
| `tanggal` | Primary key |
| `tipe` | Check `libur` atau `masuk` |
| `keterangan` | Deskripsi optional |
| `created_by` | FK `profiles(id) ON DELETE SET NULL` |
| `created_at` | Default `now()` |
| `updated_at` | Default `now()` |

RLS diaktifkan dan direct access `anon`/`authenticated` dicabut. Akses admin melalui RPC.

### `foto_cleanup_logs`

Dibuat oleh migration `202607140001`.

| Kolom | Constraint/kegunaan |
| --- | --- |
| `id` | UUID PK, default `gen_random_uuid()` |
| `admin_id` | FK `profiles(id) ON DELETE RESTRICT` |
| `tanggal_awal`, `tanggal_akhir` | Range cleanup, dengan check awal <= akhir |
| `jumlah_ditemukan` | Integer non-negatif |
| `jumlah_dihapus` | Integer non-negatif |
| `jumlah_gagal` | Integer non-negatif |
| `status` | `processing`, `completed`, atau `failed` |
| `pesan_error` | Detail kegagalan |
| `created_at`, `completed_at` | Audit timestamps |

Index:

- `foto_cleanup_logs_created_at_idx` pada `created_at DESC`.
- `foto_cleanup_logs_admin_id_idx` pada `admin_id`.

RLS diaktifkan. Policy detail belum tersedia di repository; Edge Function memakai service role.

## Database Functions / RPC

| Function | Caller | Peran |
| --- | --- | --- |
| `attendance_window_status(time,time,time,time)` | Internal DB | Klasifikasi Hadir/Terlambat/Closed dengan deadline dinamis |
| `attendance_window_status(time,time,time)` | Internal DB | Wrapper kompatibilitas dengan fallback Alfa pukul 12.00 |
| `cek_jendela_absensi()` | User authenticated | Server window/status pre-check |
| `catat_absensi(jsonb)` | User authenticated | Atomic attendance insert dan radius validation |
| `generate_alfa_harian(date)` | Internal cron/admin wrapper | Insert Alfa idempotent berdasarkan existing rows |
| `generate_alfa_hari_ini_admin()` | Admin authenticated | Fallback Alfa setelah Jam Generate Alfa dinamis |
| `attendance_day_info(date)` | Internal DB | Default weekday/weekend + override |
| `cek_hari_absensi()` | User authenticated | Workday status dari tanggal server |
| `daftar_hari_khusus()` | Admin authenticated | List calendar overrides |
| `simpan_hari_khusus(date,text,text)` | Admin authenticated | Upsert override |
| `hapus_hari_khusus(date)` | Admin authenticated | Remove override |
| `hapus_lokasi_absen(text)` | Admin authenticated | Delete master location, preserve history |
| `catat_izin(date,text,text)` | User authenticated | Secure manual leave sebelum deadline; dapat mengubah Alfa hari ini menjadi Izin jika deadline terbaru masih terbuka |

Function `security definer` melakukan schema qualification dan memakai `set search_path = ''` pada migration terbaru.

## Triggers

- `enforce_attendance_insert_trigger`: mengamankan direct insert status hadir/terlambat dengan auth user, waktu WIB, status server, dan duplicate check.
- `enforce_attendance_workday_trigger`: menolak hadir/terlambat pada hari libur.

Migration `004` juga mencabut `insert`, `update`, dan `delete` pada `absensi` dari `anon` serta `authenticated`, sehingga mutasi peserta diarahkan melalui RPC.

## Scheduled Job

```text
Name: generate-alfa-dinamis-wib
Cron: * * * * *
Meaning: periksa deadline setiap menit; keputusan memakai waktu server Asia/Jakarta
Command: select public.generate_alfa_harian();
```

Function mengembalikan tanpa mutasi sebelum Jam Generate Alfa, pada hari libur, dan untuk tanggal mendatang. Insert Alfa tetap idempoten karena hanya memilih peserta yang belum mempunyai record.

## Storage

### Supabase Storage

- `foto-wajah`: foto enrollment, URL publik disimpan di `profiles`.
- `bukti-izin`: bukti izin, URL publik disimpan di `absensi`.

Definisi bucket serta Storage policies tidak tersedia di repository.

### Cloudflare R2

- Menyimpan foto absensi dengan prefix `foto-absen/{user_id}/YYYY/MM/DD/{uuid}.{ext}`.
- Bucket diperlakukan private.
- Signed upload/view URL dibuat Edge Function.
- Cleanup menghapus object dan menyisakan audit/database marker.

## Migration Order

1. `202607130001_add_foto_absen_key.sql`
2. `202607140001_add_foto_cleanup_audit.sql`
3. `202610030001_secure_attendance_window.sql`
4. `202610030002_work_calendar_overrides.sql`
5. `202610030003_location_history_integrity.sql`
6. `202610030004_secure_manual_leave.sql`
7. `202610040001_dynamic_attendance_deadline.sql`
8. `202610040002_reject_late_manual_leave.sql`
9. `202610040003_reopen_alfa_after_deadline_extension.sql`

Migration ini merupakan delta atas schema yang sudah ada, bukan bootstrap database lengkap.

## Seed

`supabase/config.toml` mengaktifkan `./seed.sql`, tetapi `supabase/seed.sql` tidak ditemukan. Local reset dapat gagal atau tidak reproducible sampai konfigurasi/file ini diselesaikan.

## Data Safety

- Backup sebelum menerapkan migration ke production.
- Audit duplicate attendance sebelum unique index.
- Jangan reset database remote.
- Jangan menjalankan seed pada production tanpa review eksplisit.
- Pastikan `pg_cron` tersedia, job lama `generate-alfa-1200-wib` sudah dilepas, dan hanya satu job `generate-alfa-dinamis-wib` aktif.
- Verifikasi grants/RLS setelah migration, bukan hanya keberadaan function.
- Status schema/policy remote tetap **Belum diketahui / perlu dikonfirmasi** sampai ada dump atau inspection resmi.

# Feature Baseline

Dokumen ini mencatat perilaku yang sudah terbukti atau secara eksplisit dilindungi pengguna. Status `STABLE` didukung contract test; status `PROTECTED` adalah keputusan produk yang tidak boleh diubah tanpa persetujuan.

## Session Routing

### Status

STABLE

### Fungsi

Mengarahkan sesi aktif berdasarkan role, status akun, dan ketersediaan data wajah.

### Perilaku yang Sudah Benar

- Admin aktif menuju `/admin/dashboard.html`.
- User aktif dengan descriptor dan foto wajah menuju `/user/verifikasi.html`.
- User aktif tanpa data wajah menuju `/user/dashboard.html`.
- Sesi dengan profil tidak aktif dibersihkan secara lokal.

### Jangan Rusak

- Jangan melewati pemeriksaan `status_akun`.
- Jangan mengarahkan user tanpa wajah langsung ke proses absensi.

### File Penting

- `assets/js/session-routing.js`
- `assets/js/auth.js`
- `tests/session-routing.test.cjs`

### Cara Verifikasi

```bash
node tests/session-routing.test.cjs
```

## Attendance Window and Server Authority

### Status

STABLE

### Fungsi

Menentukan kapan peserta boleh absen serta status `hadir` atau `terlambat` memakai waktu server WIB.

### Perilaku yang Sudah Benar

- Buka satu jam sebelum jam masuk.
- Tolak absensi terlalu awal.
- `hadir` sampai Batas Masuk.
- Setelah Batas Masuk sampai satu detik sebelum Jam Generate Alfa berstatus `terlambat`.
- Tutup absensi mulai Jam Generate Alfa dinamis.
- Jika Jam Generate Alfa belum tersedia pada data lama, gunakan fallback 12.00 WIB.
- Tanggal, waktu, status, dan jarak final dihitung server.
- Popup keterlambatan menampilkan jumlah terlambat bulan berjalan.

### Jangan Rusak

- Jangan kembali mempercayai waktu/status dari perangkat.
- Jangan menghapus trigger/RPC server tanpa pengganti dengan enforcement setara.
- Jangan menerima lebih dari satu record per user/tanggal.

### File Penting

- `supabase/migrations/202610030001_secure_attendance_window.sql`
- `supabase/migrations/202610040001_dynamic_attendance_deadline.sql`
- `supabase/migrations/202610030003_location_history_integrity.sql`
- `assets/js/user-verifikasi.js`
- `tests/attendance-policy.test.cjs`
- `tests/integrity-hardening.test.cjs`

### Cara Verifikasi

```bash
node tests/attendance-policy.test.cjs
node tests/integrity-hardening.test.cjs
```

## Work Calendar and Automatic Alfa

### Status

STABLE

### Perilaku yang Sudah Benar

- Senin–Jumat masuk secara default.
- Sabtu–Minggu libur secara default.
- Override admin per tanggal lebih kuat dari default dan dapat berupa `libur` atau `masuk`.
- Generator Alfa melewati hari libur.
- Alfa otomatis mengikuti Jam Generate Alfa yang diatur admin.
- Default Jam Generate Alfa adalah pukul 12.00 WIB.
- Admin memiliki fallback manual setelah deadline dinamis tersebut.

### Jangan Rusak

- Jangan membuat Alfa pada hari libur.
- Jangan menghilangkan kemampuan menjadikan akhir pekan sebagai hari masuk khusus.
- Jangan menduplikasi peserta yang sudah hadir, terlambat, atau izin.
- Jangan membuat Alfa sebelum Jam Generate Alfa server.

### File Penting

- `supabase/migrations/202610030002_work_calendar_overrides.sql`
- `assets/js/admin-waktu.js`
- `assets/js/admin-list-absen.js`
- `tests/attendance-policy.test.cjs`

## Manual Leave

### Status

STABLE dan PROTECTED

### Fungsi

Peserta dapat mengirim izin manual ketika sakit atau berhalangan, disertai keterangan dan bukti gambar.

### Perilaku yang Sudah Benar

- Fitur tersedia untuk peserta aktif.
- Bukti menerima JPEG, PNG, atau WebP pada UI.
- Record dibuat melalui RPC `catat_izin`, bukan direct insert browser.
- Izin mengikuti kalender hari kerja dan invariant satu record per tanggal.
- Izin tanggal hari ini hanya dapat dikirim sebelum Jam Generate Alfa berdasarkan waktu server WIB.
- Tepat pada atau setelah Jam Generate Alfa, pengajuan hari ini ditolak; tanggal lampau juga ditolak, sedangkan tanggal mendatang tetap dapat diajukan.
- Jika Alfa sudah tercatat, UI menampilkan popup formal `Izin Ditolak`.
- Upload bukti dibersihkan secara best-effort bila RPC gagal.

### Jangan Rusak

- Jangan menghapus kemampuan peserta mengirim izin manual.
- Jangan memberi browser kewenangan menentukan `user_id` atau status record.

### File Penting

- `assets/js/user-izin.js`
- `supabase/migrations/202610030004_secure_manual_leave.sql`
- `supabase/migrations/202610040002_reject_late_manual_leave.sql`
- `tests/integrity-hardening.test.cjs`

## Attendance Photo Access in Exports

### Status

PROTECTED

### Fungsi

Memungkinkan penerima PDF/Excel membuka foto bukti absensi melalui halaman public viewer, walaupun tidak sedang login.

### Perilaku yang Harus Dipertahankan

- Bucket R2 tetap private.
- `r2-public-view` menerima object key aman lalu menghasilkan signed URL sementara.
- Export menggunakan tautan viewer berbasis `foto_absen_key`.
- Foto yang telah dibersihkan ditandai pada record/audit.

### Jangan Rusak

- Jangan mewajibkan sesi login pada viewer tanpa persetujuan pengguna.
- Jangan menjadikan credential atau bucket R2 publik.
- Jangan menampilkan secret/signed URL permanen di database.

### File Penting

- `foto-absen.html`
- `assets/js/foto-absen.js`
- `assets/js/admin-export-pdf.js`
- `supabase/functions/r2-public-view/index.ts`
- `supabase/functions/r2-signed-url/index.ts`

### Catatan

Keputusan akses publik dikonfirmasi eksplisit oleh pengguna karena link foto dipakai dalam hasil export.

## Location History Integrity

### Status

STABLE

### Perilaku yang Sudah Benar

- Admin menghapus lokasi melalui RPC berotorisasi.
- Hanya admin aktif yang boleh menghapus.
- FK `absensi.lokasi_absen_id` menjadi `NULL` saat lokasi dihapus.
- Snapshot `nama_tempat`, koordinat, dan jarak pada riwayat tidak ikut dihapus.

### Jangan Rusak

- Jangan menggunakan cascade delete untuk riwayat absensi.
- Jangan mengembalikan hard delete langsung dari browser.

### File Penting

- `assets/js/admin-lokasi.js`
- `supabase/migrations/202610030003_location_history_integrity.sql`
- `tests/integrity-hardening.test.cjs`

## Desktop Navbar and Lightweight Icons

### Status

PROTECTED

### Perilaku yang Harus Dipertahankan

- Pada mode laptop/desktop, navbar tetap fixed dan tidak ikut turun saat scroll di halaman admin maupun peserta.
- Pada lebar `901–1280px`, menu horizontal beralih ke hamburger/sidebar agar navbar tidak keluar viewport; pada desktop lebar menu horizontal tetap tampil.
- Navigasi memakai asset `*-nav.png`.
- Ikon konten memakai snapshot `*-static.png` dari visual animasi yang sama.
- Halaman admin dan peserta tidak memuat GIF looping secara default.

### File Penting

- `assets/css/style.css`
- Halaman di `admin/` dan `user/`
- `assets/icons/`
- `tests/navbar-layout.test.cjs`

### Cara Verifikasi

- Jalankan `node tests/icon-performance.test.cjs`.
- Jalankan `node tests/navbar-layout.test.cjs`.
- Smoke test manual pada viewport laptop di seluruh halaman admin dan peserta.
- Scroll halaman panjang dan pastikan navbar tetap pada posisi yang disepakati.
- Periksa Network/Performance browser untuk memastikan halaman tidak kembali memuat GIF looping berat.

### Bukti

- Commit `b66d574` dan `b5798db`.
- Requirement pengguna untuk mempertahankan perilaku/UI.

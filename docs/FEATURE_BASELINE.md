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

## Active Face Liveness

### Status

STABLE pada unit/contract test; runtime kamera perangkat nyata perlu dikonfirmasi setelah deploy.

### Fungsi

Mengurangi spoofing menggunakan foto diam melalui tantangan aktif yang adaptif terhadap wajah peserta.

### Perilaku yang Sudah Benar

- Identitas wajah dicocokkan sebelum dan sesudah tantangan.
- Baseline posisi netral dan bukaan mata diambil dari frame wajah valid pertama tanpa tahap stabilisasi awal.
- Setiap sesi memuat tiga langkah acak dari kedip, tengok kanan, dan tengok kiri; gerakan boleh berulang, tetapi minimal satu langkah kedip wajib ada.
- Setiap langkah kedip hanya meminta satu siklus tutup-buka; kedipan berikutnya, jika terpilih, menjadi langkah challenge tersendiri.
- Teks instruksi meminta peserta mengedipkan kedua mata secara normal, tanpa perintah pejam/merem atau menahan mata tertutup.
- Pilihan tiga langkah gerakan dibuat lokal menggunakan Web Crypto bila tersedia.
- Instruksi gerakan hanya aktif setelah jeda prompt acak; gerakan sebelumnya tidak boleh dihitung.
- Gerakan harus dilakukan sesuai urutan dan kembali ke posisi netral.
- Tengok cepat memerlukan dua frame searah: sedikitnya satu frame pendekatan dan satu frame yang mencapai ambang penuh.
- Karena preview kamera depan dimirror, tengok kanan memakai delta yaw positif dan tengok kiri memakai delta yaw negatif.
- Satu frame lonjakan arah tidak boleh dianggap sebagai gerakan tengok valid.
- Gerakan kepala sebelum prompt atau arah yang berlawanan selama dua frame menggagalkan sesi.
- Kedip harus memiliki transisi kedua mata terbuka, tertutup, lalu terbuka kembali.
- Kedipan mengutamakan koefisien MediaPipe `eyeBlinkLeft`/`eyeBlinkRight` yang dibandingkan dengan baseline peserta; EAR relatif face-api tetap menjadi fallback.
- Kedipan normal cepat sekitar satu interval frame tetap diterima melalui MediaPipe atau EAR, sedangkan perubahan kecil tanpa transisi tutup-buka tetap ditolak.
- Sumber yang membaca mata tertutup juga memverifikasi pembukaan kembali; kedua mata wajib ikut dalam siklus.
- Sampel MediaPipe yang lebih lama dari 200 ms diabaikan agar tidak menutupi EAR frame terbaru.
- Lebih dari satu wajah, wajah hilang terlalu lama, kamera berhenti, tab tersembunyi, dan timeout gagal secara tertutup.
- Pemrosesan face-api berjalan berurutan agar deteksi tidak saling tumpang tindih.
- MediaPipe tetap membaca blendshape selama challenge dengan interval lebih rapat; hanya rendering panduan visual yang berhenti sementara.

### Jangan Rusak

- Jangan kembali ke tantangan kanan-kiri tetap tanpa kedip.
- Jangan meminta dua kedipan dalam satu langkah atau menghapus jaminan minimal satu langkah kedip.
- Jangan menerima satu frame arah sebagai gerakan valid.
- Jangan membalik kembali mapping kanan/kiri kamera depan; kanan harus mengikuti sisi kanan yang dilihat peserta pada preview mirror.
- Jangan mewajibkan seluruh frame tengok mencapai ambang penuh karena gerakan manusia normal dapat berlangsung cepat.
- Jangan kembali mengabaikan arah berlawanan atau menghitung gerakan sebelum prompt.
- Jangan mematikan inferensi blendshape MediaPipe selama langkah kedip.
- Jangan kembali membuat sampel MediaPipe lama mengalahkan EAR terbaru.
- Jangan menerima kedipan satu mata atau sinyal kecil sebagai kedipan penuh.
- Jangan mengembalikan instruksi pejam/merem atau kedip perlahan; peserta cukup diminta berkedip normal.
- Jangan menghapus pemeriksaan identitas sebelum dan sesudah challenge.
- Jangan mengembalikan penantian stabilisasi wajah awal tanpa persetujuan pengguna.
- Jangan menambahkan kembali ketergantungan sesi/proof liveness server tanpa persetujuan baru pengguna.
- Jangan menyatakan kontrol browser ini sebagai attestation biometrik atau PAD tersertifikasi.

### Batas Keamanan

Tahap 1 memperkuat penolakan foto diam dan video replay biasa. Challenge dieksekusi sepenuhnya di browser dan tidak menghasilkan proof server, sehingga tidak diklaim tahan terhadap virtual camera, browser termodifikasi, video interaktif, atau deepfake real-time.

### File Penting

- `assets/js/liveness-engine.js`
- `assets/js/user-verifikasi.js`
- `assets/js/mediapipe-face-guide.js`
- `user/verifikasi.html`
- `tests/liveness-policy.test.cjs`
- `tests/liveness-stage1-rollback.test.cjs`
- `supabase/migrations/202610040006_rollback_server_bound_liveness.sql`

### Cara Verifikasi

```bash
node tests/liveness-policy.test.cjs
node tests/liveness-stage1-rollback.test.cjs
node --check assets/js/liveness-engine.js
node --check assets/js/user-verifikasi.js
node --check assets/js/mediapipe-face-guide.js
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
- Jika Alfa hari ini sudah terbentuk dari deadline lama tetapi admin memundurkan deadline dan waktu server masih sebelum deadline terbaru, RPC mengubah Alfa tersebut menjadi Izin secara atomik.
- Alfa tanggal lampau atau Alfa hari ini pada/setelah deadline terbaru tetap ditolak dengan popup formal `Izin Ditolak`.
- Upload bukti dibersihkan secara best-effort bila RPC gagal.

### Jangan Rusak

- Jangan menghapus kemampuan peserta mengirim izin manual.
- Jangan memberi browser kewenangan menentukan `user_id` atau status record.

### File Penting

- `assets/js/user-izin.js`
- `supabase/migrations/202610030004_secure_manual_leave.sql`
- `supabase/migrations/202610040002_reject_late_manual_leave.sql`
- `supabase/migrations/202610040003_reopen_alfa_after_deadline_extension.sql`
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

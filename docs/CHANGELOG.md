# Changelog

Changelog ini hanya memuat perubahan yang dapat diverifikasi dari Git history dan source saat bootstrap. Tanggal mengikuti metadata commit.

## 2026-10-04

### Added

- Active liveness dengan kalibrasi adaptif dan urutan acak kedip, tengok kanan, serta tengok kiri.
- State machine liveness teruji dan contract `tests/liveness-policy.test.cjs`.
- Jam Generate Alfa dinamis dengan fallback pukul 12.00 WIB untuk data lama.
- Field admin untuk Jam Masuk, Batas Masuk, dan Jam Generate Alfa.
- Gaya SweetAlert formal yang konsisten pada alur absensi peserta.
- Penolakan izin berbasis Jam Generate Alfa server WIB dengan respons khusus saat Alfa sudah tercatat.
- Pemulihan atomik Alfa hari ini menjadi Izin ketika admin memundurkan deadline dan batas terbaru masih terbuka.

### Changed

- Tengok kanan/kiri cepat kini dikenali dari dua frame searah dengan satu puncak penuh; satu frame lonjakan tetap ditolak.
- Cache asset liveness dinaikkan ke `active-liveness-v8` untuk memuat toleransi gerakan kepala normal yang cepat.
- Deteksi kedip menggabungkan MediaPipe dan EAR dengan sumber siklus yang konsisten, menerima kedipan cepat mulai 25 ms, dan mengabaikan sampel MediaPipe di atas 200 ms.
- Cache asset liveness dinaikkan ke `active-liveness-v7` untuk memuat perbaikan kedipan cepat.
- Baseline liveness kini diambil dari satu frame wajah valid tanpa proses menstabilkan wajah dan penantian netral awal; kestabilan setiap gerakan tetap diwajibkan.
- Cache asset liveness dinaikkan ke `active-liveness-v6` agar perubahan terbaru tidak tertahan cache browser/Vercel.
- Identitas wajah diperiksa sebelum dan sesudah challenge; gerakan wajib stabil, berurutan, dan kembali netral.
- MediaPipe tetap menjalankan blendshape kedip saat challenge; hanya rendering panduan visual yang dipause dan interval inferensi berubah dinamis.
- Status Hadir berlaku sampai Batas Masuk; setelahnya berstatus Terlambat sampai sebelum Jam Generate Alfa.
- Cron Alfa berubah dari jadwal tetap pukul 12.00 menjadi pemeriksaan idempoten setiap menit terhadap deadline server WIB.
- Popup pengajuan izin menggunakan gaya formal yang sama dengan popup absensi.

### Fixed

- False reject pada kedipan alami dikurangi melalui threshold EAR adaptif yang lebih toleran, sampling lebih rapat, dan detector liveness lebih ringan.
- False reject kedip yang masih terjadi setelah tuning EAR diperbaiki dengan sinyal khusus `eyeBlinkLeft`/`eyeBlinkRight` MediaPipe, threshold relatif terhadap baseline peserta, fallback EAR, serta cache-busting asset liveness v3.
- Foto diam dengan mata terus terbuka tidak lagi dapat lolos hanya dengan digerakkan kanan-kiri.
- Wrapper `attendance_window_status` tiga parameter mempertahankan nama parameter legacy `p_batas_telat`, sehingga migration dapat memperbarui fungsi database lama tanpa error PostgreSQL `42P13`.
- Navbar admin dan peserta tidak lagi keluar viewport pada laptop sempit; menu horizontal beralih ke hamburger/sidebar pada lebar `901–1280px`.
- Replay video biasa dipersulit melalui jeda prompt acak, target kedip satu/dua kali, batas respons yang lebih pendek, dan penolakan gerakan kepala sebelum prompt atau berlawanan arah.

### Removed

- Tahap 2 server-bound dihapus dari alur aktif; frontend kembali memakai challenge lokal Tahap 1 dan RPC `catat_absensi`.
- Telemetry event liveness serta dependency frontend pada RPC proof server dihapus.
- Migration `202610040006` menghapus tabel/function Tahap 2 jika pernah diterapkan dan memulihkan grant attendance Tahap 1.

## 2026-10-03

### Added

- Kalender hari kerja dengan Sabtu–Minggu libur default dan override `libur`/`masuk` per tanggal.
- RPC kalender untuk peserta/admin dan enforcement hari kerja pada absensi/Alfa.
- Unique attendance per `(user_id, tanggal)`.
- RPC penghapusan lokasi yang mempertahankan riwayat.
- RPC izin manual yang memvalidasi user, hari kerja, dan duplikasi.
- Helper tanggal UI `Asia/Jakarta`.
- Contract test integrity hardening.
- Contract test performa ikon untuk mencegah GIF looping kembali ke halaman.

### Changed

- Ikon konten admin dan peserta menggunakan snapshot PNG statis dari visual GIF yang sama.
- Total aset ikon konten yang direferensikan halaman turun dari sekitar 4,00 MB menjadi 45,7 KB.
- Aturan waktu absensi dipindahkan ke authority server WIB.
- Absensi dibuka satu jam sebelum jam masuk dan ditutup pukul 12.00 WIB.
- UI peserta memakai RPC untuk attendance dan manual leave.
- Penghapusan lokasi memakai RPC, bukan direct delete browser.
- Tanggal default laporan/riwayat/izin memakai zona WIB.

### Fixed

- Menghilangkan GIF looping ber-frame tinggi yang menyebabkan scroll dan respons tombol terasa patah-patah pada perangkat tertentu.
- Absensi di luar jendela waktu ditolak.
- Alfa melewati hari libur dan tidak menduplikasi record yang sudah ada.
- Penghapusan lokasi tidak lagi terhalang FK tanpa mengorbankan riwayat.
- Rendering data lokasi, keterangan, dan link bukti pada halaman terkait diperkeras.
- Validasi Edge Function hapus user mensyaratkan admin aktif.

### Technical

- Navbar mode laptop dibuat fixed pada commit `b66d574`.
- Icon dioptimalkan pada commit `b5798db`.
- Contract attendance window ditambahkan pada commit `568646a`.
- Kalender kerja ditambahkan pada commit `54726c9`.
- Integrity fixes utama terdapat pada commit `cf166f6`.

### Documentation

- Menambahkan project memory, feature baseline, architecture, database guide, decision log, README, dan permanent agent rules berdasarkan `CODEX_PROJECT_SETUP.md`.

## 2026-08-09

### Fixed

- Perbaikan export laporan pada commit `e0713aa` dan `f52da7e`.
- Perbaikan list absensi pada commit `daf02d3`.

## 2026-08-07

### Changed

- Beberapa rollback/revert UI tercatat pada Git history. Detail perilaku yang dimaksud commit message tidak cukup untuk direkonstruksi; source terbaru menjadi baseline.

## 2026-08-06

### Added

- Serangkaian commit bertajuk `menambahkan fitur tanpa login` tercatat. Detail fitur yang dimaksud tidak dapat dipastikan hanya dari pesan commit; source terbaru menjadi baseline perilaku yang didokumentasikan.

## 2026-07-14

### Added

- Fitur penghapusan foto absensi berdasarkan rentang tanggal pada commit `1441c54`.
- Audit cleanup foto melalui migration `202607140001`.

### Fixed

- Sejumlah perbaikan foto tercatat pada Git history; rincian individual tidak diklaim tanpa bukti tambahan.

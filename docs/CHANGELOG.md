# Changelog

Changelog ini hanya memuat perubahan yang dapat diverifikasi dari Git history dan source saat bootstrap. Tanggal mengikuti metadata commit.

## 2026-10-03

### Added

- Kalender hari kerja dengan Sabtu–Minggu libur default dan override `libur`/`masuk` per tanggal.
- RPC kalender untuk peserta/admin dan enforcement hari kerja pada absensi/Alfa.
- Unique attendance per `(user_id, tanggal)`.
- RPC penghapusan lokasi yang mempertahankan riwayat.
- RPC izin manual yang memvalidasi user, hari kerja, dan duplikasi.
- Helper tanggal UI `Asia/Jakarta`.
- Contract test integrity hardening.

### Changed

- Aturan waktu absensi dipindahkan ke authority server WIB.
- Absensi dibuka satu jam sebelum jam masuk dan ditutup pukul 12.00 WIB.
- UI peserta memakai RPC untuk attendance dan manual leave.
- Penghapusan lokasi memakai RPC, bukan direct delete browser.
- Tanggal default laporan/riwayat/izin memakai zona WIB.

### Fixed

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

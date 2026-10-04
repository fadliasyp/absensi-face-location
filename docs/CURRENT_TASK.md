# Current Task

## Status

Penguatan anti-replay gratis Tahap 2 selesai di repository: challenge liveness terikat sesi Supabase, singkat, dibatasi, dan sekali pakai. Seluruh syntax check dan tujuh contract test lokal lulus; deployment migration/Vercel dan uji perangkat nyata belum dikonfirmasi.

## Last Completed Task

- Task: melanjutkan penguatan liveness tanpa layanan berbayar.
- Goal: mengikat challenge browser ke sesi server Supabase dan menutup pemanggilan langsung RPC absensi lama.
- Status repository: selesai pada 2026-10-04.
- Status production: belum diterapkan/dikonfirmasi.

## Completed

- Menambahkan `assets/js/liveness-engine.js` sebagai state machine murni yang dapat diuji deterministik.
- Tantangan selalu memuat kedip, tengok kanan, dan tengok kiri tepat sekali dengan urutan acak berbasis Web Crypto bila tersedia.
- Kalibrasi memakai pose netral dan EAR mata peserta; gerakan memakai threshold relatif, beberapa frame stabil, serta wajib kembali netral.
- Sistem menolak lebih dari satu wajah, kontinuitas wajah yang hilang, timeout, tab tersembunyi, dan camera track yang berhenti.
- Identitas wajah dicocokkan sebelum dan sesudah challenge.
- MediaPipe tetap memproses koefisien `eyeBlinkLeft` dan `eyeBlinkRight` selama challenge, tetapi rendering panduan visualnya dihentikan sementara.
- Contract `tests/liveness-policy.test.cjs` melindungi foto mata terbuka, urutan arah, kestabilan frame, multi-face, kontinuitas, dan integrasi halaman.
- Kedipan yang hanya tertangkap sebagian sekarang diterima pada rasio EAR adaptif `0.76`, sedangkan perubahan kecil `0.86` tetap ditolak oleh regression test.
- Sampling face-api dipercepat dari jeda 90 ms menjadi 35 ms dan input detector liveness diturunkan dari 320 menjadi 256 agar frame kedipan tidak mudah terlewat.
- Instruksi kedip meminta gerakan perlahan/pejam sesaat sebagai fallback ramah pengguna.
- Kedip sekarang mengutamakan blendshape MediaPipe yang dibandingkan dengan baseline peserta; EAR face-api tetap menjadi fallback bila sampel MediaPipe belum tersedia/terlalu lama.
- Polling MediaPipe berubah dinamis menjadi 80 ms saat challenge dan 400 ms di luar challenge; pemrosesan frame tetap berurutan.
- Ketiga script liveness memakai query versi `active-liveness-v4` untuk mencegah browser/Vercel memakai JavaScript lama dari cache.
- Challenge lokal kini memakai jeda prompt acak 700–1700 ms, batas respons 6 detik, serta target kedip satu atau dua kali yang dipilih melalui Web Crypto.
- Gerakan kepala yang dilakukan sebelum prompt atau berlawanan dengan instruksi selama dua frame menggagalkan sesi; kedip alami saat instruksi menoleh tidak diperlakukan sebagai pelanggaran.
- Tahap 1 hanya memperkuat browser terhadap video rekaman biasa. Proof liveness sekali pakai yang diverifikasi server belum diterapkan dan menjadi kandidat Tahap 2.
- Migration `202610040004_server_bound_liveness.sql` menambahkan tabel privat `liveness_sessions` dengan status pending/passed/failed/consumed/expired.
- RPC `mulai_sesi_liveness` menerbitkan urutan dan target kedip dari server, kedaluwarsa tiga menit, serta membatasi lima sesi per sepuluh menit per peserta.
- Engine mengeluarkan jejak aksi/waktu minimal; RPC `selesaikan_sesi_liveness` memeriksa urutan, durasi, ukuran payload, kepemilikan, dan masa berlaku.
- RPC `catat_absensi_terverifikasi` hanya menerima sesi passed yang belum dipakai dan mengonsumsinya atomik setelah absensi berhasil.
- Hak execute peserta pada `catat_absensi(jsonb)` dicabut; frontend beralih ke wrapper terverifikasi.
- Asset liveness memakai cache key `active-liveness-v5`; popup kegagalan server memakai pesan formal.
- Batas keamanan tetap eksplisit: event berasal dari browser, sehingga tahap gratis ini bukan PAD/attestation biometrik dan tidak menjamin penolakan virtual camera atau browser termodifikasi.
- Verifikasi lokal lulus untuk `node --check` pada dua JavaScript yang diubah serta seluruh tujuh file test di `tests/`.

- Migration `202610040001_dynamic_attendance_deadline.sql` menambahkan `jam_generate_alfa` dengan default 12.00 WIB.
- Server mengklasifikasikan Hadir/Terlambat/Closed dari tiga waktu dan menolak urutan yang tidak valid.
- Cron memeriksa deadline setiap menit; insert Alfa tetap idempoten dan melewati hari libur.
- Form admin menyimpan dan menampilkan tiga waktu.
- Popup berhasil, gagal, terlambat, dan penolakan memakai gaya SweetAlert formal yang konsisten.
- Contract `tests/attendance-policy.test.cjs` diperbarui dengan deadline dinamis dan fallback ketika tabel pengaturan kosong.
- Kegagalan deployment PostgreSQL `42P13` diperbaiki dengan mempertahankan nama parameter legacy pada wrapper tiga parameter; migration perlu dijalankan ulang di Supabase.
- Navbar admin dan peserta memakai mode kompak pada laptop sempit tanpa mengubah perilaku posisi navbar saat scroll.
- Contract `tests/navbar-layout.test.cjs` melindungi breakpoint, hamburger, dan kemampuan brand untuk menyusut.
- Migration `202610040002_reject_late_manual_leave.sql` memperbarui RPC `catat_izin` tanpa mengubah migration lama.
- Izin hari ini ditolak tepat pada/setelah Jam Generate Alfa; izin tanggal lampau ditolak dan izin masa depan tetap diperbolehkan.
- Record Alfa menghasilkan respons `alfa_recorded`; deadline tanpa record menghasilkan `leave_deadline_passed`.
- UI menampilkan popup formal dan tetap membersihkan bukti upload ketika server menolak izin.
- Migration `202610040003_reopen_alfa_after_deadline_extension.sql` mengubah Alfa hari ini menjadi Izin secara atomik hanya sebelum deadline terbaru.
- Frontend meneruskan Alfa ke RPC agar keputusan memakai waktu server dan pengaturan terbaru, bukan pre-check browser.

## Operational Follow-up

Ini bukan task aktif sampai pengguna memintanya:

- Terapkan migration `202610040001_dynamic_attendance_deadline.sql` ke Supabase sebelum frontend.
- Terapkan migration `202610040002_reject_late_manual_leave.sql` setelah migration `202610040001`.
- Terapkan migration `202610040003_reopen_alfa_after_deadline_extension.sql` setelah migration `202610040002`.
- Terapkan migration `202610040004_server_bound_liveness.sql` setelah migration `202610040003`, sebelum deploy frontend liveness v5.
- Deploy frontend ke Vercel setelah migration berhasil.
- Deploy frontend liveness v5 ke Vercel lalu uji kamera nyata, retry/rate-limit, sesi kedaluwarsa, pemakaian ulang, dan video replay pada Android/iOS serta laptop.
- Konfirmasi penerapan migration `202610030003` dan `202610030004` di Supabase remote.
- Konfirmasi versi deployment Edge Function `delete-user`.
- Ambil schema/RLS/Storage policy production untuk melengkapi reproducibility database.

## Blockers

- Supabase CLI tidak tersedia pada environment lokal, sehingga migration belum dapat dieksekusi/divalidasi terhadap database.
- Status runtime production belum dapat dibuktikan hanya dari contract test statis.

## Notes for Next Session

1. Terapkan migration `202610040004` lebih dahulu, lalu deploy frontend ke Vercel dan lakukan hard refresh; pastikan Network memuat asset dengan query `active-liveness-v5`.
2. Uji wajah asli pada cahaya terang/redup, dengan/tanpa kacamata, dan kamera depan beberapa ponsel.
3. Pastikan satu foto diam dengan mata terbuka tidak dapat menyelesaikan langkah kedip.
4. Pastikan popup formal muncul untuk multi-face, kamera berhenti, tab berpindah, dan timeout.
5. Uji video replay dengan beberapa urutan gerakan; gerakan sebelum prompt/arah berlawanan harus ditolak.
6. Pastikan pemanggilan langsung `catat_absensi` sebagai peserta ditolak, sesi kedua dengan proof yang sama ditolak, dan rate limit menampilkan popup formal.
7. Terapkan migration `202610040001`, `202610040002`, `202610040003`, lalu `202610040004` bila belum diterapkan.
8. Pertahankan seluruh baseline logic yang dilindungi pengguna dan jangan mengklaim tahap gratis ini sebagai PAD tersertifikasi.

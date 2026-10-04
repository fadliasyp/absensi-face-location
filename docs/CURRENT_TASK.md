# Current Task

## Status

Instruksi tengok Tahap 1 kini menampilkan panah langsung pada teks kanan/kiri. Kedipan cepat diperkuat dengan sampling MediaPipe 35 ms dan puncak tutup kedua mata sekali konsumsi, sehingga frame tertutup tidak hilang ketika sudah tertimpa frame mata terbuka. Syarat kedua mata, pembukaan kembali, dan mapping arah kamera depan tetap dipertahankan. Deployment rollback/Vercel dan uji perangkat nyata belum dikonfirmasi.

## Last Completed Task

- Task: memperjelas instruksi arah dan meningkatkan keberhasilan deteksi kedipan normal yang cepat.
- Goal: menambahkan panah kanan/kiri pada teks serta mencegah frame mata tertutup terlewat tanpa menerima kedipan satu mata.
- Status repository: selesai pada 2026-10-04.
- Status production: belum diterapkan/dikonfirmasi.

## Completed

- Menambahkan `assets/js/liveness-engine.js` sebagai state machine murni yang dapat diuji deterministik.
- Tantangan selalu berisi tiga langkah acak berbasis Web Crypto bila tersedia; gerakan boleh berulang dan minimal satu langkah kedip selalu ada.
- Baseline pose, EAR, dan blendshape diambil dari frame wajah valid pertama; tahap stabilisasi awal dan penantian netral awal dihapus.
- Gerakan tetap memakai threshold relatif, beberapa frame stabil, serta wajib kembali netral setelah setiap aksi.
- Tengok cepat memakai dua frame searah; salah satunya harus mencapai ambang penuh dan frame pendukung minimal 65% dari ambang.
- Mirror kamera depan hanya memengaruhi tampilan CSS. Karena face-api membaca video mentah, tengok kanan peserta memakai delta yaw negatif dan tengok kiri memakai delta yaw positif; arah berlawanan tetap ditolak.
- Regression test mencakup tengok kanan cepat, tengok kiri cepat, serta penolakan satu frame lonjakan.
- Sistem menolak lebih dari satu wajah, kontinuitas wajah yang hilang, timeout, tab tersembunyi, dan camera track yang berhenti.
- Identitas wajah dicocokkan sebelum dan sesudah challenge.
- MediaPipe tetap memproses koefisien `eyeBlinkLeft` dan `eyeBlinkRight` selama challenge, tetapi rendering panduan visualnya dihentikan sementara.
- Contract `tests/liveness-policy.test.cjs` melindungi foto mata terbuka, urutan arah, kestabilan frame, multi-face, kontinuitas, dan integrasi halaman.
- Kedipan yang hanya tertangkap sebagian sekarang diterima pada rasio EAR adaptif `0.76`, sedangkan perubahan kecil `0.86` tetap ditolak oleh regression test.
- Durasi mata tertutup minimum diturunkan dari 60 ms menjadi 25 ms agar kedipan sekitar 35 ms yang tertangkap kamera tetap valid.
- MediaPipe dan EAR sekarang dapat sama-sama memulai siklus kedip; pembukaan mata mengutamakan sumber yang memulai siklus dengan fallback EAR jika sampel MediaPipe hilang.
- Sampel MediaPipe hanya dipakai sampai umur 200 ms, menggantikan toleransi lama 650 ms yang dapat menutupi EAR terbaru.
- Regression test memastikan kedipan cepat lolos, sinyal MediaPipe mata terbuka tidak menutupi EAR, dan kedipan satu mata tetap ditolak.
- Sampling face-api dipercepat dari jeda 90 ms menjadi 35 ms dan input detector liveness diturunkan dari 320 menjadi 256 agar frame kedipan tidak mudah terlewat.
- Instruksi kedip hanya meminta peserta mengedipkan kedua mata secara normal; tidak ada lagi perintah untuk pejam/merem atau menahan mata tertutup.
- Instruksi tengok menyertakan `➡️` untuk kanan dan `⬅️` untuk kiri langsung pada teks perintah.
- Kedip sekarang mengutamakan blendshape MediaPipe yang dibandingkan dengan baseline peserta; EAR face-api tetap menjadi fallback bila sampel MediaPipe belum tersedia/terlalu lama.
- Polling MediaPipe berubah dinamis menjadi 35 ms saat challenge dan 400 ms di luar challenge; pemrosesan frame tetap berurutan.
- MediaPipe menahan puncak koefisien kedua mata sejak konsumsi terakhir; controller mengonsumsinya sekali dan engine menerima pulsa tutup-buka yang memenuhi durasi 25–1400 ms.
- Puncak satu mata, puncak kedaluwarsa, dan puncak yang sudah dikonsumsi tidak dapat menyelesaikan langkah kedip.
- Ketiga script liveness memakai query versi `active-liveness-v13` untuk mencegah browser/Vercel memakai JavaScript lama dari cache.
- Challenge lokal memakai jeda prompt acak 700–1700 ms dan batas respons 6 detik per langkah; setiap langkah kedip hanya meminta satu kedipan.
- Gerakan kepala yang dilakukan sebelum prompt atau berlawanan dengan instruksi selama dua frame menggagalkan sesi; kedip alami saat instruksi menoleh tidak diperlakukan sebagai pelanggaran.
- Tahap 1 hanya memperkuat browser terhadap foto diam dan video rekaman biasa; tidak ada proof liveness server.
- Frontend kembali membuat challenge melalui `AttendanceLiveness.createRandomChallenge` dan mencatat absensi melalui `catat_absensi`.
- Telemetry event Tahap 2 telah dihapus dari `liveness-engine.js`.
- Setelah rollback Tahap 2, cache key terbaru adalah `active-liveness-v13` untuk koreksi koordinat kanan/kiri video mentah, panah instruksi, serta latch kedipan cepat sekali konsumsi.
- Migration `202610040006_rollback_server_bound_liveness.sql` menghapus function/table Tahap 2 dan memulihkan execute `catat_absensi(jsonb)` untuk `authenticated`.
- Migration `202610040004` dan `202610040005` dipertahankan sebagai histori karena status penerapannya pada remote belum diketahui.
- Contract `tests/liveness-stage1-rollback.test.cjs` melindungi hasil akhir rollback.

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
- Jika `202610040004` atau `202610040005` pernah diterapkan, jalankan `202610040006_rollback_server_bound_liveness.sql` sebelum deploy frontend Tahap 1.
- Deploy frontend ke Vercel setelah migration berhasil.
- Deploy frontend liveness v13 ke Vercel lalu uji arah kanan/kiri dengan kamera nyata dan uji video replay pada Android/iOS serta laptop.
- Konfirmasi penerapan migration `202610030003` dan `202610030004` di Supabase remote.
- Konfirmasi versi deployment Edge Function `delete-user`.
- Ambil schema/RLS/Storage policy production untuk melengkapi reproducibility database.

## Blockers

- Supabase CLI tidak tersedia pada environment lokal, sehingga migration belum dapat dieksekusi/divalidasi terhadap database.
- Status runtime production belum dapat dibuktikan hanya dari contract test statis.

## Notes for Next Session

1. Terapkan migration rollback `202610040006` bila Tahap 2 pernah diterapkan; setelah itu deploy frontend ke Vercel dan lakukan hard refresh. Pastikan Network memuat asset dengan query `active-liveness-v13`.
2. Uji wajah asli pada cahaya terang/redup, dengan/tanpa kacamata, dan kamera depan beberapa ponsel.
3. Pastikan satu foto diam dengan mata terbuka tidak dapat menyelesaikan langkah kedip.
4. Pastikan popup formal muncul untuk multi-face, kamera berhenti, tab berpindah, dan timeout.
5. Uji video replay dengan beberapa urutan gerakan; gerakan sebelum prompt/arah berlawanan harus ditolak.
6. Pastikan frontend tidak memanggil RPC `mulai_sesi_liveness`, `selesaikan_sesi_liveness`, atau `catat_absensi_terverifikasi`.
7. Terapkan migration `202610040001`, `202610040002`, dan `202610040003`; gunakan `202610040006` hanya sebagai rollback jika Tahap 2 pernah diterapkan.
8. Pertahankan seluruh baseline logic yang dilindungi pengguna dan jangan mengklaim Tahap 1 sebagai PAD tersertifikasi.

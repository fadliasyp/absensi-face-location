# Decision Log

## 2026-10-04 - Instruksi Kedip Menggunakan Gerakan Normal

### Status

Accepted.

### Decision

UI liveness hanya meminta peserta mengedipkan kedua mata secara normal. Peserta tidak diminta pejam/merem, menahan mata tertutup, atau berkedip perlahan. Validasi internal tetap membutuhkan transisi kedua mata tertutup lalu terbuka untuk membedakan kedipan penuh dari perubahan kecil.

### Consequences

- Instruksi lebih sesuai dengan gerakan alami peserta dan tidak mendorong mata ditutup terlalu lama.
- Target acak satu atau dua kedipan serta seluruh perlindungan Tahap 1 tetap dipertahankan.
- Contract test mencegah istilah `pejam` dan `perlahan` kembali ke engine liveness.

## 2026-10-04 - Tengok Cepat Memakai Pendekatan dan Puncak

### Status

ACCEPTED

### Decision

Tengok kanan/kiri dianggap valid setelah dua frame berurutan ke arah yang diminta. Salah satu frame wajib mencapai ambang penuh, sedangkan frame lainnya boleh menjadi frame pendekatan minimal 65% dari ambang.

### Consequences

- Gerakan kepala manusia yang cepat lebih mudah terbaca meskipun kamera hanya menangkap pendekatan dan puncaknya.
- Satu frame lonjakan tetap tidak dapat menyelesaikan gerakan.
- Arah berlawanan, gerakan sebelum prompt, dan kewajiban kembali netral tetap dipertahankan.
- Nilai 65% perlu diuji pada kamera perangkat nyata dan dapat dituning kembali bila muncul false positive atau false reject terukur.

## 2026-10-04 - Kedipan Cepat Menggunakan Fusi Sinyal Konsisten

### Status

ACCEPTED

### Decision

Siklus kedip dapat dimulai ketika kedua mata tertutup menurut MediaPipe atau EAR face-api. Pembukaan kembali mengutamakan sumber yang memulai siklus dan memakai EAR bila MediaPipe tidak lagi tersedia. Durasi tertutup minimum adalah 25 ms dan sampel MediaPipe hanya dianggap baru selama 200 ms.

### Consequences

- Kedipan manusia yang cepat dan hanya tertangkap satu frame tertutup lebih mudah dikenali.
- Sampel MediaPipe mata terbuka yang sudah lama tidak lagi menutupi kedipan yang tertangkap EAR terbaru.
- Kedipan tetap membutuhkan kedua mata, pembukaan kembali, dan beberapa frame lanjutan; kedipan satu mata serta perubahan kecil tetap ditolak.
- Ambang lebih toleran dapat meningkatkan sensitivitas terhadap satu frame deteksi buruk, tetapi syarat dua mata, sumber konsisten, urutan acak, dan pemeriksaan identitas tetap membatasi false positive.

## 2026-10-04 - Hapus Stabilisasi Awal Active Liveness

### Status

ACCEPTED

### Decision

Baseline pose dan bukaan mata diambil dari frame wajah valid pertama. Penantian kalibrasi beberapa frame dan fase netral awal tidak lagi digunakan pada konfigurasi produksi.

### Consequences

- Challenge tampil lebih cepat dan tidak lagi menampilkan proses “Menstabilkan wajah”.
- Jeda prompt acak, validasi gerakan beberapa frame, arah salah, kembali netral, pemeriksaan identitas, dan fail-closed kamera tetap dipertahankan.
- Baseline satu frame dapat lebih sensitif terhadap frame awal yang buruk, sehingga pengujian kamera perangkat nyata tetap diperlukan.
- Keputusan ini hanya menggantikan bagian kalibrasi awal dari keputusan active liveness sebelumnya.

## 2026-10-04 - Kembali ke Anti-Video Replay Tahap 1

### Status

ACCEPTED

### Decision

Upgrade server-bound Tahap 2 dibatalkan. Sistem memakai kembali challenge lokal Tahap 1 dan RPC `catat_absensi`, sedangkan migration rollback menghapus artefak database Tahap 2 bila pernah diterapkan.

### Consequences

- Tuning kedip, urutan acak, prompt tertunda, deadline respons, penolakan arah salah, dan pemeriksaan identitas awal/akhir tetap dipertahankan.
- Tidak ada dependency runtime pada tabel atau RPC sesi liveness server.
- Perlindungan terhadap virtual camera, browser termodifikasi, dan deepfake real-time tetap berada di luar jaminan Tahap 1.
- Migration Tahap 2 tetap tersimpan sebagai histori agar rollback remote dapat dilakukan secara deterministik.

## 2026-10-04 - Tahap 2 Liveness Menggunakan Supabase Tanpa Layanan Berbayar

### Status

SUPERSEDED

### Decision

Challenge liveness diterbitkan oleh RPC Supabase, disimpan singkat, dapat dimulai ulang tanpa batas jumlah percobaan, dan hanya dapat dipakai sekali melalui wrapper absensi. Tidak ada dependency atau API biometrik berbayar baru.

### Context

Pengguna meminta melanjutkan penguatan anti-video tetapi hanya dengan solusi gratis. Infrastruktur Supabase sudah menjadi backend project dan dapat mengikat challenge ke identitas login serta transaksi attendance.

### Consequences

- Browser tidak lagi memilih urutan/target kedip yang menjadi authority; server menyimpan nilai yang diharapkan.
- RPC attendance lama dicabut dari peserta dan hanya dipanggil secara internal setelah proof server berstatus `passed`.
- Expiry, row lock, dan status `consumed` menjaga lifecycle sesi serta mengurangi replay proof biasa; jumlah percobaan tidak dibatasi sesuai keputusan pengguna.
- Retry selalu mengganti sesi aktif sebelumnya dan membersihkan sesi gagal/kedaluwarsa agar percobaan tanpa batas tidak menghasilkan banyak proof aktif.
- Landmark dan timing tetap berasal dari browser. Solusi ini sengaja tidak diklaim sebagai PAD/attestation biometrik atau perlindungan terhadap browser termodifikasi, virtual camera, dan deepfake real-time.

## 2026-10-04 - Active Liveness Tetap Ringan dan Teruji di Browser

### Status

ACCEPTED

### Decision

Liveness peserta memakai kalibrasi adaptif dan tiga aksi aktif: kedip, tengok kanan, dan tengok kiri dalam urutan acak. Setiap aksi membutuhkan kestabilan beberapa frame serta posisi netral, dan identitas wajah diperiksa sebelum dan sesudah challenge.

### Context

Tantangan kanan-kiri tetap sebelumnya dapat dilewati dengan foto wajah yang digerakkan di depan kamera. Pengguna meminta peningkatan akurasi dan menyetujui teknologi baru, tetapi kombinasi gerakan dibatasi pada kedip serta kanan-kiri.

### Consequences

- State machine dipisahkan agar threshold dan transisi dapat diuji tanpa kamera.
- Pemrosesan face-api tetap sekuensial. MediaPipe mempertahankan inferensi blendshape selama challenge dengan interval dinamis; hanya rendering panduan yang dipause.
- Koefisien MediaPipe `eyeBlinkLeft`/`eyeBlinkRight` menjadi sinyal kedip utama yang dikalibrasi terhadap baseline peserta, dengan EAR face-api sebagai fallback.
- Tahap anti-replay lokal menggunakan prompt tertunda acak, target satu/dua kedipan, deadline respons, dan penolakan arah salah untuk menghambat video rekaman biasa.
- Kontrol ini ditujukan memperkuat pertahanan terhadap foto diam.
- Karena hasil biometrik masih berasal dari JavaScript browser, sistem tidak mengklaim server-verifiable attestation atau perlindungan penuh terhadap replay interaktif, virtual camera, deepfake real-time, atau browser termodifikasi. Tahap server-bound tetap keputusan terpisah.

## 2026-10-03 - Public Access untuk Foto Absensi dari Export

### Status

ACCEPTED

### Decision

Penerima hasil PDF/Excel harus dapat membuka foto absensi walaupun tidak memiliki sesi login. Bucket R2 tetap private; akses diberikan melalui public viewer yang menghasilkan signed URL sementara berdasarkan object key.

### Context

Pengguna menjelaskan bahwa foto perlu dapat dilihat oleh siapa pun yang menerima hasil export.

### Reason

Menjaga kegunaan laporan yang dibagikan tanpa membuka credential atau menjadikan bucket R2 publik.

### Alternatives

- Viewer wajib login: ditolak karena tidak memenuhi kebutuhan penerima export.
- Bucket R2 public: tidak dipilih karena memperluas exposure.

### Consequences

- `r2-public-view` tetap tersedia tanpa JWT.
- Object key berfungsi sebagai capability link dan harus sulit ditebak serta divalidasi.
- Signed URL harus tetap berumur pendek.

## 2026-10-03 — Peserta Boleh Mengirim Izin Manual

### Status

ACCEPTED

### Decision

Peserta aktif tetap dapat mengirim izin manual untuk sakit/berhalangan dengan keterangan dan bukti.

### Context

Pengguna mengonfirmasi bahwa izin manual adalah kebutuhan bisnis, bukan celah yang harus dihapus.

### Reason

Kondisi sakit/berhalangan tidak selalu dapat direpresentasikan sebagai absensi hadir.

### Alternatives

- Izin hanya oleh admin: tidak dipilih.
- Menghapus fitur izin: ditolak.

### Consequences

- UI izin tetap dipertahankan.
- Identitas/status record ditentukan RPC server.
- Izin mengikuti kalender kerja dan invariant satu record per tanggal.

## 2026-10-04 — Deadline Izin Mengikuti Jam Generate Alfa

### Status

ACCEPTED

### Decision

Pengajuan izin untuk tanggal hari ini ditutup tepat pada Jam Generate Alfa berdasarkan waktu server WIB. Tanggal lampau tidak dapat diajukan melalui formulir izin, sedangkan izin tanggal mendatang tetap diperbolehkan.

### Context

Pengguna menetapkan bahwa peserta yang baru mengajukan izin setelah proses Alfa dimulai, misalnya pukul 17.30 untuk deadline 17.00, harus ditolak.

### Consequences

- RPC `catat_izin` menjadi authority deadline dan tidak mempercayai waktu perangkat.
- Alfa tanggal lampau atau Alfa hari ini setelah deadline terbaru tidak dapat diganti melalui formulir peserta.
- Alfa hari ini dari deadline lama dapat diubah secara atomik menjadi Izin ketika admin memundurkan deadline dan waktu server masih sebelum batas baru.
- UI menampilkan popup formal dan membersihkan bukti yang telanjur diunggah ketika server menolak.

## 2026-10-03 — Server WIB Menjadi Authority Absensi

### Status

ACCEPTED

### Decision

Tanggal, waktu, status hadir/terlambat, radius, dan eligibility window ditentukan ulang oleh database menggunakan `Asia/Jakarta`.

### Context

Absensi sebelumnya dapat menghasilkan status hadir di luar jam yang dimaksud dan waktu perangkat dapat dimanipulasi.

### Reason

Mengurangi manipulasi client dan menyatukan aturan waktu.

### Alternatives

- Perhitungan browser saja: tidak dipilih karena tidak authoritative.
- Validasi UI tanpa trigger/RPC: tidak dipilih karena dapat dilewati.

### Consequences

- Browser melakukan UX pre-check, tetapi RPC/trigger menjadi enforcement.
- Absensi dibuka satu jam sebelum Jam Masuk; batas status dan penutupan mengikuti pengaturan dinamis yang tetap dihitung server.
- UI harus menampilkan error server secara ramah.

## 2026-10-03 — Kalender Kerja Default dan Override

### Status

ACCEPTED

### Decision

Senin–Jumat adalah hari masuk default, Sabtu–Minggu libur default, dan admin dapat menetapkan tanggal apa pun menjadi `libur` atau `masuk`.

### Context

Dibutuhkan hari libur nasional/khusus serta kemampuan menjadikan akhir pekan sebagai hari masuk.

### Reason

Default sederhana dengan pengecualian eksplisit lebih mudah dikelola daripada membuat jadwal untuk setiap tanggal.

### Alternatives

- Weekend selalu libur tanpa override: tidak memenuhi kebutuhan hari masuk khusus.
- Kalender penuh per tanggal: tidak dipilih.

### Consequences

- Override diprioritaskan sebelum aturan weekend.
- Absensi, izin, dan Alfa harus memakai sumber kalender yang sama.

## 2026-10-03 — Penghapusan Lokasi Mempertahankan Riwayat

### Status

ACCEPTED

### Decision

Master location boleh dihapus, tetapi record absensi lama tetap disimpan. FK menjadi `NULL` dan snapshot lokasi pada absensi tidak dihapus.

### Context

Hard delete lokasi gagal karena FK dari `absensi`, sementara admin tetap perlu mengganti/menghapus lokasi aktif.

### Reason

Riwayat laporan harus tetap utuh walaupun konfigurasi lokasi berubah.

### Alternatives

- Cascade delete riwayat: ditolak karena kehilangan data.
- Melarang penghapusan lokasi selamanya: tidak dipilih.

### Consequences

- `lokasi_absen_id` nullable.
- Delete dilakukan melalui RPC admin aktif.
- `nama_tempat` menjadi snapshot penting.

## 2026-10-03 — Project Memory Disimpan di Repository

### Status

ACCEPTED

### Decision

Architecture, database, feature baseline, current task, decisions, changelog, dan aturan agent disimpan dalam `docs/`, `README.md`, dan `AGENTS.md`.

### Context

Pengguna meminta penerapan `CODEX_PROJECT_SETUP.md` agar project tidak bergantung pada satu chat/session/account.

### Reason

Repository menjadi sumber handoff yang persisten.

### Alternatives

- Mengandalkan riwayat chat: ditolak oleh tujuan setup.

### Consequences

- Task signifikan harus memperbarui memory yang relevan.
- Fakta yang tidak terbukti ditandai belum diketahui.

## 2026-10-03 — Ikon Konten Menggunakan Snapshot Statis

### Status

ACCEPTED

### Decision

Halaman admin dan peserta menggunakan snapshot PNG `*-static.png` dari ikon animasi yang sama. GIF optimized lama tidak dimuat secara default.

### Context

Audit menemukan beberapa halaman menjalankan banyak GIF looping dengan gabungan frame tinggi. Beban decode dan komposisi tersebut membuat scroll serta respons tombol terasa patah-patah, terutama pada perangkat mobile.

### Reason

Snapshot mempertahankan bentuk, warna, dan identitas visual ikon sambil menghilangkan pekerjaan animasi terus-menerus.

### Alternatives

- Tetap menjalankan GIF looping: ditolak karena merupakan sumber beban yang terukur.
- Mengganti seluruh desain ikon: ditolak karena tidak diperlukan.
- Memuat GIF hanya saat hover: ditunda agar tahap pertama tetap sederhana dan konsisten pada perangkat sentuh.

### Consequences

- Konten memakai `*-static.png`; navigasi tetap memakai `*-nav.png`.
- Snapshot transparan diregenerasi dari frame pertama melalui `scripts/generate-static-icons.ps1`.
- GIF lama dipertahankan sebagai aset rollback, tetapi tidak direferensikan halaman.
- Efek blur/transisi CSS baru dipertimbangkan pada tahap berikutnya jika pengukuran perangkat masih menunjukkan jank.

## 2026-10-04 — Tiga Batas Waktu Absensi Dinamis

### Status

ACCEPTED

### Decision

Admin mengatur tiga waktu dalam satu hari kerja:

- Jam Masuk menentukan waktu acuan dan pembukaan satu jam sebelumnya.
- Batas Masuk adalah batas terakhir status Hadir.
- Jam Generate Alfa menutup absensi dan memulai pembuatan Alfa otomatis.

Rentang setelah Batas Masuk sampai sebelum Jam Generate Alfa berstatus Terlambat. Jika data lama belum memiliki Jam Generate Alfa, server memakai fallback 12.00 WIB.

### Context

Pengguna membutuhkan contoh alur Jam Masuk 09.00, Batas Masuk 11.00, dan Jam Generate Alfa 17.00. Dengan alur tersebut, absensi setelah 11.00 sampai 16.59 tercatat Terlambat dan mulai 17.00 ditolak/diproses Alfa.

### Reason

Memisahkan Batas Masuk dari waktu pembuatan Alfa membuat periode keterlambatan dapat diatur secara eksplisit tanpa mengandalkan penutupan tetap pukul 12.00.

### Alternatives

- Penutupan tetap pukul 12.00: ditolak karena tidak memenuhi jadwal dinamis.
- Memakai Batas Masuk sekaligus sebagai deadline Alfa: ditolak karena menghilangkan rentang Terlambat.
- Menjadwalkan ulang cron setiap admin menyimpan waktu: tidak dipilih karena lebih rapuh dibanding pemeriksaan idempoten per menit.

### Consequences

- Tabel `pengaturan_absen` memiliki `jam_generate_alfa`.
- Cron memeriksa setiap menit, sedangkan function server menolak eksekusi sebelum deadline.
- Perubahan deadline tidak menghapus Alfa secara massal; khusus pengajuan izin hari ini, RPC dapat mengubah Alfa peserta menjadi Izin jika deadline terbaru masih terbuka.
- Migration database harus diterapkan sebelum frontend pengaturan waktu baru dideploy.

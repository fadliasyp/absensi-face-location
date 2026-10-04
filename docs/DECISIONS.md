# Decision Log

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

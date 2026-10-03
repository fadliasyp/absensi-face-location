# Decision Log

## 2026-10-03 — Public Access untuk Foto Absensi dari Export

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
- Absensi dibuka satu jam sebelum jam masuk dan ditutup pukul 12.00 WIB.
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

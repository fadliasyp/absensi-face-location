# Current Task

## Status

Penolakan izin setelah Jam Generate Alfa selesai di repository. Migration database dan frontend terbaru belum diverifikasi pada Supabase/Vercel production.

## Last Completed Task

- Task: menolak izin yang diajukan setelah Jam Generate Alfa atau setelah Alfa tercatat.
- Goal: keputusan memakai waktu server WIB dan penolakan ditampilkan melalui popup formal.
- Status repository: selesai pada 2026-10-04.
- Status production: belum diterapkan/dikonfirmasi.

## Completed

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

## Operational Follow-up

Ini bukan task aktif sampai pengguna memintanya:

- Terapkan migration `202610040001_dynamic_attendance_deadline.sql` ke Supabase sebelum frontend.
- Terapkan migration `202610040002_reject_late_manual_leave.sql` setelah migration `202610040001`.
- Deploy frontend ke Vercel setelah migration berhasil.
- Konfirmasi penerapan migration `202610030003` dan `202610030004` di Supabase remote.
- Konfirmasi versi deployment Edge Function `delete-user`.
- Ambil schema/RLS/Storage policy production untuk melengkapi reproducibility database.

## Blockers

- Supabase CLI tidak tersedia pada environment lokal, sehingga migration belum dapat dieksekusi/divalidasi terhadap database.
- Status runtime production belum dapat dibuktikan hanya dari contract test statis.

## Notes for Next Session

1. Terapkan migration `202610040001`, lalu `202610040002`.
2. Verifikasi kolom `jam_generate_alfa`, constraint urutan waktu, serta satu job cron dinamis.
3. Uji izin sebelum deadline, tepat pada/setelah deadline, dan ketika Alfa sudah tercatat.
4. Deploy frontend dan smoke test contoh 09.00 / 11.00 / 17.00.
5. Pastikan perubahan deadline tidak diharapkan menghapus Alfa yang sudah terbentuk.
6. Pertahankan seluruh baseline logic yang dilindungi pengguna.

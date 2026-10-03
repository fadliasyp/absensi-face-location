# Current Task

## Status

Perbaikan overflow navbar laptop/desktop selesai di repository. Migration database dan frontend terbaru belum diverifikasi pada Supabase/Vercel production.

## Last Completed Task

- Task: mencegah navbar admin/peserta keluar viewport pada laptop sempit.
- Goal: pertahankan menu penuh pada desktop lebar dan gunakan hamburger/sidebar pada lebar `901–1280px`.
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

## Operational Follow-up

Ini bukan task aktif sampai pengguna memintanya:

- Terapkan migration `202610040001_dynamic_attendance_deadline.sql` ke Supabase sebelum frontend.
- Deploy frontend ke Vercel setelah migration berhasil.
- Konfirmasi penerapan migration `202610030003` dan `202610030004` di Supabase remote.
- Konfirmasi versi deployment Edge Function `delete-user`.
- Ambil schema/RLS/Storage policy production untuk melengkapi reproducibility database.

## Blockers

- Supabase CLI tidak tersedia pada environment lokal, sehingga migration belum dapat dieksekusi/divalidasi terhadap database.
- Status runtime production belum dapat dibuktikan hanya dari contract test statis.

## Notes for Next Session

1. Terapkan migration database lebih dahulu.
2. Verifikasi kolom `jam_generate_alfa`, constraint urutan waktu, serta satu job cron dinamis.
3. Deploy frontend dan smoke test contoh 09.00 / 11.00 / 17.00.
4. Pastikan perubahan deadline tidak diharapkan menghapus Alfa yang sudah terbentuk.
5. Pertahankan seluruh baseline logic yang dilindungi pengguna.

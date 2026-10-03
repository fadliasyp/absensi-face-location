# Current Task

## Status

Tahap pertama perbaikan performa UI selesai dan menunggu deploy/smoke test pada perangkat pengguna.

## Last Completed Task

- Task: mengurangi UI patah-patah akibat GIF ikon yang berputar terus-menerus.
- Goal: mempertahankan desain ikon sambil menghilangkan beban decode/komposisi animasi pada halaman admin dan peserta.
- Status: selesai pada 2026-10-03.
- Source code aplikasi diubah pada task ini: enam halaman HTML mengganti referensi GIF dengan PNG statis.

## Completed

- Sepuluh snapshot PNG 192×192 dibuat dari visual GIF yang sama.
- Snapshot dihasilkan secara reproducible oleh `scripts/generate-static-icons.ps1` dan mempertahankan transparansi.
- Seluruh referensi GIF pada halaman `admin/` dan `user/` dihapus.
- Aset ikon yang dimuat halaman turun dari sekitar 4,00 MB GIF menjadi 45,7 KB PNG.
- Logic tombol, kamera, absensi, izin, database, dan Edge Function tidak diubah.
- Contract test `tests/icon-performance.test.cjs` melindungi halaman dari GIF looping dan aset PNG yang hilang/terlalu besar.

## Operational Follow-up

Ini bukan task aktif sampai pengguna memintanya:

- Konfirmasi penerapan migration `202610030003` dan `202610030004` di Supabase remote.
- Konfirmasi versi deployment Edge Function `delete-user`.
- Ambil schema/RLS/Storage policy production untuk melengkapi reproducibility database.

## Blockers

- Tidak ada blocker untuk dokumentasi.
- Status runtime production belum dapat dibuktikan hanya dari repository.
- Dampak performa pada perangkat fisik tetap perlu dibuktikan setelah deploy frontend.

## Notes for Next Session

1. Deploy frontend ke Vercel dan lakukan smoke test dashboard admin/peserta serta halaman kamera.
2. Jika UI masih tersendat, lanjutkan tahap kedua secara terukur: kurangi `backdrop-filter` dan sempitkan `transition: all` pada mobile.
3. Jangan mengembalikan referensi `*-optimized.gif` tanpa hasil pengukuran yang membenarkannya.
4. Pertahankan seluruh baseline logic yang dilindungi pengguna.

drop function if exists public.catat_absensi_terverifikasi(jsonb);
drop function if exists public.selesaikan_sesi_liveness(uuid, jsonb);
drop function if exists public.mulai_sesi_liveness();

drop table if exists public.liveness_sessions;

revoke all on function public.catat_absensi(jsonb)
  from public, anon, authenticated;
grant execute on function public.catat_absensi(jsonb)
  to authenticated;

comment on function public.catat_absensi(jsonb) is
  'Mencatat absensi peserta setelah verifikasi wajah, active liveness Tahap 1 di browser, geolokasi, dan validasi waktu server WIB.';

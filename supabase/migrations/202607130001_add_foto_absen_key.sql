alter table public.absensi
add column if not exists foto_absen_key text;

comment on column public.absensi.foto_absen_key is
'Object key foto bukti absensi pada private Cloudflare R2 bucket.';

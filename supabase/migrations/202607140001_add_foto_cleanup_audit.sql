alter table public.absensi
add column if not exists foto_dihapus_at timestamptz,
add column if not exists foto_dihapus_oleh uuid references public.profiles(id) on delete set null;

comment on column public.absensi.foto_dihapus_at is
  'Waktu foto bukti absensi dihapus permanen dari penyimpanan.';

comment on column public.absensi.foto_dihapus_oleh is
  'Admin yang menghapus foto bukti absensi.';

create table if not exists public.foto_cleanup_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete restrict,
  tanggal_awal date not null,
  tanggal_akhir date not null,
  jumlah_ditemukan integer not null default 0 check (jumlah_ditemukan >= 0),
  jumlah_dihapus integer not null default 0 check (jumlah_dihapus >= 0),
  jumlah_gagal integer not null default 0 check (jumlah_gagal >= 0),
  status text not null default 'processing'
    check (status in ('processing', 'completed', 'failed')),
  pesan_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint foto_cleanup_logs_tanggal_valid
    check (tanggal_awal <= tanggal_akhir)
);

create index if not exists foto_cleanup_logs_created_at_idx
  on public.foto_cleanup_logs (created_at desc);

create index if not exists foto_cleanup_logs_admin_id_idx
  on public.foto_cleanup_logs (admin_id);

alter table public.foto_cleanup_logs enable row level security;

comment on table public.foto_cleanup_logs is
  'Audit penghapusan permanen foto bukti absensi dari Cloudflare R2.';

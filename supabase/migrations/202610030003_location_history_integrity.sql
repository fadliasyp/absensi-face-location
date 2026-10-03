alter table public.absensi
  alter column lokasi_absen_id drop not null;

alter table public.absensi
  drop constraint if exists absensi_lokasi_absen_id_fkey;

alter table public.absensi
  add constraint absensi_lokasi_absen_id_fkey
  foreign key (lokasi_absen_id)
  references public.lokasi_absen(id)
  on delete set null;

do $migration$
begin
  if exists (
    select 1
    from public.absensi
    where user_id is not null
      and tanggal is not null
    group by user_id, tanggal
    having count(*) > 1
  ) then
    raise exception
      'Ditemukan data absensi ganda untuk peserta dan tanggal yang sama. Rapikan data duplikat sebelum menjalankan migrasi ini.'
      using errcode = '23505';
  end if;
end;
$migration$;

create unique index if not exists absensi_user_tanggal_unique_idx
  on public.absensi (user_id, tanggal);

create or replace function public.hapus_lokasi_absen(p_lokasi_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin_id uuid := auth.uid();
  v_riwayat integer;
  v_dihapus integer;
begin
  if v_admin_id is null or not exists (
    select 1
    from public.profiles
    where id = v_admin_id
      and role = 'admin'
      and status_akun = 'aktif'
  ) then
    raise exception 'Akses admin aktif diperlukan.' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_lokasi_id, '')), '') is null then
    return jsonb_build_object(
      'success', false,
      'code', 'invalid_location_id',
      'message', 'ID lokasi tidak valid.'
    );
  end if;

  select count(*)::integer
  into v_riwayat
  from public.absensi
  where lokasi_absen_id::text = p_lokasi_id;

  delete from public.lokasi_absen
  where id::text = p_lokasi_id;

  get diagnostics v_dihapus = row_count;

  if v_dihapus = 0 then
    return jsonb_build_object(
      'success', false,
      'code', 'location_not_found',
      'message', 'Lokasi tidak ditemukan atau sudah dihapus.'
    );
  end if;

  return jsonb_build_object(
    'success', true,
    'released_history_count', v_riwayat,
    'message', case
      when v_riwayat > 0 then format(
        'Lokasi dihapus. %s riwayat absensi tetap tersimpan.',
        v_riwayat
      )
      else 'Lokasi berhasil dihapus.'
    end
  );
end;
$function$;

revoke all on function public.hapus_lokasi_absen(text) from public, anon;
grant execute on function public.hapus_lokasi_absen(text) to authenticated;

comment on constraint absensi_lokasi_absen_id_fkey on public.absensi is
  'Lokasi aktif boleh dihapus tanpa menghapus snapshot riwayat absensi.';

comment on function public.hapus_lokasi_absen(text) is
  'Menghapus lokasi melalui otorisasi admin aktif dan mempertahankan riwayat absensi.';

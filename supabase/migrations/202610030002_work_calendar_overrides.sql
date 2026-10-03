create table if not exists public.kalender_absen (
  tanggal date primary key,
  tipe text not null check (tipe in ('libur', 'masuk')),
  keterangan text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.kalender_absen enable row level security;
revoke all on table public.kalender_absen from anon, authenticated;

create or replace function public.attendance_day_info(p_tanggal date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_tipe text;
  v_keterangan text;
  v_akhir_pekan boolean;
begin
  if p_tanggal is null then
    return jsonb_build_object(
      'is_workday', false,
      'code', 'invalid_date',
      'title', 'Tanggal Tidak Valid',
      'message', 'Tanggal absensi tidak dapat ditentukan.'
    );
  end if;

  select tipe, keterangan
  into v_tipe, v_keterangan
  from public.kalender_absen
  where tanggal = p_tanggal;

  if found then
    if v_tipe = 'masuk' then
      return jsonb_build_object(
        'is_workday', true,
        'code', 'workday_override',
        'title', 'Hari Masuk Khusus',
        'message', coalesce(
          nullif(v_keterangan, ''),
          'Tanggal ini ditetapkan admin sebagai hari masuk.'
        ),
        'source', 'override',
        'type', v_tipe,
        'description', v_keterangan
      );
    end if;

    return jsonb_build_object(
      'is_workday', false,
      'code', 'holiday',
      'title', 'Hari Libur',
      'message', case
        when nullif(v_keterangan, '') is null then
          'Tanggal ini ditetapkan admin sebagai hari libur. Absensi tidak diperlukan.'
        else
          format('Hari libur: %s. Absensi tidak diperlukan.', v_keterangan)
      end,
      'source', 'override',
      'type', v_tipe,
      'description', v_keterangan
    );
  end if;

  v_akhir_pekan := extract(isodow from p_tanggal)::integer in (6, 7);

  if v_akhir_pekan then
    return jsonb_build_object(
      'is_workday', false,
      'code', 'holiday',
      'title', 'Hari Libur',
      'message', 'Sabtu dan Minggu adalah hari libur. Absensi tidak diperlukan.',
      'source', 'default',
      'type', 'libur',
      'description', 'Libur akhir pekan'
    );
  end if;

  return jsonb_build_object(
    'is_workday', true,
    'code', 'working_day',
    'title', 'Hari Kerja',
    'message', 'Tanggal ini mengikuti jadwal kerja normal.',
    'source', 'default',
    'type', 'masuk',
    'description', null
  );
end;
$function$;

revoke all on function public.attendance_day_info(date)
  from public, anon, authenticated;

create or replace function public.cek_hari_absensi()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_sekarang timestamp without time zone :=
    timezone('Asia/Jakarta', statement_timestamp());
  v_hari jsonb;
begin
  if v_user_id is null then
    raise exception 'Sesi login tidak valid.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
      and role = 'user'
      and status_akun = 'aktif'
  ) then
    raise exception 'Akun peserta tidak aktif.' using errcode = '42501';
  end if;

  v_hari := public.attendance_day_info(v_sekarang::date);

  return v_hari || jsonb_build_object(
    'server_date', v_sekarang::date,
    'server_time', to_char(v_sekarang::time, 'HH24:MI:SS')
  );
end;
$function$;

revoke all on function public.cek_hari_absensi() from public, anon;
grant execute on function public.cek_hari_absensi() to authenticated;

create or replace function public.daftar_hari_khusus()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin_id uuid := auth.uid();
  v_hasil jsonb;
begin
  if v_admin_id is null or not exists (
    select 1
    from public.profiles
    where id = v_admin_id
      and role = 'admin'
      and status_akun = 'aktif'
  ) then
    raise exception 'Akses admin diperlukan.' using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'tanggal', tanggal,
        'tipe', tipe,
        'keterangan', keterangan,
        'updated_at', updated_at
      )
      order by tanggal asc
    ),
    '[]'::jsonb
  )
  into v_hasil
  from public.kalender_absen;

  return v_hasil;
end;
$function$;

revoke all on function public.daftar_hari_khusus() from public, anon;
grant execute on function public.daftar_hari_khusus() to authenticated;

create or replace function public.simpan_hari_khusus(
  p_tanggal date,
  p_tipe text,
  p_keterangan text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin_id uuid := auth.uid();
  v_tipe text := lower(btrim(coalesce(p_tipe, '')));
  v_keterangan text := nullif(btrim(coalesce(p_keterangan, '')), '');
begin
  if v_admin_id is null or not exists (
    select 1
    from public.profiles
    where id = v_admin_id
      and role = 'admin'
      and status_akun = 'aktif'
  ) then
    raise exception 'Akses admin diperlukan.' using errcode = '42501';
  end if;

  if p_tanggal is null then
    return jsonb_build_object(
      'success', false,
      'message', 'Tanggal wajib dipilih.'
    );
  end if;

  if v_tipe not in ('libur', 'masuk') then
    return jsonb_build_object(
      'success', false,
      'message', 'Jenis hari hanya boleh Libur atau Masuk.'
    );
  end if;

  insert into public.kalender_absen (
    tanggal,
    tipe,
    keterangan,
    created_by,
    updated_at
  ) values (
    p_tanggal,
    v_tipe,
    v_keterangan,
    v_admin_id,
    now()
  )
  on conflict (tanggal) do update
  set tipe = excluded.tipe,
      keterangan = excluded.keterangan,
      created_by = excluded.created_by,
      updated_at = now();

  return jsonb_build_object(
    'success', true,
    'message', case
      when v_tipe = 'libur' then 'Hari libur berhasil disimpan.'
      else 'Hari masuk khusus berhasil disimpan.'
    end
  );
end;
$function$;

revoke all on function public.simpan_hari_khusus(date, text, text)
  from public, anon;
grant execute on function public.simpan_hari_khusus(date, text, text)
  to authenticated;

create or replace function public.hapus_hari_khusus(p_tanggal date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin_id uuid := auth.uid();
  v_jumlah integer;
begin
  if v_admin_id is null or not exists (
    select 1
    from public.profiles
    where id = v_admin_id
      and role = 'admin'
      and status_akun = 'aktif'
  ) then
    raise exception 'Akses admin diperlukan.' using errcode = '42501';
  end if;

  delete from public.kalender_absen where tanggal = p_tanggal;
  get diagnostics v_jumlah = row_count;

  return jsonb_build_object(
    'success', v_jumlah > 0,
    'message', case
      when v_jumlah > 0 then
        'Pengaturan tanggal dihapus. Tanggal kembali mengikuti aturan default.'
      else
        'Pengaturan tanggal tidak ditemukan.'
    end
  );
end;
$function$;

revoke all on function public.hapus_hari_khusus(date) from public, anon;
grant execute on function public.hapus_hari_khusus(date) to authenticated;

create or replace function public.enforce_attendance_workday()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_sekarang timestamp without time zone :=
    timezone('Asia/Jakarta', statement_timestamp());
  v_hari jsonb;
begin
  if new.status not in ('hadir', 'terlambat') then
    return new;
  end if;

  v_hari := public.attendance_day_info(v_sekarang::date);

  if not coalesce((v_hari ->> 'is_workday')::boolean, false) then
    raise exception 'ATTENDANCE_HOLIDAY';
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_attendance_workday()
  from public, anon, authenticated;

drop trigger if exists enforce_attendance_workday_trigger
  on public.absensi;

create trigger enforce_attendance_workday_trigger
before insert on public.absensi
for each row
when (new.status in ('hadir', 'terlambat'))
execute function public.enforce_attendance_workday();

create or replace function public.generate_alfa_harian(
  p_tanggal date default (
    timezone('Asia/Jakarta', statement_timestamp())::date
  )
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_jumlah integer;
  v_hari jsonb;
begin
  v_hari := public.attendance_day_info(p_tanggal);

  if not coalesce((v_hari ->> 'is_workday')::boolean, false) then
    return 0;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('generate_alfa_harian'),
    (p_tanggal - date '2000-01-01')::integer
  );

  insert into public.absensi (
    user_id,
    tanggal,
    waktu_masuk,
    latitude,
    longitude,
    nama_tempat,
    jarak_meter,
    status,
    keterangan,
    validasi_wajah,
    validasi_lokasi
  )
  select
    profile.id,
    p_tanggal,
    null,
    null,
    null,
    null,
    null,
    'alfa',
    'Alfa otomatis karena tidak melakukan absensi atau izin sampai pukul 12.00 WIB.',
    'tidak_valid',
    'tidak_valid'
  from public.profiles as profile
  where profile.role = 'user'
    and profile.status_akun = 'aktif'
    and not exists (
      select 1
      from public.absensi as attendance
      where attendance.user_id = profile.id
        and attendance.tanggal = p_tanggal
    );

  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end;
$function$;

revoke all on function public.generate_alfa_harian(date)
  from public, anon, authenticated;

comment on table public.kalender_absen is
  'Pengecualian kalender kerja. Tanpa baris khusus, Senin-Jumat masuk dan Sabtu-Minggu libur.';

comment on function public.attendance_day_info(date) is
  'Menentukan hari kerja dari aturan default akhir pekan dan override tanggal admin.';

comment on function public.cek_hari_absensi() is
  'Memberikan status hari kerja berdasarkan tanggal server Asia/Jakarta.';

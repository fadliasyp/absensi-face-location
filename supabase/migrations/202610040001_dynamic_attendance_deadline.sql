alter table public.pengaturan_absen
  add column if not exists jam_generate_alfa time without time zone
  default time '12:00:00';

update public.pengaturan_absen
set jam_generate_alfa = time '12:00:00'
where jam_generate_alfa is null;

alter table public.pengaturan_absen
  alter column jam_generate_alfa set default time '12:00:00',
  alter column jam_generate_alfa set not null;

alter table public.pengaturan_absen
  drop constraint if exists pengaturan_absen_urutan_waktu_check;

alter table public.pengaturan_absen
  add constraint pengaturan_absen_urutan_waktu_check
  check (
    jam_masuk::time <= batas_telat::time
    and batas_telat::time < jam_generate_alfa::time
  ) not valid;

comment on column public.pengaturan_absen.batas_telat is
  'Batas masuk berstatus hadir. Setelah waktu ini peserta berstatus terlambat.';

comment on column public.pengaturan_absen.jam_generate_alfa is
  'Batas akhir absensi dan waktu mulai pembuatan Alfa otomatis dalam zona Asia/Jakarta.';

create or replace function public.attendance_window_status(
  p_waktu time without time zone,
  p_jam_masuk time without time zone,
  p_batas_masuk time without time zone,
  p_jam_generate_alfa time without time zone
)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case
    when p_jam_masuk is null
      or p_batas_masuk is null
      or p_jam_generate_alfa is null then 'config_invalid'
    when p_batas_masuk < p_jam_masuk then 'config_invalid'
    when p_jam_generate_alfa <= p_batas_masuk then 'config_invalid'
    when p_waktu < (p_jam_masuk - interval '1 hour')::time then 'too_early'
    when p_waktu >= p_jam_generate_alfa then 'closed'
    when p_waktu <= p_batas_masuk then 'hadir'
    else 'terlambat'
  end;
$function$;

revoke all on function public.attendance_window_status(
  time,
  time,
  time,
  time
) from public, anon, authenticated;

create or replace function public.attendance_window_status(
  p_waktu time without time zone,
  p_jam_masuk time without time zone,
  p_batas_telat time without time zone
)
returns text
language sql
stable
set search_path = ''
as $function$
  select public.attendance_window_status(
    p_waktu,
    p_jam_masuk,
    p_batas_telat,
    time '12:00:00'
  );
$function$;

revoke all on function public.attendance_window_status(time, time, time)
  from public, anon, authenticated;

create or replace function public.cek_jendela_absensi()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_sekarang timestamp without time zone :=
    timezone('Asia/Jakarta', statement_timestamp());
  v_tanggal date := v_sekarang::date;
  v_waktu time without time zone := v_sekarang::time;
  v_jam_masuk time without time zone;
  v_batas_masuk time without time zone;
  v_jam_generate_alfa time without time zone;
  v_status text;
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

  select
    jam_masuk::time,
    batas_telat::time,
    coalesce(jam_generate_alfa::time, time '12:00:00')
  into v_jam_masuk, v_batas_masuk, v_jam_generate_alfa
  from public.pengaturan_absen
  order by id asc
  limit 1;

  if not found then
    return jsonb_build_object(
      'allowed', false,
      'code', 'config_missing',
      'title', 'Jadwal Belum Tersedia',
      'message', 'Admin belum mengatur jadwal absensi.'
    );
  end if;

  v_status := public.attendance_window_status(
    v_waktu,
    v_jam_masuk,
    v_batas_masuk,
    v_jam_generate_alfa
  );

  if v_status = 'config_invalid' then
    return jsonb_build_object(
      'allowed', false,
      'code', v_status,
      'title', 'Jadwal Tidak Valid',
      'message', 'Urutan waktu harus Jam Masuk, Batas Masuk, lalu Jam Generate Alfa.'
    );
  end if;

  if v_status = 'too_early' then
    return jsonb_build_object(
      'allowed', false,
      'code', v_status,
      'title', 'Absensi Belum Dibuka',
      'message', format(
        'Absensi baru dibuka pukul %s WIB, satu jam sebelum Jam Masuk.',
        to_char((v_jam_masuk - interval '1 hour')::time, 'HH24:MI')
      ),
      'server_time', to_char(v_waktu, 'HH24:MI:SS')
    );
  end if;

  if v_status = 'closed' then
    return jsonb_build_object(
      'allowed', false,
      'code', v_status,
      'title', 'Waktu Absensi Telah Berakhir',
      'message', format(
        'Absensi ditutup pukul %s WIB. Peserta tanpa absensi atau izin diproses sebagai Alfa.',
        to_char(v_jam_generate_alfa, 'HH24:MI')
      ),
      'server_time', to_char(v_waktu, 'HH24:MI:SS'),
      'close_time', to_char(v_jam_generate_alfa, 'HH24:MI')
    );
  end if;

  if exists (
    select 1
    from public.absensi
    where user_id = v_user_id
      and tanggal = v_tanggal
  ) then
    return jsonb_build_object(
      'allowed', false,
      'code', 'already_recorded',
      'title', 'Absensi Sudah Tercatat',
      'message', 'Data absensi atau izin Anda untuk hari ini sudah tercatat.'
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'code', 'allowed',
    'status', v_status,
    'server_time', to_char(v_waktu, 'HH24:MI:SS'),
    'open_time', to_char(
      (v_jam_masuk - interval '1 hour')::time,
      'HH24:MI'
    ),
    'jam_masuk', to_char(v_jam_masuk, 'HH24:MI'),
    'batas_masuk', to_char(v_batas_masuk, 'HH24:MI'),
    'batas_telat', to_char(v_batas_masuk, 'HH24:MI'),
    'jam_generate_alfa', to_char(v_jam_generate_alfa, 'HH24:MI'),
    'close_time', to_char(v_jam_generate_alfa, 'HH24:MI')
  );
end;
$function$;

revoke all on function public.cek_jendela_absensi()
  from public, anon;
grant execute on function public.cek_jendela_absensi() to authenticated;

create or replace function public.enforce_attendance_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_sekarang timestamp without time zone :=
    timezone('Asia/Jakarta', statement_timestamp());
  v_tanggal date := v_sekarang::date;
  v_waktu time without time zone := v_sekarang::time;
  v_jam_masuk time without time zone;
  v_batas_masuk time without time zone;
  v_jam_generate_alfa time without time zone;
  v_status text;
begin
  if new.status not in ('hadir', 'terlambat') then
    return new;
  end if;

  if v_user_id is null then
    raise exception 'ATTENDANCE_UNAUTHENTICATED';
  end if;

  if new.user_id is distinct from v_user_id then
    raise exception 'ATTENDANCE_USER_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_user_id
      and role = 'user'
      and status_akun = 'aktif'
  ) then
    raise exception 'ATTENDANCE_INACTIVE_USER';
  end if;

  select
    jam_masuk::time,
    batas_telat::time,
    coalesce(jam_generate_alfa::time, time '12:00:00')
  into v_jam_masuk, v_batas_masuk, v_jam_generate_alfa
  from public.pengaturan_absen
  order by id asc
  limit 1;

  if not found then
    raise exception 'ATTENDANCE_CONFIG_MISSING';
  end if;

  v_status := public.attendance_window_status(
    v_waktu,
    v_jam_masuk,
    v_batas_masuk,
    v_jam_generate_alfa
  );

  if v_status = 'config_invalid' then
    raise exception 'ATTENDANCE_CONFIG_INVALID';
  elsif v_status = 'too_early' then
    raise exception 'ATTENDANCE_TOO_EARLY';
  elsif v_status = 'closed' then
    raise exception 'ATTENDANCE_CLOSED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text),
    (v_tanggal - date '2000-01-01')::integer
  );

  if exists (
    select 1
    from public.absensi
    where user_id = v_user_id
      and tanggal = v_tanggal
  ) then
    raise exception 'ATTENDANCE_ALREADY_RECORDED';
  end if;

  new.user_id := v_user_id;
  new.tanggal := v_tanggal;
  new.waktu_masuk := v_waktu;
  new.status := v_status;

  return new;
end;
$function$;

revoke all on function public.enforce_attendance_insert()
  from public, anon, authenticated;

create or replace function public.catat_absensi(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_sekarang timestamp without time zone :=
    timezone('Asia/Jakarta', statement_timestamp());
  v_tanggal date := v_sekarang::date;
  v_waktu time without time zone := v_sekarang::time;
  v_jam_masuk time without time zone;
  v_batas_masuk time without time zone;
  v_jam_generate_alfa time without time zone;
  v_status text;
  v_lokasi public.lokasi_absen%rowtype;
  v_foto_absen_key text;
  v_latitude double precision;
  v_longitude double precision;
  v_jarak_meter double precision;
  v_a double precision;
  v_terlambat_bulan_ini integer;
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
      and face_descriptor is not null
  ) then
    raise exception 'Akun atau data wajah peserta tidak valid.'
      using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' then
    return jsonb_build_object(
      'success', false,
      'code', 'invalid_payload',
      'title', 'Data Absensi Tidak Valid',
      'message', 'Data absensi yang dikirim tidak lengkap.'
    );
  end if;

  v_foto_absen_key := nullif(p_payload ->> 'foto_absen_key', '');

  if v_foto_absen_key is null
    or v_foto_absen_key not like
      ('foto-absen/' || v_user_id::text || '/%') then
    return jsonb_build_object(
      'success', false,
      'code', 'invalid_photo',
      'title', 'Foto Absensi Tidak Valid',
      'message', 'Foto bukti absensi tidak ditemukan atau bukan milik Anda.'
    );
  end if;

  select
    jam_masuk::time,
    batas_telat::time,
    coalesce(jam_generate_alfa::time, time '12:00:00')
  into v_jam_masuk, v_batas_masuk, v_jam_generate_alfa
  from public.pengaturan_absen
  order by id asc
  limit 1;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'config_missing',
      'title', 'Jadwal Belum Tersedia',
      'message', 'Admin belum mengatur jadwal absensi.'
    );
  end if;

  v_status := public.attendance_window_status(
    v_waktu,
    v_jam_masuk,
    v_batas_masuk,
    v_jam_generate_alfa
  );

  if v_status = 'config_invalid' then
    return jsonb_build_object(
      'success', false,
      'code', v_status,
      'title', 'Jadwal Tidak Valid',
      'message', 'Urutan waktu absensi perlu diperbaiki oleh admin.'
    );
  elsif v_status = 'too_early' then
    return jsonb_build_object(
      'success', false,
      'code', v_status,
      'title', 'Absensi Belum Dibuka',
      'message', format(
        'Absensi baru dibuka pukul %s WIB, satu jam sebelum Jam Masuk.',
        to_char((v_jam_masuk - interval '1 hour')::time, 'HH24:MI')
      ),
      'server_time', to_char(v_waktu, 'HH24:MI:SS')
    );
  elsif v_status = 'closed' then
    return jsonb_build_object(
      'success', false,
      'code', v_status,
      'title', 'Waktu Absensi Telah Berakhir',
      'message', format(
        'Absensi ditutup pukul %s WIB. Silakan hubungi admin apabila memerlukan peninjauan.',
        to_char(v_jam_generate_alfa, 'HH24:MI')
      ),
      'server_time', to_char(v_waktu, 'HH24:MI:SS'),
      'close_time', to_char(v_jam_generate_alfa, 'HH24:MI')
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text),
    (v_tanggal - date '2000-01-01')::integer
  );

  if exists (
    select 1
    from public.absensi
    where user_id = v_user_id
      and tanggal = v_tanggal
  ) then
    return jsonb_build_object(
      'success', false,
      'code', 'already_recorded',
      'title', 'Absensi Sudah Tercatat',
      'message', 'Data absensi atau izin Anda untuk hari ini sudah tercatat.'
    );
  end if;

  begin
    v_latitude := (p_payload ->> 'latitude')::double precision;
    v_longitude := (p_payload ->> 'longitude')::double precision;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      return jsonb_build_object(
        'success', false,
        'code', 'invalid_location',
        'title', 'Lokasi Tidak Valid',
        'message', 'Koordinat lokasi tidak dapat diverifikasi.'
      );
  end;

  if v_latitude is null
    or v_longitude is null
    or v_latitude not between -90 and 90
    or v_longitude not between -180 and 180 then
    return jsonb_build_object(
      'success', false,
      'code', 'invalid_location',
      'title', 'Lokasi Tidak Valid',
      'message', 'Koordinat lokasi berada di luar batas yang valid.'
    );
  end if;

  select *
  into v_lokasi
  from public.lokasi_absen
  where id::text = p_payload ->> 'lokasi_absen_id'
  limit 1;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'invalid_location',
      'title', 'Lokasi Tidak Tersedia',
      'message', 'Titik lokasi absensi tidak ditemukan.'
    );
  end if;

  v_a := power(
    sin(
      radians((v_latitude - v_lokasi.latitude::double precision) / 2)
    ),
    2
  ) + cos(radians(v_lokasi.latitude::double precision))
    * cos(radians(v_latitude))
    * power(
      sin(
        radians((v_longitude - v_lokasi.longitude::double precision) / 2)
      ),
      2
    );

  v_jarak_meter := 6371000 * 2 * asin(sqrt(least(1, greatest(0, v_a))));

  if v_jarak_meter > v_lokasi.radius_meter::double precision then
    return jsonb_build_object(
      'success', false,
      'code', 'outside_location',
      'title', 'Lokasi Tidak Valid',
      'message', format(
        'Anda berada %s meter dari titik %s dan melewati radius yang diizinkan.',
        round(v_jarak_meter::numeric, 2),
        v_lokasi.nama_lokasi
      )
    );
  end if;

  insert into public.absensi (
    user_id,
    tanggal,
    waktu_masuk,
    latitude,
    longitude,
    lokasi_absen_id,
    nama_tempat,
    jarak_meter,
    status,
    keterangan,
    validasi_wajah,
    validasi_lokasi,
    foto_absen_key
  ) values (
    v_user_id,
    v_tanggal,
    v_waktu,
    v_latitude,
    v_longitude,
    v_lokasi.id,
    v_lokasi.nama_lokasi,
    v_jarak_meter,
    v_status,
    case
      when v_status = 'terlambat' then
        'Absensi terlambat melalui face scan, liveness detection, geolocation, dan waktu server WIB'
      else
        'Absensi hadir melalui face scan, liveness detection, geolocation, dan waktu server WIB'
    end,
    'valid',
    'valid',
    v_foto_absen_key
  );

  select count(*)::integer
  into v_terlambat_bulan_ini
  from public.absensi
  where user_id = v_user_id
    and status = 'terlambat'
    and tanggal >= date_trunc('month', v_tanggal)::date
    and tanggal < (date_trunc('month', v_tanggal) + interval '1 month')::date;

  return jsonb_build_object(
    'success', true,
    'status', v_status,
    'tanggal', v_tanggal,
    'waktu_masuk', to_char(v_waktu, 'HH24:MI:SS'),
    'jarak_meter', round(v_jarak_meter::numeric, 2),
    'monthly_late_count', v_terlambat_bulan_ini
  );
end;
$function$;

revoke all on function public.catat_absensi(jsonb) from public, anon;
grant execute on function public.catat_absensi(jsonb) to authenticated;

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
  v_sekarang timestamp without time zone :=
    timezone('Asia/Jakarta', statement_timestamp());
  v_waktu time without time zone := v_sekarang::time;
  v_jam_generate_alfa time without time zone := time '12:00:00';
  v_jumlah integer;
  v_hari jsonb;
begin
  if p_tanggal is null or p_tanggal > v_sekarang::date then
    return 0;
  end if;

  select coalesce(
    (
      select jam_generate_alfa::time
      from public.pengaturan_absen
      order by id asc
      limit 1
    ),
    time '12:00:00'
  )
  into v_jam_generate_alfa;

  if p_tanggal = v_sekarang::date
    and v_waktu < v_jam_generate_alfa then
    return 0;
  end if;

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
    format(
      'Alfa otomatis karena tidak melakukan absensi atau izin sampai pukul %s WIB.',
      to_char(v_jam_generate_alfa, 'HH24:MI')
    ),
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

create or replace function public.generate_alfa_hari_ini_admin()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_admin_id uuid := auth.uid();
  v_sekarang timestamp without time zone :=
    timezone('Asia/Jakarta', statement_timestamp());
  v_jam_generate_alfa time without time zone := time '12:00:00';
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

  select coalesce(
    (
      select jam_generate_alfa::time
      from public.pengaturan_absen
      order by id asc
      limit 1
    ),
    time '12:00:00'
  )
  into v_jam_generate_alfa;

  if v_sekarang::time < v_jam_generate_alfa then
    return jsonb_build_object(
      'success', false,
      'code', 'before_alfa_deadline',
      'title', 'Generate Alfa Belum Tersedia',
      'message', format(
        'Alfa baru dapat dibuat mulai pukul %s WIB.',
        to_char(v_jam_generate_alfa, 'HH24:MI')
      ),
      'server_time', to_char(v_sekarang::time, 'HH24:MI:SS'),
      'jam_generate_alfa', to_char(v_jam_generate_alfa, 'HH24:MI')
    );
  end if;

  v_jumlah := public.generate_alfa_harian(v_sekarang::date);

  return jsonb_build_object(
    'success', true,
    'generated_count', v_jumlah,
    'tanggal', v_sekarang::date,
    'jam_generate_alfa', to_char(v_jam_generate_alfa, 'HH24:MI')
  );
end;
$function$;

revoke all on function public.generate_alfa_hari_ini_admin()
  from public, anon;
grant execute on function public.generate_alfa_hari_ini_admin()
  to authenticated;

do $do$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname in (
      'generate-alfa-1200-wib',
      'generate-alfa-dinamis-wib'
    )
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$do$;

select cron.schedule(
  'generate-alfa-dinamis-wib',
  '* * * * *',
  'select public.generate_alfa_harian();'
);

comment on function public.attendance_window_status(time, time, time, time) is
  'Menentukan status absensi dari Jam Masuk, Batas Masuk, dan Jam Generate Alfa.';

comment on function public.cek_jendela_absensi() is
  'Memeriksa jendela absensi dinamis menggunakan waktu server Asia/Jakarta.';

comment on function public.catat_absensi(jsonb) is
  'Mencatat absensi dengan status dan deadline dinamis dari server WIB.';

comment on function public.generate_alfa_harian(date) is
  'Membuat Alfa idempoten setelah Jam Generate Alfa dinamis pada hari kerja.';

comment on function public.generate_alfa_hari_ini_admin() is
  'Cadangan manual admin untuk menjalankan Alfa setelah deadline dinamis.';

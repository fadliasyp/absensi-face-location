create or replace function public.catat_izin(
  p_tanggal date,
  p_keterangan text,
  p_bukti_izin_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_keterangan text := nullif(btrim(coalesce(p_keterangan, '')), '');
  v_bukti_izin_url text := nullif(btrim(coalesce(p_bukti_izin_url, '')), '');
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

  if p_tanggal is null then
    return jsonb_build_object(
      'success', false,
      'code', 'invalid_date',
      'title', 'Tanggal Tidak Valid',
      'message', 'Tanggal izin wajib dipilih.'
    );
  end if;

  if v_keterangan is null or length(v_keterangan) > 1000 then
    return jsonb_build_object(
      'success', false,
      'code', 'invalid_description',
      'title', 'Keterangan Tidak Valid',
      'message', 'Keterangan izin wajib diisi dan maksimal 1000 karakter.'
    );
  end if;

  if v_bukti_izin_url is null
    or length(v_bukti_izin_url) > 2048
    or v_bukti_izin_url !~ '^https://[^[:space:]]+$' then
    return jsonb_build_object(
      'success', false,
      'code', 'invalid_evidence',
      'title', 'Bukti Izin Tidak Valid',
      'message', 'Link bukti izin tidak valid.'
    );
  end if;

  v_hari := public.attendance_day_info(p_tanggal);

  if not coalesce((v_hari ->> 'is_workday')::boolean, false) then
    return jsonb_build_object(
      'success', false,
      'code', 'holiday',
      'title', coalesce(v_hari ->> 'title', 'Hari Libur'),
      'message', coalesce(
        v_hari ->> 'message',
        'Tanggal tersebut adalah hari libur sehingga izin tidak diperlukan.'
      )
    );
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text),
    (p_tanggal - date '2000-01-01')::integer
  );

  if exists (
    select 1
    from public.absensi
    where user_id = v_user_id
      and tanggal = p_tanggal
  ) then
    return jsonb_build_object(
      'success', false,
      'code', 'already_recorded',
      'title', 'Data Sudah Tercatat',
      'message', 'Anda sudah memiliki data absensi atau izin pada tanggal tersebut.'
    );
  end if;

  begin
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
      bukti_izin_url,
      validasi_wajah,
      validasi_lokasi
    ) values (
      v_user_id,
      p_tanggal,
      null,
      null,
      null,
      null,
      null,
      'izin',
      v_keterangan,
      v_bukti_izin_url,
      'tidak_valid',
      'tidak_valid'
    );
  exception
    when unique_violation then
      return jsonb_build_object(
        'success', false,
        'code', 'already_recorded',
        'title', 'Data Sudah Tercatat',
        'message', 'Data absensi atau izin pada tanggal tersebut sudah tercatat.'
      );
  end;

  return jsonb_build_object(
    'success', true,
    'status', 'izin',
    'tanggal', p_tanggal,
    'message', 'Izin berhasil dicatat.'
  );
end;
$function$;

revoke all on function public.catat_izin(date, text, text) from public, anon;
grant execute on function public.catat_izin(date, text, text)
  to authenticated;

revoke insert, update, delete on public.absensi
  from anon, authenticated;

comment on function public.catat_izin(date, text, text) is
  'Mencatat izin manual peserta dengan identitas, kalender kerja, dan duplikasi yang divalidasi server.';

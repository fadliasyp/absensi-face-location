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
  v_sekarang timestamp without time zone :=
    timezone('Asia/Jakarta', statement_timestamp());
  v_tanggal_hari_ini date := v_sekarang::date;
  v_waktu time without time zone := v_sekarang::time;
  v_jam_generate_alfa time without time zone := time '12:00:00';
  v_keterangan text := nullif(btrim(coalesce(p_keterangan, '')), '');
  v_bukti_izin_url text := nullif(btrim(coalesce(p_bukti_izin_url, '')), '');
  v_status_tercatat text;
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_user_id::text),
    (p_tanggal - date '2000-01-01')::integer
  );

  select status::text
  into v_status_tercatat
  from public.absensi
  where user_id = v_user_id
    and tanggal = p_tanggal
  limit 1;

  if found then
    if v_status_tercatat = 'alfa' then
      return jsonb_build_object(
        'success', false,
        'code', 'alfa_recorded',
        'title', 'Izin Ditolak',
        'message', format(
          'Status Alfa untuk tanggal %s sudah tercatat sehingga pengajuan izin tidak dapat dilakukan.',
          to_char(p_tanggal, 'DD-MM-YYYY')
        )
      );
    end if;

    return jsonb_build_object(
      'success', false,
      'code', 'already_recorded',
      'title', 'Data Sudah Tercatat',
      'message', 'Anda sudah memiliki data absensi atau izin pada tanggal tersebut.'
    );
  end if;

  if p_tanggal < v_tanggal_hari_ini
    or (
      p_tanggal = v_tanggal_hari_ini
      and v_waktu >= v_jam_generate_alfa
    ) then
    return jsonb_build_object(
      'success', false,
      'code', 'leave_deadline_passed',
      'title', 'Izin Ditolak',
      'message', case
        when p_tanggal = v_tanggal_hari_ini then format(
          'Pengajuan izin hari ini ditutup pukul %s WIB. Peserta tanpa catatan kehadiran atau izin diproses sebagai Alfa.',
          to_char(v_jam_generate_alfa, 'HH24:MI')
        )
        else format(
          'Batas pengajuan izin untuk tanggal %s telah berakhir. Status kehadiran yang sudah ditutup tidak dapat diubah melalui formulir izin.',
          to_char(p_tanggal, 'DD-MM-YYYY')
        )
      end,
      'server_time', to_char(v_waktu, 'HH24:MI:SS'),
      'jam_generate_alfa', to_char(v_jam_generate_alfa, 'HH24:MI')
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
      select status::text
      into v_status_tercatat
      from public.absensi
      where user_id = v_user_id
        and tanggal = p_tanggal
      limit 1;

      if v_status_tercatat = 'alfa' then
        return jsonb_build_object(
          'success', false,
          'code', 'alfa_recorded',
          'title', 'Izin Ditolak',
          'message', format(
            'Status Alfa untuk tanggal %s sudah tercatat sehingga pengajuan izin tidak dapat dilakukan.',
            to_char(p_tanggal, 'DD-MM-YYYY')
          )
        );
      end if;

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

revoke all on function public.catat_izin(date, text, text)
  from public, anon;
grant execute on function public.catat_izin(date, text, text)
  to authenticated;

comment on function public.catat_izin(date, text, text) is
  'Mencatat izin manual sebelum Jam Generate Alfa dengan validasi identitas, kalender kerja, deadline server WIB, dan duplikasi.';

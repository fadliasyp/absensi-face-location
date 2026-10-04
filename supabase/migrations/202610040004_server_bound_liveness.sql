create table if not exists public.liveness_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge jsonb not null,
  status text not null default 'pending',
  issued_at timestamp with time zone not null default statement_timestamp(),
  expires_at timestamp with time zone not null,
  completed_at timestamp with time zone,
  consumed_at timestamp with time zone,
  client_events jsonb,
  constraint liveness_sessions_status_check
    check (status in ('pending', 'passed', 'failed', 'consumed', 'expired'))
);

create index if not exists liveness_sessions_user_issued_idx
  on public.liveness_sessions (user_id, issued_at desc);

alter table public.liveness_sessions enable row level security;

revoke all on public.liveness_sessions from public, anon, authenticated;

create or replace function public.mulai_sesi_liveness()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_now timestamp with time zone := statement_timestamp();
  v_session_id uuid := gen_random_uuid();
  v_recent_attempts integer;
  v_sequence jsonb;
  v_blink_target integer;
  v_expires_at timestamp with time zone;
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('liveness-session:' || v_user_id::text)
  );

  update public.liveness_sessions
  set status = 'expired'
  where user_id = v_user_id
    and status in ('pending', 'passed')
    and expires_at <= v_now;

  select count(*)::integer
  into v_recent_attempts
  from public.liveness_sessions
  where user_id = v_user_id
    and issued_at >= v_now - interval '10 minutes';

  if v_recent_attempts >= 5 then
    return jsonb_build_object(
      'success', false,
      'code', 'rate_limited',
      'title', 'Batas Percobaan Tercapai',
      'message', 'Terlalu banyak percobaan verifikasi. Tunggu beberapa menit sebelum mencoba kembali.',
      'retry_after_seconds', 600
    );
  end if;

  v_sequence := case mod(
    get_byte(pg_catalog.uuid_send(v_session_id), 0),
    6
  )
    when 0 then jsonb_build_array('blink', 'turn_right', 'turn_left')
    when 1 then jsonb_build_array('blink', 'turn_left', 'turn_right')
    when 2 then jsonb_build_array('turn_right', 'blink', 'turn_left')
    when 3 then jsonb_build_array('turn_right', 'turn_left', 'blink')
    when 4 then jsonb_build_array('turn_left', 'blink', 'turn_right')
    else jsonb_build_array('turn_left', 'turn_right', 'blink')
  end;

  v_blink_target := 1 + mod(
    get_byte(pg_catalog.uuid_send(v_session_id), 1),
    2
  );
  v_expires_at := v_now + interval '3 minutes';

  insert into public.liveness_sessions (
    id,
    user_id,
    challenge,
    status,
    issued_at,
    expires_at
  ) values (
    v_session_id,
    v_user_id,
    jsonb_build_object(
      'version', 1,
      'sequence', v_sequence,
      'blink_target', v_blink_target
    ),
    'pending',
    v_now,
    v_expires_at
  );

  return jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'sequence', v_sequence,
    'blink_target', v_blink_target,
    'expires_at', v_expires_at
  );
end;
$function$;

revoke all on function public.mulai_sesi_liveness()
  from public, anon, authenticated;
grant execute on function public.mulai_sesi_liveness()
  to authenticated;

create or replace function public.selesaikan_sesi_liveness(
  p_session_id uuid,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_now timestamp with time zone := statement_timestamp();
  v_session public.liveness_sessions%rowtype;
  v_event jsonb;
  v_expected_action text;
  v_action text;
  v_started_at_ms double precision;
  v_completed_at_ms double precision;
  v_blink_count integer;
  v_previous_completed_at_ms double precision := 0;
  v_index integer;
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

  select *
  into v_session
  from public.liveness_sessions
  where id = p_session_id
    and user_id = v_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'session_not_found',
      'title', 'Sesi Verifikasi Tidak Valid',
      'message', 'Sesi verifikasi tidak ditemukan. Silakan mulai kembali.'
    );
  end if;

  if v_session.status <> 'pending' then
    return jsonb_build_object(
      'success', false,
      'code', 'session_not_pending',
      'title', 'Sesi Verifikasi Tidak Aktif',
      'message', 'Sesi verifikasi sudah selesai atau tidak lagi dapat digunakan.'
    );
  end if;

  if v_session.expires_at <= v_now then
    update public.liveness_sessions
    set status = 'expired'
    where id = p_session_id;

    return jsonb_build_object(
      'success', false,
      'code', 'session_expired',
      'title', 'Sesi Verifikasi Berakhir',
      'message', 'Waktu verifikasi telah habis. Silakan mulai kembali.'
    );
  end if;

  if jsonb_typeof(p_events) is distinct from 'array'
    or jsonb_array_length(p_events) <> 3
    or pg_catalog.octet_length(p_events::text) > 8192 then
    update public.liveness_sessions
    set status = 'failed', client_events = p_events
    where id = p_session_id;

    return jsonb_build_object(
      'success', false,
      'code', 'invalid_events',
      'title', 'Bukti Gerakan Tidak Valid',
      'message', 'Urutan bukti gerakan tidak lengkap. Silakan ulangi verifikasi.'
    );
  end if;

  for v_index in 0..2 loop
    v_event := p_events -> v_index;
    v_expected_action := v_session.challenge -> 'sequence' ->> v_index;

    if jsonb_typeof(v_event) is distinct from 'object' then
      update public.liveness_sessions
      set status = 'failed', client_events = p_events
      where id = p_session_id;

      return jsonb_build_object(
        'success', false,
        'code', 'invalid_events',
        'title', 'Bukti Gerakan Tidak Valid',
        'message', 'Format bukti gerakan tidak dapat diverifikasi.'
      );
    end if;

    begin
      v_action := v_event ->> 'action';
      v_started_at_ms := (v_event ->> 'startedAtMs')::double precision;
      v_completed_at_ms := (v_event ->> 'completedAtMs')::double precision;
      v_blink_count := coalesce((v_event ->> 'blinkCount')::integer, 0);
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        update public.liveness_sessions
        set status = 'failed', client_events = p_events
        where id = p_session_id;

        return jsonb_build_object(
          'success', false,
          'code', 'invalid_events',
          'title', 'Bukti Gerakan Tidak Valid',
          'message', 'Nilai bukti gerakan tidak dapat diverifikasi.'
        );
    end;

    if v_action is distinct from v_expected_action
      or v_started_at_ms is null
      or v_completed_at_ms is null
      or v_started_at_ms not between 0 and 45000
      or v_completed_at_ms not between 0 and 45000
      or v_started_at_ms < v_previous_completed_at_ms
      or v_completed_at_ms <= v_started_at_ms
      or v_completed_at_ms - v_started_at_ms < 100
      or v_completed_at_ms - v_started_at_ms > 7000
      or v_completed_at_ms > 45000
      or (
        v_action = 'blink'
        and v_blink_count <> (v_session.challenge ->> 'blink_target')::integer
      )
      or (v_action <> 'blink' and v_blink_count <> 0) then
      update public.liveness_sessions
      set status = 'failed', client_events = p_events
      where id = p_session_id;

      return jsonb_build_object(
        'success', false,
        'code', 'challenge_mismatch',
        'title', 'Bukti Gerakan Tidak Sesuai',
        'message', 'Gerakan tidak sesuai dengan challenge yang diterbitkan server. Silakan ulangi verifikasi.'
      );
    end if;

    v_previous_completed_at_ms := v_completed_at_ms;
  end loop;

  update public.liveness_sessions
  set
    status = 'passed',
    completed_at = v_now,
    expires_at = v_now + interval '5 minutes',
    client_events = p_events
  where id = p_session_id;

  return jsonb_build_object(
    'success', true,
    'session_id', p_session_id,
    'expires_at', v_now + interval '5 minutes'
  );
end;
$function$;

revoke all on function public.selesaikan_sesi_liveness(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.selesaikan_sesi_liveness(uuid, jsonb)
  to authenticated;

create or replace function public.catat_absensi_terverifikasi(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_now timestamp with time zone := statement_timestamp();
  v_session_id uuid;
  v_session public.liveness_sessions%rowtype;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Sesi login tidak valid.' using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' then
    return jsonb_build_object(
      'success', false,
      'code', 'invalid_payload',
      'title', 'Data Absensi Tidak Valid',
      'message', 'Data absensi yang dikirim tidak lengkap.'
    );
  end if;

  begin
    v_session_id := nullif(p_payload ->> 'liveness_session_id', '')::uuid;
  exception
    when invalid_text_representation then
      return jsonb_build_object(
        'success', false,
        'code', 'invalid_liveness_session',
        'title', 'Verifikasi Gerakan Tidak Valid',
        'message', 'Bukti verifikasi gerakan tidak valid. Silakan ulangi proses.'
      );
  end;

  if v_session_id is null then
    return jsonb_build_object(
      'success', false,
      'code', 'liveness_required',
      'title', 'Verifikasi Gerakan Diperlukan',
      'message', 'Selesaikan verifikasi gerakan sebelum mencatat absensi.'
    );
  end if;

  select *
  into v_session
  from public.liveness_sessions
  where id = v_session_id
    and user_id = v_user_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'code', 'liveness_not_found',
      'title', 'Verifikasi Gerakan Tidak Ditemukan',
      'message', 'Bukti verifikasi gerakan tidak ditemukan. Silakan ulangi proses.'
    );
  end if;

  if v_session.consumed_at is not null or v_session.status = 'consumed' then
    return jsonb_build_object(
      'success', false,
      'code', 'liveness_already_used',
      'title', 'Verifikasi Gerakan Sudah Digunakan',
      'message', 'Bukti verifikasi ini sudah digunakan dan tidak dapat dipakai kembali.'
    );
  end if;

  if v_session.status <> 'passed' then
    return jsonb_build_object(
      'success', false,
      'code', 'liveness_not_passed',
      'title', 'Verifikasi Gerakan Belum Sah',
      'message', 'Verifikasi gerakan belum berhasil diselesaikan.'
    );
  end if;

  if v_session.expires_at <= v_now then
    update public.liveness_sessions
    set status = 'expired'
    where id = v_session_id;

    return jsonb_build_object(
      'success', false,
      'code', 'liveness_expired',
      'title', 'Verifikasi Gerakan Berakhir',
      'message', 'Bukti verifikasi sudah kedaluwarsa. Silakan ulangi proses.'
    );
  end if;

  v_result := public.catat_absensi(p_payload - 'liveness_session_id');

  if coalesce((v_result ->> 'success')::boolean, false) then
    update public.liveness_sessions
    set status = 'consumed', consumed_at = v_now
    where id = v_session_id;

    return v_result || jsonb_build_object('liveness_verified', true);
  end if;

  return v_result;
end;
$function$;

revoke all on function public.catat_absensi(jsonb)
  from public, anon, authenticated;

revoke all on function public.catat_absensi_terverifikasi(jsonb)
  from public, anon, authenticated;
grant execute on function public.catat_absensi_terverifikasi(jsonb)
  to authenticated;

comment on table public.liveness_sessions is
  'Sesi challenge liveness singkat, terikat pengguna, dan sekali pakai untuk alur absensi.';

comment on function public.mulai_sesi_liveness() is
  'Menerbitkan challenge liveness acak dari server dengan kedaluwarsa dan pembatasan percobaan.';

comment on function public.selesaikan_sesi_liveness(uuid, jsonb) is
  'Memvalidasi urutan dan waktu event challenge sebelum menandai sesi liveness berhasil.';

comment on function public.catat_absensi_terverifikasi(jsonb) is
  'Mencatat absensi hanya dengan sesi liveness berhasil yang masih aktif dan belum pernah digunakan.';

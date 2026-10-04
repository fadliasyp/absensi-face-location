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
    and status in ('pending', 'passed');

  delete from public.liveness_sessions
  where user_id = v_user_id
    and status in ('failed', 'expired');

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

comment on function public.mulai_sesi_liveness() is
  'Menerbitkan challenge liveness acak tanpa batas jumlah percobaan; hanya sesi terbaru yang tetap aktif.';

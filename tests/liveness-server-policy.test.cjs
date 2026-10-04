const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "202610040004_server_bound_liveness.sql",
);

assert.ok(
  fs.existsSync(migrationPath),
  "Migration sesi liveness terikat server harus tersedia.",
);

const migration = fs.readFileSync(migrationPath, "utf8");

assert.match(
  migration,
  /create table(?: if not exists)? public\.liveness_sessions/i,
);
assert.match(migration, /enable row level security/i);
assert.match(
  migration,
  /revoke all on public\.liveness_sessions from public, anon, authenticated/i,
  "Browser tidak boleh membaca atau menulis tabel sesi secara langsung.",
);
assert.match(migration, /create or replace function public\.mulai_sesi_liveness\(\)/i);
assert.match(migration, /auth\.uid\(\)/i);
assert.match(migration, /status_akun\s*=\s*'aktif'/i);
assert.match(migration, /face_descriptor\s+is not null/i);
assert.match(migration, /interval '10 minutes'/i);
assert.match(migration, /code',\s*'rate_limited'/i);
assert.match(migration, /pg_advisory_xact_lock/i);
assert.match(migration, /expires_at/i);
assert.match(
  migration,
  /get_byte\(pg_catalog\.uuid_send\(v_session_id\)/i,
  "Urutan challenge harus berasal dari ID acak yang diterbitkan server.",
);
assert.match(
  migration,
  /create or replace function public\.selesaikan_sesi_liveness\(\s*p_session_id uuid,\s*p_events jsonb/i,
);
assert.match(migration, /for update/i, "Transisi sesi harus dikunci dalam transaksi.");
assert.match(migration, /jsonb_array_length\(p_events\)/i);
assert.match(migration, /octet_length\(p_events::text\)\s*>\s*8192/i);
assert.match(migration, /v_started_at_ms not between 0 and 45000/i);
assert.match(migration, /v_expected_action/i);
assert.match(migration, /status = 'passed'/i);
assert.match(
  migration,
  /create or replace function public\.catat_absensi_terverifikasi\(p_payload jsonb\)/i,
);
assert.match(migration, /status\s*<>\s*'passed'/i);
assert.match(migration, /consumed_at is not null/i);
assert.match(migration, /public\.catat_absensi\(p_payload - 'liveness_session_id'\)/i);
assert.match(migration, /status = 'consumed'/i);
assert.match(
  migration,
  /revoke all on function public\.catat_absensi\(jsonb\)[^]*from public, anon, authenticated/i,
  "RPC lama tidak boleh tetap dapat dipanggil langsung oleh peserta.",
);
assert.match(
  migration,
  /grant execute on function public\.catat_absensi_terverifikasi\(jsonb\)[^]*to authenticated/i,
);

console.log("Server-bound liveness policy contract: OK");

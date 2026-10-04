const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rollbackPath = path.join(
  root,
  "supabase",
  "migrations",
  "202610040006_rollback_server_bound_liveness.sql",
);
const verificationPath = path.join(
  root,
  "assets",
  "js",
  "user-verifikasi.js",
);

assert.ok(
  fs.existsSync(rollbackPath),
  "Migration rollback Tahap 2 harus tersedia untuk remote yang mungkin sudah menerapkannya.",
);

const rollback = fs.readFileSync(rollbackPath, "utf8");
const verificationScript = fs.readFileSync(verificationPath, "utf8");

assert.match(
  rollback,
  /drop function if exists public\.catat_absensi_terverifikasi\(jsonb\)/i,
);
assert.match(
  rollback,
  /drop function if exists public\.selesaikan_sesi_liveness\(uuid, jsonb\)/i,
);
assert.match(
  rollback,
  /drop function if exists public\.mulai_sesi_liveness\(\)/i,
);
assert.doesNotMatch(
  rollback,
  /revoke all on function public\.(?:mulai_sesi_liveness|selesaikan_sesi_liveness|catat_absensi_terverifikasi)/i,
  "Rollback harus tetap aman ketika function Tahap 2 belum pernah dibuat.",
);
assert.match(
  rollback,
  /drop table if exists public\.liveness_sessions/i,
);
assert.match(
  rollback,
  /grant execute on function public\.catat_absensi\(jsonb\)[^]*to authenticated/i,
  "Rollback harus memulihkan akses peserta ke RPC attendance Tahap 1.",
);
assert.match(
  verificationScript,
  /AttendanceLiveness\.createRandomChallenge/,
);
assert.match(verificationScript, /["']catat_absensi["']/);
assert.doesNotMatch(
  verificationScript,
  /mulai_sesi_liveness|selesaikan_sesi_liveness|catat_absensi_terverifikasi|liveness_session_id/,
);

console.log("Liveness Stage 1 rollback contract: OK");

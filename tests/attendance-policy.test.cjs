const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migration = fs.readFileSync(
  path.join(
    root,
    "supabase",
    "migrations",
    "202610030001_secure_attendance_window.sql",
  ),
  "utf8",
);
const verificationScript = fs.readFileSync(
  path.join(root, "assets", "js", "user-verifikasi.js"),
  "utf8",
);
const adminAttendanceScript = fs.readFileSync(
  path.join(root, "assets", "js", "admin-list-absen.js"),
  "utf8",
);

assert.match(
  migration,
  /p_waktu < \(p_jam_masuk - interval '1 hour'\)::time then 'too_early'/,
  "absensi harus ditolak sebelum satu jam menjelang jam masuk",
);
assert.match(
  migration,
  /p_waktu >= time '12:00:00' then 'closed'/,
  "absensi harus ditutup mulai pukul 12.00 WIB",
);
assert.match(
  migration,
  /p_waktu <= p_batas_telat then 'hadir'/,
  "absensi sampai batas telat harus berstatus hadir",
);
assert.match(
  migration,
  /else 'terlambat'/,
  "absensi setelah batas telat dan sebelum penutupan harus terlambat",
);
assert.match(
  migration,
  /timezone\('Asia\/Jakarta', statement_timestamp\(\)\)/,
  "tanggal dan waktu harus berasal dari server dalam zona Asia/Jakarta",
);
assert.match(
  migration,
  /create trigger enforce_attendance_insert_trigger/i,
  "insert langsung harus tetap melewati trigger pengamanan waktu",
);
assert.match(
  migration,
  /and not exists \([\s\S]*attendance\.tanggal = p_tanggal/,
  "Alfa otomatis tidak boleh menduplikasi data absensi atau izin",
);
assert.match(
  migration,
  /'generate-alfa-1200-wib',[\s\S]*'0 5 \* \* \*'/,
  "job Alfa harus dijadwalkan pukul 05.00 UTC atau 12.00 WIB",
);
assert.match(
  migration,
  /monthly_late_count/,
  "hasil pencatatan harus menyertakan jumlah telat bulan berjalan",
);
assert.match(
  migration,
  /v_foto_absen_key not like[\s\S]*'foto-absen\/'/,
  "RPC harus menolak object key foto yang bukan milik peserta",
);
assert.match(
  migration,
  /v_latitude is null[\s\S]*v_longitude is null/,
  "RPC harus menolak koordinat kosong",
);

assert.match(
  verificationScript,
  /\.rpc\("cek_jendela_absensi"\)/,
  "UI harus memeriksa jendela absensi dari server",
);
assert.match(
  verificationScript,
  /"catat_absensi"/,
  "UI harus mencatat kehadiran melalui RPC server",
);
assert.doesNotMatch(
  verificationScript,
  /\.from\("absensi"\)\.insert/,
  "UI peserta tidak boleh mengirim status kehadiran langsung",
);
assert.match(
  verificationScript,
  /showLateAttendancePopup\([\s\S]*monthly_late_count/,
  "UI terlambat harus menampilkan jumlah keterlambatan bulanan",
);
assert.match(
  verificationScript,
  /showAttendanceRejectedPopup/,
  "UI harus menyediakan popup penolakan absensi",
);
assert.match(
  adminAttendanceScript,
  /\.rpc\([\s\S]*"generate_alfa_hari_ini_admin"/,
  "fallback Alfa manual harus memakai waktu server dan RPC admin",
);

console.log("Attendance policy contract: OK");

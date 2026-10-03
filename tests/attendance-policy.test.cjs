const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const attendanceWindowMigration = fs.readFileSync(
  path.join(
    root,
    "supabase",
    "migrations",
    "202610030001_secure_attendance_window.sql",
  ),
  "utf8",
);
const workCalendarMigrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "202610030002_work_calendar_overrides.sql",
);
const workCalendarMigration = fs.existsSync(workCalendarMigrationPath)
  ? fs.readFileSync(workCalendarMigrationPath, "utf8")
  : "";
const migration = `${attendanceWindowMigration}\n${workCalendarMigration}`;
const verificationScript = fs.readFileSync(
  path.join(root, "assets", "js", "user-verifikasi.js"),
  "utf8",
);
const adminAttendanceScript = fs.readFileSync(
  path.join(root, "assets", "js", "admin-list-absen.js"),
  "utf8",
);
const adminScheduleScript = fs.readFileSync(
  path.join(root, "assets", "js", "admin-waktu.js"),
  "utf8",
);
const adminSchedulePage = fs.readFileSync(
  path.join(root, "admin", "waktu.html"),
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
  migration,
  /extract\(isodow from p_tanggal\)[\s\S]*in \(6, 7\)/i,
  "Sabtu dan Minggu harus libur secara default",
);
assert.match(
  migration,
  /check \(tipe in \('libur', 'masuk'\)\)/i,
  "override kalender hanya boleh berisi hari libur atau hari masuk",
);
assert.match(
  migration,
  /from public\.kalender_absen[\s\S]*if found then[\s\S]*extract\(isodow from p_tanggal\)/i,
  "override tanggal harus diprioritaskan sebelum aturan akhir pekan",
);
assert.match(
  migration,
  /create or replace function public\.cek_hari_absensi\(\)/i,
  "peserta harus memperoleh status hari kerja dari server",
);
assert.match(
  migration,
  /create trigger enforce_attendance_workday_trigger/i,
  "insert langsung pada hari libur harus ditolak oleh database",
);
assert.match(
  migration,
  /generate_alfa_harian[\s\S]*attendance_day_info\(p_tanggal\)[\s\S]*return 0/i,
  "generator Alfa harus melewati hari libur",
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
  verificationScript,
  /\.rpc\(\s*"cek_hari_absensi"/,
  "UI peserta harus memeriksa kalender kerja server sebelum absensi",
);
assert.match(
  adminAttendanceScript,
  /\.rpc\([\s\S]*"generate_alfa_hari_ini_admin"/,
  "fallback Alfa manual harus memakai waktu server dan RPC admin",
);
assert.match(
  adminScheduleScript,
  /"simpan_hari_khusus"/,
  "admin harus dapat menyimpan tanggal libur atau masuk khusus",
);
assert.match(
  adminScheduleScript,
  /"daftar_hari_khusus"/,
  "admin harus dapat melihat daftar tanggal khusus",
);
assert.match(
  adminScheduleScript,
  /"hapus_hari_khusus"/,
  "admin harus dapat menghapus override agar tanggal kembali ke aturan default",
);
assert.match(
  adminSchedulePage,
  /id="hariKhususForm"[\s\S]*value="libur"[\s\S]*value="masuk"/,
  "halaman admin harus menyediakan pilihan Libur dan Masuk",
);

console.log("Attendance policy contract: OK");

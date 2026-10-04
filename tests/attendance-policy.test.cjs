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
const dynamicDeadlineMigrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "202610040001_dynamic_attendance_deadline.sql",
);
const dynamicDeadlineMigration = fs.existsSync(dynamicDeadlineMigrationPath)
  ? fs.readFileSync(dynamicDeadlineMigrationPath, "utf8")
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
assert.ok(
  /add column if not exists jam_generate_alfa[\s\S]*default time '12:00:00'/i.test(
    dynamicDeadlineMigration,
  ),
  "jam generate Alfa harus tersimpan dengan default pukul 12.00 WIB",
);
assert.ok(
  /p_waktu >= p_jam_generate_alfa then 'closed'/.test(
    dynamicDeadlineMigration,
  ),
  "absensi harus ditutup pada jam generate Alfa dinamis",
);
assert.ok(
  /p_waktu <= p_batas_masuk then 'hadir'/.test(dynamicDeadlineMigration),
  "absensi sampai batas masuk harus berstatus hadir",
);
assert.ok(
  /else 'terlambat'/.test(dynamicDeadlineMigration),
  "absensi setelah batas masuk dan sebelum Alfa harus terlambat",
);
assert.ok(
  /p_jam_generate_alfa <= p_batas_masuk then 'config_invalid'/.test(
    dynamicDeadlineMigration,
  ),
  "jam generate Alfa harus lebih akhir dari batas masuk",
);
assert.ok(
  /p_batas_masuk < p_jam_masuk then 'config_invalid'/.test(
    dynamicDeadlineMigration,
  ),
  "Batas Masuk tidak boleh lebih awal dari Jam Masuk",
);
assert.ok(
  /create or replace function public\.attendance_window_status\(\s*p_waktu time without time zone,\s*p_jam_masuk time without time zone,\s*p_batas_telat time without time zone\s*\)[\s\S]*?select public\.attendance_window_status\(\s*p_waktu,\s*p_jam_masuk,\s*p_batas_telat,\s*time '12:00:00'\s*\);/.test(
    dynamicDeadlineMigration,
  ),
  "wrapper tiga parameter harus mempertahankan nama parameter legacy p_batas_telat",
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
assert.ok(
  /'generate-alfa-dinamis-wib',[\s\S]*'\* \* \* \* \*'/.test(
    dynamicDeadlineMigration,
  ),
  "job Alfa dinamis harus mengecek deadline setiap menit",
);
assert.ok(
  /v_waktu < v_jam_generate_alfa[\s\S]*return 0/i.test(
    dynamicDeadlineMigration,
  ),
  "generator Alfa tidak boleh berjalan sebelum deadline server WIB",
);
const defaultDeadlineSelections =
  dynamicDeadlineMigration.match(
    /select coalesce\(\s*\(\s*select jam_generate_alfa::time[\s\S]*?limit 1\s*\),\s*time '12:00:00'\s*\)/gi,
  ) || [];
assert.ok(
  defaultDeadlineSelections.length >= 2,
  "cron dan fallback admin harus memakai pukul 12.00 meski tabel pengaturan masih kosong",
);
assert.ok(
  /generate_alfa_harian[\s\S]*attendance_day_info\(p_tanggal\)[\s\S]*return 0/i.test(
    dynamicDeadlineMigration,
  ),
  "generator Alfa dinamis harus tetap melewati hari libur",
);
assert.ok(
  /generate_alfa_harian[\s\S]*and not exists \([\s\S]*attendance\.tanggal = p_tanggal/i.test(
    dynamicDeadlineMigration,
  ),
  "cron setiap menit harus tetap idempoten dan tidak menduplikasi absensi",
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
assert.ok(
  /customClass:[\s\S]*popup: "attendance-swal-popup"/.test(
    verificationScript,
  ),
  "popup absensi harus memakai tampilan formal yang konsisten",
);
assert.ok(
  /confirmButtonText: "Saya Mengerti"/.test(verificationScript),
  "popup absensi formal harus memakai aksi yang jelas",
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
assert.ok(
  /id="batasTelatInput"[\s\S]*id="jamGenerateAlfaInput"/.test(
    adminSchedulePage,
  ),
  "admin harus dapat mengatur Batas Masuk dan Jam Generate Alfa",
);
assert.ok(
  /Batas Masuk[\s\S]*Jam Generate Alfa/.test(adminSchedulePage),
  "label pengaturan waktu harus menjelaskan tiga batas waktu",
);
assert.ok(
  !/max="11:59"/.test(adminSchedulePage),
  "input waktu dinamis tidak boleh dibatasi tetap sebelum pukul 12.00",
);
assert.ok(
  /jam_generate_alfa/.test(adminScheduleScript),
  "UI admin harus menyimpan jam generate Alfa",
);
assert.ok(
  /jam_generate_alfa <= batas_telat/.test(adminScheduleScript),
  "UI admin harus menolak jam Alfa yang tidak lebih akhir dari batas masuk",
);
assert.ok(
  !/jam_masuk >= "12:00"|batas_telat >= "12:00"/.test(adminScheduleScript),
  "UI admin tidak boleh mempertahankan batas tetap pukul 12.00",
);

console.log("Attendance policy contract: OK");

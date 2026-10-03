const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const locationMigrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "202610030003_location_history_integrity.sql",
);

assert.ok(
  fs.existsSync(locationMigrationPath),
  "migrasi integritas lokasi harus tersedia",
);

const locationMigration = fs.readFileSync(locationMigrationPath, "utf8");
const adminLocationScript = fs.readFileSync(
  path.join(root, "assets", "js", "admin-lokasi.js"),
  "utf8",
);
const leaveMigrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "202610030004_secure_manual_leave.sql",
);
const lateLeaveMigrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "202610040002_reject_late_manual_leave.sql",
);
const reopenedLeaveMigrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "202610040003_reopen_alfa_after_deadline_extension.sql",
);

assert.match(
  locationMigration,
  /foreign key \(lokasi_absen_id\)[\s\S]*on delete set null/i,
  "lokasi yang dihapus harus melepaskan FK tanpa menghapus riwayat absensi",
);
assert.match(
  locationMigration,
  /create unique index[\s\S]*on public\.absensi \(user_id, tanggal\)/i,
  "setiap peserta hanya boleh memiliki satu data absensi per tanggal",
);
assert.match(
  locationMigration,
  /create or replace function public\.hapus_lokasi_absen\(p_lokasi_id text\)/i,
  "penghapusan lokasi harus melalui RPC server",
);
assert.match(
  locationMigration,
  /role = 'admin'[\s\S]*status_akun = 'aktif'/i,
  "RPC penghapusan lokasi hanya boleh dipakai admin aktif",
);
assert.match(
  adminLocationScript,
  /\.rpc\("hapus_lokasi_absen"/,
  "UI admin harus menghapus lokasi melalui RPC",
);
assert.doesNotMatch(
  adminLocationScript,
  /\.from\("lokasi_absen"\)[\s\S]{0,100}\.delete\(\)/,
  "UI admin tidak boleh melakukan hard delete lokasi langsung",
);

assert.ok(
  fs.existsSync(leaveMigrationPath),
  "migrasi izin manual aman harus tersedia",
);
assert.ok(
  fs.existsSync(lateLeaveMigrationPath),
  "migrasi penolakan izin setelah Jam Generate Alfa harus tersedia",
);
assert.ok(
  fs.existsSync(reopenedLeaveMigrationPath),
  "migrasi pemulihan Alfa setelah deadline dimundurkan harus tersedia",
);

const leaveMigration = fs.readFileSync(leaveMigrationPath, "utf8");
const lateLeaveMigration = fs.readFileSync(lateLeaveMigrationPath, "utf8");
const reopenedLeaveMigration = fs.readFileSync(
  reopenedLeaveMigrationPath,
  "utf8",
);
const userLeaveScript = fs.readFileSync(
  path.join(root, "assets", "js", "user-izin.js"),
  "utf8",
);
const jakartaDateHelperPath = path.join(
  root,
  "assets",
  "js",
  "jakarta-date.js",
);

assert.match(
  leaveMigration,
  /create or replace function public\.catat_izin\(/i,
  "izin manual harus dicatat melalui RPC server",
);
assert.match(
  leaveMigration,
  /attendance_day_info\(p_tanggal\)/i,
  "izin harus mengikuti kalender hari kerja server",
);
assert.match(
  leaveMigration,
  /pg_advisory_xact_lock[\s\S]*p_tanggal/i,
  "pencatatan izin harus dikunci per peserta dan tanggal",
);
assert.match(
  leaveMigration,
  /revoke insert, update, delete on public\.absensi[\s\S]*authenticated/i,
  "browser tidak boleh memutasi tabel absensi secara langsung",
);
assert.match(
  lateLeaveMigration,
  /timezone\('Asia\/Jakarta', statement_timestamp\(\)\)/i,
  "deadline izin harus memakai waktu server WIB",
);
assert.match(
  lateLeaveMigration,
  /select jam_generate_alfa::time[\s\S]*time '12:00:00'/i,
  "deadline izin harus mengikuti Jam Generate Alfa dengan fallback pukul 12.00",
);
assert.match(
  lateLeaveMigration,
  /p_tanggal < v_tanggal_hari_ini[\s\S]*p_tanggal = v_tanggal_hari_ini[\s\S]*v_waktu >= v_jam_generate_alfa/i,
  "izin untuk tanggal yang deadline-nya lewat harus ditolak server",
);
assert.match(
  lateLeaveMigration,
  /'code', 'leave_deadline_passed'[\s\S]*'title', 'Izin Ditolak'/i,
  "penolakan setelah deadline harus memiliki respons formal khusus",
);
assert.match(
  lateLeaveMigration,
  /v_status_tercatat = 'alfa'[\s\S]*'code', 'alfa_recorded'/i,
  "Alfa yang sudah tercatat harus menghasilkan penolakan izin khusus",
);
assert.match(
  reopenedLeaveMigration,
  /v_status_tercatat = 'alfa'[\s\S]*p_tanggal = v_tanggal_hari_ini[\s\S]*v_waktu < v_jam_generate_alfa/i,
  "Alfa hari ini hanya boleh dipulihkan sebelum deadline dinamis terbaru",
);
assert.match(
  reopenedLeaveMigration,
  /update public\.absensi[\s\S]*status = 'izin'[\s\S]*status = 'alfa'/i,
  "pemulihan harus mengubah Alfa menjadi Izin secara atomik",
);
assert.match(
  reopenedLeaveMigration,
  /'code', 'alfa_replaced_with_leave'[\s\S]*'status', 'izin'/i,
  "pemulihan Alfa harus mengembalikan hasil sukses Izin yang eksplisit",
);
assert.match(
  reopenedLeaveMigration,
  /p_tanggal = v_tanggal_hari_ini[\s\S]*v_waktu >= v_jam_generate_alfa[\s\S]*'code', 'alfa_recorded'/i,
  "Alfa tetap harus ditolak tepat pada atau setelah deadline terbaru",
);
assert.match(
  userLeaveScript,
  /\.rpc\(\s*"catat_izin"/,
  "form izin harus menggunakan RPC server",
);
assert.doesNotMatch(
  userLeaveScript,
  /\.from\("absensi"\)\.insert/,
  "form izin tidak boleh insert langsung ke tabel absensi",
);
assert.match(
  userLeaveScript,
  /hapusBuktiIzin[\s\S]*storage[\s\S]*\.remove/,
  "foto izin harus dibersihkan jika pencatatan database gagal",
);
assert.match(
  userLeaveScript,
  /popup: "attendance-swal-popup"[\s\S]*confirmButtonText: "Saya Mengerti"/,
  "penolakan izin harus memakai popup formal yang konsisten",
);
assert.match(
  userLeaveScript,
  /if \(dataTercatat && dataTercatat\.status !== "alfa"\)/,
  "pre-check browser harus meneruskan Alfa ke RPC agar deadline terbaru dinilai server",
);

assert.ok(
  fs.existsSync(jakartaDateHelperPath),
  "helper tanggal Asia/Jakarta harus tersedia",
);

const jakartaDateContext = { window: {}, Intl };
vm.runInNewContext(
  fs.readFileSync(jakartaDateHelperPath, "utf8"),
  jakartaDateContext,
);
assert.equal(
  jakartaDateContext.window.getJakartaDateString(
    new Date("2026-10-02T17:30:00.000Z"),
  ),
  "2026-10-03",
  "helper harus berpindah tanggal sesuai tengah malam Asia/Jakarta",
);

const datePageScripts = [
  ["admin/list-absen.html", "admin-list-absen.js"],
  ["admin/export-pdf.html", "admin-export-pdf.js"],
  ["user/riwayat.html", "user-riwayat.js"],
  ["user/izin.html", "user-izin.js"],
];

for (const [pagePath, pageScript] of datePageScripts) {
  const html = fs.readFileSync(path.join(root, ...pagePath.split("/")), "utf8");
  const helperPosition = html.indexOf("jakarta-date.js");
  const pageScriptPosition = html.indexOf(pageScript);

  assert.ok(helperPosition >= 0, `${pagePath} harus memuat helper tanggal WIB`);
  assert.ok(
    helperPosition < pageScriptPosition,
    `${pagePath} harus memuat helper WIB sebelum script halaman`,
  );
}

const dateSensitiveScripts = [
  "admin-list-absen.js",
  "admin-export-pdf.js",
  "user-riwayat.js",
  "user-izin.js",
].map((fileName) =>
  fs.readFileSync(path.join(root, "assets", "js", fileName), "utf8"),
);

for (const script of dateSensitiveScripts) {
  assert.doesNotMatch(
    script,
    /new Date\(\)\.toISOString\(\)\.split\("T"\)\[0\]/,
    "tanggal default tidak boleh dihitung menggunakan UTC",
  );
  assert.match(
    script,
    /getJakartaDateString\(\)/,
    "tanggal default harus memakai helper Asia/Jakarta",
  );
}

const deleteUserFunction = fs.readFileSync(
  path.join(root, "supabase", "functions", "delete-user", "index.ts"),
  "utf8",
);
const adminAttendanceScript = fs.readFileSync(
  path.join(root, "assets", "js", "admin-list-absen.js"),
  "utf8",
);
const userHistoryScript = fs.readFileSync(
  path.join(root, "assets", "js", "user-riwayat.js"),
  "utf8",
);

assert.match(
  deleteUserFunction,
  /select\("role, status_akun"\)/,
  "fungsi hapus user harus mengambil status akun admin",
);
assert.match(
  deleteUserFunction,
  /adminProfile\.status_akun !== "aktif"/,
  "fungsi hapus user harus menolak admin yang tidak aktif",
);
assert.doesNotMatch(
  adminLocationScript,
  /function escapeQuotes/,
  "nama lokasi tidak boleh dimasukkan ke inline handler",
);
assert.match(
  adminLocationScript,
  /function escapeHtml[\s\S]*function safeText[\s\S]*escapeHtml/,
  "teks lokasi yang dirender sebagai HTML harus disanitasi",
);

for (const script of [adminAttendanceScript, userHistoryScript]) {
  assert.match(
    script,
    /function showMessage[\s\S]{0,260}\$\{(escapeHtml|escapeAttribute)\(text\)\}/,
    "pesan dinamis harus di-escape sebelum masuk ke innerHTML",
  );
  assert.match(
    script,
    /function safeText[\s\S]{0,180}(escapeHtml|escapeAttribute)\(value\)/,
    "teks absensi dari database harus di-escape sebelum masuk ke innerHTML",
  );
  assert.match(
    script,
    /function renderBuktiIzinLink[\s\S]*protocol !== "https:"/,
    "tautan bukti izin harus dirender melalui allowlist HTTPS",
  );
  assert.doesNotMatch(
    script,
    /href="\$\{(?:absen|item)\.bukti_izin_url\}"/,
    "URL bukti izin mentah tidak boleh masuk langsung ke atribut href",
  );
}

console.log("Integrity hardening contract: OK");

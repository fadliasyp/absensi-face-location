const messageBox = document.getElementById("message");
const absenTableBody = document.getElementById("absenTableBody");
const absenCardList = document.getElementById("absenCardList");

const tanggalAwalInput = document.getElementById("tanggal_awal");
const tanggalAkhirInput = document.getElementById("tanggal_akhir");
const filterStatusInput = document.getElementById("filter_status");

const todayText = document.getElementById("todayText");
const totalHadirEl = document.getElementById("totalHadir");
const totalIzinEl = document.getElementById("totalIzin");
const totalAlfaEl = document.getElementById("totalAlfa");

const totalTerlambatEl = document.getElementById("totalTerlambat");

function openAdminSidebar() {
  const sidebar = document.getElementById("adminSidebar");
  const overlay = document.getElementById("adminSidebarOverlay");

  if (sidebar) sidebar.classList.add("show");
  if (overlay) overlay.classList.add("show");

  document.body.classList.add("admin-sidebar-open");
}

function closeAdminSidebar() {
  const sidebar = document.getElementById("adminSidebar");
  const overlay = document.getElementById("adminSidebarOverlay");

  if (sidebar) sidebar.classList.remove("show");
  if (overlay) overlay.classList.remove("show");

  document.body.classList.remove("admin-sidebar-open");
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeAdminSidebar();
  }
});

function isiNavbarAdmin(profile) {
  const namaAdmin = profile.nama_lengkap || "Admin";

  const sidebarAdminName = document.getElementById("sidebarAdminName");
  const desktopAdminName = document.getElementById("desktopAdminName");

  if (sidebarAdminName) {
    sidebarAdminName.innerText = namaAdmin;
  }

  if (desktopAdminName) {
    desktopAdminName.innerText = namaAdmin;
  }
}

function showMessage(text, type = "error") {
  if (!messageBox) return;

  messageBox.innerHTML = `
    <div class="alert ${type === "success" ? "alert-success" : "alert-error"}">
      ${text}
    </div>
  `;
}

async function cekAdmin() {
  const { data: authData, error: authError } =
    await supabaseClient.auth.getUser();

  if (authError || !authData.user) {
    window.location.href = "../login.html";
    return null;
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    window.location.href = "../user/dashboard.html";
    return null;
  }

  isiNavbarAdmin(profile);

  return profile;
}

function safeText(value) {
  return value !== null && value !== undefined && value !== ""
    ? String(value)
    : "-";
}

function formatTanggal(tanggal) {
  if (!tanggal) return "-";

  const date = new Date(tanggal + "T00:00:00");

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatWaktu(waktu) {
  if (!waktu) return "-";
  return waktu.substring(0, 5);
}

function formatAngka(value) {
  if (value === null || value === undefined) return "-";
  return Number(value).toFixed(6);
}

function formatJarak(value) {
  if (value === null || value === undefined) return "-";
  return Number(value).toFixed(2) + " meter";
}

function badgeStatus(status) {
  if (status === "hadir") {
    return `<span class="badge badge-aktif">Hadir</span>`;
  }

  if (status === "terlambat") {
    return `<span class="badge badge-terlambat">Terlambat</span>`;
  }

  if (status === "izin") {
    return `<span class="badge badge-pending">Izin</span>`;
  }

  return `<span class="badge badge-ditolak">Alfa</span>`;
}

function badgeValidasi(value) {
  if (value === "valid") {
    return `<span class="badge badge-aktif">Valid</span>`;
  }

  return `<span class="badge badge-ditolak">Tidak Valid</span>`;
}

function setTanggalHariIniText() {
  if (!todayText) return;

  const now = new Date();

  todayText.textContent = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function setDefaultTanggal() {
  const today = new Date().toISOString().split("T")[0];

  if (!tanggalAwalInput.value) {
    tanggalAwalInput.value = today;
  }

  if (!tanggalAkhirInput.value) {
    tanggalAkhirInput.value = today;
  }
}

function updateSummary(absensiList) {
  const totalHadir = absensiList.filter(
    (item) => item.status === "hadir",
  ).length;
  const totalTerlambat = absensiList.filter(
    (item) => item.status === "terlambat",
  ).length;
  const totalIzin = absensiList.filter((item) => item.status === "izin").length;
  const totalAlfa = absensiList.filter((item) => item.status === "alfa").length;

  if (totalHadirEl) totalHadirEl.textContent = totalHadir;
  if (totalTerlambatEl) totalTerlambatEl.textContent = totalTerlambat;
  if (totalIzinEl) totalIzinEl.textContent = totalIzin;
  if (totalAlfaEl) totalAlfaEl.textContent = totalAlfa;
}

function renderDesktopTable(absensiList) {
  if (!absenTableBody) return;

  absenTableBody.innerHTML = absensiList
    .map((absen) => {
      const profile = absen.profiles || {};

      return `
      <tr>
        <td>${safeText(profile.nama_lengkap)}</td>
        <td>${safeText(profile.bagian)}</td>
        <td>${formatTanggal(absen.tanggal)}</td>
        <td>${formatWaktu(absen.waktu_masuk)}</td>
        <td>${formatAngka(absen.latitude)}</td>
        <td>${formatAngka(absen.longitude)}</td>
        <td>${safeText(absen.nama_tempat)}</td>
        <td>${formatJarak(absen.jarak_meter)}</td>
        <td>${badgeStatus(absen.status)}</td>
        <td>${badgeValidasi(absen.validasi_wajah)}</td>
        <td>${badgeValidasi(absen.validasi_lokasi)}</td>
        <td>${safeText(absen.keterangan)}</td>
        <td>
  ${
    absen.foto_absen_url
      ? `<a href="${absen.foto_absen_url}" target="_blank" class="absen-photo-link">Lihat Foto Absen</a>`
      : "-"
  }
</td>
        <td>
          ${
            absen.bukti_izin_url
              ? `<a href="${absen.bukti_izin_url}" target="_blank">Lihat Bukti</a>`
              : "-"
          }
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderMobileCards(absensiList) {
  if (!absenCardList) return;

  absenCardList.innerHTML = absensiList
    .map((absen) => {
      const profile = absen.profiles || {};

      return `
      <div class="absen-mobile-card">
        <div class="absen-mobile-header">
          <div>
            <h3>${safeText(profile.nama_lengkap)}</h3>
            <p>${safeText(profile.bagian)}</p>
          </div>

          <div class="absen-status-group">
            ${badgeStatus(absen.status)}
            ${badgeValidasi(absen.validasi_lokasi)}
          </div>
        </div>

        <div class="absen-info-grid">
          <div>
            <span>Tanggal</span>
            <strong>${formatTanggal(absen.tanggal)}</strong>
          </div>

          <div>
            <span>Waktu Masuk</span>
            <strong>${formatWaktu(absen.waktu_masuk)}</strong>
          </div>

          <div>
            <span>Tempat</span>
            <strong>${safeText(absen.nama_tempat)}</strong>
          </div>

          <div>
            <span>Jarak</span>
            <strong>${formatJarak(absen.jarak_meter)}</strong>
          </div>

          <div>
            <span>Koordinat</span>
            <strong>${formatAngka(absen.latitude)}, ${formatAngka(absen.longitude)}</strong>
          </div>

          <div>
            <span>Validasi Wajah</span>
            <strong>${absen.validasi_wajah === "valid" ? "Valid" : "Tidak Valid"}</strong>
          </div>
          <div class="absen-mobile-proof">
  <span>Foto Absen</span>
  <strong>
    ${
      absen.foto_absen_url
        ? `<a href="${absen.foto_absen_url}" target="_blank">Lihat Foto Absen</a>`
        : "-"
    }
  </strong>
</div>
        </div>

        <div class="absen-keterangan-box">
          <strong>Keterangan:</strong><br>
          ${safeText(absen.keterangan)}
        </div>

        

        ${
          absen.bukti_izin_url
            ? `<a class="absen-proof-link" href="${absen.bukti_izin_url}" target="_blank">Lihat Bukti Izin</a>`
            : ""
        }
      </div>
    `;
    })
    .join("");
}

async function loadAbsensi() {
  const adminProfile = await cekAdmin();

  if (!adminProfile) return;

  showMessage("Memuat data absensi...", "success");

  let query = supabaseClient
    .from("absensi")
    .select(
      `
      *,
      profiles (
        nama_lengkap,
        bagian,
        email
      )
    `,
    )
    .order("tanggal", { ascending: false })
    .order("waktu_masuk", { ascending: false });

  const tanggalAwal = tanggalAwalInput.value;
  const tanggalAkhir = tanggalAkhirInput.value;
  const filterStatus = filterStatusInput.value;

  if (tanggalAwal) {
    query = query.gte("tanggal", tanggalAwal);
  }

  if (tanggalAkhir) {
    query = query.lte("tanggal", tanggalAkhir);
  }

  if (filterStatus) {
    query = query.eq("status", filterStatus);
  }

  const { data: absensiList, error } = await query;

  if (error) {
    console.error(error);

    if (absenTableBody) {
      absenTableBody.innerHTML = `
        <tr>
          <td colspan="14">Gagal memuat absensi: ${error.message}</td>
        </tr>
      `;
    }

    if (absenCardList) {
      absenCardList.innerHTML = `
        <div class="empty-absen-card">
          Gagal memuat absensi: ${error.message}
        </div>
      `;
    }

    updateSummary([]);
    showMessage("Gagal memuat data absensi.");
    return;
  }

  if (!absensiList || absensiList.length === 0) {
    if (absenTableBody) {
      absenTableBody.innerHTML = `
        <tr>
          <td colspan="14">Belum ada data absensi pada filter ini.</td>
        </tr>
      `;
    }

    if (absenCardList) {
      absenCardList.innerHTML = `
        <div class="empty-absen-card">
          Belum ada data absensi pada filter ini.
        </div>
      `;
    }

    updateSummary([]);
    showMessage("Data absensi kosong.", "success");
    return;
  }

  renderDesktopTable(absensiList);
  renderMobileCards(absensiList);
  updateSummary(absensiList);

  showMessage("Data absensi berhasil dimuat.", "success");
}

function getTanggalHariIni() {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

async function generateAlfaHariIni() {
  const yakin = confirm(
    "Generate alfa untuk user yang tidak absen dan tidak izin hari ini?",
  );

  if (!yakin) return;

  const tanggalHariIni = getTanggalHariIni();

  showMessage("Memproses data alfa...", "success");

  const { data: users, error: userError } = await supabaseClient
    .from("profiles")
    .select("id, nama_lengkap")
    .eq("role", "user")
    .eq("status_akun", "aktif");

  if (userError) {
    showMessage("Gagal mengambil data user: " + userError.message);
    return;
  }

  const { data: absensiHariIni, error: absenError } = await supabaseClient
    .from("absensi")
    .select("user_id, status")
    .eq("tanggal", tanggalHariIni);

  if (absenError) {
    showMessage("Gagal mengambil data absensi: " + absenError.message);
    return;
  }

  const userSudahAdaAbsensi = new Set(
    (absensiHariIni || []).map((item) => item.user_id),
  );

  const userAlfa = (users || []).filter((user) => {
    return !userSudahAdaAbsensi.has(user.id);
  });

  if (userAlfa.length === 0) {
    showMessage("Tidak ada user yang perlu ditandai alfa.", "success");
    return;
  }

  const dataInsert = userAlfa.map((user) => ({
    user_id: user.id,
    tanggal: tanggalHariIni,
    waktu_masuk: null,
    latitude: null,
    longitude: null,
    nama_tempat: null,
    jarak_meter: null,
    status: "alfa",
    keterangan:
      "Alfa/tanpa keterangan karena tidak melakukan absensi seharian penuh.",
    validasi_wajah: "tidak_valid",
    validasi_lokasi: "tidak_valid",
  }));

  const { error: insertError } = await supabaseClient
    .from("absensi")
    .insert(dataInsert);

  if (insertError) {
    showMessage("Gagal generate alfa: " + insertError.message);
    return;
  }

  showMessage(`${userAlfa.length} user berhasil ditandai alfa.`, "success");
  loadAbsensi();
}

async function init() {
  setTanggalHariIniText();
  setDefaultTanggal();
  await loadAbsensi();
}

init();

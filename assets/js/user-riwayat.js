const messageBox = document.getElementById("message");
const riwayatTableBody = document.getElementById("riwayatTableBody");
const riwayatCardList = document.getElementById("riwayatCardList");

const tanggalAwalInput = document.getElementById("tanggal_awal");
const tanggalAkhirInput = document.getElementById("tanggal_akhir");
const filterStatusInput = document.getElementById("filter_status");

const riwayatTodayText = document.getElementById("riwayatTodayText");
const totalHadirEl = document.getElementById("totalHadir");
const totalIzinEl = document.getElementById("totalIzin");
const totalAlfaEl = document.getElementById("totalAlfa");
const totalTerlambatEl = document.getElementById("totalTerlambat");

const sidebarUserNameEl = document.getElementById("sidebarUserName");
const sidebarUserBagianEl = document.getElementById("sidebarUserBagian");
const sidebarUserStatusEl = document.getElementById("sidebarUserStatus");
const sidebarUserPhotoEl = document.getElementById("sidebarUserPhoto");
const sidebarAvatarFallbackEl = document.getElementById(
  "sidebarAvatarFallback",
);

const desktopUserNameEl = document.getElementById("desktopUserName");
const desktopUserBagianEl = document.getElementById("desktopUserBagian");
const desktopUserPhotoEl = document.getElementById("desktopUserPhoto");
const desktopAvatarFallbackEl = document.getElementById(
  "desktopAvatarFallback",
);

let currentUser = null;

function isiNavbarUser(profile) {
  const nama = profile.nama_lengkap ?? "User";
  const bagian = profile.bagian ?? "-";
  const statusAkun = profile.status_akun ?? "aktif";
  const fotoUrl = profile.foto_wajah_url;

  if (sidebarUserNameEl) sidebarUserNameEl.innerText = nama;
  if (sidebarUserBagianEl) sidebarUserBagianEl.innerText = bagian;
  if (sidebarUserStatusEl) sidebarUserStatusEl.innerText = statusAkun;

  if (desktopUserNameEl) desktopUserNameEl.innerText = nama;
  if (desktopUserBagianEl) desktopUserBagianEl.innerText = bagian;

  if (fotoUrl) {
    if (sidebarUserPhotoEl) {
      sidebarUserPhotoEl.src = fotoUrl;
      sidebarUserPhotoEl.classList.add("show");
    }

    if (sidebarAvatarFallbackEl) {
      sidebarAvatarFallbackEl.classList.add("hide");
    }

    if (desktopUserPhotoEl) {
      desktopUserPhotoEl.src = fotoUrl;
      desktopUserPhotoEl.classList.add("show");
    }

    if (desktopAvatarFallbackEl) {
      desktopAvatarFallbackEl.classList.add("hide");
    }
  } else {
    if (sidebarUserPhotoEl) {
      sidebarUserPhotoEl.removeAttribute("src");
      sidebarUserPhotoEl.classList.remove("show");
    }

    if (sidebarAvatarFallbackEl) {
      sidebarAvatarFallbackEl.classList.remove("hide");
    }

    if (desktopUserPhotoEl) {
      desktopUserPhotoEl.removeAttribute("src");
      desktopUserPhotoEl.classList.remove("show");
    }

    if (desktopAvatarFallbackEl) {
      desktopAvatarFallbackEl.classList.remove("hide");
    }
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

function openUserSidebar() {
  const sidebar = document.getElementById("userSidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (sidebar) sidebar.classList.add("show");
  if (overlay) overlay.classList.add("show");

  document.body.classList.add("sidebar-open");
}

function closeUserSidebar() {
  const sidebar = document.getElementById("userSidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (sidebar) sidebar.classList.remove("show");
  if (overlay) overlay.classList.remove("show");

  document.body.classList.remove("sidebar-open");
}

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeUserSidebar();
  }
});

async function cekUser() {
  const { data: authData, error: authError } =
    await supabaseClient.auth.getUser();

  if (authError || !authData.user) {
    window.location.href = "../login.html";
    return null;
  }

  currentUser = authData.user;

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (profileError || !profile) {
    window.location.href = "../login.html";
    return null;
  }

  if (profile.status_akun !== "aktif") {
    await supabaseClient.auth.signOut();
    window.location.href = "../login.html";
    return null;
  }

  isiNavbarUser(profile);

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
  if (!riwayatTodayText) return;

  const now = new Date();

  riwayatTodayText.textContent = now.toLocaleDateString("id-ID", {
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

function renderDesktopTable(riwayatList) {
  if (!riwayatTableBody) return;

  riwayatTableBody.innerHTML = riwayatList
    .map((item) => {
      return `
      <tr>
        <td>${formatTanggal(item.tanggal)}</td>
        <td>${formatWaktu(item.waktu_masuk)}</td>
        <td>${badgeStatus(item.status)}</td>
        <td>${safeText(item.nama_tempat)}</td>
        <td>${formatAngka(item.latitude)}</td>
        <td>${formatAngka(item.longitude)}</td>
        <td>${formatJarak(item.jarak_meter)}</td>
        <td>${badgeValidasi(item.validasi_lokasi)}</td>
        <td>${badgeValidasi(item.validasi_wajah)}</td>
        <td>${safeText(item.keterangan)}</td>
        <td>
          ${
            item.bukti_izin_url
              ? `<a href="${item.bukti_izin_url}" target="_blank">Lihat Bukti</a>`
              : "-"
          }
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderMobileCards(riwayatList) {
  if (!riwayatCardList) return;

  riwayatCardList.innerHTML = riwayatList
    .map((item) => {
      return `
      <div class="riwayat-mobile-card">
        <div class="riwayat-mobile-header">
          <div>
            <h3>${formatTanggal(item.tanggal)}</h3>
            <p>${safeText(item.nama_tempat)}</p>
          </div>

          <div class="riwayat-status-group">
            ${badgeStatus(item.status)}
            ${badgeValidasi(item.validasi_lokasi)}
          </div>
        </div>

        <div class="riwayat-info-grid">
          <div>
            <span>Waktu Masuk</span>
            <strong>${formatWaktu(item.waktu_masuk)}</strong>
          </div>

          <div>
            <span>Tempat</span>
            <strong>${safeText(item.nama_tempat)}</strong>
          </div>

          <div>
            <span>Jarak</span>
            <strong>${formatJarak(item.jarak_meter)}</strong>
          </div>

          <div>
            <span>Koordinat</span>
            <strong>${formatAngka(item.latitude)}, ${formatAngka(item.longitude)}</strong>
          </div>

          <div>
            <span>Validasi Wajah</span>
            <strong>${item.validasi_wajah === "valid" ? "Valid" : "Tidak Valid"}</strong>
          </div>
        </div>

        <div class="riwayat-keterangan-box">
          <strong>Keterangan:</strong><br>
          ${safeText(item.keterangan)}
        </div>

        ${
          item.bukti_izin_url
            ? `<a class="riwayat-proof-link" href="${item.bukti_izin_url}" target="_blank">Lihat Bukti Izin</a>`
            : ""
        }
      </div>
    `;
    })
    .join("");
}

async function loadRiwayat() {
  const profile = await cekUser();

  if (!profile) return;

  showMessage("Memuat riwayat absensi...", "success");

  let query = supabaseClient
    .from("absensi")
    .select("*")
    .eq("user_id", currentUser.id)
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

  const { data: riwayatList, error } = await query;

  if (error) {
    console.error(error);

    if (riwayatTableBody) {
      riwayatTableBody.innerHTML = `
        <tr>
          <td colspan="11">Gagal memuat riwayat: ${error.message}</td>
        </tr>
      `;
    }

    if (riwayatCardList) {
      riwayatCardList.innerHTML = `
        <div class="empty-riwayat-card">
          Gagal memuat riwayat: ${error.message}
        </div>
      `;
    }

    updateSummary([]);
    showMessage("Gagal memuat riwayat absensi.");
    return;
  }

  if (!riwayatList || riwayatList.length === 0) {
    if (riwayatTableBody) {
      riwayatTableBody.innerHTML = `
        <tr>
          <td colspan="11">Belum ada riwayat absensi pada filter ini.</td>
        </tr>
      `;
    }

    if (riwayatCardList) {
      riwayatCardList.innerHTML = `
        <div class="empty-riwayat-card">
          Belum ada riwayat absensi pada filter ini.
        </div>
      `;
    }

    updateSummary([]);
    showMessage("Riwayat absensi kosong.", "success");
    return;
  }

  renderDesktopTable(riwayatList);
  renderMobileCards(riwayatList);
  updateSummary(riwayatList);

  showMessage("Riwayat absensi berhasil dimuat.", "success");
}

async function init() {
  setTanggalHariIniText();
  setDefaultTanggal();
  await loadRiwayat();
}

init();

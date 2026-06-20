const messageBox = document.getElementById("message");

const formWaktu = document.getElementById("formWaktu");
const jamMasukInput = document.getElementById("jamMasukInput");
const batasTelatInput = document.getElementById("batasTelatInput");

const currentJamMasuk = document.getElementById("currentJamMasuk");
const currentBatasTelat = document.getElementById("currentBatasTelat");
const currentUpdatedAt = document.getElementById("currentUpdatedAt");

const liveClock = document.getElementById("liveClock");
const liveDate = document.getElementById("liveDate");

let idPengaturan = null;

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

function formatTime(timeString) {
  if (!timeString) return "-";
  return timeString.substring(0, 5);
}

function formatTanggal(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString);

  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function updateLiveClock() {
  const now = new Date();

  if (liveClock) {
    liveClock.textContent = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  if (liveDate) {
    liveDate.textContent = now.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
}

async function loadWaktu() {
  const adminProfile = await cekAdmin();

  if (!adminProfile) return;

  const { data: pengaturanList, error } = await supabaseClient
    .from("pengaturan_absen")
    .select("*")
    .order("id", { ascending: true })
    .limit(1);

  if (error) {
    showMessage("Gagal memuat pengaturan waktu: " + error.message);
    return;
  }

  if (!pengaturanList || pengaturanList.length === 0) {
    idPengaturan = null;

    jamMasukInput.value = "08:00";
    batasTelatInput.value = "08:15";

    currentJamMasuk.textContent = "-";
    currentBatasTelat.textContent = "-";
    currentUpdatedAt.textContent = "Belum ada data";

    return;
  }

  const waktu = pengaturanList[0];

  idPengaturan = waktu.id;

  jamMasukInput.value = formatTime(waktu.jam_masuk);
  batasTelatInput.value = formatTime(waktu.batas_telat);

  currentJamMasuk.textContent = formatTime(waktu.jam_masuk);
  currentBatasTelat.textContent = formatTime(waktu.batas_telat);
  currentUpdatedAt.textContent = formatTanggal(waktu.updated_at);
}

async function simpanWaktu() {
  const jam_masuk = jamMasukInput.value;
  const batas_telat = batasTelatInput.value;

  if (!jam_masuk || !batas_telat) {
    showMessage("Jam masuk dan batas telat wajib diisi.");
    return;
  }

  if (batas_telat < jam_masuk) {
    showMessage("Batas telat tidak boleh lebih awal dari jam masuk.");
    return;
  }

  let result;

  if (idPengaturan) {
    result = await supabaseClient
      .from("pengaturan_absen")
      .update({
        jam_masuk,
        batas_telat,
        updated_at: new Date().toISOString(),
      })
      .eq("id", idPengaturan);
  } else {
    result = await supabaseClient.from("pengaturan_absen").insert({
      jam_masuk,
      batas_telat,
    });
  }

  if (result.error) {
    showMessage("Gagal menyimpan waktu: " + result.error.message);
    return;
  }

  showMessage("Pengaturan waktu berhasil disimpan.", "success");
  await loadWaktu();
}

if (formWaktu) {
  formWaktu.addEventListener("submit", function (e) {
    e.preventDefault();
    simpanWaktu();
  });
}

updateLiveClock();
setInterval(updateLiveClock, 1000);
loadWaktu();

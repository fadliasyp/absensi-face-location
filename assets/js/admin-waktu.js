const messageBox = document.getElementById("message");

const formWaktu = document.getElementById("formWaktu");
const jamMasukInput = document.getElementById("jamMasukInput");
const batasTelatInput = document.getElementById("batasTelatInput");

const currentJamMasuk = document.getElementById("currentJamMasuk");
const currentBatasTelat = document.getElementById("currentBatasTelat");
const currentUpdatedAt = document.getElementById("currentUpdatedAt");

const hariKhususForm = document.getElementById("hariKhususForm");
const tanggalHariKhusus = document.getElementById("tanggalHariKhusus");
const tipeHariKhusus = document.getElementById("tipeHariKhusus");
const keteranganHariKhusus = document.getElementById(
  "keteranganHariKhusus",
);
const hariKhususList = document.getElementById("hariKhususList");
const jumlahHariKhusus = document.getElementById("jumlahHariKhusus");

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

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTanggalHariKhusus(dateString) {
  if (!dateString) return "-";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function renderHariKhusus(items = []) {
  if (!hariKhususList) return;

  if (jumlahHariKhusus) {
    jumlahHariKhusus.textContent = `${items.length} tanggal`;
  }

  if (items.length === 0) {
    hariKhususList.innerHTML = `
      <div class="hari-khusus-empty">
        Belum ada tanggal khusus. Kalender masih mengikuti aturan default.
      </div>
    `;
    return;
  }

  hariKhususList.innerHTML = items
    .map((item) => {
      const tipe = item.tipe === "masuk" ? "masuk" : "libur";
      const label = tipe === "masuk" ? "Masuk" : "Libur";
      const keterangan = item.keterangan || "Tanpa keterangan";

      return `
        <div class="hari-khusus-item">
          <div class="hari-khusus-date">
            <strong>${escapeHtml(formatTanggalHariKhusus(item.tanggal))}</strong>
            <small>${escapeHtml(keterangan)}</small>
          </div>
          <span class="hari-khusus-badge ${tipe}">${label}</span>
          <button
            type="button"
            class="hari-khusus-delete"
            data-tanggal="${escapeHtml(item.tanggal)}"
          >
            Hapus
          </button>
        </div>
      `;
    })
    .join("");

  hariKhususList.querySelectorAll(".hari-khusus-delete").forEach((button) => {
    button.addEventListener("click", () => {
      hapusHariKhusus(button.dataset.tanggal);
    });
  });
}

async function loadHariKhusus() {
  if (!hariKhususList) return;

  const { data, error } = await supabaseClient.rpc("daftar_hari_khusus");

  if (error) {
    hariKhususList.innerHTML = `
      <div class="hari-khusus-empty">Kalender khusus gagal dimuat.</div>
    `;
    showMessage("Gagal memuat kalender hari kerja: " + error.message);
    return;
  }

  renderHariKhusus(Array.isArray(data) ? data : []);
}

async function simpanHariKhusus() {
  const tanggal = tanggalHariKhusus?.value;
  const tipe = tipeHariKhusus?.value;
  const keterangan = keteranganHariKhusus?.value.trim() || null;

  if (!tanggal || !["libur", "masuk"].includes(tipe)) {
    showMessage("Tanggal dan jenis hari wajib dipilih.");
    return;
  }

  const { data, error } = await supabaseClient.rpc("simpan_hari_khusus", {
    p_tanggal: tanggal,
    p_tipe: tipe,
    p_keterangan: keterangan,
  });

  if (error || !data?.success) {
    showMessage(
      "Gagal menyimpan tanggal: " +
        (data?.message || error?.message || "Kesalahan tidak diketahui."),
    );
    return;
  }

  showMessage(data.message, "success");
  hariKhususForm.reset();
  tipeHariKhusus.value = "libur";
  await loadHariKhusus();
}

async function hapusHariKhusus(tanggal) {
  if (!tanggal) return;

  const tanggalLabel = formatTanggalHariKhusus(tanggal);
  const disetujui = window.confirm(
    `Hapus pengaturan ${tanggalLabel}? Tanggal akan kembali mengikuti aturan default.`,
  );

  if (!disetujui) return;

  const { data, error } = await supabaseClient.rpc("hapus_hari_khusus", {
    p_tanggal: tanggal,
  });

  if (error || !data?.success) {
    showMessage(
      "Gagal menghapus tanggal: " +
        (data?.message || error?.message || "Kesalahan tidak diketahui."),
    );
    return;
  }

  showMessage(data.message, "success");
  await loadHariKhusus();
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

  if (jam_masuk >= "12:00" || batas_telat >= "12:00") {
    showMessage(
      "Jam masuk dan batas telat harus sebelum pukul 12.00 WIB karena absensi ditutup otomatis pada siang hari.",
    );
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

if (hariKhususForm) {
  hariKhususForm.addEventListener("submit", function (event) {
    event.preventDefault();
    simpanHariKhusus();
  });
}

updateLiveClock();
setInterval(updateLiveClock, 1000);
loadWaktu();
loadHariKhusus();

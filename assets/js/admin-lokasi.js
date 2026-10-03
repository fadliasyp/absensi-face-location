const messageBox = document.getElementById("message");
const lokasiTableBody = document.getElementById("lokasiTableBody");
const lokasiCardList = document.getElementById("lokasiCardList");

const idLokasiInput = document.getElementById("id_lokasi");
const namaLokasiInput = document.getElementById("nama_lokasi");
const latitudeInput = document.getElementById("latitude");
const longitudeInput = document.getElementById("longitude");
const radiusInput = document.getElementById("radius_meter");

const previewLokasiNama = document.getElementById("previewLokasiNama");
const previewKoordinat = document.getElementById("previewKoordinat");
const previewRadius = document.getElementById("previewRadius");
let lokasiById = new Map();

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
      ${escapeHtml(text)}
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeText(value) {
  return value !== null && value !== undefined && value !== ""
    ? escapeHtml(value)
    : "-";
}

function updatePreview(nama, latitude, longitude, radius) {
  if (previewLokasiNama) {
    previewLokasiNama.textContent = nama || "Belum dipilih";
  }

  if (previewKoordinat) {
    if (latitude && longitude) {
      previewKoordinat.textContent = `${latitude}, ${longitude}`;
    } else {
      previewKoordinat.textContent =
        "Latitude dan longitude akan muncul di sini.";
    }
  }

  if (previewRadius) {
    previewRadius.textContent = radius
      ? `Radius: ${radius} meter`
      : "Radius: -";
  }
}

function renderDesktopTable(lokasiList) {
  if (!lokasiTableBody) return;

  lokasiTableBody.innerHTML = lokasiList
    .map((lokasi) => {
      const lokasiId = Number(lokasi.id);
      if (!Number.isSafeInteger(lokasiId)) return "";

      return `
      <tr>
        <td>${safeText(lokasi.nama_lokasi)}</td>
        <td>${safeText(lokasi.latitude)}</td>
        <td>${safeText(lokasi.longitude)}</td>
        <td>${safeText(lokasi.radius_meter)} meter</td>
        <td>
          <div class="action-stack">
            <button onclick="editLokasi(${lokasiId})">
              Edit
            </button>
            <button onclick="hapusLokasi(${lokasiId})" class="danger">
              Hapus
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderMobileCards(lokasiList) {
  if (!lokasiCardList) return;

  lokasiCardList.innerHTML = lokasiList
    .map((lokasi) => {
      const lokasiId = Number(lokasi.id);
      if (!Number.isSafeInteger(lokasiId)) return "";

      return `
      <div class="lokasi-mobile-card">
        <h3>${safeText(lokasi.nama_lokasi)}</h3>
        <p>Lokasi ini digunakan sebagai titik validasi absensi.</p>

        <div class="lokasi-info-grid">
          <div>
            <span>Latitude</span>
            <strong>${safeText(lokasi.latitude)}</strong>
          </div>

          <div>
            <span>Longitude</span>
            <strong>${safeText(lokasi.longitude)}</strong>
          </div>

          <div>
            <span>Radius Valid</span>
            <strong>${safeText(lokasi.radius_meter)} meter</strong>
          </div>
        </div>

        <div class="lokasi-card-actions">
          <button onclick="editLokasi(${lokasiId})">
            Edit Lokasi
          </button>
          <button onclick="hapusLokasi(${lokasiId})" class="danger">
            Hapus Lokasi
          </button>
        </div>
      </div>
    `;
    })
    .join("");
}

async function loadLokasi() {
  const adminProfile = await cekAdmin();

  if (!adminProfile) return;

  const { data: lokasiList, error } = await supabaseClient
    .from("lokasi_absen")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    lokasiById = new Map();

    if (lokasiTableBody) {
      lokasiTableBody.innerHTML = `
        <tr>
          <td colspan="5">Gagal memuat lokasi: ${safeText(error.message)}</td>
        </tr>
      `;
    }

    if (lokasiCardList) {
      lokasiCardList.innerHTML = `
        <div class="empty-location-card">
          Gagal memuat lokasi: ${safeText(error.message)}
        </div>
      `;
    }

    return;
  }

  if (!lokasiList || lokasiList.length === 0) {
    lokasiById = new Map();

    if (lokasiTableBody) {
      lokasiTableBody.innerHTML = `
        <tr>
          <td colspan="5">Belum ada lokasi absen.</td>
        </tr>
      `;
    }

    if (lokasiCardList) {
      lokasiCardList.innerHTML = `
        <div class="empty-location-card">
          Belum ada lokasi absen.
        </div>
      `;
    }

    updatePreview("", "", "", "");
    return;
  }

  lokasiById = new Map(lokasiList.map((lokasi) => [String(lokasi.id), lokasi]));
  renderDesktopTable(lokasiList);
  renderMobileCards(lokasiList);

  const lokasiPertama = lokasiList[0];
  updatePreview(
    lokasiPertama.nama_lokasi,
    lokasiPertama.latitude,
    lokasiPertama.longitude,
    lokasiPertama.radius_meter,
  );
}

function editLokasi(id) {
  const lokasi = lokasiById.get(String(id));

  if (!lokasi) {
    showMessage("Data lokasi tidak ditemukan. Silakan muat ulang halaman.");
    return;
  }

  const nama = lokasi.nama_lokasi;
  const latitude = lokasi.latitude;
  const longitude = lokasi.longitude;
  const radius = lokasi.radius_meter;

  idLokasiInput.value = id;
  namaLokasiInput.value = nama;
  latitudeInput.value = latitude;
  longitudeInput.value = longitude;
  radiusInput.value = radius;

  updatePreview(nama, latitude, longitude, radius);

  showMessage(
    "Data lokasi dipilih. Silakan ubah lalu klik Simpan Lokasi.",
    "success",
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

async function simpanLokasi() {
  const id = idLokasiInput.value;
  const nama_lokasi = namaLokasiInput.value.trim();
  const latitude = parseFloat(latitudeInput.value);
  const longitude = parseFloat(longitudeInput.value);
  const radius_meter = parseInt(radiusInput.value);

  if (
    !nama_lokasi ||
    isNaN(latitude) ||
    isNaN(longitude) ||
    isNaN(radius_meter)
  ) {
    showMessage("Semua data lokasi wajib diisi dengan benar.");
    return;
  }

  if (radius_meter <= 0) {
    showMessage("Radius harus lebih dari 0 meter.");
    return;
  }

  let result;

  if (id) {
    result = await supabaseClient
      .from("lokasi_absen")
      .update({
        nama_lokasi,
        latitude,
        longitude,
        radius_meter,
      })
      .eq("id", id);
  } else {
    result = await supabaseClient.from("lokasi_absen").insert({
      nama_lokasi,
      latitude,
      longitude,
      radius_meter,
    });
  }

  if (result.error) {
    showMessage("Gagal menyimpan lokasi: " + result.error.message);
    return;
  }

  showMessage("Lokasi berhasil disimpan.", "success");
  resetForm();
  loadLokasi();
}

function resetForm() {
  idLokasiInput.value = "";
  namaLokasiInput.value = "";
  latitudeInput.value = "";
  longitudeInput.value = "";
  radiusInput.value = "";
}

async function hapusLokasi(id) {
  const yakin = confirm(
    "Yakin ingin menghapus lokasi ini? Riwayat absensi lama akan tetap tersimpan.",
  );

  if (!yakin) return;

  const { data, error } = await supabaseClient.rpc("hapus_lokasi_absen", {
    p_lokasi_id: String(id),
  });

  if (error || !data?.success) {
    showMessage(
      "Gagal menghapus lokasi: " +
        (data?.message || error?.message || "Kesalahan tidak diketahui."),
    );
    return;
  }

  showMessage(data.message || "Lokasi berhasil dihapus.", "success");
  loadLokasi();
}

function ambilLokasiSekarang() {
  if (!navigator.geolocation) {
    showMessage("Browser tidak mendukung fitur geolocation.");
    return;
  }

  showMessage("Mengambil lokasi sekarang...", "success");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      latitudeInput.value = latitude;
      longitudeInput.value = longitude;

      if (!radiusInput.value) {
        radiusInput.value = 100;
      }

      updatePreview(
        namaLokasiInput.value.trim() || "Lokasi Saat Ini",
        latitude,
        longitude,
        radiusInput.value,
      );

      showMessage(
        "Lokasi berhasil diambil. Silakan isi nama lokasi lalu simpan.",
        "success",
      );
    },
    (error) => {
      console.error(error);
      showMessage("Gagal mengambil lokasi. Pastikan izin lokasi diaktifkan.");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
  );
}

if (namaLokasiInput) {
  namaLokasiInput.addEventListener("input", () => {
    updatePreview(
      namaLokasiInput.value.trim(),
      latitudeInput.value,
      longitudeInput.value,
      radiusInput.value,
    );
  });
}

if (latitudeInput) {
  latitudeInput.addEventListener("input", () => {
    updatePreview(
      namaLokasiInput.value.trim(),
      latitudeInput.value,
      longitudeInput.value,
      radiusInput.value,
    );
  });
}

if (longitudeInput) {
  longitudeInput.addEventListener("input", () => {
    updatePreview(
      namaLokasiInput.value.trim(),
      latitudeInput.value,
      longitudeInput.value,
      radiusInput.value,
    );
  });
}

if (radiusInput) {
  radiusInput.addEventListener("input", () => {
    updatePreview(
      namaLokasiInput.value.trim(),
      latitudeInput.value,
      longitudeInput.value,
      radiusInput.value,
    );
  });
}

loadLokasi();

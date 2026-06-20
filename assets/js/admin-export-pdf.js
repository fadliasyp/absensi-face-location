const messageBox = document.getElementById("message");
const previewTableBody = document.getElementById("previewTableBody");

const tanggalAwalInput = document.getElementById("tanggal_awal");
const tanggalAkhirInput = document.getElementById("tanggal_akhir");
const filterStatusInput = document.getElementById("filter_status");

const totalHadirEl = document.getElementById("totalHadir");
const totalTerlambatEl = document.getElementById("totalTerlambat");
const totalIzinEl = document.getElementById("totalIzin");
const totalAlfaEl = document.getElementById("totalAlfa");

let dataPreview = [];

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

document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    closeAdminSidebar();
  }
});

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

function formatTanggalFile(tanggal) {
  if (!tanggal) return "semua-tanggal";
  return tanggal.replaceAll("-", "");
}

function formatWaktu(waktu) {
  if (!waktu) return "-";
  return waktu.substring(0, 5);
}

function formatJarak(value) {
  if (value === null || value === undefined) return "-";
  return Number(value).toFixed(2) + " m";
}

function labelStatus(status) {
  if (status === "hadir") return "Hadir";
  if (status === "terlambat") return "Terlambat";
  if (status === "izin") return "Izin";
  if (status === "alfa") return "Alfa";
  return safeText(status);
}

function updateSummary(list) {
  const totalHadir = list.filter((item) => item.status === "hadir").length;
  const totalTerlambat = list.filter(
    (item) => item.status === "terlambat",
  ).length;
  const totalIzin = list.filter((item) => item.status === "izin").length;
  const totalAlfa = list.filter((item) => item.status === "alfa").length;

  totalHadirEl.textContent = totalHadir;
  totalTerlambatEl.textContent = totalTerlambat;
  totalIzinEl.textContent = totalIzin;
  totalAlfaEl.textContent = totalAlfa;
}

function renderPreview(list) {
  if (!list || list.length === 0) {
    previewTableBody.innerHTML = `
      <tr>
        <td colspan="8">Tidak ada data untuk ditampilkan.</td>
      </tr>
    `;
    return;
  }

  previewTableBody.innerHTML = list
    .map((item) => {
      const profile = item.profiles || {};

      return `
        <tr>
          <td>${safeText(profile.nama_lengkap)}</td>
          <td>${safeText(profile.bagian)}</td>
          <td>${formatTanggal(item.tanggal)}</td>
          <td>${formatWaktu(item.waktu_masuk)}</td>
          <td>${labelStatus(item.status)}</td>
          <td>${safeText(item.nama_tempat)}</td>
          <td>${formatJarak(item.jarak_meter)}</td>
          <td>${safeText(item.keterangan)}</td>
        </tr>
      `;
    })
    .join("");
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

async function ambilDataAbsensi() {
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
    .order("tanggal", { ascending: true })
    .order("waktu_masuk", { ascending: true });

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

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

async function loadPreview() {
  const admin = await cekAdmin();
  if (!admin) return;

  showMessage("Memuat data laporan...", "success");

  try {
    dataPreview = await ambilDataAbsensi();

    renderPreview(dataPreview);
    updateSummary(dataPreview);

    showMessage(`${dataPreview.length} data berhasil dimuat.`, "success");
  } catch (error) {
    console.error(error);
    showMessage("Gagal memuat data laporan: " + error.message);
  }
}

async function exportPDF() {
  const admin = await cekAdmin();
  if (!admin) return;

  if (!dataPreview || dataPreview.length === 0) {
    showMessage("Data masih kosong. Klik Tampilkan Preview terlebih dahulu.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("landscape", "mm", "a4");

  const tanggalAwal = tanggalAwalInput.value;
  const tanggalAkhir = tanggalAkhirInput.value;
  const filterStatus = filterStatusInput.value;

  const judul = "Laporan Kehadiran";
  const periode = `Periode: ${tanggalAwal || "-"} sampai ${tanggalAkhir || "-"}`;
  const statusText = `Status: ${filterStatus ? labelStatus(filterStatus) : "Semua Status"}`;
  const dicetakOleh = `Dicetak oleh: ${admin.nama_lengkap || "Admin"}`;
  const waktuCetak = `Waktu cetak: ${new Date().toLocaleString("id-ID")}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(judul, 14, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(periode, 14, 22);
  doc.text(statusText, 14, 28);
  doc.text(dicetakOleh, 14, 34);
  doc.text(waktuCetak, 14, 40);

  const totalHadir = dataPreview.filter(
    (item) => item.status === "hadir",
  ).length;
  const totalTerlambat = dataPreview.filter(
    (item) => item.status === "terlambat",
  ).length;
  const totalIzin = dataPreview.filter((item) => item.status === "izin").length;
  const totalAlfa = dataPreview.filter((item) => item.status === "alfa").length;

  doc.setFont("helvetica", "bold");
  doc.text(
    `Ringkasan: Hadir ${totalHadir} | Terlambat ${totalTerlambat} | Izin ${totalIzin} | Alfa ${totalAlfa}`,
    14,
    48,
  );

  const tableRows = dataPreview.map((item, index) => {
    const profile = item.profiles || {};

    return [
      index + 1,
      safeText(profile.nama_lengkap),
      safeText(profile.bagian),
      formatTanggal(item.tanggal),
      formatWaktu(item.waktu_masuk),
      labelStatus(item.status),
      safeText(item.nama_tempat),
      formatJarak(item.jarak_meter),
      safeText(item.validasi_wajah),
      safeText(item.validasi_lokasi),
      safeText(item.keterangan),
    ];
  });

  doc.autoTable({
    startY: 55,
    head: [
      [
        "No",
        "Nama",
        "Bagian",
        "Tanggal",
        "Waktu",
        "Status",
        "Tempat",
        "Jarak",
        "Wajah",
        "Lokasi",
        "Keterangan",
      ],
    ],
    body: tableRows,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [20, 83, 45],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 32 },
      2: { cellWidth: 25 },
      3: { cellWidth: 28 },
      4: { cellWidth: 18 },
      5: { cellWidth: 22 },
      6: { cellWidth: 30 },
      7: { cellWidth: 22 },
      8: { cellWidth: 20 },
      9: { cellWidth: 20 },
      10: { cellWidth: 55 },
    },
    margin: { left: 14, right: 14 },
  });

  const fileName = `laporan-kehadiran-${formatTanggalFile(tanggalAwal)}-${formatTanggalFile(tanggalAkhir)}.pdf`;

  doc.save(fileName);

  showMessage("PDF berhasil dibuat dan diunduh.", "success");
}

async function init() {
  setDefaultTanggal();
  await loadPreview();
}

init();

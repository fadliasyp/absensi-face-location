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

function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getFotoAbsenLink(item) {
  if (item.foto_absen_key) {
    const viewerUrl = new URL("/foto-absen.html", window.location.origin);
    viewerUrl.searchParams.set("key", item.foto_absen_key);
    return viewerUrl.toString();
  }

  if (
    item.foto_absen_url &&
    /^https:\/\//i.test(String(item.foto_absen_url))
  ) {
    return item.foto_absen_url;
  }

  return "";
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
        <td colspan="9">Tidak ada data untuk ditampilkan.</td>
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
          <td>
            ${
              getFotoAbsenLink(item)
                ? `<a href="${escapeAttribute(getFotoAbsenLink(item))}" target="_blank" rel="noopener noreferrer">Lihat Foto</a>`
                : "-"
            }
          </td>
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

function getReportSummary(list) {
  return {
    hadir: list.filter((item) => item.status === "hadir").length,
    terlambat: list.filter((item) => item.status === "terlambat").length,
    izin: list.filter((item) => item.status === "izin").length,
    alfa: list.filter((item) => item.status === "alfa").length,
  };
}

function getReportMeta(admin) {
  const tanggalAwal = tanggalAwalInput.value;
  const tanggalAkhir = tanggalAkhirInput.value;
  const filterStatus = filterStatusInput.value;
  const waktuCetak = new Date();

  return {
    tanggalAwal,
    tanggalAkhir,
    filterStatus,
    periode: `${formatTanggal(tanggalAwal)} - ${formatTanggal(tanggalAkhir)}`,
    status: filterStatus ? labelStatus(filterStatus) : "Semua Status",
    admin: admin.nama_lengkap || "Admin",
    waktuCetak,
    waktuCetakText: waktuCetak.toLocaleString("id-ID"),
    summary: getReportSummary(dataPreview),
    fileBaseName: `laporan-kehadiran-${formatTanggalFile(tanggalAwal)}-${formatTanggalFile(tanggalAkhir)}`,
  };
}

function formatTanggalSingkat(tanggal) {
  if (!tanggal) return "-";

  return new Date(tanggal + "T00:00:00").toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function setExportButtonLoading(buttonId, isLoading, loadingText) {
  const button = document.getElementById(buttonId);
  if (!button) return;

  if (isLoading) {
    button.dataset.originalContent = button.innerHTML;
    button.innerHTML = loadingText;
    button.disabled = true;
  } else {
    button.innerHTML = button.dataset.originalContent || button.innerHTML;
    button.disabled = false;
  }
}

function drawPdfSummaryCard(doc, x, y, width, label, value, colors) {
  doc.setFillColor(...colors.background);
  doc.setDrawColor(...colors.border);
  doc.roundedRect(x, y, width, 17, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...colors.text);
  doc.text(label.toUpperCase(), x + 4, y + 5.5);

  doc.setFontSize(14);
  doc.text(String(value), x + 4, y + 13.1);
}

function drawPdfMainHeader(doc, meta) {
  doc.setFillColor(15, 81, 50);
  doc.rect(0, 0, 210, 33, "F");
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 4, 33, "F");

  doc.setTextColor(202, 255, 222);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("POCA JS  /  ABSENSI DIGITAL", 11, 9);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("LAPORAN KEHADIRAN", 11, 19);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(226, 240, 234);
  doc.text(`Periode ${meta.periode}`, 11, 26);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(159, 8, 40, 16, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(73, 91, 83);
  doc.text("TOTAL DATA", 179, 13, { align: "center" });
  doc.setFontSize(14);
  doc.setTextColor(15, 81, 50);
  doc.text(String(dataPreview.length), 179, 20.5, { align: "center" });
}

function drawPdfCompactHeader(doc, meta) {
  doc.setFillColor(15, 81, 50);
  doc.rect(0, 0, 210, 17, "F");
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 4, 17, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("LAPORAN KEHADIRAN", 10, 7.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(220, 238, 229);
  doc.text(`POCA JS  |  ${meta.periode}`, 10, 12.5);
}

function getPdfStatusStyle(status) {
  if (status === "hadir") {
    return { background: [232, 248, 239], text: [21, 128, 61] };
  }
  if (status === "terlambat") {
    return { background: [255, 247, 230], text: [180, 83, 9] };
  }
  if (status === "izin") {
    return { background: [232, 239, 255], text: [49, 87, 157] };
  }
  return { background: [255, 241, 242], text: [190, 18, 60] };
}

async function exportPDF() {
  const admin = await cekAdmin();
  if (!admin) return;

  if (!dataPreview || dataPreview.length === 0) {
    showMessage("Data masih kosong. Klik Tampilkan Preview terlebih dahulu.");
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showMessage("Library PDF gagal dimuat. Periksa koneksi internet lalu coba lagi.");
    return;
  }

  setExportButtonLoading("downloadPdfBtn", true, "Membuat PDF...");

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("portrait", "mm", "a4");
    const meta = getReportMeta(admin);
    const fotoLinks = dataPreview.map((item) => getFotoAbsenLink(item));

    doc.setProperties({
      title: "Laporan Kehadiran",
      subject: `Laporan absensi periode ${meta.periode}`,
      author: meta.admin,
      creator: "Sistem Absensi Digital POCA JS",
    });

    drawPdfMainHeader(doc, meta);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(82, 96, 90);
    doc.text(`Status: ${meta.status}`, 10, 39);
    doc.text(`Dicetak oleh: ${meta.admin}`, 10, 44);
    doc.text(`Dibuat: ${meta.waktuCetakText}`, 200, 39, { align: "right" });
    doc.text("Bukti foto dapat dibuka melalui tautan pada kolom Foto.", 200, 44, {
      align: "right",
    });

    const cardGap = 3;
    const cardWidth = (190 - cardGap * 3) / 4;
    const summaryCards = [
      ["Hadir", meta.summary.hadir, { background: [232, 248, 239], border: [187, 225, 202], text: [21, 128, 61] }],
      ["Terlambat", meta.summary.terlambat, { background: [255, 247, 230], border: [246, 215, 158], text: [180, 83, 9] }],
      ["Izin", meta.summary.izin, { background: [232, 239, 255], border: [190, 205, 239], text: [49, 87, 157] }],
      ["Alfa", meta.summary.alfa, { background: [255, 241, 242], border: [244, 194, 201], text: [190, 18, 60] }],
    ];

    summaryCards.forEach((card, index) => {
      drawPdfSummaryCard(
        doc,
        10 + index * (cardWidth + cardGap),
        49,
        cardWidth,
        card[0],
        card[1],
        card[2],
      );
    });

    const tableRows = dataPreview.map((item, index) => {
      const profile = item.profiles || {};

      return [
        index + 1,
        `${safeText(profile.nama_lengkap)}\n${safeText(profile.bagian)}`,
        `${formatTanggalSingkat(item.tanggal)}\n${formatWaktu(item.waktu_masuk)} WIB`,
        labelStatus(item.status),
        `${safeText(item.nama_tempat)}\n${formatJarak(item.jarak_meter)}`,
        `Wajah: ${safeText(item.validasi_wajah)}\nLokasi: ${safeText(item.validasi_lokasi)}`,
        safeText(item.keterangan),
        fotoLinks[index] ? "Lihat Foto" : "-",
      ];
    });

    doc.autoTable({
      startY: 71,
      head: [["No", "Pegawai", "Tanggal / Waktu", "Status", "Lokasi / Jarak", "Validasi", "Keterangan", "Foto"]],
      body: tableRows,
      theme: "plain",
      showHead: "everyPage",
      styles: {
        font: "helvetica",
        fontSize: 7,
        textColor: [45, 57, 52],
        cellPadding: { top: 2.5, right: 1.8, bottom: 2.5, left: 1.8 },
        lineColor: [222, 230, 226],
        lineWidth: 0.15,
        valign: "middle",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [15, 81, 50],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.2,
        minCellHeight: 9,
        halign: "left",
      },
      alternateRowStyles: {
        fillColor: [247, 250, 248],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 26 },
        2: { cellWidth: 24 },
        3: { cellWidth: 18, halign: "center", fontStyle: "bold" },
        4: { cellWidth: 29 },
        5: { cellWidth: 24 },
        6: { cellWidth: 41 },
        7: { cellWidth: 18, halign: "center", fontStyle: "bold" },
      },
      margin: { top: 22, left: 10, right: 10, bottom: 15 },
      didParseCell: (hookData) => {
        if (hookData.section !== "body") return;

        if (hookData.column.index === 3) {
          const statusStyle = getPdfStatusStyle(
            dataPreview[hookData.row.index]?.status,
          );
          hookData.cell.styles.fillColor = statusStyle.background;
          hookData.cell.styles.textColor = statusStyle.text;
        }

        if (hookData.column.index === 7 && fotoLinks[hookData.row.index]) {
          hookData.cell.styles.textColor = [37, 99, 235];
        }
      },
      didDrawCell: (hookData) => {
        if (
          hookData.section === "body" &&
          hookData.column.index === 7 &&
          fotoLinks[hookData.row.index]
        ) {
          doc.link(
            hookData.cell.x,
            hookData.cell.y,
            hookData.cell.width,
            hookData.cell.height,
            { url: fotoLinks[hookData.row.index] },
          );
        }
      },
    });

    const totalPages = doc.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      doc.setPage(pageNumber);

      if (pageNumber > 1) {
        drawPdfCompactHeader(doc, meta);
      }

      doc.setDrawColor(217, 226, 221);
      doc.line(10, 285, 200, 285);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(105, 118, 112);
      doc.text("Sistem Absensi Digital - Face Scan & Geolocation", 10, 290);
      doc.text(`Halaman ${pageNumber} dari ${totalPages}`, 200, 290, {
        align: "right",
      });
    }

    doc.save(`${meta.fileBaseName}.pdf`);
    showMessage("PDF rapi berhasil dibuat dan diunduh.", "success");
  } catch (error) {
    console.error(error);
    showMessage("Gagal membuat PDF: " + error.message);
  } finally {
    setExportButtonLoading("downloadPdfBtn", false);
  }
}

function getExcelStatusStyle(status) {
  if (status === "hadir") {
    return { fill: "FFE8F8EF", font: "FF15803D" };
  }
  if (status === "terlambat") {
    return { fill: "FFFFF7E6", font: "FFB45309" };
  }
  if (status === "izin") {
    return { fill: "FFE8EFFF", font: "FF31579D" };
  }
  return { fill: "FFFFF1F2", font: "FFBE123C" };
}

function styleExcelSummaryCard(worksheet, range, label, value, colors) {
  worksheet.mergeCells(range);
  const startCell = range.split(":")[0];
  const cell = worksheet.getCell(startCell);
  cell.value = `${label.toUpperCase()}\n${value}`;
  cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: colors.font } };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.fill } };

  const [startColumn, endColumn] = [
    worksheet.getCell(range.split(":")[0]).col,
    worksheet.getCell(range.split(":")[1]).col,
  ];
  for (let column = startColumn; column <= endColumn; column += 1) {
    worksheet.getCell(6, column).border = {
      top: { style: "thin", color: { argb: colors.border } },
      left: { style: "thin", color: { argb: colors.border } },
      bottom: { style: "thin", color: { argb: colors.border } },
      right: { style: "thin", color: { argb: colors.border } },
    };
  }
}

async function exportExcel() {
  const admin = await cekAdmin();
  if (!admin) return;

  if (!dataPreview || dataPreview.length === 0) {
    showMessage("Data masih kosong. Klik Tampilkan Preview terlebih dahulu.");
    return;
  }

  if (!window.ExcelJS) {
    showMessage("Library Excel gagal dimuat. Periksa koneksi internet lalu coba lagi.");
    return;
  }

  setExportButtonLoading("downloadExcelBtn", true, "Membuat Excel...");

  try {
    const meta = getReportMeta(admin);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistem Absensi Digital POCA JS";
    workbook.lastModifiedBy = meta.admin;
    workbook.created = meta.waktuCetak;
    workbook.modified = meta.waktuCetak;

    const worksheet = workbook.addWorksheet("Laporan Ringkas", {
      properties: { defaultRowHeight: 22 },
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      },
    });

    worksheet.columns = [
      { key: "no", width: 5 },
      { key: "pegawai", width: 22 },
      { key: "tanggalWaktu", width: 17 },
      { key: "status", width: 13 },
      { key: "tempatJarak", width: 22 },
      { key: "validasi", width: 18 },
      { key: "keterangan", width: 30 },
      { key: "foto", width: 12 },
    ];

    worksheet.mergeCells("A1:H1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "LAPORAN KEHADIRAN";
    titleCell.font = { name: "Calibri", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5132" } };
    worksheet.getRow(1).height = 34;

    worksheet.mergeCells("A2:H2");
    const subtitleCell = worksheet.getCell("A2");
    subtitleCell.value = "POCA JS  |  Sistem Absensi Digital - Face Scan & Geolocation";
    subtitleCell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFD7F7E4" } };
    subtitleCell.alignment = { vertical: "middle", horizontal: "center" };
    subtitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5132" } };
    worksheet.getRow(2).height = 24;

    worksheet.mergeCells("A3:D3");
    worksheet.mergeCells("E3:H3");
    worksheet.getCell("A3").value = `Periode: ${meta.periode}`;
    worksheet.getCell("E3").value = `Status: ${meta.status}`;
    worksheet.mergeCells("A4:D4");
    worksheet.mergeCells("E4:H4");
    worksheet.getCell("A4").value = `Dibuat oleh: ${meta.admin}`;
    worksheet.getCell("E4").value = `Waktu dibuat: ${meta.waktuCetakText}`;

    ["A3", "E3", "A4", "E4"].forEach((address) => {
      const cell = worksheet.getCell(address);
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF42574C" }, bold: address.endsWith("3") };
      cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F8F5" } };
    });

    worksheet.getRow(5).height = 8;
    worksheet.getRow(6).height = 38;
    styleExcelSummaryCard(worksheet, "A6:B6", "Hadir", meta.summary.hadir, { fill: "FFE8F8EF", font: "FF15803D", border: "FFBBE1CA" });
    styleExcelSummaryCard(worksheet, "C6:D6", "Terlambat", meta.summary.terlambat, { fill: "FFFFF7E6", font: "FFB45309", border: "FFF6D79E" });
    styleExcelSummaryCard(worksheet, "E6:F6", "Izin", meta.summary.izin, { fill: "FFE8EFFF", font: "FF31579D", border: "FFBECDEF" });
    styleExcelSummaryCard(worksheet, "G6:H6", "Alfa", meta.summary.alfa, { fill: "FFFFF1F2", font: "FFBE123C", border: "FFF4C2C9" });
    worksheet.getRow(7).height = 8;

    const headerRowNumber = 8;
    const headerRow = worksheet.getRow(headerRowNumber);
    headerRow.values = [
      "No",
      "Pegawai",
      "Tanggal / Waktu",
      "Status",
      "Tempat / Jarak",
      "Validasi",
      "Keterangan",
      "Foto",
    ];
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5132" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FF3C8060" } },
        left: { style: "thin", color: { argb: "FF3C8060" } },
        bottom: { style: "thin", color: { argb: "FF3C8060" } },
        right: { style: "thin", color: { argb: "FF3C8060" } },
      };
    });

    dataPreview.forEach((item, index) => {
      const profile = item.profiles || {};
      const fotoLink = getFotoAbsenLink(item);
      const row = worksheet.addRow([
        index + 1,
        `${safeText(profile.nama_lengkap)}\n${safeText(profile.bagian)}`,
        `${formatTanggalSingkat(item.tanggal)}\n${formatWaktu(item.waktu_masuk)} WIB`,
        labelStatus(item.status),
        `${safeText(item.nama_tempat)}\n${formatJarak(item.jarak_meter)}`,
        `Wajah: ${safeText(item.validasi_wajah)}\nLokasi: ${safeText(item.validasi_lokasi)}`,
        safeText(item.keterangan),
        fotoLink ? { text: "Lihat Foto", hyperlink: fotoLink, tooltip: "Buka foto bukti absensi" } : "-",
      ]);

      row.height = 42;
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        cell.font = { name: "Calibri", size: 9, color: { argb: "FF2D3934" } };
        cell.alignment = {
          vertical: "middle",
          horizontal: [1, 3, 4, 6, 8].includes(columnNumber) ? "center" : "left",
          wrapText: true,
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: index % 2 === 0 ? "FFFFFFFF" : "FFF6FAF8" },
        };
        cell.border = {
          top: { style: "hair", color: { argb: "FFDCE6E1" } },
          left: { style: "hair", color: { argb: "FFDCE6E1" } },
          bottom: { style: "hair", color: { argb: "FFDCE6E1" } },
          right: { style: "hair", color: { argb: "FFDCE6E1" } },
        };
      });

      const statusStyle = getExcelStatusStyle(item.status);
      const statusCell = row.getCell(4);
      statusCell.font = { name: "Calibri", size: 9, bold: true, color: { argb: statusStyle.font } };
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusStyle.fill } };

      if (fotoLink) {
        row.getCell(8).font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF2563EB" }, underline: true };
      }
    });

    const lastRow = worksheet.lastRow.number;
    worksheet.views = [
      {
        state: "frozen",
        ySplit: headerRowNumber,
        activeCell: "A9",
        showGridLines: false,
        zoomScale: 80,
        zoomScaleNormal: 100,
      },
    ];
    worksheet.autoFilter = { from: `A${headerRowNumber}`, to: `H${lastRow}` };
    worksheet.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;
    worksheet.headerFooter.oddFooter = "&LSistem Absensi Digital POCA JS&C&F&RHalaman &P dari &N";
    worksheet.getColumn(1).alignment = { horizontal: "center" };
    worksheet.properties.tabColor = { argb: "FF0F5132" };

    const detailSheet = workbook.addWorksheet("Data Lengkap", {
      properties: { defaultRowHeight: 21, tabColor: { argb: "FF2563EB" } },
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.2, right: 0.2, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
      },
    });

    detailSheet.columns = [
      { width: 5 }, { width: 20 }, { width: 15 }, { width: 25 },
      { width: 15 }, { width: 10 }, { width: 13 }, { width: 20 },
      { width: 11 }, { width: 14 }, { width: 14 }, { width: 32 }, { width: 12 },
    ];
    detailSheet.mergeCells("A1:M1");
    detailSheet.getCell("A1").value = "DATA KEHADIRAN LENGKAP";
    detailSheet.getCell("A1").font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    detailSheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
    detailSheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5132" } };
    detailSheet.getRow(1).height = 32;

    detailSheet.mergeCells("A2:M2");
    detailSheet.getCell("A2").value = `Periode ${meta.periode}  |  Status ${meta.status}  |  Total ${dataPreview.length} data`;
    detailSheet.getCell("A2").font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF42574C" } };
    detailSheet.getCell("A2").alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    detailSheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F8F5" } };
    detailSheet.getRow(2).height = 25;
    detailSheet.getRow(3).height = 8;

    const detailHeaderRowNumber = 4;
    const detailHeader = detailSheet.getRow(detailHeaderRowNumber);
    detailHeader.values = [
      "No", "Nama Pegawai", "Bagian", "Email", "Tanggal", "Waktu", "Status",
      "Tempat", "Jarak", "Validasi Wajah", "Validasi Lokasi", "Keterangan", "Foto",
    ];
    detailHeader.height = 28;
    detailHeader.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5132" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FF3C8060" } },
        left: { style: "thin", color: { argb: "FF3C8060" } },
        bottom: { style: "thin", color: { argb: "FF3C8060" } },
        right: { style: "thin", color: { argb: "FF3C8060" } },
      };
    });

    dataPreview.forEach((item, index) => {
      const profile = item.profiles || {};
      const fotoLink = getFotoAbsenLink(item);
      const row = detailSheet.addRow([
        index + 1,
        safeText(profile.nama_lengkap),
        safeText(profile.bagian),
        safeText(profile.email),
        formatTanggal(item.tanggal),
        `${formatWaktu(item.waktu_masuk)} WIB`,
        labelStatus(item.status),
        safeText(item.nama_tempat),
        item.jarak_meter === null || item.jarak_meter === undefined ? "-" : Number(item.jarak_meter),
        safeText(item.validasi_wajah),
        safeText(item.validasi_lokasi),
        safeText(item.keterangan),
        fotoLink ? { text: "Lihat Foto", hyperlink: fotoLink, tooltip: "Buka foto bukti absensi" } : "-",
      ]);

      row.height = 32;
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        cell.font = { name: "Calibri", size: 9, color: { argb: "FF2D3934" } };
        cell.alignment = {
          vertical: "middle",
          horizontal: [1, 6, 7, 9, 10, 11, 13].includes(columnNumber) ? "center" : "left",
          wrapText: true,
        };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 === 0 ? "FFFFFFFF" : "FFF6FAF8" } };
        cell.border = {
          top: { style: "hair", color: { argb: "FFDCE6E1" } },
          left: { style: "hair", color: { argb: "FFDCE6E1" } },
          bottom: { style: "hair", color: { argb: "FFDCE6E1" } },
          right: { style: "hair", color: { argb: "FFDCE6E1" } },
        };
      });

      const statusStyle = getExcelStatusStyle(item.status);
      row.getCell(7).font = { name: "Calibri", size: 9, bold: true, color: { argb: statusStyle.font } };
      row.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusStyle.fill } };
      if (typeof row.getCell(9).value === "number") row.getCell(9).numFmt = '0.00 "m"';
      if (fotoLink) row.getCell(13).font = { name: "Calibri", size: 9, bold: true, color: { argb: "FF2563EB" }, underline: true };
    });

    const detailLastRow = detailSheet.lastRow.number;
    detailSheet.views = [
      {
        state: "frozen",
        ySplit: detailHeaderRowNumber,
        activeCell: "A5",
        showGridLines: false,
        zoomScale: 75,
        zoomScaleNormal: 100,
      },
    ];
    detailSheet.autoFilter = { from: `A${detailHeaderRowNumber}`, to: `M${detailLastRow}` };
    detailSheet.pageSetup.printTitlesRow = `${detailHeaderRowNumber}:${detailHeaderRowNumber}`;
    detailSheet.headerFooter.oddFooter = "&LSistem Absensi Digital POCA JS&C&F&RHalaman &P dari &N";

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const downloadUrl = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `${meta.fileBaseName}.xlsx`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

    showMessage("Excel rapi berhasil dibuat dan diunduh.", "success");
  } catch (error) {
    console.error(error);
    showMessage("Gagal membuat Excel: " + error.message);
  } finally {
    setExportButtonLoading("downloadExcelBtn", false);
  }
}

async function init() {
  setDefaultTanggal();
  await loadPreview();
}

init();

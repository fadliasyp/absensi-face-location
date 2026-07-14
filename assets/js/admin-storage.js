const storageMessage = document.getElementById("storageMessage");
const storageStartDate = document.getElementById("storageStartDate");
const storageEndDate = document.getElementById("storageEndDate");
const storagePreviewBtn = document.getElementById("storagePreviewBtn");
const storagePreviewCard = document.getElementById("storagePreviewCard");
const storagePhotoCount = document.getElementById("storagePhotoCount");
const storageSelectedPeriod = document.getElementById("storageSelectedPeriod");
const storageEstimatedSize = document.getElementById("storageEstimatedSize");
const storageConfirmation = document.getElementById("storageConfirmation");
const storageDeleteBtn = document.getElementById("storageDeleteBtn");
const storageProgress = document.getElementById("storageProgress");
const storageProgressText = document.getElementById("storageProgressText");
const storageProgressPercent = document.getElementById("storageProgressPercent");
const storageProgressBar = document.getElementById("storageProgressBar");
const storageHistoryList = document.getElementById("storageHistoryList");
const storageRefreshBtn = document.getElementById("storageRefreshBtn");

const requiredConfirmation = "HAPUS FOTO";
let previewState = null;
let deletionRunning = false;

function openAdminSidebar() {
  document.getElementById("adminSidebar")?.classList.add("show");
  document.getElementById("adminSidebarOverlay")?.classList.add("show");
  document.body.classList.add("admin-sidebar-open");
}

function closeAdminSidebar() {
  document.getElementById("adminSidebar")?.classList.remove("show");
  document.getElementById("adminSidebarOverlay")?.classList.remove("show");
  document.body.classList.remove("admin-sidebar-open");
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAdminSidebar();
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showStorageMessage(text, type = "error") {
  if (!storageMessage) return;
  storageMessage.innerHTML = `
    <div class="alert ${type === "success" ? "alert-success" : "alert-error"}">
      ${escapeHtml(text)}
    </div>
  `;
}

function clearStorageMessage() {
  if (storageMessage) storageMessage.innerHTML = "";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function getFunctionErrorMessage(error, fallbackMessage) {
  try {
    const response = error?.context;
    if (response && typeof response.json === "function") {
      const details = await response.json();
      return details?.error || fallbackMessage;
    }
  } catch (contextError) {
    console.error("Gagal membaca detail Edge Function:", contextError);
  }
  return error?.message || fallbackMessage;
}

async function getActiveSession() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session) {
    window.location.href = "../login.html";
    return null;
  }
  return data.session;
}

async function checkAdmin() {
  const session = await getActiveSession();
  if (!session) return null;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("id, nama_lengkap, role, status_akun")
    .eq("id", session.user.id)
    .single();

  if (
    error ||
    !profile ||
    profile.role !== "admin" ||
    profile.status_akun !== "aktif"
  ) {
    window.location.href = "../user/dashboard.html";
    return null;
  }

  const adminName = profile.nama_lengkap || "Admin";
  document.getElementById("sidebarAdminName").textContent = adminName;
  document.getElementById("desktopAdminName").textContent = adminName;
  return { session, profile };
}

async function invokeCleanupFunction(body) {
  const session = await getActiveSession();
  if (!session) throw new Error("Sesi login tidak ditemukan.");

  const { data, error } = await supabaseClient.functions.invoke("r2-cleanup", {
    body,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    throw new Error(
      await getFunctionErrorMessage(
        error,
        "Edge Function pengelolaan storage gagal dijalankan.",
      ),
    );
  }

  if (data?.error && !data?.success) throw new Error(data.error);
  return data;
}

function setDefaultDates() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const today = `${year}-${month}-${day}`;
  const firstDay = `${year}-${month}-01`;
  storageStartDate.value = firstDay;
  storageEndDate.value = today;
}

function validateRange() {
  const startDate = storageStartDate.value;
  const endDate = storageEndDate.value;

  if (!startDate || !endDate) {
    throw new Error("Tanggal awal dan akhir wajib diisi.");
  }
  if (startDate > endDate) {
    throw new Error("Tanggal awal tidak boleh melebihi tanggal akhir.");
  }
  return { startDate, endDate };
}

function resetPreview() {
  previewState = null;
  storagePreviewCard.hidden = true;
  storageConfirmation.value = "";
  storageConfirmation.disabled = true;
  storageDeleteBtn.disabled = true;
  storageProgress.hidden = true;
}

function updateDeleteButton() {
  storageDeleteBtn.disabled =
    deletionRunning ||
    !previewState ||
    previewState.totalFoto <= 0 ||
    storageConfirmation.value.trim() !== requiredConfirmation;
}

function setButtonLoading(button, loading, text) {
  if (loading) {
    button.dataset.originalText = button.textContent;
    button.textContent = text;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

async function loadPreview() {
  clearStorageMessage();
  resetPreview();
  let range;

  try {
    range = validateRange();
  } catch (error) {
    showStorageMessage(error.message);
    return;
  }

  setButtonLoading(storagePreviewBtn, true, "Memeriksa...");

  try {
    const result = await invokeCleanupFunction({
      action: "preview",
      start_date: range.startDate,
      end_date: range.endDate,
    });

    previewState = {
      startDate: range.startDate,
      endDate: range.endDate,
      totalFoto: Number(result.total_foto) || 0,
    };

    storagePhotoCount.textContent = previewState.totalFoto.toLocaleString("id-ID");
    storageSelectedPeriod.textContent = `${formatDate(range.startDate)} - ${formatDate(range.endDate)}`;
    storageEstimatedSize.textContent = formatBytes(result.estimated_max_bytes);
    storagePreviewCard.hidden = false;
    storageConfirmation.disabled = previewState.totalFoto === 0;

    if (previewState.totalFoto === 0) {
      showStorageMessage("Tidak ada foto R2 pada rentang tanggal tersebut.", "success");
    } else {
      showStorageMessage(
        `${previewState.totalFoto} foto ditemukan. Periksa kembali tanggal sebelum menghapus.`,
        "success",
      );
      storageConfirmation.focus();
    }
    updateDeleteButton();
  } catch (error) {
    showStorageMessage("Gagal memeriksa foto: " + error.message);
  } finally {
    setButtonLoading(storagePreviewBtn, false);
  }
}

function updateProgress(deleted, total) {
  const percent = total > 0 ? Math.min(100, Math.round((deleted / total) * 100)) : 100;
  storageProgress.hidden = false;
  storageProgressText.textContent = `${deleted.toLocaleString("id-ID")} dari ${total.toLocaleString("id-ID")} foto dihapus`;
  storageProgressPercent.textContent = `${percent}%`;
  storageProgressBar.style.width = `${percent}%`;
}

async function deletePhotos() {
  if (!previewState || deletionRunning) return;

  const currentRange = validateRange();
  if (
    currentRange.startDate !== previewState.startDate ||
    currentRange.endDate !== previewState.endDate
  ) {
    resetPreview();
    showStorageMessage("Tanggal berubah. Klik Cek Foto kembali sebelum menghapus.");
    return;
  }

  if (storageConfirmation.value.trim() !== requiredConfirmation) return;

  const confirmed = window.confirm(
    `Hapus permanen ${previewState.totalFoto} foto dari ${formatDate(previewState.startDate)} sampai ${formatDate(previewState.endDate)}?\n\nTindakan ini tidak dapat dibatalkan.`,
  );
  if (!confirmed) return;

  deletionRunning = true;
  storageStartDate.disabled = true;
  storageEndDate.disabled = true;
  storagePreviewBtn.disabled = true;
  storageConfirmation.disabled = true;
  storageDeleteBtn.disabled = true;
  storageDeleteBtn.dataset.originalText = storageDeleteBtn.textContent;
  storageDeleteBtn.textContent = "Menghapus...";
  clearStorageMessage();
  updateProgress(0, previewState.totalFoto);

  let cleanupId = "";
  let deletedTotal = 0;
  let iteration = 0;

  try {
    while (iteration < 1000) {
      iteration += 1;
      const result = await invokeCleanupFunction({
        action: "delete",
        start_date: previewState.startDate,
        end_date: previewState.endDate,
        confirmation: requiredConfirmation,
        cleanup_id: cleanupId,
      });

      cleanupId = result.cleanup_id || cleanupId;
      deletedTotal = Number(result.deleted_total) || deletedTotal;
      updateProgress(deletedTotal, previewState.totalFoto);

      if (result.done) {
        if (Number(result.failed_total) > 0) {
          throw new Error(
            `${result.failed_total} foto gagal dihapus. Periksa riwayat untuk detail.`,
          );
        }
        break;
      }
    }

    if (iteration >= 1000) {
      throw new Error("Proses dihentikan karena melewati batas batch keamanan.");
    }

    updateProgress(previewState.totalFoto, previewState.totalFoto);
    showStorageMessage(
      `${deletedTotal} foto berhasil dihapus permanen. Data absensi tetap tersimpan.`,
      "success",
    );
    storageConfirmation.value = "";
    await loadHistory();

    window.setTimeout(() => {
      loadPreview();
    }, 700);
  } catch (error) {
    console.error(error);
    showStorageMessage("Penghapusan belum selesai: " + error.message);
    await loadHistory();
  } finally {
    deletionRunning = false;
    storageStartDate.disabled = false;
    storageEndDate.disabled = false;
    storagePreviewBtn.disabled = false;
    storageDeleteBtn.textContent =
      storageDeleteBtn.dataset.originalText || "Hapus Foto Permanen";
    updateDeleteButton();
  }
}

function getHistoryStatus(status) {
  if (status === "completed") return ["Selesai", "completed"];
  if (status === "processing") return ["Diproses", "processing"];
  return ["Gagal", "failed"];
}

function renderHistory(history) {
  if (!history.length) {
    storageHistoryList.innerHTML = `
      <div class="storage-history-empty">Belum ada riwayat penghapusan foto.</div>
    `;
    return;
  }

  storageHistoryList.innerHTML = history
    .map((item) => {
      const [statusLabel, statusClass] = getHistoryStatus(item.status);
      const profile = Array.isArray(item.profiles)
        ? item.profiles[0]
        : item.profiles;
      return `
        <article class="storage-history-item">
          <div class="storage-history-period">
            <strong>${escapeHtml(formatDate(item.tanggal_awal))}</strong>
            <span>sampai ${escapeHtml(formatDate(item.tanggal_akhir))}</span>
          </div>
          <div class="storage-history-numbers">
            <span>Ditemukan <strong>${Number(item.jumlah_ditemukan || 0).toLocaleString("id-ID")}</strong></span>
            <span>Dihapus <strong>${Number(item.jumlah_dihapus || 0).toLocaleString("id-ID")}</strong></span>
            <span>Gagal <strong>${Number(item.jumlah_gagal || 0).toLocaleString("id-ID")}</strong></span>
          </div>
          <div class="storage-history-meta">
            <span class="storage-history-status ${statusClass}">${statusLabel}</span>
            <small>${escapeHtml(profile?.nama_lengkap || "Admin")} · ${escapeHtml(formatDateTime(item.created_at))}</small>
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadHistory() {
  storageRefreshBtn.disabled = true;
  try {
    const result = await invokeCleanupFunction({ action: "history" });
    renderHistory(result.history || []);
  } catch (error) {
    storageHistoryList.innerHTML = `
      <div class="storage-history-empty error">${escapeHtml(error.message)}</div>
    `;
  } finally {
    storageRefreshBtn.disabled = false;
  }
}

storageStartDate.addEventListener("change", resetPreview);
storageEndDate.addEventListener("change", resetPreview);
storageConfirmation.addEventListener("input", updateDeleteButton);
storagePreviewBtn.addEventListener("click", loadPreview);
storageDeleteBtn.addEventListener("click", deletePhotos);
storageRefreshBtn.addEventListener("click", loadHistory);

async function initStoragePage() {
  setDefaultDates();
  const admin = await checkAdmin();
  if (!admin) return;
  await loadHistory();
}

initStoragePage();

const messageBox = document.getElementById("message");
const izinForm = document.getElementById("izinForm");

const tanggalIzinInput = document.getElementById("tanggal_izin");
const keteranganInput = document.getElementById("keterangan");
const buktiIzinInput = document.getElementById("bukti_izin");

const previewBuktiIzin = document.getElementById("previewBuktiIzin");

// Sidebar mobile
const sidebarUserNameEl = document.getElementById("sidebarUserName");
const sidebarUserBagianEl = document.getElementById("sidebarUserBagian");
const sidebarUserStatusEl = document.getElementById("sidebarUserStatus");
const sidebarUserPhotoEl = document.getElementById("sidebarUserPhoto");
const sidebarAvatarFallbackEl = document.getElementById(
  "sidebarAvatarFallback",
);

// Navbar desktop
const desktopUserNameEl = document.getElementById("desktopUserName");
const desktopUserBagianEl = document.getElementById("desktopUserBagian");
const desktopUserPhotoEl = document.getElementById("desktopUserPhoto");
const desktopAvatarFallbackEl = document.getElementById(
  "desktopAvatarFallback",
);

let currentUser = null;
let currentProfile = null;

function isiNavbarUser(profile) {
  const nama = profile.nama_lengkap ?? "User";
  const bagian = profile.bagian ?? "-";
  const statusAkun = profile.status_akun ?? "aktif";
  const fotoUrl = profile.foto_wajah_url;

  // Sidebar mobile
  if (sidebarUserNameEl) sidebarUserNameEl.innerText = nama;
  if (sidebarUserBagianEl) sidebarUserBagianEl.innerText = bagian;
  if (sidebarUserStatusEl) sidebarUserStatusEl.innerText = statusAkun;

  // Navbar desktop
  if (desktopUserNameEl) desktopUserNameEl.innerText = nama;
  if (desktopUserBagianEl) desktopUserBagianEl.innerText = bagian;

  // Foto sidebar + desktop
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

function showPopupSuccess(title, text) {
  if (window.Swal) {
    Swal.fire({
      icon: "success",
      title,
      text,
      confirmButtonText: "Oke",
      confirmButtonColor: "#2563eb",
    });
  } else {
    alert(title + "\n" + text);
  }
}

function showPopupError(title, text) {
  if (window.Swal) {
    Swal.fire({
      icon: "error",
      title,
      text,
      confirmButtonText: "Coba Lagi",
      confirmButtonColor: "#d33",
    });
  } else {
    alert(title + "\n" + text);
  }
}

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

  currentProfile = profile;

  isiNavbarUser(profile);

  return profile;
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

function setTanggalHariIni() {
  const today = new Date().toISOString().split("T")[0];
  tanggalIzinInput.value = today;
}

function getFileExtension(filename) {
  return filename.split(".").pop();
}

async function cekSudahAdaAbsensi(tanggal) {
  const { data, error } = await supabaseClient
    .from("absensi")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("tanggal", tanggal);

  if (error) {
    console.error(error);
    return false;
  }

  return data && data.length > 0;
}

async function uploadBuktiIzin(file, tanggal) {
  const extension = getFileExtension(file.name);
  const fileName = `${currentUser.id}/${tanggal}-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabaseClient.storage
    .from("bukti-izin")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicData } = supabaseClient.storage
    .from("bukti-izin")
    .getPublicUrl(fileName);

  return publicData.publicUrl;
}

if (buktiIzinInput && previewBuktiIzin) {
  buktiIzinInput.addEventListener("change", () => {
    const file = buktiIzinInput.files[0];

    if (!file) {
      previewBuktiIzin.innerHTML = `
        <div class="izin-preview-empty">
          Belum ada foto bukti yang dipilih.
        </div>
      `;
      return;
    }

    const imageUrl = URL.createObjectURL(file);

    previewBuktiIzin.innerHTML = `
      <img src="${imageUrl}" alt="Preview bukti izin">
    `;
  });
}

if (izinForm) {
  izinForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!currentUser) {
      await cekUser();
    }

    if (!currentUser) return;

    const submitButton = izinForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.innerText = "Mengirim...";

    const tanggalIzin = tanggalIzinInput.value;
    const keterangan = keteranganInput.value.trim();
    const file = buktiIzinInput.files[0];

    if (!tanggalIzin || !keterangan || !file) {
      showMessage("Tanggal, keterangan, dan bukti foto wajib diisi.");
      submitButton.disabled = false;
      submitButton.innerText = "Kirim Izin";
      return;
    }

    if (!file.type.startsWith("image/")) {
      showMessage("File bukti harus berupa gambar.");
      submitButton.disabled = false;
      submitButton.innerText = "Kirim Izin";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showMessage("Ukuran foto maksimal 2MB.");
      submitButton.disabled = false;
      submitButton.innerText = "Kirim Izin";
      return;
    }

    const sudahAda = await cekSudahAdaAbsensi(tanggalIzin);

    if (sudahAda) {
      showMessage("Anda sudah memiliki data absensi pada tanggal tersebut.");
      submitButton.disabled = false;
      submitButton.innerText = "Kirim Izin";
      return;
    }

    showMessage("Mengupload bukti izin...", "success");

    let buktiUrl = "";

    try {
      buktiUrl = await uploadBuktiIzin(file, tanggalIzin);
    } catch (error) {
      console.error(error);
      showMessage("Gagal upload bukti izin: " + error.message);
      submitButton.disabled = false;
      submitButton.innerText = "Kirim Izin";
      return;
    }

    showMessage("Menyimpan data izin...", "success");

    const { error: insertError } = await supabaseClient.from("absensi").insert({
      user_id: currentUser.id,
      tanggal: tanggalIzin,
      waktu_masuk: null,
      latitude: null,
      longitude: null,
      nama_tempat: null,
      jarak_meter: null,
      status: "izin",
      keterangan: keterangan,
      bukti_izin_url: buktiUrl,
      validasi_wajah: "tidak_valid",
      validasi_lokasi: "tidak_valid",
    });

    if (insertError) {
      console.error(insertError);
      showMessage("Gagal menyimpan izin: " + insertError.message);
      submitButton.disabled = false;
      submitButton.innerText = "Kirim Izin";
      return;
    }

    showMessage("Izin berhasil dikirim.", "success");

    showPopupSuccess(
      "Izin Berhasil Dikirim",
      "Data izin Anda berhasil dikirim dan akan tampil pada riwayat absensi.",
    );

    izinForm.reset();
    setTanggalHariIni();

    submitButton.disabled = false;
    submitButton.innerText = "Kirim Izin";
  });
}

async function init() {
  setTanggalHariIni();
  await cekUser();
}

init();

const messageBox = document.getElementById("message");
const video = document.getElementById("video");

const statusWajahEl = document.getElementById("statusWajah");

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
const desktopUserPhoto = document.getElementById("desktopUserPhoto");
const desktopAvatarFallback = document.getElementById("desktopAvatarFallback");

let currentUser = null;
let currentProfile = null;
let modelSiap = false;

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

  // Foto sidebar mobile
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
      confirmButtonColor: "#315aa8",
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

  // Isi sidebar dan desktop navbar
  isiNavbarUser(profile);

  // Status wajah di halaman daftar wajah
  if (profile.face_descriptor) {
    if (statusWajahEl) {
      statusWajahEl.innerText = "Sudah terdaftar";
    }

    const tombolDaftar = document.getElementById("btnDaftarWajah");

    if (tombolDaftar) {
      tombolDaftar.disabled = true;
      tombolDaftar.innerText = "Wajah Sudah Terdaftar";
    }

    showMessage(
      "Data wajah Anda sudah terdaftar. Jika ingin mengganti data wajah, silakan hubungi admin.",
      "success",
    );
  } else {
    if (statusWajahEl) {
      statusWajahEl.innerText = "Belum terdaftar";
    }
  }

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

async function loadModelFaceApi() {
  showMessage("Memuat model face scan...", "success");

  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("../assets/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("../assets/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("../assets/models"),
    ]);

    modelSiap = true;
    showMessage(
      "Model face scan siap. Silakan arahkan wajah ke kamera.",
      "success",
    );
  } catch (error) {
    console.error(error);
    showMessage("Gagal memuat model face-api. Periksa folder assets/models.");
  }
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showMessage("Browser tidak mendukung akses kamera.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    video.srcObject = stream;
  } catch (error) {
    console.error(error);
    showMessage("Kamera gagal diakses. Pastikan izin kamera diaktifkan.");
  }
}

function ambilSnapshotWajah() {
  return new Promise((resolve, reject) => {
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      reject(new Error("Video belum siap untuk mengambil foto."));
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Gagal membuat foto wajah."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      0.85,
    );
  });
}

async function uploadFotoWajah(blob) {
  const fileName = `${currentUser.id}/foto-wajah-${Date.now()}.jpg`;

  const { error: uploadError } = await supabaseClient.storage
    .from("foto-wajah")
    .upload(fileName, blob, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicData } = supabaseClient.storage
    .from("foto-wajah")
    .getPublicUrl(fileName);

  return publicData.publicUrl;
}

async function daftarkanWajah() {
  if (!currentUser) {
    showMessage("User belum terdeteksi. Silakan login ulang.");
    return;
  }

  if (currentProfile && currentProfile.face_descriptor) {
    showMessage(
      "Data wajah sudah terdaftar. Anda tidak dapat mendaftarkan wajah ulang. Hubungi admin jika diperlukan.",
    );

    showPopupError(
      "Wajah Sudah Terdaftar",
      "Anda tidak dapat mendaftarkan wajah ulang. Jika ada kendala, silakan hubungi admin.",
    );

    return;
  }

  if (!modelSiap) {
    showMessage("Model face scan belum siap.");
    return;
  }

  showMessage("Mendeteksi wajah...", "success");

  const deteksi = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!deteksi) {
    showMessage(
      "Wajah belum terbaca stabil. Pastikan wajah terlihat jelas dan pencahayaan cukup.",
    );

    showPopupError(
      "Wajah Belum Terbaca",
      "Pastikan wajah berada di tengah kamera, tidak terlalu dekat, dan pencahayaan cukup.",
    );

    return;
  }

  const descriptorArray = Array.from(deteksi.descriptor);

  let fotoWajahUrl = "";

  try {
    showMessage("Mengambil foto wajah...", "success");

    const fotoBlob = await ambilSnapshotWajah();
    fotoWajahUrl = await uploadFotoWajah(fotoBlob);
  } catch (error) {
    console.error(error);
    showMessage("Gagal menyimpan foto wajah: " + error.message);
    return;
  }

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      face_descriptor: descriptorArray,
      foto_wajah_url: fotoWajahUrl,
    })
    .eq("id", currentUser.id);

  currentProfile = {
    ...currentProfile,
    face_descriptor: descriptorArray,
    foto_wajah_url: fotoWajahUrl,
  };

  isiNavbarUser(currentProfile);

  if (error) {
    console.error(error);
    showMessage("Gagal menyimpan data wajah: " + error.message);
    return;
  }

  statusWajahEl.innerText = "Sudah terdaftar";

  const tombolDaftar = document.getElementById("btnDaftarWajah");
  if (tombolDaftar) {
    tombolDaftar.disabled = true;
    tombolDaftar.innerText = "Wajah Sudah Terdaftar";
  }

  showMessage("Data wajah dan foto wajah berhasil disimpan.", "success");

  showPopupSuccess(
    "Data Wajah Berhasil Disimpan",
    "Data wajah dan foto wajah Anda berhasil disimpan. Pendaftaran wajah hanya dapat dilakukan satu kali. Jika ada kendala, silakan hubungi admin.",
  );
}

function tungguVideoSiap() {
  return new Promise((resolve) => {
    if (
      video.readyState >= 2 &&
      video.videoWidth > 0 &&
      video.videoHeight > 0
    ) {
      resolve();
      return;
    }

    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
}

async function init() {
  await cekUser();
  await startCamera();
  await loadModelFaceApi();
}

init();

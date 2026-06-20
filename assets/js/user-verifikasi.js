const messageBox = document.getElementById("message");

const video = document.getElementById("video");

const statusDataWajahEl = document.getElementById("statusDataWajah");

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

const lokasiValidEl = document.getElementById("lokasiValid");
const radiusValidEl = document.getElementById("radiusValid");

const latitudeUserEl = document.getElementById("latitudeUser");
const longitudeUserEl = document.getElementById("longitudeUser");
const jarakUserEl = document.getElementById("jarakUser");
const statusLokasiEl = document.getElementById("statusLokasi");

const statusWajahEl = document.getElementById("statusWajah");
const skorWajahEl = document.getElementById("skorWajah");

const instruksiGerakanEl = document.getElementById("instruksiGerakan");
const statusGerakanEl = document.getElementById("statusGerakan");
const btnAbsen = document.getElementById("btnAbsen");

const heroStatusText = document.getElementById("heroStatusText");

const instruksiIcon = document.getElementById("instruksiIcon");
const statusGerakanBox = document.getElementById("statusGerakanBox");
const faceOverlayCanvas = document.getElementById("faceOverlayCanvas");

const instructionCompactBox = document.getElementById("instructionCompactBox");
let faceOverlayInterval = null;

let gerakanValid = false;
let instruksiAktif = null;

let currentUser = null;
let currentProfile = null;
let lokasiAbsenList = [];
let lokasiTerdekat = null;
let modelSiap = false;
let pengaturanAbsen = null;

const BATAS_KEMIRIPAN_WAJAH = 0.5;

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

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (
    x,
    y,
    width,
    height,
    radius,
  ) {
    this.beginPath();
    this.moveTo(x + radius, y);
    this.lineTo(x + width - radius, y);
    this.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.lineTo(x + width, y + height - radius);
    this.quadraticCurveTo(
      x + width,
      y + height,
      x + width - radius,
      y + height,
    );
    this.lineTo(x + radius, y + height);
    this.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.lineTo(x, y + radius);
    this.quadraticCurveTo(x, y, x + radius, y);
    this.closePath();
    return this;
  };
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

function showMessage(text, type = "error") {
  if (!messageBox) return;

  messageBox.innerHTML = `
    <div class="alert ${type === "success" ? "alert-success" : "alert-error"}">
      ${text}
    </div>
  `;
}

function setInstruksiUI(text, icon = "🙂", type = "normal") {
  if (instruksiGerakanEl) {
    instruksiGerakanEl.innerText = text;
  }

  if (statusGerakanEl) {
    statusGerakanEl.innerText = text;
  }

  if (instruksiIcon) {
    instruksiIcon.innerText = icon;
  }

  if (instructionCompactBox) {
    instructionCompactBox.classList.remove(
      "is-success",
      "is-warning",
      "is-error",
    );

    if (type === "success") {
      instructionCompactBox.classList.add("is-success");
    }

    if (type === "warning") {
      instructionCompactBox.classList.add("is-warning");
    }

    if (type === "error") {
      instructionCompactBox.classList.add("is-error");
    }
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

  if (profile.face_descriptor) {
    if (statusDataWajahEl) {
      statusDataWajahEl.innerText = "Sudah terdaftar";
    }
  } else {
    if (statusDataWajahEl) {
      statusDataWajahEl.innerText = "Belum terdaftar";
    }
  }

  return profile;
}

async function loadPengaturanAbsen() {
  const { data, error } = await supabaseClient
    .from("pengaturan_absen")
    .select("*")
    .order("id", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    console.warn("Pengaturan absen belum ada, memakai default.");
    pengaturanAbsen = {
      jam_masuk: "08:00",
      batas_telat: "08:15",
    };
    return pengaturanAbsen;
  }

  pengaturanAbsen = data;
  return data;
}

function tentukanStatusKehadiran(waktuSekarang) {
  const batasTelat = pengaturanAbsen?.batas_telat
    ? pengaturanAbsen.batas_telat.substring(0, 5)
    : "08:15";

  const waktuAbsen = waktuSekarang.substring(0, 5);

  if (waktuAbsen > batasTelat) {
    return "terlambat";
  }

  return "hadir";
}

async function loadModelFaceApi() {
  showMessage("Memuat model face scan...", "success");

  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri("../assets/models"),
      faceapi.nets.faceLandmark68Net.loadFromUri("../assets/models"),
      faceapi.nets.faceRecognitionNet.loadFromUri("../assets/models"),
    ]);

    modelSiap = true;
    showMessage("Model face scan siap.", "success");
  } catch (error) {
    console.error(error);
    showMessage("Gagal memuat model face-api. Periksa folder assets/models.");
  }
}

function resizeFaceOverlayCanvas() {
  if (!faceOverlayCanvas || !video) return;

  const rect = video.getBoundingClientRect();

  faceOverlayCanvas.width = rect.width;
  faceOverlayCanvas.height = rect.height;
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

function updateContohGerakan(instruksi) {
  if (!instruksiIcon) return;

  if (instruksi === "putar_kanan_kiri") {
    instruksiIcon.innerText = "↔️";
    return;
  }

  if (instruksi === "kedip") {
    instruksiIcon.innerText = "😉";
    return;
  }

  if (instruksi === "tengok_kanan") {
    instruksiIcon.innerText = "➡️";
    return;
  }

  if (instruksi === "tengok_kiri") {
    instruksiIcon.innerText = "⬅️";
    return;
  }

  instruksiIcon.innerText = "🙂";
}

function analisisArahWajah(landmarks) {
  const hidung = landmarks.getNose();
  const rahang = landmarks.getJawOutline();

  const titikHidung = hidung[3];
  const rahangKiri = rahang[0];
  const rahangKanan = rahang[16];

  const tengahWajahX = (rahangKiri.x + rahangKanan.x) / 2;
  const lebarWajah = jarakTitik(rahangKiri, rahangKanan);

  const selisihHidungX = titikHidung.x - tengahWajahX;
  const rasioX = selisihHidungX / lebarWajah;

  console.log("RASIO ARAH WAJAH:", rasioX);

  return rasioX;
}

async function loadLokasiAbsen() {
  const { data, error } = await supabaseClient
    .from("lokasi_absen")
    .select("*")
    .order("id", { ascending: true });

  if (error || !data || data.length === 0) {
    showMessage("Lokasi absen belum diatur oleh admin.");
    lokasiValidEl.innerText = "-";
    radiusValidEl.innerText = "-";
    lokasiAbsenList = [];
    return [];
  }

  lokasiAbsenList = data;

  lokasiValidEl.innerText = `${data.length} titik lokasi tersedia`;
  radiusValidEl.innerText = "Mengikuti radius lokasi terdekat";

  return data;
}

async function cekWajah() {
  await tungguVideoSiap();
  setInstruksiUI("Mencocokkan wajah...", "🔍", "warning");
  if (!modelSiap) {
    showMessage("Model face scan belum siap.");
    return false;
  }

  if (!currentProfile.face_descriptor) {
    showMessage(
      "Data wajah belum terdaftar. Silakan daftar wajah terlebih dahulu.",
    );
    statusWajahEl.innerText = "Belum terdaftar";
    return false;
  }

  if (!Array.isArray(currentProfile.face_descriptor)) {
    showMessage("Format data wajah tidak valid. Silakan daftar ulang wajah.");
    statusWajahEl.innerText = "Data wajah rusak";
    return false;
  }

  if (currentProfile.face_descriptor.length !== 128) {
    showMessage("Data wajah tidak lengkap. Silakan daftar ulang wajah.");
    statusWajahEl.innerText = "Data wajah tidak lengkap";
    return false;
  }

  showMessage("Mendeteksi dan mencocokkan wajah...", "success");

  const deteksi = await deteksiWajahDenganRetry({
    withDescriptor: true,
    maxTry: 8,
  });

  if (!deteksi) {
    showMessage(
      "Wajah belum terbaca stabil. Coba posisikan wajah di tengah kamera, jangan terlalu dekat, dan pastikan pencahayaan cukup.",
    );
    statusWajahEl.innerText = "Belum terbaca stabil";
    skorWajahEl.innerText = "-";
    return false;
  }

  const descriptorTersimpan = new Float32Array(currentProfile.face_descriptor);
  const descriptorSekarang = deteksi.descriptor;

  const distance = faceapi.euclideanDistance(
    descriptorTersimpan,
    descriptorSekarang,
  );

  console.log("FACE DISTANCE:", distance);
  console.log("BATAS:", BATAS_KEMIRIPAN_WAJAH);

  skorWajahEl.innerText = distance.toFixed(4);

  if (distance <= BATAS_KEMIRIPAN_WAJAH) {
    statusWajahEl.innerText = "Valid";
    setInstruksiUI("Wajah cocok ✅", "✅", "success");
    return true;
  }

  setInstruksiUI("Wajah tidak cocok", "❌", "error");
  statusWajahEl.innerText = "Tidak valid";
  showMessage(
    `Wajah tidak cocok. Skor kemiripan: ${distance.toFixed(4)}. Batas maksimal: ${BATAS_KEMIRIPAN_WAJAH}`,
  );
  return false;
}

// function pilihInstruksiAcak() {
//   const daftarInstruksi = [
//     "kedip",
//     "tengok_kanan",
//     "tengok_kiri",
//     "tengok_atas",
//     "tengok_bawah",
//   ];

//   const randomIndex = Math.floor(Math.random() * daftarInstruksi.length);
//   return daftarInstruksi[randomIndex];
// }

function pilihInstruksiAcak() {
  return "putar_kanan_kiri";
}

function teksInstruksi(instruksi) {
  if (instruksi === "putar_kanan_kiri") {
    return "🙂‍↔️ Putar kepala ke kanan lalu ke kiri secara perlahan";
  }
  if (instruksi === "kedip") return "Silakan kedipkan mata";
  if (instruksi === "tengok_kanan") return "Silakan tengok ke kanan";
  if (instruksi === "tengok_kiri") return "Silakan tengok ke kiri";
  if (instruksi === "tengok_atas") return "Silakan tengok ke atas";
  if (instruksi === "tengok_bawah") return "Silakan tengok ke bawah";
  return "Siap Membaca Wajah";
}

function hitungEAR(mata) {
  const p1 = mata[0];
  const p2 = mata[1];
  const p3 = mata[2];
  const p4 = mata[3];
  const p5 = mata[4];
  const p6 = mata[5];

  const vertical1 = jarakTitik(p2, p6);
  const vertical2 = jarakTitik(p3, p5);
  const horizontal = jarakTitik(p1, p4);

  return (vertical1 + vertical2) / (2.0 * horizontal);
}

function jarakTitik(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function analisisGerakan(landmarks, instruksi) {
  const hidung = landmarks.getNose();
  const rahang = landmarks.getJawOutline();
  const mataKiri = landmarks.getLeftEye();
  const mataKanan = landmarks.getRightEye();

  const titikHidung = hidung[3];
  const rahangKiri = rahang[0];
  const rahangKanan = rahang[16];
  const dagu = rahang[8];

  const tengahWajahX = (rahangKiri.x + rahangKanan.x) / 2;
  const lebarWajah = jarakTitik(rahangKiri, rahangKanan);

  const selisihHidungX = titikHidung.x - tengahWajahX;
  const rasioX = selisihHidungX / lebarWajah;

  const tinggiDagu = dagu.y - titikHidung.y;
  const rasioY = tinggiDagu / lebarWajah;

  const earKiri = hitungEAR(mataKiri);
  const earKanan = hitungEAR(mataKanan);
  const earRataRata = (earKiri + earKanan) / 2;

  console.log({
    instruksi,
    rasioX,
    rasioY,
    earRataRata,
  });

  if (instruksi === "kedip") {
    return earRataRata < 0.27;
  }

  if (instruksi === "tengok_kanan") {
    return rasioX < -0.04;
  }

  if (instruksi === "tengok_kiri") {
    return rasioX > 0.04;
  }

  //   if (instruksi === "tengok_atas") {
  //     return rasioY > 0.55;
  //   }

  //   if (instruksi === "tengok_bawah") {
  //     return rasioY < 0.42;
  //   }

  return false;
}

async function deteksiWajahDenganRetry({
  withDescriptor = false,
  maxTry = 8,
} = {}) {
  for (let i = 0; i < maxTry; i++) {
    let deteksi;

    if (withDescriptor) {
      deteksi = await faceapi
        .detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.3,
          }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();
    } else {
      deteksi = await faceapi
        .detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: 0.3,
          }),
        )
        .withFaceLandmarks();
    }

    if (deteksi) {
      return deteksi;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return null;
}

async function verifikasiDanAbsen() {
  const btn = document.getElementById("btnVerifikasiAbsen");

  if (btn) {
    btn.disabled = true;
    btn.innerText = "Memverifikasi...";
    setInstruksiUI("Mulai verifikasi wajah...", "🔍", "warning");
  }

  if (heroStatusText) {
    heroStatusText.innerText = "Memproses verifikasi";
  }

  try {
    const gerakanBerhasil = await verifikasiGerakanSekali();

    if (!gerakanBerhasil) {
      if (heroStatusText) {
        heroStatusText.innerText = "Gerakan tidak valid";
      }

      showPopupError(
        "Gerakan Belum Terbaca",
        "Coba ulangi dengan wajah di tengah kamera, jangan terlalu dekat, dan lakukan gerakan perlahan.",
      );

      return;
    }

    const wajahValid = await cekWajah();

    if (!wajahValid) {
      if (heroStatusText) {
        heroStatusText.innerText = "Wajah tidak cocok";
      }

      setInstruksiUI("Wajah tidak cocok", "❌", "error");

      showPopupError(
        "Wajah Tidak Cocok",
        "Wajah tidak sesuai dengan data wajah yang terdaftar.",
      );

      return;
    }

    setInstruksiUI("Wajah valid, mengecek lokasi...", "📍", "success");

    await prosesAbsenSetelahValidasi();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "Verifikasi & Absen Sekarang";
    }
  }
}

async function verifikasiGerakanSekali() {
  await tungguVideoSiap();

  return new Promise((resolve) => {
    if (!modelSiap) {
      showMessage("Model face scan belum siap.");
      resolve(false);
      return;
    }

    if (heroStatusText) {
      heroStatusText.innerText = "Memproses gerakan...";
    }

    instruksiAktif = "putar_kanan_kiri";

    setInstruksiUI("Putar kepala kanan-kiri perlahan", "↔️", "warning");
    updateContohGerakan(instruksiAktif);

    if (statusGerakanBox) {
      statusGerakanBox.classList.remove("status-valid", "status-fail");
      statusGerakanBox.classList.add("status-waiting");
    }

    showMessage(
      "Silakan putar kepala ke kanan lalu ke kiri secara perlahan.",
      "success",
    );

    const waktuMulai = Date.now();
    const durasiMaksimal = 20000;

    let sudahKanan = false;
    let sudahKiri = false;
    let jumlahFrameTerdeteksi = 0;

    const interval = setInterval(async () => {
      const waktuBerjalan = Date.now() - waktuMulai;
      const detikBerjalan = Math.floor(waktuBerjalan / 1000);

      if (waktuBerjalan > durasiMaksimal) {
        clearInterval(interval);

        setInstruksiUI("Gerakan belum valid, coba ulangi", "⚠️", "error");

        if (statusGerakanBox) {
          statusGerakanBox.classList.remove("status-waiting", "status-valid");
          statusGerakanBox.classList.add("status-fail");
        }

        resolve(false);
        return;
      }

      const deteksi = await deteksiWajahDenganRetry({
        withDescriptor: false,
        maxTry: 2,
      });

      if (!deteksi) {
        if (detikBerjalan < 4) {
          setInstruksiUI("Sedang membaca wajah...", "🙂", "warning");
        } else {
          setInstruksiUI("Arahkan wajah ke tengah kamera", "🎯", "warning");
        }
        return;
      }

      jumlahFrameTerdeteksi++;

      const rasioX = analisisArahWajah(deteksi.landmarks);

      /**
       * Catatan:
       * Di kode sebelumnya:
       * tengok_kanan = rasioX < -0.04
       * tengok_kiri  = rasioX > 0.04
       *
       * Kalau arah terasa kebalik di kamera HP, cukup tukar teksnya saja.
       */
      if (rasioX < -0.035) {
        sudahKanan = true;
      }

      if (rasioX > 0.035) {
        sudahKiri = true;
      }

      if (sudahKanan && !sudahKiri) {
        setInstruksiUI("Kiri terbaca, lanjut ke kanan", "➡️", "warning");
      } else if (!sudahKanan && sudahKiri) {
        setInstruksiUI("Kanan terbaca, lanjut ke kiri", "⬅️", "warning");
      } else if (!sudahKanan && !sudahKiri) {
        setInstruksiUI("Putar kanan-kiri perlahan", "↔️", "warning");
      }

      if (sudahKanan && sudahKiri && jumlahFrameTerdeteksi >= 3) {
        clearInterval(interval);

        setInstruksiUI("Gerakan valid ✅", "✅", "success");

        if (heroStatusText) {
          heroStatusText.innerText = "Gerakan valid";
        }

        if (statusGerakanBox) {
          statusGerakanBox.classList.remove("status-waiting", "status-fail");
          statusGerakanBox.classList.add("status-valid");
        }

        showMessage("Gerakan valid. Mencocokkan wajah...", "success");

        resolve(true);
      }
    }, 500);
  });
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

function getCurrentPositionPromise() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Browser tidak mendukung geolocation."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

function ambilSnapshotAbsen() {
  return new Promise((resolve, reject) => {
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      reject(new Error("Video belum siap untuk mengambil foto absen."));
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    // Jika tampilan kamera kamu dibalik mirror dengan CSS scaleX(-1),
    // snapshot ini dibuat normal sesuai frame video asli.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Gagal membuat foto absen."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      0.85,
    );
  });
}

async function uploadFotoAbsen(blob) {
  const tanggalHariIni = getTanggalHariIni();
  const fileName = `${currentUser.id}/${tanggalHariIni}/absen-${Date.now()}.jpg`;

  const { error: uploadError } = await supabaseClient.storage
    .from("foto-absen")
    .upload(fileName, blob, {
      cacheControl: "3600",
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicData } = supabaseClient.storage
    .from("foto-absen")
    .getPublicUrl(fileName);

  return publicData.publicUrl;
}

function hitungJarakMeter(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = derajatKeRadian(lat2 - lat1);
  const dLon = derajatKeRadian(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(derajatKeRadian(lat1)) *
      Math.cos(derajatKeRadian(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function cariLokasiTerdekat(latitudeUser, longitudeUser) {
  if (!lokasiAbsenList || lokasiAbsenList.length === 0) {
    return null;
  }

  let lokasiTerdekatSementara = null;
  let jarakTerdekat = Infinity;

  lokasiAbsenList.forEach((lokasi) => {
    const jarak = hitungJarakMeter(
      latitudeUser,
      longitudeUser,
      lokasi.latitude,
      lokasi.longitude,
    );

    if (jarak < jarakTerdekat) {
      jarakTerdekat = jarak;
      lokasiTerdekatSementara = {
        ...lokasi,
        jarak_meter: jarak,
        valid: jarak <= lokasi.radius_meter,
      };
    }
  });

  return lokasiTerdekatSementara;
}

function derajatKeRadian(deg) {
  return deg * (Math.PI / 180);
}

function getTanggalHariIni() {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

function getWaktuSekarang() {
  const now = new Date();

  const jam = String(now.getHours()).padStart(2, "0");
  const menit = String(now.getMinutes()).padStart(2, "0");
  const detik = String(now.getSeconds()).padStart(2, "0");

  return `${jam}:${menit}:${detik}`;
}

async function cekSudahAbsenHariIni() {
  const tanggalHariIni = getTanggalHariIni();

  const { data, error } = await supabaseClient
    .from("absensi")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("tanggal", tanggalHariIni)
    .in("status", ["hadir", "terlambat"]);

  if (error) {
    console.error(error);
    return false;
  }

  return data && data.length > 0;
}

async function prosesAbsenSetelahValidasi() {
  if (!currentUser || !currentProfile) {
    showMessage("User belum terdeteksi. Silakan login ulang.");
    return;
  }

  if (!lokasiAbsenList || lokasiAbsenList.length === 0) {
    showMessage("Lokasi absen belum tersedia.");
    return;
  }

  const sudahAbsen = await cekSudahAbsenHariIni();

  if (sudahAbsen) {
    showMessage("Anda sudah melakukan absensi hadir hari ini.");
    showPopupError(
      "Sudah Absen",
      "Anda sudah melakukan absensi hadir hari ini.",
    );
    return;
  }

  showMessage("Wajah valid. Mengambil lokasi Anda...", "success");

  let position;

  try {
    position = await getCurrentPositionPromise();
  } catch (error) {
    console.error(error);
    showMessage("Gagal mengambil lokasi. Pastikan izin lokasi diaktifkan.");
    showPopupError("Lokasi Gagal", "Pastikan izin lokasi aktif pada browser.");
    return;
  }

  const latitudeUser = position.coords.latitude;
  const longitudeUser = position.coords.longitude;

  lokasiTerdekat = cariLokasiTerdekat(latitudeUser, longitudeUser);

  if (!lokasiTerdekat) {
    showMessage("Tidak ada titik lokasi absen yang tersedia.");
    showPopupError(
      "Lokasi Tidak Tersedia",
      "Admin belum mengatur titik lokasi absensi.",
    );
    return;
  }

  const jarak = lokasiTerdekat.jarak_meter;
  const lokasiValid = lokasiTerdekat.valid;

  latitudeUserEl.innerText = latitudeUser;
  longitudeUserEl.innerText = longitudeUser;
  jarakUserEl.innerText = `${jarak.toFixed(2)} meter`;
  statusLokasiEl.innerText = lokasiValid
    ? `Valid di ${lokasiTerdekat.nama_lokasi}`
    : `Tidak Valid. Titik terdekat: ${lokasiTerdekat.nama_lokasi}`;

  lokasiValidEl.innerText = `${lokasiTerdekat.nama_lokasi} (${lokasiTerdekat.latitude}, ${lokasiTerdekat.longitude})`;
  radiusValidEl.innerText = `${lokasiTerdekat.radius_meter} meter`;

  if (!lokasiValid) {
    showMessage(
      `Absensi gagal. Lokasi Anda berada di luar radius. Titik terdekat: ${lokasiTerdekat.nama_lokasi}, jarak Anda ${jarak.toFixed(2)} meter.`,
    );

    showPopupError(
      "Lokasi Tidak Valid",
      `Anda berada di luar radius lokasi ${lokasiTerdekat.nama_lokasi}. Jarak Anda ${jarak.toFixed(2)} meter dari titik tersebut.`,
    );

    return;
  }

  const tanggalHariIni = getTanggalHariIni();
  const waktuSekarang = getWaktuSekarang();
  const statusKehadiran = tentukanStatusKehadiran(waktuSekarang);

  let fotoAbsenUrl = "";

  try {
    showMessage("Mengambil foto bukti absensi...", "success");

    const fotoBlob = await ambilSnapshotAbsen();
    fotoAbsenUrl = await uploadFotoAbsen(fotoBlob);
  } catch (error) {
    console.error(error);

    showMessage("Gagal menyimpan foto bukti absen: " + error.message);

    showPopupError(
      "Foto Absen Gagal",
      "Sistem gagal mengambil atau menyimpan foto bukti absen. Silakan coba lagi.",
    );

    return;
  }

  const keteranganKehadiran =
    statusKehadiran === "terlambat"
      ? "Absensi terlambat melalui face scan, liveness detection, geolocation, dan titik lokasi terdekat"
      : "Absensi hadir melalui face scan, liveness detection, geolocation, dan titik lokasi terdekat";

  const { error } = await supabaseClient.from("absensi").insert({
    user_id: currentUser.id,
    tanggal: tanggalHariIni,
    waktu_masuk: waktuSekarang,
    latitude: latitudeUser,
    longitude: longitudeUser,
    lokasi_absen_id: lokasiTerdekat.id,
    nama_tempat: lokasiTerdekat.nama_lokasi,
    jarak_meter: jarak,
    status: statusKehadiran,
    keterangan: keteranganKehadiran,
    validasi_wajah: "valid",
    validasi_lokasi: "valid",
    foto_absen_url: fotoAbsenUrl,
  });

  if (error) {
    showMessage("Gagal menyimpan absensi: " + error.message);
    console.error(error);
    showPopupError("Absensi Gagal", "Data absensi gagal disimpan.");
    return;
  }

  showMessage("Absensi berhasil. Wajah valid dan lokasi valid.", "success");

  if (heroStatusText) {
    heroStatusText.innerText = "Absensi berhasil";
  }

  showPopupSuccess(
    statusKehadiran === "terlambat"
      ? "Absensi Terlambat Tersimpan"
      : "Absensi Berhasil",
    statusKehadiran === "terlambat"
      ? "Wajah dan lokasi valid, tetapi waktu absen melewati batas telat."
      : "Wajah, gerakan, dan lokasi valid. Kehadiran berhasil disimpan.",
  );
}

async function init() {
  await cekUser();
  await startCamera();
  await loadModelFaceApi();
  await loadLokasiAbsen();
  await loadPengaturanAbsen();
}

init();

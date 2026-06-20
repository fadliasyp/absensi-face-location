const video = document.getElementById("video");

let wajahTerdaftar = null;
let namaTerdaftar = "";

// Titik lokasi valid, contoh: lokasi kantor/sekolah
// Nanti latitude dan longitude ini kamu ganti sesuai lokasi asli
const lokasiValid = {
  latitude: -6.178306,
  longitude: 106.631889,
};

// Radius valid dalam meter
const radiusValid = 100;

// Load model face-api
startCamera();

Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri("./models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("./models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("./models"),
])
  .then(() => {
    console.log("Model face-api berhasil dimuat.");
  })
  .catch((err) => {
    console.error("Gagal load model:", err);
    document.getElementById("status").innerText =
      "Status: Kamera aktif, tetapi model face-api gagal dimuat.";
  });

// Menyalakan kamera
function startCamera() {
  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((stream) => {
      video.srcObject = stream;
    })
    .catch((err) => {
      console.error("Kamera gagal diakses:", err);
      alert("Kamera tidak bisa diakses. Izinkan akses kamera terlebih dahulu.");
    });
}

// Daftar wajah user
async function daftarWajah() {
  const nama = document.getElementById("namaUser").value.trim();

  if (!nama) {
    alert("Masukkan nama pengguna terlebih dahulu.");
    return;
  }

  const deteksi = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!deteksi) {
    alert("Wajah tidak terdeteksi. Pastikan wajah terlihat jelas.");
    return;
  }

  wajahTerdaftar = deteksi.descriptor;
  namaTerdaftar = nama;

  document.getElementById("wajah").innerText =
    "Validasi Wajah: Wajah berhasil didaftarkan untuk " + nama;

  alert("Wajah berhasil didaftarkan.");
}

// Proses absen
async function absenSekarang() {
  if (!wajahTerdaftar) {
    alert("Daftarkan wajah terlebih dahulu.");
    return;
  }

  document.getElementById("status").innerText = "Status: Memproses absensi...";

  const hasilWajah = await cekWajah();

  if (!hasilWajah.valid) {
    document.getElementById("status").innerText =
      "Status: Absensi tidak valid.";
    document.getElementById("wajah").innerText = "Validasi Wajah: Tidak cocok.";
    return;
  }

  cekLokasi((hasilLokasi) => {
    document.getElementById("lokasi").innerText =
      `Lokasi: ${hasilLokasi.latitude}, ${hasilLokasi.longitude}`;

    document.getElementById("jarak").innerText =
      `Jarak: ${hasilLokasi.jarak.toFixed(2)} meter`;

    document.getElementById("wajah").innerText =
      `Validasi Wajah: Cocok dengan ${namaTerdaftar}`;

    if (hasilLokasi.valid) {
      document.getElementById("status").innerText =
        "Status: Absensi VALID. Wajah cocok dan lokasi sesuai.";
    } else {
      document.getElementById("status").innerText =
        "Status: Absensi TIDAK VALID. Lokasi berada di luar radius.";
    }
  });
}

// Cek kecocokan wajah
async function cekWajah() {
  const deteksi = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!deteksi) {
    return {
      valid: false,
      distance: null,
    };
  }

  const distance = faceapi.euclideanDistance(
    wajahTerdaftar,
    deteksi.descriptor,
  );

  // Semakin kecil semakin mirip
  // Umumnya 0.4 - 0.6 masih bisa dianggap cocok
  const batasKemiripan = 0.5;

  return {
    valid: distance < batasKemiripan,
    distance: distance,
  };
}

// Ambil dan cek lokasi
function cekLokasi(callback) {
  if (!navigator.geolocation) {
    alert("Browser tidak mendukung geolocation.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitudeUser = position.coords.latitude;
      const longitudeUser = position.coords.longitude;

      const jarak = hitungJarakMeter(
        latitudeUser,
        longitudeUser,
        lokasiValid.latitude,
        lokasiValid.longitude,
      );

      callback({
        latitude: latitudeUser,
        longitude: longitudeUser,
        jarak: jarak,
        valid: jarak <= radiusValid,
      });
    },
    (error) => {
      console.error(error);
      alert("Lokasi gagal diambil. Izinkan akses lokasi terlebih dahulu.");
      document.getElementById("status").innerText =
        "Status: Absensi gagal karena lokasi tidak dapat diakses.";
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
  );
}

// Rumus Haversine untuk menghitung jarak dua titik koordinat
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

function derajatKeRadian(deg) {
  return deg * (Math.PI / 180);
}

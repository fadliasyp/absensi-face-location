const messageBox = document.getElementById("message");
const completeProfileForm = document.getElementById("completeProfileForm");

const namaLengkapInput = document.getElementById("nama_lengkap");
const nikInput = document.getElementById("nik");
const tanggalLahirInput = document.getElementById("tanggal_lahir");
const genderInput = document.getElementById("gender");
const bagianInput = document.getElementById("bagian");

let currentUser = null;
let currentProfile = null;

function showPopupSuccess(title, text) {
  if (window.Swal) {
    return Swal.fire({
      icon: "success",
      title,
      text,
      confirmButtonText: "Saya Mengerti",
      confirmButtonColor: "#2563eb",
      allowOutsideClick: false,
      allowEscapeKey: false,
    });
  }

  alert(title + "\n" + text);
  return Promise.resolve();
}
function showMessage(text, type = "error") {
  if (!messageBox) return;

  messageBox.innerHTML = `
    <div class="alert ${type === "success" ? "alert-success" : "alert-error"}">
      ${text}
    </div>
  `;
}

async function cekUserGooglePending() {
  const { data: authData, error: authError } =
    await supabaseClient.auth.getUser();

  if (authError || !authData.user) {
    window.location.href = "login.html";
    return null;
  }

  currentUser = authData.user;

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (profileError || !profile) {
    showMessage("Data profil tidak ditemukan. Silakan login ulang.");
    await supabaseClient.auth.signOut();

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1600);

    return null;
  }

  currentProfile = profile;

  if (profile.status_akun === "aktif") {
    if (profile.role === "admin") {
      window.location.href = "admin/dashboard.html";
      return null;
    }

    window.location.href = "user/dashboard.html";
    return null;
  }

  namaLengkapInput.value =
    profile.nama_lengkap ||
    currentUser.user_metadata?.full_name ||
    currentUser.user_metadata?.name ||
    "";

  nikInput.value = profile.nik || "";
  tanggalLahirInput.value = profile.tanggal_lahir || "";
  genderInput.value = profile.gender || "";
  bagianInput.value = profile.bagian || "";

  return profile;
}

function validasiForm() {
  const nama_lengkap = namaLengkapInput.value.trim();
  const nik = nikInput.value.trim();
  const tanggal_lahir = tanggalLahirInput.value;
  const gender = genderInput.value;
  const bagian = bagianInput.value.trim();

  if (!nama_lengkap || !nik || !tanggal_lahir || !gender || !bagian) {
    showMessage("Semua data wajib diisi.");
    return null;
  }

  if (nik.length < 8) {
    showMessage("NIK terlalu pendek. Periksa kembali NIK Anda.");
    return null;
  }

  return {
    nama_lengkap,
    nik,
    tanggal_lahir,
    gender,
    bagian,
  };
}

if (completeProfileForm) {
  completeProfileForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!currentUser || !currentProfile) {
      await cekUserGooglePending();
    }

    const formData = validasiForm();
    if (!formData) return;

    const submitButton = completeProfileForm.querySelector(
      "button[type='submit']",
    );

    submitButton.disabled = true;
    submitButton.innerText = "Menyimpan...";

    const { error } = await supabaseClient
      .from("profiles")
      .update({
        nama_lengkap: formData.nama_lengkap,
        nik: formData.nik,
        tanggal_lahir: formData.tanggal_lahir,
        gender: formData.gender,
        bagian: formData.bagian,
        status_akun: "pending",
        role: "user",
      })
      .eq("id", currentUser.id);

    if (error) {
      console.error(error);
      showMessage("Gagal menyimpan profil: " + error.message);
      submitButton.disabled = false;
      submitButton.innerText = "Simpan Profil";
      return;
    }

    showMessage(
      "Profil berhasil disimpan. Silakan tunggu persetujuan admin.",
      "success",
    );

    await showPopupSuccess(
      "Profil Berhasil Dilengkapi",
      "Data profil Anda berhasil disimpan. Akun Anda belum dapat digunakan sampai admin menyetujui dan mengaktifkan akun Anda.",
    );

    await supabaseClient.auth.signOut();

    window.location.href = "login.html?status=pending";
  });
}

cekUserGooglePending();

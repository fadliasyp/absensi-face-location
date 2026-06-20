// REGISTER USER
const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const submitButton = registerForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.innerText = "Memproses...";

    showMessage("Memproses register...", "success");

    const nama_lengkap = document.getElementById("nama_lengkap").value.trim();
    const nik = document.getElementById("nik").value.trim();
    const tanggal_lahir = document.getElementById("tanggal_lahir").value;
    const gender = document.getElementById("gender").value;
    const bagian = document.getElementById("bagian").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (
      !nama_lengkap ||
      !nik ||
      !tanggal_lahir ||
      !gender ||
      !bagian ||
      !email ||
      !password
    ) {
      showMessage("Semua data wajib diisi.");
      submitButton.disabled = false;
      submitButton.innerText = "Register";
      return;
    }

    const { data: signUpData, error: signUpError } =
      await supabaseClient.auth.signUp({
        email: email,
        password: password,
      });

    if (signUpError) {
      showMessage("Gagal register auth: " + signUpError.message);
      submitButton.disabled = false;
      submitButton.innerText = "Register";
      return;
    }

    const user = signUpData.user;

    const { error: profileError } = await supabaseClient
      .from("profiles")
      .insert({
        id: user.id,
        nama_lengkap,
        nik,
        tanggal_lahir,
        gender,
        bagian,
        email,
        role: "user",
        status_akun: "pending",
      });

    if (profileError) {
      showMessage("Gagal menyimpan profil: " + profileError.message);
      submitButton.disabled = false;
      submitButton.innerText = "Register";
      return;
    }

    showMessage(
      "Register berhasil. Akun Anda menunggu persetujuan admin.",
      "success",
    );

    setTimeout(() => {
      window.location.href = "login.html";
    }, 2500);
  });
}

const messageBox = document.getElementById("message");

function showPopupSuccess(title, text, callback = null) {
  if (window.Swal) {
    Swal.fire({
      icon: "success",
      title,
      text,
      confirmButtonText: "Oke",
      confirmButtonColor: "#315aa8",
    }).then(() => {
      if (callback) callback();
    });
  } else {
    alert(title + "\n" + text);
    if (callback) callback();
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

function showPopupInfo(title, text, callback = null) {
  if (window.Swal) {
    Swal.fire({
      icon: "info",
      title,
      text,
      confirmButtonText: "Oke",
      confirmButtonColor: "#315aa8",
    }).then(() => {
      if (callback) callback();
    });
  } else {
    alert(title + "\n" + text);
    if (callback) callback();
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

if (registerForm) {
  registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const nama_lengkap = document.getElementById("nama_lengkap").value.trim();
    const nik = document.getElementById("nik").value.trim();
    const tanggal_lahir = document.getElementById("tanggal_lahir").value;
    const gender = document.getElementById("gender").value;
    const bagian = document.getElementById("bagian").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (
      !nama_lengkap ||
      !nik ||
      !tanggal_lahir ||
      !gender ||
      !bagian ||
      !email ||
      !password
    ) {
      showPopupError("Register Gagal", "Semua data wajib diisi.");
      return;
    }

    if (password.length < 6) {
      showPopupError(
        "Password Terlalu Pendek",
        "Password minimal terdiri dari 6 karakter.",
      );
      return;
    }

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
    });

    if (error) {
      const errorMessage = error.message?.toLowerCase() || "";

      let pesan = "Register gagal. Silakan coba lagi.";

      if (errorMessage.includes("user already registered")) {
        pesan = "Email sudah terdaftar. Silakan login atau gunakan email lain.";
      } else if (errorMessage.includes("password")) {
        pesan =
          "Password tidak sesuai ketentuan. Gunakan password minimal 6 karakter.";
      } else if (errorMessage.includes("email")) {
        pesan = "Format email tidak valid. Periksa kembali email Anda.";
      } else if (errorMessage.includes("too many requests")) {
        pesan =
          "Terlalu banyak percobaan register. Tunggu beberapa saat lalu coba lagi.";
      }

      showPopupError("Register Gagal", pesan);
      return;
    }

    const user = data.user;

    if (!user) {
      showPopupError(
        "Register Gagal",
        "Akun belum berhasil dibuat. Silakan coba lagi.",
      );
      return;
    }

    const { error: profileError } = await supabaseClient
      .from("profiles")
      .insert({
        id: user.id,
        nama_lengkap,
        nik,
        tanggal_lahir,
        gender,
        bagian,
        email,
        role: "user",
        status_akun: "pending",
      });

    if (profileError) {
      showPopupError(
        "Register Gagal",
        "Akun auth berhasil dibuat, tetapi data profil gagal disimpan: " +
          profileError.message,
      );
      return;
    }

    showPopupSuccess(
      "Register Berhasil",
      "Akun Anda berhasil didaftarkan dan sedang menunggu persetujuan admin.",
      () => {
        window.location.href = "login.html";
      },
    );
  });
}

// LOGIN USER / ADMIN
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("login_email").value.trim();
    const password = document.getElementById("login_password").value;

    if (!email || !password) {
      showPopupError("Login Gagal", "Email dan password wajib diisi.");
      return;
    }

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const errorMessage = error.message?.toLowerCase() || "";

      let pesan = "Login gagal. Silakan coba lagi.";

      if (errorMessage.includes("invalid login credentials")) {
        pesan = "Email atau password salah. Periksa kembali data login Anda.";
      } else if (errorMessage.includes("email not confirmed")) {
        pesan =
          "Email belum dikonfirmasi. Silakan cek email Anda terlebih dahulu.";
      } else if (errorMessage.includes("too many requests")) {
        pesan =
          "Terlalu banyak percobaan login. Tunggu beberapa saat lalu coba lagi.";
      }

      showPopupError("Login Gagal", pesan);
      return;
    }

    const user = data.user;

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      await supabaseClient.auth.signOut();

      showPopupError(
        "Login Gagal",
        "Data profil akun tidak ditemukan. Silakan hubungi admin.",
      );
      return;
    }

    if (profile.status_akun !== "aktif") {
      await supabaseClient.auth.signOut();

      showPopupInfo(
        "Akun Belum Aktif",
        "Akun Anda masih menunggu persetujuan admin. Silakan tunggu sampai admin mengaktifkan akun Anda.",
      );
      return;
    }

    showPopupSuccess(
      "Login Berhasil",
      "Selamat datang, " + (profile.nama_lengkap || "User") + ".",
      () => {
        if (profile.role === "admin") {
          window.location.href = "admin/dashboard.html";
        } else {
          window.location.href = "user/dashboard.html";
        }
      },
    );
  });
}

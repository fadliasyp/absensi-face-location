const userTableBody = document.getElementById("userTableBody");
const userCardList = document.getElementById("userCardList");
const messageBox = document.getElementById("message");
const filterStatusInput = document.getElementById("filterStatus");

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
  return value ? String(value) : "-";
}

function escapeQuotes(text) {
  return String(text ?? "-").replace(/'/g, "\\'");
}

function badgeRole(role) {
  if (role === "admin") {
    return `<span class="badge badge-admin">Admin</span>`;
  }

  return `<span class="badge badge-user">User</span>`;
}

function badgeStatus(status) {
  if (status === "aktif") {
    return `<span class="badge badge-aktif">Aktif</span>`;
  }

  if (status === "pending") {
    return `<span class="badge badge-pending">Menunggu Persetujuan</span>`;
  }

  return `<span class="badge badge-ditolak">Ditolak</span>`;
}

function roleSelect(user, mode) {
  return `
    <select id="role-${mode}-${user.id}" class="small-select">
      <option value="user" ${user.role === "user" ? "selected" : ""}>user</option>
      <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
    </select>
  `;
}

function statusSelect(user, mode) {
  return `
    <select id="status-${mode}-${user.id}" class="small-select">
      <option value="aktif" ${user.status_akun === "aktif" ? "selected" : ""}>aktif</option>
      <option value="pending" ${user.status_akun === "pending" ? "selected" : ""}>pending</option>
      <option value="ditolak" ${user.status_akun === "ditolak" ? "selected" : ""}>ditolak</option>
    </select>
  `;
}

async function loadUsers() {
  const adminProfile = await cekAdmin();

  if (!adminProfile) return;

  let query = supabaseClient
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  const filterStatus = filterStatusInput ? filterStatusInput.value : "";

  if (filterStatus) {
    query = query.eq("status_akun", filterStatus);
  }

  const { data: users, error } = await query;

  if (error) {
    const errorHtml = `Gagal memuat data user: ${error.message}`;

    if (userTableBody) {
      userTableBody.innerHTML = `
        <tr>
          <td colspan="8">${errorHtml}</td>
        </tr>
      `;
    }

    if (userCardList) {
      userCardList.innerHTML = `<div class="empty-card">${errorHtml}</div>`;
    }

    return;
  }

  if (!users || users.length === 0) {
    if (userTableBody) {
      userTableBody.innerHTML = `
        <tr>
          <td colspan="8">Belum ada data user.</td>
        </tr>
      `;
    }

    if (userCardList) {
      userCardList.innerHTML = `<div class="empty-card">Belum ada data user.</div>`;
    }

    return;
  }

  renderDesktopTable(users);
  renderMobileCards(users);
}

async function resetWajahUser(userId, namaUser) {
  const yakin = confirm(
    `Reset data wajah user "${namaUser}"?\n\nSetelah direset, user dapat mendaftarkan wajah ulang.`,
  );

  if (!yakin) return;

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      face_descriptor: null,
      foto_wajah_url: null,
    })
    .eq("id", userId);

  if (error) {
    showMessage("Gagal reset wajah user: " + error.message);
    return;
  }

  showMessage("Data wajah user berhasil direset.", "success");
  loadUsers();
}

function renderDesktopTable(users) {
  if (!userTableBody) return;

  userTableBody.innerHTML = users
    .map((user) => {
      return `
      <tr>
        <td>${safeText(user.nama_lengkap)}</td>
        <td>${safeText(user.nik)}</td>
        <td>${safeText(user.gender)}</td>
        <td>${safeText(user.bagian)}</td>
        <td>${safeText(user.email)}</td>

        <td>
          <div class="cell-stack">
            ${badgeRole(user.role)}
           ${roleSelect(user, "desktop")}
          </div>
        </td>

        <td>
          <div class="cell-stack">
            ${badgeStatus(user.status_akun)}
           ${statusSelect(user, "desktop")}
          </div>
        </td>

        <td>
         <div class="action-stack">
  <button onclick="updateUser('${user.id}', 'desktop')">Simpan</button>

  ${
    user.status_akun === "pending"
      ? `<button onclick="aktifkanUser('${user.id}')" class="secondary">Aktifkan</button>`
      : ""
  }

 <button onclick="resetWajahUser('${user.id}', '${escapeQuotes(user.nama_lengkap)}')" class="secondary">
  Reset Wajah
</button>

<button onclick="hapusUser('${user.id}', '${escapeQuotes(user.nama_lengkap)}')" class="danger">
  Hapus
</button>
</div>
        </td>
      </tr>
    `;
    })
    .join("");
}

function renderMobileCards(users) {
  if (!userCardList) return;

  userCardList.innerHTML = users
    .map((user) => {
      return `
      <div class="user-mobile-card">
        <div class="user-mobile-header">
          <div>
            <h3>${safeText(user.nama_lengkap)}</h3>
            <p>${safeText(user.bagian)}</p>
          </div>

          <div class="user-mobile-badges">
            ${badgeRole(user.role)}
            ${badgeStatus(user.status_akun)}
          </div>
        </div>

        <div class="user-face-preview">
  ${
    user.foto_wajah_url
      ? `<img src="${user.foto_wajah_url}" alt="Foto wajah user">`
      : `<div class="no-face-photo">Belum ada foto wajah</div>`
  }
</div>

        <div class="user-mobile-info">
        
          <div>
            <span>NIK</span>
            <strong>${safeText(user.nik)}</strong>
          </div>

          <div>
            <span>Gender</span>
            <strong>${safeText(user.gender)}</strong>
          </div>

          <div>
            <span>Email</span>
            <strong>${safeText(user.email)}</strong>
          </div>
          
<div>
  <span>Status Wajah</span>
  <strong>${user.face_descriptor ? "Sudah terdaftar" : "Belum terdaftar"}</strong>
</div>

        </div>

        <div class="mobile-form-row">
          <label>Role</label>
          ${roleSelect(user, "mobile")}
        </div>

        <div class="mobile-form-row">
          <label>Status Akun</label>
          ${statusSelect(user, "mobile")}
        </div>

        <div class="mobile-action-row">
  <button onclick="updateUser('${user.id}', 'mobile')">Simpan Perubahan</button>

  ${
    user.status_akun === "pending"
      ? `<button onclick="aktifkanUser('${user.id}')" class="secondary">Aktifkan User</button>`
      : ""
  }
 <button onclick="resetWajahUser('${user.id}', '${escapeQuotes(user.nama_lengkap)}')" class="secondary">
  Reset Wajah
</button>

<button onclick="hapusUser('${user.id}', '${escapeQuotes(user.nama_lengkap)}')" class="danger">
  Hapus
</button>
</div>
      </div>
    `;
    })
    .join("");
}

async function updateUser(userId, mode) {
  const roleEl = document.getElementById(`role-${mode}-${userId}`);
  const statusEl = document.getElementById(`status-${mode}-${userId}`);

  if (!roleEl || !statusEl) {
    showMessage(
      "Komponen role/status tidak ditemukan. Refresh halaman lalu coba lagi.",
    );
    return;
  }

  const newRole = roleEl.value;
  const newStatus = statusEl.value;

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      role: newRole,
      status_akun: newStatus,
    })
    .eq("id", userId);

  if (error) {
    showMessage("Gagal update user: " + error.message);
    return;
  }

  showMessage("Data user berhasil diperbarui.", "success");
  loadUsers();
}

async function aktifkanUser(userId) {
  const yakin = confirm("Aktifkan akun user ini dan kirim notifikasi email?");

  if (!yakin) return;

  const { data: userData, error: getError } = await supabaseClient
    .from("profiles")
    .select("id, nama_lengkap, email")
    .eq("id", userId)
    .single();

  if (getError || !userData) {
    showMessage("Gagal mengambil data user: " + (getError?.message || ""));
    return;
  }

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      status_akun: "aktif",
      role: "user",
    })
    .eq("id", userId);

  if (error) {
    showMessage("Gagal mengaktifkan user: " + error.message);
    return;
  }

  const { error: emailError } = await supabaseClient.functions.invoke(
    "send-approval-email",
    {
      body: {
        email: userData.email,
        nama_lengkap: userData.nama_lengkap,
      },
    },
  );

  if (emailError) {
    showMessage(
      "User berhasil diaktifkan, tetapi email gagal dikirim: " +
        emailError.message,
    );
    loadUsers();
    return;
  }

  showMessage(
    "User berhasil diaktifkan dan notifikasi email sudah dikirim.",
    "success",
  );
  loadUsers();
}

async function hapusUser(userId, namaUser) {
  const yakin = confirm(
    `Yakin ingin menghapus user "${namaUser}"?\n\nData user akan dihapus dari Authentication dan profiles.`,
  );

  if (!yakin) return;

  const { data: authData, error: authError } =
    await supabaseClient.auth.getUser();

  if (authError || !authData.user) {
    showMessage("Sesi login tidak valid. Silakan login ulang.");
    return;
  }

  if (authData.user.id === userId) {
    showMessage(
      "Admin tidak boleh menghapus akun yang sedang digunakan untuk login.",
    );
    return;
  }

  const { error } = await supabaseClient.functions.invoke("delete-user", {
    body: {
      user_id: userId,
    },
  });

  if (error) {
    showMessage("Gagal menghapus user: " + error.message);
    return;
  }

  showMessage(
    "User berhasil dihapus dari Authentication dan data sistem.",
    "success",
  );
  loadUsers();
}

loadUsers();

function getAuthenticatedDestination(profile) {
  if (profile.role === "admin") return "/admin/dashboard.html";

  const wajahTerdaftar =
    Boolean(profile.face_descriptor) && Boolean(profile.foto_wajah_url);

  return wajahTerdaftar
    ? "/user/verifikasi.html"
    : "/user/dashboard.html";
}

async function redirectRememberedSession() {
  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError || !user) return;

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("role, status_akun, face_descriptor, foto_wajah_url")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.status_akun !== "aktif") {
    await supabaseClient.auth.signOut({ scope: "local" });
    return;
  }

  window.location.replace(getAuthenticatedDestination(profile));
}

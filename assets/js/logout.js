async function logout() {
  await supabaseClient.auth.signOut({ scope: "local" });
  window.location.replace("../login.html");
}

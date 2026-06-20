async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "../login.html";
}

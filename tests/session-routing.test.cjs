const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = {};
vm.runInNewContext(
  fs.readFileSync("assets/js/session-routing.js", "utf8"),
  context,
);

assert.equal(
  context.getAuthenticatedDestination({ role: "admin" }),
  "/admin/dashboard.html",
);
assert.equal(
  context.getAuthenticatedDestination({
    role: "user",
    face_descriptor: [1],
    foto_wajah_url: "https://example.com/wajah.jpg",
  }),
  "/user/verifikasi.html",
);
assert.equal(
  context.getAuthenticatedDestination({
    role: "user",
    face_descriptor: null,
    foto_wajah_url: null,
  }),
  "/user/dashboard.html",
);

(async () => {
  let redirectedTo = "";
  let signOutScope = "";

  context.window = {
    location: {
      replace(destination) {
        redirectedTo = destination;
      },
    },
  };
  context.supabaseClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
      signOut: async ({ scope }) => {
        signOutScope = scope;
      },
    },
    from: () => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      single: async () => ({
        data: {
          role: "user",
          status_akun: "aktif",
          face_descriptor: [1],
          foto_wajah_url: "https://example.com/wajah.jpg",
        },
        error: null,
      }),
    }),
  };

  await context.redirectRememberedSession();
  assert.equal(redirectedTo, "/user/verifikasi.html");

  redirectedTo = "";
  context.supabaseClient.from = () => ({
    select() {
      return this;
    },
    eq() {
      return this;
    },
    single: async () => ({
      data: { role: "user", status_akun: "pending" },
      error: null,
    }),
  });

  await context.redirectRememberedSession();
  assert.equal(redirectedTo, "");
  assert.equal(signOutScope, "local");

  console.log("Session routing: OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

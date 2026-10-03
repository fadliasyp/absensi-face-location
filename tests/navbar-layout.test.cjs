const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(
  path.join(root, "assets", "css", "style.css"),
  "utf8",
);

function getBalancedBlock(source, marker) {
  const markerIndex = source.indexOf(marker);
  assert.notEqual(markerIndex, -1, `CSS harus memiliki ${marker}`);

  const openingBrace = source.indexOf("{", markerIndex);
  assert.notEqual(openingBrace, -1, `${marker} harus memiliki blok CSS`);

  let depth = 0;

  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;

    if (depth === 0) {
      return source.slice(openingBrace + 1, index);
    }
  }

  assert.fail(`Blok CSS ${marker} tidak ditutup`);
}

const compactDesktop = getBalancedBlock(
  css,
  "@media (min-width: 901px) and (max-width: 1280px)",
);

assert.match(
  compactDesktop,
  /\.desktop-navbar-menu,\s*\.desktop-admin-menu\s*{\s*display:\s*none;/,
  "menu horizontal admin dan peserta harus disembunyikan pada laptop sempit",
);
assert.match(
  compactDesktop,
  /\.hamburger-btn,\s*\.admin-hamburger-btn\s*{\s*display:\s*inline-flex;/,
  "hamburger admin dan peserta harus tersedia saat menu horizontal disembunyikan",
);
assert.match(
  compactDesktop,
  /\.navbar-brand-user,\s*\.admin-navbar-brand\s*{[\s\S]*?min-width:\s*0;[\s\S]*?flex:\s*1;/,
  "brand navbar harus dapat menyusut agar aksi akun tidak keluar viewport",
);

const wideDesktop = getBalancedBlock(css, "@media (min-width: 1281px)");

assert.match(
  wideDesktop,
  /\.desktop-admin-menu a\s*{[\s\S]*?padding:\s*10px 8px;[\s\S]*?font-size:\s*12px;/,
  "menu admin desktop lebar harus cukup ringkas untuk navbar maksimum 1280px",
);
assert.match(
  wideDesktop,
  /\.admin-navbar-brand\s*{\s*min-width:\s*180px;/,
  "brand admin desktop lebar tidak boleh mendorong aksi akun keluar viewport",
);

console.log("Navbar layout contract: OK");

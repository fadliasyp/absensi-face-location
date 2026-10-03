const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pageDirectories = ["admin", "user"];
const staticAssets = new Set();
const gifReferences = [];

for (const directory of pageDirectories) {
  const directoryPath = path.join(root, directory);
  const pages = fs
    .readdirSync(directoryPath)
    .filter((file) => file.endsWith(".html"));

  for (const page of pages) {
    const pagePath = path.join(directoryPath, page);
    const html = fs.readFileSync(pagePath, "utf8");
    const assetReferences = [
      ...html.matchAll(/\b(?:src|href)=(["'])(.*?)\1/g),
    ].map((match) => match[2].split("?")[0]);

    for (const reference of assetReferences) {
      if (/\.gif$/i.test(reference)) {
        gifReferences.push(
          `${path.relative(root, pagePath)} -> ${reference}`,
        );
      }

      if (/-static\.png$/i.test(reference)) {
        staticAssets.add(path.resolve(path.dirname(pagePath), reference));
      }
    }
  }
}

assert.deepEqual(
  gifReferences,
  [],
  `Halaman admin/user tidak boleh memuat GIF looping:\n${gifReferences.join("\n")}`,
);

assert.equal(
  staticAssets.size,
  10,
  "Sepuluh ikon konten statis harus tetap direferensikan.",
);

for (const assetPath of staticAssets) {
  assert.ok(
    fs.existsSync(assetPath),
    `Aset ikon tidak ditemukan: ${path.relative(root, assetPath)}`,
  );

  const png = fs.readFileSync(assetPath);

  assert.equal(
    png.subarray(1, 4).toString("ascii"),
    "PNG",
    `Aset bukan PNG valid: ${path.relative(root, assetPath)}`,
  );
  assert.equal(
    png.readUInt32BE(16),
    192,
    `Lebar ikon harus 192px: ${path.relative(root, assetPath)}`,
  );
  assert.equal(
    png.readUInt32BE(20),
    192,
    `Tinggi ikon harus 192px: ${path.relative(root, assetPath)}`,
  );
  assert.equal(
    png[25],
    6,
    `Ikon harus memakai PNG RGBA transparan: ${path.relative(root, assetPath)}`,
  );
  assert.ok(
    png.length < 100 * 1024,
    `Ukuran ikon harus di bawah 100KB: ${path.relative(root, assetPath)}`,
  );
}

console.log("Icon performance contract: OK");

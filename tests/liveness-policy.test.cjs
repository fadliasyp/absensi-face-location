const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const enginePath = path.join(root, "assets", "js", "liveness-engine.js");
const verificationPath = path.join(
  root,
  "assets",
  "js",
  "user-verifikasi.js",
);
const verificationPagePath = path.join(root, "user", "verifikasi.html");
const faceGuidePath = path.join(
  root,
  "assets",
  "js",
  "mediapipe-face-guide.js",
);

assert.ok(
  fs.existsSync(enginePath),
  "Engine liveness teruji harus tersedia sebagai modul terpisah.",
);

const {
  ACTIONS,
  DEFAULT_CONFIG,
  createLivenessSession,
  createRandomChallenge,
  createRandomSequence,
} = require(enginePath);

assert.deepEqual(
  createRandomSequence(() => 0.5),
  [ACTIONS.TURN_RIGHT, ACTIONS.BLINK, ACTIONS.TURN_RIGHT],
  "Tiga langkah acak harus boleh mengulang gerakan sambil tetap memuat minimal satu kedipan.",
);

for (const randomValue of [0, 0.2, 0.34, 0.5, 0.67, 0.999]) {
  const sequence = createRandomSequence(() => randomValue);

  assert.equal(sequence.length, 3, "Setiap challenge harus memiliki tiga langkah.");
  assert.ok(
    sequence.includes(ACTIONS.BLINK),
    "Setiap hasil acak harus tetap memiliki minimal satu langkah kedip.",
  );
  assert.ok(
    sequence.every((action) => Object.values(ACTIONS).includes(action)),
    "Generator hanya boleh menghasilkan gerakan liveness yang dikenal.",
  );
}

{
  const challenge = createRandomChallenge(() => 0.999);

  assert.equal(
    challenge.sequence.length,
    3,
    "Challenge acak harus tetap memiliki tiga langkah.",
  );
  assert.ok(
    challenge.sequence.includes(ACTIONS.BLINK),
    "Challenge acak harus tetap memiliki minimal satu langkah kedip untuk menolak foto diam.",
  );
  assert.equal(
    Object.hasOwn(challenge, "blinkTarget"),
    false,
    "Challenge tidak lagi memerlukan target kedip variabel karena setiap langkah selalu satu kedipan.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    blinkTarget: 2,
  });

  assert.equal(
    session.getState().blinkTarget,
    1,
    "Engine harus mengunci satu kedipan per langkah meskipun caller lama mengirim target dua.",
  );
}

assert.equal(
  DEFAULT_CONFIG.calibrationFrames,
  1,
  "Baseline produksi harus diambil dari satu frame valid tanpa tahap menstabilkan wajah.",
);
assert.equal(
  DEFAULT_CONFIG.neutralFrames,
  0,
  "Challenge produksi harus langsung menuju jeda instruksi setelah baseline terbaca.",
);
assert.ok(
  DEFAULT_CONFIG.turnFrames === 2 &&
    DEFAULT_CONFIG.turnSupportRatio >= 0.6 &&
    DEFAULT_CONFIG.minPromptDelayMs >= 600 &&
    DEFAULT_CONFIG.maxActionMs <= 7000,
  "Gerakan cepat harus memakai dua frame searah dan jeda acak anti-replay tetap dipertahankan.",
);

const testConfig = {
  calibrationFrames: 5,
  neutralFrames: 2,
  returnNeutralFrames: 2,
  turnFrames: 2,
  blinkReopenFrames: 2,
  maxChallengeMs: 30000,
  maxActionMs: 8000,
  maxMissingFaceMs: 900,
  minPromptDelayMs: 0,
  maxPromptDelayMs: 0,
  wrongActionFrames: 2,
};

function frame(timestamp, overrides = {}) {
  return {
    timestamp,
    faceCount: 1,
    yaw: 0.002,
    leftEAR: 0.3,
    rightEAR: 0.3,
    ...overrides,
  };
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.TURN_RIGHT],
    promptDelayRandom: () => 0,
    config: {
      minPromptDelayMs: 500,
      maxPromptDelayMs: 500,
    },
  });

  assert.doesNotMatch(
    session.getState().message,
    /kalibrasi|menstabilkan/i,
    "UI produksi tidak boleh lagi meminta proses stabilisasi wajah.",
  );

  session.ingest(frame(0));

  assert.equal(
    session.getState().phase,
    "prompt_delay",
    "Satu frame wajah valid harus langsung memulai jeda challenge.",
  );
}

function prepareAction(session, startAt = 0, overrides = {}) {
  let timestamp = startAt;

  for (let index = 0; index < testConfig.calibrationFrames; index += 1) {
    session.ingest(frame(timestamp, overrides));
    timestamp += 150;
  }

  for (let index = 0; index < testConfig.neutralFrames; index += 1) {
    session.ingest(frame(timestamp, overrides));
    timestamp += 150;
  }

  assert.equal(session.getState().phase, "action");
  return timestamp;
}

{
  const rightSession = createLivenessSession({
    sequence: [ACTIONS.TURN_RIGHT],
    config: testConfig,
  });
  prepareAction(rightSession);
  assert.match(
    rightSession.getState().message,
    /kanan\s*➡️/u,
    "Instruksi tengok kanan harus menampilkan panah kanan langsung pada teks.",
  );

  const leftSession = createLivenessSession({
    sequence: [ACTIONS.TURN_LEFT],
    config: testConfig,
  });
  prepareAction(leftSession);
  assert.match(
    leftSession.getState().message,
    /kiri\s*⬅️/u,
    "Instruksi tengok kiri harus menampilkan panah kiri langsung pada teks.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  const timestamp = prepareAction(session);

  session.ingest(
    frame(timestamp, {
      blinkLeft: 0.08,
      blinkRight: 0.09,
      blinkPeakLeft: 0.62,
      blinkPeakRight: 0.64,
      blinkPeakTimestamp: timestamp - 70,
    }),
  );

  assert.equal(
    session.getState().phase,
    "return_neutral",
    "Kedipan cepat yang sempat tertangkap MediaPipe lalu terbuka kembali harus tetap terbaca.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  const timestamp = prepareAction(session);

  session.ingest(
    frame(timestamp, {
      blinkLeft: 0.08,
      blinkRight: 0.09,
      blinkPeakLeft: 0.62,
      blinkPeakRight: 0.2,
      blinkPeakTimestamp: timestamp - 70,
    }),
  );

  assert.equal(
    session.getState().phase,
    "action",
    "Puncak yang hanya menutup satu mata tidak boleh dianggap sebagai kedipan valid.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  const timestamp = prepareAction(session);

  session.ingest(
    frame(timestamp, {
      blinkLeft: 0.08,
      blinkRight: 0.09,
      blinkPeakLeft: 0.62,
      blinkPeakRight: 0.64,
      blinkPeakTimestamp: timestamp - 1500,
    }),
  );

  assert.equal(
    session.getState().phase,
    "action",
    "Puncak kedip yang melewati durasi maksimum tidak boleh diterima.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.TURN_RIGHT],
    promptDelayRandom: () => 0,
    config: {
      ...testConfig,
      minPromptDelayMs: 500,
      maxPromptDelayMs: 500,
    },
  });
  let timestamp = 0;

  for (let index = 0; index < testConfig.calibrationFrames; index += 1) {
    session.ingest(frame(timestamp));
    timestamp += 150;
  }

  for (let index = 0; index < testConfig.neutralFrames; index += 1) {
    session.ingest(frame(timestamp));
    timestamp += 150;
  }

  assert.equal(
    session.getState().phase,
    "prompt_delay",
    "Challenge harus menunggu jeda sebelum menampilkan instruksi gerakan.",
  );

  session.ingest(frame(timestamp, { yaw: -0.09 }));
  timestamp += 150;
  session.ingest(frame(timestamp));
  timestamp += 350;
  session.ingest(frame(timestamp));

  assert.equal(session.getState().phase, "action");
  assert.equal(
    session.getState().actionIndex,
    0,
    "Gerakan sebelum prompt tidak boleh memenuhi challenge.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(frame(timestamp, { leftEAR: 0.1, rightEAR: 0.1 }));
  timestamp += 35;
  session.ingest(frame(timestamp));
  timestamp += 35;
  session.ingest(frame(timestamp));
  timestamp += 35;
  session.ingest(frame(timestamp));
  timestamp += 35;
  session.ingest(frame(timestamp));

  assert.equal(
    session.getState().complete,
    true,
    "Kedipan normal yang cepat harus dikenali dari transisi tutup-buka kedua mata.",
  );
}

{
  const mediaPipeOpen = { blinkLeft: 0.08, blinkRight: 0.09 };
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  let timestamp = prepareAction(session, 0, mediaPipeOpen);

  session.ingest(
    frame(timestamp, {
      ...mediaPipeOpen,
      leftEAR: 0.1,
      rightEAR: 0.1,
    }),
  );
  timestamp += 35;
  session.ingest(frame(timestamp, mediaPipeOpen));
  timestamp += 35;
  session.ingest(frame(timestamp, mediaPipeOpen));
  timestamp += 35;
  session.ingest(frame(timestamp, mediaPipeOpen));
  timestamp += 35;
  session.ingest(frame(timestamp, mediaPipeOpen));

  assert.equal(
    session.getState().complete,
    true,
    "EAR harus tetap dapat menangkap kedipan cepat saat sampel MediaPipe masih menunjukkan mata terbuka.",
  );
}

{
  const mediaPipeOpen = { blinkLeft: 0.08, blinkRight: 0.09 };
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  let timestamp = prepareAction(session, 0, mediaPipeOpen);

  session.ingest(
    frame(timestamp, {
      ...mediaPipeOpen,
      blinkLeft: 0.55,
      blinkRight: 0.56,
    }),
  );
  timestamp += 35;
  session.ingest(frame(timestamp, mediaPipeOpen));
  timestamp += 35;
  session.ingest(frame(timestamp, mediaPipeOpen));
  timestamp += 35;
  session.ingest(frame(timestamp, mediaPipeOpen));
  timestamp += 35;
  session.ingest(frame(timestamp, mediaPipeOpen));

  assert.equal(
    session.getState().complete,
    true,
    "Kedipan cepat dari blendshape MediaPipe harus dikenali tanpa memerlukan mata tertutup lama.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(frame(timestamp, { leftEAR: 0.1, rightEAR: 0.3 }));
  timestamp += 35;
  session.ingest(frame(timestamp));
  timestamp += 35;
  session.ingest(frame(timestamp));

  assert.equal(
    session.getState().complete,
    false,
    "Satu mata tertutup tidak boleh dianggap sebagai kedipan valid.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.TURN_RIGHT],
    promptDelayRandom: () => 0,
    config: {
      ...testConfig,
      minPromptDelayMs: 500,
      maxPromptDelayMs: 500,
    },
  });
  let timestamp = 0;

  for (let index = 0; index < testConfig.calibrationFrames; index += 1) {
    session.ingest(frame(timestamp));
    timestamp += 150;
  }

  for (let index = 0; index < testConfig.neutralFrames; index += 1) {
    session.ingest(frame(timestamp));
    timestamp += 150;
  }

  session.ingest(frame(timestamp, { yaw: 0.09 }));
  timestamp += 150;
  session.ingest(frame(timestamp, { yaw: 0.09 }));

  assert.equal(session.getState().failed, true);
  assert.equal(
    session.getState().reason,
    "moved_before_prompt",
    "Gerakan berulang sebelum prompt harus menggagalkan challenge replay.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK, ACTIONS.BLINK],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(frame(timestamp, { leftEAR: 0.1, rightEAR: 0.1 }));
  timestamp += 180;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));

  assert.equal(
    session.getState().complete,
    false,
    "Kedipan pertama tidak boleh menyelesaikan challenge yang memiliki langkah kedip kedua.",
  );
  assert.equal(session.getState().blinkCompletedCount, 1);

  timestamp += 150;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));

  assert.equal(
    session.getState().actionIndex,
    1,
    "Kedipan berikutnya harus tampil sebagai langkah challenge terpisah.",
  );
  assert.equal(
    session.getState().blinkTarget,
    1,
    "Setiap langkah kedip terpisah harus tetap meminta satu kedipan.",
  );

  timestamp += 150;
  session.ingest(frame(timestamp, { leftEAR: 0.1, rightEAR: 0.1 }));
  timestamp += 180;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));

  assert.equal(
    session.getState().complete,
    true,
    "Dua langkah kedip harus selesai melalui dua instruksi terpisah.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(frame(timestamp, { yaw: -0.09 }));
  timestamp += 150;
  session.ingest(frame(timestamp, { yaw: -0.09 }));

  assert.equal(session.getState().failed, true);
  assert.equal(
    session.getState().reason,
    "wrong_action",
    "Gerakan kepala saat diminta kedip harus menggagalkan challenge.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  for (let index = 0; index < 8; index += 1) {
    session.ingest(
      frame(timestamp, {
        yaw: index % 2 === 0 ? -0.08 : 0.08,
      }),
    );
    timestamp += 150;
  }

  assert.equal(
    session.getState().complete,
    false,
    "Foto dengan mata selalu terbuka tidak boleh lolos hanya karena digerakkan.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(
    frame(timestamp, {
      leftEAR: 0.22,
      rightEAR: 0.22,
    }),
  );
  timestamp += 180;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));

  assert.equal(
    session.getState().complete,
    true,
    "Kedipan singkat yang hanya tertangkap sebagian tetap harus dikenali.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(
    frame(timestamp, {
      leftEAR: 0.26,
      rightEAR: 0.26,
    }),
  );
  timestamp += 180;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));

  assert.equal(
    session.getState().complete,
    false,
    "Perubahan kecil pada mata tidak boleh dianggap sebagai kedipan.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  let timestamp = 0;

  for (let index = 0; index < testConfig.calibrationFrames; index += 1) {
    session.ingest(
      frame(timestamp, {
        blinkLeft: 0.24,
        blinkRight: 0.22,
      }),
    );
    timestamp += 150;
  }

  for (let index = 0; index < testConfig.neutralFrames; index += 1) {
    session.ingest(
      frame(timestamp, {
        blinkLeft: 0.24,
        blinkRight: 0.22,
      }),
    );
    timestamp += 150;
  }

  assert.equal(session.getState().phase, "action");

  session.ingest(
    frame(timestamp, {
      blinkLeft: 0.46,
      blinkRight: 0.44,
    }),
  );
  timestamp += 180;
  session.ingest(
    frame(timestamp, {
      blinkLeft: 0.25,
      blinkRight: 0.23,
    }),
  );
  timestamp += 150;
  session.ingest(
    frame(timestamp, {
      blinkLeft: 0.24,
      blinkRight: 0.22,
    }),
  );
  timestamp += 150;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));

  assert.equal(
    session.getState().complete,
    true,
    "Kenaikan koefisien kedip MediaPipe dari baseline harus valid saat EAR tidak turun.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(
    frame(timestamp, {
      blinkLeft: 0.35,
      blinkRight: 0.36,
    }),
  );
  timestamp += 180;
  session.ingest(
    frame(timestamp, {
      blinkLeft: 0.08,
      blinkRight: 0.09,
    }),
  );
  timestamp += 150;
  session.ingest(frame(timestamp));

  assert.equal(
    session.getState().complete,
    false,
    "Sinyal blendshape kecil tidak boleh dianggap sebagai kedipan penuh.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(
    frame(timestamp, {
      leftEAR: 0.1,
      rightEAR: 0.1,
    }),
  );
  timestamp += 180;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));

  assert.equal(
    session.getState().complete,
    true,
    "Kedip harus terbaca sebagai mata terbuka, tertutup, terbuka kembali, lalu netral.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.TURN_RIGHT],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(frame(timestamp, { yaw: 0.09 }));
  timestamp += 150;
  session.ingest(frame(timestamp, { yaw: 0.09 }));

  assert.equal(session.getState().failed, true);
  assert.equal(
    session.getState().reason,
    "wrong_action",
    "Yaw positif dari video mentah harus ditolak ketika peserta diminta tengok kanan.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.TURN_RIGHT, ACTIONS.TURN_LEFT],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(frame(timestamp, { yaw: -0.09 }));
  timestamp += 150;
  assert.equal(
    session.getState().phase,
    "action",
    "Satu frame gerakan tidak boleh dianggap stabil.",
  );

  session.ingest(frame(timestamp, { yaw: -0.09 }));
  timestamp += 150;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));
  timestamp += 150;

  assert.equal(session.getState().actionIndex, 1);
  assert.equal(session.getState().action, ACTIONS.TURN_LEFT);

  session.ingest(frame(timestamp, { yaw: 0.09 }));
  timestamp += 150;
  session.ingest(frame(timestamp, { yaw: 0.09 }));
  timestamp += 150;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));

  assert.equal(session.getState().complete, true);
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.TURN_RIGHT],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(frame(timestamp, { yaw: -0.04 }));
  timestamp += 35;
  session.ingest(frame(timestamp, { yaw: -0.07 }));
  timestamp += 35;
  session.ingest(frame(timestamp));
  timestamp += 35;
  session.ingest(frame(timestamp));

  assert.equal(
    session.getState().complete,
    true,
    "Tengok kanan peserta harus dikenali dari yaw negatif video mentah yang tidak dimirror.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.TURN_LEFT],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(frame(timestamp, { yaw: 0.04 }));
  timestamp += 35;
  session.ingest(frame(timestamp, { yaw: 0.07 }));
  timestamp += 35;
  session.ingest(frame(timestamp));
  timestamp += 35;
  session.ingest(frame(timestamp));

  assert.equal(
    session.getState().complete,
    true,
    "Tengok kiri peserta harus dikenali dari yaw positif video mentah yang tidak dimirror.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.TURN_RIGHT],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(frame(timestamp, { yaw: -0.08 }));
  timestamp += 35;
  session.ingest(frame(timestamp));
  timestamp += 35;
  session.ingest(frame(timestamp));

  assert.equal(
    session.getState().complete,
    false,
    "Satu frame lonjakan arah tidak boleh dianggap sebagai gerakan tengok yang valid.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });

  session.ingest(frame(0, { faceCount: 2 }));

  assert.equal(session.getState().failed, true);
  assert.equal(session.getState().reason, "multiple_faces");
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(frame(timestamp, { faceCount: 0 }));
  timestamp += testConfig.maxMissingFaceMs + 1;
  session.ingest(frame(timestamp, { faceCount: 0 }));

  assert.equal(session.getState().failed, true);
  assert.equal(session.getState().reason, "face_continuity_lost");
}

const engineScript = fs.readFileSync(enginePath, "utf8");
const verificationScript = fs.readFileSync(verificationPath, "utf8");
const verificationPage = fs.readFileSync(verificationPagePath, "utf8");
const faceGuideScript = fs.readFileSync(faceGuidePath, "utf8");

assert.doesNotMatch(
  engineScript,
  /pejam|perlahan/i,
  "Instruksi liveness hanya boleh meminta kedip normal, bukan merem atau kedip perlahan.",
);
assert.match(
  engineScript,
  /kedipkan kedua mata secara normal/i,
  "Instruksi liveness harus meminta peserta berkedip secara normal.",
);

assert.match(
  verificationPage,
  /liveness-engine\.js[^]*user-verifikasi\.js/,
  "Engine liveness harus dimuat sebelum controller verifikasi.",
);
assert.equal(
  (verificationPage.match(/active-liveness-v13/g) || []).length,
  3,
  "Ketiga asset liveness harus memakai versi cache v13 yang sama.",
);
assert.match(
  verificationScript,
  /AttendanceLiveness\.createLivenessSession/,
  "Controller harus memakai state machine liveness teruji.",
);
assert.match(
  verificationScript,
  /AttendanceLiveness\.createRandomChallenge/,
  "Controller Tahap 1 harus membuat challenge acak di browser.",
);
assert.doesNotMatch(
  verificationScript,
  /blinkTarget/,
  "Controller tidak boleh lagi meneruskan target kedip ganda.",
);
assert.match(
  verificationScript,
  /detectAllFaces/,
  "Liveness harus menolak frame dengan lebih dari satu wajah.",
);
assert.match(
  verificationScript,
  /document\.visibilityState !== "visible"/,
  "Liveness harus gagal tertutup ketika halaman/kamera tidak aktif terlihat.",
);
assert.ok(
  (verificationScript.match(/await cekWajah\(/g) || []).length >= 2,
  "Identitas wajah harus diperiksa sebelum dan sesudah tantangan liveness.",
);
assert.doesNotMatch(
  verificationScript,
  /instruksiAktif\s*=\s*"putar_kanan_kiri"/,
  "Tantangan tetap kanan-kiri tidak boleh menjadi satu-satunya liveness.",
);
assert.ok(
  /__attendanceLivenessActive\s*=\s*true[^]*finally[^]*__attendanceLivenessActive\s*=\s*false/.test(
    verificationScript,
  ),
  "Controller harus selalu melepas penanda liveness meskipun proses gagal.",
);
assert.match(
  faceGuideScript,
  /outputFaceBlendshapes:\s*true/,
  "MediaPipe harus mengaktifkan koefisien ekspresi wajah.",
);
assert.ok(
  /eyeBlinkLeft/.test(faceGuideScript) &&
    /eyeBlinkRight/.test(faceGuideScript),
  "MediaPipe harus menerbitkan sinyal kedip untuk kedua mata.",
);
assert.match(
  faceGuideScript,
  /consumeLatestLivenessSample/,
  "Panduan MediaPipe harus menyediakan sampel dan puncak kedip sekali konsumsi.",
);
assert.match(
  verificationScript,
  /AttendanceFaceGuide[^]*consumeLatestLivenessSample/,
  "Controller verifikasi harus mengonsumsi puncak kedip MediaPipe agar frame cepat tidak hilang.",
);
assert.ok(
  /blinkPeakLeft/.test(faceGuideScript) &&
    /blinkPeakRight/.test(faceGuideScript) &&
    /blinkPeakTimestamp/.test(faceGuideScript),
  "MediaPipe harus menahan puncak kedua mata beserta waktunya sampai dikonsumsi.",
);
assert.match(
  faceGuideScript,
  /function consumeLatestLivenessSample\(\)[^]*resetPendingBlinkPeak\(\)/,
  "Puncak kedip harus dihapus segera setelah satu kali konsumsi.",
);
assert.match(
  faceGuideScript,
  /livenessActive\s*\?\s*35\s*:\s*400/,
  "MediaPipe harus mengambil sampel lebih rapat selama challenge aktif.",
);
assert.match(
  verificationScript,
  /Math\.abs\(sampleAge\)\s*<=\s*200/,
  "Sampel MediaPipe yang sudah terlalu lama tidak boleh menutupi EAR frame terbaru.",
);
assert.ok(
  /function waitForNextLivenessFrame\(delayMs = 35\)/.test(
    verificationScript,
  ),
  "Sampling liveness harus cukup rapat untuk menangkap kedipan singkat.",
);
assert.ok(
  /inputSize:\s*256/.test(verificationScript),
  "Detector liveness harus memakai input ringan agar frame kedipan tidak terlewat.",
);
assert.doesNotMatch(
  verificationScript,
  /mulai_sesi_liveness|selesaikan_sesi_liveness|catat_absensi_terverifikasi|liveness_session_id/,
  "Controller Tahap 1 tidak boleh bergantung pada sesi liveness server.",
);

console.log("Liveness policy contract: OK");

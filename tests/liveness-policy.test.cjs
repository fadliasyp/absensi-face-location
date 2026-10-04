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
  new Set(createRandomSequence(() => 0.5)),
  new Set([ACTIONS.BLINK, ACTIONS.TURN_RIGHT, ACTIONS.TURN_LEFT]),
  "Setiap tantangan harus memuat kedip, tengok kanan, dan tengok kiri tepat sekali.",
);

{
  const values = [0.2, 0.8, 0.9];
  const challenge = createRandomChallenge(() => values.shift());

  assert.deepEqual(
    new Set(challenge.sequence),
    new Set([ACTIONS.BLINK, ACTIONS.TURN_RIGHT, ACTIONS.TURN_LEFT]),
    "Challenge acak tetap harus memuat ketiga jenis gerakan.",
  );
  assert.equal(
    challenge.blinkTarget,
    2,
    "Challenge harus dapat meminta dua kedipan secara acak.",
  );
}

assert.ok(
  DEFAULT_CONFIG.calibrationFrames >= 5 &&
    DEFAULT_CONFIG.neutralFrames >= 2 &&
    DEFAULT_CONFIG.turnFrames >= 2 &&
    DEFAULT_CONFIG.minPromptDelayMs >= 600 &&
    DEFAULT_CONFIG.maxActionMs <= 7000,
  "Default produksi harus mewajibkan kalibrasi dan kestabilan beberapa frame.",
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

function prepareAction(session, startAt = 0) {
  let timestamp = startAt;

  for (let index = 0; index < testConfig.calibrationFrames; index += 1) {
    session.ingest(frame(timestamp));
    timestamp += 150;
  }

  for (let index = 0; index < testConfig.neutralFrames; index += 1) {
    session.ingest(frame(timestamp));
    timestamp += 150;
  }

  assert.equal(session.getState().phase, "action");
  return timestamp;
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

  session.ingest(frame(timestamp, { yaw: -0.09 }));
  timestamp += 150;
  session.ingest(frame(timestamp, { yaw: -0.09 }));

  assert.equal(session.getState().failed, true);
  assert.equal(
    session.getState().reason,
    "moved_before_prompt",
    "Gerakan berulang sebelum prompt harus menggagalkan challenge replay.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
    blinkTarget: 2,
    config: testConfig,
  });
  let timestamp = prepareAction(session);

  session.ingest(frame(timestamp, { leftEAR: 0.1, rightEAR: 0.1 }));
  timestamp += 180;
  session.ingest(frame(timestamp));
  timestamp += 150;
  session.ingest(frame(timestamp));

  assert.equal(
    session.getState().phase,
    "action",
    "Satu kedipan belum boleh menyelesaikan instruksi dua kedipan.",
  );
  assert.equal(session.getState().blinkCompletedCount, 1);

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
    "Instruksi dua kedipan harus selesai hanya setelah dua siklus tutup-buka.",
  );
}

{
  const session = createLivenessSession({
    sequence: [ACTIONS.BLINK],
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
  assert.equal(session.getState().reason, "wrong_action");
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

const verificationScript = fs.readFileSync(verificationPath, "utf8");
const verificationPage = fs.readFileSync(verificationPagePath, "utf8");
const faceGuideScript = fs.readFileSync(faceGuidePath, "utf8");

assert.match(
  verificationPage,
  /liveness-engine\.js[^]*user-verifikasi\.js/,
  "Engine liveness harus dimuat sebelum controller verifikasi.",
);
assert.equal(
  (verificationPage.match(/active-liveness-v4/g) || []).length,
  3,
  "Ketiga asset liveness harus memakai versi cache v4 yang sama.",
);
assert.match(
  verificationScript,
  /AttendanceLiveness\.createLivenessSession/,
  "Controller harus memakai state machine liveness teruji.",
);
assert.ok(
  /AttendanceLiveness\.createRandomChallenge/.test(verificationScript),
  "Controller harus memakai challenge dengan jumlah kedip acak.",
);
assert.ok(
  /blinkTarget/.test(verificationScript),
  "Target kedip acak harus diteruskan ke sesi liveness.",
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
  /getLatestLivenessSample/,
  "Panduan MediaPipe harus menyediakan sampel kedip terbaru untuk liveness.",
);
assert.match(
  verificationScript,
  /AttendanceFaceGuide[^]*getLatestLivenessSample/,
  "Controller verifikasi harus menggabungkan sinyal kedip MediaPipe.",
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

console.log("Liveness policy contract: OK");

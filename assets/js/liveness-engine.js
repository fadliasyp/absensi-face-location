(function initLivenessEngine(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.AttendanceLiveness = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function factory() {
  "use strict";

  const ACTIONS = Object.freeze({
    BLINK: "blink",
    TURN_RIGHT: "turn_right",
    TURN_LEFT: "turn_left",
  });

  const DEFAULT_CONFIG = Object.freeze({
    calibrationFrames: 6,
    neutralFrames: 3,
    returnNeutralFrames: 3,
    turnFrames: 3,
    blinkReopenFrames: 2,
    calibrationCenterLimit: 0.04,
    neutralYawTolerance: 0.03,
    turnYawDelta: 0.055,
    minimumOpenEAR: 0.15,
    maximumOpenEAR: 0.55,
    neutralOpenRatio: 0.78,
    blinkClosedRatio: 0.68,
    blinkReopenRatio: 0.82,
    minBlinkClosedMs: 60,
    maxBlinkClosedMs: 1400,
    maxMissingFaceMs: 2200,
    maxActionMs: 10000,
    maxChallengeMs: 45000,
  });

  const ACTION_LABELS = Object.freeze({
    [ACTIONS.BLINK]: "kedipkan kedua mata",
    [ACTIONS.TURN_RIGHT]: "tengok ke kanan",
    [ACTIONS.TURN_LEFT]: "tengok ke kiri",
  });

  function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[middle - 1] + sorted[middle]) / 2;
    }

    return sorted[middle];
  }

  function clampRandom(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.min(0.999999999, Math.max(0, value));
  }

  function createRandomSequence(random = Math.random) {
    const sequence = [ACTIONS.BLINK, ACTIONS.TURN_RIGHT, ACTIONS.TURN_LEFT];

    for (let index = sequence.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(clampRandom(random()) * (index + 1));
      [sequence[index], sequence[swapIndex]] = [
        sequence[swapIndex],
        sequence[index],
      ];
    }

    return sequence;
  }

  function validateSequence(sequence) {
    const allowedActions = new Set(Object.values(ACTIONS));

    if (!Array.isArray(sequence) || sequence.length === 0) {
      throw new TypeError("Urutan liveness tidak boleh kosong.");
    }

    if (sequence.some((action) => !allowedActions.has(action))) {
      throw new TypeError("Urutan liveness berisi gerakan yang tidak dikenal.");
    }
  }

  function createLivenessSession({ sequence, config = {} } = {}) {
    const selectedSequence = sequence || createRandomSequence();
    validateSequence(selectedSequence);

    const settings = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    const state = {
      phase: "calibrating",
      complete: false,
      failed: false,
      reason: null,
      message: "Tatap lurus ke kamera untuk kalibrasi wajah.",
      actionIndex: 0,
      action: selectedSequence[0],
      sequence: [...selectedSequence],
      baseline: null,
      startedAt: null,
      lastTimestamp: null,
      missingSince: null,
      actionStartedAt: null,
      neutralCount: 0,
      turnCount: 0,
      blinkStage: "awaiting_closed",
      blinkClosedAt: null,
      blinkReopenCount: 0,
      calibrationSamples: [],
    };

    function actionProgressText() {
      return `Langkah ${state.actionIndex + 1} dari ${state.sequence.length}`;
    }

    function setFailure(reason, message) {
      state.phase = "failed";
      state.failed = true;
      state.reason = reason;
      state.message = message;
      return getState();
    }

    function resetTransientProgress() {
      state.neutralCount = 0;
      state.turnCount = 0;
      state.blinkStage = "awaiting_closed";
      state.blinkClosedAt = null;
      state.blinkReopenCount = 0;

      if (state.phase === "calibrating") {
        state.calibrationSamples = [];
      }
    }

    function isValidFaceSample(sample) {
      return (
        Number.isFinite(sample.yaw) &&
        Number.isFinite(sample.leftEAR) &&
        Number.isFinite(sample.rightEAR) &&
        sample.leftEAR > 0 &&
        sample.rightEAR > 0
      );
    }

    function eyesAreOpen(sample, ratio = settings.neutralOpenRatio) {
      return (
        sample.leftEAR >= state.baseline.leftEAR * ratio &&
        sample.rightEAR >= state.baseline.rightEAR * ratio
      );
    }

    function isNeutral(sample) {
      return (
        Math.abs(sample.yaw - state.baseline.yaw) <=
          settings.neutralYawTolerance && eyesAreOpen(sample)
      );
    }

    function beginAction(timestamp) {
      state.phase = "action";
      state.actionStartedAt = timestamp;
      state.turnCount = 0;
      state.blinkStage = "awaiting_closed";
      state.blinkClosedAt = null;
      state.blinkReopenCount = 0;
      state.message = `${actionProgressText()}: ${ACTION_LABELS[state.action]}.`;
    }

    function beginReturnToNeutral() {
      state.phase = "return_neutral";
      state.neutralCount = 0;
      state.message = "Gerakan terbaca. Kembali tatap lurus ke kamera.";
    }

    function finishCurrentAction(timestamp) {
      state.actionIndex += 1;

      if (state.actionIndex >= state.sequence.length) {
        state.phase = "complete";
        state.complete = true;
        state.action = null;
        state.message = "Seluruh gerakan liveness berhasil diverifikasi.";
        return;
      }

      state.action = state.sequence[state.actionIndex];
      beginAction(timestamp);
    }

    function processCalibration(sample) {
      const centered =
        Math.abs(sample.yaw) <= settings.calibrationCenterLimit &&
        sample.leftEAR >= settings.minimumOpenEAR &&
        sample.rightEAR >= settings.minimumOpenEAR &&
        sample.leftEAR <= settings.maximumOpenEAR &&
        sample.rightEAR <= settings.maximumOpenEAR;

      if (!centered) {
        state.calibrationSamples = [];
        state.message =
          "Tatap lurus dengan kedua mata terbuka untuk memulai kalibrasi.";
        return;
      }

      const previous = state.calibrationSamples.at(-1);

      if (previous && Math.abs(previous.yaw - sample.yaw) > 0.025) {
        state.calibrationSamples = [];
      }

      state.calibrationSamples.push({
        yaw: sample.yaw,
        leftEAR: sample.leftEAR,
        rightEAR: sample.rightEAR,
      });
      state.message = `Menstabilkan wajah (${Math.min(
        state.calibrationSamples.length,
        settings.calibrationFrames,
      )}/${settings.calibrationFrames})...`;

      if (state.calibrationSamples.length < settings.calibrationFrames) {
        return;
      }

      state.baseline = {
        yaw: median(state.calibrationSamples.map((item) => item.yaw)),
        leftEAR: median(state.calibrationSamples.map((item) => item.leftEAR)),
        rightEAR: median(state.calibrationSamples.map((item) => item.rightEAR)),
      };
      state.phase = "neutral";
      state.neutralCount = 0;
      state.message = "Kalibrasi selesai. Pertahankan posisi wajah di tengah.";
    }

    function processNeutral(sample) {
      if (isNeutral(sample)) {
        state.neutralCount += 1;
      } else {
        state.neutralCount = 0;
      }

      if (state.neutralCount >= settings.neutralFrames) {
        beginAction(sample.timestamp);
      }
    }

    function processBlink(sample) {
      const bothEyesClosed =
        sample.leftEAR <= state.baseline.leftEAR * settings.blinkClosedRatio &&
        sample.rightEAR <= state.baseline.rightEAR * settings.blinkClosedRatio;
      const bothEyesReopened = eyesAreOpen(
        sample,
        settings.blinkReopenRatio,
      );

      if (state.blinkStage === "awaiting_closed") {
        if (bothEyesClosed) {
          state.blinkStage = "awaiting_reopen";
          state.blinkClosedAt = sample.timestamp;
          state.blinkReopenCount = 0;
          state.message = "Kedipan terbaca. Buka kembali kedua mata.";
        }

        return;
      }

      const closedDuration = sample.timestamp - state.blinkClosedAt;

      if (closedDuration > settings.maxBlinkClosedMs) {
        state.blinkStage = "awaiting_closed";
        state.blinkClosedAt = null;
        state.blinkReopenCount = 0;
        state.message = `${actionProgressText()}: kedipkan kedua mata secara alami.`;
        return;
      }

      if (!bothEyesReopened) {
        state.blinkReopenCount = 0;
        return;
      }

      if (closedDuration < settings.minBlinkClosedMs) {
        state.blinkStage = "awaiting_closed";
        state.blinkClosedAt = null;
        state.blinkReopenCount = 0;
        return;
      }

      state.blinkReopenCount += 1;

      if (state.blinkReopenCount >= settings.blinkReopenFrames) {
        beginReturnToNeutral();
      }
    }

    function processTurn(sample) {
      const yawDelta = sample.yaw - state.baseline.yaw;
      const expectedDirectionReached =
        state.action === ACTIONS.TURN_RIGHT
          ? yawDelta <= -settings.turnYawDelta
          : yawDelta >= settings.turnYawDelta;
      const wrongDirectionReached =
        state.action === ACTIONS.TURN_RIGHT
          ? yawDelta >= settings.turnYawDelta
          : yawDelta <= -settings.turnYawDelta;

      if (expectedDirectionReached) {
        state.turnCount += 1;
      } else {
        state.turnCount = 0;
      }

      if (wrongDirectionReached) {
        state.message = `${actionProgressText()}: arah belum sesuai, ${ACTION_LABELS[state.action]}.`;
      }

      if (state.turnCount >= settings.turnFrames) {
        beginReturnToNeutral();
      }
    }

    function processAction(sample) {
      if (sample.timestamp - state.actionStartedAt > settings.maxActionMs) {
        setFailure(
          "action_timeout",
          `Gerakan ${ACTION_LABELS[state.action]} tidak terbaca dalam batas waktu.`,
        );
        return;
      }

      if (state.action === ACTIONS.BLINK) {
        processBlink(sample);
        return;
      }

      processTurn(sample);
    }

    function processReturnToNeutral(sample) {
      if (isNeutral(sample)) {
        state.neutralCount += 1;
      } else {
        state.neutralCount = 0;
      }

      if (state.neutralCount >= settings.returnNeutralFrames) {
        finishCurrentAction(sample.timestamp);
      }
    }

    function ingest(input) {
      if (state.complete || state.failed) return getState();

      const sample = input || {};

      if (!Number.isFinite(sample.timestamp)) {
        return setFailure(
          "invalid_sample",
          "Data waktu frame liveness tidak valid.",
        );
      }

      if (
        state.lastTimestamp !== null &&
        sample.timestamp < state.lastTimestamp
      ) {
        return setFailure(
          "invalid_timestamp",
          "Urutan frame kamera tidak valid.",
        );
      }

      state.lastTimestamp = sample.timestamp;

      if (state.startedAt === null) {
        state.startedAt = sample.timestamp;
      }

      if (sample.timestamp - state.startedAt > settings.maxChallengeMs) {
        return setFailure(
          "challenge_timeout",
          "Waktu verifikasi gerakan telah habis. Silakan mulai kembali.",
        );
      }

      if (sample.faceCount > 1) {
        return setFailure(
          "multiple_faces",
          "Terdeteksi lebih dari satu wajah. Pastikan hanya Anda yang terlihat.",
        );
      }

      if (sample.faceCount !== 1 || !isValidFaceSample(sample)) {
        if (state.missingSince === null) {
          state.missingSince = sample.timestamp;
        }

        resetTransientProgress();
        state.message = "Wajah tidak terbaca. Tetap berada di depan kamera.";

        if (
          sample.timestamp - state.missingSince >=
          settings.maxMissingFaceMs
        ) {
          return setFailure(
            "face_continuity_lost",
            "Wajah sempat hilang terlalu lama. Verifikasi harus diulang.",
          );
        }

        return getState();
      }

      state.missingSince = null;

      if (state.phase === "calibrating") {
        processCalibration(sample);
      } else if (state.phase === "neutral") {
        processNeutral(sample);
      } else if (state.phase === "action") {
        processAction(sample);
      } else if (state.phase === "return_neutral") {
        processReturnToNeutral(sample);
      }

      return getState();
    }

    function getState() {
      return {
        phase: state.phase,
        complete: state.complete,
        failed: state.failed,
        reason: state.reason,
        message: state.message,
        actionIndex: state.actionIndex,
        action: state.action,
        sequence: [...state.sequence],
        totalActions: state.sequence.length,
      };
    }

    return Object.freeze({
      ingest,
      getState,
    });
  }

  return Object.freeze({
    ACTIONS,
    DEFAULT_CONFIG,
    createLivenessSession,
    createRandomSequence,
  });
});

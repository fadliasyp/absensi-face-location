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
    calibrationFrames: 1,
    neutralFrames: 0,
    returnNeutralFrames: 3,
    turnFrames: 3,
    blinkReopenFrames: 2,
    calibrationCenterLimit: 0.04,
    neutralYawTolerance: 0.03,
    turnYawDelta: 0.055,
    minimumOpenEAR: 0.15,
    maximumOpenEAR: 0.55,
    neutralOpenRatio: 0.78,
    blinkClosedRatio: 0.76,
    blinkReopenRatio: 0.82,
    blinkBlendshapeClosedFloor: 0.4,
    blinkBlendshapeClosedFallback: 0.45,
    blinkBlendshapeClosedDelta: 0.18,
    blinkBlendshapeOpenFallback: 0.3,
    blinkBlendshapeReopenDelta: 0.1,
    minBlinkClosedMs: 60,
    maxBlinkClosedMs: 1400,
    maxMissingFaceMs: 2200,
    minPromptDelayMs: 700,
    maxPromptDelayMs: 1700,
    wrongActionFrames: 2,
    maxActionMs: 6000,
    maxChallengeMs: 45000,
  });

  const ACTION_LABELS = Object.freeze({
    [ACTIONS.BLINK]: "kedipkan kedua mata secara perlahan",
    [ACTIONS.TURN_RIGHT]: "tengok ke kanan",
    [ACTIONS.TURN_LEFT]: "tengok ke kiri",
  });

  function median(values) {
    if (values.length === 0) return null;

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

  function createRandomChallenge(random = Math.random) {
    return {
      sequence: createRandomSequence(random),
      blinkTarget: clampRandom(random()) < 0.5 ? 1 : 2,
    };
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

  function createLivenessSession({
    sequence,
    blinkTarget = 1,
    promptDelayRandom = Math.random,
    config = {},
  } = {}) {
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
      message: "Posisikan wajah di tengah kamera dengan kedua mata terbuka.",
      actionIndex: 0,
      action: selectedSequence[0],
      sequence: [...selectedSequence],
      baseline: null,
      startedAt: null,
      lastTimestamp: null,
      missingSince: null,
      actionStartedAt: null,
      promptReadyAt: null,
      neutralCount: 0,
      turnCount: 0,
      wrongActionCount: 0,
      blinkStage: "awaiting_closed",
      blinkClosedAt: null,
      blinkReopenCount: 0,
      blinkTarget: blinkTarget === 2 ? 2 : 1,
      blinkCompletedCount: 0,
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
      state.wrongActionCount = 0;
      state.blinkStage = "awaiting_closed";
      state.blinkClosedAt = null;
      state.blinkReopenCount = 0;

      if (state.phase === "prompt_delay") {
        state.promptReadyAt = null;
      }

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

    function actionInstructionText() {
      if (state.action === ACTIONS.BLINK && state.blinkTarget === 2) {
        return "kedipkan kedua mata dua kali secara perlahan";
      }

      return ACTION_LABELS[state.action];
    }

    function getPromptDelay() {
      const minimum = Math.max(0, settings.minPromptDelayMs);
      const maximum = Math.max(minimum, settings.maxPromptDelayMs);
      return Math.round(
        minimum + clampRandom(promptDelayRandom()) * (maximum - minimum),
      );
    }

    function beginAction(timestamp) {
      state.phase = "action";
      state.actionStartedAt = timestamp;
      state.promptReadyAt = null;
      state.turnCount = 0;
      state.wrongActionCount = 0;
      state.blinkStage = "awaiting_closed";
      state.blinkClosedAt = null;
      state.blinkReopenCount = 0;
      state.blinkCompletedCount = 0;
      state.message = `${actionProgressText()}: ${actionInstructionText()}.`;
    }

    function beginPromptDelay(timestamp) {
      const delay = getPromptDelay();

      state.phase = "prompt_delay";
      state.actionStartedAt = null;
      state.promptReadyAt = timestamp + delay;
      state.neutralCount = 0;
      state.wrongActionCount = 0;
      state.message =
        "Tetap tatap lurus. Instruksi berikutnya akan segera muncul.";

      if (delay === 0) {
        beginAction(timestamp);
      }
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
      beginPromptDelay(timestamp);
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
          "Posisikan wajah di tengah kamera dengan kedua mata terbuka.";
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
        blinkLeft: Number.isFinite(sample.blinkLeft)
          ? sample.blinkLeft
          : null,
        blinkRight: Number.isFinite(sample.blinkRight)
          ? sample.blinkRight
          : null,
      });
      if (state.calibrationSamples.length < settings.calibrationFrames) {
        state.message = "Membaca posisi wajah...";
        return;
      }

      state.baseline = {
        yaw: median(state.calibrationSamples.map((item) => item.yaw)),
        leftEAR: median(state.calibrationSamples.map((item) => item.leftEAR)),
        rightEAR: median(state.calibrationSamples.map((item) => item.rightEAR)),
        blinkLeft: median(
          state.calibrationSamples
            .map((item) => item.blinkLeft)
            .filter(Number.isFinite),
        ),
        blinkRight: median(
          state.calibrationSamples
            .map((item) => item.blinkRight)
            .filter(Number.isFinite),
        ),
      };
      if (settings.neutralFrames <= 0) {
        beginPromptDelay(sample.timestamp);
        return;
      }

      state.phase = "neutral";
      state.neutralCount = 0;
      state.message = "Pertahankan posisi wajah di tengah.";
    }

    function processNeutral(sample) {
      if (isNeutral(sample)) {
        state.neutralCount += 1;
      } else {
        state.neutralCount = 0;
      }

      if (state.neutralCount >= settings.neutralFrames) {
        beginPromptDelay(sample.timestamp);
      }
    }

    function processPromptDelay(sample) {
      const yawDelta = sample.yaw - state.baseline.yaw;

      if (Math.abs(yawDelta) >= settings.turnYawDelta) {
        state.wrongActionCount += 1;

        if (state.wrongActionCount >= settings.wrongActionFrames) {
          setFailure(
            "moved_before_prompt",
            "Gerakan dilakukan sebelum instruksi muncul. Silakan ulangi verifikasi.",
          );
        }

        return;
      }

      state.wrongActionCount = 0;

      if (!isNeutral(sample)) {
        state.promptReadyAt = sample.timestamp + settings.minPromptDelayMs;
        return;
      }

      if (state.promptReadyAt === null) {
        state.promptReadyAt = sample.timestamp + getPromptDelay();
      }

      if (sample.timestamp >= state.promptReadyAt) {
        beginAction(sample.timestamp);
      }
    }

    function processBlink(sample) {
      const yawDelta = sample.yaw - state.baseline.yaw;

      if (Math.abs(yawDelta) >= settings.turnYawDelta) {
        state.wrongActionCount += 1;

        if (state.wrongActionCount >= settings.wrongActionFrames) {
          setFailure(
            "wrong_action",
            "Gerakan tidak sesuai instruksi kedip. Silakan ulangi verifikasi.",
          );
        }

        return;
      }

      state.wrongActionCount = 0;

      const hasBlendshapeSignal =
        Number.isFinite(sample.blinkLeft) &&
        Number.isFinite(sample.blinkRight);
      const hasBlendshapeBaseline =
        Number.isFinite(state.baseline.blinkLeft) &&
        Number.isFinite(state.baseline.blinkRight);
      const leftClosedThreshold = hasBlendshapeBaseline
        ? Math.max(
            settings.blinkBlendshapeClosedFloor,
            state.baseline.blinkLeft + settings.blinkBlendshapeClosedDelta,
          )
        : settings.blinkBlendshapeClosedFallback;
      const rightClosedThreshold = hasBlendshapeBaseline
        ? Math.max(
            settings.blinkBlendshapeClosedFloor,
            state.baseline.blinkRight + settings.blinkBlendshapeClosedDelta,
          )
        : settings.blinkBlendshapeClosedFallback;
      const leftOpenThreshold = hasBlendshapeBaseline
        ? Math.min(
            leftClosedThreshold - 0.05,
            state.baseline.blinkLeft + settings.blinkBlendshapeReopenDelta,
          )
        : settings.blinkBlendshapeOpenFallback;
      const rightOpenThreshold = hasBlendshapeBaseline
        ? Math.min(
            rightClosedThreshold - 0.05,
            state.baseline.blinkRight + settings.blinkBlendshapeReopenDelta,
          )
        : settings.blinkBlendshapeOpenFallback;
      const bothEyesClosed = hasBlendshapeSignal
        ? sample.blinkLeft >= leftClosedThreshold &&
          sample.blinkRight >= rightClosedThreshold
        : sample.leftEAR <=
            state.baseline.leftEAR * settings.blinkClosedRatio &&
          sample.rightEAR <=
            state.baseline.rightEAR * settings.blinkClosedRatio;
      const bothEyesReopened = hasBlendshapeSignal
        ? sample.blinkLeft <= leftOpenThreshold &&
          sample.blinkRight <= rightOpenThreshold
        : eyesAreOpen(sample, settings.blinkReopenRatio);

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
        state.message = `${actionProgressText()}: kedip perlahan atau pejamkan kedua mata sesaat, lalu buka kembali.`;
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
        state.blinkCompletedCount += 1;

        if (state.blinkCompletedCount < state.blinkTarget) {
          state.blinkStage = "awaiting_closed";
          state.blinkClosedAt = null;
          state.blinkReopenCount = 0;
          state.message = `${actionProgressText()}: kedipkan kedua mata sekali lagi.`;
          return;
        }

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
        state.wrongActionCount = 0;
      } else {
        state.turnCount = 0;
      }

      if (wrongDirectionReached) {
        state.wrongActionCount += 1;

        if (state.wrongActionCount >= settings.wrongActionFrames) {
          setFailure(
            "wrong_action",
            `Gerakan berlawanan dengan instruksi ${ACTION_LABELS[state.action]}. Silakan ulangi verifikasi.`,
          );
          return;
        }
      } else if (!expectedDirectionReached) {
        state.wrongActionCount = 0;
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
      } else if (state.phase === "prompt_delay") {
        processPromptDelay(sample);
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
        blinkTarget: state.blinkTarget,
        blinkCompletedCount: state.blinkCompletedCount,
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
    createRandomChallenge,
    createRandomSequence,
  });
});

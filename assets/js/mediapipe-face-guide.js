import {
  FaceLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/vision_bundle.mjs";

const video = document.getElementById("video");
const canvas = document.getElementById("faceGuideCanvas");
const faceShape = document.getElementById("faceShape");

let faceLandmarker = null;
let guideInterval = null;

function setGuideState(type) {
  if (!faceShape) return;

  faceShape.classList.remove("valid", "warning", "invalid");

  if (type) {
    faceShape.classList.add(type);
  }
}

function waitVideoReady() {
  return new Promise((resolve) => {
    const cek = setInterval(() => {
      if (
        video &&
        video.srcObject &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        clearInterval(cek);
        resolve();
      }
    }, 300);
  });
}

function resizeCanvas() {
  if (!canvas || !video) return;

  const rect = video.getBoundingClientRect();

  canvas.width = rect.width;
  canvas.height = rect.height;
}

function getFaceBoxFromLandmarks(landmarks, width, height) {
  const xs = landmarks.map((point) => point.x * width);
  const ys = landmarks.map((point) => point.y * height);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: minX + (maxX - minX) / 2,
    centerY: minY + (maxY - minY) / 2,
  };
}

function isFaceInsideGuide(box, canvasWidth, canvasHeight) {
  const ovalCenterX = canvasWidth / 2;
  const ovalCenterY = canvasHeight / 2;

  const ovalRadiusX = canvasWidth * 0.23;
  const ovalRadiusY = canvasHeight * 0.34;

  const normalized =
    Math.pow((box.centerX - ovalCenterX) / ovalRadiusX, 2) +
    Math.pow((box.centerY - ovalCenterY) / ovalRadiusY, 2);

  const positionOk = normalized <= 1;

  const sizeOk =
    box.width >= canvasWidth * 0.18 &&
    box.width <= canvasWidth * 0.62 &&
    box.height >= canvasHeight * 0.25 &&
    box.height <= canvasHeight * 0.82;

  return positionOk && sizeOk;
}

function drawSoftBox(ctx, box, valid) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = valid ? "#22c55e" : "#f59e0b";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(box.x, box.y, box.width, box.height);
  ctx.setLineDash([]);
}

function setOvalStatus(type, message) {
  if (ovalStatus) {
    ovalStatus.textContent = message;
  }

  if (!faceOval) return;

  faceOval.classList.remove("valid", "warning", "invalid");

  if (type) {
    faceOval.classList.add(type);
  }
}

async function initMediaPipeFaceGuide() {
  if (!video || !canvas) {
    console.log("MediaPipe guide tidak aktif: video/canvas tidak ditemukan.");
    return;
  }

  try {
    setGuideState("warning");

    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm",
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numFaces: 1,
    });

    await waitVideoReady();

    resizeCanvas();

    const ctx = canvas.getContext("2d");

    if (guideInterval) {
      clearInterval(guideInterval);
    }

    guideInterval = setInterval(() => {
      if (!faceLandmarker || !video || video.readyState < 2) return;

      resizeCanvas();

      const nowInMs = performance.now();
      const result = faceLandmarker.detectForVideo(video, nowInMs);

      console.log("MediaPipe result:", result.faceLandmarks?.length || 0);

      if (!result.faceLandmarks || result.faceLandmarks.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setGuideState("invalid");
        return;
      }

      const landmarks = result.faceLandmarks[0];
      const box = getFaceBoxFromLandmarks(
        landmarks,
        canvas.width,
        canvas.height,
      );
      const valid = isFaceInsideGuide(box, canvas.width, canvas.height);

      // kalau tidak mau ada kotak deteksi sama sekali, hapus / komentari baris ini
      // drawSoftBox(ctx, box, valid);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (valid) {
        setGuideState("valid");
      } else {
        setGuideState("warning");
      }
    }, 400);
  } catch (error) {
    console.error("Gagal memuat MediaPipe Face Guide:", error);
    setGuideState("invalid");
  }
}

window.addEventListener("load", () => {
  initMediaPipeFaceGuide();
});

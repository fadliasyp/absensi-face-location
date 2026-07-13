const fotoAbsenStatus = document.getElementById("fotoAbsenStatus");
const fotoAbsenError = document.getElementById("fotoAbsenError");
const fotoAbsenImage = document.getElementById("fotoAbsenImage");

function showFotoError(message) {
  fotoAbsenStatus.textContent = "Foto tidak dapat ditampilkan";
  fotoAbsenError.textContent = message;
  fotoAbsenError.hidden = false;
}

async function getFunctionErrorMessage(error, fallbackMessage) {
  try {
    const response = error?.context;

    if (response && typeof response.json === "function") {
      const details = await response.json();
      return details?.error || fallbackMessage;
    }
  } catch (contextError) {
    console.error("Gagal membaca detail Edge Function:", contextError);
  }

  return error?.message || fallbackMessage;
}

async function loadFotoAbsen() {
  const objectKey = new URLSearchParams(window.location.search).get("key");

  if (!objectKey) {
    showFotoError("Object key foto tidak ditemukan pada link.");
    return;
  }

  const { data: authData, error: authError } =
    await supabaseClient.auth.getUser();

  if (authError || !authData.user) {
    showFotoError(
      "Silakan login terlebih dahulu, kemudian buka kembali link foto ini.",
    );
    return;
  }

  const { data, error } = await supabaseClient.functions.invoke(
    "r2-signed-url",
    {
      body: {
        action: "view",
        object_key: objectKey,
      },
    },
  );

  if (error) {
    const message = await getFunctionErrorMessage(
      error,
      "Gagal meminta akses foto absensi.",
    );
    showFotoError(message);
    return;
  }

  if (!data?.view_url) {
    showFotoError("Signed view URL tidak tersedia.");
    return;
  }

  fotoAbsenImage.addEventListener(
    "load",
    () => {
      fotoAbsenStatus.textContent = "Foto bukti absensi berhasil dimuat.";
      fotoAbsenImage.style.display = "block";
    },
    { once: true },
  );

  fotoAbsenImage.addEventListener(
    "error",
    () => {
      showFotoError("Foto tidak ditemukan atau akses foto telah kedaluwarsa.");
    },
    { once: true },
  );

  fotoAbsenImage.src = data.view_url;
}

loadFotoAbsen();

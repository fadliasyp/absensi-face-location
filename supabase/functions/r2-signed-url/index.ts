import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedContentTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const maxUploadSize = 200 * 1024;
const signedUrlExpiresIn = 5 * 60;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getJakartaDateParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const result: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  }

  return {
    year: result.year,
    month: result.month,
    day: result.day,
  };
}

function isSafeObjectKey(objectKey: string) {
  return (
    objectKey.startsWith("foto-absen/") &&
    !objectKey.includes("..") &&
    !objectKey.includes("\\") &&
    /^[a-zA-Z0-9/_\-.]+$/.test(objectKey)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method tidak diizinkan." }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "Sesi login tidak ditemukan." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const r2Endpoint = Deno.env.get("R2_ENDPOINT");
    const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const r2SecretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const r2BucketName = Deno.env.get("R2_BUCKET_NAME");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Konfigurasi Supabase belum lengkap." }, 500);
    }

    if (
      !r2Endpoint ||
      !r2AccessKeyId ||
      !r2SecretAccessKey ||
      !r2BucketName
    ) {
      return jsonResponse({ error: "Konfigurasi Cloudflare R2 belum lengkap." }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return jsonResponse({ error: "Sesi login tidak valid." }, 401);
    }

    const userId = userData.user.id;
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, status_akun")
      .eq("id", userId)
      .single();

    if (
      profileError ||
      !profile ||
      profile.status_akun !== "aktif" ||
      !["user", "admin"].includes(profile.role)
    ) {
      return jsonResponse({ error: "Akun tidak memiliki akses." }, 403);
    }

    const body = await req.json();
    const action = body.action;

    const r2Client = new S3Client({
      region: "auto",
      endpoint: r2Endpoint.replace(/\/$/, ""),
      forcePathStyle: true,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    });

    if (action === "upload") {
      const contentType = String(body.content_type || "").toLowerCase();
      const fileSize = Number(body.file_size);
      const extension = allowedContentTypes[contentType];

      if (!extension) {
        return jsonResponse(
          { error: "Format foto harus JPEG atau WebP." },
          400,
        );
      }

      if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > maxUploadSize) {
        return jsonResponse(
          { error: "Ukuran foto maksimal 200 KB." },
          400,
        );
      }

      const date = getJakartaDateParts();
      const objectKey =
        `foto-absen/${userId}/${date.year}/${date.month}/${date.day}/` +
        `${crypto.randomUUID()}.${extension}`;

      const uploadUrl = await getSignedUrl(
        r2Client,
        new PutObjectCommand({
          Bucket: r2BucketName,
          Key: objectKey,
          ContentType: contentType,
        }),
        { expiresIn: signedUrlExpiresIn },
      );

      return jsonResponse({
        success: true,
        upload_url: uploadUrl,
        object_key: objectKey,
        expires_in: signedUrlExpiresIn,
      });
    }

    if (action === "view") {
      const objectKey = String(body.object_key || "");

      if (!isSafeObjectKey(objectKey)) {
        return jsonResponse({ error: "Object key foto tidak valid." }, 400);
      }

      const isAdmin = profile.role === "admin";
      const belongsToUser = objectKey.startsWith(`foto-absen/${userId}/`);

      if (!isAdmin && !belongsToUser) {
        return jsonResponse({ error: "Akses foto ditolak." }, 403);
      }

      const viewUrl = await getSignedUrl(
        r2Client,
        new GetObjectCommand({
          Bucket: r2BucketName,
          Key: objectKey,
        }),
        { expiresIn: signedUrlExpiresIn },
      );

      return jsonResponse({
        success: true,
        view_url: viewUrl,
        expires_in: signedUrlExpiresIn,
      });
    }

    return jsonResponse({ error: "Action tidak dikenali." }, 400);
  } catch (error) {
    console.error("R2 signed URL error:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat mengakses penyimpanan foto.",
      },
      500,
    );
  }
});

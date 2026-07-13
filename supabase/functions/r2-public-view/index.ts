import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const signedUrlExpiresIn = 5 * 60;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    const r2Endpoint = Deno.env.get("R2_ENDPOINT");
    const r2AccessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
    const r2SecretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
    const r2BucketName = Deno.env.get("R2_BUCKET_NAME");

    if (
      !r2Endpoint ||
      !r2AccessKeyId ||
      !r2SecretAccessKey ||
      !r2BucketName
    ) {
      return jsonResponse({ error: "Konfigurasi penyimpanan belum lengkap." }, 500);
    }

    const body = await req.json();
    const objectKey = String(body.object_key || "");

    if (!isSafeObjectKey(objectKey)) {
      return jsonResponse({ error: "Link foto tidak valid." }, 400);
    }

    const r2Client = new S3Client({
      region: "auto",
      endpoint: r2Endpoint.replace(/\/$/, ""),
      forcePathStyle: true,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    });

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
  } catch (error) {
    console.error("Public R2 view error:", error);
    return jsonResponse({ error: "Gagal menyiapkan akses foto." }, 500);
  }
});

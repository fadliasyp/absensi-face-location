import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const deleteBatchSize = 100;
const maxFotoSize = 200 * 1024;
const confirmationText = "HAPUS FOTO";

type SupabaseAdmin = ReturnType<typeof createClient>;

type CleanupLog = {
  id: string;
  admin_id: string;
  tanggal_awal: string;
  tanggal_akhir: string;
  jumlah_ditemukan: number;
  jumlah_dihapus: number;
  jumlah_gagal: number;
  status: "processing" | "completed" | "failed";
  pesan_error: string | null;
  created_at: string;
  completed_at: string | null;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsedDate = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value;
}

function validateDateRange(startDate: string, endDate: string) {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    return "Tanggal awal dan akhir wajib diisi dengan format yang benar.";
  }

  if (startDate > endDate) {
    return "Tanggal awal tidak boleh melebihi tanggal akhir.";
  }

  return "";
}

function isSafeObjectKey(objectKey: string) {
  return (
    objectKey.startsWith("foto-absen/") &&
    !objectKey.includes("..") &&
    !objectKey.includes("\\") &&
    /^[a-zA-Z0-9/_\-.]+$/.test(objectKey)
  );
}

async function countCleanupCandidates(
  supabaseAdmin: SupabaseAdmin,
  startDate: string,
  endDate: string,
) {
  const { count, error } = await supabaseAdmin
    .from("absensi")
    .select("id", { count: "exact", head: true })
    .gte("tanggal", startDate)
    .lte("tanggal", endDate)
    .not("foto_absen_key", "is", null);

  if (error) throw error;
  return count || 0;
}

async function getOrCreateCleanupLog(
  supabaseAdmin: SupabaseAdmin,
  adminId: string,
  startDate: string,
  endDate: string,
  cleanupId: string,
) {
  if (cleanupId) {
    const { data, error } = await supabaseAdmin
      .from("foto_cleanup_logs")
      .select("*")
      .eq("id", cleanupId)
      .eq("admin_id", adminId)
      .single();

    if (error || !data) {
      throw new Error("Proses penghapusan tidak ditemukan atau tidak valid.");
    }

    if (data.tanggal_awal !== startDate || data.tanggal_akhir !== endDate) {
      throw new Error("Rentang tanggal tidak sesuai dengan proses penghapusan.");
    }

    return data as CleanupLog;
  }

  const totalCandidates = await countCleanupCandidates(
    supabaseAdmin,
    startDate,
    endDate,
  );

  const { data, error } = await supabaseAdmin
    .from("foto_cleanup_logs")
    .insert({
      admin_id: adminId,
      tanggal_awal: startDate,
      tanggal_akhir: endDate,
      jumlah_ditemukan: totalCandidates,
      status: totalCandidates === 0 ? "completed" : "processing",
      completed_at: totalCandidates === 0 ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error || !data) throw error || new Error("Gagal membuat log penghapusan.");
  return data as CleanupLog;
}

async function markCleanupFailed(
  supabaseAdmin: SupabaseAdmin,
  cleanupId: string,
  failedCount: number,
  message: string,
) {
  await supabaseAdmin
    .from("foto_cleanup_logs")
    .update({
      status: "failed",
      jumlah_gagal: Math.max(0, failedCount),
      pesan_error: message.slice(0, 1000),
      completed_at: new Date().toISOString(),
    })
    .eq("id", cleanupId);
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

    const adminId = userData.user.id;
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, status_akun")
      .eq("id", adminId)
      .single();

    if (
      profileError ||
      !profile ||
      profile.role !== "admin" ||
      profile.status_akun !== "aktif"
    ) {
      return jsonResponse(
        { error: "Hanya admin aktif yang dapat menghapus foto." },
        403,
      );
    }

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "history") {
      const { data, error } = await supabaseAdmin
        .from("foto_cleanup_logs")
        .select("id, tanggal_awal, tanggal_akhir, jumlah_ditemukan, jumlah_dihapus, jumlah_gagal, status, pesan_error, created_at, completed_at, profiles!foto_cleanup_logs_admin_id_fkey(nama_lengkap)")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return jsonResponse({ success: true, history: data || [] });
    }

    const startDate = String(body.start_date || "");
    const endDate = String(body.end_date || "");
    const rangeError = validateDateRange(startDate, endDate);

    if (rangeError) return jsonResponse({ error: rangeError }, 400);

    if (action === "preview") {
      const totalFoto = await countCleanupCandidates(
        supabaseAdmin,
        startDate,
        endDate,
      );

      return jsonResponse({
        success: true,
        total_foto: totalFoto,
        estimated_max_bytes: totalFoto * maxFotoSize,
        start_date: startDate,
        end_date: endDate,
      });
    }

    if (action !== "delete") {
      return jsonResponse({ error: "Action tidak dikenali." }, 400);
    }

    if (String(body.confirmation || "") !== confirmationText) {
      return jsonResponse(
        { error: `Ketik ${confirmationText} untuk mengonfirmasi penghapusan.` },
        400,
      );
    }

    const cleanupLog = await getOrCreateCleanupLog(
      supabaseAdmin,
      adminId,
      startDate,
      endDate,
      String(body.cleanup_id || ""),
    );

    if (cleanupLog.status === "completed") {
      return jsonResponse({
        success: true,
        cleanup_id: cleanupLog.id,
        deleted_total: cleanupLog.jumlah_dihapus,
        failed_total: cleanupLog.jumlah_gagal,
        remaining: 0,
        done: true,
      });
    }

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from("absensi")
      .select("id, foto_absen_key")
      .gte("tanggal", startDate)
      .lte("tanggal", endDate)
      .not("foto_absen_key", "is", null)
      .order("tanggal", { ascending: true })
      .limit(deleteBatchSize);

    if (rowsError) {
      await markCleanupFailed(
        supabaseAdmin,
        cleanupLog.id,
        cleanupLog.jumlah_ditemukan - cleanupLog.jumlah_dihapus,
        rowsError.message,
      );
      throw rowsError;
    }

    const candidates = (rows || []).filter((row) =>
      isSafeObjectKey(String(row.foto_absen_key || ""))
    );

    if (candidates.length === 0) {
      const remaining = await countCleanupCandidates(
        supabaseAdmin,
        startDate,
        endDate,
      );
      const completed = remaining === 0;

      await supabaseAdmin
        .from("foto_cleanup_logs")
        .update({
          status: completed ? "completed" : "failed",
          jumlah_gagal: remaining,
          pesan_error: completed
            ? null
            : "Ditemukan object key foto yang tidak valid.",
          completed_at: new Date().toISOString(),
        })
        .eq("id", cleanupLog.id);

      return jsonResponse({
        success: completed,
        cleanup_id: cleanupLog.id,
        deleted_total: cleanupLog.jumlah_dihapus,
        failed_total: remaining,
        remaining,
        done: true,
        error: completed ? undefined : "Sebagian object key foto tidak valid.",
      }, completed ? 200 : 422);
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

    let deleteResult;

    try {
      deleteResult = await r2Client.send(
        new DeleteObjectsCommand({
          Bucket: r2BucketName,
          Delete: {
            Objects: candidates.map((row) => ({
              Key: String(row.foto_absen_key),
            })),
            Quiet: false,
          },
        }),
      );
    } catch (deleteError) {
      const errorMessage =
        deleteError instanceof Error
          ? deleteError.message
          : "Cloudflare R2 gagal menghapus batch foto.";
      await markCleanupFailed(
        supabaseAdmin,
        cleanupLog.id,
        cleanupLog.jumlah_ditemukan - cleanupLog.jumlah_dihapus,
        errorMessage,
      );
      throw deleteError;
    }

    const failedKeys = new Set(
      (deleteResult.Errors || [])
        .map((item) => item.Key)
        .filter((key): key is string => Boolean(key)),
    );
    const successfulRows = candidates.filter(
      (row) => !failedKeys.has(String(row.foto_absen_key)),
    );

    if (successfulRows.length > 0) {
      const successfulIds = successfulRows.map((row) => row.id);
      const { error: updateError } = await supabaseAdmin
        .from("absensi")
        .update({
          foto_absen_key: null,
          foto_absen_url: null,
          foto_dihapus_at: new Date().toISOString(),
          foto_dihapus_oleh: adminId,
        })
        .in("id", successfulIds);

      if (updateError) {
        await markCleanupFailed(
          supabaseAdmin,
          cleanupLog.id,
          cleanupLog.jumlah_ditemukan - cleanupLog.jumlah_dihapus,
          `Objek R2 terhapus tetapi database gagal diperbarui: ${updateError.message}`,
        );
        throw updateError;
      }
    }

    const deletedTotal =
      Number(cleanupLog.jumlah_dihapus || 0) + successfulRows.length;
    const remaining = await countCleanupCandidates(
      supabaseAdmin,
      startDate,
      endDate,
    );
    const noProgress = successfulRows.length === 0 && remaining > 0;
    const done = remaining === 0 || noProgress;
    const failedTotal = noProgress ? remaining : 0;

    await supabaseAdmin
      .from("foto_cleanup_logs")
      .update({
        jumlah_dihapus: deletedTotal,
        jumlah_gagal: failedTotal,
        status: remaining === 0 ? "completed" : noProgress ? "failed" : "processing",
        pesan_error: noProgress
          ? "Cloudflare R2 menolak penghapusan sebagian foto."
          : null,
        completed_at: done ? new Date().toISOString() : null,
      })
      .eq("id", cleanupLog.id);

    return jsonResponse({
      success: !noProgress,
      cleanup_id: cleanupLog.id,
      deleted_in_batch: successfulRows.length,
      deleted_total: deletedTotal,
      failed_in_batch: failedKeys.size,
      failed_total: failedTotal,
      remaining,
      done,
      error: noProgress
        ? "Penghapusan berhenti karena Cloudflare R2 menolak object yang tersisa."
        : undefined,
    }, noProgress ? 502 : 200);
  } catch (error) {
    console.error("R2 cleanup error:", error);

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat menghapus foto absensi.",
      },
      500,
    );
  }
});

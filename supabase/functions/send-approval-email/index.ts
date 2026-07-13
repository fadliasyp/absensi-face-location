import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function labelRole(role: string) {
  return role === "admin" ? "Admin" : "Pegawai";
}

function labelStatus(status: string) {
  if (status === "aktif") return "Aktif";
  if (status === "ditolak") return "Ditolak";
  return "Menunggu persetujuan";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method tidak diizinkan." }, 405);
  }

  let client: SMTPClient | null = null;

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return jsonResponse({ error: "Authorization header tidak ditemukan." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SERVICE_ROLE_KEY");
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Environment Supabase belum lengkap." }, 500);
    }

    if (!gmailUser || !gmailAppPassword) {
      return jsonResponse({ error: "Environment Gmail belum diatur." }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: callerData, error: callerError } =
      await supabaseAdmin.auth.getUser(token);

    if (callerError || !callerData.user) {
      return jsonResponse({ error: "Token login tidak valid." }, 401);
    }

    const body = await req.json();
    const action = body.action || "approval";
    const callerId = callerData.user.id;

    const { data: callerProfile, error: callerProfileError } =
      await supabaseAdmin
        .from("profiles")
        .select("id, role, status_akun")
        .eq("id", callerId)
        .single();

    if (callerProfileError || !callerProfile) {
      return jsonResponse({ error: "Profil pemanggil tidak ditemukan." }, 403);
    }

    client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailAppPassword,
        },
      },
    });

    if (action === "new_registration") {
      const userId = body.user_id;

      if (!userId || userId !== callerId) {
        return jsonResponse(
          { error: "User hanya dapat mengirim notifikasi registrasinya sendiri." },
          403,
        );
      }

      const { data: newUser, error: newUserError } = await supabaseAdmin
        .from("profiles")
        .select("nama_lengkap, nik, bagian, email, status_akun")
        .eq("id", userId)
        .single();

      if (newUserError || !newUser) {
        return jsonResponse({ error: "Data pengguna baru tidak ditemukan." }, 404);
      }

      if (newUser.status_akun !== "pending") {
        return jsonResponse(
          { error: "Notifikasi hanya berlaku untuk registrasi yang masih pending." },
          400,
        );
      }

      const { data: admins, error: adminsError } = await supabaseAdmin
        .from("profiles")
        .select("nama_lengkap, email")
        .eq("role", "admin")
        .eq("status_akun", "aktif")
        .not("email", "is", null);

      if (adminsError) {
        throw adminsError;
      }

      const adminList = (admins || []).filter((admin) => admin.email);

      if (adminList.length === 0) {
        return jsonResponse({ error: "Email admin aktif tidak ditemukan." }, 404);
      }

      for (const admin of adminList) {
        await client.send({
          from: `Sistem Absensi <${gmailUser}>`,
          to: admin.email,
          subject: "Registrasi Pegawai Baru Menunggu Persetujuan",
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2>Registrasi Pegawai Baru</h2>
              <p>Halo <strong>${escapeHtml(admin.nama_lengkap || "Admin")}</strong>,</p>
              <p>Terdapat akun pegawai baru yang menunggu persetujuan.</p>
              <table style="border-collapse: collapse;">
                <tr><td style="padding: 4px 12px 4px 0;"><strong>Nama</strong></td><td>${escapeHtml(newUser.nama_lengkap)}</td></tr>
                <tr><td style="padding: 4px 12px 4px 0;"><strong>NIK</strong></td><td>${escapeHtml(newUser.nik || "-")}</td></tr>
                <tr><td style="padding: 4px 12px 4px 0;"><strong>Bagian</strong></td><td>${escapeHtml(newUser.bagian || "-")}</td></tr>
                <tr><td style="padding: 4px 12px 4px 0;"><strong>Email</strong></td><td>${escapeHtml(newUser.email)}</td></tr>
              </table>
              <p>Silakan buka halaman Data User untuk meninjau akun tersebut.</p>
            </div>
          `,
        });
      }

      return jsonResponse({
        success: true,
        message: `Notifikasi dikirim ke ${adminList.length} admin.`,
      });
    }

    if (callerProfile.role !== "admin" || callerProfile.status_akun !== "aktif") {
      return jsonResponse(
        { error: "Akses ditolak. Hanya admin aktif yang dapat mengirim email ini." },
        403,
      );
    }

    if (action === "account_updated") {
      const userId = body.user_id;

      if (!userId) {
        return jsonResponse({ error: "user_id wajib dikirim." }, 400);
      }

      const { data: updatedUser, error: updatedUserError } = await supabaseAdmin
        .from("profiles")
        .select("nama_lengkap, email, role, status_akun")
        .eq("id", userId)
        .single();

      if (updatedUserError || !updatedUser?.email) {
        return jsonResponse({ error: "Email pengguna tidak ditemukan." }, 404);
      }

      const previousRole = body.previous_role;
      const previousStatus = body.previous_status;

      await client.send({
        from: `Sistem Absensi <${gmailUser}>`,
        to: updatedUser.email,
        subject: "Perubahan Data Akun Absensi",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2>Data Akun Anda Telah Diperbarui</h2>
            <p>Halo <strong>${escapeHtml(updatedUser.nama_lengkap)}</strong>,</p>
            <p>Admin telah memperbarui role atau status akun absensi Anda.</p>
            <table style="border-collapse: collapse;">
              <tr>
                <td style="padding: 4px 12px 4px 0;"><strong>Role</strong></td>
                <td>${escapeHtml(labelRole(previousRole))} &rarr; <strong>${escapeHtml(labelRole(updatedUser.role))}</strong></td>
              </tr>
              <tr>
                <td style="padding: 4px 12px 4px 0;"><strong>Status</strong></td>
                <td>${escapeHtml(labelStatus(previousStatus))} &rarr; <strong>${escapeHtml(labelStatus(updatedUser.status_akun))}</strong></td>
              </tr>
            </table>
            <p>Silakan login kembali untuk menggunakan hak akses terbaru.</p>
          </div>
        `,
      });

      return jsonResponse({
        success: true,
        message: "Email perubahan akun berhasil dikirim.",
      });
    }

    const { email, nama_lengkap } = body;

    if (!email || !nama_lengkap) {
      return jsonResponse(
        { error: "Email dan nama_lengkap wajib dikirim." },
        400,
      );
    }

    await client.send({
      from: `Admin Absensi <${gmailUser}>`,
      to: email,
      subject: "Akun Absensi Anda Telah Disetujui",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Akun Anda Telah Disetujui</h2>
          <p>Halo <strong>${escapeHtml(nama_lengkap)}</strong>,</p>
          <p>Akun absensi Anda telah disetujui oleh admin.</p>
          <p>Silakan login ke sistem absensi untuk mulai menggunakan fitur absensi.</p>
          <p>Terima kasih.</p>
        </div>
      `,
    });

    return jsonResponse({ success: true, message: "Email berhasil dikirim." });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan." },
      500,
    );
  } finally {
    if (client) {
      try {
        await client.close();
      } catch {
        // Koneksi mungkin sudah tertutup oleh server SMTP.
      }
    }
  }
});

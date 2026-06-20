import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, nama_lengkap } = await req.json();

    if (!email || !nama_lengkap) {
      return new Response(
        JSON.stringify({ error: "Email dan nama_lengkap wajib dikirim." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailUser || !gmailAppPassword) {
      return new Response(
        JSON.stringify({ error: "Environment Gmail belum diatur." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const client = new SMTPClient({
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

    await client.send({
      from: `Admin Absensi <${gmailUser}>`,
      to: email,
      subject: "Akun Absensi Anda Telah Disetujui",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Akun Anda Telah Disetujui</h2>
          <p>Halo <strong>${nama_lengkap}</strong>,</p>
          <p>Akun absensi Anda telah disetujui oleh admin.</p>
          <p>Silakan login ke sistem absensi untuk mulai menggunakan fitur absensi.</p>
          <p>Terima kasih.</p>
        </div>
      `,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true, message: "Email berhasil dikirim." }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
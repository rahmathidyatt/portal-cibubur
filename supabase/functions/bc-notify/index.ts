// Edge function "bc-notify": dipanggil pg_cron tiap menit. Mencari BC terjadwal yang sudah
// waktunya dan belum diberitahukan, lalu mengirim notifikasi (Web Push) ke HP admin.
// Kunci VAPID disimpan di tabel private_settings (hanya bisa dibaca service role).
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined)
    }
  });
}

Deno.serve(async () => {
  try {
    const now = new Date().toISOString();
    const dueRes = await rest(
      `bc_schedules?select=id,title&status=eq.active&notified_at=is.null&next_at=lte.${encodeURIComponent(now)}&order=next_at.asc&limit=20`
    );
    const due = (await dueRes.json()) as { id: string; title: string }[];
    if (!Array.isArray(due) || due.length === 0) return Response.json({ sent: 0 });

    const keysRes = await rest('private_settings?select=key,value&key=in.(vapid_public,vapid_private)');
    const keys = Object.fromEntries(((await keysRes.json()) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
    webpush.setVapidDetails('https://portal-cibubur.netlify.app', keys.vapid_public, keys.vapid_private);

    const subsRes = await rest('push_subscriptions?select=endpoint,p256dh,auth');
    const subs = (await subsRes.json()) as { endpoint: string; p256dh: string; auth: string }[];

    const payload = JSON.stringify({
      title: due.length === 1 ? 'BC siap dikirim' : `${due.length} BC siap dikirim`,
      body: due.map((d) => d.title).join(' · ').slice(0, 180),
      url: '/#staf-bc'
    });

    let sent = 0;
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        // Langganan kedaluwarsa / dicabut: hapus agar tidak dicoba lagi.
        if (code === 404 || code === 410) {
          await rest(`push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: 'DELETE' });
        } else console.error('push gagal', code, err);
      }
    }

    await rest(`bc_schedules?id=in.(${due.map((d) => d.id).join(',')})`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ notified_at: now })
    });
    return Response.json({ due: due.length, sent });
  } catch (err) {
    console.error(err);
    return Response.json({ error: 'failed' }, { status: 500 });
  }
});

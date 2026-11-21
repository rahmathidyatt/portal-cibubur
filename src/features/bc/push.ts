import type { AdminAuth } from '../../services/bookingStore';
import { getBcStore } from './bcStore';

/** Kunci publik VAPID (pasangan kunci privatnya hanya ada di server Supabase). */
const VAPID_PUBLIC_KEY = 'BNbFmhoczle077CPTMUPWpWujhXP23hYMkfRDHL2dI5kWesnBkvJdsDip0xZJaOEvI0r2b0e3GUFkfPFkE0CDnc';

export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on';

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function getPushState(): Promise<PushState> {
  if (!('Notification' in window) || !('PushManager' in window)) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  if (!reg) return 'unsupported';
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
}

function keyBytes(base64url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Minta izin notifikasi & daftarkan perangkat ini untuk pemberitahuan BC. */
export async function enablePush(auth: AdminAuth): Promise<PushState> {
  const reg = await registration();
  if (!reg) throw new Error('Notifikasi belum didukung di browser/perangkat ini.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) as BufferSource }));
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error('Gagal mendaftarkan perangkat.');
  await getBcStore().savePushSubscription({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth }, auth);
  return 'on';
}

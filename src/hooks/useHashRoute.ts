import { useEffect, useState } from 'react';
import { FEATURES } from '../data/features';

export type PortalRoute = 'beranda' | 'dealing-room' | 'floortime' | 'staf-floor-time' | 'staf-nota' | 'staf-statistik' | 'staf-jingle' | 'staf-ulang-tahun' | 'staf-training' | 'staf-medpro' | 'staf-minbur' | 'staf-bright-day' | 'staf-bright-day-hadir' | 'staf-closing' | 'staf-wof' | 'staf-training-tracking' | 'staf-closing-rekap' | 'staf-medpro-rekap' | 'staf-bc' | 'staf-closing-reward' | 'staf-medpro-input' | 'notes';

const PAGE_ROUTES: PortalRoute[] = [
  ...(FEATURES.dealingRoom ? (['dealing-room'] as PortalRoute[]) : []),
  'floortime',
  'staf-floor-time',
  'staf-nota',
  'staf-statistik',
  'staf-jingle',
  'staf-ulang-tahun',
  'staf-training',
  'staf-medpro',
  'staf-minbur',
  'staf-bright-day',
  'staf-bright-day-hadir',
  'staf-closing',
  'staf-wof',
  'staf-training-tracking',
  'staf-closing-rekap',
  'staf-medpro-rekap',
  'staf-bc',
  'staf-closing-reward',
  'staf-medpro-input',
  'notes'
];

/** Alamat lama yang diarahkan ke halaman baru. */
const ALIASES: Record<string, PortalRoute> = { 'staf-admin': 'staf-statistik', admin: 'staf-statistik' };

export function isStaffRoute(route: PortalRoute): boolean {
  return route.startsWith('staf-');
}

function readHash(): string {
  try {
    return decodeURIComponent(window.location.hash.replace(/^#/, ''));
  } catch {
    return '';
  }
}

/**
 * Navigasi sederhana berbasis hash:
 * - #dealing-room dan #floortime membuka halaman reservasi masing-masing.
 * - #staf-* membuka area admin (wajib login admin); #staf-admin diarahkan ke #staf-statistik.
 * - Hash lain (#beranda, #kontak-staf, #jam-operasional) membuka beranda
 *   lalu menggulir ke bagian tersebut.
 */
export function useHashRoute(): { route: PortalRoute; anchor: string } {
  const [hash, setHash] = useState<string>(readHash);

  useEffect(() => {
    const onChange = () => setHash(readHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const route: PortalRoute = (PAGE_ROUTES as string[]).includes(hash)
    ? (hash as PortalRoute)
    : (ALIASES[hash] ?? 'beranda');

  // Setelah berpindah halaman: halaman reservasi mulai dari atas,
  // anchor beranda digulir setelah bagian tersebut ter-render.
  useEffect(() => {
    if (route !== 'beranda') {
      window.scrollTo(0, 0);
      return;
    }
    if (hash) {
      requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
    }
  }, [route, hash]);

  return { route, anchor: hash };
}

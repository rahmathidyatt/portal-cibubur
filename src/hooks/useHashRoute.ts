import { useEffect, useState } from 'react';

export type PortalRoute = 'beranda' | 'dealing-room' | 'floortime' | 'staf-floor-time' | 'staf-nota' | 'staf-admin';

const PAGE_ROUTES: PortalRoute[] = ['dealing-room', 'floortime', 'staf-floor-time', 'staf-nota', 'staf-admin'];

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
 * - #staf-admin, #staf-floor-time dan #staf-nota membuka alat staf (wajib login admin).
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
    : 'beranda';

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

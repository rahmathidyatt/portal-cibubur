import { useEffect } from 'react';
import { translateTexts } from '../services/aiClient';
import { readLocal, writeLocal } from '../services/supabaseClient';
import { needsTranslation, translateStatic } from './translateText';

/**
 * Menerjemahkan teks halaman publik ke bahasa Inggris langsung di tampilan:
 * kamus statis dulu, sisanya (mis. pengumuman/FAQ yang diketik admin) lewat Gemini
 * dengan cache. Elemen bertanda translate="no" / .notranslate dilewati.
 * Saat kembali ke Bahasa Indonesia, teks asli dipulihkan.
 */

const CACHE_KEY = 'portal-cibubur:tr-en';
const ATTRS = ['placeholder', 'title'] as const;
const SKIP_SELECTOR = '[translate="no"], .notranslate, script, style, textarea, code, [contenteditable="true"]';

const memory = new Map<string, string>(Object.entries(readLocal<Record<string, string>>(CACHE_KEY, {})));
const failed = new Set<string>();

function persist() {
  const entries = [...memory.entries()].slice(-3000);
  writeLocal(CACHE_KEY, Object.fromEntries(entries));
}

function split(raw: string): { lead: string; core: string; trail: string } {
  const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
  return { lead: m[1], core: m[2], trail: m[3] };
}

/** Terjemahan yang sudah tersedia (kamus/cache), atau null bila perlu Gemini, atau undefined bila tak perlu. */
function lookup(core: string): string | null | undefined {
  if (!needsTranslation(core)) return undefined;
  const s = translateStatic(core);
  if (s !== null) return s;
  const c = memory.get(core);
  if (c !== undefined) return c;
  return failed.has(core) ? undefined : null;
}

function skipped(el: Element | null): boolean {
  return !el || el.closest(SKIP_SELECTOR) !== null || el.closest('[data-admin-area]') !== null;
}

export function useAutoTranslate(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const root = document.body;
    const originals = new Map<Text, string>();
    const written = new WeakMap<Text, string>();
    const attrOriginals = new Map<Element, Partial<Record<(typeof ATTRS)[number], string>>>();
    const queue = new Set<string>();
    let timer: number | undefined;
    let stopped = false;

    const applyText = (node: Text) => {
      if (skipped(node.parentElement)) return;
      const raw = node.data;
      if (written.get(node) === raw) return;
      const { lead, core, trail } = split(raw);
      if (!core) return;
      const t = lookup(core);
      if (t === undefined) return;
      originals.set(node, raw);
      if (t === null) {
        queue.add(core);
        schedule();
        return;
      }
      const next = lead + t + trail;
      written.set(node, next);
      if (node.data !== next) node.data = next;
    };

    const applyAttrs = (el: Element) => {
      if (skipped(el)) return;
      for (const attr of ATTRS) {
        const value = el.getAttribute(attr);
        if (!value) continue;
        const saved = attrOriginals.get(el) ?? {};
        const source = saved[attr] !== undefined && el.getAttribute(`data-tr-${attr}`) === value ? saved[attr]! : value;
        const t = lookup(source.trim());
        if (t === undefined) continue;
        saved[attr] = source;
        attrOriginals.set(el, saved);
        if (t === null) {
          queue.add(source.trim());
          schedule();
          continue;
        }
        el.setAttribute(`data-tr-${attr}`, t);
        if (value !== t) el.setAttribute(attr, t);
      }
    };

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) return applyText(node as Text);
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      if (skipped(el)) return;
      applyAttrs(el);
      el.querySelectorAll('[placeholder], [title]').forEach(applyAttrs);
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = tw.nextNode(); n; n = tw.nextNode()) applyText(n as Text);
    };

    function schedule() {
      if (timer !== undefined) return;
      timer = window.setTimeout(() => void flush(), 350);
    }

    async function flush() {
      timer = undefined;
      const batch = [...queue].slice(0, 60);
      batch.forEach((t) => queue.delete(t));
      if (batch.length === 0) return;
      const out = await translateTexts(batch);
      batch.forEach((src, i) => {
        const t = out?.[i];
        if (t) memory.set(src, t);
        else failed.add(src); // AI belum aktif/gagal: biarkan teks asli.
      });
      if (out) persist();
      if (stopped) return;
      walk(root);
      if (queue.size > 0) schedule();
    }

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData') applyText(m.target as Text);
        else if (m.type === 'attributes') applyAttrs(m.target as Element);
        else m.addedNodes.forEach(walk);
      }
    });
    walk(root);
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS]
    });

    return () => {
      stopped = true;
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
      // Pulihkan teks asli (hanya yang masih berisi terjemahan kita).
      originals.forEach((raw, node) => {
        if (node.isConnected && written.get(node) === node.data) node.data = raw;
      });
      attrOriginals.forEach((saved, el) => {
        for (const attr of ATTRS) {
          const src = saved[attr];
          if (src !== undefined && el.getAttribute(attr) === el.getAttribute(`data-tr-${attr}`)) el.setAttribute(attr, src);
          el.removeAttribute(`data-tr-${attr}`);
        }
      });
    };
  }, [enabled]);
}

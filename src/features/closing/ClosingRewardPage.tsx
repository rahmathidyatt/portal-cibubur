import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Gift, Search } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useToast } from '../../hooks/useToast';
import { ConfirmCancelButton } from '../../components/ConfirmCancelButton';
import { todayInJakarta } from '../../utils/schedule';
import { formatClosingDate, type Closing } from './closing';
import { CLOSINGS_CHANGED, getClosingStore } from './closingStore';
import { rewardEntries, type RewardClaim, type RewardEntry, type RewardStatus } from './closingReward';
import { getRewardStore, validateClaimer } from './rewardStore';

const input =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';
const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-50 cursor-pointer';

type Filter = 'semua' | RewardStatus;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'open', label: 'Belum diklaim' },
  { id: 'claimed', label: 'Sudah diklaim' },
  { id: 'expired', label: 'Expired' }
];

const roleLabel = (r: string) => (r === 'PL' ? 'Project Leader' : r === 'L/S' ? 'Listing & Selling' : r === 'L' ? 'Listing' : 'Selling');

function StatusBadge({ e }: { e: RewardEntry }) {
  if (e.status === 'claimed')
    return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">Sudah diklaim</span>;
  if (e.status === 'expired')
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">Expired</span>;
  return (
    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
      {e.daysLeft === 0 ? 'Hari terakhir' : `Sisa ${e.daysLeft} hari`}
    </span>
  );
}

/** Menu admin Closing › Closing Reward: hak reward agen Cibubur per closing, klaim & batas waktunya. */
export const ClosingRewardPage: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const [closings, setClosings] = useState<Closing[] | null>(null);
  const [claims, setClaims] = useState<RewardClaim[]>([]);
  const [filter, setFilter] = useState<Filter>('open');
  const [query, setQuery] = useState('');
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimer, setClaimer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const today = todayInJakarta();

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([getClosingStore().list(), getRewardStore().list(auth)]);
      setClosings(c);
      setClaims(r);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal memuat closing reward.', 'error');
      setClosings([]);
    }
  }, [auth, toast]);

  useEffect(() => {
    void load();
    window.addEventListener(CLOSINGS_CHANGED, load);
    return () => window.removeEventListener(CLOSINGS_CHANGED, load);
  }, [load]);

  const entries = useMemo(() => rewardEntries(closings ?? [], claims, today), [closings, claims, today]);
  const counts = useMemo(
    () => ({
      open: entries.filter((e) => e.status === 'open').length,
      claimed: entries.filter((e) => e.status === 'claimed').length,
      expired: entries.filter((e) => e.status === 'expired').length
    }),
    [entries]
  );
  const q = query.trim().toLowerCase();
  const shown = entries.filter(
    (e) =>
      (filter === 'semua' || e.status === filter) &&
      (!q || `${e.agent.name} ${e.agent.code} ${e.closing.location} ${e.claim?.claimedBy ?? ''}`.toLowerCase().includes(q))
  );

  // Kelompokkan per closing (urutan mengikuti daftar yang sudah diurutkan).
  const groups: { closing: Closing; items: RewardEntry[] }[] = [];
  for (const e of shown) {
    const g = groups.find((x) => x.closing.id === e.closing.id);
    if (g) g.items.push(e);
    else groups.push({ closing: e.closing, items: [e] });
  }

  const startClaim = (e: RewardEntry) => {
    setClaiming(e.key);
    setClaimer(e.agent.name);
    setError(null);
  };

  const saveClaim = async (e: RewardEntry) => {
    const problem = validateClaimer(claimer);
    if (problem) return setError(problem);
    try {
      await getRewardStore().claim({ closingId: e.closing.id, agentKey: e.agentKey, claimedBy: claimer.trim(), claimedAt: today }, auth);
      toast(`Reward ${e.agent.name} ditandai sudah diklaim.`);
      setClaiming(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan klaim.');
    }
  };

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-xs text-slate-500">Operasional · Closing</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-slate-950">
          <Gift className="h-6 w-6 text-amber-600" aria-hidden="true" />
          Closing Reward
        </h1>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Belum diklaim', value: counts.open, cls: 'text-amber-700' },
            { label: 'Sudah diklaim', value: counts.claimed, cls: 'text-emerald-700' },
            { label: 'Expired', value: counts.expired, cls: 'text-slate-500' }
          ].map((m) => (
            <div key={m.label} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <p className="text-xs font-semibold text-slate-500">{m.label}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${m.cls}`}>{m.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter status">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold cursor-pointer ${
                  filter === f.id ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari agen / properti" aria-label="Cari" className={`${input} pl-9`} />
          </label>
        </div>

        {closings === null ? (
          <p className="py-16 text-center text-sm text-slate-500">Memuat…</p>
        ) : groups.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-white px-4 py-10 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            {entries.length === 0
              ? 'Belum ada closing agen Cibubur, Bogor dalam periode event.'
              : 'Tidak ada reward dengan filter ini.'}
          </p>
        ) : (
          <ul className="mt-5 space-y-4">
            {groups.map(({ closing, items }) => (
              <li key={closing.id} className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 bg-stone-50/70 px-4 py-3">
                  <p className="text-sm font-bold text-slate-950">
                    {closing.type} – {closing.location.toUpperCase()}
                  </p>
                  <p className="text-xs text-slate-600">
                    Closing {formatClosingDate(closing.date)} · batas klaim <b>{formatClosingDate(items[0].deadline)}</b>
                  </p>
                </div>
                <ul className="divide-y divide-slate-100">
                  {items.map((e) => (
                    <li key={e.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">
                          {e.agent.name}
                          {e.agent.code && <span className="ml-1.5 font-mono text-xs font-semibold text-slate-500">{e.agent.code}</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {roleLabel(e.agent.role)} · {e.agent.unit || '—'}
                        </p>
                        {e.claim && (
                          <p className="mt-0.5 text-xs text-emerald-800">
                            Diklaim oleh <b>{e.claim.claimedBy}</b> · {formatClosingDate(e.claim.claimedAt)}
                          </p>
                        )}
                      </div>
                      <StatusBadge e={e} />
                      {e.status === 'open' && claiming !== e.key && (
                        <button type="button" onClick={() => startClaim(e)} className={primaryBtn}>
                          <Check className="h-3.5 w-3.5" /> Tandai diklaim
                        </button>
                      )}
                      {e.status === 'claimed' && (
                        <ConfirmCancelButton
                          label="Batalkan klaim"
                          confirmLabel="Ya, batalkan"
                          onConfirm={async () => {
                            await getRewardStore().unclaim(e.closing.id, e.agentKey, auth);
                            toast('Klaim dibatalkan.');
                            await load();
                          }}
                        />
                      )}
                      {claiming === e.key && (
                        <form
                          className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
                          onSubmit={(ev) => {
                            ev.preventDefault();
                            void saveClaim(e);
                          }}
                        >
                          <input
                            autoFocus
                            value={claimer}
                            maxLength={120}
                            onChange={(ev) => setClaimer(ev.target.value)}
                            aria-label="Diklaim oleh"
                            placeholder="Nama yang mengklaim"
                            className={`${input} sm:w-56`}
                          />
                          <button type="submit" className={primaryBtn}>
                            Simpan
                          </button>
                          <button type="button" onClick={() => setClaiming(null)} className="px-2 py-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                            Batal
                          </button>
                          {error && <p className="w-full text-xs font-semibold text-red-700">{error}</p>}
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Phone, Copy, Check } from 'lucide-react';
import type {
  OfficeStaffContact,
  StaffAvailabilityStatus,
  StaffDivision
} from '../data/cibuburData';
import { getContentStore, type StaffStatus } from '../services/contentStore';
import { useAdmin } from '../hooks/useAdmin';
import { todayInJakarta } from '../utils/schedule';
import {
  buildWhatsAppChatUrl,
  buildCustomStaffWhatsAppMessage,
  filterStaffByDivision
} from '../utils/hubLogic';

interface StaffWhatsAppDirectoryProps {
  contacts: OfficeStaffContact[];
}

const DIVISION_TABS: ('Semua' | StaffDivision)[] = [
  'Semua',
  'Operasional',
  'Keuangan',
  'Kurir & Dokumen'
];

const STATUS_STYLE: Record<StaffAvailabilityStatus, { dot: string; text: string }> = {
  Online: { dot: 'bg-emerald-500', text: 'text-emerald-700' },
  Sibuk: { dot: 'bg-amber-500', text: 'text-amber-700' },
  'Di Luar Kantor': { dot: 'bg-slate-400', text: 'text-slate-600' }
};

const STATUS_OPTIONS: StaffAvailabilityStatus[] = ['Online', 'Sibuk', 'Di Luar Kantor'];

function formatTimeWib(iso: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(iso));
}

/** Status hanya ditampilkan jika diperbarui hari ini, agar tidak menampilkan status basi. */
function isFromToday(iso: string): boolean {
  return todayInJakarta(new Date(iso)) === todayInJakarta();
}

const StaffStatusEditor: React.FC<{
  staffId: string;
  current?: StaffStatus;
  onSaved: () => void;
}> = ({ staffId, current, onSaved }) => {
  const { auth } = useAdmin();
  const [status, setStatus] = useState<StaffAvailabilityStatus>(current?.status ?? 'Online');
  const [detail, setDetail] = useState<string>(current?.detail ?? '');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await getContentStore().setStaffStatus({ staffId, status, detail }, auth);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan status.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-dashed border-slate-300 p-3 space-y-2">
      <p className="text-[11px] font-semibold text-slate-500">Admin · ubah status</p>
      <div className="flex gap-2">
        <select
          aria-label="Status staf"
          value={status}
          onChange={(e) => setStatus(e.target.value as StaffAvailabilityStatus)}
          className="px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <input
          aria-label="Keterangan status"
          value={detail}
          maxLength={80}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Keterangan (opsional)"
          className="min-w-0 flex-1 px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        {error ? <p className="text-[11px] text-red-700">{error}</p> : <span />}
        <button
          type="button"
          disabled={busy}
          onClick={handleSave}
          className="px-3 py-1 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-60 cursor-pointer"
        >
          {busy ? 'Menyimpan…' : 'Simpan status'}
        </button>
      </div>
    </div>
  );
};

export const StaffWhatsAppDirectory: React.FC<StaffWhatsAppDirectoryProps> = ({ contacts }) => {
  const [selectedDivision, setSelectedDivision] = useState<'Semua' | StaffDivision>('Semua');
  const [senderName, setSenderName] = useState<string>('');
  const [selectedTopics, setSelectedTopics] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<StaffStatus[]>([]);
  const { isAdmin } = useAdmin();

  const loadStatuses = useCallback(async () => {
    try {
      setStatuses(await getContentStore().listStaffStatuses());
    } catch {
      setStatuses([]);
    }
  }, []);

  useEffect(() => {
    void loadStatuses();
  }, [loadStatuses]);

  const visibleContacts = filterStaffByDivision(contacts, selectedDivision);

  const handleSelectTopic = (contactId: string, topic: string) => {
    setSelectedTopics((prev) => ({
      ...prev,
      [contactId]: prev[contactId] === topic ? '' : topic
    }));
  };

  const handleCopyNumber = (contact: OfficeStaffContact) => {
    navigator.clipboard?.writeText(contact.phoneDisplay).catch(() => {});
    setCopiedId(contact.id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === contact.id ? null : prev));
    }, 2000);
  };

  return (
    <section id="kontak-staf" className="scroll-mt-20 py-12 sm:py-16 bg-white border-b border-slate-200">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Kontak staf kantor
            </h2>
            <p className="mt-2 text-base text-slate-600 max-w-xl">
              Pilih keperluan, lalu chat langsung lewat WhatsApp. Pesannya terisi otomatis.
            </p>
          </div>

          <div
            role="group"
            aria-label="Filter divisi staf"
            className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-xl self-start"
          >
            {DIVISION_TABS.map((tab) => {
              const active = selectedDivision === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedDivision(tab)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 max-w-sm">
          <label htmlFor="agent-sender-name" className="block text-xs font-semibold text-slate-600 mb-1">
            Nama Anda (opsional, dicantumkan di pesan)
          </label>
          <input
            id="agent-sender-name"
            type="text"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            placeholder="Mis. Andi – Property Advisor"
            className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          {visibleContacts.map((contact) => {
            const chosenTopic = selectedTopics[contact.id] || '';
            const message = buildCustomStaffWhatsAppMessage(contact, chosenTopic, senderName);
            const whatsappUrl = buildWhatsAppChatUrl(contact.whatsappNumber, message);
            const isCopied = copiedId === contact.id;
            const staffStatus = statuses.find((st) => st.staffId === contact.id);
            const showStatus = staffStatus && isFromToday(staffStatus.updatedAt);

            return (
              <article
                key={contact.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col"
              >
                <p className="text-xs font-semibold text-amber-700">{contact.division}</p>
                <h3 className="mt-1 text-lg font-bold text-slate-950">{contact.staffName}</h3>
                <p className="text-xs text-slate-500">{contact.roleTitle}</p>

                {showStatus && staffStatus && (
                  <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs">
                    <span
                      aria-hidden="true"
                      className={`w-2 h-2 rounded-full ${STATUS_STYLE[staffStatus.status].dot}`}
                    />
                    <span className={`font-semibold ${STATUS_STYLE[staffStatus.status].text}`}>
                      {staffStatus.status}
                    </span>
                    {staffStatus.detail && (
                      <span className="text-slate-500">· {staffStatus.detail}</span>
                    )}
                    <span className="text-slate-400">
                      · diperbarui {formatTimeWib(staffStatus.updatedAt)}
                    </span>
                  </p>
                )}
                {isAdmin && (
                  <StaffStatusEditor
                    key={`${contact.id}-${staffStatus?.updatedAt ?? 'new'}`}
                    staffId={contact.id}
                    current={staffStatus}
                    onSaved={loadStatuses}
                  />
                )}

                <p className="mt-3 text-sm text-slate-600 leading-relaxed">{contact.description}</p>

                <fieldset className="mt-4">
                  <legend className="text-xs font-semibold text-slate-600 mb-2">Keperluan</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.commonTasks.map((task) => {
                      const isSelected = chosenTopic === task;
                      return (
                        <button
                          key={task}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => handleSelectTopic(contact.id, task)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-amber-50 border-amber-400 text-slate-950'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          {task}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="mt-auto pt-5 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-mono text-slate-700">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {contact.phoneDisplay}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyNumber(contact)}
                      aria-label={`Salin nomor ${contact.staffName}`}
                      className="inline-flex items-center gap-1 font-bold text-slate-600 hover:text-slate-950 cursor-pointer"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Salin
                        </>
                      )}
                    </button>
                  </div>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Chat WhatsApp
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

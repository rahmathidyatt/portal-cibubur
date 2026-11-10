import React, { useState } from 'react';
import {
  MessageCircle,
  Phone,
  Copy,
  Check,
  ExternalLink,
  UserCheck
} from 'lucide-react';
import {
  OfficeStaffContact,
  StaffDivision,
  StaffAvailabilityStatus,
  STAFF_STATUS_LEGEND
} from '../data/cibuburData';
import {
  buildWhatsAppChatUrl,
  buildCustomStaffWhatsAppMessage,
  filterStaffByDivision,
  cycleStaffAvailability
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

function getStatusVisualStyle(status: StaffAvailabilityStatus): {
  dotClass: string;
  textClass: string;
  label: string;
} {
  if (status === 'Online') {
    return {
      dotClass: 'bg-emerald-600 ring-2 ring-emerald-600/25',
      textClass: 'text-emerald-800',
      label: 'Online'
    };
  }
  if (status === 'Sibuk') {
    return {
      dotClass: 'bg-amber-600 ring-2 ring-amber-600/25',
      textClass: 'text-amber-800',
      label: 'Sibuk'
    };
  }
  return {
    dotClass: 'bg-slate-400 ring-2 ring-slate-400/25',
    textClass: 'text-slate-600',
    label: 'Di Luar Kantor'
  };
}

export const StaffWhatsAppDirectory: React.FC<StaffWhatsAppDirectoryProps> = ({
  contacts
}) => {
  const [staffList, setStaffList] = useState<OfficeStaffContact[]>(contacts);
  const [selectedDivision, setSelectedDivision] = useState<'Semua' | StaffDivision>('Semua');
  const [senderName, setSenderName] = useState<string>('');
  const [selectedTopics, setSelectedTopics] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeWhatsAppLog, setActiveWhatsAppLog] = useState<{
    division: string;
    staffName: string;
    phone: string;
    message: string;
    url: string;
  } | null>(null);

  const visibleContacts = filterStaffByDivision(staffList, selectedDivision);

  const handleToggleAvailability = (contactId: string) => {
    setStaffList((prev) =>
      prev.map((c) => {
        if (c.id !== contactId) return c;
        const next = cycleStaffAvailability(c.availabilityStatus);
        return {
          ...c,
          availabilityStatus: next.status,
          availabilityDetail: next.detail
        };
      })
    );
  };

  const handleSelectTopic = (contactId: string, topic: string) => {
    setSelectedTopics((prev) => ({
      ...prev,
      [contactId]: prev[contactId] === topic ? '' : topic
    }));
  };

  const handleCopyNumber = (contact: OfficeStaffContact) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(contact.phoneDisplay).catch(() => {});
    }
    setCopiedId(contact.id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === contact.id ? null : prev));
    }, 2000);
  };

  const handleRecordWhatsAppClick = (
    contact: OfficeStaffContact,
    message: string,
    url: string
  ) => {
    setActiveWhatsAppLog({
      division: contact.division,
      staffName: contact.staffName,
      phone: contact.phoneDisplay,
      message,
      url
    });
  };

  return (
    <section
      id="kontak-staf"
      className="py-12 sm:py-16 bg-white border-b-2 border-amber-300/80 scroll-mt-20"
    >
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-xs font-bold text-amber-900 tracking-wide mb-1.5">
              Sub-Bagian 02 · Direktori Layanan Kantor Brighton HUB Cibubur
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 text-balance">
              Kontak WhatsApp Staf Kantor
            </h2>
            <p className="mt-2 text-base text-slate-700 max-w-2xl">
              Pilih divisi Operasional, Keuangan, atau Kurir/Messenger di bawah ini. Indikator status di samping nama staf menunjukkan ketersediaan saat ini (klik indikator status untuk memperbarui).
            </p>
          </div>

          {/* Segmented Division Filter */}
          <div
            role="group"
            aria-label="Filter divisi staf kantor"
            className="flex flex-wrap items-center gap-1.5 p-1.5 bg-[#FEF08A] border-2 border-amber-300 rounded-xl self-start shrink-0"
          >
            {DIVISION_TABS.map((tab) => {
              const active = selectedDivision === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSelectedDivision(tab)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-slate-950 text-[#FACC15] shadow-2xs'
                      : 'text-slate-900 hover:bg-white/70'
                  }`}
                >
                  {tab === 'Semua' ? 'Semua (3)' : tab}
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Color Indicator Legend (Online, Busy, Out of Office) */}
        <div
          aria-label="Keterangan warna indikator status ketersediaan staf"
          className="mb-5 p-4 rounded-xl bg-[#FEFCE8] border-2 border-amber-300"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3 pb-2 border-b border-amber-200/90">
            <p className="text-xs font-bold text-amber-950 tracking-wide">
              Keterangan Indikator Warna Status Staf (Online · Busy · Out of Office)
            </p>
            <span className="text-[11px] font-medium text-slate-600">
              Klik status pada kartu staf untuk memperbarui ketersediaan secara langsung
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STAFF_STATUS_LEGEND.map((item) => (
              <div key={item.status} className="flex items-start gap-2.5 text-xs">
                <span
                  aria-hidden="true"
                  className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${item.dotClass}`}
                />
                <div>
                  <p className="font-bold text-slate-950">
                    <span className={item.textClass}>{item.status}</span>{' '}
                    <span className="text-slate-600 font-semibold">
                      ({item.englishLabel} · {item.colorName})
                    </span>
                  </p>
                  <p className="text-slate-700 mt-0.5 leading-snug">
                    {item.meaning}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Optional Quick Personalization Bar */}
        <div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-[#FEF9C3] via-[#FEFCE8] to-white border-2 border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-slate-800">
            <UserCheck className="w-4 h-4 text-amber-800 shrink-0" />
            <span>
              <strong>Personalisasi Chat Cepat (Opsional):</strong> Isi nama Anda agar otomatis tercantum pada sapaan WhatsApp ke staf kantor.
            </span>
          </div>
          <div className="sm:w-72 shrink-0">
            <label htmlFor="agent-sender-name" className="sr-only">
              Nama Property Advisor atau Pengirim
            </label>
            <input
              id="agent-sender-name"
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="Ketik nama Anda (mis. Andi - Advisor)..."
              className="w-full px-3.5 py-2 text-xs bg-white border-2 border-amber-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Live Status Banner when a WhatsApp Contact is clicked */}
        {activeWhatsAppLog && (
          <div
            role="status"
            className="mb-8 p-4 rounded-xl bg-[#FEF08A] border-2 border-amber-400 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-950">
                Membuka Chat WhatsApp — Divisi {activeWhatsAppLog.division} ({activeWhatsAppLog.staffName})
              </p>
              <p className="text-xs font-mono text-slate-800">
                Tujuan: {activeWhatsAppLog.phone} · Pesan: “{activeWhatsAppLog.message}”
              </p>
            </div>
            <a
              href={activeWhatsAppLog.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#FACC15] bg-slate-950 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Buka Ulang WhatsApp
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}

        {/* 3-Card Staff Contact Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {visibleContacts.map((contact) => {
            const chosenTopic = selectedTopics[contact.id] || '';
            const compiledMessage = buildCustomStaffWhatsAppMessage(
              contact,
              chosenTopic,
              senderName
            );
            const whatsappUrl = buildWhatsAppChatUrl(
              contact.whatsappNumber,
              compiledMessage
            );
            const isCopied = copiedId === contact.id;
            const statusStyle = getStatusVisualStyle(contact.availabilityStatus);

            return (
              <article
                key={contact.id}
                className="bg-gradient-to-b from-[#FEF9C3]/75 via-[#FEFCE8]/50 to-white border-2 border-amber-300 rounded-2xl p-6 flex flex-col justify-between hover:border-amber-400 transition-colors shadow-2xs relative overflow-hidden"
              >
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#FACC15] to-amber-500" />
                <div>
                  {/* Unboxed Metadata Kicker with Subtle Availability Status Indicator */}
                  <div className="flex items-center justify-between gap-2 text-xs text-amber-950 mb-2 pt-1">
                    <span className="font-mono font-bold whitespace-nowrap shrink-0">
                      {contact.index}. {contact.division}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleToggleAvailability(contact.id)}
                      aria-label={`Status ${contact.staffName}: ${statusStyle.label}. Klik untuk mengubah status`}
                      title="Klik untuk mengganti status ketersediaan staf (Online / Sibuk / Di Luar Kantor)"
                      className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline underline-offset-4 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <span
                        aria-hidden="true"
                        className={`w-2 h-2 rounded-full shrink-0 ${statusStyle.dotClass}`}
                      />
                      <span className={statusStyle.textClass}>{statusStyle.label}</span>
                    </button>
                  </div>

                  <h3 className="text-xl font-bold text-slate-950 tracking-tight">
                    {contact.division}
                  </h3>
                  <p className="text-xs font-semibold text-amber-950 mt-0.5">
                    {contact.roleTitle}
                  </p>

                  <div className="mt-4 pt-4 border-t border-amber-300/80 space-y-2.5 text-xs text-slate-800">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-slate-600 font-medium whitespace-nowrap shrink-0">
                        PIC Staf
                      </span>
                      <div className="text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <span
                            aria-hidden="true"
                            className={`w-2 h-2 rounded-full shrink-0 ${statusStyle.dotClass}`}
                          />
                          <strong className="text-slate-950">{contact.staffName}</strong>
                        </div>
                        <p className={`text-[11px] font-medium mt-0.5 ${statusStyle.textClass}`}>
                          {contact.availabilityStatus} · {contact.availabilityDetail}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-slate-600 font-medium whitespace-nowrap shrink-0">
                        Jam Layanan
                      </span>
                      <span className="text-slate-900 font-medium text-right">
                        {contact.operationalHours}
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-xs text-slate-700 leading-relaxed">
                    {contact.description}
                  </p>

                  {/* Interactive Quick Topic Selector Buttons */}
                  <div className="mt-4 pt-3 border-t border-amber-300/70">
                    <p className="text-[11px] font-bold text-slate-700 mb-2">
                      Pilih Keperluan Cepat (Mengisi Pesan Otomatis):
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {contact.commonTasks.map((task) => {
                        const isSelected = chosenTopic === task;
                        return (
                          <button
                            key={task}
                            type="button"
                            onClick={() => handleSelectTopic(contact.id, task)}
                            className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-[#FACC15] border-amber-500 text-slate-950'
                                : 'bg-white border-amber-300/90 text-slate-800 hover:bg-[#FEF9C3]'
                            }`}
                          >
                            <span className="truncate">{task}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-slate-950 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Direct WhatsApp Contact Action */}
                <div className="mt-6 pt-4 border-t border-amber-300 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-900">
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-amber-800" />
                      {contact.phoneDisplay}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyNumber(contact)}
                      aria-label={`Salin nomor telepon ${contact.division}`}
                      className="inline-flex items-center gap-1 font-sans text-xs font-bold text-amber-950 hover:text-slate-950 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                          <span className="text-emerald-800">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Nomor</span>
                        </>
                      )}
                    </button>
                  </div>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      handleRecordWhatsAppClick(contact, compiledMessage, whatsappUrl)
                    }
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-slate-950 bg-[#FACC15] hover:bg-[#EAB308] border border-amber-400 rounded-xl transition-colors shadow-2xs whitespace-nowrap shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Chat WhatsApp {contact.division}
                    <ExternalLink className="w-3.5 h-3.5" />
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

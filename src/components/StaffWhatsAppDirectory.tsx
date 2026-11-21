import React, { useState } from 'react';
import { MessageCircle, Phone, Copy, Check } from 'lucide-react';
import type { OfficeStaffContact } from '../data/cibuburData';
import { buildWhatsAppChatUrl } from '../utils/hubLogic';
import { SectionHeading } from './SectionHeading';

interface StaffWhatsAppDirectoryProps {
  contacts: OfficeStaffContact[];
}

export const StaffWhatsAppDirectory: React.FC<StaffWhatsAppDirectoryProps> = ({ contacts }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyNumber = (contact: OfficeStaffContact) => {
    navigator.clipboard?.writeText(contact.phoneDisplay).catch(() => {});
    setCopiedId(contact.id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === contact.id ? null : prev));
    }, 2000);
  };

  return (
    <section id="kontak-staf" className="scroll-mt-20 py-12 sm:py-16 bg-stone-50 border-b border-slate-200">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <SectionHeading overline="Hubungi kami" title="Kontak staf kantor" />

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((contact) => {
            const whatsappUrl = buildWhatsAppChatUrl(contact.whatsappNumber, contact.defaultMessage);
            const isCopied = copiedId === contact.id;

            return (
              <article
                key={contact.id}
                className="bg-white ring-1 ring-slate-200 rounded-2xl p-5 flex flex-col gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{contact.division}</p>
                  <h3 translate="no" className="notranslate mt-1 text-base font-bold text-slate-950">{contact.staffName}</h3>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 font-mono text-[13px] text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {contact.phoneDisplay}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyNumber(contact)}
                    aria-label={`Salin nomor ${contact.staffName}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-950 cursor-pointer"
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
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-900 bg-white ring-1 ring-slate-300 hover:bg-slate-950 hover:text-white hover:ring-slate-950 rounded-lg transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Chat WhatsApp
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

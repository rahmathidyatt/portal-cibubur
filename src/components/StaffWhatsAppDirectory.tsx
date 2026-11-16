import React, { useState } from 'react';
import { MessageCircle, Phone, Copy, Check } from 'lucide-react';
import type { OfficeStaffContact } from '../data/cibuburData';
import { buildWhatsAppChatUrl } from '../utils/hubLogic';

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
    <section id="kontak-staf" className="scroll-mt-20 py-12 sm:py-16 bg-white border-b border-slate-200">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
          Kontak staf kantor
        </h2>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          {contacts.map((contact) => {
            const whatsappUrl = buildWhatsAppChatUrl(contact.whatsappNumber, contact.defaultMessage);
            const isCopied = copiedId === contact.id;

            return (
              <article
                key={contact.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 flex flex-col gap-4"
              >
                <div>
                  <p className="text-xs font-bold tracking-widest text-amber-700">{contact.division}</p>
                  <h3 className="mt-1.5 text-lg font-bold text-slate-950">{contact.staffName}</h3>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-mono text-base text-slate-900">
                    <Phone className="w-4 h-4 text-slate-400" />
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
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
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

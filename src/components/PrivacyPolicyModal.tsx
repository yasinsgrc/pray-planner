import React from 'react';
import { BottomSheet } from './BottomSheet';
import { getPrivacySections, getPrivacySummary, PRIVACY_LAST_UPDATED } from '../data/privacy';
import { isNativePlatform } from '../utils/platform';
import {
  PRIVACY_ENTITY_NAME,
  PRIVACY_ADDRESS,
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_HOSTING_PROVIDER,
} from '../utils/privacyConfig';
import { PRIVACY_PLACEHOLDER_LABELS, PRIVACY_DISCLAIMER, splitPrivacyText, parsePrivacyBody } from '../utils/privacyRender';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// src/data/privacy.ts'teki metin {{ENTITY_NAME}} gibi belirteçler taşır —
// bunlar dağıtıma özgü, yalnızca deployer'ın bildiği alanlardır (unvan,
// adres, e-posta, hosting sağlayıcı). Hiçbiri sır
// değil ama hiçbirinin de güvenli bir varsayılanı yok; tanımsız bırakılan
// her alan burada gözden kaçması imkansız kırmızı bir uyarıya dönüşür
// (design-refresh-v3 Faz 9 M4) — sessizce eksik/yanlış içerikle yayına
// çıkmak yerine.
function renderWithFields(text: string, values: Record<string, string | undefined>, keyPrefix: string): React.ReactNode[] {
  return splitPrivacyText(text, values).map((part, i) => {
    if (part.kind === 'text') return part.text;
    if (part.resolved) return <React.Fragment key={`${keyPrefix}-${i}`}>{part.text}</React.Fragment>;
    return (
      <span key={`${keyPrefix}-${i}`} className="text-danger-ink font-semibold">
        [{PRIVACY_PLACEHOLDER_LABELS[part.token!] ?? part.token} — .env dosyasında VITE_PRIVACY_* tanımlanmadı]
      </span>
    );
  });
}

/** \n\n ayırır paragrafları; "- " ile başlayan ardışık satırlar madde işaretli liste olur. */
function renderBody(body: string, values: Record<string, string | undefined>): React.ReactNode {
  const paragraphs = parsePrivacyBody(body);
  return (
    <>
      {paragraphs.map((para, i) =>
        para.kind === 'list' ? (
          <ul key={i} className="text-xs space-y-1.5 list-disc pl-4 mb-3 last:mb-0">
            {para.listItems.map((line, j) => (
              <li key={j}>{renderWithFields(line, values, `p${i}-l${j}`)}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="text-xs mb-3 last:mb-0 leading-relaxed">
            {renderWithFields(para.text, values, `p${i}`)}
          </p>
        )
      )}
    </>
  );
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const values: Record<string, string | undefined> = {
    ENTITY_NAME: PRIVACY_ENTITY_NAME,
    ADDRESS: PRIVACY_ADDRESS,
    CONTACT_EMAIL: PRIVACY_CONTACT_EMAIL,
    APP_URL: appUrl,
    HOSTING_PROVIDER: PRIVACY_HOSTING_PROVIDER,
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Gizlilik Politikası">
      <div className="space-y-4 pb-2 text-sm text-ink">
        <p className="text-[11px] text-mist">Son güncelleme: {PRIVACY_LAST_UPDATED}</p>
        <p className="text-xs text-mist leading-relaxed pb-2 border-b border-hairline">
          {getPrivacySummary(isNativePlatform())}
        </p>

        {getPrivacySections(isNativePlatform()).map((section) => (
          <section key={section.title}>
            <h3 className="text-sm font-bold text-gold-ink mb-2">{section.title}</h3>
            {renderBody(section.body, values)}
          </section>
        ))}

        <p className="text-[10px] text-mist pt-2 border-t border-hairline">{PRIVACY_DISCLAIMER}</p>
      </div>
    </BottomSheet>
  );
};

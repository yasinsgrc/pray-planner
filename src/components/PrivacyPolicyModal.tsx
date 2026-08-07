import React from 'react';
import { BottomSheet } from './BottomSheet';
import { getPrivacySections, getPrivacySummary, PRIVACY_LAST_UPDATED } from '../data/privacy';
import { isNativePlatform } from '../utils/platform';
import {
  PRIVACY_ENTITY_NAME,
  PRIVACY_ADDRESS,
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_HOSTING_PROVIDER,
  PRIVACY_LOG_RETENTION_DAYS,
} from '../utils/privacyConfig';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// src/data/privacy.ts'teki metin {{ENTITY_NAME}} gibi belirteçler taşır —
// bunlar dağıtıma özgü, yalnızca deployer'ın bildiği alanlardır (unvan,
// adres, e-posta, hosting sağlayıcı, log saklama süresi). Hiçbiri sır
// değil ama hiçbirinin de güvenli bir varsayılanı yok; tanımsız bırakılan
// her alan burada gözden kaçması imkansız kırmızı bir uyarıya dönüşür
// (design-refresh-v3 Faz 9 M4) — sessizce eksik/yanlış içerikle yayına
// çıkmak yerine.
const PLACEHOLDER_LABELS: Record<string, string> = {
  ENTITY_NAME: 'AD SOYAD veya ŞİRKET UNVANI',
  ADDRESS: 'ADRES',
  CONTACT_EMAIL: 'İLETİŞİM E-POSTASI',
  HOSTING_PROVIDER: 'HOSTING SAĞLAYICI',
  LOG_RETENTION_DAYS: 'SÜRE, ör. 30',
};

const TOKEN_PATTERN = /\{\{(\w+)\}\}/g;

function renderWithFields(text: string, values: Record<string, string | undefined>, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIndex = 0;
  TOKEN_PATTERN.lastIndex = 0;

  while ((match = TOKEN_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[1];
    const value = values[token];
    if (value && value.trim()) {
      nodes.push(<React.Fragment key={`${keyPrefix}-${partIndex}`}>{value}</React.Fragment>);
    } else {
      nodes.push(
        <span key={`${keyPrefix}-${partIndex}`} className="text-danger-ink font-semibold">
          [{PLACEHOLDER_LABELS[token] ?? token} — .env dosyasında VITE_PRIVACY_* tanımlanmadı]
        </span>
      );
    }
    partIndex += 1;
    lastIndex = TOKEN_PATTERN.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

/** \n\n ayırır paragrafları; "- " ile başlayan ardışık satırlar madde işaretli liste olur. */
function renderBody(body: string, values: Record<string, string | undefined>): React.ReactNode {
  const paragraphs = body.split('\n\n');
  return (
    <>
      {paragraphs.map((para, i) => {
        const lines = para.split('\n').filter((l) => l.length > 0);
        const isList = lines.length > 0 && lines.every((l) => l.startsWith('- '));
        if (isList) {
          return (
            <ul key={i} className="text-xs space-y-1.5 list-disc pl-4 mb-3 last:mb-0">
              {lines.map((line, j) => (
                <li key={j}>{renderWithFields(line.slice(2), values, `p${i}-l${j}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-xs mb-3 last:mb-0 leading-relaxed">
            {renderWithFields(para, values, `p${i}`)}
          </p>
        );
      })}
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
    LOG_RETENTION_DAYS: PRIVACY_LOG_RETENTION_DAYS,
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

        <p className="text-[10px] text-mist pt-2 border-t border-hairline">
          Bu metin, uygulamanın kaynak kodunda fiilen doğrulanan veri akışlarına göre hazırlanmıştır. Hukuki
          danışmanlık değildir.
        </p>
      </div>
    </BottomSheet>
  );
};

export interface FeedbackDiagnostics {
  appVersion: string;
  userAgent: string;
  /** GPS mi elle seçim mi — ASLA şehir adı veya koordinat eklenmez (design-refresh-v3 Faz 20 madde 5, açık kullanıcı kısıtı). */
  locationSource: 'GPS' | 'Elle seçim';
}

export function buildFeedbackDiagnosticsText(diagnostics: FeedbackDiagnostics): string {
  return [
    `Uygulama sürümü: ${diagnostics.appVersion}`,
    `Tarayıcı/İşletim Sistemi: ${diagnostics.userAgent}`,
    `Konum yöntemi: ${diagnostics.locationSource}`,
  ].join('\n');
}

/**
 * Kullanıcının kendi mesajı üstte, otomatik tanı bilgisi altta ayrı bir
 * blokta — göndermeden önce (FeedbackModal) kullanıcı bu metnin tamamını
 * görüp düzenleyebilir/silebilir (açık kullanıcı isteği).
 */
export function buildFeedbackBody(userMessage: string, diagnostics: FeedbackDiagnostics): string {
  const diagnosticsText = buildFeedbackDiagnosticsText(diagnostics);
  return `${userMessage}\n\n---\nTeşhis bilgisi (göndermeden önce düzenleyebilir/silebilirsiniz):\n${diagnosticsText}`;
}

export function buildFeedbackMailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

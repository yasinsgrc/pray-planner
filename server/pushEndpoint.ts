/**
 * The push cron POSTs to every stored endpoint from this server, so an
 * unchecked endpoint lets anyone make the server send requests to any URL
 * they like — internal hosts and cloud metadata addresses included (SSRF).
 * Only the browser vendors' real push services are accepted: HTTPS, default
 * port, no credentials, and a host that is (or is a subdomain of) one of
 * the entries below.
 */
const ALLOWED_PUSH_HOSTS = [
  'fcm.googleapis.com', // Chrome, Edge (Chromium), Opera, Samsung Internet, Brave
  'android.googleapis.com', // legacy GCM endpoints still held by older Chrome subscriptions
  'push.services.mozilla.com', // Firefox (updates.push.services.mozilla.com)
  'notify.windows.com', // legacy Edge / WNS (*.notify.windows.com)
  'push.apple.com', // Safari (web.push.apple.com)
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== '') {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return ALLOWED_PUSH_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

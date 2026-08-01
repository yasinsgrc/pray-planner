import { useState, useEffect } from 'react';

const COUNT_KEY = 'vakit_dial_legend_views_v1';
const LAST_SEEN_KEY = 'vakit_dial_legend_last_seen_v1';
const MAX_VIEWS = 3;

/**
 * The Gün Kavisi Kadranı's one-line micro-legend ("Halka bir günü
 * gösterir...") shows on a new user's first three distinct calendar days
 * using the app, then gets out of the way once they've had a chance to
 * learn what the dial means. Counts by day (not by mount) so switching
 * tabs back and forth within one day doesn't burn through the 3 views.
 */
export function useDialLegendVisibility(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const today = new Date().toDateString();
      const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
      const rawCount = localStorage.getItem(COUNT_KEY);
      let views = rawCount ? parseInt(rawCount, 10) : 0;
      if (Number.isNaN(views)) views = 0;

      if (lastSeen !== today) {
        views += 1;
        localStorage.setItem(COUNT_KEY, String(views));
        localStorage.setItem(LAST_SEEN_KEY, today);
      }

      setVisible(views <= MAX_VIEWS);
    } catch {
      // localStorage kullanılamıyor: efsaneyi göstermeye devam et
      setVisible(true);
    }
  }, []);

  return visible;
}

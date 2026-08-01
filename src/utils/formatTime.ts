const formatter = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Single shared HH:mm formatter — every prayer/kerahet time in the app goes through this. */
export function formatTime(date: Date): string {
  return formatter.format(date);
}

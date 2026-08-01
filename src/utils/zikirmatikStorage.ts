const STORAGE_KEY = 'vakit_zikirmatik_state_v1';

export interface ZikirmatikPreset {
  title: string;
  arabic: string;
  target: number;
}

export const PRESET_DHIKRS: ZikirmatikPreset[] = [
  { title: 'Subhânallah', arabic: 'سُبْحَانَ اللَّهِ', target: 33 },
  { title: 'Elhamdulillâh', arabic: 'الْحَمْدُ لِلَّهِ', target: 33 },
  { title: 'Allâhu Akbar', arabic: 'اللَّهُ أَكْبَرُ', target: 33 },
  { title: 'Lâ ilâhe illallâh', arabic: 'لَا إِلَٰهَ إِلَّا اللَّهُ', target: 100 },
  { title: 'Estagfirullâh', arabic: 'أَسْتَغْفِرُ اللَّهَ', target: 100 },
];

export interface ZikirmatikState {
  selectedDhikrIndex: number;
  counter: number;
  lap: number;
}

const DEFAULT_STATE: ZikirmatikState = { selectedDhikrIndex: 0, counter: 0, lap: 0 };

export function loadZikirmatikState(): ZikirmatikState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.selectedDhikrIndex === 'number' &&
      typeof parsed.counter === 'number' &&
      typeof parsed.lap === 'number'
    ) {
      return parsed;
    }
  } catch {
    // Bozuk veri: varsayılana düş
  }
  return DEFAULT_STATE;
}

export function saveZikirmatikState(state: ZikirmatikState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage kullanılamıyor: sessizce yok say
  }
}

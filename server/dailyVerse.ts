const TURKISH_SURAH_NAMES: string[] = [
  'Fâtiha', 'Bakara', 'Âl-i İmrân', 'Nisâ', 'Mâide', 'En\'âm', 'A\'râf', 'Enfâl', 'Tevbe', 'Yûnus',
  'Hûd', 'Yûsuf', 'Ra\'d', 'İbrâhîm', 'Hicr', 'Nahl', 'İsrâ', 'Kehf', 'Meryem', 'Tâhâ',
  'Enbiyâ', 'Hac', 'Mü\'minûn', 'Nûr', 'Furkân', 'Şuarâ', 'Neml', 'Kasas', 'Ankebût', 'Rûm',
  'Lokman', 'Secde', 'Ahzâb', 'Sebe\'', 'Fâtır', 'Yâsîn', 'Sâffât', 'Sâd', 'Zümer', 'Mü\'min',
  'Fussilet', 'Şûrâ', 'Zuhruf', 'Duhân', 'Câsiye', 'Ahkâf', 'Muhammed', 'Fetih', 'Hucurât', 'Kâf',
  'Zâriyât', 'Tûr', 'Necm', 'Kamer', 'Rahmân', 'Vâkıa', 'Hadîd', 'Mücâdele', 'Haşr', 'Mümtehine',
  'Saff', 'Cuma', 'Münâfikûn', 'Tegâbün', 'Talâk', 'Tahrîm', 'Mülk', 'Kalem', 'Hâkka', 'Meâric',
  'Nûh', 'Cin', 'Müzzemmil', 'Müddessir', 'Kıyâme', 'İnsân', 'Mürselât', 'Nebe\'', 'Nâziât', 'Abese',
  'Tekvîr', 'İnfitâh', 'Mutaffifîn', 'İnşikâk', 'Bürûc', 'Târık', 'A\'lâ', 'Gâşiye', 'Fecr', 'Beled',
  'Şems', 'Leyl', 'Duhâ', 'İnşirâh', 'Tîn', 'Alak', 'Kadr', 'Beyyine', 'Zilzâl', 'Âdiyât',
  'Kâria', 'Tekâsür', 'Asr', 'Hümeze', 'Fîl', 'Kureyş', 'Mâûn', 'Kevser', 'Kâfirûn', 'Nasr',
  'Tebbet', 'İhlâs', 'Felak', 'Nâs',
];

export interface DailyVerse {
  verse: string;
  verseRef: string;
}

interface UmmahApiQuranRandomResponse {
  data: {
    surah: { number: number };
    verse: {
      ayah: number;
      translations: { turkish?: string };
    };
  };
}

export interface DailyVerseServiceDeps {
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface DailyVerseService {
  getVerseOfTheDay(): Promise<DailyVerse>;
}

export function createDailyVerseService(deps: DailyVerseServiceDeps = {}): DailyVerseService {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());

  let cachedDateKey: string | null = null;
  let cachedVerse: DailyVerse | null = null;

  function dateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  async function getVerseOfTheDay(): Promise<DailyVerse> {
    const today = dateKey(now());
    if (cachedDateKey === today && cachedVerse) {
      return cachedVerse;
    }

    const res = await fetchImpl('https://ummahapi.com/api/quran/random');
    if (!res.ok) {
      throw new Error(`UmmahAPI isteği başarısız: ${res.status}`);
    }

    const body = (await res.json()) as UmmahApiQuranRandomResponse;
    const turkish = body.data.verse.translations.turkish;
    if (!turkish) {
      throw new Error('Türkçe meal bulunamadı.');
    }

    const surahName = TURKISH_SURAH_NAMES[body.data.surah.number - 1] ?? 'Kur\'an';
    const verse: DailyVerse = {
      verse: turkish,
      verseRef: `${surahName} Suresi, ${body.data.verse.ayah}. Ayet`,
    };

    cachedDateKey = today;
    cachedVerse = verse;
    return verse;
  }

  return { getVerseOfTheDay };
}

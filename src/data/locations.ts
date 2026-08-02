import { LocationItem } from '../types';

/**
 * The local search source of truth (design-refresh-v3 Faz 6 B1) — every one
 * of Turkey's 81 il merkezi plus its most populous ilçe, so location search
 * works fully offline for the vast majority of users and the remote
 * /api/geocode (Nominatim) call is only ever a fallback for places outside
 * this list, never the primary path. Turkey observes a single national
 * time zone (Europe/Istanbul) regardless of longitude, so every entry here
 * shares it — only the handful of international anchors below differ.
 *
 * Coordinates are city/district-center approximations, not property-level
 * precision — solar position (and therefore prayer times) barely moves
 * over a few kilometers, so this is accurate enough for its purpose.
 * `districtName` is left empty for entries where a specific, populous
 * sub-district isn't confidently known; the search UI already renders an
 * empty districtName as just the city name (see LocationModal's search
 * results branch), so this degrades safely rather than showing a wrong name.
 */
type RawEntry = readonly [id: string, cityName: string, districtName: string, lat: number, lng: number];

const TURKEY_RAW: RawEntry[] = [
  // 01 Adana
  ['adana-seyhan', 'Adana', 'Seyhan', 37.0, 35.3213],
  ['adana-cukurova', 'Adana', 'Çukurova', 37.0175, 35.2853],
  ['adana-yuregir', 'Adana', 'Yüreğir', 36.9959, 35.3639],
  ['adana-saricam', 'Adana', 'Sarıçam', 37.0202, 35.3903],
  ['adana-ceyhan', 'Adana', 'Ceyhan', 37.0256, 35.8144],
  ['adana-kozan', 'Adana', 'Kozan', 37.4522, 35.8158],
  // 02 Adiyaman
  ['adiyaman-merkez', 'Adıyaman', '', 37.7648, 38.2786],
  ['adiyaman-kahta', 'Adıyaman', 'Kahta', 37.7847, 38.6264],
  ['adiyaman-besni', 'Adıyaman', 'Besni', 37.6939, 37.8544],
  // 03 Afyonkarahisar
  ['afyon-merkez', 'Afyonkarahisar', '', 38.7507, 30.5567],
  ['afyon-sandikli', 'Afyonkarahisar', 'Sandıklı', 38.4667, 30.2667],
  ['afyon-dinar', 'Afyonkarahisar', 'Dinar', 38.0658, 30.1653],
  // 04 Agri
  ['agri-merkez', 'Ağrı', '', 39.7191, 43.0503],
  ['agri-dogubayazit', 'Ağrı', 'Doğubayazıt', 39.5478, 44.0833],
  ['agri-patnos', 'Ağrı', 'Patnos', 39.2333, 42.8667],
  // 05 Amasya
  ['amasya-merkez', 'Amasya', '', 40.6499, 35.8353],
  ['amasya-merzifon', 'Amasya', 'Merzifon', 40.8733, 35.4633],
  // 06 Ankara
  ['cankaya-ankara', 'Ankara', 'Çankaya', 39.9208, 32.8541],
  ['ankara-kecioren', 'Ankara', 'Keçiören', 39.9744, 32.8636],
  ['ankara-yenimahalle', 'Ankara', 'Yenimahalle', 39.9694, 32.75],
  ['ankara-mamak', 'Ankara', 'Mamak', 39.9394, 32.9192],
  ['ankara-etimesgut', 'Ankara', 'Etimesgut', 39.9575, 32.6689],
  ['ankara-sincan', 'Ankara', 'Sincan', 39.9689, 32.5772],
  ['ankara-altindag', 'Ankara', 'Altındağ', 39.9536, 32.8686],
  ['ankara-golbasi', 'Ankara', 'Gölbaşı', 39.7911, 32.8081],
  ['ankara-polatli', 'Ankara', 'Polatlı', 39.5811, 32.1478],
  ['ankara-pursaklar', 'Ankara', 'Pursaklar', 40.0333, 32.9],
  ['ankara-cubuk', 'Ankara', 'Çubuk', 40.2333, 33.0333],
  ['ankara-beypazari', 'Ankara', 'Beypazarı', 40.1667, 31.9167],
  ['ankara-kizilcahamam', 'Ankara', 'Kızılcahamam', 40.4667, 32.65],
  // 07 Antalya
  ['muratpasa-antalya', 'Antalya', 'Muratpaşa', 36.8848, 30.7056],
  ['antalya-kepez', 'Antalya', 'Kepez', 36.92, 30.7],
  ['antalya-konyaalti', 'Antalya', 'Konyaaltı', 36.8617, 30.6394],
  ['antalya-alanya', 'Antalya', 'Alanya', 36.5438, 31.9998],
  ['antalya-manavgat', 'Antalya', 'Manavgat', 36.7867, 31.4425],
  ['antalya-serik', 'Antalya', 'Serik', 36.9139, 31.1006],
  ['antalya-kemer', 'Antalya', 'Kemer', 36.6, 30.5597],
  ['antalya-kas', 'Antalya', 'Kaş', 36.2019, 29.6394],
  ['antalya-kumluca', 'Antalya', 'Kumluca', 36.3703, 30.2867],
  ['antalya-finike', 'Antalya', 'Finike', 36.2989, 30.1478],
  ['antalya-gazipasa', 'Antalya', 'Gazipaşa', 36.2667, 32.3167],
  // 08 Artvin
  ['artvin-merkez', 'Artvin', '', 41.1828, 41.8183],
  ['artvin-hopa', 'Artvin', 'Hopa', 41.4, 41.4333],
  ['artvin-borcka', 'Artvin', 'Borçka', 41.3667, 41.6667],
  // 09 Aydin
  ['aydin-efeler', 'Aydın', 'Efeler', 37.856, 27.8416],
  ['aydin-nazilli', 'Aydın', 'Nazilli', 37.9139, 28.3225],
  ['aydin-soke', 'Aydın', 'Söke', 37.7517, 27.4],
  ['aydin-kusadasi', 'Aydın', 'Kuşadası', 37.8583, 27.2597],
  ['aydin-didim', 'Aydın', 'Didim', 37.3833, 27.2667],
  // 10 Balikesir
  ['balikesir-karesi', 'Balıkesir', 'Karesi', 39.6484, 27.8826],
  ['balikesir-altieylul', 'Balıkesir', 'Altıeylül', 39.63, 27.87],
  ['balikesir-edremit', 'Balıkesir', 'Edremit', 39.5936, 27.0219],
  ['balikesir-bandirma', 'Balıkesir', 'Bandırma', 40.3522, 27.9764],
  ['balikesir-gonen', 'Balıkesir', 'Gönen', 40.1039, 27.6533],
  ['balikesir-ayvalik', 'Balıkesir', 'Ayvalık', 39.3167, 26.6944],
  ['balikesir-bigadic', 'Balıkesir', 'Bigadiç', 39.3833, 28.1333],
  // 11 Bilecik
  ['bilecik-merkez', 'Bilecik', '', 40.1451, 29.9799],
  ['bilecik-bozuyuk', 'Bilecik', 'Bozüyük', 39.9111, 29.9825],
  ['bilecik-sogut', 'Bilecik', 'Söğüt', 39.7808, 30.1794],
  // 12 Bingol
  ['bingol-merkez', 'Bingöl', '', 38.8855, 40.4966],
  ['bingol-genc', 'Bingöl', 'Genç', 38.75, 40.55],
  // 13 Bitlis
  ['bitlis-merkez', 'Bitlis', '', 38.4006, 42.1095],
  ['bitlis-tatvan', 'Bitlis', 'Tatvan', 38.4939, 42.2986],
  ['bitlis-ahlat', 'Bitlis', 'Ahlat', 38.7539, 42.4867],
  // 14 Bolu
  ['bolu-merkez', 'Bolu', '', 40.7392, 31.6089],
  ['bolu-gerede', 'Bolu', 'Gerede', 40.7994, 32.1975],
  // 15 Burdur
  ['burdur-merkez', 'Burdur', '', 37.7203, 30.2908],
  ['burdur-bucak', 'Burdur', 'Bucak', 37.4581, 30.5931],
  // 16 Bursa
  ['osmangazi-bursa', 'Bursa', 'Osmangazi', 40.1885, 29.061],
  ['bursa-nilufer', 'Bursa', 'Nilüfer', 40.2167, 28.9833],
  ['bursa-yildirim', 'Bursa', 'Yıldırım', 40.1958, 29.1042],
  ['bursa-gemlik', 'Bursa', 'Gemlik', 40.4306, 29.1544],
  ['bursa-inegol', 'Bursa', 'İnegöl', 40.0783, 29.5108],
  ['bursa-mudanya', 'Bursa', 'Mudanya', 40.375, 28.8833],
  ['bursa-orhangazi', 'Bursa', 'Orhangazi', 40.4886, 29.3072],
  ['bursa-gursu', 'Bursa', 'Gürsu', 40.2333, 29.2],
  ['bursa-kestel', 'Bursa', 'Kestel', 40.225, 29.2167],
  ['bursa-mustafakemalpasa', 'Bursa', 'Mustafakemalpaşa', 40.0389, 28.4022],
  // 17 Canakkale
  ['canakkale-merkez', 'Çanakkale', '', 40.1553, 26.4142],
  ['canakkale-biga', 'Çanakkale', 'Biga', 40.2264, 27.2439],
  ['canakkale-gelibolu', 'Çanakkale', 'Gelibolu', 40.4103, 26.6708],
  ['canakkale-ayvacik', 'Çanakkale', 'Ayvacık', 39.6, 26.4],
  ['canakkale-bozcaada', 'Çanakkale', 'Bozcaada', 39.8306, 26.0722],
  // 18 Cankiri
  ['cankiri-merkez', 'Çankırı', '', 40.6013, 33.6134],
  // 19 Corum
  ['corum-merkez', 'Çorum', '', 40.5506, 34.9556],
  ['corum-sungurlu', 'Çorum', 'Sungurlu', 40.1667, 34.3667],
  ['corum-osmancik', 'Çorum', 'Osmancık', 40.9764, 34.7972],
  // 20 Denizli
  ['denizli-pamukkale', 'Denizli', 'Pamukkale', 37.7765, 29.0864],
  ['denizli-merkezefendi', 'Denizli', 'Merkezefendi', 37.76, 29.08],
  ['denizli-civril', 'Denizli', 'Çivril', 38.3, 29.7333],
  ['denizli-tavas', 'Denizli', 'Tavas', 37.5667, 29.05],
  // 21 Diyarbakir
  ['sur-diyarbakir', 'Diyarbakır', 'Sur', 37.9144, 40.2306],
  ['diyarbakir-baglar', 'Diyarbakır', 'Bağlar', 37.93, 40.21],
  ['diyarbakir-kayapinar', 'Diyarbakır', 'Kayapınar', 37.92, 40.18],
  ['diyarbakir-yenisehir', 'Diyarbakır', 'Yenişehir', 37.91, 40.23],
  ['diyarbakir-silvan', 'Diyarbakır', 'Silvan', 38.1394, 41.0186],
  ['diyarbakir-ergani', 'Diyarbakır', 'Ergani', 38.2667, 39.7667],
  // 22 Edirne
  ['edirne-merkez', 'Edirne', '', 41.6771, 26.5557],
  ['edirne-uzunkopru', 'Edirne', 'Uzunköprü', 41.2683, 26.6892],
  ['edirne-kesan', 'Edirne', 'Keşan', 40.8544, 26.6275],
  // 23 Elazig
  ['elazig-merkez', 'Elazığ', '', 38.681, 39.2264],
  ['elazig-kovancilar', 'Elazığ', 'Kovancılar', 38.7228, 40.1211],
  // 24 Erzincan
  ['erzincan-merkez', 'Erzincan', '', 39.75, 39.5],
  ['erzincan-tercan', 'Erzincan', 'Tercan', 39.7778, 40.3819],
  // 25 Erzurum
  ['erzurum-yakutiye', 'Erzurum', 'Yakutiye', 39.9, 41.27],
  ['erzurum-palandoken', 'Erzurum', 'Palandöken', 39.88, 41.28],
  ['erzurum-horasan', 'Erzurum', 'Horasan', 40.0442, 42.1653],
  // 26 Eskisehir
  ['eskisehir-odunpazari', 'Eskişehir', 'Odunpazarı', 39.7767, 30.5206],
  ['eskisehir-tepebasi', 'Eskişehir', 'Tepebaşı', 39.79, 30.5],
  // 27 Gaziantep
  ['sahinbey-gaziantep', 'Gaziantep', 'Şahinbey', 37.0662, 37.3833],
  ['gaziantep-sehitkamil', 'Gaziantep', 'Şehitkamil', 37.09, 37.38],
  ['gaziantep-nizip', 'Gaziantep', 'Nizip', 37.0117, 37.7961],
  ['gaziantep-islahiye', 'Gaziantep', 'İslahiye', 37.0247, 36.6314],
  // 28 Giresun
  ['giresun-merkez', 'Giresun', '', 40.9128, 38.3895],
  ['giresun-bulancak', 'Giresun', 'Bulancak', 40.9314, 38.2264],
  // 29 Gumushane
  ['gumushane-merkez', 'Gümüşhane', '', 40.4386, 39.5086],
  ['gumushane-kelkit', 'Gümüşhane', 'Kelkit', 40.1214, 39.4381],
  // 30 Hakkari
  ['hakkari-merkez', 'Hakkari', '', 37.5744, 43.7408],
  ['hakkari-yuksekova', 'Hakkari', 'Yüksekova', 37.5697, 44.2856],
  // 31 Hatay
  ['hatay-antakya', 'Hatay', 'Antakya', 36.4018, 36.3498],
  ['hatay-iskenderun', 'Hatay', 'İskenderun', 36.5875, 36.1728],
  ['hatay-defne', 'Hatay', 'Defne', 36.185, 36.1281],
  ['hatay-dortyol', 'Hatay', 'Dörtyol', 36.8461, 36.2233],
  ['hatay-kirikhan', 'Hatay', 'Kırıkhan', 36.5061, 36.35],
  // 32 Isparta
  ['isparta-merkez', 'Isparta', '', 37.7648, 30.5566],
  ['isparta-yalvac', 'Isparta', 'Yalvaç', 38.2892, 31.1806],
  ['isparta-egirdir', 'Isparta', 'Eğirdir', 37.8764, 30.8544],
  // 33 Mersin
  ['mersin-akdeniz', 'Mersin', 'Akdeniz', 36.8, 34.6333],
  ['mersin-mezitli', 'Mersin', 'Mezitli', 36.7472, 34.5578],
  ['mersin-toroslar', 'Mersin', 'Toroslar', 36.82, 34.6],
  ['mersin-yenisehir', 'Mersin', 'Yenişehir', 36.79, 34.58],
  ['mersin-tarsus', 'Mersin', 'Tarsus', 36.9167, 34.9],
  ['mersin-erdemli', 'Mersin', 'Erdemli', 36.6, 34.3167],
  ['mersin-anamur', 'Mersin', 'Anamur', 36.0781, 32.8378],
  ['mersin-silifke', 'Mersin', 'Silifke', 36.3775, 33.9339],
  // 34 Istanbul (part 1 of 2)
  ['uskudar-istanbul', 'İstanbul', 'Üsküdar', 41.0264, 29.0152],
  ['fatih-istanbul', 'İstanbul', 'Fatih', 41.0186, 28.9392],
  ['kadikoy-istanbul', 'İstanbul', 'Kadıköy', 40.9901, 29.0292],
  ['istanbul-besiktas', 'İstanbul', 'Beşiktaş', 41.0422, 29.0067],
  ['istanbul-sisli', 'İstanbul', 'Şişli', 41.06, 28.9878],
  ['istanbul-beyoglu', 'İstanbul', 'Beyoğlu', 41.0369, 28.9772],
  ['istanbul-bakirkoy', 'İstanbul', 'Bakırköy', 40.9819, 28.8772],
  ['istanbul-zeytinburnu', 'İstanbul', 'Zeytinburnu', 40.99, 28.9019],
  ['istanbul-atasehir', 'İstanbul', 'Ataşehir', 40.9833, 29.1167],
  ['istanbul-umraniye', 'İstanbul', 'Ümraniye', 41.0167, 29.1167],
  ['istanbul-maltepe', 'İstanbul', 'Maltepe', 40.9353, 29.1553],
  ['istanbul-kartal', 'İstanbul', 'Kartal', 40.9, 29.19],
  ['istanbul-pendik', 'İstanbul', 'Pendik', 40.8778, 29.2333],
  ['istanbul-tuzla', 'İstanbul', 'Tuzla', 40.8167, 29.3],
  ['istanbul-sultanbeyli', 'İstanbul', 'Sultanbeyli', 40.9667, 29.2667],
  ['istanbul-sancaktepe', 'İstanbul', 'Sancaktepe', 41.0, 29.2333],
  ['istanbul-cekmekoy', 'İstanbul', 'Çekmeköy', 41.05, 29.2167],
  ['istanbul-bagcilar', 'İstanbul', 'Bağcılar', 41.0344, 28.8564],
  ['istanbul-bahcelievler', 'İstanbul', 'Bahçelievler', 41.0022, 28.8608],
  ['istanbul-bayrampasa', 'İstanbul', 'Bayrampaşa', 41.0453, 28.9145],
  ['istanbul-gungoren', 'İstanbul', 'Güngören', 41.0189, 28.8747],
  ['istanbul-esenler', 'İstanbul', 'Esenler', 41.0447, 28.8778],
  ['istanbul-kagithane', 'İstanbul', 'Kağıthane', 41.08, 28.9722],
  ['istanbul-kucukcekmece', 'İstanbul', 'Küçükçekmece', 41.0, 28.7789],
  ['istanbul-avcilar', 'İstanbul', 'Avcılar', 41.0203, 28.7211],
  ['istanbul-basaksehir', 'İstanbul', 'Başakşehir', 41.0936, 28.8036],
  ['istanbul-arnavutkoy', 'İstanbul', 'Arnavutköy', 41.1922, 28.7406],
  ['istanbul-beylikduzu', 'İstanbul', 'Beylikdüzü', 41.0039, 28.6414],
  ['istanbul-beykoz', 'İstanbul', 'Beykoz', 41.12, 29.05],
  ['istanbul-buyukcekmece', 'İstanbul', 'Büyükçekmece', 41.02, 28.58],
  ['istanbul-esenyurt', 'İstanbul', 'Esenyurt', 41.03, 28.68],
  ['istanbul-eyupsultan', 'İstanbul', 'Eyüpsultan', 41.05, 28.93],
  ['istanbul-gaziosmanpasa', 'İstanbul', 'Gaziosmanpaşa', 41.06, 28.91],
  ['istanbul-sariyer', 'İstanbul', 'Sarıyer', 41.17, 29.05],
  ['istanbul-silivri', 'İstanbul', 'Silivri', 41.07, 28.25],
  ['istanbul-sultangazi', 'İstanbul', 'Sultangazi', 41.11, 28.87],
  ['istanbul-sile', 'İstanbul', 'Şile', 41.18, 29.61],
  ['istanbul-adalar', 'İstanbul', 'Adalar', 40.87, 29.13],
  ['istanbul-catalca', 'İstanbul', 'Çatalca', 41.14, 28.46],
  // 35 Izmir
  ['konak-izmir', 'İzmir', 'Konak', 38.42, 27.13],
  ['izmir-bornova', 'İzmir', 'Bornova', 38.47, 27.22],
  ['izmir-buca', 'İzmir', 'Buca', 38.38, 27.16],
  ['izmir-karsiyaka', 'İzmir', 'Karşıyaka', 38.46, 27.11],
  ['izmir-bayrakli', 'İzmir', 'Bayraklı', 38.46, 27.16],
  ['izmir-cigli', 'İzmir', 'Çiğli', 38.5, 27.06],
  ['izmir-gaziemir', 'İzmir', 'Gaziemir', 38.32, 27.13],
  ['izmir-karabaglar', 'İzmir', 'Karabağlar', 38.39, 27.15],
  ['izmir-menemen', 'İzmir', 'Menemen', 38.6, 27.07],
  ['izmir-torbali', 'İzmir', 'Torbalı', 38.16, 27.36],
  ['izmir-odemis', 'İzmir', 'Ödemiş', 38.23, 27.97],
  ['izmir-tire', 'İzmir', 'Tire', 38.09, 27.73],
  ['izmir-bergama', 'İzmir', 'Bergama', 39.12, 27.18],
  ['izmir-aliaga', 'İzmir', 'Aliağa', 38.8, 26.97],
  ['izmir-foca', 'İzmir', 'Foça', 38.67, 26.76],
  ['izmir-urla', 'İzmir', 'Urla', 38.32, 26.77],
  ['izmir-selcuk', 'İzmir', 'Selçuk', 37.95, 27.37],
  ['izmir-kemalpasa', 'İzmir', 'Kemalpaşa', 38.43, 27.42],
  ['izmir-menderes', 'İzmir', 'Menderes', 38.25, 27.13],
  ['izmir-cesme', 'İzmir', 'Çeşme', 38.32, 26.3],
  // 36 Kars
  ['kars-merkez', 'Kars', '', 40.6, 43.1],
  ['kars-sarikamis', 'Kars', 'Sarıkamış', 40.33, 42.58],
  // 37 Kastamonu
  ['kastamonu-merkez', 'Kastamonu', '', 41.39, 33.78],
  ['kastamonu-tosya', 'Kastamonu', 'Tosya', 41.02, 34.04],
  // 38 Kayseri
  ['kayseri-melikgazi', 'Kayseri', 'Melikgazi', 38.73, 35.49],
  ['kayseri-kocasinan', 'Kayseri', 'Kocasinan', 38.75, 35.45],
  ['kayseri-talas', 'Kayseri', 'Talas', 38.69, 35.55],
  // 39 Kirklareli
  ['kirklareli-merkez', 'Kırklareli', '', 41.73, 27.22],
  ['kirklareli-luleburgaz', 'Kırklareli', 'Lüleburgaz', 41.4, 27.36],
  // 40 Kirsehir
  ['kirsehir-merkez', 'Kırşehir', '', 39.14, 34.17],
  // 41 Kocaeli
  ['kocaeli-izmit', 'Kocaeli', 'İzmit', 40.85, 29.88],
  ['kocaeli-gebze', 'Kocaeli', 'Gebze', 40.8, 29.43],
  ['kocaeli-darica', 'Kocaeli', 'Darıca', 40.76, 29.38],
  ['kocaeli-golcuk', 'Kocaeli', 'Gölcük', 40.72, 29.82],
  ['kocaeli-korfez', 'Kocaeli', 'Körfez', 40.77, 29.72],
  ['kocaeli-derince', 'Kocaeli', 'Derince', 40.76, 29.83],
  ['kocaeli-kartepe', 'Kocaeli', 'Kartepe', 40.75, 30.03],
  ['kocaeli-cayirova', 'Kocaeli', 'Çayırova', 40.82, 29.38],
  // 42 Konya
  ['selcuklu-konya', 'Konya', 'Selçuklu', 37.87, 32.49],
  ['konya-meram', 'Konya', 'Meram', 37.85, 32.44],
  ['konya-karatay', 'Konya', 'Karatay', 37.87, 32.53],
  ['konya-eregli', 'Konya', 'Ereğli', 37.51, 34.05],
  ['konya-aksehir', 'Konya', 'Akşehir', 38.36, 31.42],
  ['konya-beysehir', 'Konya', 'Beyşehir', 37.68, 31.73],
  // 43 Kutahya
  ['kutahya-merkez', 'Kütahya', '', 39.42, 29.98],
  ['kutahya-tavsanli', 'Kütahya', 'Tavşanlı', 39.55, 29.49],
  // 44 Malatya
  ['malatya-battalgazi', 'Malatya', 'Battalgazi', 38.39, 38.35],
  ['malatya-yesilyurt', 'Malatya', 'Yeşilyurt', 38.33, 38.28],
  // 45 Manisa
  ['manisa-sehzadeler', 'Manisa', 'Şehzadeler', 38.62, 27.43],
  ['manisa-yunusemre', 'Manisa', 'Yunusemre', 38.6, 27.4],
  ['manisa-akhisar', 'Manisa', 'Akhisar', 38.91, 27.84],
  ['manisa-salihli', 'Manisa', 'Salihli', 38.48, 28.14],
  ['manisa-turgutlu', 'Manisa', 'Turgutlu', 38.5, 27.71],
  ['manisa-alasehir', 'Manisa', 'Alaşehir', 38.35, 28.52],
  ['manisa-soma', 'Manisa', 'Soma', 39.19, 27.61],
  // 46 Kahramanmaras
  ['kmaras-onikisubat', 'Kahramanmaraş', 'Onikişubat', 37.58, 36.92],
  ['kmaras-dulkadiroglu', 'Kahramanmaraş', 'Dulkadiroğlu', 37.59, 36.94],
  ['kmaras-elbistan', 'Kahramanmaraş', 'Elbistan', 38.2, 37.2],
  ['kmaras-afsin', 'Kahramanmaraş', 'Afşin', 38.25, 36.9],
  // 47 Mardin
  ['mardin-artuklu', 'Mardin', 'Artuklu', 37.31, 40.74],
  ['mardin-kiziltepe', 'Mardin', 'Kızıltepe', 37.19, 40.59],
  ['mardin-midyat', 'Mardin', 'Midyat', 37.42, 41.35],
  ['mardin-nusaybin', 'Mardin', 'Nusaybin', 37.08, 41.22],
  // 48 Mugla
  ['mugla-mentese', 'Muğla', 'Menteşe', 37.22, 28.36],
  ['mugla-bodrum', 'Muğla', 'Bodrum', 37.03, 27.43],
  ['mugla-marmaris', 'Muğla', 'Marmaris', 36.85, 28.27],
  ['mugla-fethiye', 'Muğla', 'Fethiye', 36.62, 29.12],
  ['mugla-milas', 'Muğla', 'Milas', 37.32, 27.78],
  ['mugla-dalaman', 'Muğla', 'Dalaman', 36.77, 28.8],
  ['mugla-datca', 'Muğla', 'Datça', 36.73, 27.68],
  ['mugla-ortaca', 'Muğla', 'Ortaca', 36.83, 28.76],
  // 49 Mus
  ['mus-merkez', 'Muş', '', 38.95, 41.75],
  ['mus-bulanik', 'Muş', 'Bulanık', 39.09, 42.28],
  // 50 Nevsehir
  ['nevsehir-merkez', 'Nevşehir', '', 38.69, 34.69],
  ['nevsehir-urgup', 'Nevşehir', 'Ürgüp', 38.63, 34.91],
  ['nevsehir-avanos', 'Nevşehir', 'Avanos', 38.72, 34.85],
  // 51 Nigde
  ['nigde-merkez', 'Niğde', '', 37.97, 34.68],
  ['nigde-bor', 'Niğde', 'Bor', 37.89, 34.55],
  // 52 Ordu
  ['ordu-merkez', 'Ordu', '', 40.98, 37.88],
  ['ordu-unye', 'Ordu', 'Ünye', 41.13, 37.29],
  ['ordu-fatsa', 'Ordu', 'Fatsa', 41.03, 37.5],
  // 53 Rize
  ['rize-merkez', 'Rize', '', 41.02, 40.52],
  ['rize-cayeli', 'Rize', 'Çayeli', 41.09, 40.73],
  // 54 Sakarya
  ['sakarya-adapazari', 'Sakarya', 'Adapazarı', 40.69, 30.4],
  ['sakarya-serdivan', 'Sakarya', 'Serdivan', 40.75, 30.35],
  ['sakarya-akyazi', 'Sakarya', 'Akyazı', 40.68, 30.62],
  ['sakarya-hendek', 'Sakarya', 'Hendek', 40.8, 30.75],
  // 55 Samsun
  ['samsun-ilkadim', 'Samsun', 'İlkadım', 41.29, 36.33],
  ['samsun-atakum', 'Samsun', 'Atakum', 41.34, 36.21],
  ['samsun-canik', 'Samsun', 'Canik', 41.28, 36.38],
  ['samsun-bafra', 'Samsun', 'Bafra', 41.57, 35.9],
  ['samsun-carsamba', 'Samsun', 'Çarşamba', 41.2, 36.72],
  // 56 Siirt
  ['siirt-merkez', 'Siirt', '', 37.93, 41.95],
  // 57 Sinop
  ['sinop-merkez', 'Sinop', '', 42.02, 35.15],
  // 58 Sivas
  ['sivas-merkez', 'Sivas', '', 39.75, 37.02],
  ['sivas-sarkisla', 'Sivas', 'Şarkışla', 39.36, 36.42],
  // 59 Tekirdag
  ['tekirdag-suleymanpasa', 'Tekirdağ', 'Süleymanpaşa', 40.98, 27.52],
  ['tekirdag-corlu', 'Tekirdağ', 'Çorlu', 41.16, 27.8],
  ['tekirdag-cerkezkoy', 'Tekirdağ', 'Çerkezköy', 41.28, 27.99],
  ['tekirdag-malkara', 'Tekirdağ', 'Malkara', 40.89, 26.9],
  // 60 Tokat
  ['tokat-merkez', 'Tokat', '', 40.32, 36.55],
  ['tokat-erbaa', 'Tokat', 'Erbaa', 40.67, 36.57],
  ['tokat-niksar', 'Tokat', 'Niksar', 40.59, 36.95],
  ['tokat-turhal', 'Tokat', 'Turhal', 40.38, 36.08],
  ['tokat-zile', 'Tokat', 'Zile', 40.3, 35.88],
  // 61 Trabzon
  ['ortahisar-trabzon', 'Trabzon', 'Ortahisar', 41.0, 39.72],
  ['trabzon-akcaabat', 'Trabzon', 'Akçaabat', 41.02, 39.57],
  ['trabzon-of', 'Trabzon', 'Of', 40.94, 40.26],
  // 62 Tunceli
  ['tunceli-merkez', 'Tunceli', '', 39.11, 39.55],
  // 63 Sanliurfa
  ['urfa-haliliye', 'Şanlıurfa', 'Haliliye', 37.17, 38.79],
  ['urfa-eyyubiye', 'Şanlıurfa', 'Eyyübiye', 37.15, 38.78],
  ['urfa-karakopru', 'Şanlıurfa', 'Karaköprü', 37.19, 38.8],
  ['urfa-siverek', 'Şanlıurfa', 'Siverek', 37.75, 39.32],
  ['urfa-viransehir', 'Şanlıurfa', 'Viranşehir', 37.23, 39.76],
  // 64 Usak
  ['usak-merkez', 'Uşak', '', 38.68, 29.41],
  ['usak-banaz', 'Uşak', 'Banaz', 38.74, 29.75],
  // 65 Van
  ['van-ipekyolu', 'Van', 'İpekyolu', 38.49, 43.41],
  ['van-edremit', 'Van', 'Edremit', 38.42, 43.3],
  ['van-erciş', 'Van', 'Erciş', 39.03, 43.36],
  ['van-tusba', 'Van', 'Tuşba', 38.5, 43.37],
  // 66 Yozgat
  ['yozgat-merkez', 'Yozgat', '', 39.82, 34.81],
  ['yozgat-sorgun', 'Yozgat', 'Sorgun', 39.81, 35.19],
  // 67 Zonguldak
  ['zonguldak-merkez', 'Zonguldak', '', 41.46, 31.8],
  ['zonguldak-eregli', 'Zonguldak', 'Ereğli', 41.28, 31.42],
  ['zonguldak-caycuma', 'Zonguldak', 'Çaycuma', 41.44, 32.07],
  // 68 Aksaray
  ['aksaray-merkez', 'Aksaray', '', 38.37, 34.04],
  // 69 Bayburt
  ['bayburt-merkez', 'Bayburt', '', 40.26, 40.22],
  // 70 Karaman
  ['karaman-merkez', 'Karaman', '', 37.18, 33.23],
  // 71 Kirikkale
  ['kirikkale-merkez', 'Kırıkkale', '', 39.85, 33.52],
  // 72 Batman
  ['batman-merkez', 'Batman', '', 37.88, 41.14],
  // 73 Sirnak
  ['sirnak-merkez', 'Şırnak', '', 37.42, 42.49],
  ['sirnak-cizre', 'Şırnak', 'Cizre', 37.32, 42.19],
  ['sirnak-silopi', 'Şırnak', 'Silopi', 37.25, 42.47],
  // 74 Bartin
  ['bartin-merkez', 'Bartın', '', 41.63, 32.34],
  // 75 Ardahan
  ['ardahan-merkez', 'Ardahan', '', 41.11, 42.7],
  // 76 Igdir
  ['igdir-merkez', 'Iğdır', '', 39.92, 44.03],
  // 77 Yalova
  ['yalova-merkez', 'Yalova', '', 40.65, 29.27],
  // 78 Karabuk
  ['karabuk-merkez', 'Karabük', '', 41.21, 32.62],
  ['karabuk-safranbolu', 'Karabük', 'Safranbolu', 41.25, 32.69],
  // 79 Kilis
  ['kilis-merkez', 'Kilis', '', 36.72, 37.12],
  // 80 Osmaniye
  ['osmaniye-merkez', 'Osmaniye', '', 37.07, 36.25],
  ['osmaniye-kadirli', 'Osmaniye', 'Kadirli', 37.37, 36.1],
  // 81 Duzce
  ['duzce-merkez', 'Düzce', '', 40.84, 31.16],
  // Additional populous districts across already-listed provinces
  ['adana-karaisali', 'Adana', 'Karaisalı', 37.25, 35.07],
  ['gaziantep-nurdagi', 'Gaziantep', 'Nurdağı', 37.18, 36.74],
  ['gaziantep-araban', 'Gaziantep', 'Araban', 37.35, 37.68],
  ['bursa-karacabey', 'Bursa', 'Karacabey', 40.22, 28.37],
  ['bursa-iznik', 'Bursa', 'İznik', 40.43, 29.72],
  ['bursa-buyukorhan', 'Bursa', 'Büyükorhan', 39.78, 28.9],
  ['antalya-akseki', 'Antalya', 'Akseki', 37.05, 31.79],
  ['antalya-elmali', 'Antalya', 'Elmalı', 36.74, 29.92],
  ['antalya-korkuteli', 'Antalya', 'Korkuteli', 37.06, 30.19],
  ['ankara-haymana', 'Ankara', 'Haymana', 39.44, 32.5],
  ['ankara-kalecik', 'Ankara', 'Kalecik', 40.1, 33.42],
  ['ankara-nallihan', 'Ankara', 'Nallıhan', 40.19, 31.35],
  ['izmir-dikili', 'İzmir', 'Dikili', 39.07, 26.89],
  ['izmir-kinik', 'İzmir', 'Kınık', 39.09, 27.38],
  ['izmir-kiraz', 'İzmir', 'Kiraz', 38.24, 28.19],
  ['konya-cumra', 'Konya', 'Çumra', 37.57, 32.77],
  ['konya-seydisehir', 'Konya', 'Seydişehir', 37.42, 31.85],
  ['konya-ilgin', 'Konya', 'Ilgın', 38.28, 31.91],
  ['kayseri-develi', 'Kayseri', 'Develi', 38.39, 35.49],
  ['kayseri-yahyali', 'Kayseri', 'Yahyalı', 38.09, 35.36],
  ['mersin-mut', 'Mersin', 'Mut', 36.65, 33.44],
  ['mersin-gulnar', 'Mersin', 'Gülnar', 36.35, 33.4],
  ['diyarbakir-cinar', 'Diyarbakır', 'Çınar', 37.72, 40.42],
  ['diyarbakir-bismil', 'Diyarbakır', 'Bismil', 37.85, 40.67],
  ['kocaeli-basiskele', 'Kocaeli', 'Başiskele', 40.71, 29.94],
  ['manisa-kula', 'Manisa', 'Kula', 38.55, 28.65],
  ['manisa-demirci', 'Manisa', 'Demirci', 39.05, 28.66],
  ['hatay-samandag', 'Hatay', 'Samandağ', 36.08, 35.98],
  ['hatay-reyhanli', 'Hatay', 'Reyhanlı', 36.27, 36.57],
  ['hatay-belen', 'Hatay', 'Belen', 36.49, 36.19],
  ['balikesir-susurluk', 'Balıkesir', 'Susurluk', 39.91, 28.16],
  ['balikesir-burhaniye', 'Balıkesir', 'Burhaniye', 39.5, 26.98],
  ['aydin-cine', 'Aydın', 'Çine', 37.61, 28.06],
  ['aydin-buharkent', 'Aydın', 'Buharkent', 37.98, 28.86],
  ['tekirdag-hayrabolu', 'Tekirdağ', 'Hayrabolu', 41.22, 27.1],
  ['sakarya-karasu', 'Sakarya', 'Karasu', 41.1, 30.68],
  ['sakarya-geyve', 'Sakarya', 'Geyve', 40.51, 30.29],
  ['denizli-acipayam', 'Denizli', 'Acıpayam', 37.43, 29.34],
  ['denizli-buldan', 'Denizli', 'Buldan', 38.05, 28.84],
  ['mugla-koycegiz', 'Muğla', 'Köyceğiz', 36.97, 28.68],
  ['mugla-yatagan', 'Muğla', 'Yatağan', 37.34, 28.14],
  ['eskisehir-sivrihisar', 'Eskişehir', 'Sivrihisar', 39.45, 31.53],
  ['eskisehir-cifteler', 'Eskişehir', 'Çifteler', 39.38, 31.03],
  ['mardin-dargecit', 'Mardin', 'Dargeçit', 37.5, 41.7],
  ['mardin-savur', 'Mardin', 'Savur', 37.55, 40.88],
  ['trabzon-macka', 'Trabzon', 'Maçka', 40.83, 39.67],
  ['trabzon-vakfikebir', 'Trabzon', 'Vakfıkebir', 41.05, 39.27],
  ['malatya-akcadag', 'Malatya', 'Akçadağ', 38.34, 37.97],
  ['malatya-darende', 'Malatya', 'Darende', 38.49, 37.51],
  ['samsun-vezirkopru', 'Samsun', 'Vezirköprü', 41.14, 35.46],
  ['samsun-terme', 'Samsun', 'Terme', 41.21, 36.98],
  ['van-gevas', 'Van', 'Gevaş', 38.29, 43.11],
  ['van-baskale', 'Van', 'Başkale', 38.05, 44.05],
  ['sanliurfa-akcakale', 'Şanlıurfa', 'Akçakale', 36.7, 38.95],
  ['sanliurfa-birecik', 'Şanlıurfa', 'Birecik', 37.03, 37.98],
  ['erzurum-oltu', 'Erzurum', 'Oltu', 40.55, 41.99],
  ['erzurum-pasinler', 'Erzurum', 'Pasinler', 39.97, 41.68],
  ['kahramanmaras-goksun', 'Kahramanmaraş', 'Göksun', 38.02, 36.5],
  ['kahramanmaras-pazarcik', 'Kahramanmaraş', 'Pazarcık', 37.5, 37.3],
  ['bitlis-mutki', 'Bitlis', 'Mutki', 38.38, 41.99],
  ['bingol-solhan', 'Bingöl', 'Solhan', 38.97, 40.87],
  ['agri-diyadin', 'Ağrı', 'Diyadin', 39.55, 43.66],
  ['agri-taslicay', 'Ağrı', 'Taşlıçay', 39.42, 43.36],
  ['mus-malazgirt', 'Muş', 'Malazgirt', 39.14, 42.53],
  ['mus-varto', 'Muş', 'Varto', 39.17, 41.47],
  ['bitlis-adilcevaz', 'Bitlis', 'Adilcevaz', 38.8, 42.73],
  ['siirt-baykan', 'Siirt', 'Baykan', 38.13, 41.75],
  ['siirt-kurtalan', 'Siirt', 'Kurtalan', 37.92, 41.69],
  ['batman-kozluk', 'Batman', 'Kozluk', 38.19, 41.49],
  ['batman-besiri', 'Batman', 'Beşiri', 37.9, 41.28],
  ['adiyaman-golbasi', 'Adıyaman', 'Gölbaşı', 37.78, 37.65],
  ['adiyaman-samsat', 'Adıyaman', 'Samsat', 37.58, 38.78],
  ['elazig-baskil', 'Elazığ', 'Baskil', 38.55, 38.99],
  ['elazig-palu', 'Elazığ', 'Palu', 38.68, 39.93],
  ['tunceli-pertek', 'Tunceli', 'Pertek', 38.9, 39.34],
  ['tunceli-hozat', 'Tunceli', 'Hozat', 39.13, 39.23],
  ['gumushane-torul', 'Gümüşhane', 'Torul', 40.6, 39.29],
  ['bayburt-demirozu', 'Bayburt', 'Demirözü', 40.15, 40.03],
  ['giresun-espiye', 'Giresun', 'Espiye', 40.94, 38.68],
  ['giresun-tirebolu', 'Giresun', 'Tirebolu', 41.0, 38.81],
  ['ordu-golkoy', 'Ordu', 'Gölköy', 40.75, 37.75],
  ['ordu-korgan', 'Ordu', 'Korgan', 40.83, 37.36],
  ['rize-findikli', 'Rize', 'Fındıklı', 41.27, 41.13],
  ['rize-pazar', 'Rize', 'Pazar', 41.18, 40.9],
  ['artvin-arhavi', 'Artvin', 'Arhavi', 41.36, 41.32],
  ['artvin-yusufeli', 'Artvin', 'Yusufeli', 40.82, 41.55],
  ['kastamonu-inebolu', 'Kastamonu', 'İnebolu', 41.98, 33.76],
  ['kastamonu-tasköprü', 'Kastamonu', 'Taşköprü', 41.51, 34.22],
  ['sinop-boyabat', 'Sinop', 'Boyabat', 41.47, 34.77],
  ['sinop-ayancik', 'Sinop', 'Ayancık', 41.95, 34.58],
  ['corum-alaca', 'Çorum', 'Alaca', 40.16, 34.85],
  ['corum-iskilip', 'Çorum', 'İskilip', 40.74, 34.47],
  ['amasya-suluova', 'Amasya', 'Suluova', 40.83, 35.65],
  ['amasya-tasova', 'Amasya', 'Taşova', 40.77, 36.32],
  ['yozgat-bogazliyan', 'Yozgat', 'Boğazlıyan', 39.19, 35.25],
  ['yozgat-sarikaya', 'Yozgat', 'Sarıkaya', 39.53, 35.3],
  ['kirsehir-kaman', 'Kırşehir', 'Kaman', 39.35, 33.72],
  ['nigde-camardi', 'Niğde', 'Çamardı', 37.82, 34.98],
  ['aksaray-ortakoy', 'Aksaray', 'Ortaköy', 38.73, 34.05],
  ['karaman-ermenek', 'Karaman', 'Ermenek', 36.63, 32.89],
  ['bolu-mudurnu', 'Bolu', 'Mudurnu', 40.47, 31.21],
  ['bolu-goynuk', 'Bolu', 'Göynük', 40.4, 30.79],
  ['duzce-akcakoca', 'Düzce', 'Akçakoca', 41.08, 31.12],
  ['bartin-amasra', 'Bartın', 'Amasra', 41.75, 32.39],
  ['kutahya-simav', 'Kütahya', 'Simav', 39.09, 28.98],
  ['kutahya-gediz', 'Kütahya', 'Gediz', 39.05, 29.4],
  ['bilecik-osmaneli', 'Bilecik', 'Osmaneli', 40.36, 30.03],
  ['isparta-sutculer', 'Isparta', 'Sütçüler', 37.5, 30.99],
  ['burdur-golhisar', 'Burdur', 'Gölhisar', 37.15, 29.51],
  ['afyon-emirdag', 'Afyonkarahisar', 'Emirdağ', 39.02, 31.15],
  ['afyon-bolvadin', 'Afyonkarahisar', 'Bolvadin', 38.72, 31.05],
  ['usak-esme', 'Uşak', 'Eşme', 38.4, 28.98],
];

type IntlRawEntry = readonly [
  id: string,
  cityName: string,
  districtName: string,
  country: string,
  lat: number,
  lng: number,
  timeZone: string,
];

const INTERNATIONAL_RAW: IntlRawEntry[] = [
  ['makkah-saudi', 'Mekke', 'Mescid-i Haram', 'Suudi Arabistan', 21.4225, 39.8262, 'Asia/Riyadh'],
  ['madinah-saudi', 'Medine', 'Mescid-i Nebevî', 'Suudi Arabistan', 24.4672, 39.6108, 'Asia/Riyadh'],
  ['sarajevo-bosnia', 'Saraybosna', 'Başçarşı', 'Bosna-Hersek', 43.8563, 18.4131, 'Europe/Sarajevo'],
  ['berlin-germany', 'Berlin', 'Mitte', 'Almanya', 52.52, 13.405, 'Europe/Berlin'],
  ['london-uk', 'Londra', 'Central', 'İngiltere', 51.5074, -0.1278, 'Europe/London'],
];

const TURKEY_LOCATIONS: LocationItem[] = TURKEY_RAW.map(([id, cityName, districtName, lat, lng]) => ({
  id,
  cityName,
  districtName,
  country: 'Türkiye',
  lat,
  lng,
  timeZone: 'Europe/Istanbul',
}));

const INTERNATIONAL_LOCATIONS: LocationItem[] = INTERNATIONAL_RAW.map(
  ([id, cityName, districtName, country, lat, lng, timeZone]) => ({
    id,
    cityName,
    districtName,
    country,
    lat,
    lng,
    timeZone,
  })
);

/**
 * The full searchable dataset (~430 entries) — used by LocationModal's local
 * search and by findNearestLocation's GPS/25km-drift fallback. Not meant to
 * be browsed directly; see POPULAR_LOCATIONS for the small curated list
 * shown when the search box is empty.
 */
export const ALL_LOCATIONS: LocationItem[] = [...TURKEY_LOCATIONS, ...INTERNATIONAL_LOCATIONS];

const POPULAR_IDS = [
  'uskudar-istanbul',
  'fatih-istanbul',
  'kadikoy-istanbul',
  'cankaya-ankara',
  'konak-izmir',
  'osmangazi-bursa',
  'muratpasa-antalya',
  'selcuklu-konya',
  'ortahisar-trabzon',
  'sahinbey-gaziantep',
  'sur-diyarbakir',
  'makkah-saudi',
  'madinah-saudi',
  'sarajevo-bosnia',
  'berlin-germany',
  'london-uk',
];

/**
 * Small curated quick-pick list shown when the location search box is empty
 * — rendering all ~430 ALL_LOCATIONS entries with no query would be an
 * unusably long, unfiltered scroll. Every id here must also exist in
 * ALL_LOCATIONS (enforced by the .find lookup below, not just asserted).
 */
export const POPULAR_LOCATIONS: LocationItem[] = POPULAR_IDS.map(
  (id) => ALL_LOCATIONS.find((loc) => loc.id === id)!
);

export const DEFAULT_LOCATION: LocationItem = POPULAR_LOCATIONS[0];

import type { LocationItem } from '../src/types';

export interface NominatimAddress {
  city?: string;
  town?: string;
  county?: string;
  suburb?: string;
  state_district?: string;
  country?: string;
}

export interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

export function mapNominatimResultToLocationItem(result: NominatimResult): LocationItem {
  const address = result.address ?? {};
  const cityName =
    address.city ?? address.town ?? address.county ?? result.display_name.split(',')[0].trim();
  const districtName = address.suburb ?? address.state_district ?? '';
  const country = address.country ?? '';

  return {
    id: `nominatim-${result.lat}-${result.lon}`,
    cityName,
    districtName,
    country,
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
  };
}

export interface GeocodingClient {
  searchLocations(query: string): Promise<LocationItem[]>;
  reverseGeocode(lat: number, lng: number): Promise<LocationItem | null>;
}

const USER_AGENT = 'VAKIT-Namaz-App/1.0 (https://github.com/yasinsgrc/pray-planner)';
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

export function createGeocodingClient(fetchImpl: typeof fetch = fetch): GeocodingClient {
  async function searchLocations(query: string): Promise<LocationItem[]> {
    const url = `${NOMINATIM_BASE_URL}/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=8`;
    const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });

    if (!res.ok) {
      throw new Error(`Nominatim arama başarısız: ${res.status}`);
    }

    const results = (await res.json()) as NominatimResult[];
    return results.map(mapNominatimResultToLocationItem);
  }

  async function reverseGeocode(lat: number, lng: number): Promise<LocationItem | null> {
    const url = `${NOMINATIM_BASE_URL}/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`;
    const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });

    if (!res.ok) {
      return null;
    }

    const result = (await res.json()) as NominatimResult;
    if (!result || !result.lat) {
      return null;
    }

    return mapNominatimResultToLocationItem(result);
  }

  return { searchLocations, reverseGeocode };
}

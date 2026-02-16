export interface City {
  slug: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  defaultMapZoom: number;
}

export const CITIES: Record<string, City> = {
  houston: {
    slug: "houston",
    name: "Houston",
    state: "TX",
    latitude: 29.7604,
    longitude: -95.3698,
    radiusMiles: 50,
    defaultMapZoom: 9,
  },
};

export function getCityBySlug(slug: string): City | undefined {
  return CITIES[slug.toLowerCase()];
}

export function getDefaultCity(): City {
  return CITIES.houston;
}

export function getNearestCity(lat: number, lng: number): City {
  const R = 3959;
  let nearest = getDefaultCity();
  let minDist = Infinity;

  for (const city of Object.values(CITIES)) {
    const dLat = ((city.latitude - lat) * Math.PI) / 180;
    const dLng = ((city.longitude - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) *
        Math.cos((city.latitude * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (dist < minDist) {
      minDist = dist;
      nearest = city;
    }
  }

  return nearest;
}

/** Match a city name (from geo-IP headers) to a city slug */
export function matchCityName(name: string): City | undefined {
  const lower = name.toLowerCase().trim();
  return Object.values(CITIES).find(
    (c) => c.name.toLowerCase() === lower,
  );
}

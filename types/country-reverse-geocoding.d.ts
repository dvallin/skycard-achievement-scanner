declare module "country-reverse-geocoding" {
  export function country_reverse_geocoding(): {
    get_country(
      lat: number,
      lon: number,
    ): { name: string; code: string } | null;
  };
}

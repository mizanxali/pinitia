export interface Venue {
  placeId: string;
  name: string;
  address: string;
  photoUrl?: string;
}

// Curated venue list — operator-managed, not user-created
export const CURATED_VENUES: Venue[] = [
  {
    placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
    name: "Sydney Opera House",
    address: "Bennelong Point, Sydney NSW 2000, Australia",
  },
  {
    placeId: "ChIJj61dQgK6j4AR4GeTYWZsKWw",
    name: "Googleplex",
    address: "1600 Amphitheatre Parkway, Mountain View, CA",
  },
  {
    placeId: "ChIJP3Sa8ziYEmsRUKgyFmh9AQM",
    name: "Sydney Tower Eye",
    address: "100 Market St, Sydney NSW 2000, Australia",
  },
  {
    placeId: "ChIJOwg_06VPwokRYv534QaPC8g",
    name: "Statue of Liberty",
    address: "New York, NY 10004, United States",
  },
  {
    placeId: "ChIJD7fiBh9u5kcRYJSMaMOCCwQ",
    name: "Eiffel Tower",
    address: "Champ de Mars, 5 Av. Anatole France, Paris",
  },
  {
    placeId: "ChIJLU7jZClu5kcR4PcOOO6p3I0",
    name: "Louvre Museum",
    address: "Rue de Rivoli, 75001 Paris, France",
  },
];

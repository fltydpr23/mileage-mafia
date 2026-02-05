export const MAFIA_LEVELS = [
  { minKm: 0, level: 1 },
  { minKm: 100, level: 2 },
  { minKm: 500, level: 3 },
  { minKm: 1000, level: 4 },
  { minKm: 2000, level: 5 },
] as const;

export function getMafiaLevel(km: number) {
  return (
    MAFIA_LEVELS.find((l) => km >= l.minKm) ??
    MAFIA_LEVELS[MAFIA_LEVELS.length - 1]
  );
}
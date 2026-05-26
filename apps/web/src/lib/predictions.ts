export function winProbability(team1Rating: number, team2Rating: number): number {
  const k = 0.75;
  const diff = team1Rating - team2Rating;
  return 1 / (1 + Math.pow(10, -diff * k));
}

export function formatProbability(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export const CHART_PALETTE: string[] = [
  'hsl(217, 90%, 58%)',
  'hsl(340, 85%, 58%)',
  'hsl(160, 75%, 45%)',
  'hsl(35, 95%, 55%)',
  'hsl(280, 70%, 60%)',
  'hsl(15, 85%, 58%)',
  'hsl(195, 85%, 45%)',
  'hsl(55, 90%, 50%)',
  'hsl(250, 65%, 65%)',
  'hsl(175, 80%, 50%)',
  'hsl(10, 80%, 62%)',
  'hsl(45, 85%, 55%)',
  'hsl(310, 60%, 58%)',
  'hsl(130, 70%, 48%)',
  'hsl(225, 75%, 62%)',
  'hsl(20, 90%, 50%)',
];

export function pickColors(count: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    colors.push(CHART_PALETTE[i % CHART_PALETTE.length]!);
  }
  return colors;
}

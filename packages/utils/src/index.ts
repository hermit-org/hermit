export function formatId(id: string): string {
  return `id_${id}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

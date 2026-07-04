/** 订阅过滤选项 */
export const restypeOptions = [
  { label: 'BluRay', value: 'BLURAY' },
  { label: 'Remux', value: 'REMUX' },
  { label: 'UHD', value: 'UHD' },
  { label: 'WEB-DL', value: 'WEB' },
  { label: 'HDTV', value: 'HDTV' },
  { label: 'HDR', value: 'HDR' },
  { label: '3D', value: '3D' },
  { label: 'Dolby Vision', value: 'DOLBY' },
  { label: 'H265', value: 'H265' },
  { label: 'H264', value: 'H264' },
];

export const pixOptions = [
  { label: '8K', value: '8K' },
  { label: '4K', value: '4K' },
  { label: '1080P', value: '1080P' },
  { label: '720P', value: '720P' },
];

export function splitMultiSelect(value: any): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value == null || value === '') return [];
  return String(value)
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinMultiSelect(values: string[]): string {
  return values.join(',');
}

function findOptionLabel(
  value: string,
  options: { label: string; value: string }[],
): string {
  const normalized = value.trim().toUpperCase();
  const option = options.find((o) => o.value.toUpperCase() === normalized);
  return option?.label || value;
}

export function getRestypeLabel(value: string): string {
  return findOptionLabel(value, restypeOptions);
}

export function getPixLabel(value: string): string {
  return findOptionLabel(value, pixOptions);
}

export function formatRestype(value: any): string {
  return splitMultiSelect(value)
    .map((v) => getRestypeLabel(v))
    .join(', ');
}

export function formatPix(value: any): string {
  return splitMultiSelect(value)
    .map((v) => getPixLabel(v))
    .join(', ');
}

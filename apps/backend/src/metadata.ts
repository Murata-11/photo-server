type Tags = Record<string, unknown>;
export function normalizeMetadata(tags: Tags | undefined) {
  const value = tags?.DateTimeOriginal;
  let local: string | null = null;
  if (
    typeof value === 'string' &&
    /^\d{4}:\d{2}:\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(value)
  ) {
    const candidate =
      value.slice(0, 10).replaceAll(':', '-') + 'T' + value.slice(11);
    const date = new Date(candidate + 'Z');
    if (
      !Number.isNaN(date.valueOf()) &&
      date.toISOString().slice(0, 19) === candidate
    ) {
      const sub = tags?.SubSecTimeOriginal;
      local =
        candidate +
        (typeof sub === 'string' && /^\d+$/.test(sub) ? '.' + sub : '');
    }
  }
  let offsetMinutes: number | null = null;
  const offset = tags?.OffsetTimeOriginal;
  if (local && typeof offset === 'string' && /^[+-]\d{2}:\d{2}$/.test(offset)) {
    const hours = Number(offset.slice(1, 3)),
      minutes = Number(offset.slice(4));
    const total = hours * 60 + minutes;
    if (minutes < 60 && total <= 840)
      offsetMinutes = (offset[0] === '-' ? -1 : 1) * total;
  }
  const lat = tags?.latitude,
    lon = tags?.longitude;
  const hasLocation =
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    typeof lon === 'number' &&
    Number.isFinite(lon) &&
    Math.abs(lon) <= 180;
  return {
    timeStatus: local ? 'succeeded' : 'absent',
    locationStatus: hasLocation ? 'succeeded' : 'absent',
    takenAtLocal: local,
    offsetMinutes,
    latitude: hasLocation ? lat : null,
    longitude: hasLocation ? lon : null,
    parserVersion: 'exifr@7.1.3',
  };
}

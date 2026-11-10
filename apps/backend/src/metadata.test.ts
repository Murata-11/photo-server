import { expect, it } from 'vitest';
import { normalizeMetadata } from './metadata.js';
it('preserves local time, subsecond precision and known offset without guessing', () => {
  expect(
    normalizeMetadata({
      DateTimeOriginal: '2026:11:10 15:04:05',
      SubSecTimeOriginal: '0012300',
      OffsetTimeOriginal: '+09:00',
      latitude: 35.123456789,
      longitude: 139.123456789,
    }),
  ).toMatchObject({
    takenAtLocal: '2026-11-10T15:04:05.0012300',
    offsetMinutes: 540,
    latitude: 35.123456789,
    longitude: 139.123456789,
  });
  expect(
    normalizeMetadata({ DateTimeOriginal: '2026:11:10 15:04:05' })
      .offsetMinutes,
  ).toBeNull();
  expect(
    normalizeMetadata({
      DateTimeOriginal: '2026:11:10 15:04:05',
      OffsetTimeOriginal: '-03:30',
    }).offsetMinutes,
  ).toBe(-210);
});
it('leaves missing or invalid metadata unset, independently', () => {
  expect(normalizeMetadata(undefined)).toMatchObject({
    takenAtLocal: null,
    offsetMinutes: null,
    latitude: null,
    longitude: null,
  });
  for (const date of ['invalid', '2026:02:31 12:00:00', '2026:11:10 25:00:00'])
    expect(
      normalizeMetadata({ DateTimeOriginal: date }).takenAtLocal,
    ).toBeNull();
  for (const offset of ['+15:00', '+09:99', 'bad'])
    expect(
      normalizeMetadata({
        DateTimeOriginal: '2026:11:10 15:04:05',
        OffsetTimeOriginal: offset,
      }).offsetMinutes,
    ).toBeNull();
  expect(
    normalizeMetadata({
      DateTimeOriginal: 'invalid',
      latitude: 0,
      longitude: 0,
    }),
  ).toMatchObject({ timeStatus: 'absent', locationStatus: 'succeeded' });
  for (const coordinates of [
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: 181 },
    { latitude: NaN, longitude: 0 },
    { latitude: 0 },
  ])
    expect(normalizeMetadata(coordinates).latitude).toBeNull();
});

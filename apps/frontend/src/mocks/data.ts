import type { components } from '../lib/api.generated';
export type Photo = components['schemas']['Photo'];
const names = [
  '湖畔の朝',
  '山へ続く道',
  '青い時間',
  '旅先の風景',
  '光のある場所',
  '週末の小旅行',
  'いつかの海',
  '静かな午後',
  '緑を歩く',
  '夏の記憶',
  '風に揺れる',
  'ふたりの休日',
  '空を見上げて',
  '街角で',
  '帰り道',
  '木漏れ日',
  '遠くの景色',
  '何気ない一日',
];
export const seed: Photo[] = names.map((name, i) => ({
  id: String(i + 1),
  createdAt: '2026-11-10T00:00:00.000Z',
  originalUrl: `photos/${String(i + 1).padStart(2, '0')}.jpg`,
  src: `photos/${String(i + 1).padStart(2, '0')}.jpg`,
  name,
  date: i < 8 ? '2026-11-08' : i < 13 ? '2026-11-03' : '2026-10-25',
  location: i < 8 ? '長野' : i < 13 ? '鎌倉' : '京都',
  favorite: [0, 2, 5, 8, 12].includes(i),
  deleted: false,
  album: i < 8 ? '秋の小旅行' : i < 13 ? '海のある休日' : '日々のかけら',
}));

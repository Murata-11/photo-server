import { HttpResponse, delay, type HttpResponseResolver } from 'msw';
import { seed, type Photo } from './data';
let photos = structuredClone(seed);
let albums: string[] = [...new Set(seed.flatMap((p) => p.albums))];
let mode: 'normal' | 'empty' | 'error' | 'loading' = 'normal';
export function resetStore(next: typeof mode = 'normal') {
  photos = next === 'empty' ? [] : structuredClone(seed);
  mode = next;
  membershipMode = 'normal';
  bulkMode = 'normal';
  uploadMode = 'normal';
  bulkCommitted = false;
  albums = next === 'empty' ? [] : [...new Set(seed.flatMap((p) => p.albums))];
}
export const listPhotos: HttpResponseResolver = async () => {
  await delay(mode === 'loading' ? 60000 : 180);
  return mode === 'error' || (bulkMode === 'refresh' && bulkCommitted)
    ? HttpResponse.json(
        { message: '写真を読み込めませんでした' },
        { status: 500 },
      )
    : HttpResponse.json(photos);
};
export const createPhoto: HttpResponseResolver = async ({ request }) => {
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return new HttpResponse(null, { status: 400 });
  if (uploadMode === 'saving') await delay('infinite');
  const uploadError = {
    pixels: [422, '6,000万画素以下の画像を選んでください'],
    corrupt: [422, '画像を読み込めません。破損していない画像を選んでください'],
    mismatch: [422, '画像の形式と内容が一致しません'],
    multiple: [422, '複数画像・アニメーション・動画には対応していません'],
    unsupported: [415, 'JPEG・PNG・WebPの静止画像を選んでください'],
    busy: [503, '画像を処理できませんでした。時間をおいて再試行してください'],
  } as const;
  if (uploadMode !== 'normal' && uploadMode !== 'saving') {
    const [status, message] = uploadError[uploadMode];
    return HttpResponse.json({ message }, { status });
  }
  const src = URL.createObjectURL(file);
  const p: Photo = {
    id: crypto.randomUUID(),
    src,
    originalUrl: src,
    createdAt: new Date().toISOString(),
    name: file.name,
    date: '2026-11-10',
    location: '追加した写真',
    favorite: false,
    deleted: false,
    albums: [],
  };
  photos.unshift(p);
  return HttpResponse.json(p);
};
export const updatePhoto: HttpResponseResolver = async ({
  request,
  params,
}) => {
  const photo = photos.find((p) => p.id === params.id);
  if (!photo) return new HttpResponse(null, { status: 404 });
  const body = (await request.json()) as Record<string, unknown>;
  if (
    Object.keys(body).some((k) => !['favorite', 'deleted'].includes(k)) ||
    ('favorite' in body && typeof body.favorite !== 'boolean') ||
    ('deleted' in body && typeof body.deleted !== 'boolean')
  )
    return new HttpResponse(null, { status: 400 });
  Object.assign(photo, body);
  return HttpResponse.json(photo);
};

export const listAlbums: HttpResponseResolver = () =>
  HttpResponse.json([
    ...new Set([...albums, ...photos.flatMap((p) => p.albums)]),
  ]);
export const createAlbum: HttpResponseResolver = async ({ request }) => {
  const { name } = (await request.json()) as { name: string };
  albums.push(name);
  return HttpResponse.json(name);
};
export const getCurrentUser: HttpResponseResolver = () =>
  HttpResponse.json({ displayName: 'Storybook利用者' });
export const originalPhoto: HttpResponseResolver = () =>
  new HttpResponse(null, { status: 404 });
export const thumbnailPhoto: HttpResponseResolver = () =>
  new HttpResponse(null, { status: 404 });

// Review fixtures only. The production API and DB migration are a later PR.
let membershipMode: 'normal' | 'saving' | 'error' | 'partial' = 'normal';
export function membershipFixture(
  next: typeof membershipMode,
  empty = false,
  trash = false,
) {
  resetStore();
  membershipMode = next;
  albums = empty ? [] : ['空のアルバム', '秋の小旅行', '海のある休日'];
  const first = seed[0];
  if (!first) throw new Error('Missing fixture');
  photos = [
    {
      ...first,
      albums: empty ? [] : ['秋の小旅行', '海のある休日'],
      deleted: trash,
    },
  ];
}
const changeMembership: HttpResponseResolver = async ({ request, params }) => {
  await delay(membershipMode === 'saving' ? 60000 : 180);
  if (
    membershipMode === 'error' ||
    (membershipMode === 'partial' && request.method === 'DELETE')
  )
    return HttpResponse.json(
      { message: '所属を保存できませんでした' },
      { status: 500 },
    );
  const photo = photos.find((p) => p.id === params.id);
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
  } | null;
  if (
    !body ||
    Object.keys(body).join() !== 'name' ||
    typeof body.name !== 'string' ||
    !body.name.length ||
    body.name.length > 100
  )
    return new HttpResponse(null, { status: 400 });
  const known = new Set([...albums, ...photos.flatMap((p) => p.albums)]);
  if (!photo || !known.has(body.name))
    return new HttpResponse(null, { status: 404 });
  photo.albums =
    request.method === 'PUT'
      ? [...new Set([...photo.albums, body.name])].sort()
      : photo.albums.filter((n) => n !== body.name);
  return new HttpResponse(null, { status: 204 });
};
export const addPhotoAlbum = changeMembership;
export const removePhotoAlbum = changeMembership;

export function manyAlbumsFixture() {
  membershipFixture('normal');
  albums = Array.from(
    { length: 120 },
    (_, i) => `思い出アルバム${String(i + 1).padStart(3, '0')}`,
  );
  albums.push('とても長いアルバム名'.repeat(8));
  const first = photos[0];
  if (first) first.albums = albums.slice(0, 8);
}

let bulkMode: 'normal' | 'saving' | 'error' | 'unknown' | 'refresh' = 'normal';
let bulkCommitted = false;
export function bulkFixture(next: typeof bulkMode = 'normal', empty = false) {
  resetStore();
  bulkMode = next;
  bulkCommitted = false;
  // UUID fixtures comply with the production contract.
  photos = photos.map((p, i) => ({
    ...p,
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    albums: empty ? [] : p.albums,
  }));
  if (empty) albums = [];
}
export const addPhotosAlbum: HttpResponseResolver = async ({ request }) => {
  await delay(bulkMode === 'saving' ? 60000 : 180);
  const body = (await request.json().catch(() => null)) as {
    photoIds?: unknown;
    name?: unknown;
  } | null;
  const ids = body?.photoIds;
  if (
    !body ||
    Object.keys(body).some((k) => !['photoIds', 'name'].includes(k)) ||
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > 100 ||
    new Set(ids).size !== ids.length ||
    ids.some(
      (id) =>
        typeof id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        ),
    ) ||
    typeof body.name !== 'string' ||
    !body.name.length ||
    Array.from(body.name).length > 100
  )
    return HttpResponse.json({ message: '入力が不正です' }, { status: 400 });
  const name = body.name;
  const targets = photos.filter((p) => ids.includes(p.id));
  if (targets.length !== ids.length || !albums.includes(name))
    return HttpResponse.json(
      { message: '写真またはアルバムが見つかりません' },
      { status: 404 },
    );
  if (targets.some((p) => p.deleted))
    return HttpResponse.json(
      { message: 'ゴミ箱内の写真が含まれています。選択を見直してください' },
      { status: 409 },
    );
  if (bulkMode === 'error')
    return HttpResponse.json(
      { message: '追加できませんでした（変更なし）' },
      { status: 500 },
    );
  for (const p of targets) p.albums = [...new Set([...p.albums, name])].sort();
  bulkCommitted = true;
  if (bulkMode === 'unknown') return HttpResponse.error();
  return new HttpResponse(null, { status: 204 });
};

// Issue #20の画面仕様専用。実デコード・寸法・破損の検証ではない。
let uploadMode:
  | 'normal'
  | 'saving'
  | 'pixels'
  | 'corrupt'
  | 'mismatch'
  | 'multiple'
  | 'unsupported'
  | 'busy' = 'normal';
export function uploadFixture(next: typeof uploadMode = 'normal') {
  resetStore();
  uploadMode = next;
}

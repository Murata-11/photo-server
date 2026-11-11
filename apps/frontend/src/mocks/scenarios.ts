import { HttpResponse, delay, type HttpResponseResolver } from 'msw';
import { seed, type Photo } from './data';
let photos = structuredClone(seed);
let albums: string[] = [...new Set(seed.flatMap((p) => p.albums))];
let mode: 'normal' | 'empty' | 'error' | 'loading' = 'normal';
export function resetStore(next: typeof mode = 'normal') {
  photos = next === 'empty' ? [] : structuredClone(seed);
  mode = next;
  membershipMode = 'normal';
  albums = next === 'empty' ? [] : [...new Set(seed.flatMap((p) => p.albums))];
}
export const listPhotos: HttpResponseResolver = async () => {
  await delay(mode === 'loading' ? 60000 : 180);
  return mode === 'error'
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

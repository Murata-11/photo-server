import { HttpResponse, delay, type HttpResponseResolver } from 'msw';
import { seed, type Photo } from './data';
let photos = structuredClone(seed);
let albums: string[] = [];
let mode: 'normal' | 'empty' | 'error' | 'loading' = 'normal';
export function resetStore(next: typeof mode = 'normal') {
  photos = next === 'empty' ? [] : structuredClone(seed);
  mode = next;
  albums = [];
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
    album: '',
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
    Object.keys(body).some(
      (k) => !['favorite', 'deleted', 'album'].includes(k),
    ) ||
    ('favorite' in body && typeof body.favorite !== 'boolean') ||
    ('deleted' in body && typeof body.deleted !== 'boolean') ||
    ('album' in body && typeof body.album !== 'string')
  )
    return new HttpResponse(null, { status: 400 });
  Object.assign(photo, body);
  return HttpResponse.json(photo);
};

export const listAlbums: HttpResponseResolver = () =>
  HttpResponse.json([
    ...new Set([...albums, ...photos.map((p) => p.album).filter(Boolean)]),
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

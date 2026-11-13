// Generated from api/openapi.yaml by scripts/generate-mocks.mjs. Do not edit.
import type { operations } from './api.generated';
type Response<K extends keyof operations> = operations[K] extends {
  responses: { 200: { content: { 'application/json': infer T } } };
}
  ? T
  : never;
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'X-Photo-Request': '1', ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      body?.message || '通信に失敗しました。もう一度お試しください。',
    );
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export const api = {
  list: () => request<Response<'listPhotos'>>('/api/photos'),
  me: () => request<Response<'getCurrentUser'>>('/api/me'),
  albums: () => request<Response<'listAlbums'>>('/api/albums'),
  deleteAlbum: (name: string) =>
    request<undefined>('/api/albums', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  createAlbum: (name: string) =>
    request<Response<'createAlbum'>>('/api/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  addAlbum: (id: string, name: string) =>
    request<undefined>('/api/photos/' + encodeURIComponent(id) + '/albums', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  addPhotosAlbum: (
    body: operations['addPhotosAlbum']['requestBody']['content']['application/json'],
  ) =>
    request<undefined>('/api/photos/albums', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  trashPhotos: (
    body: operations['trashPhotos']['requestBody']['content']['application/json'],
  ) =>
    request<undefined>('/api/photos/trash', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  removeAlbum: (id: string, name: string) =>
    request<undefined>('/api/photos/' + encodeURIComponent(id) + '/albums', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }),
  update: (
    id: string,
    body: operations['updatePhoto']['requestBody']['content']['application/json'],
  ) =>
    request<Response<'updatePhoto'>>('/api/photos/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  create: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<Response<'createPhoto'>>('/api/photos', {
      method: 'POST',
      body,
    });
  },
};

// Use the same original bytes for image display and a separate browser preview.
export function originalPreviewUrl(originalUrl: string) {
  const url = new URL(originalUrl, window.location.href);
  url.searchParams.set('disposition', 'inline');
  return url.href;
}

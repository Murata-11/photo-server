// Request the original bytes for in-page image display.
export function originalPreviewUrl(originalUrl: string) {
  const url = new URL(originalUrl, window.location.href);
  url.searchParams.set('disposition', 'inline');
  return url.href;
}

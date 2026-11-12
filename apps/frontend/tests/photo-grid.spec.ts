import { test, expect } from '@playwright/test';

const url = `/iframe.html?id=${encodeURIComponent('スマートフォン-iphone-16--playground')}&viewMode=story&smartphoneCanvas=1`;

for (const width of [320, 393, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`異なる縦横比でも写真グリッドが揃う ${width} ${colorScheme}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ colorScheme });
      await page.goto(url);
      const tiles = page.locator('.continuous-photo-grid .photo-tile');
      await expect(tiles.first()).toBeVisible({ timeout: 20000 });
      // 実画像に依存しない合成画像で極端な縦長・横長も再現する。
      await tiles.locator('img').evaluateAll(async (images) => {
        await Promise.all(
          images.map(async (element, index) => {
            const image = element as HTMLImageElement;
            const [w, h] = [
              [100, 1200],
              [1600, 100],
              [400, 400],
            ][index % 3];
            image.loading = 'eager';
            image.src = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="teal"/></svg>`)}`;
            await image.decode();
          }),
        );
      });
      const bounds = await tiles.evaluateAll((elements) =>
        elements.map((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          const image = element.querySelector('img');
          if (!image) throw new Error('写真がありません');
          const rect = image.getBoundingClientRect();
          return {
            x,
            y,
            width,
            height,
            imageWidth: rect.width,
            imageHeight: rect.height,
          };
        }),
      );
      expect(bounds.length).toBeGreaterThan(6);
      const first = bounds[0];
      const columns = bounds.filter(
        (tile) => Math.abs(tile.y - first.y) < 1,
      ).length;
      for (const [index, tile] of bounds.entries()) {
        expect(Math.abs(tile.width - first.width)).toBeLessThan(1);
        expect(Math.abs(tile.height - first.width)).toBeLessThan(1);
        expect(Math.abs(tile.imageWidth - tile.width)).toBeLessThan(1);
        expect(Math.abs(tile.imageHeight - tile.height)).toBeLessThan(1);
        expect(
          Math.abs(tile.y - bounds[Math.floor(index / columns) * columns].y),
        ).toBeLessThan(1);
        if (index >= columns) {
          const above = bounds[index - columns];
          expect(Math.abs(tile.x - above.x)).toBeLessThan(1);
          expect(Math.abs(tile.y - (above.y + above.height + 2))).toBeLessThan(
            1,
          );
        }
      }
    });
  }
}

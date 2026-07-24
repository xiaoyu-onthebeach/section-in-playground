/**
 * Extracts a representative dominant color from an image: downsamples it
 * onto a small offscreen canvas, quantizes pixels into coarse color buckets,
 * and ranks buckets by pixel occupancy (how many pixels fall in each) rather
 * than by brightness — "dominant" means most-occupied, not darkest or
 * lightest. Of the top 2 dominant buckets, the darker one (by luminance) is
 * returned, continuing this app's preference for a moody section fill over
 * whatever the single most common color happens to be (which is often a
 * bright background/highlight, not the tone the section should read as).
 * Used to tint a section's background once it has a member scene, instead
 * of a fixed neutral fill.
 *
 * Results are cached per image URL (module-level Map) — the canvas work
 * only ever runs once per distinct image, no matter how many sections/
 * renders reference it.
 */

const colorCache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();

const FALLBACK_RGB = '47, 47, 55'; // #2F2F37, used if decoding/reading pixels ever fails
const BUCKET_SIZE = 32; // quantization step per channel — groups near-identical shades so gradients still cluster into a dominant bucket

function quantize(value: number): number {
  return Math.min(255, Math.round(value / BUCKET_SIZE) * BUCKET_SIZE);
}

export function getDominantColorRgb(imageUrl: string): Promise<string> {
  const cached = colorCache.get(imageUrl);
  if (cached) return Promise.resolve(cached);

  const inFlight = pending.get(imageUrl);
  if (inFlight) return inFlight;

  const promise = new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const finish = (rgb: string) => {
      colorCache.set(imageUrl, rgb);
      pending.delete(imageUrl);
      resolve(rgb);
    };

    img.onload = () => {
      try {
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish(FALLBACK_RGB);
          return;
        }
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Bucket pixels by quantized color, accumulating the exact-value sum
        // per bucket (not just the quantized key) so the final color is a
        // true average of what actually landed in that bucket.
        const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const key = `${quantize(r)},${quantize(g)},${quantize(b)}`;
          const bucket = buckets.get(key);
          if (bucket) {
            bucket.r += r;
            bucket.g += g;
            bucket.b += b;
            bucket.count += 1;
          } else {
            buckets.set(key, { r, g, b, count: 1 });
          }
        }
        if (buckets.size === 0) {
          finish(FALLBACK_RGB);
          return;
        }

        // Dominant = most pixels occupied, i.e. highest count — not sorted by brightness.
        const ranked = [...buckets.values()].sort((a, b) => b.count - a.count);
        const top2 = ranked.slice(0, 2).map((bucket) => ({
          r: bucket.r / bucket.count,
          g: bucket.g / bucket.count,
          b: bucket.b / bucket.count,
        }));
        const darker = top2.reduce((a, b) =>
          0.2126 * a.r + 0.7152 * a.g + 0.0722 * a.b <= 0.2126 * b.r + 0.7152 * b.g + 0.0722 * b.b ? a : b
        );
        finish(`${Math.round(darker.r)}, ${Math.round(darker.g)}, ${Math.round(darker.b)}`);
      } catch {
        // e.g. canvas tainted by a cross-origin image with no CORS headers
        finish(FALLBACK_RGB);
      }
    };
    img.onerror = () => finish(FALLBACK_RGB);
    img.src = imageUrl;
  });

  pending.set(imageUrl, promise);
  return promise;
}

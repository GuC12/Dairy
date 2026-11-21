import type { PhotoItem } from '../types/diary';

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  );
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return { r: 120, g: 120, b: 120 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function getColorWarmth(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  // Положительное значение — тёплый цвет, отрицательное — холодный
  return (r + g * 0.25 - b * 1.1) / 255;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function extractColorMetrics(img: HTMLImageElement): {
  dominantColors: string[];
  brightness: number;
  contrast: number;
} {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      dominantColors: ['#8c7a6b', '#4a453f', '#c9b8a3', '#2b2825'],
      brightness: 0.5,
      contrast: 0.4,
    };
  }

  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
  let lumSum = 0;
  let lumSqSum = 0;
  const pixelCount = size * size;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    lumSum += lum;
    lumSqSum += lum * lum;

    // Квантование в корзину по 32 шага
    const qr = Math.floor(r / 32) * 32;
    const qg = Math.floor(g / 32) * 32;
    const qb = Math.floor(b / 32) * 32;
    const key = `${qr},${qg},${qb}`;

    const existing = buckets.get(key);
    if (existing) {
      existing.r += r;
      existing.g += g;
      existing.b += b;
      existing.count += 1;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  const avgLum = lumSum / pixelCount;
  const variance = Math.max(0, lumSqSum / pixelCount - avgLum * avgLum);
  const stdDev = Math.sqrt(variance);

  const sorted = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Выбираем до 4 достаточно различающихся цветов
  const picked: string[] = [];
  for (const item of sorted) {
    const r = item.r / item.count;
    const g = item.g / item.count;
    const b = item.b / item.count;
    const hex = rgbToHex(r, g, b);
    const tooClose = picked.some((p) => {
      const pr = hexToRgb(p);
      const dist = Math.hypot(pr.r - r, pr.g - g, pr.b - b);
      return dist < 42;
    });
    if (!tooClose) {
      picked.push(hex);
    }
    if (picked.length >= 4) break;
  }

  while (picked.length < 4 && sorted.length > 0) {
    const fallback = sorted[picked.length % sorted.length];
    picked.push(
      rgbToHex(
        fallback.r / fallback.count,
        fallback.g / fallback.count,
        fallback.b / fallback.count
      )
    );
  }

  return {
    dominantColors: picked,
    brightness: Number(avgLum.toFixed(2)),
    contrast: Number(Math.min(1, stdDev * 2.6).toFixed(2)),
  };
}

function resizeToDataUrl(img: HTMLImageElement, maxSide = 1100): string {
  const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * ratio));
  const h = Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return img.src;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.86);
}

export async function analyzePhotoFile(file: File): Promise<PhotoItem> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const optimizedUrl = resizeToDataUrl(img, 1200);
    const metrics = extractColorMetrics(img);

    return {
      id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      dataUrl: optimizedUrl,
      name: file.name,
      ...metrics,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function analyzeDataUrl(dataUrl: string, name: string): Promise<PhotoItem> {
  const img = await loadImage(dataUrl);
  const metrics = extractColorMetrics(img);
  return {
    id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    dataUrl,
    name,
    ...metrics,
  };
}

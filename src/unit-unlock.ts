import type { ProgressStore } from './progression';
export const basicPasscode = ['अ', 'आ', 'इ', 'ई', 'उ'] as const;
const key = 'wayword.unit.ne.basic.v1';
export function isBasicUnlocked(storage: ProgressStore): boolean {
  try { return storage.getItem(key) === 'unlocked'; } catch { return false; }
}
export function saveBasicUnlock(storage: ProgressStore): boolean {
  try { storage.setItem(key, 'unlocked'); return true; } catch { return false; }
}
export function validPasscode(value: string): boolean {
  return value.normalize('NFC').replace(/\s/gu, '') === basicPasscode.join('');
}

/** Guided tracing checks coverage and precision; it does not recognize freehand text. */
export function evaluateTrace(target: Uint8ClampedArray, ink: Uint8ClampedArray, width: number, height: number) {
  function expandedMask(data: Uint8ClampedArray, radius: number) {
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 40) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        const span = Math.floor(Math.sqrt(radius * radius - dy * dy));
        mask.fill(1, yy * width + Math.max(0, x - span), yy * width + Math.min(width, x + span + 1));
      }
    }
    return mask;
  }
  const targetNearby = expandedMask(target, 10);
  const inkNearby = expandedMask(ink, 7);
  let targetPixels = 0, covered = 0, inkPixels = 0, accurate = 0;
  for (let i = 0; i < width * height; i++) {
    if (target[i * 4 + 3] >= 40) { targetPixels++; if (inkNearby[i]) covered++; }
    if (ink[i * 4 + 3] >= 40) { inkPixels++; if (targetNearby[i]) accurate++; }
  }
  const coverage = targetPixels ? covered / targetPixels : 0;
  const precision = inkPixels ? accurate / inkPixels : 0;
  return { coverage, precision, accepted: coverage >= .68 && precision >= .78 };
}

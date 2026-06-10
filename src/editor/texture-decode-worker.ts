import { FloatType } from 'three';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

interface DecodeRequest {
  id: number;
  ext: string;
  buffer: ArrayBuffer;
  maxSize: number;
}

const exrLoader = new EXRLoader();
exrLoader.setDataType(FloatType);
const hdrLoader = new HDRLoader();
hdrLoader.setDataType(FloatType);

function linearToSrgb(v: number): number {
  const c = Math.min(Math.max(v, 0), 1);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

self.onmessage = (e: MessageEvent<DecodeRequest>): void => {
  const { id, ext, buffer, maxSize } = e.data;
  try {
    const parsed = ext === '.exr' ? exrLoader.parse(buffer) : hdrLoader.parse(buffer);
    const width = parsed.width as number;
    const height = parsed.height as number;
    const src = parsed.data as Float32Array;
    const channels = src.length / (width * height);

    const step = maxSize > 0 ? Math.max(1, Math.ceil(Math.max(width, height) / maxSize)) : 1;
    const w = Math.floor(width / step);
    const h = Math.floor(height / step);

    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = ((height - 1 - y * step) * width + x * step) * channels;
        const oi = (y * w + x) * 4;
        out[oi] = linearToSrgb(src[si]) * 255;
        out[oi + 1] = linearToSrgb(src[si + (channels > 1 ? 1 : 0)]) * 255;
        out[oi + 2] = linearToSrgb(src[si + (channels > 2 ? 2 : 0)]) * 255;
        out[oi + 3] = channels === 4 ? Math.min(Math.max(src[si + 3], 0), 1) * 255 : 255;
      }
    }

    (self as unknown as Worker).postMessage({ id, success: true, width: w, height: h, data: out.buffer }, [out.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, success: false, error: String(err) });
  }
};

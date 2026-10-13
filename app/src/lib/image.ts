// Image helpers that run on the phone. The 64-bit dHash must match tools/make_samples.py (PIL "L" + BOX resize to 9x8),
// so the same picture gives the same hash; near-duplicates differ by a few bits.

async function load(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file)
}

/** Grey level exactly like PIL's convert("L"): ITU-R 601-2 luma with its fixed-point rounding. */
const luma = (r: number, g: number, b: number) => (r * 19595 + g * 38470 + b * 7471 + 0x8000) >> 16

export async function dHash(file: Blob): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null
  try {
    const img = await load(file)
    // Hash at natural size up to 2000 px wide; bigger photos are scaled first (still within a couple of bits).
    const scale = Math.min(1, 2000 / img.width)
    const w = Math.max(9, Math.round(img.width * scale)), h = Math.max(8, Math.round(img.height * scale))
    const c = new OffscreenCanvas(w, h)
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0, w, h)
    const px = ctx.getImageData(0, 0, w, h).data
    // BOX resize: each of the 9x8 cells is the plain average of the source pixels it covers.
    const cells: number[] = []
    for (let row = 0; row < 8; row++) {
      const y0 = Math.floor((row * h) / 8), y1 = Math.floor(((row + 1) * h) / 8)
      for (let col = 0; col < 9; col++) {
        const x0 = Math.floor((col * w) / 9), x1 = Math.floor(((col + 1) * w) / 9)
        let sum = 0
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * 4
          sum += luma(px[i], px[i + 1], px[i + 2])
        }
        cells.push(Math.round(sum / ((y1 - y0) * (x1 - x0))))
      }
    }
    let bits = ''
    for (let r = 0; r < 8; r++) for (let col = 0; col < 8; col++) bits += cells[r * 9 + col] < cells[r * 9 + col + 1] ? '1' : '0'
    return BigInt('0b' + bits).toString(16).padStart(16, '0')
  } catch {
    return null // the hash is one optional signal; never block an upload on it
  }
}

/** Phone photos are often over the 5 MB limit: re-encode big images as JPEG, max 2000 px. Small files go up untouched
 *  (so a re-uploaded sample keeps its exact bytes and SHA-256). */
export async function shrinkIfLarge(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= 4.5 * 1024 * 1024) return file
  const img = await load(file)
  const scale = Math.min(1, 2000 / Math.max(img.width, img.height))
  const c = new OffscreenCanvas(Math.round(img.width * scale), Math.round(img.height * scale))
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
}

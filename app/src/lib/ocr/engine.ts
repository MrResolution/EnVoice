import { createWorker, type Worker } from 'tesseract.js'
import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

if (typeof window !== 'undefined' && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker
}

let workerInstance: Worker | null = null

/**
 * Gets or initializes a singleton Tesseract OCR worker.
 */
async function getWorker(): Promise<Worker> {
  if (workerInstance) return workerInstance

  try {
    // Attempt to load locally bundled assets from ./tesseract/
    workerInstance = await createWorker('eng', 1, {
      workerPath: './tesseract/worker.min.js',
      corePath: './tesseract/tesseract-core-lstm.wasm.js',
      langPath: './tesseract',
    })
  } catch (err) {
    console.warn('Local OCR worker asset load failed, falling back to standard loader:', err)
    workerInstance = await createWorker('eng')
  }

  return workerInstance
}

/**
 * Renders the first page of a PDF document to an HTML Canvas for OCR recognition.
 */
export async function renderPdfPage(blob: Blob): Promise<HTMLCanvasElement> {
  const data = new Uint8Array(await blob.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const page = await doc.getPage(1)
  const viewport = page.getViewport({ scale: 2.0 }) // 2.0 scale for crisp OCR line detection

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create 2D canvas context for PDF rendering')

  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  return canvas
}

/**
 * Prepares a photo for OCR: small images are upscaled to ~2000 px on the long side (Tesseract misreads text
 * under ~20 px tall: at half resolution "INV-1001" came out as "W-1001"), then greyscaled with a gentle
 * 2–98 % level stretch. No hard contrast: shaded photos would lose the darker half. Tesseract binarises itself.
 */
export async function preprocessImage(blob: Blob): Promise<HTMLCanvasElement | Blob> {
  if (typeof window === 'undefined' || typeof createImageBitmap === 'undefined') return blob
  try {
    const bmp = await createImageBitmap(blob)
    const maxDim = Math.max(bmp.width, bmp.height)
    const scale = maxDim < 1600 ? Math.min(3, 2000 / maxDim) : 1
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return blob
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, 0, 0, w, h)
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const hist = new Uint32Array(256)
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] * 19595 + d[i + 1] * 38470 + d[i + 2] * 7471 + 0x8000) >> 16
      d[i] = g
      hist[g]++
    }
    const n = d.length / 4
    let lo = 0, hi = 255, acc = 0
    for (; lo < 255 && (acc += hist[lo]) < n * 0.02; lo++);
    acc = 0
    for (; hi > 0 && (acc += hist[hi]) < n * 0.02; hi--);
    const span = Math.max(1, hi - lo)
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span))
      d[i] = d[i + 1] = d[i + 2] = v
    }
    ctx.putImageData(img, 0, 0)
    return canvas
  } catch (err) {
    console.warn('Image preprocessing skipped:', err)
    return blob
  }
}

/**
 * Runs local optical character recognition on an image or PDF file.
 */
export async function recognizeText(file: Blob): Promise<string> {
  const worker = await getWorker()

  if (file.type === 'application/pdf') {
    const canvas = await renderPdfPage(file)
    const res = await worker.recognize(canvas)
    return res.data.text
  }

  const preprocessed = await preprocessImage(file)
  const res = await worker.recognize(preprocessed)
  return res.data.text
}

/**
 * Terminates the OCR worker to free memory when needed.
 */
export async function terminateWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.terminate()
    workerInstance = null
  }
}

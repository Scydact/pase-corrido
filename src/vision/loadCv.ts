import opencvUrl from '../../vendor/opencv/opencv.js?url'
import type { OpenCv } from './detect'

let loading: Promise<{ cv: OpenCv }> | null = null

function addScript() {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = opencvUrl
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('OpenCV failed to load'))
    document.head.append(script)
  })
}

async function start() {
  await addScript()
  const global = (window as unknown as { cv: OpenCv }).cv
  // OpenCV may arrive as a promise, or as an object still starting up. Returned inside an
  // object because resolving a promise with OpenCV itself can hang on its own then().
  const module = global instanceof Promise ? await global : global
  if (!module.Mat) {
    await new Promise<void>((resolve) => {
      module.onRuntimeInitialized = () => resolve()
    })
  }
  return { cv: module }
}

/** Fetches OpenCV only when first needed, since it's far bigger than the rest of the app. */
export async function loadCv(): Promise<OpenCv> {
  loading ??= start().catch((error) => {
    loading = null
    throw error
  })
  const { cv } = await loading
  return cv
}

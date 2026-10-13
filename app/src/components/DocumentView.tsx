import { useEffect, useState } from 'react'
import { BUCKET, supabase } from '../lib/supabase'
import { Skeleton } from '../ui/kit'

/** The original file through a 60-second signed URL (the bucket is private). Refreshes the link before it expires. */
export function DocumentView({ path, type }: { path: string; type: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    const sign = () => supabase.storage.from(BUCKET).createSignedUrl(path, 60).then(({ data }) => {
      if (!alive) return
      if (data?.signedUrl) setUrl(data.signedUrl); else setFailed(true)
    })
    sign()
    const t = setInterval(sign, 50_000)
    return () => { alive = false; clearInterval(t) }
  }, [path])
  if (failed) return <p className="p-4 text-sm text-muted">The document can't be shown to this account.</p>
  if (!url) return <Skeleton className="h-72 w-full" />
  if (type === 'application/pdf') {
    return (
      <div className="space-y-2">
        <object data={url} type="application/pdf" className="h-[70vh] w-full rounded-xl ring-1 ring-line">
          <p className="p-4 text-sm text-muted">This device can't show PDFs inline.</p>
        </object>
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline">Open the PDF</a>
      </div>
    )
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Open full size">
      <img src={url} alt="The uploaded invoice" className="w-full rounded-2xl bg-white ring-1 ring-line" />
    </a>
  )
}

/** Small preview of the uploaded document (signed URL, 60 s). PDFs show a page icon. */
export function DocThumb({ path, type, className = 'h-[98px] w-[74px]' }: { path: string; type: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (type === 'application/pdf') return
    supabase.storage.from(BUCKET).createSignedUrl(path, 60).then(({ data }) => setUrl(data?.signedUrl ?? null))
  }, [path, type])
  if (type === 'application/pdf' || !url) {
    return <div className={`${className} flex items-center justify-center rounded-xl bg-white text-[11px] font-bold text-muted`}>{type === 'application/pdf' ? 'PDF' : ''}</div>
  }
  return <img src={url} alt="" className={`${className} rounded-xl bg-white object-cover object-top`} />
}

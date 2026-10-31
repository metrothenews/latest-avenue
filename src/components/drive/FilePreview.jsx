import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { fileSize, previewUrl, shortDate, typeLabel } from '../../lib/drive.js'

// Google's own preview of a file in a large modal. The preview loads with the browser's Google
// session, so it shows "sign in" if this browser isn't signed in to the Drive's Google account.
export default function FilePreview({ file, onClose }) {
  const preview = file && previewUrl(file)
  return (
    <Modal open={Boolean(file)} onClose={onClose} title={file?.name ?? ''} width="max-w-5xl">
      {file && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/50">
              {typeLabel(file.mimeType)} · {fileSize(file.size)} · Modified {shortDate(file.modifiedTime)}
              {file.owners?.[0] && !file.owners[0].me && ` · Owner: ${file.owners[0].displayName}`}
            </p>
            <Button href={file.webViewLink} target="_blank" rel="noreferrer" variant="secondary">Open in Drive</Button>
          </div>
          {preview && (
            <iframe
              title={`Preview of ${file.name}`}
              src={preview}
              allow="autoplay; fullscreen"
              className="mt-4 h-[65vh] w-full rounded-xl border border-white/10 bg-black/40"
            />
          )}
        </>
      )}
    </Modal>
  )
}

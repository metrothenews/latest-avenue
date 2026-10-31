import { useState } from 'react'

// Drive's type icon, or the file's thumbnail when `thumbnail` is set and one exists.
export default function FileIcon({ file, thumbnail = false, className = '' }) {
  const [broken, setBroken] = useState(false)
  if (thumbnail && file.thumbnailLink && !broken) {
    return (
      <img
        src={file.thumbnailLink}
        alt=""
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setBroken(true)}
        className={`object-cover ${className}`}
      />
    )
  }
  // Drive's iconLink is 16px; ask for a sharper 64px version.
  const icon = file.iconLink?.replace(/\/16\//, '/64/')
  return (
    <span className={`flex items-center justify-center ${className}`}>
      {icon ? <img src={icon} alt="" referrerPolicy="no-referrer" className="h-1/2 max-h-8 w-1/2 max-w-[2rem] object-contain" /> : '📄'}
    </span>
  )
}

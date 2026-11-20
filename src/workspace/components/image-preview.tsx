'use client'

import { XIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'

/** An attached image full size over the page; Esc, the X, or a click outside the image closes it. */
export function ImagePreview(props: {
  readonly onClose: () => void
  readonly src: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  // showModal is a DOM API: open the native dialog once it's mounted.
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  return (
    <dialog
      aria-label="Image preview"
      className="m-auto max-h-dvh max-w-[100vw] bg-transparent p-0 backdrop:bg-black/80"
      onClick={(event) =>
        event.target === event.currentTarget && props.onClose()
      }
      onClose={props.onClose}
      ref={dialog}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="Attached"
        className="block max-h-[92dvh] max-w-[96vw] rounded-lg object-contain"
        src={props.src}
      />
      <button
        aria-label="Close preview"
        className="bg-card text-foreground absolute top-2 right-2 grid size-9 place-items-center rounded-full border"
        onClick={props.onClose}
        type="button"
      >
        <XIcon className="size-4" />
      </button>
    </dialog>
  )
}

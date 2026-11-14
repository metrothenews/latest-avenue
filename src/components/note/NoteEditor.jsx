import { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { note } from '../../data/note.js'

// Rich text editing for a note card (TipTap). Typing "# ", "## ", "* ", "1. " or "> " at the start
// of a line makes a heading, list or quote. `valueRef.current()` gives the fields to save;
// `onEditor(editor)` hands the editor to the toolbar; `onChange()` fires on every change so the
// toolbar can show what is active.
export default function NoteEditor({ html, valueRef, onEditor, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2] }, link: { openOnClick: false } }), Placeholder.configure({ placeholder: note.notePlaceholder })],
    content: html || '',
    autofocus: 'end',
    onTransaction: () => onChange(),
  })

  useEffect(() => {
    if (!editor) return
    // The editor keeps an empty paragraph at the end to click into; it isn't part of the note.
    valueRef.current = () => ({ html: editor.isEmpty ? '' : editor.getHTML().replace(/(<p><\/p>)+$/, '') })
    onEditor(editor)
    return () => {
      valueRef.current = null
      onEditor(null)
    }
  }, [editor]) // eslint-disable-line react-hooks/exhaustive-deps

  return <EditorContent editor={editor} className="note-content" />
}

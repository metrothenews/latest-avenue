import { fieldClass } from './fieldStyles.js'

// Text input with an error message. `as="textarea"` renders a textarea.
// Set `showLabel` to show the label above the field instead of only to screen readers.
export default function TextField({ id, label, error, as = 'input', showLabel = false, ...props }) {
  const Field = as
  return (
    <div>
      <label htmlFor={id} className={showLabel ? 'mb-1.5 block text-sm text-white/70' : 'sr-only'}>{label}</label>
      <Field
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldClass(error)}
        {...props}
      />
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

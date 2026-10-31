// Shared look for inputs, selects and textareas.
export const fieldClass = (error) =>
  `w-full rounded-lg border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/30 ${
    error ? 'border-red-500' : 'border-white/15'
  }`

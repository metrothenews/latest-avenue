// POSTs `data` as JSON to a form service (Formspree, Basin, ...). Throws if it fails.
export async function submitForm(endpoint, data) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`Form service responded ${res.status}`)
}

import { site } from '../data/site.js'

export default function Contact() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:py-24">
      <h1 className="text-4xl font-extrabold tracking-tight">Contact Us</h1>

      <section className="glass mt-10 p-8">
        <h2 className="text-2xl font-semibold">Get in Touch</h2>
        <p className="mt-3 text-white/70">Questions about the label, a release or a deal? Reach us at:</p>
        <p className="mt-4">
          Email: <a href={`mailto:${site.supportEmail}`} className="underline">{site.supportEmail}</a>
        </p>
      </section>
    </div>
  )
}

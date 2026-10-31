import Section from '../../components/ui/Section.jsx'
import Accordion from '../../components/ui/Accordion.jsx'
import { faq } from '../../data/faq.js'
import { site } from '../../data/site.js'

export default function FAQ() {
  return (
    <Section id="faq" title="Frequently Asked Questions">
      <Accordion items={faq} />
      <p className="mt-6 text-white/60">
        Still have questions? Email us at{' '}
        <a href={`mailto:${site.supportEmail}`} className="text-white underline">{site.supportEmail}</a>.
      </p>
    </Section>
  )
}

import Section from '../../components/ui/Section.jsx'
import Button from '../../components/ui/Button.jsx'
import { columns, rows } from '../../data/comparison.js'
import { site } from '../../data/site.js'

export default function Comparison() {
  return (
    <Section id="comparison" title={`${site.name} vs. Going It Alone`}>
      <div className="glass overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-white/5">
            <tr>{columns.map((c) => <th key={c} className="p-4 font-semibold">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const highlight = !Array.isArray(row) && row.highlight
              const cells = Array.isArray(row) ? row : row.cells
              return (
                <tr key={cells[0]} className={`border-t border-white/10 ${highlight ? 'bg-white/10 font-semibold' : ''}`}>
                  {cells.map((c, i) => (
                    <td key={i} className={`p-4 ${i === 0 || highlight ? 'text-white' : 'text-white/60'}`}>{c}</td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Button to={site.submitPath} className="mt-8">Submit Your Music</Button>
    </Section>
  )
}

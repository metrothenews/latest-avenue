import { Link } from 'react-router-dom'
import { site } from '../../data/site.js'

export default function Logo() {
  return <Link to="/" className="text-lg font-extrabold tracking-tight">{site.name}</Link>
}

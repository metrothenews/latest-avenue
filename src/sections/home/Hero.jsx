import Button from '../../components/ui/Button.jsx'

export default function Hero() {
  return (
    <section id="hero" className="px-4 pb-12 pt-24 md:pb-16 md:pt-36">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">the label of the future is here</h1>
        <Button to="/login" variant="secondary" className="mt-10">login</Button>
      </div>
    </section>
  )
}

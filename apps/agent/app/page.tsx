import Link from 'next/link'
import { Check, MessageCircle, Mic, Search, Calendar, BookOpen, Zap } from 'lucide-react'
import { PLANS } from '@/lib/plans'

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="text-xl font-bold text-brand">AgentHub</div>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-neutral-700 hover:text-brand">
            Log in
          </Link>
          <Link href="/register" className="btn-primary">
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          AI agents for <span className="text-brand">WhatsApp</span> &{' '}
          <span className="text-brand">Telegram</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-600">
          Give every customer their own AI assistant — answering chats, taking voice notes, booking
          calendar events, searching the web and your knowledge base, all on autopilot.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-3 text-base">
            Start free
          </Link>
          <Link href="#pricing" className="btn-outline px-6 py-3 text-base">
            See pricing
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-5 px-6 py-10 sm:grid-cols-3">
        {[
          { icon: MessageCircle, title: 'WhatsApp + Telegram', desc: 'One agent, multiple channels.' },
          { icon: Mic, title: 'Voice conversations', desc: 'Understands and replies to voice notes.' },
          { icon: Search, title: 'Web search + images', desc: 'Live info and generated images.' },
          { icon: Calendar, title: 'Google Workspace', desc: 'Gmail, Calendar, Sheets, Drive.' },
          { icon: BookOpen, title: 'Knowledge base', desc: 'Answers grounded in your docs.' },
          { icon: Zap, title: 'Scheduled jobs', desc: 'Reminders and recurring automations.' },
        ].map((f) => (
          <div key={f.title} className="card">
            <f.icon className="h-6 w-6 text-brand" />
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-neutral-600">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold">Simple, transparent pricing</h2>
        <p className="mt-2 text-center text-neutral-600">Cancel anytime · GST included on Indian invoices</p>
        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-4">
          {Object.values(PLANS).map((plan) => {
            const highlight = plan.id === 'pro'
            return (
              <div
                key={plan.id}
                className={`card flex flex-col ${highlight ? 'ring-2 ring-brand' : ''}`}
              >
                {highlight && (
                  <span className="mb-2 inline-block w-fit rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <div className="mt-2 text-3xl font-extrabold">
                  ${plan.priceMonthly}
                  <span className="text-base font-normal text-neutral-500">/mo</span>
                </div>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      <span className="text-neutral-700">{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/register?plan=${plan.id}`}
                  className={`mt-6 ${highlight ? 'btn-primary' : 'btn-outline'} w-full`}
                >
                  {highlight ? '⚡ Choose Pro' : `Choose ${plan.name}`}
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      <footer className="border-t border-neutral-200 py-8 text-center text-sm text-neutral-500">
        © {new Date().getFullYear()} AgentHub · WhatsApp & Telegram AI automation
      </footer>
    </main>
  )
}

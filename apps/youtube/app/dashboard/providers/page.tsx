import { createClient } from '@/lib/supabase/server'
import { listConfiguredProviders } from '@/lib/credentials'
import { ProviderForm } from '@/components/ProviderForm'

export default async function ProvidersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const configured = user ? await listConfiguredProviders(supabase, user.id) : []

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Provider settings</h1>
      <p className="text-sm text-neutral-600">
        Bring your own API keys — this app is never locked to one AI vendor. Every stage of the pipeline reads
        its provider through these settings, so swapping vendors later doesn't touch any code.
      </p>

      <ProviderForm configured={configured ?? []} />

      <div className="card">
        <h2 className="mb-2 font-semibold">Configured</h2>
        <ul className="divide-y divide-neutral-100 text-sm">
          {configured?.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2">
              <span className="capitalize">{c.provider_type.replace('_', ' ')} — {c.provider_name}</span>
              <span className={c.is_active ? 'badge-green' : 'badge-gray'}>{c.is_active ? 'active' : 'inactive'}</span>
            </li>
          ))}
          {!configured?.length && <li className="py-2 text-neutral-500">No providers configured yet.</li>}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold">Background music</h2>
        <p className="text-sm text-neutral-600">
          There's no reliable API for the big licensed-music libraries, so background music comes from a
          self-hosted licence library instead: upload royalty-free / Creative Commons / YouTube Audio Library
          tracks to the <code>music-library</code> Supabase Storage bucket along with a <code>manifest.json</code>{' '}
          recording each track's source and licence. See SETUP.md for the exact format.
        </p>
      </div>
    </div>
  )
}

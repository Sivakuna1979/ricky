// @ts-nocheck
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '../../../../lib/supabase/client'
import { VAN_TYPES } from '../../../../lib/utils/constants'

const schema = z.object({
  full_name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Minimum 8 characters'),
  confirm_password: z.string(),
  business_name: z.string().min(2, 'Enter your business name'),
  business_type: z.enum(['fish_and_chips','burger','coffee','ice_cream','pizza','dessert','street_food','catering_trailer','other']),
  phone: z.string().optional(),
  postcode: z.string().min(5, 'Enter a valid postcode'),
  city: z.string().min(2, 'Enter your city or town'),
  gdpr_consent: z.boolean().refine(v => v, 'You must agree to the privacy policy'),
}).refine(d => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

type FormData = z.infer<typeof schema>

const STEPS = ['Account Details', 'Business Info', 'Review & Submit']

const inputStyle = {
  width: '100%',
  padding: '13px 16px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,.12)',
  background: 'rgba(255,255,255,.06)',
  color: '#fff',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box' as const,
}

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: 'rgba(255,255,255,.6)',
  marginBottom: 6,
}

const errorStyle = {
  fontSize: 12,
  color: '#f87171',
  marginTop: 5,
}

function Field({ label, error, children }: any) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {error && <p style={errorStyle}>⚠ {error}</p>}
    </div>
  )
}

export default function BusinessRegisterPage() {
  const router = useRouter()
  const [alreadyLoggedIn, setAlreadyLoggedIn] = useState(false)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, trigger, getValues, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  // If user is already logged in, check if they already have a business → redirect to dashboard
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useState(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return
      // Check if business already exists
      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle()
      if (biz) {
        router.replace('/dashboard')
        return
      }
      setAlreadyLoggedIn(true)
      setStep(1)
      const u = session.user
      setValue('email', u.email ?? '')
      setValue('full_name', u.user_metadata?.full_name ?? u.email?.split('@')[0] ?? 'User')
      setValue('password', 'Placeholder1!')
      setValue('confirm_password', 'Placeholder1!')
      }
    })
  })

  const nextStep = async () => {
    const fields: (keyof FormData)[][] = [
      ['full_name', 'email', 'password', 'confirm_password'],
      ['business_name', 'business_type', 'phone', 'postcode', 'city'],
      ['gdpr_consent'],
    ]
    const valid = await trigger(fields[step])
    if (valid) setStep(s => s + 1)
  }

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    setServerError('')
    const supabase = createClient()

    // Check if already logged in — skip signUp if so
    const { data: { session: existingSession } } = await supabase.auth.getSession()
    let userId = existingSession?.user?.id ?? null

    if (!userId) {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { full_name: data.full_name, role: 'business_owner' } },
      })

      if (authError || !authData.user) {
        setServerError(authError?.message ?? 'Registration failed')
        setLoading(false)
        return
      }

      userId = authData.user.id

      // Auto-confirm email + create user profile so login works immediately
      await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          email: data.email,
          full_name: data.full_name,
          role: 'business_owner',
        }),
      })

      // Sign in immediately after signup (email is now confirmed)
      await supabase.auth.signInWithPassword({ email: data.email, password: data.password })
    }

    const slug = data.business_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const res = await fetch('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.business_name, slug, business_type: data.business_type,
        phone: data.phone, postcode: data.postcode, city: data.city, email: data.email,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      setServerError(err.error ?? 'Failed to create business')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#080c18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#f97316,#ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🚐</div>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>FoodTaxi</span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.02em' }}>Register Your Food Business</h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,.45)', margin: 0 }}>Get live tracking, online orders, QR codes and more.</p>
        </div>

        {/* Step progress */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, gap: 0 }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800,
                  background: i < step ? '#10b981' : i === step ? 'linear-gradient(135deg,#f97316,#ea580c)' : 'rgba(255,255,255,.08)',
                  color: i <= step ? '#fff' : 'rgba(255,255,255,.3)',
                  border: i === step ? 'none' : i < step ? 'none' : '1px solid rgba(255,255,255,.1)',
                  boxShadow: i === step ? '0 4px 14px rgba(249,115,22,.4)' : 'none',
                  flexShrink: 0,
                }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: i === step ? '#f97316' : 'rgba(255,255,255,.3)', whiteSpace: 'nowrap' }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < step ? '#10b981' : 'rgba(255,255,255,.08)', margin: '0 6px', marginBottom: 18 }} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 20, padding: '28px 24px' }}>

          {serverError && (
            <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#fca5a5', fontSize: 13 }}>
              ⚠️ {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>

            {/* Step 0: Account */}
            {step === 0 && (
              <>
                <Field label="Full Name" error={errors.full_name?.message}>
                  <input {...register('full_name')} style={inputStyle} placeholder="John Smith" />
                </Field>
                <Field label="Email Address" error={errors.email?.message}>
                  <input {...register('email')} type="email" style={inputStyle} placeholder="john@example.com" />
                </Field>
                <Field label="Password" error={errors.password?.message}>
                  <input {...register('password')} type="password" style={inputStyle} placeholder="Minimum 8 characters" />
                </Field>
                <Field label="Confirm Password" error={errors.confirm_password?.message}>
                  <input {...register('confirm_password')} type="password" style={inputStyle} placeholder="••••••••" />
                </Field>
              </>
            )}

            {/* Step 1: Business */}
            {step === 1 && (
              <>
                <Field label="Business Name" error={errors.business_name?.message}>
                  <input {...register('business_name')} style={inputStyle} placeholder="Smith's Fish & Chips" />
                </Field>
                <Field label="Business Type" error={errors.business_type?.message}>
                  <select {...register('business_type')} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="" style={{ background: '#0a0f1e' }}>Select type…</option>
                    {VAN_TYPES.map(t => (
                      <option key={t.value} value={t.value} style={{ background: '#0a0f1e' }}>{t.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Phone Number (optional)">
                  <input {...register('phone')} type="tel" style={inputStyle} placeholder="07700 900000" />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Town / City" error={errors.city?.message}>
                    <input {...register('city')} style={inputStyle} placeholder="Manchester" />
                  </Field>
                  <Field label="Postcode" error={errors.postcode?.message}>
                    <input {...register('postcode')} style={inputStyle} placeholder="M1 1AA" />
                  </Field>
                </div>
              </>
            )}

            {/* Step 2: Review */}
            {step === 2 && (
              <>
                <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
                  {[
                    ['Name', getValues('full_name')],
                    ['Email', getValues('email')],
                    ['Business', getValues('business_name')],
                    ['Type', getValues('business_type')],
                    ['Location', `${getValues('city')}, ${getValues('postcode')}`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.06)', fontSize: 14 }}>
                      <span style={{ color: 'rgba(255,255,255,.4)', fontWeight: 600 }}>{k}</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                  <input {...register('gdpr_consent')} type="checkbox" id="gdpr" style={{ marginTop: 2, width: 16, height: 16, accentColor: '#f97316', flexShrink: 0 }} />
                  <label htmlFor="gdpr" style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', lineHeight: 1.5, cursor: 'pointer' }}>
                    I agree to the <span style={{ color: '#f97316' }}>Privacy Policy</span> and <span style={{ color: '#f97316' }}>Terms of Service</span>. I understand my data will be used to run the Food Taxi platform.
                  </label>
                </div>
                {errors.gdpr_consent && <p style={errorStyle}>⚠ {errors.gdpr_consent.message}</p>}
              </>
            )}

            {/* Navigation buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, gap: 12 }}>
              {step > 0 ? (
                <button type="button" onClick={() => setStep(s => s - 1)}
                  style={{ padding: '13px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.7)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  ← Back
                </button>
              ) : (
                <div />
              )}

              {step < STEPS.length - 1 ? (
                <button type="button" onClick={nextStep}
                  style={{ padding: '13px 28px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 18px rgba(249,115,22,.4)' }}>
                  Next →
                </button>
              ) : (
                <button type="submit" disabled={loading}
                  style={{ padding: '13px 28px', borderRadius: 12, border: 'none', background: loading ? 'rgba(249,115,22,.4)' : 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: loading ? 'wait' : 'pointer', boxShadow: loading ? 'none' : '0 4px 18px rgba(249,115,22,.4)' }}>
                  {loading ? 'Registering…' : '🚀 Register Business'}
                </button>
              )}
            </div>

          </form>
        </div>

        {/* Sign in link */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'rgba(255,255,255,.35)' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#f97316', fontWeight: 700, textDecoration: 'none' }}>Sign in</a>
        </p>

      </div>
    </div>
  )
}

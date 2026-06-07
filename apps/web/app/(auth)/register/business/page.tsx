'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { VAN_TYPES } from '@/lib/utils/constants'

const schema = z.object({
  // Account
  full_name: z.string().min(2, 'Enter your full name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Minimum 8 characters'),
  confirm_password: z.string(),
  // Business
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

export default function BusinessRegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, trigger, getValues, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
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
    const supabase = createClient()

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.full_name, role: 'business_owner' },
      },
    })

    if (authError || !authData.user) {
      toast.error(authError?.message ?? 'Registration failed')
      setLoading(false)
      return
    }

    // 2. Create business via API route (uses service role)
    const slug = data.business_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const res = await fetch('/api/businesses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.business_name,
        slug,
        business_type: data.business_type,
        phone: data.phone,
        postcode: data.postcode,
        city: data.city,
        email: data.email,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      toast.error(err.error ?? 'Failed to create business')
      setLoading(false)
      return
    }

    toast.success('Business registered! Please check your email to confirm your account.')
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Register Your Food Business</h1>
          <p className="mt-2 text-gray-600">Get live tracking, online orders, QR codes and more.</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                i <= step ? 'bg-brand-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-1 mx-2 ${i < step ? 'bg-brand-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="text-center text-sm font-medium text-gray-700 mb-6">{STEPS[step]}</div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-8 rounded-2xl shadow space-y-5">
          {/* Step 0: Account */}
          {step === 0 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input {...register('full_name')} className="input" placeholder="John Smith" />
                {errors.full_name && <p className="error">{errors.full_name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input {...register('email')} type="email" className="input" placeholder="john@example.com" />
                {errors.email && <p className="error">{errors.email.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input {...register('password')} type="password" className="input" placeholder="••••••••" />
                {errors.password && <p className="error">{errors.password.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input {...register('confirm_password')} type="password" className="input" placeholder="••••••••" />
                {errors.confirm_password && <p className="error">{errors.confirm_password.message}</p>}
              </div>
            </>
          )}

          {/* Step 1: Business Info */}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                <input {...register('business_name')} className="input" placeholder="Smith's Fish & Chips" />
                {errors.business_name && <p className="error">{errors.business_name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Type</label>
                <select {...register('business_type')} className="input">
                  <option value="">Select type...</option>
                  {VAN_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {errors.business_type && <p className="error">{errors.business_type.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input {...register('phone')} type="tel" className="input" placeholder="07700 900000" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Town / City</label>
                  <input {...register('city')} className="input" placeholder="Manchester" />
                  {errors.city && <p className="error">{errors.city.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
                  <input {...register('postcode')} className="input" placeholder="M1 1AA" />
                  {errors.postcode && <p className="error">{errors.postcode.message}</p>}
                </div>
              </div>
            </>
          )}

          {/* Step 2: Review */}
          {step === 2 && (
            <>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <p><span className="font-medium">Name:</span> {getValues('full_name')}</p>
                <p><span className="font-medium">Email:</span> {getValues('email')}</p>
                <p><span className="font-medium">Business:</span> {getValues('business_name')}</p>
                <p><span className="font-medium">Type:</span> {getValues('business_type')}</p>
                <p><span className="font-medium">Location:</span> {getValues('city')}, {getValues('postcode')}</p>
              </div>

              <div className="flex items-start gap-3">
                <input {...register('gdpr_consent')} type="checkbox" id="gdpr" className="mt-1 h-4 w-4" />
                <label htmlFor="gdpr" className="text-sm text-gray-600">
                  I agree to the Privacy Policy and Terms of Service. I understand my data will be used to run the VanTrack platform.
                </label>
              </div>
              {errors.gdpr_consent && <p className="error">{errors.gdpr_consent.message}</p>}
            </>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            {step > 0 && (
              <button type="button" onClick={() => setStep(s => s - 1)} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={nextStep} className="ml-auto px-6 py-2 bg-brand-500 text-white rounded-lg font-semibold hover:bg-brand-600">
                Next
              </button>
            ) : (
              <button type="submit" disabled={loading} className="ml-auto px-6 py-2 bg-brand-500 text-white rounded-lg font-semibold hover:bg-brand-600 disabled:opacity-50">
                {loading ? 'Registering...' : 'Register Business'}
              </button>
            )}
          </div>
        </form>
      </div>

      <style jsx>{`
        .input { @apply w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none; }
        .error { @apply mt-1 text-sm text-red-500; }
      `}</style>
    </div>
  )
}

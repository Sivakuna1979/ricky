// @ts-nocheck
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { VanRoute, RouteStop, DayOfWeek } from '@/types/database'
import { StopForm } from './StopForm'
import { toast } from 'sonner'

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

interface Props {
  vanId: string
}

export function RouteBuilder({ vanId }: Props) {
  const [routes, setRoutes] = useState<Record<DayOfWeek, VanRoute & { route_stops: RouteStop[] } | null>>({} as any)
  const [activeDay, setActiveDay] = useState<DayOfWeek>('monday')
  const [addingStop, setAddingStop] = useState(false)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  const todayDay = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('van_routes')
        .select('*, route_stops(*)')
        .eq('van_id', vanId)
        .order('stop_order', { referencedTable: 'route_stops', ascending: true })

      const map: any = {}
      DAYS.forEach(d => { map[d] = null })
      data?.forEach((r: any) => { map[r.day_of_week] = { ...r, route_stops: r.route_stops ?? [] } })
      setRoutes(map)
      setActiveDay(todayDay)
      setLoading(false)
    }
    load()
  }, [vanId])

  const ensureRoute = async (day: DayOfWeek) => {
    if (routes[day]) return routes[day]
    const { data } = await supabase
      .from('van_routes')
      .insert({ van_id: vanId, day_of_week: day, is_active: true })
      .select()
      .single()
    const newRoute = { ...data, route_stops: [] }
    setRoutes(prev => ({ ...prev, [day]: newRoute }))
    return newRoute
  }

  const deleteStop = async (stopId: string) => {
    await supabase.from('route_stops').delete().eq('id', stopId)
    setRoutes(prev => ({
      ...prev,
      [activeDay]: prev[activeDay]
        ? { ...prev[activeDay]!, route_stops: prev[activeDay]!.route_stops.filter(s => s.id !== stopId) }
        : null,
    }))
    toast.success('Stop removed')
  }

  const toggleDay = async (day: DayOfWeek) => {
    const route = routes[day]
    if (!route) return
    await supabase.from('van_routes').update({ is_active: !route.is_active }).eq('id', route.id)
    setRoutes(prev => ({ ...prev, [day]: { ...route, is_active: !route.is_active } }))
  }

  const currentRoute = routes[activeDay]
  const stops = currentRoute?.route_stops ?? []

  if (loading) return <div className="animate-pulse h-64 bg-gray-100 rounded-2xl" />

  return (
    <div className="space-y-4">
      {/* Day tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {DAYS.map(day => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
              activeDay === day
                ? 'bg-brand-500 text-white'
                : day === todayDay
                  ? 'bg-brand-50 text-brand-600 border border-brand-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {day.slice(0, 3).toUpperCase()}
            {day === todayDay && <span className="ml-1 text-xs">(today)</span>}
            {routes[day] && <span className="ml-1 text-xs opacity-70">({routes[day]!.route_stops?.length ?? 0})</span>}
          </button>
        ))}
      </div>

      {/* Day route */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 capitalize">{activeDay}</h3>
          <div className="flex items-center gap-3">
            {currentRoute && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentRoute.is_active}
                  onChange={() => toggleDay(activeDay)}
                  className="h-4 w-4 text-brand-500"
                />
                <span className="text-sm text-gray-600">Active</span>
              </label>
            )}
            <button
              onClick={async () => { await ensureRoute(activeDay); setAddingStop(true) }}
              className="px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600"
            >
              + Add Stop
            </button>
          </div>
        </div>

        {stops.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">📍</p>
            <p className="font-medium">No stops for {activeDay}</p>
            <p className="text-sm">Add your first stop to build today&apos;s route.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {stops.sort((a, b) => a.stop_order - b.stop_order).map((stop, i) => (
              <div key={stop.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 text-sm font-bold flex items-center justify-center">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{stop.name}</p>
                  <p className="text-sm text-gray-500">{stop.postcode}{stop.address ? ` · ${stop.address}` : ''}</p>
                  {stop.notes && <p className="text-xs text-gray-400 mt-0.5">{stop.notes}</p>}
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium text-gray-700">{stop.arrival_time} – {stop.leaving_time}</p>
                </div>
                <button onClick={() => deleteStop(stop.id)} className="text-red-400 hover:text-red-600 text-sm px-2">×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {addingStop && currentRoute && (
        <StopForm
          routeId={currentRoute.id}
          nextOrder={stops.length}
          onClose={() => setAddingStop(false)}
          onSave={(stop) => {
            setRoutes(prev => ({
              ...prev,
              [activeDay]: { ...currentRoute, route_stops: [...stops, stop] },
            }))
            setAddingStop(false)
            toast.success('Stop added')
          }}
        />
      )}
    </div>
  )
}

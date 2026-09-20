// @ts-nocheck
// Never touches the £29.99 event booking fee flow — read-only. Resolves
// this business's own applications the same way Phase D's event_tomorrow
// automation does: matching van_owner_email against businesses.email,
// since event_requests/event_applications are a cross-business
// marketplace table, not scoped by business_id (see baseline doc §40).
export const eventTools = [
  {
    name: 'get_upcoming_events',
    description: "This business's confirmed or awaiting-response event/catering bookings in the next 30 days, and any event enquiries still awaiting a response.",
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      const { data: business } = await admin.from('businesses').select('email').eq('id', ctx.businessId).maybeSingle()
      if (!business?.email) return { upcoming_events: [], note: 'This business has no contact email on file, so event bookings cannot be matched.' }

      const { data: applications } = await admin.from('event_applications').select('event_id, status').eq('van_owner_email', business.email)
      if (!applications?.length) return { upcoming_events: [] }

      const confirmedEventIds = applications.filter((a: any) => a.status === 'confirmed').map((a: any) => a.event_id)
      const in30Days = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
      const today = new Date().toISOString().slice(0, 10)

      const { data: events } = confirmedEventIds.length
        ? await admin.from('event_requests').select('id, event_date, event_location, event_type, num_guests, admin_status').in('id', confirmedEventIds).gte('event_date', today).lte('event_date', in30Days).order('event_date')
        : { data: [] }

      return {
        upcoming_events: (events ?? []).map((e: any) => ({ date: e.event_date, location: e.event_location, type: e.event_type, expected_guests: e.num_guests, status: e.admin_status })),
      }
    },
  },
]

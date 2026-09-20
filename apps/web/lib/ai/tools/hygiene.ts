// @ts-nocheck
// Never fabricates or infers a completed check (E14) — absence of a
// hygiene_logs row is reported as exactly that, "no completed record
// found", not assumed done or not done for any other reason.
export const hygieneTools = [
  {
    name: 'get_hygiene_status',
    description: "Whether opening/closing hygiene checklists have been completed for a given date (default today), optionally for one van. Reports 'no record found' rather than guessing if a check is missing.",
    input_schema: { type: 'object', properties: { date: { type: 'string', description: "YYYY-MM-DD, defaults to today if omitted." }, van_id: { type: 'string' } } },
    async handler(admin: any, ctx: any, args: any) {
      const date = args.date ?? new Date().toISOString().slice(0, 10)
      let vansQuery = admin.from('vans').select('id, name').eq('business_id', ctx.businessId).eq('is_active', true)
      if (args.van_id) vansQuery = vansQuery.eq('id', args.van_id)
      const { data: vans } = await vansQuery
      if (!vans?.length) return { date, vans: [] }

      const { data: logs } = await admin.from('hygiene_logs').select('van_id, log_type, is_compliant, recorded_at').in('van_id', vans.map((v: any) => v.id)).gte('recorded_at', `${date}T00:00:00`).lt('recorded_at', `${date}T23:59:59.999`)

      return {
        date,
        vans: vans.map((v: any) => {
          const vanLogs = (logs ?? []).filter((l: any) => l.van_id === v.id)
          const opening = vanLogs.find((l: any) => l.log_type === 'opening_checklist')
          const closing = vanLogs.find((l: any) => l.log_type === 'closing_checklist')
          return {
            van: v.name,
            opening_checklist: opening ? { completed: true, compliant: opening.is_compliant, at: opening.recorded_at } : { completed: false, note: 'No completed record found' },
            closing_checklist: closing ? { completed: true, compliant: closing.is_compliant, at: closing.recorded_at } : { completed: false, note: 'No completed record found' },
          }
        }),
      }
    },
  },
]

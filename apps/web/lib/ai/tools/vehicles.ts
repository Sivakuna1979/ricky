// @ts-nocheck
// Uses only real Phase C vehicle_details/vehicle_maintenance/equipment
// records — never infers legal/MOT compliance beyond what a stored expiry
// date says (E15).
function daysUntil(date: string): number {
  return Math.round((new Date(date).getTime() - Date.now()) / 86400000)
}

export const vehicleTools = [
  {
    name: 'get_vehicle_alerts',
    description: "Vans with an MOT/insurance/road tax/service date due within 30 days or overdue.",
    input_schema: { type: 'object', properties: {} },
    async handler(admin: any, ctx: any) {
      const { data } = await admin.from('vehicle_details').select('mot_expiry, insurance_expiry, tax_expiry, service_due_date, vans(name)').eq('business_id', ctx.businessId)
      const FIELDS: Record<string, string> = { mot_expiry: 'MOT', insurance_expiry: 'Insurance', tax_expiry: 'Road tax', service_due_date: 'Service' }
      const alerts: any[] = []
      for (const v of data ?? []) {
        for (const [field, label] of Object.entries(FIELDS)) {
          const value = v[field]
          if (!value) continue
          const days = daysUntil(value)
          if (days <= 30) alerts.push({ van: v.vans?.name, type: label, due_date: value, days_remaining: days, overdue: days < 0 })
        }
      }
      return { vehicle_alerts: alerts.sort((a, b) => a.days_remaining - b.days_remaining) }
    },
  },
  {
    name: 'get_vehicle_history',
    description: 'Maintenance/repair/MOT/service history for a specific van.',
    input_schema: { type: 'object', properties: { van_id: { type: 'string' } }, required: ['van_id'] },
    async handler(admin: any, ctx: any, args: any) {
      const { data: van } = await admin.from('vans').select('id, name, business_id').eq('id', args.van_id).maybeSingle()
      if (!van || van.business_id !== ctx.businessId) return { found: false, message: 'Van not found.' }
      const { data } = await admin.from('vehicle_maintenance').select('maintenance_date, maintenance_type, description, cost, supplier_records(supplier_name)').eq('van_id', args.van_id).order('maintenance_date', { ascending: false }).limit(20)
      return {
        van: van.name,
        history: (data ?? []).map((m: any) => ({ date: m.maintenance_date, type: m.maintenance_type, description: m.description, cost: m.cost, supplier: m.supplier_records?.supplier_name ?? null })),
      }
    },
  },
  {
    name: 'get_equipment_alerts',
    description: 'Equipment with a service or warranty date due within 30 days or overdue, optionally for one van.',
    input_schema: { type: 'object', properties: { van_id: { type: 'string' } } },
    async handler(admin: any, ctx: any, args: any) {
      let query = admin.from('equipment').select('name, next_service_date, warranty_expiry, status, vans(name)').eq('business_id', ctx.businessId).neq('status', 'retired')
      if (args.van_id) query = query.eq('van_id', args.van_id)
      const { data } = await query
      const alerts: any[] = []
      for (const eq of data ?? []) {
        for (const [field, label] of [['next_service_date', 'Service'], ['warranty_expiry', 'Warranty']] as const) {
          const value = eq[field]
          if (!value) continue
          const days = daysUntil(value)
          if (days <= 30) alerts.push({ equipment: eq.name, van: eq.vans?.name ?? null, type: label, due_date: value, days_remaining: days, overdue: days < 0 })
        }
      }
      return { equipment_alerts: alerts.sort((a, b) => a.days_remaining - b.days_remaining) }
    },
  },
]

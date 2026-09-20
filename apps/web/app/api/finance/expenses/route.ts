// @ts-nocheck
// H8–H11 — expenses. POST creates a CONFIRMED expense directly (manual
// fast-entry) or from a reviewed/confirmed finance_documents extraction
// (document_id passed once the user has reviewed the extracted fields —
// see app/api/finance/documents/extract for the extraction step itself).
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStaffContext } from '@/lib/staffContext'
import { hasPermission } from '@/lib/permissions'
import { assertVanAllowed } from '@/lib/ai/context'
import { round2 } from '@/lib/finance/money'
import { findPossibleDuplicateExpense } from '@/lib/finance/expenses'
import { flagForReview } from '@/lib/finance/review'
import { logAuditEvent } from '@/lib/auditLog'

const CATEGORIES = ['food_stock', 'drinks', 'packaging', 'fuel', 'vehicle', 'repairs', 'equipment', 'insurance', 'rent_storage', 'phone_internet', 'marketing', 'staff', 'cleaning', 'professional_fees', 'other']

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'view_expenses')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const admin = await createAdminClient()
  let query = admin.from('expenses').select('*, supplier_records(supplier_name), vans(name)').eq('business_id', ctx.businessId).order('expense_date', { ascending: false }).limit(200)
  if (searchParams.get('start')) query = query.gte('expense_date', searchParams.get('start'))
  if (searchParams.get('end')) query = query.lte('expense_date', searchParams.get('end'))
  if (searchParams.get('category')) query = query.eq('category', searchParams.get('category'))
  if (searchParams.get('van_id')) query = query.eq('van_id', searchParams.get('van_id'))
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const ctx = await getStaffContext(supabase, user.id)
  if (!ctx || !hasPermission(ctx.role, 'create_expense')) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  const body = await req.json()
  const { expense_date, supplier_id, van_id, description, category, net_amount, vat_amount, payment_method, reference, document_id } = body
  if (!expense_date || !description || !category || net_amount == null) {
    return NextResponse.json({ error: 'expense_date, description, category and net_amount are required' }, { status: 400 })
  }
  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  if (van_id) { try { assertVanAllowed(ctx, van_id) } catch { return NextResponse.json({ error: 'Not authorized for that van' }, { status: 403 }) } }

  const admin = await createAdminClient()
  if (supplier_id) {
    const { data: supplier } = await admin.from('supplier_records').select('id').eq('id', supplier_id).eq('business_id', ctx.businessId).maybeSingle()
    if (!supplier) return NextResponse.json({ error: 'Supplier not found for this business' }, { status: 404 })
  }
  if (document_id) {
    const { data: doc } = await admin.from('finance_documents').select('id, business_id').eq('id', document_id).maybeSingle()
    if (!doc || doc.business_id !== ctx.businessId) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const net = round2(Number(net_amount))
  const vat = round2(Number(vat_amount ?? 0))
  const gross = round2(net + vat)

  // H54 — flag a likely duplicate before creating (never blocks it —
  // duplicates are never auto-rejected/auto-deleted, only surfaced).
  const duplicate = await findPossibleDuplicateExpense(admin, ctx.businessId, { supplier_id: supplier_id ?? null, expense_date, gross_amount: gross })

  const { data: expense, error } = await admin.from('expenses').insert({
    business_id: ctx.businessId, expense_date, supplier_id: supplier_id ?? null, van_id: van_id ?? null,
    description: String(description).trim(), category, net_amount: net, vat_amount: vat, gross_amount: gross,
    payment_method: payment_method ?? 'other', reference: reference ?? null, document_id: document_id ?? null,
    source: document_id ? 'document_extraction' : 'manual', status: 'CONFIRMED', created_by: ctx.userId,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (document_id) await admin.from('finance_documents').update({ extraction_status: 'CONFIRMED', linked_expense_id: expense.id }).eq('id', document_id)
  if (duplicate) await flagForReview(admin, ctx.businessId, 'duplicate_expense', 'expenses', expense.id, { possible_duplicate_of: duplicate.id, description: duplicate.description })
  if (category === 'other' && !supplier_id) await flagForReview(admin, ctx.businessId, 'uncategorised_expense', 'expenses', expense.id, { description })
  if (['food_stock', 'drinks', 'packaging'].includes(category) && !supplier_id) await flagForReview(admin, ctx.businessId, 'missing_supplier', 'expenses', expense.id, { description, category })

  await logAuditEvent(admin, { actorId: ctx.userId, action: 'finance.expense_created', entityType: 'expenses', entityId: expense.id, newValues: expense })
  return NextResponse.json(expense, { status: 201 })
}

# FoodTaxi Business Quick Start

Written during Phase O — concise onboarding notes for a business using
FoodTaxi, based on what the platform actually does today. This is not a
marketing document; every claim here is checked against the real
implementation.

## Owner quick start

1. **Register**: create your business account (£19.99/month, first 3
   days free — one plan, no tiers).
2. **Add your first van**: Dashboard → My Vans → Add Van. A van is your
   operating unit — most day-to-day work (menu, orders, POS, route)
   happens per-van.
3. **Build your menu**: Dashboard → Menu. Add categories, items, prices,
   allergens (only what you provide — FoodTaxi never invents allergen
   information). Mark items available/sold-out as needed; this instantly
   reflects on your customer-facing menu.
4. **Set your route/schedule**: Dashboard → Routes/Schedule. This drives
   what customers see as your stops and, if you use live tracking, where
   they expect to find you.
5. **Generate your QR code**: Dashboard → Vans → your van → QR. Print it
   for your van/stall — customers scan it straight into your live menu.
6. **Go live**: once your menu and schedule are set, you're ready to take
   orders. Check your billing page anytime to confirm trial/subscription
   status.

## Van staff / POS quick start

1. Sign in on the device you'll use at the van.
2. Dashboard → POS. Select items/deals, adjust quantities, take payment
   (cash, or recorded card if you don't have a connected card reader —
   recorded card is clearly labelled as not provider-verified unless you
   have Stripe Terminal connected).
3. If you lose signal, POS keeps working offline and syncs orders once
   you reconnect — it will never tell you a payment succeeded before it
   actually did.
4. Kitchen Display (KDS): if you use a separate prep screen, new orders
   appear there automatically with priority/prep state.

## Stock quick start

1. Dashboard → Stock. Add stock items, set starting quantities.
2. Record deliveries as you receive them.
3. Map menu items to the stock they use (Menu → item → stock
   components) if you want automatic deduction on sale.
4. Run a stocktake periodically to correct for wastage/shrinkage —
   discrepancies are recorded, not silently overwritten.

## Hygiene quick start

1. Dashboard → Hygiene. Log opening/closing checks, temperature readings,
   cleaning tasks, and supplier delivery checks as you do them.
2. Every record is timestamped and attributed to whoever logged it —
   nothing here is AI-generated or auto-filled; it's your own compliance
   record.

## Finance quick start

1. Dashboard → Finance. See sales, expenses, and reconciliation broken
   down by payment method.
2. "Card" totals are clearly split between recorded (typed in by you)
   and provider-verified (only if you've connected a live payment
   provider) — never blurred together.
3. The management summary is labelled "gross contribution," never "net
   profit" or a tax filing — for actual accounts, use your accountant or
   a connected Xero/QuickBooks export.

## CRM quick start

1. Dashboard → Customers. Every customer who's ordered from you shows up
   here, scoped to your business only — even if the same person has
   ordered from another FoodTaxi business too, that's a separate,
   unmerged record on your side.
2. Loyalty, promo codes, and referrals are all optional — turn on what
   you want to use from CRM settings.

## AI usage & safety

- FoodTaxi AI (Dashboard → FoodTaxi AI) can answer questions about your
  own business's sales, stock, staff, hygiene, vehicles, events, finance,
  CRM, and routes — always computed from your real data, never invented.
- It can propose actions (like creating a purchase order or scheduling a
  message), but every action requires your explicit confirmation before
  anything actually happens — nothing executes silently.
- It cannot see another business's data, another group's data, or your
  payment/accounting credentials — those boundaries are enforced by the
  platform, not by the AI choosing to behave.

## Group admin quick start (if your business is part of a FoodTaxi group/franchise)

- Joining or leaving a group never deletes your business's own data —
  your business remains fully independent even as a group member.
- A group can see aggregated numbers across its member businesses, but
  never your detailed finance, customer contact details, staff personal
  data, or payment/accounting connections unless you've explicitly
  granted that.
- Group announcements, shared menu templates, and bulk actions all
  require your business's own confirmation to actually apply — a group
  admin cannot silently change your menu or take an action on your
  behalf without your business accepting it.

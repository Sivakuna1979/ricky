// @ts-nocheck
// Single source of truth for FoodTaxi's one business subscription. There is
// intentionally only one plan — see docs/FOODTAXI-TECHNICAL-BASELINE.md §5.
export const FOODTAXI_PLAN_NAME = 'FoodTaxi Business'
export const FOODTAXI_MONTHLY_PRICE_GBP = 19.99
export const FOODTAXI_TRIAL_DAYS = 3

// The actual Stripe Price object billed. Never hard-code a price id — this
// must be created once in the Stripe Dashboard (or via the Stripe CLI) as a
// recurring £19.99/month GBP price and its id set here.
export const STRIPE_FOODTAXI_MONTHLY_PRICE_ID = process.env.STRIPE_FOODTAXI_MONTHLY_PRICE_ID ?? ''

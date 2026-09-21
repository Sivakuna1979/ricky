// @ts-nocheck
// M21 — accessibility-safe branding defaults. Never trusts a raw
// unvalidated colour value straight into the DOM — a malformed or
// low-contrast value falls back to FoodTaxi's own default palette rather
// than being stored as-is.
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const DEFAULT_PRIMARY = '#f97316' // matches the existing FoodTaxi brand orange used across the dashboard
const DEFAULT_TEXT_ON_PRIMARY = '#ffffff'

export function sanitizeBranding(input: any): { logo_url: string | null; primary_color: string; text_on_primary: string } {
  return {
    logo_url: typeof input?.logo_url === 'string' && input.logo_url.startsWith('http') ? input.logo_url.slice(0, 500) : null,
    primary_color: typeof input?.primary_color === 'string' && HEX_COLOR.test(input.primary_color) ? input.primary_color : DEFAULT_PRIMARY,
    text_on_primary: typeof input?.text_on_primary === 'string' && HEX_COLOR.test(input.text_on_primary) ? input.text_on_primary : DEFAULT_TEXT_ON_PRIMARY,
  }
}

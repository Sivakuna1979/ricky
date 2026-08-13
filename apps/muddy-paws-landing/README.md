# Muddy Paws Co. — Landing Page

A single static HTML file (`index.html`, no build step) for a pre-launch waitlist
page. Open the file directly in a browser to preview it, or deploy it as a static
site (e.g. Vercel, Netlify, or GitHub Pages).

## Before going live

The waitlist form is currently a client-side placeholder — it does not send
emails anywhere. Before launch, connect it to one of:

- A Supabase table (this repo already has a Supabase project set up for other
  apps) — insert the email on submit.
- A form service such as Formspree or a Mailchimp/ConvertKit signup form action.

See `docs/business/muddy-paws-co/BUSINESS-PLAN.md` for the full business plan.

# Hello Pat - Paws & Whiskers 2027 Calendar Contest

## Project Overview
A CRM and business app for running a pet calendar contest. Pet owners pay $36 ($30 + $6 shipping) to enter their pet. 13 winners are featured in a printed 2027 calendar. The grand prize winner gets the cover + extras.

**Live site:** https://cutepawsandwhiskers.com
**GitHub:** https://github.com/Onefailatatime/cutepawsandwhiskers
**Netlify site:** cutepawsandwhiskers (auto-deploys on git push)

## Tech Stack
- **Frontend:** Single-file HTML pages with Tailwind CSS CDN (no build step)
- **Backend:** Netlify serverless functions (Node.js, CommonJS `exports.handler`)
- **Database:** Supabase (PostgreSQL) — project ID: `szyjnhtyurobehzhtzvv`
- **File storage:** Supabase Storage (`pet-photos` bucket)
- **Payments:** Stripe Payment Links + webhook verification
- **Email:** Zoho Mail SMTP via nodemailer (orders@cutepawsandwhiskers.com)
- **Notifications:** Telegram Bot API for admin alerts + AI responses via Claude API
- **Analytics:** Facebook Pixel (browser) + Conversions API (server-side)
- **Bundler:** esbuild via Netlify

## Pages
| File | Purpose |
|------|---------|
| `index.html` | Landing page — contest info, entry form, Stripe redirect, FB Pixel |
| `upload.html` | Post-payment photo upload page (accessed via unique entry link) |
| `admin.html` | Full CRM dashboard — entries, campaigns, upsell tracking, kanban boards |
| `privacy.html` | Privacy policy |
| `terms.html` | Terms and conditions |

## Serverless Functions (`/functions`)
| File | Purpose |
|------|---------|
| `admin-login.js` | Auth with HMAC-SHA256 session tokens, CSRF tokens, 3-attempt lockout |
| `admin-api.js` | All CRM CRUD — entries, campaigns, stats, search, file uploads |
| `submit-entry.js` | Public entry form submission (rate-limited 5/min per IP) |
| `upload-photo.js` | Photo upload to Supabase Storage (rate-limited 3/5min per token) |
| `get-entry.js` | Fetch single entry by ID (for upload page) |
| `get-stats.js` | Public stats endpoint (aggregated only, no PII) |
| `stripe-webhook.js` | Stripe payment confirmation — sends welcome email, receipt, FB CAPI purchase, Telegram notification, auto-groups by UTM |
| `telegram-webhook.js` | Telegram bot commands — search entries, AI responses via Claude |
| `telegram-notify.js` | Helper module for sending Telegram messages |
| `telegram-setup.js` | One-time webhook registration helper |
| `morning-brief.js` | Scheduled daily 8am EST Telegram summary |
| `fb-capi.js` | Facebook Conversions API helper (SHA-256 PII hashing, deduplication) |
| `_inbound-email.js.disabled` | Inbound email photo processing (disabled, not using Resend) |

## Database Schema (Supabase)
### Tables
- **`contest_entries`** — Main table: name, email, phone, pet info, payment status, entry status, winner info, call status, UTM params, FB click IDs, prices, admin notes
- **`order_items`** — Upsell items linked to entries (featured month, special day, postcard pack)
- **`upsell_calls`** — Call log for upsell outreach
- **`crm_activity_log`** — Audit trail for all CRM actions
- **`ad_campaigns`** — Facebook ad campaign tracking with UTMs, spend, creative URLs
- **`email_groups`** — Email segmentation groups
- **`email_group_members`** — Members of email groups

### Views
- **`crm_dashboard_stats`** — Aggregated revenue, entries, winners, calls
- **`entries_needing_calls`** — Paid entries not yet called

## Environment Variables (14 total, all set in Netlify)
```
SUPABASE_URL, SUPABASE_KEY
ADMIN_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
FB_PIXEL_ID, FB_ACCESS_TOKEN
TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_WEBHOOK_SECRET
ANTHROPIC_API_KEY
STRIPE_WEBHOOK_SECRET
ZOHO_EMAIL, ZOHO_APP_PASSWORD
```

## Security (Hardened)
All security measures implemented across two audit rounds:

- **Auth:** HMAC-SHA256 session tokens, constant-time comparison (`crypto.timingSafeEqual`)
- **CSRF:** Token generation tied to session, verified on all POST/PATCH
- **Brute force:** 3-attempt lockout, 15-min cooldown per IP
- **Stripe webhook:** Manual HMAC-SHA256 signature verification, 5-min replay tolerance
- **CORS:** Restricted to `ALLOWED_ORIGIN` (not `*`) on all functions
- **Input sanitization:** PostgREST filter injection prevention, search input sanitized
- **XSS:** HTML escaping via DOM `esc()` function on user-controlled data
- **File uploads:** Extension whitelist (jpg/jpeg/png/gif/webp/heic/heif), 10MB limit
- **Rate limiting:** Per-IP and per-token in-memory Maps
- **Headers:** CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy (see `_headers`)
- **SRI:** Integrity hashes on CDN scripts in admin.html
- **PII protection:** get-stats returns aggregated data only, no raw entries
- **Token storage:** sessionStorage (not localStorage), never in URL params
- **No hardcoded secrets:** All credentials from env vars only
- **Telegram webhook:** Secret token required and validated
- **Facebook domain verification:** Meta tag in index.html head

## Facebook Pixel & Ads
- **Pixel ID:** 1683799792624877
- **Events tracked (browser):** PageView, ViewContent (on index.html)
- **Events tracked (server):** Purchase (via Conversions API in stripe-webhook.js)
- **Domain verified:** Yes (meta tag: `rc3tini6e25mkbbpx4hx01xkwydvcy`)
- **Ad account:** Paws (connected to pixel dataset)
- **Current campaign:** "spring_dogs" — utm_source=facebook, utm_medium=paid, utm_content=video_a

## CRM Login
- **Email:** modecandsllc@gmail.com
- **Password:** out899891
- **Stats key:** hellopat2027stats

## Key URLs
- **Stripe Payment Link:** https://buy.stripe.com/eVq28lg4A6Tcdy01y1bZe04
- **Supabase Dashboard:** https://app.supabase.com/project/szyjnhtyurobehzhtzvv

## API Routes (via Netlify redirects)
All functions accessed at `/api/{function-name}` which redirects to `/.netlify/functions/{function-name}`

## Git Workflow
- Push to `main` triggers auto-deploy on Netlify
- No build step needed (static HTML + serverless functions)
- `git push origin main` to deploy

## Last Updated
- 2026-03-17: Security audit rounds 1 & 2 complete, FB ViewContent pixel added, domain verification meta tag added

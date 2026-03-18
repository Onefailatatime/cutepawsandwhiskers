# Hello Pat — Paws & Whiskers 2027 Hub Reference

> Quick-reference for Claude to understand the entire site and add features fast.

---

## Business Model

**Hello Pat** — solo-founder pet calendar contest business.

| Item | Detail |
|---|---|
| Product | Paid entry into the **Paws & Whiskers 2027 Calendar Contest** |
| Price | **$30 entry + $6 shipping = $36 total** |
| What buyer gets | Contest entry + guaranteed spot in the printed calendar + 1 calendar shipped |
| Grand Prize (1 winner) | Front cover + custom framed watercolor portrait + toys/goodies bundle ($200+) |
| Monthly Stars (12 winners) | Full page "Pet of the Month" feature |
| Total winners | **13** (1 cover + 12 months) |
| Pets accepted | Dogs and cats |
| Live URL | https://cutepawsandwhiskers.com |
| GitHub | https://github.com/Onefailatatime/cutepawsandwhiskers |

### Revenue Flow
```
Ad click → Landing page → Form submit → Stripe Payment ($36)
  → Welcome email + Receipt email → Photo upload page
  → Founder calls buyer → Pitch upsells by phone
```

### Phone Upsell Ladder (not on website — handled after purchase)
| Upsell | Price | What they get |
|---|---|---|
| Featured Month Package | ~$127 | Full "Pet of the Month" page + 2 extra calendars + hi-res digital file |
| Special Day Upgrade | ~$67 | Large photo on a specific date square + 1 extra calendar |
| Postcard Pack | ~$29 | 20 postcards featuring their pet |

### Current Ad Campaign
- **Platform:** Facebook/Instagram
- **Budget:** $150 for 3 days (first ever paid ads, started ~2026-03-17)
- **Campaign name:** "spring_dogs"
- **UTMs:** utm_source=facebook, utm_medium=paid, utm_content=video_a
- **Goal:** Get 50 sign-ups to prove the funnel works

### Key Business Metric
**Client-financed acquisition:** 30-day revenue per entrant >= ad cost + calendar cost. If this holds, ad spend can scale indefinitely.

---

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend | Static HTML + Tailwind CSS CDN | No build step, no framework |
| Backend | Netlify serverless functions | Node.js, CommonJS (`exports.handler`) |
| Database | Supabase (PostgreSQL) | Project: `szyjnhtyurobehzhtzvv` |
| File storage | Supabase Storage | Bucket: `pet-photos` |
| Payments | Stripe Payment Links + webhook | Link: `https://buy.stripe.com/eVq28lg4A6Tcdy01y1bZe04` |
| Email | Zoho Mail SMTP via nodemailer | From: `orders@cutepawsandwhiskers.com` |
| Notifications | Telegram Bot API | Admin alerts + Claude AI chat |
| Analytics | Facebook Pixel (browser) + Conversions API (server) | Pixel: `1683799792624877` |
| Bundler | esbuild via Netlify | Auto-bundles functions |
| Deploy | Git push to `main` → Netlify auto-deploy | No build step for HTML |

### Dependencies (package.json)
- `@netlify/functions` ^5.1.3
- `@supabase/supabase-js` ^2.99.2
- `nodemailer` ^8.0.2

---

## File Map

### HTML Pages (root of `/site`)
```
index.html      — Landing page: hero, grand prize, benefits, how it works,
                   testimonials, FAQ, entry form modal, Stripe redirect, FB Pixel
upload.html     — Post-payment photo upload (token-based access from welcome email)
admin.html      — Full CRM dashboard (~50k tokens, massive single file):
                   entries table, entry detail, campaigns, upsell tracking,
                   email composer, email groups/campaigns, kanban boards,
                   winner management, shipping tracker
terms.html      — Terms of Service
privacy.html    — Privacy Policy
```

### Serverless Functions (`/site/functions/`)
```
submit-entry.js     — POST: Creates entry in DB, fires FB Lead CAPI event,
                       sends Telegram notification. Rate limited 5/min/IP.
stripe-webhook.js   — POST: Stripe checkout.session.completed handler.
                       Updates payment status, sends welcome + receipt emails,
                       fires FB Purchase CAPI event, Telegram notification,
                       auto-groups by UTM campaign.
upload-photo.js     — POST: Accepts base64 photo, validates extension/size,
                       uploads to Supabase Storage, updates entry.
                       Rate limited 3/5min/token.
get-entry.js        — GET: Fetches entry by upload_token (for upload.html).
get-stats.js        — GET: Aggregated stats only (no PII). Auth via ADMIN_KEY.
admin-login.js      — POST: Login/verify. HMAC-SHA256 tokens, CSRF generation,
                       3-attempt lockout per IP. Exports verifyToken/verifyCsrfToken.
admin-api.js        — GET/POST/PATCH: All CRM operations. Auth via session token.
                       Actions: dashboard, entries, entry, winners, campaigns,
                       update-entry, log-call, add-upsell, remove-upsell,
                       assign-winner, campaign CRUD, email send/groups/campaigns,
                       board tasks, delete entry, upload photo, upsell product CRUD.
fb-capi.js          — Helper module: Sends events to Facebook Conversions API.
                       SHA-256 hashes PII. Exports: sendEvent, hash.
telegram-notify.js  — Helper module: sendTelegramMessage, notifyOwner.
telegram-webhook.js — POST: Telegram bot commands (/stats, /recent, /search,
                       /entry, /status, /ship, /note, /help) + free-form → Claude AI.
telegram-setup.js   — GET: One-time webhook registration utility.
morning-brief.js    — Scheduled (8am EST daily): Sends Telegram summary of
                       last 24h activity + action items.
_inbound-email.js.disabled — Disabled inbound email processing.
```

### Config Files
```
netlify.toml    — Build config: publish ".", functions "functions", esbuild bundler,
                   /api/* redirect to /.netlify/functions/*
_headers        — Security headers: CSP per page, HSTS, X-Frame-Options, etc.
package.json    — Dependencies (supabase-js, netlify/functions, nodemailer)
.gitignore      — Standard
```

### SQL
```
sql/001-crm-tables.sql — Schema additions: entry_status, winner fields, prices,
                          call_status, order_items, upsell_calls, crm_activity_log,
                          crm_dashboard_stats view, entries_needing_calls view.
```

---

## Database Schema

### `contest_entries` (main table)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, auto-generated |
| full_name, first_name, last_name | text | Split on insert |
| email | text | Lowercased |
| phone | text | |
| address_line1, address_line2, city, state, zip | text | Shipping address |
| pet_name | text | Default 'Pending' until upload |
| pet_type | text | 'dog' or 'cat' |
| special_date_label | text | e.g. "Owner birthday" |
| birth_month, birth_day | text | From form (MM-DD format) |
| photo_url | text | Supabase Storage public URL |
| upload_token | uuid | Auto-generated, used for upload.html auth |
| status | text | 'new' → 'paid' (set by webhook) |
| payment_confirmed | boolean | Set true by Stripe webhook |
| payment_confirmed_at | timestamptz | |
| stripe_payment_id | text | Stripe payment intent ID |
| stripe_customer_email | text | Backfilled from Stripe |
| total_price | numeric(10,2) | Default 36.00, updated with upsells |
| base_price | numeric(10,2) | Default 30.00 |
| shipping_price | numeric(10,2) | Default 6.00 |
| entry_status | text | pending_review / accepted / rejected |
| is_winner | boolean | |
| winner_type | text | none / cover / month / special_day |
| winner_month | int | 1-12 |
| call_status | text | not_called / scheduled / called / follow_up |
| admin_notes | text | |
| shipping_status | text | pending / processing / shipped / delivered |
| shipped_at | timestamptz | |
| tracking_number | text | |
| campaign_id | uuid | FK to ad_campaigns |
| utm_source, utm_medium, utm_campaign, utm_content | text | From landing page URL |
| fb_click_id, fb_browser_id | text | _fbc, _fbp cookies |
| client_ip, client_user_agent | text | For FB CAPI matching |
| welcome_email_sent | boolean | |
| welcome_email_sent_at | timestamptz | |
| info_confirmed | boolean | Set true when photo uploaded |
| info_confirmed_at | timestamptz | |
| created_at | timestamptz | |

### `order_items`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| entry_id | uuid | FK → contest_entries |
| item_type | text | base_entry / featured_month / special_day / postcard_pack / other |
| description | text | |
| quantity | int | Default 1 |
| unit_price, total_price | numeric(10,2) | |

### `upsell_calls`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| entry_id | uuid | FK → contest_entries |
| call_datetime | timestamptz | |
| outcome | text | no_answer / left_voicemail / not_interested / callback / bought_* / other |
| notes | text | |

### `crm_activity_log`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| entry_id | uuid | FK → contest_entries |
| action | text | entry_updated / call_logged / upsell_added / email_sent / etc. |
| details | jsonb | Flexible payload |

### `ad_campaigns`
Full campaign tracking with UTMs, spend, FB ad IDs, creative URLs, notes, dates.

### `email_groups` + `email_group_members`
Segmentation system. Groups auto-populate by utm_campaign match.

### `email_campaigns`
Bulk email campaigns with merge tags ({name}, {pet_name}, {email}, {order_number}).

### `board_tasks`
Kanban board tasks (board, column_id, title, description, priority, labels, etc.)

### `upsell_products`
Product catalog for upsells (name, slug, description, price, is_active, sort_order).

### Views
- `crm_dashboard_stats` — Aggregated totals
- `entries_needing_calls` — Paid + not_called
- `entry_revenue` — Used by get-stats.js
- `campaign_stats` — Campaign performance aggregation

---

## User Flow

### 1. Entry (index.html)
1. Visitor lands on page (FB Pixel fires PageView + ViewContent)
2. Clicks any CTA → modal opens with entry form
3. Fills: name, email, phone, address, birthday
4. Submit → POST /api/submit-entry → saves to DB
5. Server fires FB Lead CAPI event + Telegram notification
6. Redirect to Stripe Payment Link with email prefilled + client_reference_id

### 2. Payment (Stripe)
1. Buyer pays $36 on Stripe
2. Stripe fires checkout.session.completed webhook → /api/stripe-webhook
3. Webhook: updates entry to paid, sends welcome email + receipt, fires FB Purchase CAPI, Telegram alert, auto-groups by UTM

### 3. Photo Upload (upload.html)
1. Buyer clicks link in welcome email (contains upload_token)
2. Page loads entry data via GET /api/get-entry?token=xxx
3. Buyer fills pet name, type, uploads photo
4. Submit → POST /api/upload-photo → stores in Supabase Storage
5. Telegram notification sent

### 4. Admin CRM (admin.html)
- Login at /admin.html with email/password
- Dashboard: stats, recent entries, entries needing calls
- Entry detail: edit all fields, log calls, add upsells, send emails, upload photos
- Campaigns: create/edit ad campaigns, link entries, track spend vs revenue
- Email: compose + send individual or bulk emails with merge tags
- Boards: Kanban task management
- Winners: assign cover/month winners

### 5. Telegram Bot
- /stats, /recent, /search, /entry, /status, /ship, /note
- Free-text messages → Claude AI assistant with business context
- Morning brief at 8am EST daily

---

## Environment Variables (14 total — all in Netlify)
```
SUPABASE_URL          — https://szyjnhtyurobehzhtzvv.supabase.co
SUPABASE_KEY          — Supabase anon/public key
ADMIN_KEY             — Protects get-stats + telegram-setup
ADMIN_EMAIL           — CRM login email
ADMIN_PASSWORD        — CRM login password
FB_PIXEL_ID           — 1683799792624877
FB_ACCESS_TOKEN       — Facebook CAPI system user token
TELEGRAM_BOT_TOKEN    — Telegram bot API token
TELEGRAM_CHAT_ID      — Owner's Telegram chat ID
TELEGRAM_WEBHOOK_SECRET — Validates Telegram webhook requests
ANTHROPIC_API_KEY     — Claude API for Telegram AI responses
STRIPE_WEBHOOK_SECRET — Validates Stripe webhook signatures
ZOHO_EMAIL            — orders@cutepawsandwhiskers.com
ZOHO_APP_PASSWORD     — Zoho app-specific password
```

---

## Security Summary
- HMAC-SHA256 session tokens with constant-time comparison
- CSRF tokens tied to sessions, verified on all POST/PATCH
- 3-attempt login lockout, 15-min cooldown per IP
- Stripe webhook: manual HMAC-SHA256 signature verification + 5-min replay window
- CORS restricted to site origin (not `*`)
- Input sanitization on search (PostgREST filter injection prevention)
- XSS prevention via `esc()` helper in HTML templates
- File upload: extension whitelist + 10MB limit
- Rate limiting: per-IP and per-token in-memory Maps
- Security headers in `_headers` file (CSP, HSTS, X-Frame-Options, etc.)
- Telegram webhook secret validation
- PII never exposed in public endpoints

---

## How to Add Features Fast

### Adding a new API action
1. Open `functions/admin-api.js`
2. Add a GET action inside the `if (event.httpMethod === 'GET')` block
3. Or add a POST/PATCH action inside the `if (event.httpMethod === 'POST' || event.httpMethod === 'PATCH')` block
4. Use `ok()`, `badRequest()`, `serverError()` helpers for responses
5. POST/PATCH actions already have CSRF protection enforced

### Adding a new DB table
1. Write SQL in `sql/` directory
2. Run in Supabase SQL Editor
3. Enable RLS + create permissive policy
4. Add Supabase queries in the relevant function

### Adding a new page
1. Create `site/newpage.html`
2. Use same Tailwind CDN setup as other pages
3. Add CSP headers in `_headers` if needed
4. It auto-deploys — no build config needed

### Adding a new function
1. Create `site/functions/new-function.js`
2. Export `exports.handler = async function (event) { ... }`
3. Access at `/api/new-function` (via netlify.toml redirect)
4. Use CommonJS requires for dependencies

### Modifying the landing page
- Everything is in `index.html` — single file, no components
- Data arrays at bottom: BENEFITS, STEPS, TESTIMONIALS, FAQS
- Modal form is inline HTML
- JS renders sections from data arrays on page load

### Modifying the CRM
- `admin.html` is one massive file (~50k tokens)
- Read in chunks using offset/limit
- All API calls go through `/api/admin-api?action=xxx`
- Auth token in sessionStorage, sent via Authorization header
- CSRF token sent via X-CSRF-Token header

### Deploying changes
```bash
cd "/Users/funnelfix/Apps/Hello Pat/site"
git add -A && git commit -m "description" && git push origin main
```
Netlify auto-deploys on push to main.

---

## Landing Page Breakdown (index.html)

The landing page is a single-file conversion page. All sections rendered from JS data arrays at the bottom. Here's exactly what's on the page:

### Sections (top to bottom)
1. **Hero** — Gradient bg, 2-column: headline "Turn Your Pet Into A 2027 Calendar Star" + 2 pet stock photos (Unsplash). CTA: "Enter Your Pet — Only $36"
2. **Grand Prize** — Showcases the grand prize package: cover star, watercolor portrait, gift box. Uses `images/grand-prize.png`. Prize value callout: "$200+ Bundle". Also shows 2 cards: "12 Monthly Stars" and "Every Pet Gets In"
3. **Emotional Hook** — Short paragraph about unconditional love + seeing pet on the wall
4. **Offer Stack** — "What You Get For $36" — 4 benefits with checkmark icons rendered from `BENEFITS` array
5. **How It Works** — 3 steps: Enter & Pay → Upload Photo → Get Your Calendar (from `STEPS` array)
6. **Social Proof** — 3 testimonials with stock pet photos (from `TESTIMONIALS` array). Note: these are fabricated/placeholder testimonials
7. **FAQ** — 5 questions with accordion toggle (from `FAQS` array)
8. **Final CTA** — Bold gradient section "Don't Miss Your Spot" with main CTA button
9. **Footer** — Copyright, Terms, Privacy, Contact links
10. **Sticky Mobile CTA Bar** — Fixed bottom bar on mobile with "Only $36" + "Enter Now" button (hidden on desktop)

### Entry Form Modal
Triggered by any CTA click. Collects:
- First name, Last name
- Email
- Phone
- Street address, Apt/Suite, City, State (2-char), ZIP
- Birthday (month + day dropdowns)

On submit:
1. Client-side validation (required fields + email regex)
2. POST to `/api/submit-entry` with all fields + UTM params + FB cookies (fbc/fbp)
3. On success: fires client-side FB Lead event (deduped via event_id)
4. Redirects to Stripe Payment Link with email prefilled + client_reference_id

### Key Copy/Data
- **Stripe link:** `https://buy.stripe.com/eVq28lg4A6Tcdy01y1bZe04`
- **Stock images from Unsplash** (not owned photos)
- **Testimonials are placeholder** — Sarah M., Patricia L., Mike T. with stock pet images
- **FAQ answers:** pets = dogs & cats, ships before Dec 2027, multiple entries OK ($36 each), winners chosen by team, 7-day refund window

### Fonts & Styling
- Font: Inter (Google Fonts)
- Tailwind CSS via CDN (no build)
- Color scheme: orange-500/pink-500 gradients, gray-900 text, orange-50 backgrounds
- Responsive: mobile-first with md: breakpoints

---

## Current Status (as of 2026-03-17)
- Site is live and functional
- Security audit complete (2 rounds)
- Facebook Pixel + Conversions API integrated
- First paid ad campaign just launched ($150 / 3 days)
- Goal: 50 sign-ups to validate the funnel
- No entries yet (ads just started)

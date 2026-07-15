# Admin API Reference — Possah 1.0

All admin routes live under `/api/admin/*`.
Auth guard runs on every route in every environment (`requireAdminAuth`, `lib/admin-auth.ts`): a valid NextAuth session with `isAdmin: true` is required. The only bypass is a test-harness token (`X-Admin-Test-Token` matched against `ADMIN_TEST_SECRET`), which is hard-gated to non-production and used solely by `scripts/admin_test`.

---

## Table of Contents

1. [Products](#1-products)
2. [Orders](#2-orders)
3. [Categories](#3-categories)
4. [Coupons](#4-coupons)
5. [Reviews](#5-reviews)
6. [Journal](#6-journal)
7. [Settings](#7-settings)
8. [Homepage Config](#8-homepage-config)
9. [Media (Supabase Storage)](#9-media-supabase-storage)
10. [Public / Shop APIs](#10-public--shop-apis)

---

## 1. Products

**Base path:** `/api/admin/products`
**File:** `app/api/admin/products/route.ts` · `app/api/admin/products/[id]/route.ts`

### List all products

```
GET /api/admin/products
```

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Filter by name (case-insensitive `ilike`) |
| `page` | number | Page number (default: `1`) |
| `per_page` | number | Items per page (default: `20`) |
| `active` | `true` \| `false` | Filter by `is_active` |

**Response `200`:**
```json
{
  "products": [ { "id", "slug", "name", "price", "stock_qty", "is_active", "categories", "product_images" } ],
  "total": 120,
  "page": 1,
  "per_page": 20
}
```

---

### Create product

```
POST /api/admin/products
```

**Body:**
```json
{
  "name": "Banarasi Silk Saree",
  "slug": "banarasi-silk-saree",
  "description": "...",
  "sub_line": "Handwoven",
  "category_id": "uuid",
  "price": 12000,
  "compare_price": 15000,
  "fabric": "Pure Silk",
  "craft_description": "...",
  "care_instructions": "Dry clean only",
  "drape_guide": "...",
  "craft_story_title": "...",
  "craft_story_body": "...",
  "craft_story_image": "https://...",
  "audio_url": "https://...",
  "meta_title": "...",
  "meta_description": "...",
  "is_new_arrival": true,
  "is_top_selling": false,
  "is_featured": false,
  "is_active": true,
  "tags": ["bridal", "silk"],
  "variants": [
    { "colour_name": "Red", "colour_hex": "#C0392B", "size": "Free Size", "stock_qty": 5 }
  ],
  "images": [
    { "url": "https://...", "alt": "Front view", "position": 0 }
  ]
}
```

**Response `201`:**
```json
{ "id": "uuid", "slug": "banarasi-silk-saree" }
```

**Errors:**
- `422` — Validation failed (field errors in `issues`)
- `422` — Slug already exists

---

### Get single product

```
GET /api/admin/products/[id]
```

**Response `200`:** Full product row with all relations:
- `categories` (id, name, slug)
- `product_images` (id, url, alt, position)
- `product_variants` (id, colour_name, colour_hex, size, stock_qty)
- `product_tags` (id, tag)

**Errors:**
- `404` — Product not found

---

### Update product

```
PATCH /api/admin/products/[id]
```

All fields are optional (partial update).
If `variants`, `images`, or `tags` arrays are sent, the existing rows for that product are **fully replaced** (delete + re-insert).
`stock_qty` on the product row is recalculated from variant `stock_qty` sum whenever `variants` is included.

**Response `200`:**
```json
{ "id": "uuid", "ok": true }
```

---

### Delete product (soft)

```
DELETE /api/admin/products/[id]
```

Sets `is_active = false`. **Never hard deletes** — order rows reference product IDs.

**Response `200`:**
```json
{ "ok": true }
```

---

## 2. Orders

**Base path:** `/api/admin/orders`
**File:** `app/api/admin/orders/route.ts` · `app/api/admin/orders/[id]/route.ts`

> Orders are created by the shop flow (`/api/orders/create`). Admin can only read and update fulfillment fields. Payment status is owned by the Razorpay webhook — never touch it from admin.

### List orders

```
GET /api/admin/orders
```

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | `unfulfilled \| processing \| shipped \| delivered \| cancelled` | Fulfillment filter |
| `payment` | `pending \| paid \| failed \| refunded` | Payment filter |
| `q` | string | Search by order number, customer name, or email |
| `from` | ISO date | Filter `created_at >= from` |
| `to` | ISO date | Filter `created_at <= to` |
| `page` | number | Default: `1` |
| `per_page` | number | Max `100`, default `25` |

**Response `200`:**
```json
{
  "data": [ { ...order } ],
  "total": 340,
  "page": 1,
  "per_page": 25,
  "page_count": 14
}
```

---

### Export orders as CSV

```
GET /api/admin/orders?format=csv
```

Same filters as list. Returns all matching rows (no pagination) as a CSV file attachment.

**Response:** `Content-Type: text/csv` with `Content-Disposition: attachment; filename="possah-orders-{timestamp}.csv"`

Columns: `Order #`, `Date`, `Customer`, `Email`, `Phone`, `Total`, `Payment`, `Fulfillment`, `Coupon`, `Tracking`, `Courier`

---

### Get single order

```
GET /api/admin/orders/[id]
```

**Response `200`:** Full order row.

**Errors:**
- `404` — Order not found

---

### Update order

```
PATCH /api/admin/orders/[id]
```

**Allowed fields only:**

| Field | Type | Description |
|-------|------|-------------|
| `fulfillment_status` | enum | `unfulfilled \| processing \| shipped \| delivered \| cancelled` |
| `tracking_number` | string \| null | Max 100 chars |
| `courier` | string \| null | Max 100 chars |
| `internal_notes` | string \| null | Max 2000 chars — never shown to customer |

**Response `200`:**
```json
{ "ok": true }
```

---

## 3. Categories

**Base path:** `/api/admin/categories`
**File:** `app/api/admin/categories/route.ts` · `app/api/admin/categories/[id]/route.ts`

### List all categories

```
GET /api/admin/categories
```

Returns all categories ordered by `position`, with `parent` relation (id, name).

**Response `200`:** Array of category objects.

---

### Create category

```
POST /api/admin/categories
```

**Body:**
```json
{
  "name": "Lehengas",
  "slug": "lehengas",
  "parent_id": "uuid or null",
  "nav_section": "Bridal",
  "hero_image_url": "https://...",
  "position": 3
}
```

`position` is auto-assigned to `max + 1` if not provided.
`slug` is auto-generated from `name` via `slugify()` if not provided.

**Response `201`:**
```json
{ "id": "uuid" }
```

---

### Bulk reorder categories

```
PATCH /api/admin/categories
```

**Body:** Array of `{ id, position }` pairs.
```json
[
  { "id": "uuid-1", "position": 0 },
  { "id": "uuid-2", "position": 1 },
  { "id": "uuid-3", "position": 2 }
]
```

**Response `200`:**
```json
{ "ok": true }
```

---

### Update single category

```
PATCH /api/admin/categories/[id]
```

All fields optional. If `name` is updated without an explicit `slug`, slug is auto-regenerated.

---

### Delete category

```
DELETE /api/admin/categories/[id]
```

**Hard delete.**

**Errors:**
- `409` — Category has active products linked. Move or deactivate products first.

**Response `200`:**
```json
{ "ok": true }
```

---

## 4. Coupons

**Base path:** `/api/admin/coupons`
**File:** `app/api/admin/coupons/route.ts` · `app/api/admin/coupons/[id]/route.ts`

### List all coupons

```
GET /api/admin/coupons
```

**Response `200`:** Array of coupon objects ordered by `created_at` desc.

---

### Create coupon

```
POST /api/admin/coupons
```

**Body:**
```json
{
  "code": "SAVE20",
  "type": "percent",
  "value": 20,
  "min_order_value": 2000,
  "usage_limit": 100,
  "expiry_date": "2025-12-31T23:59:59+05:30",
  "is_active": true
}
```

| Field | Type | Notes |
|-------|------|-------|
| `code` | string | Uppercase alphanumeric + `_-`. Auto-uppercased. |
| `type` | `percent \| flat \| free_shipping` | |
| `value` | number | Percentage or flat ₹ amount |
| `min_order_value` | number | Default `0` |
| `usage_limit` | number \| null | `null` = unlimited |
| `expiry_date` | ISO datetime \| null | |

**Errors:**
- `409` — Coupon code already exists

**Response `201`:**
```json
{ "id": "uuid" }
```

---

### Update coupon

```
PATCH /api/admin/coupons/[id]
```

All fields optional.

**Response `200`:**
```json
{ "ok": true }
```

---

### Delete coupon

```
DELETE /api/admin/coupons/[id]
```

Hard delete.

**Response `200`:**
```json
{ "ok": true }
```

---

## 5. Reviews

**Base path:** `/api/admin/reviews`
**File:** `app/api/admin/reviews/route.ts` · `app/api/admin/reviews/[id]/route.ts`

### List reviews

```
GET /api/admin/reviews
```

**Query params:**

| Param | Values | Description |
|-------|--------|-------------|
| `status` | `pending \| approved \| all` | Default: `all` |

Returns reviews with product relation (id, name, slug).

---

### Bulk approve / reject

```
PATCH /api/admin/reviews
```

**Body:**
```json
{
  "ids": ["uuid-1", "uuid-2", "uuid-3"],
  "is_approved": true
}
```

**Response `200`:**
```json
{ "ok": true }
```

---

### Approve / reject single

```
PATCH /api/admin/reviews/[id]
```

**Body:**
```json
{ "is_approved": true }
```

**Response `200`:**
```json
{ "ok": true }
```

---

### Delete review

```
DELETE /api/admin/reviews/[id]
```

Hard delete.

**Response `200`:**
```json
{ "ok": true }
```

---

## 6. Journal

**Base path:** `/api/admin/journal`
**File:** `app/api/admin/journal/route.ts` · `app/api/admin/journal/[id]/route.ts`

### List all articles

```
GET /api/admin/journal
```

**Response `200`:** Array of all articles ordered by `created_at` desc.

---

### Create article

```
POST /api/admin/journal
```

**Body:**
```json
{
  "title": "The Art of Banarasi Weaving",
  "slug": "art-of-banarasi-weaving",
  "category": "Craft",
  "author": "Possah Editorial",
  "featured_image": "https://...",
  "body": "<p>Article HTML body...</p>",
  "is_featured": false,
  "published_at": "2025-06-01T10:00:00+05:30"
}
```

**Category enum:** `Style | Craft | Culture | Women | Occasions | Behind the Scenes | Inspiration`

`slug` is auto-generated from `title` if not provided.
`published_at: null` = draft.

**Errors:**
- `409` — Slug already exists

**Response `201`:**
```json
{ "id": "uuid" }
```

---

### Get single article

```
GET /api/admin/journal/[id]
```

**Errors:**
- `404` — Article not found

---

### Update article

```
PATCH /api/admin/journal/[id]
```

All fields optional. If `title` updated without explicit `slug`, slug is auto-regenerated.

**Response `200`:**
```json
{ "ok": true }
```

---

### Delete article

```
DELETE /api/admin/journal/[id]
```

Hard delete.

**Response `200`:**
```json
{ "ok": true }
```

---

## 7. Settings

**Base path:** `/api/admin/settings`
**File:** `app/api/admin/settings/route.ts`

Singleton row. `id` is always `00000000-0000-0000-0000-000000000001`.

### Get settings

```
GET /api/admin/settings
```

Returns default values if no row exists yet.

**Response `200`:**
```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "announcement_text": "FREE SHIPPING ACROSS INDIA · MADE-TO-MEASURE AVAILABLE",
  "store_email": "",
  "whatsapp_number": "",
  "free_shipping_threshold": 5000,
  "express_delivery_fee": 499,
  "seo_title": "The Possah — Luxury Indian Fashion",
  "seo_description": "",
  "seo_og_image": null
}
```

---

### Update settings

```
PATCH /api/admin/settings
```

All fields optional. Upserts singleton row.

| Field | Type | Max |
|-------|------|-----|
| `announcement_text` | string | 300 chars |
| `store_email` | email string | — |
| `whatsapp_number` | string | 20 chars |
| `free_shipping_threshold` | integer ≥ 0 | — |
| `express_delivery_fee` | integer ≥ 0 | — |
| `seo_title` | string | 70 chars |
| `seo_description` | string | 160 chars |
| `seo_og_image` | URL \| null | — |

**Response `200`:**
```json
{ "ok": true }
```

---

## 8. Homepage Config

**Base path:** `/api/admin/homepage`
**File:** `app/api/admin/homepage/route.ts`

Singleton row. Upserted on `id = 00000000-0000-0000-0000-000000000001`.

### Get homepage config

```
GET /api/admin/homepage
```

Returns defaults if no row exists yet (`hero_slides: []`, `occasion_tiles` array of 8).

**Response `200`:**
```json
{
  "hero_slides": [
    {
      "image_url": "https://...",
      "headline": "New Arrivals",
      "sub_headline": "Handcrafted for the modern woman",
      "cta_label": "Shop Now",
      "cta_link": "/new-in"
    }
  ],
  "collection_banner": {
    "image_url": "https://...",
    "headline": "Bridal Edit 2025",
    "subtitle": "...",
    "cta_link": "/bridal"
  },
  "new_arrival_ids": ["uuid-1", "uuid-2"],
  "occasion_tiles": [
    { "image_url": "https://...", "label": "Wedding", "link": "/shop/bridal" }
  ]
}
```

---

### Update homepage config

```
PATCH /api/admin/homepage
```

All top-level keys are optional. Sends only what needs changing.

| Field | Type | Notes |
|-------|------|-------|
| `hero_slides` | array of `HeroSlide` | Replaces entire slides array |
| `collection_banner` | `CollectionBanner` object | |
| `new_arrival_ids` | array of UUIDs | Product IDs pinned as new arrivals |
| `occasion_tiles` | array of 8 `OccasionTile` | **Must be exactly 8 items** if sent |

**Response `200`:**
```json
{ "ok": true }
```

---

## 9. Media (Supabase Storage)

**Bucket:** `possah-media`
**No API route.** `MediaLibrary.tsx` calls Supabase Storage SDK directly from the browser client.

### Upload

```ts
supabase.storage.from('possah-media').upload(path, file, { cacheControl: '3600', upsert: false })
```

Path format: `{timestamp}-{sanitized-filename}.{ext}`
Max file size: **10 MB**
Allowed types: images (`image/*`) + `video/mp4`

---

### Get public URL

```ts
supabase.storage.from('possah-media').getPublicUrl(path)
// returns { data: { publicUrl: "https://..." } }
```

---

### List files

```ts
supabase.storage.from('possah-media').list()
```

---

### Delete file

```ts
supabase.storage.from('possah-media').remove([fullPath])
```

---

## 10. Public / Shop APIs

These routes are called by the storefront, not the admin panel.

### Search

```
GET /api/search?q={query}
```

---

### Validate coupon

```
POST /api/coupons/validate
```

**Body:**
```json
{ "code": "SAVE20", "order_total": 3500 }
```

---

### Create order

```
POST /api/orders/create
```

Called at checkout. Creates order row and initiates Razorpay payment.

---

### Verify payment

```
POST /api/payments/verify
```

Called after Razorpay checkout modal success. Verifies HMAC signature.

---

### Razorpay webhook

```
POST /api/payments/webhook
```

Razorpay server-to-server event. Updates `payment_status` on orders. **Admin must never modify payment_status directly — this webhook owns it.**

---

### Contact form

```
POST /api/contact
```

---

### Health check

```
GET /api/health
```

---

## Common Error Responses

| Status | Meaning |
|--------|---------|
| `401` | Missing or invalid admin session |
| `404` | Resource not found |
| `409` | Conflict — duplicate slug, coupon code, or category has linked products |
| `422` | Validation failed — `issues` object contains per-field errors |
| `500` | Internal server error |

---

## Auth Guard Pattern

Every admin route uses this guard:

```ts
function requireAdminAuth(request: Request): boolean {
  if (process.env.NODE_ENV === 'development') return true
  const cookie = request.headers.get('cookie') ?? ''
  return cookie.includes('next-auth.session-token') ||
         cookie.includes('__Secure-next-auth.session-token')
}
```

Production additionally relies on the Next.js middleware to verify the JWT before the route handler even runs. The cookie check inside the handler is a second layer.

---

## Soft vs Hard Delete Summary

| Resource | Delete type | Notes |
|----------|-------------|-------|
| Products | **Soft** (`is_active = false`) | Orders reference product IDs — never hard delete |
| Categories | **Hard** | Blocked if active products linked (409) |
| Coupons | **Hard** | — |
| Reviews | **Hard** | — |
| Journal articles | **Hard** | — |
| Orders | **No delete** | Immutable — update fulfillment status only |

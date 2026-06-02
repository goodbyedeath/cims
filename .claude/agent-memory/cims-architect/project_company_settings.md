---
name: company-settings-feature
description: Company branding (name, tagline, logo) is admin-configurable and surfaces in sidebar, PDFs, and public catalog via Inertia shared props
metadata:
  type: project
---

The CIMS app has a Company Settings feature (admin-only, at `/settings/company`) that customises branding shown everywhere. Backed by the existing `CatalogSetting` key/value table (no dedicated migration).

**Why:** The product is a multi-tenant-ish template — Component Sales is just the current customer. Hardcoding the brand defeats reuse. Logo/name/tagline must propagate everywhere customers see the brand.

**How to apply:**
- Storage keys in `catalog_settings`: `company_name`, `company_tagline`, `company_logo_path`.
- Reading: `CatalogSetting::getValue('company_name', 'CIMS')` etc. Logo URLs via `Storage::disk('public')->url($path)`.
- Globally exposed to React through Inertia shared prop `company` (set in `app/Http/Middleware/HandleInertiaRequests.php`). Read in any page via `usePage().props.company`.
- Controller: `app/Http/Controllers/CompanySettingController.php` (index/update/updateLogo/destroyLogo).
- React page: `resources/js/Pages/Settings/Company.jsx` with two-column layout (forms left, live sidebar + PDF preview right).
- PDF (`resources/views/orders/pdf.blade.php`) takes `$company` array from `OrderController::pdf()` — when adding new PDF endpoints, pass the same array.
- Public catalog (`Catalog/Public.jsx`) receives a slimmed-down `company` (name+tagline only, no logo).
- Sidebar logo+text live in `AuthenticatedLayout.jsx` — both pull from `company` shared prop with `'CIMS'` fallback. Initials derived from first letter of first two words.
- Admin dropdown link to Company Settings is gated on `auth.user.role === 'admin'`.
- Logo uploads stored on `public` disk under `company/` directory; old file deleted on replacement.

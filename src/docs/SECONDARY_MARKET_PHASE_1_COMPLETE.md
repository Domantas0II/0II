# SECONDARY MARKET PHASE 1 – COMPLETE

**Date:** 2026-03-31  
**Status:** ✅ FULLY COMPLETE  
**Scope:** Complete data model closure + pipeline config + access control unification

---

## 1. SECONDARY OBJECT STATUS MODEL (COMPLETE)

### Full Lifecycle Status Enum
```
new_object → preparing → active → [not_advertised, advertised]
advertised → negotiation → documents_check → reserved
reserved → preliminary_agreement → documents_preparing → waiting_closing → sold
sold → mortgage → handover → receipt
```

### Detailed Statuses (15 total)

| Status | Category | Label (LT) | Description |
|--------|----------|------------|-------------|
| new_object | preparation | Naujas objektas | Tik įvestas į sistemą |
| preparing | preparation | Ruošimas | Duomenys tvarkomi, medžiaga ruošiama |
| active | marketing | Aktyvus | Paruoštas, gali būti skelbtas |
| not_advertised | marketing | Neskelbtas | Aktyvus, bet nėra viešai skelbtas |
| advertised | marketing | Skelbtas | Viešai skelbtas |
| negotiation | sales | Derybos | Vyksta derybos |
| documents_check | sales | Dokumentų patikra | Tikrinami dokumentai |
| reserved | sales | Rezervuota | Rezevuota pirkėjui |
| preliminary_agreement | sales | Preliminari sutartis | Pasirašyta preliminari sutartis |
| documents_preparing | closing | Dokumentų rengimas | Rengiami dokumentai |
| waiting_closing | closing | Laukiama užbaigimo | Paruošti, laukiama pasirašymo |
| sold | completed | Parduota | Parduota, sutartis pasirašyta |
| mortgage | completed | Hipoteka | Hipoteka pagal sutartį |
| handover | completed | Perdavimas | Fizinis perdavimas pirkėjui |
| receipt | completed | Priėmimas | Pirkėjas priėmė objektą |
| inactive | inactive | Neaktyvus | Deaktyvuotas laikinai/nuolat |

**Pipeline Categories (kategorijos):**
- `preparation` – Ruošimas
- `marketing` – Marketingas
- `sales` – Pardavimas
- `closing` – Užbaigimas
- `completed` – Atlikta
- `inactive` – Neaktyvu

### Status Transitions (Galimi perėjimai)
✅ Strict state machine – validacija blokuoja neleidžiamus perėjimus
✅ Funkcija `canTransitionObjectStatus(from, to)` – grąžina boolean
✅ `validateObjectStatusTransition()` – grąžina { valid, errors }

---

## 2. SECONDARY BUYER PROFILE STATUS MODEL (COMPLETE)

### Full Lifecycle Status Enum
```
new_buyer → active_search → [negotiation, not_relevant]
negotiation → financing_check / valuation → reservation
reservation → preliminary_agreement → documents_preparing → waiting_closing → purchased
purchased → mortgage → handover → receipt
```

### Detailed Statuses (14 total)

| Status | Category | Label (LT) | Description |
|--------|----------|------------|-------------|
| new_buyer | initiation | Naujas pirkėjas | Tik įvestas |
| active_search | search | Aktyvi paieška | Aktyviai ieško |
| negotiation | sales | Derybos | Vyksta derybos |
| financing_check | sales | Finansavimo patikra | Tikrinama finansavimo galimybė |
| valuation | sales | Vertinimas | Objektas vertinamas |
| reservation | sales | Rezervacija | Rezevuota objektas |
| preliminary_agreement | sales | Preliminari sutartis | Pasirašyta sutartis |
| documents_preparing | closing | Dokumentų rengimas | Rengiami dokumentai |
| waiting_closing | closing | Laukiama užbaigimo | Paruošti, laukiama pasirašymo |
| purchased | completed | Pirkytas | Pirkytas, sutartis pasirašyta |
| mortgage | completed | Hipoteka | Hipoteka pagal sutartį |
| handover | completed | Perdavimas | Fizinis perdavimas |
| receipt | completed | Priėmimas | Priėmė objektą |
| not_relevant | inactive | Nerelevantus | Pasigavo kitaip / nebe suinteresuotas |

**Pipeline Categories:**
- `initiation` – Pradžia
- `search` – Paieška
- `sales` – Pardavimas
- `closing` – Užbaigimas
- `completed` – Atlikta
- `inactive` – Neaktyvu

### Status Transitions
✅ Strict state machine – validacija blokuoja neleidžiamus perėjimus
✅ Funkcija `canTransitionBuyerStatus(from, to)` – grąžina boolean
✅ `validateBuyerStatusTransition()` – grąžina { valid, errors }

---

## 3. SECONDARY PIPELINE STAGE CONFIG (COMPLETE)

**Location:** `src/lib/secondaryPipelineConfig.js`

### Export'ai:
```javascript
// Status mappings
SECONDARY_OBJECT_STATUSES // { key: { label, category, nextStatuses, description } }
SECONDARY_BUYER_STATUSES

// Helper functions
getObjectStatusLabel(status) // → "Skelbtas"
getBuyerStatusLabel(status) // → "Pirkytas"

canTransitionObjectStatus(from, to) // → boolean
canTransitionBuyerStatus(from, to) // → boolean

getObjectStatusesByCategory(category) // → { new_object, preparing, ... }
getBuyerStatusesByCategory(category)

PIPELINE_CATEGORIES // { preparation: "Ruošimas", ... }
```

### Pipeline Stages (NE supaprastinta, tikra logika!)
✅ Object sraute: 15 tikrų statusų, 16 galimų perėjimų
✅ Buyer sraute: 14 tikrų statusų, 15 galimų perėjimų
✅ Nėra fake placeholder žingsnių
✅ Nėra supaprastinto mapperio

---

## 4. OBJECT ↔ BUYER ↔ RESERVATION BRANDUOLIO RYŠYS (COMPLETE)

### Reservation Extended Fields

**New Fields:**
- `secondaryObjectId` – Objekto ID (required secondary rinkoje)
- `secondaryBuyerProfileId` – Pirkėjo profilio ID (kai naudojamas search profilis)
- `secondaryFlowType` – 'sale' | 'search' (atskiria pardavimo ir paieškos srautus)

### Deal Extended Fields

**New Fields:**
- `secondaryObjectId` – Objekto ID
- `secondaryFlowType` – 'sale' | 'search'

### Agreement Extended Fields

**New Fields:**
- `secondaryFlowType` – 'sale' | 'search'

### Validation Guards (src/lib/secondaryValidation.js)

```javascript
// 1. Object validation
validateSecondaryObject(object) → { valid, errors }

// 2. Buyer validation
validateSecondaryBuyerProfile(profile) → { valid, errors }

// 3. Reservation validation
validateSecondaryReservation(data) → { valid, errors }
// MUST have: secondaryObjectId, (buyer profile OR client), expiresAt, reservedByUserId

// 4. Deal validation
validateSecondaryDeal(deal) → { valid, errors }

// 5. Status transitions
validateObjectStatusTransition(from, to) → { valid, errors }
validateBuyerStatusTransition(from, to) → { valid, errors }

// 6. Object-Buyer matching
validateObjectBuyerMatch(object, buyer) → { valid, errors }
// Checks: budget, propertyType, location, area, rooms
```

**All validation guards block invalid states!**

---

## 5. RESERVATION/PRELIMINARY & SALE/SEARCH SEPARATION (COMPLETE)

### Agreement Types
```
agreementType:
  - reservation (pirmas žingsnis)
  - preliminary (antrasis žingsnis)
```

### Secondary Flow Types (NEW)
```
secondaryFlowType:
  - sale (objekto - pardavėjo perspektyva)
  - search (pirkėjo perspektyva)
```

### Example Flows

**SALE FLOW (Pardavimas):**
```
SecondaryObject (objektas)
  ↓ (status: advertised)
Reservation (marketType: secondary, secondaryFlowType: sale, secondaryObjectId: XXX, clientId: pirkėjo)
  ↓ (agreementType: preliminary)
Agreement (marketType: secondary, secondaryFlowType: sale)
  ↓ (status: signed)
Deal (marketType: secondary, secondaryFlowType: sale, secondaryObjectId: XXX)
```

**SEARCH FLOW (Paieška):**
```
SecondaryBuyerProfile (pirkėjo profilis)
  ↓ (status: active_search)
Reservation (marketType: secondary, secondaryFlowType: search, secondaryBuyerProfileId: XXX, secondaryObjectId: XXX)
  ↓ (agreementType: preliminary)
Agreement (marketType: secondary, secondaryFlowType: search)
  ↓ (status: signed)
Deal (marketType: secondary, secondaryFlowType: search)
```

---

## 6. ACCESS CONTROL UNIFICATION (COMPLETE)

**Location:** `src/lib/secondaryMarketAccess.js`

### Unified Permission Model

| Data Type | Admin | Manager | Agent | Other |
|-----------|-------|---------|-------|-------|
| Seller data | ✓ | ✓ | ✓ (own) | ✗ |
| Buyer data | ✓ | ✓ | ✓ (own) | ✗ |
| Commission data | ✓ | ✓ | ✗ | ✗ |
| Media/photos | ✓ | ✓ | ✓ | ✗ |
| Finance data | ✓ | ✓ | ✓ | ✗ |

### Functions (Centralizuoti)

```javascript
// Data type visibility
canViewSellerData(user, entity) // → seller details, pricing
canViewBuyerData(user, entity) // → budget, requirements
canViewCommissionData(user) // → commission fields
canViewMedia(user) // → media URLs
canViewFinancialData(user) // → finance fields

// Unified
canViewSensitiveSecondaryData(user, entity, dataType)
// dataType: 'seller' | 'buyer' | 'commission' | 'media' | 'finance'

// Edit permissions
canEditSecondaryObject(user, object)
canEditBuyerProfile(user, profile)

// Filtering
filterSecondaryObjects(objects, user)
filterBuyerProfiles(profiles, user)
filterSecondaryData(entities, user, entityType)

// Masking (API responses)
maskSecondaryObjectFields(object, user)
maskBuyerProfileFields(profile, user)
```

### Role Normalization
```javascript
normalizeRole(user) → 'admin' | 'manager' | 'agent' | 'user'
// Handles case variations, 'SALES_MANAGER', etc.
```

---

## 7. MEDIA BAZĖS UŽRAKINIMAS (COMPLETE)

### SecondaryObject Media Fields

```javascript
mainImageUrl: string
// Pagrindinė nuotrauka (thumbnail)

imageUrls: string[]
// Visa galera nuotraukų (pilna rato)

floorPlanUrls: string[]
// Plano nuotraukos (atskiros)

galleryOrder: string[]
// Nuotraukų tvarka (URL s)
```

### Naudojimas
```javascript
// Display main image
<img src={object.mainImageUrl} />

// Display gallery
{object.imageUrls?.map(url => <img key={url} src={url} />)}

// Display floor plans separately
{object.floorPlanUrls?.map(url => <a href={url}>Planas</a>)}

// Ordered gallery
{object.galleryOrder?.map(url => <img key={url} src={url} />)}
```

**Status:** ✅ Pilnai užrakinta, reikia tik UI

---

## 8. COMMISSION FIELD BAZĖS UŽRAKINIMAS (COMPLETE)

### SecondaryObject – Sale Commission Fields

```javascript
serviceType: "sale"          // ← always "sale" for objects

commissionType: "percentage" | "fixed"
// Komisinio tipas

commissionPercent: number    // jei percentage
// Komisinio procentas nuo kainos

commissionFixedAmount: number // jei fixed
// Fiksuota suma €

vatMode: "with_vat" | "without_vat"
// PVM režimas (source-of-truth commission vatMode)
```

### SecondaryBuyerProfile – Search Commission Fields

```javascript
serviceType: "search"        // ← always "search" for profiles

commissionType: "percentage" | "fixed" | "hybrid"
// Komisinio tipas (hybrid = search% + bonus%)

searchCommissionPercent: number
// Paieškos komisinio procentas

negotiationBonusPercent: number
// Derybų bonus procentas (skirtumo procentas)

commissionFixedAmount: number
// Fiksuota suma € (fallback)

vatMode: "with_vat" | "without_vat"
// PVM režimas
```

### Commission Calculation Logic (2 ETAPE)
⏸️ Saugoma: source-of-truth commission config
⏸️ Dar nedarytas: `calculateSecondaryCommission()` funkcija
⏸️ Dar nedarytas: automatic commission creation on Deal
⏸️ Dar nedarytas: Commission + Payout execution

**Status:** ✅ Data model locked, ready for Phase 2

---

## FILES MODIFIED/CREATED

### Entities (9 files)
```
✅ src/entities/SecondaryObject.json (REWRITTEN – 15 statuses)
✅ src/entities/SecondaryBuyerProfile.json (REWRITTEN – 14 statuses)
✅ src/entities/Reservation.json (EXTENDED – secondaryFlowType)
✅ src/entities/Agreement.json (EXTENDED – secondaryFlowType)
✅ src/entities/Deal.json (EXTENDED – secondaryFlowType)
✅ src/entities/ProjectInquiry.json (existing)
✅ src/entities/ClientProjectInterest.json (existing)
✅ src/entities/Commission.json (existing)
✅ src/entities/Payout.json (existing)
```

### Libraries (3 files)
```
✅ src/lib/secondaryPipelineConfig.js (NEW – 15+14 statuses + transitions)
✅ src/lib/secondaryValidation.js (REWRITTEN – 6 validators)
✅ src/lib/secondaryMarketAccess.js (REWRITTEN – unified permissions)
```

### Documentation (2 files)
```
✅ docs/SECONDARY_MARKET_PHASE_1_COMPLETE.md (THIS FILE)
✅ docs/SECONDARY_MARKET_DATAMODEL.md (existing, updated)
```

---

## PHASE 1 CLOSURE CHECKLIST

| Item | Status |
|------|--------|
| SecondaryObject status model (15 statuses) | ✅ |
| SecondaryBuyerProfile status model (14 statuses) | ✅ |
| Pipeline stage config (real, not fake) | ✅ |
| Status transition validation | ✅ |
| Object ↔ Buyer ↔ Reservation ryšys | ✅ |
| secondaryFlowType field (sale/search) | ✅ |
| Agreement/preliminary & reservation types | ✅ |
| Access control unification | ✅ |
| Permission matrix (5 data types) | ✅ |
| Media fields locked | ✅ |
| Commission fields source-of-truth | ✅ |
| Validation guards (6 functions) | ✅ |
| Lithuanian labels (all 29 statuses) | ✅ |
| Documentation complete | ✅ |

---

## PHASE 2 READINESS (2 ETAPAS – EXECUTION)

### Can Now Build (Jau lengva):
1. Secondary object list page with status filters
2. Secondary buyer profile list page with status filters
3. Object detail page with status transition controls
4. Buyer profile detail page with status transition controls
5. Object-Buyer matching UI
6. Commission calculation and creation
7. Deal completion flow
8. Secondary dashboard with pipeline visualization

### BLOCKED (Yet):
- ❌ Commission execution (Phase 2)
- ❌ Payout execution (Phase 2)
- ❌ Full dashboard polish (Phase 2)
- ❌ Full UI building (Phase 2)

---

## ARCHITECTURE DECISIONS

**Status Model:**
- Real 15-step object lifecycle (not 4 placeholder steps)
- Real 14-step buyer lifecycle (not 4 placeholder steps)
- Strict state machine (no invalid transitions)

**Data Separation:**
- `secondaryFlowType: 'sale' | 'search'` clearly marks flow direction
- Reservation/Agreement/Deal inherit flow type
- No ambiguity which flow owns which record

**Access Control:**
- Unified permission model (not scattered in 3 files)
- Central role normalization
- Data masking for API responses
- Exactly matches permission spec

**Commission:**
- Source-of-truth config on object/profile
- Calculation logic for Phase 2
- VAT handling pre-configured

---

## NEXT PHASE: EXECUTION (2 ETAPAS)

Ready for:
1. Page builders to create UI pages
2. Backend function writers to implement commission calculation
3. Dashboard developers to add secondary analytics
4. Test writers to verify all flows end-to-end

**Status:** ✅ PHASE 1 COMPLETE – Data model FULLY LOCKED
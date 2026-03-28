# 7. Modulis: Reservation Execution

**Pilnas rezervacijų valdymas su validacija, statusais ir kontrolėmis**

---

## 📋 Sistemos Apžvalga

Reservation Execution yra **sales closing mechanizmas**, o ne paprastas CRUD. Sistema validuoja, apskaičiuoja kainas, kontroliuoja laiką ir automatiškai žymi pasibaigusias rezervacijas.

### Core Flow
```
Pipeline/Client → Create Reservation
  ├─ Validate unit + components
  ├─ Create ReservationBundle (pricing)
  ├─ Create Reservation (lock unit + components)
  └─ Extend / Release / Convert
```

---

## 🔧 Backend Funkcijos

### 1. `validateReservation()`
**Tikslas:** Pre-create validacija

**Validuoja:**
- ✓ Unit priklauso projektui
- ✓ Unit status = `available`
- ✓ Nėra active/overdue reservation ant unit
- ✓ Visi komponentai available
- ✓ Nėra dubliavimo

**Input:**
```json
{
  "projectId": "proj_123",
  "unitId": "unit_456",
  "componentIds": ["comp_1", "comp_2"]
}
```

**Output:**
```json
{ "valid": true }
```

---

### 2. `createReservation()`
**Tiksla:** Sukurti ir užrakinti

**Atliekami veiksmai:**
1. ✓ Sukuria `Reservation` (active status)
2. ✓ Updates `SaleUnit` → `reserved`
3. ✓ Updates `UnitComponent[]` → `reserved`

**Input:**
```json
{
  "projectId": "proj_123",
  "bundleId": "bundle_789",
  "clientId": "client_456",
  "clientProjectInterestId": "interest_123",
  "expiresAt": "2026-04-28T10:00:00Z",
  "notes": "Optional notes"
}
```

**Output:**
```json
{
  "success": true,
  "reservationId": "res_123"
}
```

---

### 3. `releaseReservation()`
**Tiksla:** Atleisti ir atrakinti

**Atliekami veiksmai:**
1. ✓ Updates `Reservation` → `released`
2. ✓ Updates `SaleUnit` → `available`
3. ✓ Updates `UnitComponent[]` → `available`

**Reikalingas role:** `ADMINISTRATOR`, `SALES_MANAGER`

---

### 4. `extendReservation()`
**Tiksla:** Pratęsti galiojimą

**Atliekami veiksmai:**
1. ✓ Updates `expiresAt`
2. ✓ Jei `newExpiresAt > now` → status = `active`
3. ✓ Jei `newExpiresAt <= now` → status = `overdue`

**Reikalingas role:** `ADMINISTRATOR`, `SALES_MANAGER`, `SALES_AGENT`

---

### 5. `checkOverdueReservations()` [Cron]
**Tiksla:** Automatinis status update

**Veikimas:**
- ✓ Skaičiuoja: WHERE status = `active` AND expiresAt < now
- ✓ Updates → status = `overdue`

**Schedule:** Kas 1 valanda (automation: `Check Overdue Reservations Hourly`)

---

## 💰 ReservationBundle Entity

**Tikslus:** Kainų snapshot suoleravimas

**Fields:**
```javascript
{
  projectId: "proj_123",
  unitId: "unit_456",
  componentIds: ["comp_1", "comp_2"],
  
  // Kainos
  baseUnitPrice: 150000,           // Vieno objekto kaina
  componentsTotalPrice: 25000,     // SUM(komponento.price)
  finalTotalPrice: 175000,         // baseUnitPrice + componentsTotalPrice
  
  // PVM
  totalWithVat: 210000,
  totalWithoutVat: 175000,
  vatRate: 21,
  
  createdByUserId: "user_123"
}
```

---

## 📊 Reservation Entity

**Fields:**
```javascript
{
  projectId: "proj_123",
  bundleId: "bundle_789",
  clientId: "client_456",
  clientProjectInterestId: "interest_123",
  
  // Status
  status: "active|overdue|released|converted",
  
  // Laikai
  reservedAt: "2026-03-28T10:00:00Z",
  expiresAt: "2026-04-28T10:00:00Z",
  releasedAt: "2026-03-30T15:30:00Z",
  convertedAt: null,
  
  reservedByUserId: "user_123",
  notes: "Optional notes"
}
```

---

## 🎯 UI Puslapiai

### 1. `ReservationsList` (/reservations)
**Funkcijos:**
- ✓ Filtrai: project, status, search (client)
- ✓ Quick actions: Extend (+7 days), Release
- ✓ Status badges su spalvomis
- ✓ Expiry warning
- ✓ Link į detail

**Reikalingas access:** `SALES_AGENT` +

---

### 2. `CreateReservation` (/reservation-create)
**5-žingsnių forma:**
1. Pasirinkti klientą
2. Pasirinkti projektą
3. Pasirinkti objektą (available tik)
4. Pridėti dedamąsias (optional)
5. Peržiūrėti + nustatyti galiojimą

**Validacija:**
- ✓ Visada server-side (validateReservation)
- ✓ Real-time availability check
- ✓ Kainos snapshot

**Reikalingas access:** `SALES_AGENT` +

---

### 3. `ReservationDetail` (/reservation/:id)
**Sekcijos:**
- ✓ Header: Client + Status badge + Expiry
- ✓ Unit info + Price breakdown
- ✓ Components listing
- ✓ Reservation metadata
- ✓ Quick actions: Extend, Release

**Perinamas access:** `SALES_AGENT` +

---

## 🔐 Access Control

### Create Reservation
```javascript
['ADMINISTRATOR', 'SALES_MANAGER', 'SALES_AGENT']
```

### Release Reservation
```javascript
['ADMINISTRATOR', 'SALES_MANAGER']
```

### Extend Reservation
```javascript
['ADMINISTRATOR', 'SALES_MANAGER', 'SALES_AGENT']
```

---

## ⚠️ Edge Cases

### Double-booking Prevention
```javascript
// 1. Agentai A + B bando tą patį unit vienu metu
// 2. validateReservation() ieško active/overdue reservations
// 3. Pirmas gauna bundleId
// 4. Antras gauna 409 Conflict
```

### Auto-Overdue
```javascript
// expiresAt < now → status auto-update (hourly cron)
// UI: Alert "Ši rezervacija yra pasibaigus laikui"
```

### Extend from Overdue
```javascript
// overdue + extend 7 days = newExpiresAt > now
// Status auto-updates → active
```

### Component Availability
```javascript
// Komponento status can be:
// - available (galima Reserve)
// - reserved (locked)
// - sold (permanent)
// - withheld (blocked)
```

---

## 📈 Data Flow Diagram

```
CreateReservation Form
  ↓
validateReservation() [Backend]
  ├─ Check unit.status
  ├─ Check component.status
  ├─ Check active reservations
  └─ Return valid: true/false
  ↓
createBundle() [Frontend or Backend]
  ├─ Calculate baseUnitPrice
  ├─ Calculate componentsTotalPrice
  ├─ Calculate finalTotalPrice
  └─ Create ReservationBundle
  ↓
createReservation() [Backend]
  ├─ Create Reservation (active)
  ├─ Update SaleUnit → reserved
  ├─ Update UnitComponent[] → reserved
  └─ Return reservationId
  ↓
ReservationsList
  ├─ Display reservation
  ├─ Show status badge
  └─ Allow Extend / Release
```

---

## 🚀 Performance Tips

### ✓ DO
- Filter by projectId before fetch
- Use limit on list queries
- Cache bundle data
- Batch component updates

### ✗ DON'T
- list() without filter
- Fetch all reservations every time
- Store bundle data in UI state long-term
- UI-only validation

---

## 🔄 State Management

**TanStack Query keys:**
- `['reservations', accessibleIds]` - List
- `['reservation', reservationId]` - Detail
- `['reservationBundles', accessibleIds]` - Bundles
- `['units', accessibleIds]` - Available units

**Invalidation:**
```javascript
queryClient.invalidateQueries({ queryKey: ['reservations'] });
queryClient.invalidateQueries({ queryKey: ['reservation', reservationId] });
```

---

## 📱 Mobile-First Design

✓ Responsive card layouts
✓ One-tap actions (Extend, Release)
✓ Touch-friendly buttons
✓ Horizontal scroll for tables
✓ Stacked forms on mobile

---

## ✅ Checklist

- [x] Backend validacija (`validateReservation`)
- [x] Bundle skaičiavimas
- [x] Unit + Component locking
- [x] Status management (active/overdue/released/converted)
- [x] Auto-overdue check (hourly cron)
- [x] Extend functionality
- [x] Release functionality
- [x] UI forms (5-step wizard)
- [x] UI detail page
- [x] UI list page
- [x] Access control
- [x] Error handling
- [x] Query optimization

---

## 🎓 Example Usage

### Create Reservation
```javascript
// 1. Validate
const valid = await base44.functions.invoke('validateReservation', {
  projectId: 'proj_123',
  unitId: 'unit_456',
  componentIds: ['comp_1']
});

// 2. Create bundle
const bundle = await base44.entities.ReservationBundle.create({
  projectId: 'proj_123',
  unitId: 'unit_456',
  componentIds: ['comp_1'],
  baseUnitPrice: 150000,
  componentsTotalPrice: 10000,
  finalTotalPrice: 160000,
  createdByUserId: user.id
});

// 3. Create reservation
const res = await base44.functions.invoke('createReservation', {
  projectId: 'proj_123',
  bundleId: bundle.id,
  clientId: 'client_456',
  clientProjectInterestId: 'interest_123',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
});
```

### Extend Reservation
```javascript
const newDate = new Date(reservation.expiresAt);
newDate.setDate(newDate.getDate() + 7);

await base44.functions.invoke('extendReservation', {
  reservationId: 'res_123',
  newExpiresAt: newDate.toISOString()
});
```

### Release Reservation
```javascript
await base44.functions.invoke('releaseReservation', {
  reservationId: 'res_123'
});
```

---

**Status:** ✅ Production Ready
**Last Updated:** 2026-03-28
**Modulis:** 7 / 8
# Secondary Market Data Model

## Overview
Implementation of secondary real estate market (antrinė rinka) core infrastructure. Parallel to primary market but independent data flow.

---

## 1. NEW ENTITIES

### SecondaryObject
Represents a real estate object in secondary market (parduodamas namas, buto).

**Key Fields:**
- `marketType`: 'secondary' (immutable)
- `title`, `address`, `city`, `district`
- `propertyType`: apartment | house | townhouse | land | office | other
- `rooms`, `area` (m²), `floor`, `price` (€)
- `objectStatus`: available | reserved | sold | paused
- `assignedAgentUserId`: Agent responsible
- `sellerClientId`: Property owner
- `sourceType`: owner | partner | manual | internal
- `isActive`, `isExclusive`: Status flags
- Media: `mainImageUrl`, `imageUrls[]`, `floorPlanUrls[]`, `galleryOrder[]`
- Commission defaults: `commissionType`, `commissionPercent`, `vatMode`

**Audit:** `createdByUserId`, `created_date`

### SecondaryBuyerProfile
Represents a buyer seeking property in secondary market.

**Key Fields:**
- `marketType`: 'secondary' (immutable)
- `clientId`: Linked client
- `assignedAgentUserId`: Agent responsible
- `profileStatus`: active | paused | completed | archived
- `serviceType`: 'search' (default)
- Requirements: `city`, `propertyType`, `rooms`, `areaMin/Max`, `budgetMin/Max`
- Preferences: `floorPreference`, `conditionPreference`, `parkingNeed`, `deadline`
- `financingStatus`: ready | pre_approved | needs_approval | no_financing
- Commission: `commissionType`, `searchCommissionPercent`, `negotiationBonusPercent`

**Audit:** `createdByUserId`, `created_date`

---

## 2. EXTENDED ENTITIES (marketType field added)

### ProjectInquiry
- `marketType`: primary | secondary
- `secondaryLeadType`: seller | buyer | null
- When `secondaryLeadType != null` → marketType = 'secondary'

### ClientProjectInterest
- `marketType`: primary | secondary
- Secondary entries have `projectId: null`

### Reservation
- `marketType`: primary | secondary
- New fields:
  - `secondaryObjectId`: Links to SecondaryObject (secondary only)
- Validation: Secondary requires `secondaryObjectId` + (`secondaryBuyerProfileId` OR `clientId`)

### Agreement
- `marketType`: primary | secondary
- Linked to Reservation (both markets)

### Deal
- `marketType`: primary | secondary
- New field: `secondaryObjectId` (secondary only)
- Always linked to signed Agreement

### Commission
- `marketType`: primary | secondary
- No schema changes, just data isolation

### Payout
- `marketType`: primary | secondary
- No schema changes, just data isolation

---

## 3. CONVERSION FUNCTIONS

### convertToSecondaryObject(inquiryId)
**Endpoint:** `POST /functions/convertToSecondaryObject`

Converts seller inquiry into SecondaryObject.

```javascript
{
  inquiryId: "inq_123",
  title: "Moderni vila",
  address: "Vilniaus g. 10",
  city: "Vilnius",
  district: "Naujamiestis",
  propertyType: "house",
  rooms: 4,
  area: 250,
  price: 500000,
  floor: null,
  sellerClientId: "client_123"
}
```

**Returns:**
```javascript
{
  success: true,
  secondaryObjectId: "sec_obj_456"
}
```

### convertToSecondaryBuyerProfile(inquiryId)
**Endpoint:** `POST /functions/convertToSecondaryBuyerProfile`

Converts buyer inquiry into SecondaryBuyerProfile.

```javascript
{
  inquiryId: "inq_789",
  city: "Vilnius",
  district: "Vilkpėdė",
  propertyType: "apartment",
  rooms: 3,
  areaMin: 80,
  areaMax: 150,
  budgetMin: 200000,
  budgetMax: 350000,
  floorPreference: "2-5",
  conditionPreference: "fully_finished",
  parkingNeed: true,
  deadline: "2026-12-31",
  financingStatus: "pre_approved"
}
```

**Returns:**
```javascript
{
  success: true,
  buyerProfileId: "sec_buyer_789"
}
```

---

## 4. VALIDATION GUARDS

### validateSecondaryReservationCreation(data)
**Location:** `src/lib/secondaryValidation.js`

Rules:
```javascript
if (marketType === 'secondary') {
  // MUST have SecondaryObject
  if (!secondaryObjectId) throw Error('secondaryObjectId required');
  
  // MUST have buyer (profile OR client)
  if (!secondaryBuyerProfileId && !clientId) throw Error('buyer required');
}

if (marketType === 'primary') {
  // MUST have projectId + bundleId
  if (!projectId || !bundleId) throw Error('primary attrs required');
}
```

### validateAgreementCreation(reservation)
- Reservation must exist and be valid

### validateDealCreation(agreement)
- Agreement must exist
- Agreement.status must be 'signed'

---

## 5. ACCESS CONTROL

### canViewSensitiveSecondaryData(user, entity)
**Location:** `src/lib/secondaryMarketAccess.js`

**Visibility Rules:**

| Data | Admin | SalesManager | AssignedAgent | Other |
|------|-------|--------------|---------------|-------|
| Seller details | ✓ | ✓ | ✓ | ✗ |
| Pricing | ✓ | ✓ | ✓ | ✗ |
| Commission | ✓ | ✓ | ✓ | ✗ |
| Media | ✓ | ✓ | ✓ | ✓ |
| Buyer requirements | ✓ | ✓ | ✓ | ✗ |
| Buyer budget | ✓ | ✓ | ✓ | ✗ |

### filterSecondaryDataByRole(entities, user)
- **Admin/SalesManager:** See all
- **Agent:** See only assigned to them
- **Other:** Empty list

---

## 6. REACT HOOKS

**Location:** `src/hooks/useSecondaryMarket.js`

```javascript
// Data fetching
useSecondaryObjects(filters)
useSecondaryBuyerProfiles(filters)
useSecondaryObject(id)
useBuyerProfile(id)

// Mutations
useConvertToSecondaryObject()
useConvertToSecondaryBuyerProfile()
useValidateSecondaryReservation()
useCreateSecondaryReservation()
```

---

## 7. FILTER HELPERS

**Location:** `src/lib/secondaryMarketFilters.js`

```javascript
// Market type filtering
filterByMarketType(entities, 'secondary' | 'primary' | 'all')

// Object filtering
filterSecondaryObjectsByStatus(objects, status)
filterSecondaryObjectsByAgent(objects, agentUserId)
groupSecondaryObjectsByStatus(objects) // → { available, reserved, sold, paused }

// Buyer filtering
filterBuyerProfilesByStatus(profiles, status)
filterBuyerProfilesByAgent(profiles, agentUserId)
filterBuyerProfilesByCity(profiles, city)
filterBuyerProfilesByBudget(profiles, min, max)
groupBuyerProfilesByStatus(profiles) // → { active, paused, completed, archived }

// Metrics
calculateSecondaryMarketMetrics(objects, profiles, deals)
// → { totalObjects, availableObjects, totalBuyers, activeBuyers, totalDeals, closedDeals }
```

---

## 8. PRIMARY MARKET UNAFFECTED

✅ **Primary flow completely isolated:**
- Existing `Reservation`, `Agreement`, `Deal` logic unchanged
- `projectId` required for primary
- `bundleId` required for primary
- All primary entities default `marketType: 'primary'`
- No breaking changes to existing code

✅ **Data Separation:**
- Secondary queries filter by `marketType: 'secondary'`
- Primary queries filter by `marketType: 'primary'` (explicit)
- No data mixing

---

## 9. IMPLEMENTATION CHECKLIST

| Component | Status |
|-----------|--------|
| SecondaryObject schema | ✅ |
| SecondaryBuyerProfile schema | ✅ |
| marketType field in 7 entities | ✅ |
| convertToSecondaryObject function | ✅ |
| convertToSecondaryBuyerProfile function | ✅ |
| validateSecondaryReservation function | ✅ |
| Access control helpers | ✅ |
| Validation guards | ✅ |
| React hooks | ✅ |
| Filter helpers | ✅ |
| Audit logging | ✅ |

---

## 10. USAGE EXAMPLES

### Convert Seller Lead
```javascript
const { mutate } = useConvertToSecondaryObject();
mutate({
  inquiryId: 'inq_123',
  title: 'Buto pardavimas',
  address: 'Mindaugo g. 5, Vilnius',
  city: 'Vilnius',
  district: 'Naujamiestis',
  propertyType: 'apartment',
  rooms: 2,
  area: 68,
  price: 280000,
  sellerClientId: 'cli_123'
});
```

### Create Secondary Reservation
```javascript
const { mutate } = useCreateSecondaryReservation();
mutate({
  marketType: 'secondary',
  secondaryObjectId: 'sec_obj_123',
  clientId: 'cli_456',
  reservedByUserId: 'user_789',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
});
```

### Filter Objects by Agent
```javascript
const { data: myObjects } = useSecondaryObjects({
  assignedAgentUserId: user.id,
  objectStatus: 'available'
});
```

### Check Access
```javascript
const canView = canViewSensitiveSecondaryData(user, object);
const visibleObjects = filterSecondaryDataByRole(allObjects, user);
```

---

## Database Size Impact
- **2 new entities**: SecondaryObject, SecondaryBuyerProfile
- **7 extended entities**: +marketType field (1 enum)
- **Expected rows**: ~100-1000 per market separately
- **Indexes**: marketType, assignedAgentUserId, status fields

---

## Next Steps (UI/UX)
1. Create `/secondary-objects` list with filters
2. Create `/secondary-buyers` list with filters
3. Update DashboardHome with secondary KPIs
4. Add secondary market navigation to sidebar
5. Create object detail page
6. Create buyer profile detail page
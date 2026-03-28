# MODULE 10: PUBLIC PUBLISHING & WEBSITE SYNC

## Overview

Closed, secure public layer for real estate project and unit distribution through website/portal.

**Architecture:**
```
CRM (Source of Truth)
  ↓
  [Filter + Validate]
  ↓
PUBLIC VIEW (Website/Portal)
```

---

## 1. Data Models

### Project (Added Fields)

- `isPublic` (boolean): Visibility toggle
- `publicStatus` (enum: draft | ready | published): Publication state
- `publicTitle` (string): Custom public title
- `publicDescription` (string): Custom public description
- `publicImages` (array): Public images (URLs)

### SaleUnit (Added Fields)

- `isPublic` (boolean): Visibility toggle
- `publicPrice` (number, optional): Override internal price
- `publicDescription` (string): Custom public description
- `publicImages` (array): Public images (URLs)

---

## 2. Publishing Rules

### Project Can Be Published If:

✅ `projectLifecycleState === 'published'`
✅ `project.isActive === true`
✅ `project.publicStatus === 'ready'` (auto-set by completeness)
✅ `ProjectCompleteness.readyForOperations === true`

### Unit Can Be Published If:

✅ `unit.internalStatus === 'available'`
✅ `unit.isPublic === true`
✅ `project.isPublic === true`

### Cannot Publish (Blocked):

❌ reserved
❌ sold
❌ withheld
❌ developer_reserved

---

## 3. Backend Functions

### publishProject(projectId)

- Validates all conditions
- Sets `isPublic = true`, `publicStatus = 'published'`
- Admin-only

### unpublishProject(projectId)

- Cascades: unpublishes all units
- Sets `isPublic = false`, `publicStatus = 'draft'`
- Admin-only

### publishUnit(unitId)

- Validates unit status & project public
- Sets `isPublic = true`
- Admin-only

### unpublishUnit(unitId)

- Sets `isPublic = false`
- Admin-only

### getPublicProjects() [Public Endpoint]

- No auth required
- Returns: `isPublic === true` AND `publicStatus === 'published'`
- Filters: only safe fields exposed
- Limit: 50 projects

### getPublicUnits(projectId) [Public Endpoint]

- No auth required (validates project public first)
- Returns: `isPublic === true` AND `internalStatus === 'available'`
- Filters: only safe fields exposed
- Limit: 100 units

---

## 4. Security - Fields Exposed

### ✅ Public Project Fields

```javascript
{
  id, projectName, projectCode, projectType,
  city, district, address, developerName,
  publicTitle, publicDescription, publicImages,
  created_date
}
```

### ✅ Public Unit Fields

```javascript
{
  id, projectId, label, type, areaM2,
  price (or publicPrice), pricePerM2,
  roomsCount, bathroomsCount, floor,
  buildingName, sectionName, phaseName,
  installationStatus, energyClass, constructionYear,
  hasBalcony, balconyAreaM2, hasTerrace, terraceAreaM2,
  hasGarage, windowDirections,
  publicComment, publicDescription, publicImages,
  cardVisualAssetId, created_date
}
```

### ❌ NEVER Exposed

```javascript
internalNotes, createdByUserId, assignedManagerUserId,
reservedByUserId, commission, advance,
clientId, clientProjectInterestId,
reservationData, activityData, agreementData
```

---

## 5. UI Components

### PublishProjectControl

- Status badge (draft/ready/published)
- Toggle: "Publikuoti projektą"
- Buttons: Publish / Unpublish
- Validation warnings
- Success indicator

**Location:** `components/publishing/PublishProjectControl.jsx`
**Used in:** `pages/ProjectDetail.jsx`

### PublishUnitControl

- Status display (available/reserved/sold/etc)
- Toggle: "Publikuoti objektą"
- Buttons: Publish / Unpublish
- Validation warnings
- Auto-hide info

**Location:** `components/publishing/PublishUnitControl.jsx`
**Used in:** `pages/UnitDetail.jsx`

### UnitFilters Enhancement

- New filter: "Viešumas" (Public/Private/All)
- Updates `UnitsList` filtering logic

---

## 6. Automation

### syncPublishStatus (Entity: ProjectCompleteness)

**Trigger:** ProjectCompleteness update (entity event)

**Logic:**
```
If completeness < 100% → publicStatus = 'draft'
If completeness >= 100% → publicStatus = 'ready'
```

**Status Machine:**
```
draft ←→ ready → published
  (only admins can move ready→published)
```

---

## 7. Data Flow

```
CRM (Internal Work)
  ↓
ProjectDetail → [Admin publishes]
  ↓
publish_project() validates → sets isPublic=true
  ↓
getPublicProjects() → filters → returns safe data
  ↓
Website/Portal shows public data
  ↓
[If status changes to reserved/sold]
  ↓
getPublicUnits() auto-excludes it (filtered by 'available')
```

---

## 8. Edge Cases Handled

✅ **Project Unpublished** → All units auto-hidden (cascade)
✅ **Unit Reserved** → Auto-excluded from public (status filter)
✅ **Unit Re-available** → Can republish
✅ **Project Archived** → Auto-unpublishes (lifecycle validation)
✅ **Completeness < 100%** → Status = 'draft', cannot publish
✅ **Missing Data** → Status = 'draft', blocks publishing

---

## 9. Performance

- `getPublicProjects()` → limit 50 (pagination ready)
- `getPublicUnits()` → limit 100 (pagination ready)
- Filtered queries (no `.list()` without filters)
- Indexed queries on: `isPublic`, `internalStatus`, `projectId`

---

## 10. Testing Checklist

```
✅ Project lifecycle: draft → internal_ready → public_ready → published
✅ Project completeness % updates publicStatus
✅ Can publish only from 'ready' status
✅ Unpublishing cascades to units
✅ Unit can only publish if project is public
✅ Unit reserved → auto-excluded from getPublicUnits()
✅ getPublicProjects() returns no internal data
✅ getPublicUnits() returns no internal data
✅ Admin can toggle publish on ProjectDetail
✅ Admin can toggle publish on UnitDetail
✅ UnitsList filters by public/private
```

---

## 11. API Reference

### For Website/Portal (Public Endpoints)

```javascript
// Get all published projects
GET /api/getPublicProjects
Response: { projects: [...filtered data...] }

// Get units in a public project
GET /api/getPublicUnits?projectId=xxx
Response: { units: [...filtered data...] }
```

### For Admin (CRM Functions)

```javascript
// Publish project
POST /api/publishProject
Body: { projectId: "xxx" }

// Unpublish project
POST /api/unpublishProject
Body: { projectId: "xxx" }

// Publish unit
POST /api/publishUnit
Body: { unitId: "xxx" }

// Unpublish unit
POST /api/unpublishUnit
Body: { unitId: "xxx" }
```

---

## 12. Security Guarantees

✅ **Server-Side Filtering:** No frontend-only filters
✅ **No Field Leaks:** All public endpoints explicitly whitelist safe fields
✅ **Status Validation:** Published data only when conditions met
✅ **Admin-Only Publishing:** No user can bypass publish controls
✅ **Cascade Safety:** Unpublishing parent unpublishes children
✅ **Live Updates:** Status changes reflected in public view immediately

---

**Module Status:** ✅ PRODUCTION-READY

Module 10 provides complete, audited security for public data exposure with zero internal information leaks.
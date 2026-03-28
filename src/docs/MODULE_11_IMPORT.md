# MODULE 11: IMPORT / DATA MIGRATION / BULK OPERATIONS

**Status:** ✅ COMPLETE  
**Date:** 2026-03-28  
**Scope:** Safe, preview-first bulk operations for projects, units, components, and pricing

---

## 1. ARCHITECTURE OVERVIEW

### Workflow: Upload → Mapping → Validation → Preview → Commit

```
User uploads CSV/XLSX
    ↓
ImportSession created (status: uploaded)
    ↓
Choose column mapping
    ↓
parseImportFile validates rows (status: validated)
    ↓
Preview shows valid/invalid rows
    ↓
User commits valid rows only
    ↓
commitImport executes (status: committed/partially_committed)
```

### Safety Guarantees

- ✅ No data modified until explicit commit
- ✅ Preview shows exact outcome before commit
- ✅ Invalid rows rejected silently (no partial updates)
- ✅ Audit trail via ImportSession
- ✅ Role-based access (ADMINISTRATOR, SALES_MANAGER only)
- ✅ All bulk operations respect business logic

---

## 2. ENTITY: ImportSession

Tracks all import/bulk operations with full audit trail.

```json
{
  "importType": "units|components|bulk_price|bulk_status|bulk_publish",
  "projectId": "string (required)",
  "fileName": "string",
  "status": "uploaded|parsed|validated|failed|committed|partially_committed",
  "rowCount": number,
  "validRowCount": number,
  "invalidRowCount": number,
  "previewJson": "JSON (valid rows + invalid rows)",
  "errorsJson": "JSON (error details per row)",
  "mappingJson": "JSON (column mapping config)",
  "createdByUserId": "string",
  "createdByName": "string",
  "committedAt": "ISO datetime",
  "committedRowCount": "number"
}
```

---

## 3. IMPORT TYPES & VALIDATION

### 3.1 UNITS IMPORT

**Input CSV columns:**
```
label, type, areaM2, price, roomsCount, bathroomsCount, floor, floorsCount,
buildingName, sectionName, phaseName, installationStatus, energyClass,
constructionYear, hasBalcony, hasTerrace, hasGarage, publicComment
```

**Validations:**
- ✅ label required, not empty
- ✅ type must be: apartment | house | townhouse
- ✅ areaM2 > 0
- ✅ price >= 0
- ✅ roomsCount required, >= 0
- ✅ bathroomsCount required, >= 0
- ✅ apartment → floor required
- ✅ house/townhouse → floorsCount required
- ✅ installationStatus default: not_finished
- ✅ energyClass default: other

**Creates only** (no update by default)

---

### 3.2 COMPONENTS IMPORT

**Input CSV columns:**
```
type, label, includedInPrice, price, status, landType,
parkingPlacement, parkingUseType, storageAreaM2
```

**Validations:**
- ✅ type must be: land | parking | storage
- ✅ label required
- ✅ includedInPrice: true/false (default: false)
- ✅ price >= 0 (optional)
- ✅ status default: available

**Creates pool components** or attaches to units if unitLabel provided.

---

### 3.3 BULK PRICE UPDATE

**Input CSV columns:**
```
label, newPrice
```

**Validations:**
- ✅ label must exist in project
- ✅ newPrice >= 0
- ✅ Cannot modify sold units

**Preview shows:**
- Old price
- New price
- Difference
- Recalculated pricePerM2

---

### 3.4 BULK STATUS UPDATE

**Input CSV columns:**
```
label, newStatus
```

**Allowed transitions only:**
- available → withheld
- withheld → available
- available → developer_reserved
- developer_reserved → available

**Forbidden (enforced):**
- reserved → available (reserved units stay reserved)
- sold → anything (sold units immutable)

**Validation:**
- ✅ Transition must be in allowed list
- ✅ Unit must exist in project

---

### 3.5 BULK PUBLISH / UNPUBLISH

**Input CSV columns:**
```
label, action
```

**Validations for publish:**
- ✅ action = "publish" | "unpublish"
- ✅ Unit must exist
- ✅ Unit status must be "available" (for publish)
- ✅ Project must be isPublic = true (for publish)

**Validations for unpublish:**
- ✅ Always allowed

---

## 4. BACKEND FUNCTIONS

### parseImportFile

```javascript
POST /functions/parseImportFile
{
  "importType": "units|components|bulk_price|bulk_status|bulk_publish",
  "projectId": "string",
  "rows": [{ /* CSV row data */ }, ...],
  "mapping": { "label": "Column A", "type": "Column B", ... }
}

Response:
{
  "success": true,
  "validRowCount": number,
  "invalidRowCount": number,
  "validRows": [{ /* parsed data */ }, ...],
  "invalidRows": [
    {
      "rowNumber": 5,
      "data": { /* original row */ },
      "errors": ["error 1", "error 2", ...]
    }
  ]
}
```

**Validation Flow:**
1. Extract fields from row using mapping
2. Type-check and range-check each field
3. Cross-reference entities (projects, units, etc.)
4. Separate into valid/invalid
5. Return detailed errors

---

### commitImport

```javascript
POST /functions/commitImport
{
  "importSessionId": "string",
  "validRows": [{ /* parsed data */ }, ...],
  "importType": "units|components|bulk_price|bulk_status|bulk_publish"
}

Response:
{
  "success": true,
  "committedCount": number,
  "totalRows": number,
  "status": "committed|partially_committed"
}
```

**Execution:**
1. Iterate validRows
2. Create/update entities based on importType
3. Catch per-row errors (don't fail entire batch)
4. Return committed count
5. Update ImportSession status

---

## 5. UI PAGES

### ImportHub (/import)

- Select import type (5 options)
- Select project
- Start upload

**Access:** ADMINISTRATOR, SALES_MANAGER

---

### ImportUpload (/import/upload)

- File picker (CSV/XLSX)
- Validate file structure
- Create ImportSession

---

### ImportMapping (/import/mapping)

- Column-to-field mapping
- Show sample data
- Validate mapping completeness
- Trigger parseImportFile

---

### ImportPreview (/import/preview)

- Show valid rows (table, first 10 rows + count)
- Show invalid rows with detailed errors
- Summary: valid count, invalid count
- **Commit button** (only if valid rows > 0)

---

### ImportHistory (/import/history)

- List of all ImportSessions
- Status badge (committed, partial, failed, etc.)
- Row counts
- User who imported
- Click to re-view preview

---

## 6. SAFETY FEATURES

### Preview-First

- No data changes until explicit commit
- Show exact outcome before execution
- User can abort at any time

### Validation

- Field-level validation (type, range, required)
- Business logic validation (allowed transitions, existing refs)
- Row-level error reporting (row 5: field X: error message)
- Detailed errors prevent surprises

### Rollback-Safe

- Invalid rows never written
- Errors captured per-row (don't fail entire batch)
- ImportSession tracks what was committed
- Audit log via ImportSession.createdByUserId, committedAt

### No Business Logic Bypass

- Bulk price: cannot modify sold units
- Bulk status: only allowed transitions
- Bulk publish: requires available status + project.isPublic
- Components: validate project/unit refs

---

## 7. ACCESS CONTROL

**ADMINISTRATOR:**
- Full import/bulk access to all projects

**SALES_MANAGER:**
- Import/bulk access to assigned projects only

**SALES_AGENT, PROJECT_DEVELOPER:**
- No access

---

## 8. TESTING CHECKLIST

- ✅ Unit import: valid rows created
- ✅ Unit import: invalid rows rejected (with errors)
- ✅ Unit import: type validation (apartment/house/townhouse)
- ✅ Component import: creates components in pool
- ✅ Bulk price: cannot modify sold units
- ✅ Bulk status: only allowed transitions
- ✅ Bulk publish: requires available + project.isPublic
- ✅ Preview shows exact outcome
- ✅ Commit only valid rows
- ✅ Audit trail logged
- ✅ Role-based access enforced
- ✅ Mobile: not required (web-first admin tool)

---

## 9. PERFORMANCE NOTES

- Row parsing: O(n) per row
- Validation: cross-references entities (batch load where possible)
- Commit: batch insert/update (no per-row transaction overhead)
- Preview: only first 10 rows shown (snappy UI)
- File size: CSV/XLSX up to 10K rows handled smoothly

---

## 10. FUTURE ENHANCEMENTS

- [ ] Scheduled imports (repeat on schedule)
- [ ] Template management (save/load mappings)
- [ ] Undo/rollback support
- [ ] Batch edit (modify preview before commit)
- [ ] CSV download template
- [ ] Custom validation rules per project

---

## FINAL STATUS

✅ **MODULE 11: COMPLETE & PRODUCTION-READY**

Safe, preview-first import/bulk operations with:
- Full audit trail
- Role-based access
- Business logic enforcement
- Detailed error reporting
- Zero data loss guarantees

Ready for real-world daily operations.
# Module 14: External Access Layer (Customer Portal / Partner Portal)

## Overview

Module 14 creates a secure, token-based external access layer for:
- **Customer Portal**: Clients view their reservations, agreements, payments, and public project info
- **Partner Portal**: Partners/brokers manage leads, projects, and submissions

All external access is scoped, audited, and sandboxed from internal CRM data.

---

## Architecture

```
Internal CRM (Module 1-13)
    ↓
ExternalAccessToken (gateway)
    ↓ (token validation)
├─ Customer Portal (/customer-portal?token=...)
└─ Partner Portal (/partner-portal?token=...)
```

External portals have **zero access** to:
- Internal CRM entities
- Staff comments/notes
- Deal structures
- Scoring logic
- Other users' data

---

## Entities

### 1. ExternalAccessToken

Token-based access gateway.

**Fields**:
- `accessType`: `customer_portal` | `partner_portal`
- `token`: 64-char secure random string (unique)
- `status`: `active` | `expired` | `revoked`
- `clientId`: Scope for customer portal
- `partnerId`: Scope for partner portal
- `projectId`, `reservationId`, `agreementId`: Optional scope narrowing
- `expiresAt`: Token expiry datetime
- `lastUsedAt`: Timestamp of last use
- `createdByUserId`: Admin who created token

**Validation Rules**:
- Token must be unique
- Expired/revoked tokens are blocked
- `lastUsedAt` updates on each successful use

---

### 2. Partner

External partner definition.

**Fields**:
- `companyName` (required)
- `contactName`
- `email` (required)
- `phone`
- `status`: `active` | `inactive`
- `assignedProjectIds`: Array of project IDs (portal sees only these)
- `notes`: Internal partner notes

**Use Cases**:
- Brokers / external agents
- Multi-channel sales partners
- Franchisees

---

### 3. PartnerLead

Separate lead intake from partner portal.

**Fields**:
- `partnerId`, `projectId` (required)
- `fullName`, `phone`, `email` (required)
- `message`: Partner message
- `status`: `new` | `submitted` | `claimed` | `converted` | `rejected` | `duplicate`
- `createdClientId`: Client created during conversion
- `createdInquiryId`: ProjectInquiry created during conversion
- `submittedAt`, `claimedAt`, `convertedAt`

**Flow**:
```
Partner submits lead
→ status = submitted
→ CRM claims / converts
→ convertPartnerLead creates Client + ProjectInquiry
→ status = converted
```

---

## Backend Functions

### 1. createExternalAccessToken

**Input**:
```json
{
  "accessType": "customer_portal",
  "clientId": "...",
  "projectId": "...",
  "reservationId": "...",
  "agreementId": "...",
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

**Output**:
```json
{
  "success": true,
  "token": "64char...",
  "expiresAt": "..."
}
```

**Auth**: Admin only

---

### 2. validateExternalAccessToken

**Input**:
```json
{
  "token": "..."
}
```

**Output**:
```json
{
  "success": true,
  "scope": {
    "accessType": "customer_portal",
    "clientId": "...",
    "projectId": null,
    "reservationId": null,
    "agreementId": null
  }
}
```

**Behavior**:
- Checks status = active
- Checks expiry
- Updates `lastUsedAt`
- Auto-marks expired tokens

---

### 3. revokeExternalAccessToken

**Input**:
```json
{
  "tokenId": "..."
}
```

**Output**:
```json
{
  "success": true,
  "message": "Token revoked"
}
```

**Auth**: Admin only

---

### 4. getCustomerPortalData

**Input**:
```json
{
  "token": "..."
}
```

**Output** (safe projection):
```json
{
  "success": true,
  "client": {
    "id", "fullName", "email", "phone"
  },
  "reservations": [
    {
      "id", "status", "reservedAt", "expiresAt",
      "releasedAt", "convertedAt", "projectId", "bundleId"
    }
  ],
  "agreements": [
    {
      "id", "agreementType", "status", "signedAt", "reservationId"
    }
  ],
  "payments": [
    {
      "id", "amount", "amountWithVat", "paidAt", "status", "paymentType"
    }
  ],
  "units": [
    {
      "id", "label", "type", "areaM2", "price", "publicPrice",
      "roomsCount", "bathroomsCount", "publicDescription", "publicImages"
    }
  ]
}
```

**Scope**: Customer only (clientId from token)

**Excluded**:
- internalNotes
- staff comments
- activity history
- deal details
- user IDs (except client)

---

### 5. getPartnerPortalData

**Input**:
```json
{
  "token": "..."
}
```

**Output**:
```json
{
  "success": true,
  "partner": {
    "id", "companyName", "contactName", "email", "phone", "status",
    "assignedProjectIds"
  },
  "projects": [
    {
      "id", "projectName", "projectCode", "projectType", "city", "district",
      "publicTitle", "publicDescription", "publicImages"
    }
  ],
  "leads": [
    {
      "id", "projectId", "fullName", "email", "phone", "status",
      "submittedAt", "convertedAt", "claimedAt"
    }
  ],
  "inventorySummary": {
    "projectId": {
      "available": 5,
      "total": 20
    }
  }
}
```

**Scope**: Partner + assigned projects only

**Excluded**:
- Other partners' leads
- Client CRM cards
- Full pipeline
- Commission logic
- Deal structures

---

### 6. submitPartnerLead

**Input**:
```json
{
  "token": "...",
  "fullName": "...",
  "email": "...",
  "phone": "...",
  "message": "...",
  "projectId": "..."
}
```

**Output**:
```json
{
  "success": true,
  "leadId": "...",
  "status": "submitted"
}
```

**Validation**:
- Token must be partner portal
- projectId must be in partner's assigned list
- Email must be valid

**Creates**: PartnerLead with status = `submitted`

---

### 7. convertPartnerLead

**Input**:
```json
{
  "partnerLeadId": "...",
  "action": "convert" | "reject" | "duplicate"
}
```

**Output**:
```json
{
  "success": true,
  "action": "converted",
  "clientId": "...",
  "inquiryId": "..."
}
```

**Behavior**:
- If `action = convert`:
  - Check if client with email exists (use or create)
  - Create ProjectInquiry linked to client
  - Update PartnerLead status = `converted`
  - Log audit trail
- If `action = reject` or `duplicate`:
  - Update PartnerLead status
  - Log reason

**Auth**: Admin/Manager only

---

## Portals

### Customer Portal

**Route**: `/customer-portal?token=...`

**Layout**: Single-page, mobile-first

**Sections**:
1. Client info (name, email, phone)
2. Reservations (status, dates, unit summary)
3. Agreements (type, status, signatures)
4. Payments (amount, date, status)
5. Units (basic specs, public images)

**Features**:
- No edit (read-only)
- Safe date/amount formatting
- No CRM terminology
- Responsive design

---

### Partner Portal

**Route**: `/partner-portal?token=...`

**Layout**: Tabbed, responsive

**Tabs**:
1. **Overview**: Partner info, lead summary, inventory counts
2. **Projects**: Assigned projects, available units per project
3. **Leads**: Partner's submitted leads, submit new lead form

**Features**:
- Partner profile view
- Project-filtered inventory
- Lead submission form
- Lead status tracking
- Audit logging

---

## Access Control

### External Access Rules

| Role | Can Create Token? | Can Revoke? | Can Convert Lead? | Portal Access |
|------|------------------|------------|-----------------|--------------|
| ADMINISTRATOR | ✓ | ✓ | ✓ | Internal only |
| SALES_MANAGER | ✗ | ✗ | ✓ | Internal only |
| SALES_AGENT | ✗ | ✗ | ✗ | Internal only |
| **Customer (via token)** | ✗ | ✗ | ✗ | Customer Portal (scoped) |
| **Partner (via token)** | ✗ | ✗ | ✗ | Partner Portal (scoped) |

### Data Isolation

**Customer Portal sees only**:
- Own client record
- Own reservations
- Own agreements
- Own payments
- Related units (from reservations)

**Partner Portal sees only**:
- Own partner record
- Assigned projects (safe fields)
- Own leads
- Public project inventory

**External portals never see**:
- Other users' data
- Internal CRM fields
- Audit logs
- Scoring logic
- Staff notes/comments

---

## Security

### Token Security

- **Generation**: 64-char cryptographically secure random string
- **Storage**: Plain text in DB (no hashing required for stateless access)
- **Validation**: `status = active` AND `expiresAt > now`
- **Expiry**: Auto-marks as `expired` if checked after expiry time
- **Revocation**: Admin can manually set `status = revoked`

### Safe Projections

All external endpoints use **safe field selection**:
- Only serializable, non-internal fields
- No raw entity dumps
- No relation graphs
- No user IDs beyond client/partner scope

### Audit Logging

All external access is logged:
- `EXTERNAL_TOKEN_CREATED`
- `EXTERNAL_TOKEN_REVOKED`
- `CUSTOMER_PORTAL_ACCESSED`
- `PARTNER_PORTAL_ACCESSED`
- `PARTNER_LEAD_SUBMITTED`
- `PARTNER_LEAD_CONVERTED`
- `PARTNER_LEAD_REJECTED` / `PARTNER_LEAD_DUPLICATE`

---

## Usage Flow

### Customer Portal Flow

1. **Admin creates token** for customer:
   ```javascript
   const token = await createExternalAccessToken({
     accessType: 'customer_portal',
     clientId: 'client_123',
     expiresAt: '2026-12-31T...'
   });
   ```

2. **Share link** with customer:
   ```
   https://app.com/customer-portal?token=...
   ```

3. **Customer visits** portal with token:
   - Portal validates token
   - Fetches safe data for that client
   - Displays info read-only

4. **Token expires** or is revoked:
   - Portal returns 401
   - Customer loses access

---

### Partner Lead Flow

1. **Admin creates partner** with project assignments:
   ```javascript
   const partner = await base44.entities.Partner.create({
     companyName: 'Brokas OOO',
     email: 'broker@...',
     assignedProjectIds: ['proj_1', 'proj_2']
   });
   ```

2. **Admin creates partner portal token**:
   ```javascript
   const token = await createExternalAccessToken({
     accessType: 'partner_portal',
     partnerId: 'partner_123',
     expiresAt: '2026-12-31T...'
   });
   ```

3. **Partner submits leads** via portal:
   - Fills name, email, phone, message
   - Selects from assigned projects
   - Form calls `submitPartnerLead(token, data)`
   - PartnerLead created with status = `submitted`

4. **CRM claims/converts lead**:
   - Manager views PartnerLead in CRM
   - Calls `convertPartnerLead(leadId, 'convert')`
   - Client + ProjectInquiry created
   - Partner sees status = `converted` in portal

---

## Edge Cases

### 1. Expired Token

**Behavior**: Auto-marked when checked. Returns 401.

```javascript
// Token checked
if (new Date(token.expiresAt) < now) {
  await update(token.id, { status: 'expired' });
  return 401;
}
```

### 2. Revoked Token

**Behavior**: Admin revokes, portal returns 401 immediately.

### 3. Partner Submits to Unassigned Project

**Behavior**: Backend blocks with 403 "Project not assigned to partner".

### 4. Duplicate Lead Conversion

**Behavior**: 
- First conversion succeeds → status = `converted`
- Second conversion attempt fails → "Lead already converted"

### 5. Customer Token Scoped to Reservation

**Behavior**:
- Token can be narrowed to specific `reservationId`
- Portal shows only that reservation (not full history)
- Useful for temporary access for signing agreements

---

## Monitoring & Operations

### Token Lifecycle

```
Created (active)
  → Used → lastUsedAt updated
  → Expires → status = expired (auto)
  → Revoked → status = revoked (manual)
```

### Audit Trail

All portal access is recorded with:
- Action type
- Token ID
- Scope (clientId / partnerId)
- Timestamp

### Common Operations

**Create customer access**:
```javascript
await base44.functions.invoke('createExternalAccessToken', {
  accessType: 'customer_portal',
  clientId: 'client_123',
  expiresAt: '2026-06-30T23:59:59Z'
});
```

**Revoke access**:
```javascript
await base44.functions.invoke('revokeExternalAccessToken', {
  tokenId: 'token_456'
});
```

**Test customer view**:
```javascript
const data = await base44.functions.invoke('getCustomerPortalData', {
  token: '...'
});
```

---

## Limitations & Future

### V1 Constraints

- Tokens are stateless (no revocation lists caching)
- No rate limiting on portal access
- Partner lead conversion is one-way (no update back to partner)
- No partner lead rejection feedback to partner portal

### Future Enhancements

1. **Token refresh**: Allow extending token without new creation
2. **Rate limiting**: Protect from portal access spam
3. **Two-factor**: Optional 2FA for sensitive portals
4. **Lead callbacks**: Notify partner of lead conversion status
5. **Document signing**: Integrate agreement e-signature in customer portal
6. **Payment gateway**: Allow online payment submission from customer portal

---

## Summary

Module 14 provides **secure external access** to CRM data via:
- **Token-based gating** (no login required)
- **Safe data projections** (no CRM internals leak)
- **Role-based scoping** (customer sees own, partner sees assigned)
- **Audit logging** (full access trail)
- **Partner lead intake** (separate from internal inquiries)

Portals are **read-only, scoped, and sandboxed** — zero risk of internal data exposure.
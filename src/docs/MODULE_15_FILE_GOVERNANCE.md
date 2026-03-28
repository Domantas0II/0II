# MODULE 15: FILES & DOCUMENTS GOVERNANCE

## Tikslas

Sukurti pilną failų ir dokumentų valdymo sluoksnį visai sistemai su:
- Centralizuotu FileAsset modeliu
- Granular access control
- Safe external file exposure
- Versioning ir statusų kontrolė
- Vidinių/išorinių failų atskyrimas

## Entities

### FileAsset
- Central attachment registry
- Kontekstas: projectId, unitId, reservationId, agreementId, paymentId, dealId, clientId
- Visibility: internal, customer_safe, partner_safe, public
- Status: draft, active, archived, replaced
- Versioning: versionNumber, replacesFileAssetId
- Media control: isPrimary, displayOrder

**KRITINIS**: Visi attachmentai turi eiti per FileAsset, ne direct fileUrl mėtimas entity laukuose.

### FileAccessGrant
- Granular access modelis
- accessType: customer_token, partner_token, internal_user
- Optional expiry valdymas

## Backend Functions

### createFileAsset
- Validuoja context egzistenciją
- Validuoja visibility compatibility
- Validuoja fileUrl
- Sukuria FileAsset su draft statusu
- Logina FILE_UPLOADED

### updateFileAsset
- Leidžia keisti: title, description, tags, visibility, status, isPrimary, displayOrder
- Validuoja status transitions
- Neleičia keisti replaced failo statusą

### archiveFileAsset
- status = archived
- Neleičia archyvinti replaced failo

### replaceFileAsset
- Seną: status = replaced
- Naują: versionNumber +1, replacesFileAssetId = old.id, status = active
- Logina FILE_REPLACED

### getContextFiles
- Input: projectId / unitId / reservationId / agreementId / paymentId / dealId / clientId
- Output: tik aktyvūs (ir draft) failai tame kontekste
- Filtruojama: category, assetType, visibility
- Sortavimas: isPrimary DESC, displayOrder ASC
- Limit: 100 failų

### getExternalFilesByToken
**KRITINIS SECURITY**:
- Validuoja ExternalAccessToken (egzist + active + !expired)
- Automatiškai update: lastUsedAt
- Gražina TIKAI:
  - visibility = 'customer_safe' arba 'partner_safe' (NEVER internal)
  - status = 'active' (NEVER archived/replaced)
  - clientId arba partnerId match tokenRecord scope
  - Limitavimas: 50 failų
- Logina EXTERNAL_FILES_ACCESSED

### grantFileAccess
- Admin-only
- Sukuria FileAccessGrant
- Logina FILE_ACCESS_GRANTED

### revokeFileAccess
- Admin-only
- status = revoked, revokedAt = now
- Logina FILE_ACCESS_REVOKED

## Components

### FileLibrary
- Globalus failų puslapis
- Kontekstas selectablus
- Filtrai: category, assetType, visibility, status
- Pagrindinės operacijos: upload, archive, replace, copy link

### FileUploadForm
- Drag-and-drop file input
- Metadata: title, description, category, assetType, visibility, isPrimary
- Integration su Base44 UploadFile
- Automatinis title iš fileName jei nenurodtas

### FileCard
- Metadata display: title, category, assetType, version, size
- Visibility badge, status badge
- Primary indicator (⭐)
- Actions: copy URL, archive, replace, delete

## Access Control

### Internal Users
- **ADMINISTRATOR**: full access
- **SALES_MANAGER**: access savo matomumo ribose
- **SALES_AGENT**: access savo projektų/klientų/rezervacijų scope ribose
- **PROJECT_DEVELOPER**: read-only safe projektų dokumentams

### External Tokens
- **customer_safe**: tik via customer_portal token, tik clientId scope
- **partner_safe**: tik via partner_portal token, tik partnerId scope
- **public**: jokio token required, bet tik viešus failure

## Validation Rules

**PRIVALOMA**:
- Bent vienas context turi būti (projectId || unitId || ... || clientId)
- visibility turi būti compatible su kontekstu
- fileUrl negali būti tuščias
- archived/replaced failai neigiau default listuose
- external token NIEKADA negali gauti internal failų

**NELEISTINA**:
- Attachinti neegzistuojančiam kontekstui
- External-safe failą, jei context nesuderinamas
- Rodyti archived/replaced kaip active
- Crossover: customer gauna partner file arba atvirkščiai

## File Categories

**Project**:
- project_general: bendri dokumentai
- project_legal: teisiniai
- project_marketing: marketingo medžiaga

**Unit**:
- unit_gallery: galerija
- unit_floorplan: floorplan
- unit_technical: techniniai attachment

**Transactions**:
- reservation_attachment: rezervacijos priedai
- agreement_attachment: sutarties failai
- payment_proof: mokėjimo patvirtinamasis
- deal_attachment: deal dokumentai

**External**:
- portal_attachment: customer/partner portal safe

## Versioning Strategy

Failų pakeičiamos:
```
Old File → status: 'replaced'
         → archived automatiškai iš UI (optional)

New File → versionNumber: old.versionNumber + 1
        → replacesFileAssetId: old.id
        → status: 'active'
```

Versijų istorija:
- Matyti per getContextFiles + versionNumber filtravimą
- Arba per replacesFileAssetId grandinę

## External File Exposure

**Customer Portal**:
- Gali matyti tik customer_safe failus
- Tik jei fileAssetId įtrauktas į grant arba context = clientId
- Pavyzdžiai: sutarties kopija, payment proof summary

**Partner Portal**:
- Gali matyti tik partner_safe failus
- Tik jei context = partnerId
- Pavyzdžiai: marketing media, floorplan, ribota projekto biblioteka

**Public Website**:
- Tik public failai
- NIEKADA internal / customer_safe / partner_safe

## Performance Notes

- Context file list filteruojamas query lygyje
- Resultai limited (100 internal, 50 external)
- Thumbnails naudojami media preview
- No full file list without filters
- External endpoints yra siauri ir saugūs

## Audit Logging

Loginamos operacijos:
- FILE_UPLOADED: file + context + visibility
- FILE_UPDATED: file + changes
- FILE_ARCHIVED: file + user
- FILE_REPLACED: old + new + version
- FILE_ACCESS_GRANTED: file + grant + expiry
- FILE_ACCESS_REVOKED: grant + file
- EXTERNAL_FILES_ACCESSED: token + count

## Known Limitations

**NEDARYTI**:
- Full document editor
- E-sign workflow
- OCR / auto-classification
- Invoice management / receipt scanning
- Unrestricted file sharing
- Raw storage browser
- Direct HTML/JS embedding

**TIKTAI**:
- File governance
- Attachments
- Safe access
- Versioning
- Media control

## Integration Checklist

- [ ] FileAsset entity sukurta
- [ ] FileAccessGrant entity sukurta
- [ ] Backend functions deployed (create/update/archive/replace/grant/revoke/getContext/getExternal)
- [ ] FileLibrary komponentas integruotas į reikalingus puslapius
- [ ] ProjectDetail: ProjectFilesBlock (category: project_*)
- [ ] UnitDetail: UnitFilesBlock (category: unit_*)
- [ ] ReservationDetail: ReservationFilesBlock
- [ ] AgreementDetail: AgreementFilesBlock
- [ ] PaymentList: PaymentFilesBlock
- [ ] DealsList: DealFilesBlock
- [ ] CustomerPortal: external safe files endpoint
- [ ] PartnerPortal: external safe files endpoint
- [ ] AuditLog entries aktivuotos

## Testing Scenarios

1. **Upload file** → FileAsset sukurtas su draft statusu
2. **Update metadata** → changes persisted
3. **Archive active file** → status changed
4. **Replace file** → old marked replaced, new created with +1 version
5. **Customer token access** → customer_safe failus randasi, internal nuo
6. **Partner token access** → partner_safe failus randasi, customer_safe/internal nuo
7. **Expired token** → 401, no file leak
8. **Cross-context access attempt** → blocked (customer gauna customer context only)

## Future Enhancements

- Bulk file operations
- Advanced search (full-text)
- File previewer (PDF, images, etc)
- Batch versioning
- Automated media optimization
- Digital signature integration
- Document expiry notifications
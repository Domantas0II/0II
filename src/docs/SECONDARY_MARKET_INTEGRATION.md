# Antrinės Rinkos Branduolys

## Integracijos Žingsnis po Žingsnio

### 1. Egzistuojančias Entities Atnaujinimas

Šioms entities reikalinga pridėti `marketType` lauką:

```json
"marketType": {
  "type": "string",
  "enum": ["primary", "secondary"],
  "default": "primary",
  "description": "Rinkos tipas"
}
```

**Entities (7):**
- `ProjectInquiry` - Paieškos/kontaktai iš antrinės rinkos
- `ClientProjectInterest` - Susidomėjimas antrinės rinkos objektais
- `Reservation` - Antrinės rinkos objekto rezervacija
- `Agreement` - Antrinės rinkos sutartis
- `Deal` - Antrinės rinkos sandoris
- `Commission` - Antrinės rinkos komisinis
- `Payout` - Antrinės rinkos išmoka

**Implementacija:**
Jei entity file yra `entities/Reservation.json`, pridėti lauką į `properties`:

```bash
# Kiekvienai iš 7 entities:
src/entities/{EntityName}.json → pridėti marketType property
```

---

## 2. Naujosios Entities

### SecondaryObject
- **Tikslas:** Antrinės rinkos nekilnojamasis turtas
- **Failas:** `src/entities/SecondaryObject.json` ✅
- **Pagrindiniai laukai:**
  - Core: title, address, city, district, propertyType, rooms, area, floor, price, status
  - Komisinis: serviceType='sale', commissionType, commissionPercent, commissionFixedAmount, vatMode
  - Media: mainImage, images[], floorPlans[], galleryOrder
  - Metadata: isExclusive, isActive, sourceType, assignedAgentUserId, sellerClientId

### SecondaryBuyerProfile
- **Tikslas:** Pirkėjo poreikiai ir parametrai
- **Failas:** `src/entities/SecondaryBuyerProfile.json` ✅
- **Pagrindiniai laukai:**
  - Poreikiai: city, district, propertyType, rooms, area, floor, budgetMin, budgetMax, condition, parking, deadline, financingStatus
  - Komisinis: serviceType='search', commissionType, commissionPercent, negotiationBonusPercent, fixedFee

---

## 3. Access Control (`lib/secondaryMarketAccess.js`) ✅

Implementuotos funkcijos:

| Funkcija | Nuomos | Kasus |
|----------|--------|-------|
| `canViewSecondaryObject` | Admin, Manager, Assigned Agent | Objekto peržiūra |
| `canEditSecondaryObject` | Admin, Manager, Assigned Agent | Objekto redagavimas |
| `canViewSellerData` | Owner, Admin, Manager | Pardavėjo duomenys (konfidencialus) |
| `canViewCommissionData` | Owner, Admin, Manager | Komisinio duomenys |
| `canViewMediaGallery` | Admin, Manager, User | Visos nuotraukos ir planai |
| `canViewBuyerProfile` | Assigned Agent, Admin, Manager | Pirkėjo profilis |
| `canEditBuyerProfile` | Assigned Agent, Admin, Manager | Pirkėjo profilio redagavimas |
| `canViewBuyerCommission` | Owner, Admin, Manager | Pirkėjo komisinis |
| `isSecondaryMarketEntity` | - | Tikrina ar entity yra secondary |

---

## 4. Validacija (`lib/secondaryValidation.js`) ✅

### Validacinės Funkcijos

1. **`validateSecondaryReservation()`**
   - ✓ Objektas egzistuoja
   - ✓ Pirkėjo profilis egzistuoja
   - ✓ Objekto statusas = 'available'
   - ✓ Kaina ≤ biudžeto maksimumas

2. **`validateSecondaryAgreement()`**
   - ✓ Sutartis susieta su rezervacija
   - ✓ Sutartis susieta su objektu
   - ✓ Tipas: 'preliminary' arba 'reservation'

3. **`validateSecondaryDeal()`**
   - ✓ Sutartis yra pasirašyta
   - ✓ Sandoris susietas su objektu
   - ✓ Suma teigiama
   - ⚠️ Suma = objekto kaina (warning)

4. **`validateSecondaryCommission()`**
   - ✓ Komisinis susietas su sandoriu
   - ✓ Komisinis susietas su objektu
   - ✓ Komisinio parametrai nustatyti

5. **`validateSecondaryObjectCreation()`**
   - ✓ Visi privalomai laukai
   - ✓ Komisinio nustatymai (% arba suma)

6. **`validateBuyerProfileCreation()`**
   - ✓ Kliento ID
   - ✓ Turto tipas
   - ✓ Biudžeto diapazonas logiškas

---

## 5. Implementacijos Čeklistis

- [x] SecondaryObject entity sukurtas
- [x] SecondaryBuyerProfile entity sukurtas
- [x] Access control funkcijos
- [x] Validacijos funkcijos
- [ ] **TODO:** Atnaujinti 7 entities su `marketType` lauku (jei reikalinga daryti per UI)
- [ ] **TODO:** Frontend komponentai objektams ir profiliams
- [ ] **TODO:** Backend funkcijos (createSecondaryDeal, etc.)
- [ ] **TODO:** Integration tarpusavyje su primary rinka

---

## 6. Naudojimas Frontend'e

```javascript
import { canViewSellerData, isSecondaryMarketEntity } from '@/lib/secondaryMarketAccess';
import { validateSecondaryReservation } from '@/lib/secondaryValidation';

// Prieigos tikrinimas
if (canViewSellerData(currentUser, secondaryObject)) {
  // Parodyti pardavėjo duomenis
}

// Validacija
const { valid, errors } = validateSecondaryReservation(reservation, object, buyer);
if (!valid) {
  errors.forEach(err => toast.error(err));
}
```

---

## 7. Duomenų Modelis - Sandorio Grandinė

```
SecondaryObject (objektas)
  ↓
SecondaryBuyerProfile (pirkėjas)
  ↓
Reservation (marketType='secondary')
  ↓
Agreement (marketType='secondary', status='signed')
  ↓
Deal (marketType='secondary')
  ↓
Commission (marketType='secondary') × 2
  ├─ Pardavėjo komisinis (seller side)
  └─ Pirkėjo komisinis (buyer side)
  ↓
Payout (marketType='secondary')
```

Kiekvienas žingsnis validuojamas prieš kuriamą sekančią entitetą.
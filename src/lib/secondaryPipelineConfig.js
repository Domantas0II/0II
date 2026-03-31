/**
 * Secondary Market Pipeline Configuration
 * Defines exact status flows for objects and buyer profiles
 */

export const SECONDARY_OBJECT_STATUSES = {
  new_object: {
    key: 'new_object',
    label: 'Naujas objektas',
    category: 'preparation',
    nextStatuses: ['preparing', 'inactive'],
    description: 'Objektas tik įvestas į sistemą'
  },
  preparing: {
    key: 'preparing',
    label: 'Ruošimas',
    category: 'preparation',
    nextStatuses: ['active', 'inactive'],
    description: 'Objekto duomenys tvarkomi ir medžiaga ruošiama'
  },
  active: {
    key: 'active',
    label: 'Aktyvus',
    category: 'marketing',
    nextStatuses: ['not_advertised', 'advertised', 'inactive'],
    description: 'Objektas paruoštas ir gali būti skelbtas'
  },
  not_advertised: {
    key: 'not_advertised',
    label: 'Neskelbtas',
    category: 'marketing',
    nextStatuses: ['advertised', 'active', 'inactive'],
    description: 'Objektas aktyvus, bet nėra viešai skelbtas'
  },
  advertised: {
    key: 'advertised',
    label: 'Skelbtas',
    category: 'marketing',
    nextStatuses: ['negotiation', 'not_advertised', 'inactive'],
    description: 'Objektas viešai skelbtas ir ieškomi pirkėjai'
  },
  negotiation: {
    key: 'negotiation',
    label: 'Derybos',
    category: 'sales',
    nextStatuses: ['documents_check', 'advertised', 'inactive'],
    description: 'Vyksta derybos su potencialiu pirkėju'
  },
  documents_check: {
    key: 'documents_check',
    label: 'Dokumentų patikra',
    category: 'sales',
    nextStatuses: ['reserved', 'negotiation', 'inactive'],
    description: 'Tikrinami dokumentai ir teisinė padėtis'
  },
  reserved: {
    key: 'reserved',
    label: 'Rezervuota',
    category: 'sales',
    nextStatuses: ['preliminary_agreement', 'documents_check', 'inactive'],
    description: 'Objektas rezevuotas pirkėjui'
  },
  preliminary_agreement: {
    key: 'preliminary_agreement',
    label: 'Preliminari sutartis',
    category: 'sales',
    nextStatuses: ['documents_preparing', 'reserved', 'inactive'],
    description: 'Pasirašyta preliminari sutartis'
  },
  documents_preparing: {
    key: 'documents_preparing',
    label: 'Dokumentų rengimas',
    category: 'closing',
    nextStatuses: ['waiting_closing', 'preliminary_agreement', 'inactive'],
    description: 'Rengiami galutinės sutarties dokumentai'
  },
  waiting_closing: {
    key: 'waiting_closing',
    label: 'Laukiama užbaigimo',
    category: 'closing',
    nextStatuses: ['sold', 'documents_preparing', 'inactive'],
    description: 'Dokumentai paruošti, laukiama galutinio pasirašymo'
  },
  sold: {
    key: 'sold',
    label: 'Parduota',
    category: 'completed',
    nextStatuses: ['mortgage', 'handover'],
    description: 'Objektas parduotas, sutartis pasirašyta'
  },
  mortgage: {
    key: 'mortgage',
    label: 'Hipoteka',
    category: 'completed',
    nextStatuses: ['handover', 'receipt'],
    description: 'Hipoteka pagal sutartį'
  },
  handover: {
    key: 'handover',
    label: 'Perdavimas',
    category: 'completed',
    nextStatuses: ['receipt'],
    description: 'Objektas fiziškai perduodamas pirkėjui'
  },
  receipt: {
    key: 'receipt',
    label: 'Priėmimas',
    category: 'completed',
    nextStatuses: [],
    description: 'Pirkėjas priėmė objektą'
  },
  inactive: {
    key: 'inactive',
    label: 'Neaktyvus',
    category: 'inactive',
    nextStatuses: ['active', 'new_object'],
    description: 'Objektas laikinai arba nuolat deaktyvuotas'
  }
};

export const SECONDARY_BUYER_STATUSES = {
  new_buyer: {
    key: 'new_buyer',
    label: 'Naujas pirkėjas',
    category: 'initiation',
    nextStatuses: ['active_search', 'not_relevant'],
    description: 'Pirkėjas tik įvestas į sistemą'
  },
  active_search: {
    key: 'active_search',
    label: 'Aktyvi paieška',
    category: 'search',
    nextStatuses: ['negotiation', 'not_relevant'],
    description: 'Pirkėjas aktyviai ieško būsto'
  },
  negotiation: {
    key: 'negotiation',
    label: 'Derybos',
    category: 'sales',
    nextStatuses: ['financing_check', 'valuation', 'active_search', 'not_relevant'],
    description: 'Vyksta derybos dėl konkretaus objekto'
  },
  financing_check: {
    key: 'financing_check',
    label: 'Finansavimo patikra',
    category: 'sales',
    nextStatuses: ['valuation', 'reservation', 'negotiation', 'not_relevant'],
    description: 'Tikrinama pirkėjo finansavimo galimybė'
  },
  valuation: {
    key: 'valuation',
    label: 'Vertinimas',
    category: 'sales',
    nextStatuses: ['reservation', 'financing_check', 'not_relevant'],
    description: 'Objektas vertinamas'
  },
  reservation: {
    key: 'reservation',
    label: 'Rezervacija',
    category: 'sales',
    nextStatuses: ['preliminary_agreement', 'financing_check', 'not_relevant'],
    description: 'Objektas rezevuotas pirkėjui'
  },
  preliminary_agreement: {
    key: 'preliminary_agreement',
    label: 'Preliminari sutartis',
    category: 'sales',
    nextStatuses: ['documents_preparing', 'reservation', 'not_relevant'],
    description: 'Pasirašyta preliminari sutartis'
  },
  documents_preparing: {
    key: 'documents_preparing',
    label: 'Dokumentų rengimas',
    category: 'closing',
    nextStatuses: ['waiting_closing', 'preliminary_agreement', 'not_relevant'],
    description: 'Rengiami galutinės sutarties dokumentai'
  },
  waiting_closing: {
    key: 'waiting_closing',
    label: 'Laukiama užbaigimo',
    category: 'closing',
    nextStatuses: ['purchased', 'documents_preparing', 'not_relevant'],
    description: 'Dokumentai paruošti, laukiama galutinio pasirašymo'
  },
  purchased: {
    key: 'purchased',
    label: 'Pirkytas',
    category: 'completed',
    nextStatuses: ['mortgage', 'handover'],
    description: 'Pirkėjas pirko objektą, sutartis pasirašyta'
  },
  mortgage: {
    key: 'mortgage',
    label: 'Hipoteka',
    category: 'completed',
    nextStatuses: ['handover', 'receipt'],
    description: 'Hipoteka pagal sutartį'
  },
  handover: {
    key: 'handover',
    label: 'Perdavimas',
    category: 'completed',
    nextStatuses: ['receipt'],
    description: 'Objektas fiziškai perduodamas pirkėjui'
  },
  receipt: {
    key: 'receipt',
    label: 'Priėmimas',
    category: 'completed',
    nextStatuses: [],
    description: 'Pirkėjas priėmė objektą'
  },
  not_relevant: {
    key: 'not_relevant',
    label: 'Nerelevantus',
    category: 'inactive',
    nextStatuses: ['active_search'],
    description: 'Pirkėjas pasigavo kitaip arba nėra daugiau suinteresuotas'
  }
};

export function getObjectStatusLabel(status) {
  return SECONDARY_OBJECT_STATUSES[status]?.label || status;
}

export function getBuyerStatusLabel(status) {
  return SECONDARY_BUYER_STATUSES[status]?.label || status;
}

export function canTransitionObjectStatus(fromStatus, toStatus) {
  const current = SECONDARY_OBJECT_STATUSES[fromStatus];
  if (!current) return false;
  return current.nextStatuses.includes(toStatus);
}

export function canTransitionBuyerStatus(fromStatus, toStatus) {
  const current = SECONDARY_BUYER_STATUSES[fromStatus];
  if (!current) return false;
  return current.nextStatuses.includes(toStatus);
}

/**
 * Get all statuses by category
 */
export function getObjectStatusesByCategory(category) {
  return Object.values(SECONDARY_OBJECT_STATUSES).filter(s => s.category === category);
}

export function getBuyerStatusesByCategory(category) {
  return Object.values(SECONDARY_BUYER_STATUSES).filter(s => s.category === category);
}

/**
 * Pipeline stage categories
 */
export const PIPELINE_CATEGORIES = {
  preparation: 'Ruošimas',
  marketing: 'Marketingas',
  sales: 'Pardavimas',
  closing: 'Užbaigimas',
  completed: 'Atlikta',
  initiation: 'Pradžia',
  search: 'Paieška',
  inactive: 'Neaktyvu'
};
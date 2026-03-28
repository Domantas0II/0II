export const PROJECT_TYPE_LABELS = {
  apartment_project: 'Daugiabučiai',
  house_project: 'Namai',
  townhouse_project: 'Kotedžas',
  mixed_residential: 'Mišrus gyvenamasis',
};

export const PROJECT_STAGE_LABELS = {
  design: 'Projektavimas',
  permit: 'Leidimai',
  partial_finish: 'Dalinis įrengimas',
  full_finish: 'Pilnas įrengimas',
};

export const LIFECYCLE_LABELS = {
  draft: 'Juodraštis',
  internal_ready: 'Paruoštas viduje',
  public_ready: 'Paruoštas viešai',
  published: 'Paskelbtas',
  archived: 'Archyvuotas',
};

export const LIFECYCLE_COLORS = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  internal_ready: 'bg-blue-50 text-blue-700 border-blue-200',
  public_ready: 'bg-amber-50 text-amber-700 border-amber-200',
  published: 'bg-green-50 text-green-700 border-green-200',
  archived: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const BUILDING_TYPE_LABELS = {
  brick: 'Plytinis',
  block: 'Blokinis',
  monolithic: 'Monolitinis',
  wood: 'Medinis',
  other: 'Kita',
};

export const HEATING_TYPE_LABELS = {
  central: 'Centrinis',
  gas: 'Dujos',
  electric: 'Elektrinis',
  air_source: 'Oro šilumos siurblys',
  geothermal: 'Geotermalinis',
  other: 'Kita',
};

export const INSTALLATION_STATUS_LABELS = {
  fully_finished: 'Pilnai įrengtas',
  partial_finish: 'Dalinis įrengimas',
  not_finished: 'Neįrengtas',
};

export const ENERGY_CLASS_LABELS = {
  A_plus_plus: 'A++',
  A_plus: 'A+',
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  other: 'Kita',
};

export const UNIT_TYPE_LABELS = {
  apartment: 'Butas',
  house: 'Namas',
  townhouse: 'Kotedžas',
};

export const STRUCTURE_MODEL_LABELS = {
  none: 'Be struktūros',
  buildings: 'Korpusai',
  sections: 'Sekcijos',
  phases: 'Etapai',
  mixed: 'Mišrus',
};

export const COMPONENT_LABELS = {
  land: 'Žemė',
  parking: 'Parkavimas',
  storage: 'Sandėlis',
};

export const LAND_TYPE_LABELS = {
  private: 'Privati',
  usage_defined: 'Naudojimo teisė',
  shared_part: 'Bendra dalis',
};

export const PARKING_PLACEMENT_LABELS = {
  surface: 'Paviršinis',
  underground: 'Požeminis',
};

export const PARKING_TYPE_LABELS = {
  standard: 'Standartinis',
  ev: 'Elektromobiliams',
  accessible: 'Neįgaliesiems',
};

export const ADVANCE_TYPE_LABELS = {
  percent: 'Procentais',
  fixed_amount: 'Fiksuota suma',
};

export const COMMISSION_VAT_LABELS = {
  with_vat: 'Su PVM',
  without_vat: 'Be PVM',
};

export const WIZARD_STEPS = [
  { id: 'base', label: 'Bazė', shortLabel: '1' },
  { id: 'inventory', label: 'Inventorius', shortLabel: '2' },
  { id: 'components', label: 'Dedamosios', shortLabel: '3' },
  { id: 'technical', label: 'Techniniai', shortLabel: '4' },
  { id: 'financial', label: 'Finansai', shortLabel: '5' },
  { id: 'process', label: 'Procesas', shortLabel: '6' },
  { id: 'review', label: 'Apžvalga', shortLabel: '7' },
];

// Which steps are "critical" for internal_ready
// VISOS 5 sekcijos yra kritinės: base, inventory, components, financial, process
export const CRITICAL_BLOCKS = ['base', 'inventory', 'components', 'financial', 'process'];
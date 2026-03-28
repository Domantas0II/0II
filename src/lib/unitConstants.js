export const UNIT_TYPE_LABELS = {
  apartment: 'Butas',
  house: 'Namas',
  townhouse: 'Kotedžas',
};

export const UNIT_STATUS_LABELS = {
  available: 'Laisvas',
  reserved: 'Rezervuotas',
  sold: 'Parduotas',
  withheld: 'Sulaikytas',
  developer_reserved: 'Vystytojo rezervas',
};

export const UNIT_STATUS_COLORS = {
  available: 'bg-green-50 text-green-700 border-green-200',
  reserved: 'bg-amber-50 text-amber-700 border-amber-200',
  sold: 'bg-slate-100 text-slate-500 border-slate-200',
  withheld: 'bg-orange-50 text-orange-700 border-orange-200',
  developer_reserved: 'bg-blue-50 text-blue-700 border-blue-200',
};

export const COMPONENT_TYPE_LABELS = {
  land: 'Žemė',
  parking: 'Parkavimas',
  storage: 'Sandėlis',
};

export const COMPONENT_STATUS_LABELS = {
  available: 'Laisva',
  reserved: 'Rezervuota',
  sold: 'Parduota',
  withheld: 'Sulaikyta',
};

export const WINDOW_DIRECTION_LABELS = {
  north: 'Šiaurė',
  south: 'Pietūs',
  east: 'Rytai',
  west: 'Vakarai',
};

export const PARKING_PLACEMENT_LABELS = {
  surface: 'Paviršinis',
  underground: 'Požeminis',
};

export const PARKING_USE_TYPE_LABELS = {
  standard: 'Standartinis',
  ev: 'Elektromobiliams',
  accessible: 'Neįgaliesiems',
};

export const LAND_TYPE_LABELS = {
  private: 'Privati',
  usage_defined: 'Naudojimo teisė',
  shared_part: 'Bendra dalis',
};

export const CAN_MANAGE_UNITS = ['ADMINISTRATOR', 'SALES_MANAGER'];
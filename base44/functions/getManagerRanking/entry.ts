import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * getManagerRanking — Vadybininkų reitingavimo backend funkcija
 *
 * SOURCE-OF-TRUTH (manager):
 *   1. Agreement.soldByUserId (jei užpildytas)
 *   2. Fallback: Reservation.reservedByUserId (per reservationId ryšį)
 *   Niekada nenaudojamas createdByUserId — tai techninis laukas.
 *
 * REITINGUOJAMI VARTOTOJAI:
 *   Tik aktyvūs (nėra disabled/pending) vartotojai su rolėmis:
 *   SALES_AGENT arba SALES_MANAGER
 *
 * DATŲ LOGIKA:
 *   - Sutartiniams vienetams: Agreement.signedAt (ISO 8601 UTC)
 *   - Veikloms: Activity.completedAt (ISO 8601 UTC), fallback scheduledAt, tada created_date
 *   - Metų riba: sausio 1 00:00:00 UTC — gruodžio 31 23:59:59 UTC
 *   - Mėnesio riba: mėnesio 1 00:00:00 UTC — paskutinė diena 23:59:59 UTC
 *
 * DEDUP LOGIKA (sutartiniai vienetai):
 *   - Per metus kiekvienas unitId skaičiuojamas TIK VIENĄ KARTĄ
 *   - Taškas skiriamas tam vadybininkui, kuris pirmasis pasirašė sutartį šiam unitId metais
 *   - Mėnesio reitingui: taškas įskaičiuojamas TIK TĄ MĖNESĮ, kai įvyko pirmasis metų įvykis
 *
 * RIKIAVIMAS:
 *   1. uniqueAgreementUnits DESC
 *   2. meetingsCount DESC (consultation + visit)
 *   3. callsCount DESC
 *   4. agentName ASC (deterministinis tiebreak)
 *   Lygioms vietoms: rankPosition vienodas (dense rank)
 *
 * REŽIMAI:
 *   - mode: 'year'              → metų reitingas (vienas skaičiavimo ciklas)
 *   - mode: 'month'             → konkretaus mėnesio reitingas
 *   - mode: 'monthly_breakdown' → OPTIMIZUOTA: 1x fetch metų duomenų, grupavimas JS lygyje
 */

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

// Rolės, kurios gali būti reitinguojamos.
// ADMINISTRATOR įtrauktas: mažose komandose adminas gali tiesiogiai pardavinėti.
// Išfiltruojami tik sisteminiai/techniniai vartotojai (is_service = true).
const RANKABLE_ROLES = new Set(['SALES_AGENT', 'SALES_MANAGER', 'ADMINISTRATOR']);

/**
 * Paimti visus metų duomenis vienu sluoksniu.
 * Grąžina: { enrichedAgreements, unitFirstEvent, allActivities, userMap, rankableUserIds }
 */
async function fetchYearData(base44, yearStart, yearEnd, projectId) {
  // --- Vartotojai ---
  const users = await base44.asServiceRole.entities.User.list();
  const userMap = {};
  const rankableUserIds = new Set();
  (users || []).forEach(u => {
    userMap[u.id] = u;
    const role = normalizeRole(u.role);
    // Filtras: leidžiamos rolės, nėra disabled, nėra sisteminių vartotojų
    if (RANKABLE_ROLES.has(role) && !u.disabled && !u.is_service) {
      rankableUserIds.add(u.id);
    }
  });

  // --- Sutartys (visi metai) ---
  const agreementFilter = { status: 'signed' };
  if (projectId) agreementFilter.projectId = projectId;
  const allAgreements = await base44.asServiceRole.entities.Agreement.filter(agreementFilter);

  const validAgreements = (allAgreements || []).filter(a =>
    ['reservation', 'preliminary'].includes(a.agreementType) &&
    a.signedAt &&
    new Date(a.signedAt) >= yearStart &&
    new Date(a.signedAt) <= yearEnd
  );

  // --- Rezervacijos (vienu fetch per visus reikalingus IDs) ---
  const reservationIds = [...new Set(validAgreements.map(a => a.reservationId).filter(Boolean))];
  let reservationMap = {};
  if (reservationIds.length > 0) {
    const reservations = await base44.asServiceRole.entities.Reservation.filter({ id: { $in: reservationIds } });
    (reservations || []).forEach(r => { reservationMap[r.id] = r; });
  }

  // --- Bundle'ai (vienu fetch) ---
  const bundleIds = [...new Set(Object.values(reservationMap).map(r => r.bundleId).filter(Boolean))];
  let bundleMap = {};
  if (bundleIds.length > 0) {
    const bundles = await base44.asServiceRole.entities.ReservationBundle.filter({ id: { $in: bundleIds } });
    (bundles || []).forEach(b => { bundleMap[b.id] = b; });
  }

  // --- Sutartys: praturtintos su unitId ir managerId (source-of-truth) ---
  const enrichedAgreements = validAgreements.map(a => {
    const reservation = reservationMap[a.reservationId] || {};
    const bundle = bundleMap[reservation.bundleId] || {};

    // SOURCE-OF-TRUTH: Agreement.soldByUserId → Reservation.reservedByUserId
    const managerId = a.soldByUserId || reservation.reservedByUserId || null;

    return {
      id: a.id,
      unitId: bundle.unitId || null,
      managerId,
      signedAtDate: new Date(a.signedAt)
    };
  }).filter(a =>
    a.unitId &&
    a.managerId &&
    rankableUserIds.has(a.managerId) // tik reitinguojami vadybininkai
  );

  // --- DEDUP: per unitId → pirmasis metų įvykis ---
  // Rikiuojama didėjančiai pagal signedAt, imamas pirmasis
  const unitFirstEvent = {}; // unitId -> { managerId, date }
  [...enrichedAgreements]
    .sort((a, b) => a.signedAtDate - b.signedAtDate)
    .forEach(a => {
      if (!unitFirstEvent[a.unitId]) {
        unitFirstEvent[a.unitId] = {
          managerId: a.managerId,
          date: a.signedAtDate
        };
      }
    });

  // --- Veiklos (visi metai, vienu fetch) ---
  const actFilter = { status: 'done' };
  if (projectId) actFilter.projectId = projectId;
  const allActivitiesRaw = await base44.asServiceRole.entities.Activity.filter(actFilter);

  // Filtruoti pagal metus ir reitinguojamus vadybininkus
  const allActivities = (allActivitiesRaw || []).filter(a => {
    const d = new Date(a.completedAt || a.scheduledAt || a.created_date);
    if (d < yearStart || d > yearEnd) return false;
    // SOURCE-OF-TRUTH veikloms: soldByUserId → createdByUserId
    const mid = a.soldByUserId || a.createdByUserId;
    return mid && rankableUserIds.has(mid);
  }).map(a => ({
    ...a,
    _managerId: a.soldByUserId || a.createdByUserId,
    _date: new Date(a.completedAt || a.scheduledAt || a.created_date)
  }));

  return { userMap, rankableUserIds, unitFirstEvent, allActivities };
}

/**
 * Apskaičiuoti reitingą pagal intervalą [start, end].
 * Naudoja jau užkrautus metų duomenis (unitFirstEvent, allActivities).
 * Grąžina surikiuotą masyvą su dense rank.
 */
function computeRankingFromData({ unitFirstEvent, allActivities, userMap, rankableUserIds }, start, end) {
  // Sutartiniai vienetai: tik tie, kurių PIRMASIS metų įvykis patenka į [start, end]
  const rangeUnitsPerManager = {};
  Object.entries(unitFirstEvent).forEach(([unitId, ev]) => {
    if (ev.date >= start && ev.date <= end) {
      if (!rangeUnitsPerManager[ev.managerId]) rangeUnitsPerManager[ev.managerId] = new Set();
      rangeUnitsPerManager[ev.managerId].add(unitId);
    }
  });

  // Veiklos: filtruoti pagal intervalą
  const meetingsPerManager = {};
  const callsPerManager = {};
  allActivities.forEach(a => {
    if (a._date < start || a._date > end) return;
    const mid = a._managerId;
    if (['consultation', 'visit'].includes(a.type)) {
      meetingsPerManager[mid] = (meetingsPerManager[mid] || 0) + 1;
    }
    if (a.type === 'call') {
      callsPerManager[mid] = (callsPerManager[mid] || 0) + 1;
    }
  });

  // Surinkti vadybininkus su bet kokia veikla šiame intervale
  const allManagerIds = new Set([
    ...Object.keys(rangeUnitsPerManager),
    ...Object.keys(meetingsPerManager),
    ...Object.keys(callsPerManager)
  ]);

  const rows = [...allManagerIds].map(mid => {
    const u = userMap[mid] || {};
    return {
      agentId: mid,
      agentName: u.full_name || u.email || mid,
      uniqueAgreementUnits: rangeUnitsPerManager[mid]?.size || 0,
      meetingsCount: meetingsPerManager[mid] || 0,
      callsCount: callsPerManager[mid] || 0
    };
  });

  // Rikiavimas: units DESC, meetings DESC, calls DESC, name ASC (deterministinis)
  rows.sort((a, b) => {
    if (b.uniqueAgreementUnits !== a.uniqueAgreementUnits) return b.uniqueAgreementUnits - a.uniqueAgreementUnits;
    if (b.meetingsCount !== a.meetingsCount) return b.meetingsCount - a.meetingsCount;
    if (b.callsCount !== a.callsCount) return b.callsCount - a.callsCount;
    return a.agentName.localeCompare(b.agentName);
  });

  // DENSE RANK: vienodi rezultatai gauna tą pačią vietą
  const ranked = [];
  const prevRanks = []; // private tracker
  rows.forEach((row, idx) => {
    let rankPosition;
    let isTie = false;
    if (idx === 0) {
      rankPosition = 1;
    } else {
      const prev = rows[idx - 1];
      const prevRank = prevRanks[idx - 1];
      const same =
        row.uniqueAgreementUnits === prev.uniqueAgreementUnits &&
        row.meetingsCount === prev.meetingsCount &&
        row.callsCount === prev.callsCount;
      rankPosition = same ? prevRank : idx + 1;
      isTie = same;
    }
    prevRanks.push(rankPosition);
    ranked.push({ agentId: row.agentId, agentName: row.agentName, uniqueAgreementUnits: row.uniqueAgreementUnits, meetingsCount: row.meetingsCount, callsCount: row.callsCount, rankPosition, isTie });
  });
  return ranked;
}

/**
 * Gauti mėnesio [start, end] intervalą
 */
function getMonthInterval(year, month) {
  const monthStart = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`);
  const nextMonthStart = month === 12
    ? new Date(`${year + 1}-01-01T00:00:00.000Z`)
    : new Date(`${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00.000Z`);
  const monthEnd = new Date(nextMonthStart.getTime() - 1);
  return { monthStart, monthEnd };
}

// ─── HTTP Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = normalizeRole(user.role);
    if (!['ADMINISTRATOR', 'SALES_MANAGER'].includes(role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { mode, year: yearParam, month: monthParam, projectId } = await req.json();
    const now = new Date();
    const year = yearParam || now.getFullYear();
    const month = monthParam || (now.getMonth() + 1);

    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`);

    if (mode === 'year') {
      // Vienas fetch, metų reitingas
      const yearData = await fetchYearData(base44, yearStart, yearEnd, projectId || null);
      const ranking = computeRankingFromData(yearData, yearStart, yearEnd);
      return Response.json({ success: true, mode: 'year', year, ranking });
    }

    if (mode === 'month') {
      // Vienas fetch (metų duomenys), filtruojama mėnesiui
      const yearData = await fetchYearData(base44, yearStart, yearEnd, projectId || null);
      const { monthStart, monthEnd } = getMonthInterval(year, month);
      const ranking = computeRankingFromData(yearData, monthStart, monthEnd);
      return Response.json({ success: true, mode: 'month', year, month, ranking });
    }

    if (mode === 'monthly_breakdown') {
      // OPTIMIZUOTA: vienas metų fetch, 12x JS grupavimas (ne 12x DB fetch)
      const yearData = await fetchYearData(base44, yearStart, yearEnd, projectId || null);
      const breakdown = [];
      for (let m = 1; m <= 12; m++) {
        const { monthStart, monthEnd } = getMonthInterval(year, m);
        const ranking = computeRankingFromData(yearData, monthStart, monthEnd);
        breakdown.push({ month: m, year, ranking });
      }
      return Response.json({ success: true, mode: 'monthly_breakdown', year, breakdown });
    }

    return Response.json({ error: 'Invalid mode. Use: year | month | monthly_breakdown' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
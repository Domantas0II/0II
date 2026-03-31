import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const normalizeRole = (r) => ({ admin: 'ADMINISTRATOR', user: 'SALES_AGENT' }[r] || r);

// Round to 0 decimals helper
const r0 = (n) => Math.round(n || 0);

/**
 * Compute manager ranking for a given date range.
 * Returns array sorted by: uniqueAgreementUnits DESC, meetingsCount DESC, callsCount DESC, agentName ASC
 *
 * Dedup logic:
 * - Group signed agreements (reservation|preliminary) by unitId
 * - Per unitId: take only the EARLIEST signed agreement across the entire YEAR
 * - That means: if Jan reservation + Feb preliminary for same unit → year gets 1 point
 * - For month breakdown: point goes to the month of the FIRST event in the year
 *
 * @param base44 - sdk client
 * @param {Date} start - range start (inclusive)
 * @param {Date} end - range end (inclusive)
 * @param {Date} yearStart - year boundary start for dedup (always Jan 1 of current year)
 * @param {string|null} projectId - optional filter
 */
async function computeRanking(base44, start, end, yearStart, projectId) {
  // 1. Fetch all signed agreements for the year (for dedup purposes)
  const agreementFilter = { status: 'signed' };
  if (projectId) agreementFilter.projectId = projectId;
  const allYearAgreements = await base44.asServiceRole.entities.Agreement.filter(agreementFilter);

  // Filter to valid types only
  const validAgreements = (allYearAgreements || []).filter(a =>
    ['reservation', 'preliminary'].includes(a.agreementType) &&
    a.signedAt &&
    new Date(a.signedAt) >= yearStart
  );

  // 2. Resolve unitId for each agreement via Reservation → ReservationBundle
  // Fetch all reservations referenced
  const reservationIds = [...new Set(validAgreements.map(a => a.reservationId).filter(Boolean))];
  let reservationMap = {};
  if (reservationIds.length > 0) {
    const reservations = await base44.asServiceRole.entities.Reservation.filter({ id: { $in: reservationIds } });
    (reservations || []).forEach(r => { reservationMap[r.id] = r; });
  }

  // Fetch all bundles referenced
  const bundleIds = [...new Set(Object.values(reservationMap).map(r => r.bundleId).filter(Boolean))];
  let bundleMap = {};
  if (bundleIds.length > 0) {
    const bundles = await base44.asServiceRole.entities.ReservationBundle.filter({ id: { $in: bundleIds } });
    (bundles || []).forEach(b => { bundleMap[b.id] = b; });
  }

  // Build agreement enriched with unitId and managerId
  const enriched = validAgreements.map(a => {
    const reservation = reservationMap[a.reservationId] || {};
    const bundle = bundleMap[reservation.bundleId] || {};
    return {
      ...a,
      unitId: bundle.unitId || null,
      managerId: a.createdByUserId || reservation.reservedByUserId || null,
      signedAtDate: new Date(a.signedAt)
    };
  }).filter(a => a.unitId && a.managerId);

  // 3. Global dedup: per unitId, find the EARLIEST signed agreement in the year
  // This determines who "owns" that unit point and in which month
  const unitFirstEvent = {}; // unitId -> { managerId, date, monthKey }
  enriched
    .sort((a, b) => a.signedAtDate - b.signedAtDate)
    .forEach(a => {
      if (!unitFirstEvent[a.unitId]) {
        unitFirstEvent[a.unitId] = {
          managerId: a.managerId,
          date: a.signedAtDate,
          monthKey: `${a.signedAtDate.getFullYear()}-${String(a.signedAtDate.getMonth() + 1).padStart(2, '0')}`
        };
      }
    });

  // 4. Filter to range: only count units whose first event falls within [start, end]
  const rangeUnitsPerManager = {}; // managerId -> Set of unitIds
  Object.entries(unitFirstEvent).forEach(([unitId, ev]) => {
    if (ev.date >= start && ev.date <= end) {
      if (!rangeUnitsPerManager[ev.managerId]) rangeUnitsPerManager[ev.managerId] = new Set();
      rangeUnitsPerManager[ev.managerId].add(unitId);
    }
  });

  // 5. Fetch activities in range
  const actFilter = { status: 'done' };
  if (projectId) actFilter.projectId = projectId;
  const allActivities = await base44.asServiceRole.entities.Activity.filter(actFilter);

  const rangeActivities = (allActivities || []).filter(a => {
    const d = new Date(a.completedAt || a.scheduledAt || a.created_date);
    return d >= start && d <= end;
  });

  // Build per-manager activity counts
  const meetingsPerManager = {};
  const callsPerManager = {};
  rangeActivities.forEach(a => {
    const mid = a.createdByUserId;
    if (!mid) return;
    if (['consultation', 'visit'].includes(a.type)) {
      meetingsPerManager[mid] = (meetingsPerManager[mid] || 0) + 1;
    }
    if (a.type === 'call') {
      callsPerManager[mid] = (callsPerManager[mid] || 0) + 1;
    }
  });

  // 6. Fetch all users (managers)
  const users = await base44.asServiceRole.entities.User.list();
  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u; });

  // 7. Collect all manager IDs that have any activity
  const allManagerIds = new Set([
    ...Object.keys(rangeUnitsPerManager),
    ...Object.keys(meetingsPerManager),
    ...Object.keys(callsPerManager)
  ]);

  // Build ranking rows
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

  // Sort: units DESC, meetings DESC, calls DESC, name ASC
  rows.sort((a, b) => {
    if (b.uniqueAgreementUnits !== a.uniqueAgreementUnits) return b.uniqueAgreementUnits - a.uniqueAgreementUnits;
    if (b.meetingsCount !== a.meetingsCount) return b.meetingsCount - a.meetingsCount;
    if (b.callsCount !== a.callsCount) return b.callsCount - a.callsCount;
    return a.agentName.localeCompare(b.agentName);
  });

  // Assign rank positions
  return rows.map((row, idx) => ({ ...row, rankPosition: idx + 1 }));
}

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
    const month = monthParam || (now.getMonth() + 1); // 1-based

    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`);

    if (mode === 'year') {
      // Full year ranking
      const ranking = await computeRanking(base44, yearStart, yearEnd, yearStart, projectId || null);
      return Response.json({ success: true, mode: 'year', year, ranking });
    }

    if (mode === 'month') {
      // Single month ranking
      const monthStart = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`);
      const nextMonth = month === 12 ? new Date(`${year + 1}-01-01T00:00:00.000Z`) : new Date(`${year}-${String(month + 1).padStart(2, '0')}-01T00:00:00.000Z`);
      const monthEnd = new Date(nextMonth.getTime() - 1);
      const ranking = await computeRanking(base44, monthStart, monthEnd, yearStart, projectId || null);
      return Response.json({ success: true, mode: 'month', year, month, ranking });
    }

    if (mode === 'monthly_breakdown') {
      // All months of the year
      const breakdown = [];
      for (let m = 1; m <= 12; m++) {
        const monthStart = new Date(`${year}-${String(m).padStart(2, '0')}-01T00:00:00.000Z`);
        const nextMonth = m === 12 ? new Date(`${year + 1}-01-01T00:00:00.000Z`) : new Date(`${year}-${String(m + 1).padStart(2, '0')}-01T00:00:00.000Z`);
        const monthEnd = new Date(nextMonth.getTime() - 1);
        const ranking = await computeRanking(base44, monthStart, monthEnd, yearStart, projectId || null);
        breakdown.push({ month: m, year, ranking });
      }
      return Response.json({ success: true, mode: 'monthly_breakdown', year, breakdown });
    }

    return Response.json({ error: 'Invalid mode. Use: year | month | monthly_breakdown' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { base44 } from '@/api/base44Client';

/**
 * Analytics Helpers Library
 * Central aggregation logic for dashboard KPIs
 */

// ============================================
// UTILITY: Date range filtering
// ============================================
export const getDateRangeFilter = (dateRange) => {
  if (!dateRange) return {};
  const now = new Date();
  let startDate = new Date();

  if (dateRange === 'today') {
    startDate.setHours(0, 0, 0, 0);
  } else if (dateRange === 'week') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (dateRange === 'month') {
    startDate.setMonth(startDate.getMonth() - 1);
  } else if (dateRange === 'quarter') {
    startDate.setMonth(startDate.getMonth() - 3);
  }

  return { created_date: { $gte: startDate.toISOString() } };
};

// ============================================
// 1. PROJECT KPIs
// ============================================
export const getProjectKpis = async (projectIds) => {
  try {
    // All-time KPI (not filtered by date)
    // Handle null (full access) and array (filtered projects)
    const query = projectIds === null ? {} : { projectId: { $in: projectIds } };
    const units = await base44.entities.SaleUnit.filter(query);

    const available = units.filter(u => u.internalStatus === 'available').length;
    const reserved = units.filter(u => u.internalStatus === 'reserved').length;
    const sold = units.filter(u => u.internalStatus === 'sold').length;

    // Reservations (all-time)
    const reservations = await base44.entities.Reservation.filter(query);

    const overdue = reservations.filter(r =>
      r.status === 'overdue' || (new Date(r.expiresAt) < new Date() && r.status === 'active')
    ).length;

    // Inquiries (all-time)
    const inquiries = await base44.entities.ProjectInquiry.filter(query);

    const newInquiries = inquiries.filter(i => i.status === 'new').length;
    const convertedInquiries = inquiries.filter(i => i.status === 'converted').length;

    // Agreements (all-time)
    const agreements = await base44.entities.Agreement.filter(query);

    const signedAgreements = agreements.filter(a => a.status === 'signed').length;

    // Deals (all-time)
    const deals = await base44.entities.Deal.filter(query);

    const soldValue = deals.reduce((sum, d) => sum + (d.totalAmount || 0), 0);

    return {
      unitStats: { available, reserved, sold, total: units.length },
      reservationStats: { total: reservations.length, overdue },
      inquiryStats: { total: inquiries.length, new: newInquiries, converted: convertedInquiries },
      agreementStats: { signed: signedAgreements, total: agreements.length },
      dealStats: { total: deals.length, soldValue }
    };
  } catch (error) {
    console.error('Failed to calculate project KPIs:', error);
    return null;
  }
};

// ============================================
// 2. INQUIRY FUNNEL
// SOURCE-OF-TRUTH: ProjectInquiry.status uses:
//   new | claimed | converted | rejected | duplicate
// Legacy statuses (contacted) removed — no longer active.
// ============================================
export const getInquiryFunnel = async (projectIds) => {
  try {
    const query = projectIds === null ? {} : { projectId: { $in: projectIds } };
    const inquiries = await base44.entities.ProjectInquiry.filter(query);

    return {
      new:       inquiries.filter(i => i.status === 'new').length,
      claimed:   inquiries.filter(i => i.status === 'claimed').length,
      converted: inquiries.filter(i => i.status === 'converted').length,
      rejected:  inquiries.filter(i => i.status === 'rejected').length,
      duplicate: inquiries.filter(i => i.status === 'duplicate').length,
    };
  } catch (error) {
    console.error('Failed to calculate inquiry funnel:', error);
    return null;
  }
};

// ============================================
// 3. PIPELINE BREAKDOWN
// ============================================
export const getPipelineBreakdown = async (projectIds) => {
  try {
    // All-time pipeline stages (not filtered by date)
    const query = projectIds === null ? {} : { projectId: { $in: projectIds } };
    const interests = await base44.entities.ClientProjectInterest.filter(query);

    const stages = [
      'new_contact', 'no_answer_1', 'no_answer_2', 'no_answer_3',
      'proposal_sent', 'not_relevant', 'consultation_booked',
      'viewing_booked', 'waiting_response', 'follow_up', 'negotiation', 'reservation'
    ];
    const result = {};
    stages.forEach(s => {
      result[s] = interests.filter(i => i.pipelineStage === s).length;
    });
    return result;
  } catch (error) {
    console.error('Failed to calculate pipeline breakdown:', error);
    return null;
  }
};

// ============================================
// 4. RESERVATION STATS
// ============================================
export const getReservationStats = async (projectIds) => {
  try {
    // All-time reservation states (not filtered by date)
    const query = projectIds === null ? {} : { projectId: { $in: projectIds } };
    const reservations = await base44.entities.Reservation.filter(query);

    const now = new Date();
    return {
      active: reservations.filter(r => r.status === 'active').length,
      overdue: reservations.filter(r =>
        r.status === 'overdue' || (new Date(r.expiresAt) < now && r.status === 'active')
      ).length,
      released: reservations.filter(r => r.status === 'released').length,
      converted: reservations.filter(r => r.status === 'converted').length
    };
  } catch (error) {
    console.error('Failed to calculate reservation stats:', error);
    return null;
  }
};

// ============================================
// 5. DEAL STATS
// ============================================
export const getDealStats = async (projectIds) => {
  try {
    // All-time deals (not filtered by date)
    const query = projectIds === null ? {} : { projectId: { $in: projectIds } };
    const deals = await base44.entities.Deal.filter(query);

    const soldValue = deals.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
    const avgDealValue = deals.length > 0 ? Math.round(soldValue / deals.length) : 0;

    // Sort by soldAt desc, return all for dashboard use
    const sortedDeals = deals.slice().sort((a, b) =>
      new Date(b.soldAt || b.created_date) - new Date(a.soldAt || a.created_date)
    );
    return {
      total: deals.length,
      soldValue,
      avgDealValue,
      deals: sortedDeals
    };
  } catch (error) {
    console.error('Failed to calculate deal stats:', error);
    return null;
  }
};

// ============================================
// 6. AGENT PERFORMANCE
// ============================================
export const getAgentPerformance = async (projectIds, userIds) => {
  try {
    // All-time agent performance (not filtered by date)
    const query = projectIds === null ? {} : { projectId: { $in: projectIds } };
    const interests = await base44.entities.ClientProjectInterest.filter(query);

    const reservations = await base44.entities.Reservation.filter(query);

    const deals = await base44.entities.Deal.filter(query);

    const agentMap = {};

    // Initialize agent map
    userIds.forEach(uid => {
      agentMap[uid] = {
        userId: uid,
        interests: 0,
        reservations: 0,
        deals: 0,
        soldValue: 0
      };
    });

    // Count interests by assigned manager
    interests.forEach(interest => {
      if (interest.assignedManagerUserId && agentMap[interest.assignedManagerUserId]) {
        agentMap[interest.assignedManagerUserId].interests++;
      }
    });

    // Count reservations by reserved user
    reservations.forEach(res => {
      if (res.reservedByUserId && agentMap[res.reservedByUserId]) {
        agentMap[res.reservedByUserId].reservations++;
      }
    });

    // Count deals by sold user
    deals.forEach(deal => {
      if (deal.soldByUserId && agentMap[deal.soldByUserId]) {
        agentMap[deal.soldByUserId].deals++;
        agentMap[deal.soldByUserId].soldValue += deal.totalAmount || 0;
      }
    });

    return Object.values(agentMap).filter(a => a.interests > 0 || a.reservations > 0 || a.deals > 0);
  } catch (error) {
    console.error('Failed to calculate agent performance:', error);
    return null;
  }
};

// ============================================
// 7. SALES AGENT - Personal stats
// ============================================
export const getAgentPersonalStats = async (projectIds, userId) => {
  try {
    // All-time agent personal stats (not filtered by date)
    const projectQuery = projectIds === null ? {} : { projectId: { $in: projectIds } };
    const myInterests = await base44.entities.ClientProjectInterest.filter(
      {
        ...projectQuery,
        assignedManagerUserId: userId
      }
    );

    const myReservations = await base44.entities.Reservation.filter(
      {
        ...projectQuery,
        reservedByUserId: userId
      }
    );

    const myDeals = await base44.entities.Deal.filter(
      {
        ...projectQuery,
        soldByUserId: userId
      }
    );

    const soldValue = myDeals.reduce((sum, d) => sum + (d.totalAmount || 0), 0);

    // Overdue follow-ups
    const now = new Date();
    const overdueFollowUps = myInterests.filter(i =>
      i.nextFollowUpAt && new Date(i.nextFollowUpAt) < now
    ).length;

    return {
      interests: myInterests.length,
      clients: new Set(myInterests.map(i => i.clientId)).size,
      reservations: myReservations.length,
      deals: myDeals.length,
      soldValue,
      overdueFollowUps,
      activeInterests: myInterests.filter(i => [
        'new_contact', 'no_answer_1', 'no_answer_2', 'no_answer_3',
        'proposal_sent', 'consultation_booked', 'viewing_booked',
        'waiting_response', 'follow_up', 'negotiation'
      ].includes(i.pipelineStage)).length
    };
  } catch (error) {
    console.error('Failed to calculate agent personal stats:', error);
    return null;
  }
};

// ============================================
// 8. DEVELOPER PROJECT STATS
// ============================================
export const getDeveloperProjectStats = async (projectIds) => {
  try {
    // All-time developer project stats (not filtered by date)
    const query = projectIds === null ? {} : { projectId: { $in: projectIds } };
    const units = await base44.entities.SaleUnit.filter(query);

    const reservations = await base44.entities.Reservation.filter(query);

    const deals = await base44.entities.Deal.filter(query);

    const inquiries = await base44.entities.ProjectInquiry.filter(query);

    const soldValue = deals.reduce((sum, d) => sum + (d.totalAmount || 0), 0);

    return {
      units: {
        available: units.filter(u => u.internalStatus === 'available').length,
        reserved: units.filter(u => u.internalStatus === 'reserved').length,
        sold: units.filter(u => u.internalStatus === 'sold').length
      },
      reservations: reservations.length,
      deals: deals.length,
      inquiries: inquiries.length,
      soldValue
    };
  } catch (error) {
    console.error('Failed to calculate developer project stats:', error);
    return null;
  }
};

// ============================================
// 9. OVERDUE CONTROL ITEMS
// ============================================
export const getOverdueAlerts = async (projectIds, userId) => {
  try {
    const now = new Date();

    // Overdue reservations (live state check)
    const query = projectIds === null ? {} : { projectId: { $in: projectIds } };
    const reservations = await base44.entities.Reservation.filter(query);

    const overdueReservations = reservations.filter(r =>
      r.status !== 'released' && new Date(r.expiresAt) < now && r.status !== 'converted'
    );

    // Overdue follow-ups (for agent or all if null)
    const interestsFilter = { ...query };
    if (userId) {
      interestsFilter.assignedManagerUserId = userId;
    }
    const interests = await base44.entities.ClientProjectInterest.filter(
      interestsFilter
    );

    const overdueFollowUps = interests.filter(i =>
      i.nextFollowUpAt && new Date(i.nextFollowUpAt) < now
    );

    // Stale inquiries (new but unclaimed > 7 days)
    const allInquiries = await base44.entities.ProjectInquiry.filter(query);

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const staleInquiries = allInquiries.filter(i =>
      i.status === 'new' && new Date(i.created_date) < sevenDaysAgo
    );

    return {
      overdueReservations,
      overdueFollowUps,
      staleInquiries,
      totalAlerts: overdueReservations.length + overdueFollowUps.length + staleInquiries.length
    };
  } catch (error) {
    console.error('Failed to calculate overdue alerts:', error);
    return null;
  }
};
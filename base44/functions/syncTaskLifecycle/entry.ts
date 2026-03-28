import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Entity Lifecycle Sync Automation
 * Triggered when:
 * - ClientProjectInterest status → won/lost/rejected
 * - Reservation status → released/converted
 * - Deal created
 *
 * Cancels related Tasks automatically
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!event || !event.entity_name) {
      return Response.json({ error: 'Missing event data' }, { status: 400 });
    }

    const entityName = event.entity_name;
    const entityId = event.entity_id;

    let taskQuery = {};
    let shouldCancel = false;

    // 1. ClientProjectInterest won/lost/rejected
    if (entityName === 'ClientProjectInterest') {
      if (data?.status === 'won' || data?.status === 'lost' || data?.status === 'rejected') {
        taskQuery.relatedInterestId = entityId;
        shouldCancel = true;
      }
    }

    // 2. Reservation released/converted
    if (entityName === 'Reservation') {
      if (data?.status === 'released' || data?.status === 'converted') {
        taskQuery.relatedReservationId = entityId;
        shouldCancel = true;
      }
    }

    // 3. Deal created (cancel reservation-related tasks as deal is now active)
    if (entityName === 'Deal') {
      if (data?.reservationId) {
        taskQuery.relatedReservationId = data.reservationId;
        shouldCancel = true;
      }
    }

    if (!shouldCancel || Object.keys(taskQuery).length === 0) {
      return Response.json({
        success: true,
        cancelled: 0,
        reason: 'No task cancellation needed'
      });
    }

    // Find and cancel matching tasks (only if not already completed)
    const tasks = await base44.asServiceRole.entities.Task.filter(taskQuery);
    let cancelled = 0;

    for (const task of tasks) {
      if (task.status !== 'completed' && task.status !== 'cancelled') {
        await base44.asServiceRole.entities.Task.update(task.id, {
          status: 'cancelled'
        });
        cancelled++;
      }
    }

    return Response.json({
      success: true,
      cancelled,
      entity: entityName,
      entityId
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
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

    // Determine cancellation reason from entity type
    const reasonMap = {
      'ClientProjectInterest': data?.status === 'won' ? 'interest_won' : (data?.status === 'lost' ? 'interest_lost' : 'interest_rejected'),
      'Reservation': 'reservation_' + (data?.status === 'released' ? 'released' : 'converted'),
      'Deal': 'deal_created'
    };
    const reason = reasonMap[entityName] || 'unknown';

    for (const task of tasks) {
      if (task.status !== 'completed' && task.status !== 'cancelled') {
        await base44.asServiceRole.entities.Task.update(task.id, {
          status: 'cancelled'
        });
        cancelled++;

        // Log to AuditLog
        try {
          await base44.asServiceRole.entities.AuditLog.create({
            action: 'TASKS_AUTO_CANCELLED',
            performedByUserId: 'system',
            performedByName: 'Task Lifecycle Sync',
            details: JSON.stringify({
              taskId: task.id,
              reason,
              entityName,
              entityId,
              taskTitle: task.title,
              taskStatus: task.status
            })
          });
        } catch (auditErr) {
          console.error('Failed to log task cancellation to AuditLog:', auditErr);
          // Don't fail the entire operation if audit logging fails
        }
      }
    }

    return Response.json({
      success: true,
      cancelled,
      entity: entityName,
      entityId,
      reason
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
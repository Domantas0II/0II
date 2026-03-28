/**
 * Invite accept flow handler.
 * Triggered on first user login if pending invitation exists.
 * Creates ProjectAssignments and marks invitation as accepted.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find pending invitation for this user's email
    const invitations = await base44.entities.UserInvitation.filter({
      email: user.email,
      status: 'pending',
    });

    if (invitations.length === 0) {
      return Response.json({ processed: false, message: 'No pending invitations' });
    }

    const invitation = invitations[0];

    // Check if expired
    const expiresAt = new Date(invitation.expiresAt);
    const now = new Date();

    if (now > expiresAt) {
      // Mark as expired
      await base44.entities.UserInvitation.update(invitation.id, {
        status: 'expired',
      });
      return Response.json({ processed: false, message: 'Invitation expired' });
    }

    // Create assignments for each project
    const projectIds = invitation.allProjects
      ? (await base44.entities.Project.list()).map(p => p.id)
      : invitation.projectIds || [];

    for (const projectId of projectIds) {
      // Check if assignment already exists (idempotent)
      const existing = await base44.entities.UserProjectAssignment.filter({
        userId: user.id,
        projectId,
        removedAt: null,
      });

      if (existing.length === 0) {
        const project = await base44.entities.Project.filter({ id: projectId }).then(r => r?.[0]);
        
        await base44.entities.UserProjectAssignment.create({
          userId: user.id,
          userFullName: user.full_name,
          projectId,
          projectName: project?.projectName || projectId,
          assignedByUserId: invitation.invitedByUserId,
          assignedByName: invitation.invitedByName,
          assignedAt: new Date().toISOString(),
        });
      }
    }

    // Mark invitation as accepted
    await base44.entities.UserInvitation.update(invitation.id, {
      status: 'accepted',
    });

    return Response.json({
      processed: true,
      projectCount: projectIds.length,
    });
  } catch (error) {
    console.error('Invite accept failed:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
import { createItem } from '../../db';

export async function createAuditLog(log) {
  return createItem('audit_logs', {
    actor_id: log.actor_id || 'system',
    action: log.action,
    entity: log.entity,
    entity_id: log.entity_id,
    payload: log.payload || {},
    createdAt: new Date().toISOString()
  });
}

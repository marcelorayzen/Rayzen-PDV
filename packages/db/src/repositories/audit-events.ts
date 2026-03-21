import type { DatabaseSync } from "node:sqlite";

import { parseJson, serializeJson } from "../json.js";
import type { AuditEventInput, AuditEventRecord } from "../types.js";

interface AuditEventRow {
  eventId: string;
  entity: string;
  entityId: string;
  action: string;
  actorUserId: string | null;
  actorTerminalId: string | null;
  actorRole: string | null;
  occurredAt: string;
  payloadJson: string;
  createdAt: string;
}

export class AuditEventRepository {
  readonly #db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.#db = db;
  }

  append(event: AuditEventInput): AuditEventRecord {
    this.#db
      .prepare(
        `
          INSERT INTO audit_events (
            event_id,
            entity,
            entity_id,
            action,
            actor_user_id,
            actor_terminal_id,
            actor_role,
            occurred_at,
            payload_json
          )
          VALUES (
            :eventId,
            :entity,
            :entityId,
            :action,
            :actorUserId,
            :actorTerminalId,
            :actorRole,
            :occurredAt,
            :payloadJson
          )
        `
      )
      .run({
        eventId: event.eventId,
        entity: event.entity,
        entityId: event.entityId,
        action: event.action,
        actorUserId: event.actorUserId ?? null,
        actorTerminalId: event.actorTerminalId ?? null,
        actorRole: event.actorRole ?? null,
        occurredAt: event.occurredAt,
        payloadJson: serializeJson(event.payload)
      });

    return this.findById(event.eventId);
  }

  findById(eventId: string): AuditEventRecord {
    const row = this.#db.prepare(
      `
        SELECT
          event_id AS eventId,
          entity,
          entity_id AS entityId,
          action,
          actor_user_id AS actorUserId,
          actor_terminal_id AS actorTerminalId,
          actor_role AS actorRole,
          occurred_at AS occurredAt,
          payload_json AS payloadJson,
          created_at AS createdAt
        FROM audit_events
        WHERE event_id = :eventId
      `
    ).get({ eventId }) as AuditEventRow | undefined;

    if (!row) {
      throw new Error(`Evento de auditoria nao encontrado: ${eventId}`);
    }

    return mapAuditEvent(row);
  }

  findByEntity(entity: string, entityId: string): AuditEventRecord[] {
    return (this.#db.prepare(
      `
        SELECT
          event_id AS eventId,
          entity,
          entity_id AS entityId,
          action,
          actor_user_id AS actorUserId,
          actor_terminal_id AS actorTerminalId,
          actor_role AS actorRole,
          occurred_at AS occurredAt,
          payload_json AS payloadJson,
          created_at AS createdAt
        FROM audit_events
        WHERE entity = :entity AND entity_id = :entityId
        ORDER BY occurred_at ASC, created_at ASC
      `
    ).all({ entity, entityId }) as unknown as AuditEventRow[]).map(mapAuditEvent);
  }
}

function mapAuditEvent(row: AuditEventRow): AuditEventRecord {
  return {
    eventId: row.eventId,
    entity: row.entity,
    entityId: row.entityId,
    action: row.action,
    actorUserId: row.actorUserId,
    actorTerminalId: row.actorTerminalId,
    actorRole: row.actorRole,
    occurredAt: row.occurredAt,
    payload: parseJson(row.payloadJson),
    createdAt: row.createdAt
  };
}

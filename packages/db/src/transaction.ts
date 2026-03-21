import type { DatabaseSync } from "node:sqlite";

const TRANSACTION_DEPTH = new WeakMap<DatabaseSync, number>();

export function executeTransaction(db: DatabaseSync, callback: () => void): void {
  const depth = TRANSACTION_DEPTH.get(db) ?? 0;
  const savepoint = `rayzen_tx_${depth + 1}`;

  TRANSACTION_DEPTH.set(db, depth + 1);

  if (depth === 0) {
    db.exec("BEGIN IMMEDIATE");
  } else {
    db.exec(`SAVEPOINT ${savepoint}`);
  }

  try {
    callback();

    if (depth === 0) {
      db.exec("COMMIT");
    } else {
      db.exec(`RELEASE SAVEPOINT ${savepoint}`);
    }
  } catch (error) {
    if (depth === 0) {
      db.exec("ROLLBACK");
    } else {
      db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      db.exec(`RELEASE SAVEPOINT ${savepoint}`);
    }

    throw error;
  } finally {
    if (depth === 0) {
      TRANSACTION_DEPTH.delete(db);
    } else {
      TRANSACTION_DEPTH.set(db, depth);
    }
  }
}

const sqlite = process.getBuiltinModule("node:sqlite") ?? process.getBuiltinModule("sqlite");

export const DatabaseSync = sqlite.DatabaseSync;
export default sqlite;

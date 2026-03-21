# Migrations

Convencoes do pacote:

- uma pasta por versao, ex.: `0001_storage_baseline`
- cada versao precisa de `up.sql` e `down.sql`
- aplicacao e rollback rodam dentro de transacao SQLite
- `schema_migrations` e controlada pelo runner em `src/migrations.ts`

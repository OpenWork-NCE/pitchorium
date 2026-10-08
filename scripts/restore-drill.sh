#!/usr/bin/env bash
# Restore drill (docs/operations/backup-and-restore.md), on the local Compose infrastructure:
# copies the development database into a drill database, backs it up (pg_dump -Fc), destroys
# it, restores it into a new database and checks that the migration journal, the row count and
# a fingerprint of every table are the same. Never touches the development database itself.
#
#   POSTGRES_CONTAINER   container of PostgreSQL (default: pitchorium-postgres-1)
#   POSTGRES_USER        (default: pitchorium)
#   SOURCE_DATABASE      database copied for the drill (default: pitchorium)
set -euo pipefail

container="${POSTGRES_CONTAINER:-pitchorium-postgres-1}"
user="${POSTGRES_USER:-pitchorium}"
source_db="${SOURCE_DATABASE:-pitchorium}"
drill="restore_drill"
restored="restore_drill_restored"
dump="/tmp/${drill}.dump"

psql() { docker exec -i "$container" psql -v ON_ERROR_STOP=1 -U "$user" -At "$@"; }

# Row count and md5 of the ordered rows of every table of the application schemas.
fingerprint() {
  local database="$1"
  psql -d "$database" <<'SQL'
do $$
declare
  t record;
  result text := '';
  line text;
begin
  for t in
    select table_schema, table_name from information_schema.tables
    where table_type = 'BASE TABLE'
      and table_schema not in ('pg_catalog', 'information_schema')
    order by table_schema, table_name
  loop
    execute format(
      'select %L || '' '' || count(*) || '' '' || coalesce(md5(string_agg(t::text, '','' order by t::text)), ''-'') from %I.%I t',
      t.table_schema || '.' || t.table_name, t.table_schema, t.table_name
    ) into line;
    result := result || line || E'\n';
  end loop;
  raise notice '%', result;
end $$;
SQL
}

echo "1/5 Copy of ${source_db} into ${drill}"
psql -d postgres -c "drop database if exists ${drill}" -c "drop database if exists ${restored}" >/dev/null
psql -d postgres -c "create database ${drill} template ${source_db}" >/dev/null
before=$(fingerprint "$drill" 2>&1 | sed -n 's/^NOTICE:  //p;/^[a-z_]*\.[a-z_]* [0-9]/p')
tables=$(printf '%s\n' "$before" | grep -c ' ')

echo "2/5 Backup (pg_dump -Fc)"
docker exec "$container" pg_dump -U "$user" -Fc -f "$dump" "$drill"
size=$(docker exec "$container" stat -c %s "$dump")

echo "3/5 Destruction of ${drill}"
psql -d postgres -c "drop database ${drill}" >/dev/null

echo "4/5 Restoration into ${restored}"
psql -d postgres -c "create database ${restored}" >/dev/null
docker exec "$container" pg_restore -U "$user" --no-owner --exit-on-error -d "$restored" "$dump"

echo "5/5 Verification"
after=$(fingerprint "$restored" 2>&1 | sed -n 's/^NOTICE:  //p;/^[a-z_]*\.[a-z_]* [0-9]/p')
psql -d postgres -c "drop database ${restored}" >/dev/null
docker exec "$container" rm -f "$dump"
if [ "$before" != "$after" ]; then
  echo "FAILED: the restored tables differ from the backed up ones" >&2
  diff <(printf '%s\n' "$before") <(printf '%s\n' "$after") >&2 || true
  exit 1
fi
echo "OK: ${tables} tables identical after backup (${size} bytes), destruction and restoration."

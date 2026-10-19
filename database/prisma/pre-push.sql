-- Runs before `prisma db push` on every backend start (see the Dockerfile).
--
-- Why: assessment_sat_instance's unique key moved from (learnerId,
-- instanceNum) to (learnerId, kind, instanceNum), so journey assessments can
-- be numbered on their own. MySQL refuses to drop the old key while it's the
-- only index backing the learnerId foreign key, and `db push` drops it before
-- creating the new learnerId index — so the push failed on existing
-- databases. Creating that index first lets the push go through.
--
-- Safe to run every time: it does nothing when the index already exists, or
-- when the table doesn't exist yet (a fresh database — db push creates it).
SET @has_table := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'assessment_sat_instance'
);
SET @has_index := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'assessment_sat_instance'
    AND index_name = 'assessment_sat_instance_learnerId_idx'
);
SET @sql := IF(
  @has_table = 1 AND @has_index = 0,
  'CREATE INDEX assessment_sat_instance_learnerId_idx ON assessment_sat_instance(learnerId)',
  'DO 0'
);
PREPARE pre_push FROM @sql;
EXECUTE pre_push;
DEALLOCATE PREPARE pre_push;

-- Application no longer reads or writes school; older deployments remain compatible
-- until this pending remote migration is applied after the quota reset.
ALTER TABLE users DROP COLUMN school;

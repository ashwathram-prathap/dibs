-- Privacy cleanup reads only unsanitized records, rather than scanning archive history.
CREATE INDEX IF NOT EXISTS claims_privacy_cleanup ON claims(ip_day) WHERE ip_hash!='';

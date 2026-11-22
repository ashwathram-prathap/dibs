-- Transaction-assigned event position makes simultaneous dibs/strikes unambiguous.
ALTER TABLE claims ADD COLUMN file_no INTEGER NOT NULL DEFAULT 1;

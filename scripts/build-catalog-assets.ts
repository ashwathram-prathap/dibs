// Never publish the answer pool: it contains unclaimed golden tickets.
import { rmSync } from 'node:fs';
rmSync('public/catalog', { recursive: true, force: true });

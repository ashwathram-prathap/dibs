export interface Category {
  id: string;
  date: string;
  name: string;
  slug: string;
  total_registrable: number;
  drop_at: string;
  status?: string;
}
export interface Claim {
  id: string;
  category_id: string;
  claim_no: number;
  display: string;
  handle: string;
  created_at: string;
  obscurity: number | null;
  category_name: string;
  category_date: string;
  total_registrable: number;
}
export interface User {
  id: string;
  handle: string;
  rerolls_used: number;
}
export interface Today {
  category: Category | null;
  claimed: number;
  open: number;
  voided?: number;
  nextDrop: string;
  turnstileSiteKey: string;
  closedReason?: string;
  lastClaimAt?: string | null;
  board?: { handle: string; dibs: number; strikes: number; completedAt: string }[];
}
export interface DayFile {
  summaryId?: string;
  category_id: string;
  claims: Claim[];
  dibs: number;
  strikes: number;
  events: { at: string; kind: 'dibs' | 'strike' }[];
  closed: boolean;
  completedAt: string | null;
}
export interface Me {
  file?: DayFile | null;
  user: User | null;
  claim: Claim | null;
  streak: number;
  streakDates: string[];
}
export const serial = (n: number) => String(n).padStart(4, '0');

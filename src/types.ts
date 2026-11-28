export interface Specials {
  clue?: { text: string; crackedBy: string | null } | null;
  houseCount: number;
  houseWords: { display: string; handle: string }[];
  goldenFound: number;
  goldenTotal: number;
  commitment: string;
  committedAt: string;
  verified?: boolean;
  reveal?: {
    seed: string;
    answers: { id: string; display: string; clued?: boolean }[];
    algorithm: string;
    payload: string;
  };
}
export interface Category {
  scopeNote?: string;
  specials?: Specials;
  id: string;
  date: string;
  name: string;
  slug: string;
  total_registrable: number;
  drop_at: string;
  status?: string;
}
export interface Claim {
  sharedAnswers?: boolean;
  streak?: number;
  category_slug?: string;
  owned?: boolean;
  revealed?: boolean;
  points?: number;
  percentile?: number | null;
  bonus?: number;
  founder?: boolean | number;
  concealed?: boolean;
  golden?: boolean | number;
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
  revealed?: boolean;
  closesAt?: string;
  serverTime?: string;
  practice?: boolean;
  specials?: Specials;
  category: Category | null;
  claimed: number;
  open: number;
  voided?: number;
  nextDrop: string;
  turnstileSiteKey: string;
  closedReason?: string;
  lastClaimAt?: string | null;
  board?: {
    founder?: boolean;
    handle: string;
    dibs: number;
    strikes: number;
    completedAt: string;
  }[];
}
export interface Guess {
  at: string;
  kind: 'dibs' | 'strike';
  golden?: boolean;
  display?: string;
  claimId?: string;
  obscurity?: number | null;
  holder?: string;
  holderFounder?: boolean;
  heldAt?: string;
  house?: boolean;
}
export interface DayFile {
  sharedAnswers?: boolean;
  comparison?: import('../shared/finished-scores').FinishedComparison;
  points?: number;
  rank?: number | null;
  players?: number;
  revealed?: boolean;
  founder?: boolean | number;
  handle?: string;
  streak?: number;
  summaryId?: string;
  category_id: string;
  claims: Claim[];
  dibs: number;
  strikes: number;
  events: Guess[];
  closed: boolean;
  completedAt: string | null;
}
export interface Me {
  firstVisit?: boolean;
  file?: DayFile | null;
  user: User | null;
  claim: Claim | null;
  streak: number;
  streakDates: string[];
}
export const serial = (n: number) => String(n).padStart(4, '0');

export interface Standing {
  rank: number;
  handle: string;
  founder: boolean;
  points: number;
  claims: number;
  golden: boolean;
  own: boolean;
}
export interface Standings {
  comparison?: import('../shared/finished-scores').FinishedComparison;
  rows: Standing[];
  own: Standing | null;
  total: number;
  final?: boolean;
}

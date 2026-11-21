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
  school: string;
  created_at: string;
  obscurity: number | null;
  category_name: string;
  category_date: string;
  total_registrable: number;
}
export interface User {
  id: string;
  handle: string;
  school: string;
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
}
export interface Me {
  user: User;
  claim: Claim | null;
  streak: number;
  streakDates: string[];
}
export const schools = [
  'University of Waterloo',
  'Wilfrid Laurier',
  'University of Toronto',
  'McMaster',
  'Western',
  'Queen’s',
  'TMU',
  'York',
  'Other',
  'None',
];
export const serial = (n: number) => String(n).padStart(4, '0');

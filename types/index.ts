export type Category =
  | 'sports'
  | 'arts'
  | 'swim'
  | 'music'
  | 'stem'
  | 'camps'
  | 'dance'
  | 'tutoring'
  | 'other';

export interface Kid {
  id: string;
  user_id: string;
  name: string;
  birth_year: number;
  created_at: string;
}

export interface Activity {
  id: string;
  name: string;
  provider: string;
  category: Category;
  description: string;
  location: string;
  city: string;
  province: string;
  age_min: number | null;
  age_max: number | null;
  registration_opens_at: string | null; // ISO date string
  activity_starts_at: string | null;
  activity_ends_at: string | null;
  signup_url: string | null;
  submitted_by: string | null;
  is_verified: boolean;
  created_at: string;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  activity_id: string;
  notify_days_before: number; // how many days before reg opens to alert
  notify_via_push: boolean;
  notify_via_email: boolean;
  activity?: Activity;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  city: string;
  province: string;
  push_token: string | null;
  created_at: string;
}

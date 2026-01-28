export type ReservationType = 'paid' | 'carpool';

export type DateStatus = 'available' | 'sold-out' | 'no-reservation' | 'unavailable' | 'unknown';

export interface AvailabilityResult {
  date: string;
  status: DateStatus;
  available: Record<ReservationType, boolean>;
  timestamp: Date;
}

export interface BookingResult {
  success: boolean;
  confirmationNumber?: string;
  date: string;
  type: ReservationType;
  plate: string;
  error?: string;
}

export interface Config {
  resortUrl?: string;
  lotPreferences?: string[];
  defaultPlate?: string;
  defaultType?: ReservationType;
  pollInterval: number;
  jitter: number;
  notifications: {
    desktop: boolean;
    sound: boolean;
  };
  browser: {
    headless: boolean;
    slowMo: number;
  };
}

export interface WatchOptions {
  date: string;
  type: ReservationType;
  interval: number;
  jitter: number;
  notify: boolean;
  sound: boolean;
  autoBook: boolean;
  headed: boolean;
  dryRun: boolean;
  verbose: boolean;
  plate?: string;
  resortUrl?: string;
  lotPreferences?: string[];
}

export interface CheckOptions {
  date: string;
  headed: boolean;
  verbose: boolean;
  resortUrl?: string;
  lotPreferences?: string[];
}

export interface BookOptions {
  date: string;
  type: ReservationType;
  plate: string;
  headed: boolean;
  dryRun: boolean;
  verbose: boolean;
  resortUrl?: string;
  lotPreferences?: string[];
}

export interface AuthOptions {
  verbose: boolean;
  resortUrl?: string;
}

export interface SetupOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

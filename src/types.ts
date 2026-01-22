export type ReservationType = 'paid' | 'carpool' | 'ada';

export interface AvailabilityResult {
  date: string;
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
}

export interface CheckOptions {
  date: string;
  headed: boolean;
  verbose: boolean;
}

export interface BookOptions {
  date: string;
  type: ReservationType;
  plate: string;
  headed: boolean;
  dryRun: boolean;
  verbose: boolean;
}

export interface AuthOptions {
  verbose: boolean;
}

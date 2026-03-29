export type DateStatus = 'available' | 'sold-out' | 'no-reservation' | 'unavailable' | 'unknown';

export interface AvailabilityResult {
  date: string;
  status: DateStatus;
  timestamp: Date;
}

export interface Config {
  resortUrl?: string;
  lotPreferences?: string[];
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
  interval: number;
  jitter: number;
  notify: boolean;
  sound: boolean;
  headed: boolean;
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

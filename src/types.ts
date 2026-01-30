export type ReservationType = 'paid' | 'carpool' | 'free';

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

// ============================================================================
// Config-driven Resort System (extensible for all HONK resorts)
// ============================================================================

/**
 * Booking flow type - different HONK implementations use different flows.
 */
export type BookingFlowType = 'standard' | 'hourly' | 'pay-on-arrival';

/**
 * Config-driven reservation type definition.
 * Allows resorts to define their own reservation types beyond paid/carpool.
 */
export interface ReservationTypeConfig {
  /** Unique identifier (e.g., 'paid', 'carpool', 'free', 'ev') */
  id: string;
  /** Display label (e.g., "Carpool 4+", "Free Passholder") */
  label: string;
  /** Text to match in the rate card DOM element */
  selectorText: string;
  /** Whether this type requires payment */
  requiresPayment: boolean;
  /** Minimum occupancy required (e.g., 4 for carpool) */
  occupancyMin?: number;
  /** Hourly rate for EV/hourly parking */
  hourlyRate?: number;
}

/**
 * Lot/zone configuration for multi-lot resorts.
 */
export interface LotConfig {
  /** Unique identifier */
  id: string;
  /** Display name (e.g., "CREEKSIDE", "Orange Zone") */
  name: string;
  /** Zone grouping for color-coded systems (e.g., "orange", "blue" for Kirkwood) */
  zone?: string;
  /** Which reservation type IDs are available at this lot */
  reservationTypes: string[];
  /** Whether this lot requires advance reservation */
  requiresReservation?: boolean;
}

/**
 * Complete resort configuration.
 * Enables support for all HONK ski resort variations.
 */
export interface ResortConfig {
  /** Unique identifier (e.g., 'stevens-pass', 'whistler') */
  id: string;
  /** Display name (e.g., "Stevens Pass") */
  name: string;
  /** Base portal URL (e.g., "https://reservenski.parkstevenspass.com") */
  portalUrl: string;
  /** Type of booking flow this resort uses */
  bookingFlow: BookingFlowType;
  /** Available reservation types at this resort */
  reservationTypes: ReservationTypeConfig[];
  /** Lot/zone configuration (undefined = single-lot resort) */
  lots?: LotConfig[];
  /** Time after which parking is free (HH:MM format, e.g., "10:00") */
  freeAfterTime?: string;
  /** Maximum active reservations per account */
  maxReservations?: number;
  /** Minimum carpool occupancy (defaults to 4) */
  carpoolThreshold?: number;
  /** Whether phone verification is required */
  requiresPhoneVerification?: boolean;
}

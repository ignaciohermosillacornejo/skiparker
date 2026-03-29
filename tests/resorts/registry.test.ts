import { describe, it, expect, beforeEach } from 'vitest';
import { ResortRegistry } from '../../src/resorts/registry.js';
import type { ResortDescriptor } from '../../src/resorts/types.js';

const makeDescriptor = (overrides: Partial<ResortDescriptor> = {}): ResortDescriptor => ({
  id: 'test-resort',
  name: 'Test Resort',
  platform: 'test',
  urls: { base: 'https://test.example.com', login: '/login', reservations: '/reserve' },
  calendar: {
    container: '.cal',
    dayCellTemplate: '.day[data-date="{date}"]',
    dateFormat: 'data-date-iso',
    maxNavigationAttempts: 3,
  },
  availability: { rules: [] },
  lots: { supported: false },
  timing: {
    calendarLoadTimeout: 5000,
    calendarRenderDelay: 200,
    spaRenderDelay: 500,
    monthNavigationDelay: 200,
  },
  ...overrides,
});

describe('ResortRegistry', () => {
  let registry: ResortRegistry;

  beforeEach(() => {
    registry = new ResortRegistry();
  });

  describe('register + findById', () => {
    it('registers and retrieves a resort by id', () => {
      const desc = makeDescriptor();
      registry.register(desc);
      const resort = registry.findById('test-resort');
      expect(resort.descriptor).toBe(desc);
      expect(resort.hooks).toBeUndefined();
    });

    it('registers with hooks', () => {
      const desc = makeDescriptor();
      const hooks = { afterNavigate: async () => {} };
      registry.register(desc, hooks);
      const resort = registry.findById('test-resort');
      expect(resort.hooks).toBe(hooks);
    });

    it('throws on unknown id', () => {
      expect(() => registry.findById('nope'))
        .toThrow(/no resort registered with id "nope"/i);
    });
  });

  describe('findByUrl', () => {
    it('matches by normalized hostname', () => {
      registry.register(makeDescriptor({
        id: 'sp',
        urls: { base: 'https://reservenski.parkstevenspass.com', login: '/login', reservations: '/select-parking' },
      }));
      const resort = registry.findByUrl('https://reservenski.parkstevenspass.com');
      expect(resort.descriptor.id).toBe('sp');
    });

    it('normalizes trailing slashes', () => {
      registry.register(makeDescriptor({
        id: 'sp',
        urls: { base: 'https://example.com', login: '/login', reservations: '/' },
      }));
      expect(registry.findByUrl('https://example.com/').descriptor.id).toBe('sp');
    });

    it('normalizes case', () => {
      registry.register(makeDescriptor({
        id: 'sp',
        urls: { base: 'https://Example.COM', login: '/login', reservations: '/' },
      }));
      expect(registry.findByUrl('https://example.com').descriptor.id).toBe('sp');
    });

    it('strips protocol for matching', () => {
      registry.register(makeDescriptor({
        id: 'sp',
        urls: { base: 'https://example.com', login: '/login', reservations: '/' },
      }));
      expect(registry.findByUrl('http://example.com').descriptor.id).toBe('sp');
    });

    it('throws on no match with helpful message', () => {
      registry.register(makeDescriptor({ id: 'sp', name: 'Stevens Pass', urls: { base: 'https://sp.com', login: '/l', reservations: '/r' } }));
      registry.register(makeDescriptor({ id: 'cm', name: 'Crystal Mountain', urls: { base: 'https://cm.com', login: '/l', reservations: '/r' } }));
      expect(() => registry.findByUrl('https://unknown.com'))
        .toThrow(/Stevens Pass.*Crystal Mountain/s);
    });
  });

  describe('list', () => {
    it('returns all registered resorts', () => {
      registry.register(makeDescriptor({ id: 'a', name: 'Resort A' }));
      registry.register(makeDescriptor({ id: 'b', name: 'Resort B' }));
      const list = registry.list();
      expect(list).toHaveLength(2);
      expect(list.map(r => r.id)).toEqual(['a', 'b']);
    });

    it('returns empty array when no resorts registered', () => {
      expect(registry.list()).toEqual([]);
    });
  });
});

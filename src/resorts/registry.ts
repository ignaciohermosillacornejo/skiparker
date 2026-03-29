import type { ResortDescriptor, ResortHooks, ResolvedResort } from './types.js';

function normalizeUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

export class ResortRegistry {
  private resorts = new Map<string, ResolvedResort>();

  register(descriptor: ResortDescriptor, hooks?: ResortHooks): void {
    this.resorts.set(descriptor.id, { descriptor, hooks });
  }

  findById(id: string): ResolvedResort {
    const resort = this.resorts.get(id);
    if (!resort) {
      throw new Error(
        `No resort registered with id "${id}". Available: ${this.listIds().join(', ') || '(none)'}`,
      );
    }
    return resort;
  }

  findByUrl(url: string): ResolvedResort {
    const normalized = normalizeUrl(url);
    for (const resort of this.resorts.values()) {
      if (normalizeUrl(resort.descriptor.urls.base) === normalized) {
        return resort;
      }
    }
    const available = this.list()
      .map(r => `  ${r.name} — ${r.urls.base}`)
      .join('\n');
    throw new Error(
      `No resort matches URL "${url}". Supported resorts:\n${available || '  (none registered)'}`,
    );
  }

  list(): ResortDescriptor[] {
    return Array.from(this.resorts.values()).map(r => r.descriptor);
  }

  private listIds(): string[] {
    return Array.from(this.resorts.keys());
  }
}

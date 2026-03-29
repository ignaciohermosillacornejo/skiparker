import { ResortRegistry } from './registry.js';
import { descriptor as stevensPass } from './stevens-pass/descriptor.js';
import { hooks as stevensPassHooks } from './stevens-pass/hooks.js';
import { descriptor as crystalMountain } from './crystal-mountain/descriptor.js';

export const registry = new ResortRegistry();

registry.register(stevensPass, stevensPassHooks);
registry.register(crystalMountain);

export { ResortRegistry } from './registry.js';
export { ScraperEngine } from './engine.js';
export type { ResortDescriptor, ResortHooks, ResolvedResort } from './types.js';

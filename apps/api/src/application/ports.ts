import type { CityTips, CityTipsRequest } from '@wayfare/shared';

/**
 * Ports: what the use cases need from the outside world. Infrastructure implements them;
 * the application layer never imports a concrete SDK.
 */

export interface GeneratedTips {
  tips: CityTips;
  /** Model that produced the answer, stored with the cached result. */
  model: string;
}

export interface TipsGenerator {
  generate(request: CityTipsRequest): Promise<GeneratedTips>;
}

export interface StoredTips {
  tips: CityTipsWithLinks;
}

export interface TipsCache {
  find(stopId: string, inputHash: string, notOlderThan: Date): Promise<StoredTips | null>;
  save(entry: {
    tripId: string;
    stopId: string;
    locale: string;
    inputHash: string;
    model: string;
    tips: CityTipsWithLinks;
  }): Promise<void>;
}

export interface AiQuota {
  /** Counts one generation; false when today's limit is already used. */
  consume(): Promise<boolean>;
}

export interface BuyLinkBuilder {
  build(countryCode: string, searchQuery: string): string;
}

export type TipWithLink = CityTips['events'][number] & { buy_url: string };
export type CityTipsWithLinks = { [K in keyof CityTips]: TipWithLink[] };

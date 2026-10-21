import type { BuyLinkBuilder } from '../../application/ports.js';

type Template = (encodedQuery: string) => string;

/** Providers chosen per country for availability there; the default covers the rest. */
const TEMPLATES: Record<string, Template> = {
  CN: (q) => `https://www.trip.com/things-to-do/list?keyword=${q}`,
  JP: (q) => `https://www.klook.com/search/result/?query=${q}`,
};
const DEFAULT_TEMPLATE: Template = (q) => `https://www.getyourguide.com/s/?q=${q}`;

export class TemplateBuyLinks implements BuyLinkBuilder {
  build(countryCode: string, searchQuery: string): string {
    const template = TEMPLATES[countryCode.toUpperCase()] ?? DEFAULT_TEMPLATE;
    return template(encodeURIComponent(searchQuery));
  }
}

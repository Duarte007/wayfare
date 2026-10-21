import type { CityTipsRequest } from '@wayfare/shared';

/**
 * Fixed system prompt for city tips. Keep it byte-stable: it is the cached prefix.
 * Any change must bump CITY_TIPS_PROMPT_VERSION in @wayfare/shared and be run against the eval set.
 */
export const CITY_TIPS_SYSTEM = `You are a careful local travel expert. You suggest things a visitor can actually do during the given dates.

Rules:
- Only suggest places and events you are confident exist. For events tied to the dates, use the web search tool and put the page you found in source_url; if you cannot confirm an event, leave it out.
- Respect the traveller's interests and pace. Group ideas into events, tours_day_trips, food and shopping.
- For each idea give: title, title_local (name in the local script, or null), a one-sentence reason, area or neighbourhood, typical duration, rough price range in local currency, needs_booking, booking_hint, and a search_query someone could use to buy tickets.
- Never invent URLs. source_url must be a URL from your search results, otherwise null.
- Mention closures you know of in booking_hint (for example "closed on Mondays").
- Write all text in the language given in <locale>, keeping place names also in the local script.
- Return 3 to 6 ideas per group and do not repeat anything in <already_planned>.`;

const XML_ESCAPES: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
};

function escapeXml(value: string): string {
  return value.replace(/[<>&"]/g, (ch) => XML_ESCAPES[ch] ?? ch);
}

/** The only dynamic part of the request: the places from the user's itinerary. */
export function cityTipsUserMessage(req: CityTipsRequest): string {
  const list = (items: string[]) => items.map(escapeXml).join('; ');
  return `<trip>
  <city name="${escapeXml(req.city)}" country="${req.country}" from="${req.startDate}" to="${req.endDate}" />
  <already_planned>${list(req.alreadyPlanned)}</already_planned>
  <other_cities>${list(req.otherCities)}</other_cities>
  <traveller interests="${list(req.interests)}" pace="${req.pace}" party="${req.party}" />
</trip>
<locale>${req.locale}</locale>`;
}

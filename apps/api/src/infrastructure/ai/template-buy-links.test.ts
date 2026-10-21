import { describe, expect, it } from 'vitest';
import { TemplateBuyLinks } from './template-buy-links.js';

describe('TemplateBuyLinks', () => {
  it('builds provider links from the query, never from model URLs', () => {
    const links = new TemplateBuyLinks();
    expect(links.build('cn', 'Forbidden City tickets')).toBe(
      'https://www.trip.com/things-to-do/list?keyword=Forbidden%20City%20tickets',
    );
    expect(links.build('FR', 'Louvre')).toBe('https://www.getyourguide.com/s/?q=Louvre');
  });
});

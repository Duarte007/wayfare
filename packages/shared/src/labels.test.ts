import { describe, expect, it } from 'vitest';
import { learnBoosts, normalizeTitle, suggestLabel, suggestTitle } from './labels.js';

describe('normalizeTitle', () => {
  it('strips extension, accents and splits camelCase', () => {
    expect(normalizeTitle('CartãoDeEmbarque_LATAM.PDF')).toBe('cartao de embarque latam');
  });
});

describe('suggestLabel', () => {
  const cases: [string, string][] = [
    ['boarding-pass-CA1234.pdf', 'flight'],
    ['Cartão de embarque LATAM.pdf', 'flight'],
    ['登机牌_CA1234.pdf', 'flight'],
    ['搭乗券.pdf', 'flight'],
    ['火车票_G1234.pdf', 'train'],
    ['12306-order.png', 'train'],
    ['Reserva Hotel Xangai.pdf', 'stay'],
    ['酒店预订确认.pdf', 'stay'],
    ['Passaporte Matheus.jpg', 'passport'],
    ['パスポート.jpg', 'passport'],
    ['Seguro viagem - apólice.pdf', 'insurance'],
    ['Certificado vacina febre amarela.pdf', 'health'],
    ['Visto China.pdf', 'visa'],
    ['Forbidden City ingresso.pdf', 'activity'],
    // Destinations around the world
    ['Eurostar-London-Paris.pdf', 'train'],
    ['SNCF e-billet Lyon.pdf', 'train'],
    ['Trenitalia Roma Firenze.pdf', 'train'],
    ['Amtrak NYC to Boston.pdf', 'train'],
    ['ICE 578 Berlin.pdf', 'train'],
    ['FlixBus Lisboa Porto.pdf', 'bus_ferry'],
    ['Airbnb Lisbon.pdf', 'stay'],
    ['Booking.com confirmation Mexico City.pdf', 'stay'],
    ['Louvre museum tickets.pdf', 'activity'],
    ['ESTA approval USA.pdf', 'visa'],
    ['Canada eTA.pdf', 'visa'],
    ['India e-Visa.pdf', 'visa'],
    ['Estação de trem Porto.pdf', 'train'],
  ];
  it.each(cases)('%s -> %s', (name, label) => {
    expect(suggestLabel(name).label).toBe(label);
  });

  it('falls back to other with alternatives when unsure', () => {
    const s = suggestLabel('IMG_2041.jpg');
    expect(s.label).toBe('other');
    expect(s.confidence).toBe(0);
  });

  it('uses first-page text with lower weight', () => {
    expect(
      suggestLabel('scan001.pdf', { text: 'BOARDING PASS Gate 12 Seat 31A' }).alternatives[0],
    ).toBe('flight');
  });

  it('learns from corrections', () => {
    const boosts = learnBoosts('Klook-order-8812.pdf', 'activity');
    expect(suggestLabel('Klook-order-9931.pdf', { boosts }).label).toBe('activity');
  });
});

describe('suggestTitle', () => {
  it('extracts flight and train numbers', () => {
    expect(suggestTitle('ETKT_CA1234_SMITH_JOHN.pdf', 'flight')).toBe('Flight CA1234');
    expect(suggestTitle('火车票_G1234.pdf', 'train')).toBe('Train G1234');
    expect(suggestTitle('reserva_hotel_xangai.pdf', 'stay')).toBe('Reserva hotel xangai');
  });
});

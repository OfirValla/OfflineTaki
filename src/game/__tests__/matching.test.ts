import { Color } from '../cards/Card';
import { matchesPile, matchesTaki } from '../rules/matching';
import { card } from '../testing/fixtures';

describe('matchesPile', () => {
  const top = card.num(Color.Red, 5);

  it('accepts the active colour', () => {
    expect(matchesPile(card.num(Color.Red, 9), top, Color.Red)).toBe(true);
    expect(matchesPile(card.stop(Color.Red), top, Color.Red)).toBe(true);
  });

  it('accepts the same number in another colour', () => {
    expect(matchesPile(card.num(Color.Blue, 5), top, Color.Red)).toBe(true);
  });

  it('rejects a different colour and number', () => {
    expect(matchesPile(card.num(Color.Blue, 7), top, Color.Red)).toBe(false);
    expect(matchesPile(card.stop(Color.Blue), top, Color.Red)).toBe(false);
  });

  it('accepts the same action symbol in another colour', () => {
    expect(
      matchesPile(card.stop(Color.Blue), card.stop(Color.Red), Color.Red),
    ).toBe(true);
    expect(
      matchesPile(card.plus(Color.Green), card.stop(Color.Red), Color.Red),
    ).toBe(false);
  });

  it('uses the active colour rather than the printed colour after a Change Color', () => {
    const wild = card.wild();
    expect(matchesPile(card.num(Color.Green, 1), wild, Color.Green)).toBe(true);
    expect(matchesPile(card.num(Color.Red, 1), wild, Color.Green)).toBe(false);
  });

  it('always accepts a wild card', () => {
    expect(matchesPile(card.wild(), top, Color.Red)).toBe(true);
    expect(matchesPile(card.wild(), card.stop(Color.Blue), Color.Blue)).toBe(
      true,
    );
  });
});

describe('matchesTaki', () => {
  it('accepts only the TAKI colour and never wilds', () => {
    expect(matchesTaki(card.num(Color.Red, 1), Color.Red)).toBe(true);
    expect(matchesTaki(card.plus(Color.Red), Color.Red)).toBe(true);
    expect(matchesTaki(card.num(Color.Blue, 1), Color.Red)).toBe(false);
    expect(matchesTaki(card.wild(), Color.Red)).toBe(false);
  });
});

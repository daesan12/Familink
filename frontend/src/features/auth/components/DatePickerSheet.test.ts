import {parseDate} from './DatePickerSheet';

describe('date picker initial value', () => {
  const today = new Date(2026, 6, 29);

  it('uses today when no birth date has been selected', () => {
    expect(parseDate('', today)).toEqual({
      year: 2026,
      month: 7,
      day: 29,
    });
  });

  it('keeps a valid selected birth date', () => {
    expect(parseDate('2001-02-03', today)).toEqual({
      year: 2001,
      month: 2,
      day: 3,
    });
  });
});

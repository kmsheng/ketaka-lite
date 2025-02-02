jest.unmock('lodash');
jest.unmock('./../getNonContinuousPageNames');
jest.unmock('./../../constants/regexpPage');

const getNonContinuousPageNames = require('../getNonContinuousPageNames').default;

describe('getNonContinuousPageNames', () => {

  it('should be able to check missing [abcd]', () => {
    const input = ['1-1-1b'];
    const output = {
      pageNames: ['1-1-1a'],
      mixedStartedIds: [],
      breakPoints: []
    };
    expect(getNonContinuousPageNames(input)).toEqual(output);
  });

  it('1-1-1 -> 1-1-3 should be checked', () => {
    const input = ['1-1-1', '1-1-3'];
    const output = {
      pageNames: [],
      mixedStartedIds: [],
      breakPoints: [
        ['1-1-1', '1-1-3']
      ]
    };
    expect(getNonContinuousPageNames(input)).toEqual(output);
  });

  it('1-1-1 -> 1-2-0 should NOT be checked', () => {
    const input = ['1-1-1', '1-2-0'];
    const output = {
      pageNames: [],
      mixedStartedIds: [],
      breakPoints: []
    };
    expect(getNonContinuousPageNames(input)).toEqual(output);
  });

  it('1-1-1 -> 1-2-1 should NOT be checked', () => {
    const input = ['1-1-1', '1-2-1'];
    const output = {
      pageNames: [],
      mixedStartedIds: [],
      breakPoints: []
    };
    expect(getNonContinuousPageNames(input)).toEqual(output);
  });

  it('1-1-1 -> 1-2-3 should be checked', () => {
    const input = ['1-1-1', '1-2-3'];
    const output = {
      pageNames: [],
      mixedStartedIds: [],
      breakPoints: [
        ['1-1-1', '1-2-3']
      ]
    };
    expect(getNonContinuousPageNames(input)).toEqual(output);
  });

  it('1-1-1 -> 3-2-1 should be checked', () => {
    const input = ['1-1-1', '3-2-1'];
    const output = {
      pageNames: [],
      mixedStartedIds: [],
      breakPoints: [
        ['1-1-1', '3-2-1']
      ]
    };
    expect(getNonContinuousPageNames(input)).toEqual(output);
  });

  it('1-1-1a -> 3-2-1b should be checked', () => {
    const input = ['1-1-1a', '3-2-1b'];
    const output = {
      pageNames: ['1-1-1b', '3-2-1a'],
      mixedStartedIds: [],
      breakPoints: [
        ['1-1-1a', '3-2-1b']
      ]
    };
    expect(getNonContinuousPageNames(input)).toEqual(output);
  });
});


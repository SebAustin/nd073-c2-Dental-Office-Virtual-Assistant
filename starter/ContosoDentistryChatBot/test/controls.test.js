const { matchControl, CONTROLS } = require('../src/controls');

describe('matchControl', () => {
    test.each([
        ['start over', CONTROLS.START_OVER],
        ['Start Over!', CONTROLS.START_OVER],
        ['restart', CONTROLS.START_OVER],
        ['cancel', CONTROLS.CANCEL],
        ['stop', CONTROLS.CANCEL],
        ['Forget my appointment', CONTROLS.FORGET],
        ['forget my appointment time', CONTROLS.FORGET]
    ])('recognises %p', (text, expected) => {
        expect(matchControl(text)).toBe(expected);
    });

    test.each([
        'can I cancel my appointment by phone?',
        'what is your cancellation policy',
        'please stop by on Monday'
    ])('does not treat the question %p as a control', (text) => {
        expect(matchControl(text)).toBeUndefined();
    });

    test('ignores empty input', () => {
        expect(matchControl('')).toBeUndefined();
        expect(matchControl(undefined)).toBeUndefined();
    });
});

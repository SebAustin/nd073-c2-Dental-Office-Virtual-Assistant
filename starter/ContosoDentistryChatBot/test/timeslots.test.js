const { parseTimeSlot, fromClockValue, findOfferedSlot, parseBookCommand } = require('../src/timeslots');

describe('parseTimeSlot', () => {
    test.each([
        ['10am', '10am'],
        ['10 AM', '10am'],
        ['at 2pm please', '2pm'],
        ['12pm', '12pm'],
        ['3:00 pm', '3pm'],
        ['10', '10am'],
        ['2', '2pm'],
        ['noon', '12pm']
    ])('reads %p as %p', (text, expected) => {
        expect(parseTimeSlot(text)).toBe(expected);
    });

    test('returns undefined when the text has no time', () => {
        expect(parseTimeSlot('do you take insurance?')).toBeUndefined();
    });

    test('returns undefined for non-string input', () => {
        expect(parseTimeSlot(undefined)).toBeUndefined();
    });

    test('ignores minutes other than on the hour', () => {
        expect(parseTimeSlot('10:30am')).toBeUndefined();
    });
});

describe('fromClockValue', () => {
    test.each([
        ['10:00:00', '10am'],
        ['13:00:00', '1pm'],
        ['12:00:00', '12pm'],
        ['00:00:00', '12am'],
        ['T16', '4pm'],
        ['2026-11-06 09:00:00', '9am']
    ])('converts %p to %p', (value, expected) => {
        expect(fromClockValue(value)).toBe(expected);
    });

    test('returns undefined for unreadable values', () => {
        expect(fromClockValue('tomorrow')).toBeUndefined();
        expect(fromClockValue(null)).toBeUndefined();
    });

    test('returns undefined when the time is not on the hour', () => {
        expect(fromClockValue('10:30:00')).toBeUndefined();
    });
});

describe('findOfferedSlot', () => {
    const availability = ['8am', '9am', '10am', '1pm'];

    test('finds a slot the scheduler offers', () => {
        expect(findOfferedSlot('10am', availability)).toBe('10am');
    });

    test('returns undefined for a slot not offered', () => {
        expect(findOfferedSlot('7pm', availability)).toBeUndefined();
    });

    test('compares case-insensitively', () => {
        expect(findOfferedSlot('1pm', ['1PM'])).toBe('1PM');
    });
});

describe('parseBookCommand', () => {
    test('reads the time from a suggested-action reply', () => {
        expect(parseBookCommand('Book 10am')).toBe('10am');
    });

    test('ignores other messages', () => {
        expect(parseBookCommand('I want to book an appointment')).toBeUndefined();
    });
});

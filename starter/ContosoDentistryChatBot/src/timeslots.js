// Time slots are times of day such as "10am" (see GLOSSARY.md). These helpers turn
// what a patient types, or what CLU resolves, into that one canonical form.

const SPOKEN_TIME = /\b(1[0-2]|0?[1-9])(?::(\d{2}))?\s*([ap])?\.?\s*m?\.?(?![a-z])/i;
const CLOCK_VALUE = /(?:^|T|\s)(\d{1,2})(?::(\d{2}))?(?::\d{2})?$/;
const BOOK_COMMAND = /^book\s+(.+)$/i;

// The office opens at 8am, so a bare "8".."11" means morning and "12", "1".."7" afternoon.
const FIRST_MORNING_HOUR = 8;
const NOON = 12;

/**
 * @param {number} hour24 0-23
 * @returns {string} e.g. "1pm"
 */
function formatHour(hour24) {
    const suffix = hour24 < NOON ? 'am' : 'pm';
    const hour12 = hour24 % NOON === 0 ? NOON : hour24 % NOON;
    return `${ hour12 }${ suffix }`;
}

/**
 * Reads a time slot from free text ("at 2pm", "10 AM", "noon", "10").
 * @param {unknown} text
 * @returns {string | undefined}
 */
function parseTimeSlot(text) {
    if (typeof text !== 'string') return undefined;
    if (/\bnoon\b/i.test(text)) return formatHour(NOON);

    const match = text.match(SPOKEN_TIME);
    if (!match) return undefined;

    const [, hourText, minutes, meridiem] = match;
    if (minutes && minutes !== '00') return undefined;

    const hour = Number(hourText);
    if (meridiem) {
        const isPm = meridiem.toLowerCase() === 'p';
        return formatHour((hour % NOON) + (isPm ? NOON : 0));
    }
    const isMorning = hour >= FIRST_MORNING_HOUR && hour < NOON;
    return formatHour(isMorning || hour === NOON ? hour : hour + NOON);
}

/**
 * Converts a CLU DateTime resolution ("10:00:00", "T16", "2026-11-06 09:00:00").
 * @param {unknown} value
 * @returns {string | undefined}
 */
function fromClockValue(value) {
    if (typeof value !== 'string') return undefined;
    const match = value.trim().match(CLOCK_VALUE);
    if (!match) return undefined;

    const [, hourText, minutes] = match;
    if (minutes && minutes !== '00') return undefined;

    const hour = Number(hourText);
    return hour >= 0 && hour < 24 ? formatHour(hour) : undefined;
}

/**
 * @param {string} slot canonical slot, e.g. "10am"
 * @param {readonly string[]} availability slots the scheduler offers
 * @returns {string | undefined} the scheduler's own spelling of the slot
 */
function findOfferedSlot(slot, availability) {
    const wanted = slot.toLowerCase();
    return availability.find((offered) => offered.toLowerCase() === wanted);
}

/**
 * Reads the slot from a tap on a "Book 10am" suggested action.
 * @param {string} text
 * @returns {string | undefined}
 */
function parseBookCommand(text) {
    const match = text.trim().match(BOOK_COMMAND);
    return match ? parseTimeSlot(match[1]) : undefined;
}

module.exports = { parseTimeSlot, fromClockValue, findOfferedSlot, parseBookCommand, formatHour };

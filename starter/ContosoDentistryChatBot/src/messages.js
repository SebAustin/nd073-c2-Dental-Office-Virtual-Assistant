// Every sentence the assistant says lives here, so tone stays consistent and tests can
// assert on behaviour without copying prose.

const PRACTICE_PHONE = '(555) 010-2024';

const messages = Object.freeze({
    welcome: [
        'Hi, I\'m Denta, the virtual assistant for Contoso Dentistry. 🦷',
        'I can:',
        '• show which appointment times are open — try "What appointments are available?"',
        '• book a time for you — try "Book me in at 10am"',
        '• answer questions about insurance, kids, our hours, location and team — try "I don\'t have insurance. Can I still be seen?"',
        '',
        'Say "start over" to begin again, "cancel" to stop a booking, or "forget my appointment" to clear the time I\'m holding.'
    ].join('\n'),

    availability: (slots) => `Here are the open appointment times: ${ slots.join(', ') }. Tap one to book it.`,
    noAvailability: 'There are no open appointment times right now. Please call us on ' + PRACTICE_PHONE + '.',
    askForSlot: (slots) => `Sure — which time works for you? Open times: ${ slots.join(', ') }.`,
    slotNotOffered: (slot, slots) => `Sorry, ${ slot } isn't available. Open times: ${ slots.join(', ') }.`,

    booked: (slot) => `An appointment is set for ${ slot }. See you then!`,
    alreadyBooked: (slot) => `You're already booked for ${ slot }.`,
    moved: (from, to) => `I've moved your appointment from ${ from } to ${ to }.`,

    cancelled: 'Okay, I won\'t book anything. Ask me about open times whenever you\'re ready.',
    nothingToCancel: 'There\'s nothing in progress to cancel. How else can I help?',
    forgotten: (slot) => `I've forgotten your ${ slot } appointment. To cancel it with the office, please call ${ PRACTICE_PHONE }.`,
    nothingToForget: 'I\'m not holding an appointment for you in this conversation.',
    startingOver: 'No problem — let\'s start over.',

    schedulerDown: 'Sorry, I can\'t reach our scheduling system right now. Please try again in a moment or call ' + PRACTICE_PHONE + '.',
    fallback: 'I\'m not sure I can help with that. I can show open appointment times, book one for you, or answer questions about our practice — insurance, kids, hours, location and team.'
});

module.exports = { messages, PRACTICE_PHONE };

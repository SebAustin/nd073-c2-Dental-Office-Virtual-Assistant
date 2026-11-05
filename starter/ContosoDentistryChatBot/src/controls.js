// Conversation controls are matched as whole phrases before any language service runs,
// so they always work and never swallow a real question such as
// "can I cancel my appointment by phone?".

const CONTROLS = Object.freeze({
    START_OVER: 'startOver',
    CANCEL: 'cancel',
    FORGET: 'forgetAppointment'
});

const PHRASES = Object.freeze({
    'start over': CONTROLS.START_OVER,
    restart: CONTROLS.START_OVER,
    'start again': CONTROLS.START_OVER,
    cancel: CONTROLS.CANCEL,
    stop: CONTROLS.CANCEL,
    'never mind': CONTROLS.CANCEL,
    nevermind: CONTROLS.CANCEL,
    'forget my appointment': CONTROLS.FORGET,
    'forget my appointment time': CONTROLS.FORGET,
    'forget appointment': CONTROLS.FORGET
});

/**
 * @param {unknown} text
 * @returns {string | undefined} one of CONTROLS
 */
function matchControl(text) {
    if (typeof text !== 'string') return undefined;
    const normalised = text.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
    return PHRASES[normalised];
}

module.exports = { matchControl, CONTROLS };

const { TestAdapter, ConversationState, MemoryStorage, ActivityTypes } = require('botbuilder');
const { DentaBot } = require('../bot');
const { messages } = require('../src/messages');

const SLOTS = ['8am', '9am', '10am', '2pm'];

function makeBot({ recognition, answer, availability = SLOTS, recognizeError, answerError, schedulerError } = {}) {
    const recognizer = {
        recognize: jest.fn(async () => {
            if (recognizeError) throw recognizeError;
            return recognition || { intent: 'None', confidence: 0.9, slot: undefined };
        })
    };
    const answerer = {
        getAnswer: jest.fn(async () => {
            if (answerError) throw answerError;
            return answer;
        })
    };
    const scheduler = {
        getAvailability: jest.fn(async () => {
            if (schedulerError) throw schedulerError;
            return availability;
        }),
        scheduleAppointment: jest.fn(async (time) => ({ time }))
    };
    const logger = { error: jest.fn() };
    const bot = new DentaBot({
        recognizer,
        answerer,
        scheduler,
        logger,
        conversationState: new ConversationState(new MemoryStorage()),
        thresholds: { intent: 0.6, answer: 0.5 }
    });
    const adapter = new TestAdapter(async (context) => bot.run(context));
    return { adapter, recognizer, answerer, scheduler, logger };
}

const scheduling = (intent, confidence = 0.9, slot) => ({ intent, confidence, slot });
const buttonValues = (activity) => activity.suggestedActions.actions.map((action) => action.value);

describe('welcome', () => {
    test('greets a new patient with what the assistant can do', async () => {
        const { adapter } = makeBot();
        await adapter
            .send({ type: ActivityTypes.ConversationUpdate, membersAdded: [{ id: 'patient', name: 'Patient' }] })
            .assertReply(messages.welcome);
    });

    test('greets once when the website chat joins', async () => {
        const { adapter } = makeBot();
        await adapter
            .send({ type: ActivityTypes.Event, name: 'webchat/join' })
            .assertReply(messages.welcome)
            .send({ type: ActivityTypes.Event, name: 'webchat/join' })
            .assertNoReply();
    });

    test('does not greet twice when a join event follows the member-added greeting', async () => {
        const { adapter } = makeBot();
        await adapter
            .send({ type: ActivityTypes.ConversationUpdate, membersAdded: [{ id: 'patient', name: 'Patient' }] })
            .assertReply(messages.welcome)
            .send({ type: ActivityTypes.Event, name: 'webchat/join' })
            .assertNoReply();
    });

    test('ignores unrelated events', async () => {
        const { adapter } = makeBot();
        await adapter.send({ type: ActivityTypes.Event, name: 'something/else' }).assertNoReply();
    });

    test('does not greet the bot itself', async () => {
        const { adapter } = makeBot();
        await adapter
            .send({ type: ActivityTypes.ConversationUpdate, membersAdded: [{ id: 'bot', name: 'Bot' }], recipient: { id: 'bot' } })
            .assertNoReply();
    });
});

describe('availability', () => {
    test('lists open time slots with tap-to-book buttons', async () => {
        const { adapter } = makeBot({ recognition: scheduling('GetAvailability') });
        await adapter.send('What appointments are available?').assertReply((activity) => {
            expect(activity.text).toBe(messages.availability(SLOTS));
            expect(buttonValues(activity)).toEqual(['Book 8am', 'Book 9am', 'Book 10am', 'Book 2pm']);
        });
    });

    test('says so when nothing is open', async () => {
        const { adapter } = makeBot({ recognition: scheduling('GetAvailability'), availability: [] });
        await adapter.send('any times?').assertReply(messages.noAvailability);
    });

    test('apologises when the scheduler is unreachable', async () => {
        const { adapter, logger } = makeBot({ recognition: scheduling('GetAvailability'), schedulerError: new Error('down') });
        await adapter.send('any times?').assertReply(messages.schedulerDown);
        expect(logger.error).toHaveBeenCalled();
    });
});

describe('booking', () => {
    test('books a requested time immediately', async () => {
        const { adapter, scheduler } = makeBot({ recognition: scheduling('ScheduleAppointment', 0.9, '10am') });
        await adapter.send('Book me in at 10am').assertReply(messages.booked('10am'));
        expect(scheduler.scheduleAppointment).toHaveBeenCalledWith('10am');
    });

    test('books from a tapped button without asking CLU', async () => {
        const { adapter, recognizer } = makeBot();
        await adapter.send('Book 9am').assertReply(messages.booked('9am'));
        expect(recognizer.recognize).not.toHaveBeenCalled();
    });

    test('asks for a time when none was given, then books the bare reply', async () => {
        const { adapter, recognizer } = makeBot({ recognition: scheduling('ScheduleAppointment') });
        await adapter
            .send('I need an appointment')
            .assertReply((activity) => {
                expect(activity.text).toBe(messages.askForSlot(SLOTS));
                expect(buttonValues(activity)).toContain('Book 10am');
            })
            .send('10am')
            .assertReply(messages.booked('10am'));
        expect(recognizer.recognize).toHaveBeenCalledTimes(1);
    });

    test('lists open times when the requested time is not offered', async () => {
        const { adapter, scheduler } = makeBot({ recognition: scheduling('ScheduleAppointment', 0.9, '7pm') });
        await adapter.send('book 7pm please').assertReply(messages.slotNotOffered('7pm', SLOTS));
        expect(scheduler.scheduleAppointment).not.toHaveBeenCalled();
    });

    test('moves an existing appointment to the new time', async () => {
        const { adapter } = makeBot();
        await adapter
            .send('Book 9am').assertReply(messages.booked('9am'))
            .send('Book 2pm').assertReply(messages.moved('9am', '2pm'));
    });

    test('notices when the patient rebooks the same time', async () => {
        const { adapter } = makeBot();
        await adapter
            .send('Book 9am').assertReply(messages.booked('9am'))
            .send('Book 9am').assertReply(messages.alreadyBooked('9am'));
    });

    test('apologises when booking fails', async () => {
        const { adapter, scheduler } = makeBot();
        scheduler.scheduleAppointment.mockRejectedValueOnce(new Error('boom'));
        await adapter.send('Book 9am').assertReply(messages.schedulerDown);
    });

    test('does not treat a long sentence with a number as a slot reply', async () => {
        const { adapter } = makeBot({ recognition: scheduling('ScheduleAppointment'), answer: undefined });
        await adapter
            .send('I need an appointment').assertReply(messages.askForSlot(SLOTS))
            .send('I have 2 kids who also need a check up')
            .assertReply(messages.askForSlot(SLOTS));
    });
});

describe('routing between scheduling and the knowledge base', () => {
    test('answers from the knowledge base when no scheduling intent is confident', async () => {
        const { adapter } = makeBot({
            recognition: scheduling('ScheduleAppointment', 0.4),
            answer: { answer: 'We accept patients no matter their insurance situation.', confidence: 0.92 }
        });
        await adapter.send('I don\'t have insurance. Can I still be seen?')
            .assertReply('We accept patients no matter their insurance situation.');
    });

    test('prefers a confident scheduling intent over a knowledge base answer', async () => {
        const { adapter } = makeBot({
            recognition: scheduling('GetAvailability', 0.8),
            answer: { answer: 'Some FAQ', confidence: 0.9 }
        });
        await adapter.send('what times are open').assertReply(messages.availability(SLOTS));
    });

    test('ignores the None intent even when confident', async () => {
        const { adapter } = makeBot({
            recognition: scheduling('None', 0.99),
            answer: { answer: 'We are open Monday to Friday.', confidence: 0.8 }
        });
        await adapter.send('when are you open').assertReply('We are open Monday to Friday.');
    });

    test('sends the fallback when neither service is confident', async () => {
        const { adapter } = makeBot({ recognition: scheduling('None', 0.3), answer: { answer: 'meh', confidence: 0.2 } });
        await adapter.send('what is the capital of France').assertReply(messages.fallback);
    });

    test('still answers from the knowledge base when CLU fails', async () => {
        const { adapter, logger } = makeBot({ recognizeError: new Error('CLU down'), answer: { answer: 'Yes!', confidence: 0.9 } });
        await adapter.send('are you accepting new patients').assertReply('Yes!');
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('CLU'), expect.any(Error));
    });

    test('still handles scheduling when the knowledge base fails', async () => {
        const { adapter } = makeBot({ recognition: scheduling('GetAvailability'), answerError: new Error('CQA down') });
        await adapter.send('any openings?').assertReply(messages.availability(SLOTS));
    });

    test('sends the fallback for an empty message', async () => {
        const { adapter } = makeBot();
        await adapter.send('   ').assertReply(messages.fallback);
    });
});

describe('conversation controls', () => {
    test('start over clears the held appointment and greets again', async () => {
        const { adapter } = makeBot();
        await adapter
            .send('Book 9am').assertReply(messages.booked('9am'))
            .send('start over').assertReply(messages.startingOver).assertReply(messages.welcome)
            .send('forget my appointment').assertReply(messages.nothingToForget);
    });

    test('cancel stops a booking in progress', async () => {
        const { adapter, scheduler } = makeBot({ recognition: scheduling('ScheduleAppointment') });
        await adapter
            .send('I want to book').assertReply(messages.askForSlot(SLOTS))
            .send('cancel').assertReply(messages.cancelled)
            .send('cancel').assertReply(messages.nothingToCancel);
        expect(scheduler.scheduleAppointment).not.toHaveBeenCalled();
    });

    test('forget my appointment clears the held time and is honest about the office', async () => {
        const { adapter } = makeBot();
        await adapter
            .send('Book 10am').assertReply(messages.booked('10am'))
            .send('forget my appointment').assertReply(messages.forgotten('10am'))
            .send('forget my appointment').assertReply(messages.nothingToForget);
    });

    test('controls never reach the language services', async () => {
        const { adapter, recognizer, answerer } = makeBot();
        await adapter.send('stop').assertReply(messages.nothingToCancel);
        expect(recognizer.recognize).not.toHaveBeenCalled();
        expect(answerer.getAnswer).not.toHaveBeenCalled();
    });
});

describe('construction', () => {
    test('requires its services', () => {
        expect(() => new DentaBot()).toThrow('[DentaBot]: Missing parameter');
    });
});

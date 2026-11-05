// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Contoso Dentistry changes: CLU + Custom Question Answering routing, conversation memory,
// and conversation controls (start over / cancel / forget my appointment).

const { ActivityHandler, MessageFactory } = require('botbuilder');
const { CONTROLS, matchControl } = require('./src/controls');
const { messages } = require('./src/messages');
const { SchedulingFlow } = require('./src/schedulingflow');
const { parseBookCommand, parseTimeSlot } = require('./src/timeslots');

const SCHEDULING_INTENTS = Object.freeze({ GET_AVAILABILITY: 'GetAvailability', SCHEDULE_APPOINTMENT: 'ScheduleAppointment' });
const INITIAL_MEMORY = Object.freeze({ awaitingSlot: false, appointment: undefined, greeted: false });
const WEBCHAT_JOIN_EVENT = 'webchat/join';
const MAX_WORDS_IN_SLOT_REPLY = 4;

class DentaBot extends ActivityHandler {
    /**
     * @param {{
     *   recognizer: { recognize(text: string): Promise<{ intent: string, confidence: number, slot?: string }> },
     *   answerer: { getAnswer(text: string): Promise<{ answer: string, confidence: number } | undefined> },
     *   scheduler: { getAvailability(): Promise<string[]>, scheduleAppointment(time: string): Promise<unknown> },
     *   conversationState: import('botbuilder').ConversationState,
     *   thresholds: { intent: number, answer: number },
     *   logger?: { error(message: string, error: unknown): void }
     * }} services
     */
    constructor(services) {
        super();
        if (!services || !services.recognizer || !services.answerer || !services.scheduler || !services.conversationState) {
            throw new Error('[DentaBot]: Missing parameter. recognizer, answerer, scheduler and conversationState are required');
        }
        this.recognizer = services.recognizer;
        this.answerer = services.answerer;
        this.conversationState = services.conversationState;
        this.thresholds = services.thresholds;
        this.logger = services.logger || console;
        this.memoryAccessor = services.conversationState.createProperty('dentaMemory');
        this.scheduling = new SchedulingFlow(services.scheduler, this.logger);

        this.onMessage(async (context, next) => {
            const text = (context.activity.text || '').trim();
            const memory = await this.memoryAccessor.get(context, INITIAL_MEMORY);
            const step = await this.respond(text, memory);

            for (const reply of [].concat(step.reply)) {
                await context.sendActivity(reply);
            }
            await this.memoryAccessor.set(context, step.memory);
            await this.conversationState.saveChanges(context);
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const newcomers = context.activity.membersAdded.filter((member) => member.id !== context.activity.recipient.id);
            if (newcomers.length) await this.greetOnce(context);
            await next();
        });

        // Web Chat over Direct Line often sends no member-added update until the patient speaks,
        // so the website posts a "webchat/join" event as soon as it connects.
        this.onEvent(async (context, next) => {
            if (context.activity.name === WEBCHAT_JOIN_EVENT) await this.greetOnce(context);
            await next();
        });
    }

    /** Sends the welcome unless this conversation has already been greeted. */
    async greetOnce(context) {
        const memory = await this.memoryAccessor.get(context, INITIAL_MEMORY);
        if (memory.greeted) return;
        await context.sendActivity(MessageFactory.text(messages.welcome, messages.welcome));
        await this.memoryAccessor.set(context, { ...memory, greeted: true });
        await this.conversationState.saveChanges(context);
    }

    /**
     * Decides the reply: controls first, then direct slot replies, then CLU, then the knowledge base.
     * @param {string} text @param {{ awaitingSlot: boolean, appointment?: string }} memory
     */
    async respond(text, memory) {
        if (!text) return { reply: messages.fallback, memory };

        const control = matchControl(text);
        if (control) return this.handleControl(control, memory);

        const directSlot = parseBookCommand(text) || (memory.awaitingSlot && this.parseSlotReply(text));
        if (directSlot) return this.scheduling.book(directSlot, memory);

        const [recognition, answer] = await this.understand(text);
        const isConfidentIntent = recognition && recognition.confidence >= this.thresholds.intent;

        if (isConfidentIntent && recognition.intent === SCHEDULING_INTENTS.GET_AVAILABILITY) {
            return this.scheduling.showAvailability(memory);
        }
        if (isConfidentIntent && recognition.intent === SCHEDULING_INTENTS.SCHEDULE_APPOINTMENT) {
            return recognition.slot ? this.scheduling.book(recognition.slot, memory) : this.scheduling.askForSlot(memory);
        }
        if (answer && answer.confidence >= this.thresholds.answer) {
            return { reply: answer.answer, memory };
        }
        return { reply: messages.fallback, memory };
    }

    /** Asks CLU and the knowledge base in parallel; one failing never blocks the other. */
    async understand(text) {
        const [recognition, answer] = await Promise.allSettled([this.recognizer.recognize(text), this.answerer.getAnswer(text)]);
        if (recognition.status === 'rejected') this.logger.error('[CLU] recognition failed', recognition.reason);
        if (answer.status === 'rejected') this.logger.error('[CQA] question answering failed', answer.reason);
        return [recognition.value, answer.value];
    }

    /** A short reply such as "10am" or "2 please" while the bot is waiting for a time. */
    parseSlotReply(text) {
        return text.split(/\s+/).length <= MAX_WORDS_IN_SLOT_REPLY ? parseTimeSlot(text) : undefined;
    }

    handleControl(control, memory) {
        switch (control) {
        case CONTROLS.START_OVER:
            return { reply: [messages.startingOver, messages.welcome], memory: { ...INITIAL_MEMORY, greeted: true } };
        case CONTROLS.CANCEL:
            return memory.awaitingSlot
                ? { reply: messages.cancelled, memory: { ...memory, awaitingSlot: false } }
                : { reply: messages.nothingToCancel, memory };
        default:
            return memory.appointment
                ? { reply: messages.forgotten(memory.appointment), memory: { ...memory, awaitingSlot: false, appointment: undefined } }
                : { reply: messages.nothingToForget, memory };
        }
    }
}

module.exports.DentaBot = DentaBot;

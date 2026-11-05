// The scheduling half of the conversation: listing availability and booking appointments.
// Each step returns the reply to send plus the next conversation memory; nothing here mutates state.

const { ActionTypes, MessageFactory } = require('botbuilder');
const { messages } = require('./messages');
const { findOfferedSlot } = require('./timeslots');

/**
 * @typedef {{ awaitingSlot: boolean, appointment: string | undefined }} Memory
 * @typedef {{ reply: string | Partial<import('botbuilder').Activity>, memory: Memory }} Step
 */

/** @param {readonly string[]} slots */
function slotButtons(slots) {
    return slots.map((slot) => ({ type: ActionTypes.ImBack, title: slot, value: `Book ${ slot }` }));
}

/** @param {string} text @param {readonly string[]} slots */
function withSlotButtons(text, slots) {
    return MessageFactory.suggestedActions(slotButtons(slots), text);
}

class SchedulingFlow {
    /**
     * @param {{ getAvailability(): Promise<string[]>, scheduleAppointment(time: string): Promise<unknown> }} scheduler
     * @param {{ error(message: string, error: unknown): void }} logger
     */
    constructor(scheduler, logger) {
        this.scheduler = scheduler;
        this.logger = logger;
    }

    /** @param {Memory} memory @returns {Promise<Step>} */
    async showAvailability(memory) {
        return this.withAvailability(memory, (slots) => ({
            reply: slots.length ? withSlotButtons(messages.availability(slots), slots) : messages.noAvailability,
            memory
        }));
    }

    /** @param {Memory} memory @returns {Promise<Step>} */
    async askForSlot(memory) {
        return this.withAvailability(memory, (slots) => ({
            reply: slots.length ? withSlotButtons(messages.askForSlot(slots), slots) : messages.noAvailability,
            memory: { ...memory, awaitingSlot: slots.length > 0 }
        }));
    }

    /**
     * Books the slot if offered; replaces any appointment already held in this conversation.
     * @param {string} requested @param {Memory} memory @returns {Promise<Step>}
     */
    async book(requested, memory) {
        let slots;
        try {
            slots = await this.scheduler.getAvailability();
        } catch (error) {
            return this.schedulerDown(error, memory);
        }

        const offered = findOfferedSlot(requested, slots);
        if (!offered) {
            return { reply: withSlotButtons(messages.slotNotOffered(requested, slots), slots), memory: { ...memory, awaitingSlot: true } };
        }
        if (memory.appointment === offered) {
            return { reply: messages.alreadyBooked(offered), memory: { ...memory, awaitingSlot: false } };
        }

        try {
            await this.scheduler.scheduleAppointment(offered);
        } catch (error) {
            return this.schedulerDown(error, memory);
        }
        const reply = memory.appointment ? messages.moved(memory.appointment, offered) : messages.booked(offered);
        return { reply, memory: { awaitingSlot: false, appointment: offered } };
    }

    /** @private */
    async withAvailability(memory, toStep) {
        try {
            return toStep(await this.scheduler.getAvailability());
        } catch (error) {
            return this.schedulerDown(error, memory);
        }
    }

    /** @private */
    schedulerDown(error, memory) {
        this.logger.error('[Scheduler] request failed', error);
        return { reply: messages.schedulerDown, memory };
    }
}

module.exports = { SchedulingFlow };

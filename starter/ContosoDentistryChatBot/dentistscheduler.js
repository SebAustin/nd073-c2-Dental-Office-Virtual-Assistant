// Client for the Dentist Scheduler, a third-party API we do not control (see GLOSSARY.md).

const { joinUrl, requestJson } = require('./src/http');

class DentistScheduler {
    /**
     * @param {{ SchedulerEndpoint: string }} configuration
     * @param {typeof fetch} [fetchImpl]
     */
    constructor(configuration, fetchImpl = fetch) {
        this.endpoint = configuration.SchedulerEndpoint;
        this.fetchImpl = fetchImpl;
    }

    /** @returns {Promise<string[]>} the time slots currently offered */
    async getAvailability() {
        const slots = await requestJson(this.fetchImpl, joinUrl(this.endpoint, 'availability'), { service: 'Scheduler' });
        const isSlotList = Array.isArray(slots) && slots.every((slot) => typeof slot === 'string');
        if (!isSlotList) throw new Error('Scheduler returned an unexpected availability payload');
        return slots;
    }

    /**
     * @param {string} time a time slot such as "10am"
     * @returns {Promise<unknown>} the scheduler's confirmation
     */
    async scheduleAppointment(time) {
        return requestJson(this.fetchImpl, joinUrl(this.endpoint, 'schedule'), {
            method: 'POST',
            service: 'Scheduler',
            body: { time }
        });
    }
}

module.exports = DentistScheduler;

const DentistScheduler = require('../dentistscheduler');
const { fakeFetch } = require('./helpers');

describe('DentistScheduler', () => {
    test('lists availability from GET /availability', async () => {
        const { fetchImpl, calls } = fakeFetch(['8am', '9am']);
        const scheduler = new DentistScheduler({ SchedulerEndpoint: 'https://sched.azurewebsites.net/' }, fetchImpl);

        expect(await scheduler.getAvailability()).toEqual(['8am', '9am']);
        expect(calls[0].url).toBe('https://sched.azurewebsites.net/availability');
    });

    test('accepts an endpoint without a trailing slash', async () => {
        const { fetchImpl, calls } = fakeFetch(['8am']);

        await new DentistScheduler({ SchedulerEndpoint: 'https://sched.azurewebsites.net' }, fetchImpl).getAvailability();

        expect(calls[0].url).toBe('https://sched.azurewebsites.net/availability');
    });

    test('books with a real JSON body on POST /schedule', async () => {
        const { fetchImpl, calls } = fakeFetch({ time: '10am' });
        const scheduler = new DentistScheduler({ SchedulerEndpoint: 'https://sched.azurewebsites.net/' }, fetchImpl);

        const result = await scheduler.scheduleAppointment('10am');

        expect(result).toEqual({ time: '10am' });
        expect(calls[0].url).toBe('https://sched.azurewebsites.net/schedule');
        expect(calls[0].init.method).toBe('POST');
        expect(calls[0].init.headers['Content-Type']).toBe('application/json');
        expect(calls[0].body).toEqual({ time: '10am' });
    });

    test('rejects an availability payload that is not a list of strings', async () => {
        const { fetchImpl } = fakeFetch({ message: 'hello world' });

        await expect(new DentistScheduler({ SchedulerEndpoint: 'https://s/' }, fetchImpl).getAvailability())
            .rejects.toThrow('Scheduler returned an unexpected availability payload');
    });

    test('throws when the scheduler is down', async () => {
        const { fetchImpl } = fakeFetch({}, { status: 503 });

        await expect(new DentistScheduler({ SchedulerEndpoint: 'https://s/' }, fetchImpl).scheduleAppointment('9am'))
            .rejects.toThrow('Scheduler request failed with HTTP 503');
    });
});

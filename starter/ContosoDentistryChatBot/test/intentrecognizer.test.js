const IntentRecognizer = require('../intentrecognizer');
const { fakeFetch } = require('./helpers');

const config = {
    endpoint: 'https://contoso-lang.cognitiveservices.azure.com/',
    key: 'test-key',
    projectName: 'ContosoDentistryCLU',
    deploymentName: 'production'
};

function cluResponse({ topIntent, score, entities = [] }) {
    return {
        kind: 'ConversationResult',
        result: {
            query: 'whatever',
            prediction: {
                projectKind: 'Conversation',
                topIntent,
                intents: [{ category: topIntent, confidenceScore: score }, { category: 'None', confidenceScore: 0.1 }],
                entities
            }
        }
    };
}

describe('IntentRecognizer', () => {
    test('calls the CLU analyze-conversations endpoint with the project and deployment', async () => {
        const { fetchImpl, calls } = fakeFetch(cluResponse({ topIntent: 'GetAvailability', score: 0.93 }));
        const recognizer = new IntentRecognizer(config, fetchImpl);

        await recognizer.recognize('What appointments are available?');

        expect(calls[0].url).toBe('https://contoso-lang.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2023-04-01');
        expect(calls[0].init.headers['Ocp-Apim-Subscription-Key']).toBe('test-key');
        expect(calls[0].body.analysisInput.conversationItem.text).toBe('What appointments are available?');
        expect(calls[0].body.parameters).toMatchObject({ projectName: 'ContosoDentistryCLU', deploymentName: 'production' });
    });

    test('returns the top intent and its confidence', async () => {
        const { fetchImpl } = fakeFetch(cluResponse({ topIntent: 'GetAvailability', score: 0.93 }));
        const result = await new IntentRecognizer(config, fetchImpl).recognize('any times?');

        expect(result).toEqual({ intent: 'GetAvailability', confidence: 0.93, slot: undefined });
    });

    test('reads the time slot from a resolved DateTime entity', async () => {
        const entities = [{
            category: 'DateTime',
            text: '10am',
            confidenceScore: 1,
            resolutions: [{ resolutionKind: 'DateTimeResolution', dateTimeSubKind: 'Time', timex: 'T10', value: '10:00:00' }]
        }];
        const { fetchImpl } = fakeFetch(cluResponse({ topIntent: 'ScheduleAppointment', score: 0.88, entities }));

        const result = await new IntentRecognizer(config, fetchImpl).recognize('book me at 10am');

        expect(result.slot).toBe('10am');
    });

    test('falls back to the entity text when CLU gives no resolution', async () => {
        const entities = [{ category: 'DateTime', text: 'at 2pm', confidenceScore: 1 }];
        const { fetchImpl } = fakeFetch(cluResponse({ topIntent: 'ScheduleAppointment', score: 0.8, entities }));

        const result = await new IntentRecognizer(config, fetchImpl).recognize('2pm please');

        expect(result.slot).toBe('2pm');
    });

    test('ignores entities that are not times', async () => {
        const entities = [{ category: 'Service', text: 'cleaning', confidenceScore: 1 }];
        const { fetchImpl } = fakeFetch(cluResponse({ topIntent: 'ScheduleAppointment', score: 0.8, entities }));

        const result = await new IntentRecognizer(config, fetchImpl).recognize('book a cleaning');

        expect(result.slot).toBeUndefined();
    });

    test('throws a descriptive error when CLU rejects the call', async () => {
        const { fetchImpl } = fakeFetch({ error: { code: '401' } }, { status: 401 });

        await expect(new IntentRecognizer(config, fetchImpl).recognize('hi')).rejects.toThrow('CLU request failed with HTTP 401');
    });

    test('reports whether it is configured', () => {
        expect(new IntentRecognizer(config).isConfigured).toBe(true);
        expect(new IntentRecognizer({ ...config, key: '' }).isConfigured).toBe(false);
    });
});

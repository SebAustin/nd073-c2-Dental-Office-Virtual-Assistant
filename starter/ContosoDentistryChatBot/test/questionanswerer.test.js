const QuestionAnswerer = require('../src/questionanswerer');
const { fakeFetch } = require('./helpers');

const config = {
    endpoint: 'https://contoso-lang.cognitiveservices.azure.com',
    key: 'test-key',
    projectName: 'ContosoDentistryFAQ',
    deploymentName: 'production'
};

describe('QuestionAnswerer', () => {
    test('queries the knowledge base for the project and deployment', async () => {
        const { fetchImpl, calls } = fakeFetch({ answers: [{ answer: 'Yes', confidenceScore: 0.9 }] });

        await new QuestionAnswerer(config, fetchImpl).getAnswer('Do you treat children?');

        expect(calls[0].url).toBe('https://contoso-lang.cognitiveservices.azure.com/language/:query-knowledgebases'
            + '?projectName=ContosoDentistryFAQ&deploymentName=production&api-version=2021-10-01');
        expect(calls[0].body).toMatchObject({ question: 'Do you treat children?', top: 1 });
    });

    test('returns the best answer with its confidence', async () => {
        const { fetchImpl } = fakeFetch({ answers: [{ answer: 'We accept patients no matter their insurance situation.', confidenceScore: 0.87 }] });

        const result = await new QuestionAnswerer(config, fetchImpl).getAnswer('no insurance?');

        expect(result).toEqual({ answer: 'We accept patients no matter their insurance situation.', confidence: 0.87 });
    });

    test('returns undefined when the knowledge base has no answer', async () => {
        const { fetchImpl } = fakeFetch({ answers: [{ answer: 'No answer found', confidenceScore: 0, id: -1 }] });

        expect(await new QuestionAnswerer(config, fetchImpl).getAnswer('what is the moon made of')).toBeUndefined();
    });

    test('returns undefined when the response has no answers', async () => {
        const { fetchImpl } = fakeFetch({ answers: [] });

        expect(await new QuestionAnswerer(config, fetchImpl).getAnswer('hm')).toBeUndefined();
    });

    test('throws when the service rejects the call', async () => {
        const { fetchImpl } = fakeFetch({}, { status: 500 });

        await expect(new QuestionAnswerer(config, fetchImpl).getAnswer('hi')).rejects.toThrow('Question answering request failed with HTTP 500');
    });
});

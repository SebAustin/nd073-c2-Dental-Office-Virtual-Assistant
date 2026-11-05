const { loadConfig } = require('../src/config');

const validEnv = {
    LanguageEndpoint: 'https://lang.cognitiveservices.azure.com/',
    LanguageKey: 'k',
    SchedulerEndpoint: 'https://sched.azurewebsites.net/',
    DirectLineSecret: 'dl-secret',
    AllowedOrigins: 'https://site.azurestaticapps.net, http://localhost:4280'
};

describe('loadConfig', () => {
    test('maps environment variables to service configuration with defaults', () => {
        const config = loadConfig(validEnv);

        expect(config.clu).toEqual({ endpoint: validEnv.LanguageEndpoint, key: 'k', projectName: 'ContosoDentistryCLU', deploymentName: 'production' });
        expect(config.cqa).toEqual({ endpoint: validEnv.LanguageEndpoint, key: 'k', projectName: 'ContosoDentistryFAQ', deploymentName: 'production' });
        expect(config.scheduler).toEqual({ SchedulerEndpoint: validEnv.SchedulerEndpoint });
        expect(config.thresholds).toEqual({ intent: 0.6, answer: 0.5 });
        expect(config.allowedOrigins).toEqual(['https://site.azurestaticapps.net', 'http://localhost:4280']);
        expect(config.directLineSecret).toBe('dl-secret');
    });

    test('honours overridden project names and thresholds', () => {
        const config = loadConfig({ ...validEnv, CluProjectName: 'X', CqaDeploymentName: 'staging', IntentThreshold: '0.7', AnswerThreshold: '0.4' });

        expect(config.clu.projectName).toBe('X');
        expect(config.cqa.deploymentName).toBe('staging');
        expect(config.thresholds).toEqual({ intent: 0.7, answer: 0.4 });
    });

    test('lets CLU use its own Language resource', () => {
        const config = loadConfig({ ...validEnv, CluEndpoint: 'https://clu.cognitiveservices.azure.com/', CluKey: 'clu-key' });

        expect(config.clu).toMatchObject({ endpoint: 'https://clu.cognitiveservices.azure.com/', key: 'clu-key' });
        expect(config.cqa).toMatchObject({ endpoint: validEnv.LanguageEndpoint, key: 'k' });
    });

    test('lists every missing required variable', () => {
        expect(() => loadConfig({})).toThrow('Missing required settings: LanguageEndpoint, LanguageKey, SchedulerEndpoint');
    });

    test('rejects a threshold outside 0..1', () => {
        expect(() => loadConfig({ ...validEnv, IntentThreshold: '60' })).toThrow('IntentThreshold must be a number between 0 and 1');
    });

    test('treats the token endpoint as optional', () => {
        const { DirectLineSecret, AllowedOrigins, ...rest } = validEnv;
        const config = loadConfig(rest);

        expect(config.directLineSecret).toBeUndefined();
        expect(config.allowedOrigins).toEqual([]);
    });
});

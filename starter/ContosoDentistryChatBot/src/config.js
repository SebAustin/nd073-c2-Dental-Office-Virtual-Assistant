// Reads and validates the bot's settings from the environment (.env locally, App Service
// application settings in Azure). Bot identity variables (MicrosoftAppId, MicrosoftAppPassword,
// MicrosoftAppType, MicrosoftAppTenantId) are read by botbuilder itself in index.js.

const REQUIRED = Object.freeze(['LanguageEndpoint', 'LanguageKey', 'SchedulerEndpoint']);
const DEFAULTS = Object.freeze({
    CluProjectName: 'ContosoDentistryCLU',
    CluDeploymentName: 'production',
    CqaProjectName: 'ContosoDentistryFAQ',
    CqaDeploymentName: 'production',
    IntentThreshold: '0.6',
    AnswerThreshold: '0.5'
});

/** @param {Record<string, string | undefined>} env @param {string} name */
function readThreshold(env, name) {
    const value = Number(env[name] || DEFAULTS[name]);
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`${ name } must be a number between 0 and 1`);
    }
    return value;
}

/** @param {string | undefined} list comma-separated origins */
function readOrigins(list) {
    return (list || '').split(',').map((origin) => origin.trim()).filter(Boolean);
}

/**
 * @param {Record<string, string | undefined>} env usually process.env
 */
function loadConfig(env) {
    const missing = REQUIRED.filter((name) => !env[name]);
    if (missing.length) throw new Error(`Missing required settings: ${ missing.join(', ') }`);

    const setting = (name) => env[name] || DEFAULTS[name];
    const language = { endpoint: env.LanguageEndpoint, key: env.LanguageKey };
    // CLU may live on its own Language resource (CluEndpoint/CluKey); otherwise it shares the main one.
    const cluResource = env.CluEndpoint && env.CluKey ? { endpoint: env.CluEndpoint, key: env.CluKey } : language;

    return Object.freeze({
        clu: { ...cluResource, projectName: setting('CluProjectName'), deploymentName: setting('CluDeploymentName') },
        cqa: { ...language, projectName: setting('CqaProjectName'), deploymentName: setting('CqaDeploymentName') },
        scheduler: { SchedulerEndpoint: env.SchedulerEndpoint },
        thresholds: { intent: readThreshold(env, 'IntentThreshold'), answer: readThreshold(env, 'AnswerThreshold') },
        directLineSecret: env.DirectLineSecret || undefined,
        allowedOrigins: readOrigins(env.AllowedOrigins)
    });
}

module.exports = { loadConfig };

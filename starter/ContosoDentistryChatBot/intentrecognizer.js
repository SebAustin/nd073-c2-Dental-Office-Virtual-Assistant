// Recognises what a patient wants using Conversational Language Understanding (CLU),
// the Azure AI Language successor to LUIS (see docs/adr/0001).

const { joinUrl, requestJson } = require('./src/http');
const { fromClockValue, parseTimeSlot } = require('./src/timeslots');

const CLU_API_VERSION = '2023-04-01';
const DATETIME_CATEGORY = 'datetime';

/**
 * @typedef {{ intent: string, confidence: number, slot: string | undefined }} Recognition
 * @typedef {{ endpoint: string, key: string, projectName: string, deploymentName: string }} CluConfig
 */

class IntentRecognizer {
    /**
     * @param {CluConfig} config
     * @param {typeof fetch} [fetchImpl]
     */
    constructor(config, fetchImpl = fetch) {
        this.config = config;
        this.fetchImpl = fetchImpl;
    }

    get isConfigured() {
        const { endpoint, key, projectName, deploymentName } = this.config || {};
        return Boolean(endpoint && key && projectName && deploymentName);
    }

    /**
     * @param {string} text
     * @returns {Promise<Recognition>}
     */
    async recognize(text) {
        const { endpoint, key, projectName, deploymentName } = this.config;
        const url = joinUrl(endpoint, `language/:analyze-conversations?api-version=${ CLU_API_VERSION }`);
        const response = await requestJson(this.fetchImpl, url, {
            method: 'POST',
            service: 'CLU',
            headers: { 'Ocp-Apim-Subscription-Key': key },
            body: {
                kind: 'Conversation',
                analysisInput: { conversationItem: { id: '1', participantId: 'patient', text } },
                parameters: { projectName, deploymentName, stringIndexType: 'TextElement_V8' }
            }
        });

        const prediction = response.result.prediction;
        const top = prediction.intents.find((intent) => intent.category === prediction.topIntent);
        return {
            intent: prediction.topIntent,
            confidence: top ? top.confidenceScore : 0,
            slot: this.getTimeEntity(prediction)
        };
    }

    /**
     * Reads the requested time slot from the first DateTime entity, if any.
     * @param {{ entities?: Array<{ category: string, text: string, resolutions?: Array<{ value?: string, timex?: string }> }> }} prediction
     * @returns {string | undefined}
     */
    getTimeEntity(prediction) {
        const entity = (prediction.entities || []).find((e) => e.category.toLowerCase() === DATETIME_CATEGORY);
        if (!entity) return undefined;

        const resolution = (entity.resolutions || [])[0];
        const resolved = resolution && (fromClockValue(resolution.value) || fromClockValue(resolution.timex));
        return resolved || parseTimeSlot(entity.text);
    }
}

module.exports = IntentRecognizer;

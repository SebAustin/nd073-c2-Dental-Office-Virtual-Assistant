// Answers questions from the practice's knowledge base using Custom Question Answering,
// the Azure AI Language successor to QnA Maker (see docs/adr/0001).

const { joinUrl, requestJson } = require('./http');

const CQA_API_VERSION = '2021-10-01';
const NO_ANSWER_ID = -1;

/**
 * @typedef {{ answer: string, confidence: number }} Answer
 * @typedef {{ endpoint: string, key: string, projectName: string, deploymentName: string }} CqaConfig
 */

class QuestionAnswerer {
    /**
     * @param {CqaConfig} config
     * @param {typeof fetch} [fetchImpl]
     */
    constructor(config, fetchImpl = fetch) {
        this.config = config;
        this.fetchImpl = fetchImpl;
    }

    /**
     * @param {string} question
     * @returns {Promise<Answer | undefined>} undefined when the knowledge base has no answer
     */
    async getAnswer(question) {
        const { endpoint, key, projectName, deploymentName } = this.config;
        const query = new URLSearchParams({ projectName, deploymentName, 'api-version': CQA_API_VERSION });
        const url = joinUrl(endpoint, `language/:query-knowledgebases?${ query }`);

        const response = await requestJson(this.fetchImpl, url, {
            method: 'POST',
            service: 'Question answering',
            headers: { 'Ocp-Apim-Subscription-Key': key },
            body: { question, top: 1, confidenceScoreThreshold: 0 }
        });

        const best = (response.answers || [])[0];
        if (!best || best.id === NO_ANSWER_ID) return undefined;
        return { answer: best.answer, confidence: best.confidenceScore };
    }
}

module.exports = QuestionAnswerer;

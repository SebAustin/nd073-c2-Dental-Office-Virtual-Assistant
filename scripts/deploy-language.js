#!/usr/bin/env node
// Imports, trains and deploys the CLU project, then (re)builds and deploys the Custom Question
// Answering knowledge base from FAQ.tsv + FAQ-extended.tsv. Safe to re-run.
//
// Usage: LanguageEndpoint=https://... LanguageKey=... node scripts/deploy-language.js [clu|cqa]
//        (reads starter/ContosoDentistryChatBot/.env when the variables are not set)

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'starter/ContosoDentistryChatBot/node_modules/dotenv'))
    .config({ path: path.join(ROOT, 'starter/ContosoDentistryChatBot/.env'), quiet: true });

const ENDPOINT = (process.env.LanguageEndpoint || '').replace(/\/+$/, '');
const KEY = process.env.LanguageKey;
const HAS_CLU_RESOURCE = Boolean(process.env.CluEndpoint && process.env.CluKey);
const CLU_ENDPOINT = HAS_CLU_RESOURCE ? process.env.CluEndpoint.replace(/\/+$/, '') : ENDPOINT;
const CLU_KEY = HAS_CLU_RESOURCE ? process.env.CluKey : KEY;
const MAIN = { endpoint: ENDPOINT, key: KEY };
const CLU = { endpoint: CLU_ENDPOINT, key: CLU_KEY };
const CLU_PROJECT = process.env.CluProjectName || 'ContosoDentistryCLU';
const CQA_PROJECT = process.env.CqaProjectName || 'ContosoDentistryFAQ';
const DEPLOYMENT = 'production';
const CLU_API = 'api-version=2023-04-01';
const CQA_API = 'api-version=2021-10-01';
const POLL_INTERVAL_MS = 3000;
const POLL_LIMIT = 600; // 30 minutes: CLU standard training can take 15+ minutes

if (!ENDPOINT || !KEY) {
    console.error('Set LanguageEndpoint and LanguageKey (or fill starter/ContosoDentistryChatBot/.env).');
    process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method, urlPath, body, resource = MAIN) {
    const response = await fetch(`${ resource.endpoint }${ urlPath }`, {
        method,
        headers: { 'Ocp-Apim-Subscription-Key': resource.key, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok && response.status !== 404) {
        throw new Error(`${ method } ${ urlPath } -> HTTP ${ response.status }: ${ await response.text() }`);
    }
    return response;
}

/** Waits for a long-running authoring job announced in the operation-location header. */
async function waitFor(response, label, resource = MAIN) {
    const location = response.headers.get('operation-location');
    if (!location) return;
    for (let attempt = 0; attempt < POLL_LIMIT; attempt++) {
        const job = await (await fetch(location, { headers: { 'Ocp-Apim-Subscription-Key': resource.key } })).json();
        if (job.status === 'succeeded') return console.log(`  ✓ ${ label }`);
        if (['failed', 'cancelled'].includes(job.status)) {
            throw new Error(`${ label } ${ job.status }: ${ JSON.stringify(job.errors || job) }`);
        }
        await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(`${ label } timed out`);
}

async function deployClu() {
    console.log(`CLU project "${ CLU_PROJECT }" on ${ CLU_ENDPOINT }`);
    const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'starter/ContosoDentistryCLU/clu-project.json'), 'utf8'));
    const base = `/language/authoring/analyze-conversations/projects/${ CLU_PROJECT }`;
    const modelLabel = `v${ Date.now() }`;

    project.metadata.projectName = CLU_PROJECT;
    await waitFor(await call('POST', `${ base }/:import?${ CLU_API }`, project, CLU), 'imported', CLU);
    await waitFor(await call('POST', `${ base }/:train?${ CLU_API }`, {
        modelLabel,
        trainingMode: 'standard',
        // Every utterance is training data; "manual" evaluation uses only utterances marked Test (none).
        evaluationOptions: { kind: 'manual' }
    }, CLU), `trained ${ modelLabel }`, CLU);
    await waitFor(await call('PUT', `${ base }/deployments/${ DEPLOYMENT }?${ CLU_API }`, { trainedModelLabel: modelLabel }, CLU), `deployed to "${ DEPLOYMENT }"`, CLU);
}

/** Reads a Question<TAB>Answer file and groups alternative questions under each answer. */
function readQnas(file, source) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).slice(1).filter(Boolean);
    const byAnswer = new Map();
    for (const line of lines) {
        const [question, answer] = line.split('\t').map((cell) => (cell || '').trim());
        if (!question || !answer) continue;
        byAnswer.set(answer, [...(byAnswer.get(answer) || []), question]);
    }
    return [...byAnswer].map(([answer, questions]) => ({ answer, questions, source }));
}

async function deployCqa() {
    console.log(`Knowledge base "${ CQA_PROJECT }"`);
    const base = `/language/authoring/query-knowledgebases/projects/${ CQA_PROJECT }`;
    const faqDir = path.join(ROOT, 'starter/ContosoDentistryFAQs');
    const qnas = [
        ...readQnas(path.join(faqDir, 'FAQ.tsv'), 'FAQ.tsv'),
        ...readQnas(path.join(faqDir, 'FAQ-extended.tsv'), 'FAQ-extended.tsv')
    ].map((qna, index) => ({ op: 'add', value: { id: index + 1, ...qna } }));

    const existing = await call('DELETE', `${ base }?${ CQA_API }`);
    if (existing.status !== 404) await waitFor(existing, 'removed previous version');

    await call('PATCH', `${ base }?${ CQA_API }`, {
        description: 'Contoso Dentistry FAQs (successor to the course QnA Maker knowledge base).',
        language: 'en',
        multilingualResource: false,
        settings: { defaultAnswer: 'No answer found' }
    });
    console.log('  ✓ created');
    await waitFor(await call('PATCH', `${ base }/qnas?${ CQA_API }`, qnas), `added ${ qnas.length } question-and-answer pairs`);
    await waitFor(await call('PUT', `${ base }/deployments/${ DEPLOYMENT }?${ CQA_API }`), `deployed to "${ DEPLOYMENT }"`);
}

async function main() {
    const only = process.argv[2];
    if (!only || only === 'clu') await deployClu();
    if (!only || only === 'cqa') await deployCqa();
}

main().catch((error) => {
    console.error(`\n✗ ${ error.message }`);
    process.exit(1);
});

// Builds clu-project.json (CLU import format, API 2023-04-01) from utterances.json.
// [bracketed] text becomes a labelled DateTime entity backed by the prebuilt DateTime component.
// Usage: node starter/ContosoDentistryCLU/build-clu.js [projectName]

const fs = require('node:fs');
const path = require('node:path');

const PROJECT_NAME = process.argv[2] || 'ContosoDentistryCLU';
const LANGUAGE = 'en-us';
const ENTITY = 'DateTime';
const MARKED = /\[([^\]]+)\]/g;

/** Strips [markers] and returns the plain text plus entity offsets into it. */
function label(marked) {
    const entities = [];
    let text = '';
    let cursor = 0;
    for (const match of marked.matchAll(MARKED)) {
        text += marked.slice(cursor, match.index);
        entities.push({ category: ENTITY, offset: text.length, length: match[1].length });
        text += match[1];
        cursor = match.index + match[0].length;
    }
    text += marked.slice(cursor);
    return { text, entities };
}

const source = JSON.parse(fs.readFileSync(path.join(__dirname, 'utterances.json'), 'utf8'));
const intents = Object.keys(source).filter((key) => !key.startsWith('_'));

const utterances = intents.flatMap((intent) => source[intent].map((marked) => ({
    ...label(marked),
    language: LANGUAGE,
    intent,
    dataset: 'Train'
})));

const project = {
    projectFileVersion: '2023-04-01',
    stringIndexType: 'Utf16CodeUnit',
    metadata: {
        projectKind: 'Conversation',
        projectName: PROJECT_NAME,
        description: 'Contoso Dentistry scheduling intents (successor to the course LUIS app).',
        language: LANGUAGE,
        multilingual: false,
        settings: { confidenceThreshold: 0 }
    },
    assets: {
        projectKind: 'Conversation',
        intents: intents.map((category) => ({ category })),
        entities: [{ category: ENTITY, compositionSetting: 'combineComponents', prebuilts: [{ category: 'DateTime' }] }],
        utterances
    }
};

fs.writeFileSync(path.join(__dirname, 'clu-project.json'), JSON.stringify(project, null, 2) + '\n');
process.stdout.write(`Wrote ${ utterances.length } utterances across ${ intents.length } intents to clu-project.json\n`);

module.exports = { label };

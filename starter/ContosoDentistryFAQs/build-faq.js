// Generates FAQ-extended.tsv (same Question<TAB>Answer layout as FAQ.tsv) from practice.json,
// so the knowledge base and the website share one source of practice facts.
// Usage: node starter/ContosoDentistryFAQs/build-faq.js

const fs = require('node:fs');
const path = require('node:path');

const practice = JSON.parse(fs.readFileSync(path.join(__dirname, 'practice.json'), 'utf8'));

const clean = (text) => text.replace(/[\t\r\n]+/g, ' ').trim();
const rows = practice.qna.flatMap(({ answer, questions }) => questions.map((question) => `${ clean(question) }\t${ clean(answer) }`));

fs.writeFileSync(path.join(__dirname, 'FAQ-extended.tsv'), ['Question\tAnswer', ...rows].join('\n') + '\n');
process.stdout.write(`Wrote ${ rows.length } rows to FAQ-extended.tsv\n`);

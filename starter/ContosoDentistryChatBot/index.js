// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
// Contoso Dentistry changes: Express + CloudAdapter (Single Tenant auth), validated config,
// CLU / Custom Question Answering connectors, and the Web Chat token endpoint.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });

const express = require('express');
const {
    CloudAdapter,
    ConfigurationBotFrameworkAuthentication,
    ConversationState,
    MemoryStorage
} = require('botbuilder');

const { DentaBot } = require('./bot');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require('./intentrecognizer');
const QuestionAnswerer = require('./src/questionanswerer');
const { loadConfig } = require('./src/config');
const { createTokenRouter } = require('./src/tokenroute');

const DEFAULT_PORT = 3978;
const config = loadConfig(process.env);

// Reads MicrosoftAppId, MicrosoftAppPassword, MicrosoftAppType and MicrosoftAppTenantId.
// Leave them empty to talk to the bot from the Bot Framework Emulator without authentication.
const auth = new ConfigurationBotFrameworkAuthentication(process.env);
const adapter = new CloudAdapter(auth);

adapter.onTurnError = async (context, error) => {
    console.error(`\n [onTurnError] unhandled error: ${ error }`);
    await context.sendTraceActivity('OnTurnError Trace', `${ error }`, 'https://www.botframework.com/schemas/error', 'TurnError');
    await context.sendActivity('Sorry, something went wrong on my side. Please try again, or call us on (555) 010-2024.');
};

const bot = new DentaBot({
    recognizer: new IntentRecognizer(config.clu),
    answerer: new QuestionAnswerer(config.cqa),
    scheduler: new DentistScheduler(config.scheduler),
    conversationState: new ConversationState(new MemoryStorage()),
    thresholds: config.thresholds
});

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(createTokenRouter({ secret: config.directLineSecret, allowedOrigins: config.allowedOrigins }));
app.use(express.json({ limit: '256kb' }));

app.get('/', (req, res) => res.json({ status: 'ok', service: 'contoso-dentistry-chatbot' }));
app.post('/api/messages', (req, res) => adapter.process(req, res, (context) => bot.run(context)));

const server = app.listen(process.env.port || process.env.PORT || DEFAULT_PORT, () => {
    const port = server.address().port;
    console.log(`\nDentaBot listening on port ${ port }`);
    console.log(`Bot Framework Emulator: open http://localhost:${ port }/api/messages`);
});

// Web Chat and Direct Line Speech upgrade to WebSockets on the same route.
server.on('upgrade', async (req, socket, head) => {
    const streamingAdapter = new CloudAdapter(auth);
    streamingAdapter.onTurnError = adapter.onTurnError;
    await streamingAdapter.process(req, socket, head, (context) => bot.run(context));
});

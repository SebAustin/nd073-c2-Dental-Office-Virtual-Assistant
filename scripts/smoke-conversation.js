#!/usr/bin/env node
// Talks to the deployed bot through Direct Line exactly like the website does (token from /api/token),
// and prints each reply. Usage: node scripts/smoke-conversation.js <siteOrigin> <botAppUrl>

const [site, bot] = process.argv.slice(2);
if (!site || !bot) {
    console.error('Usage: node scripts/smoke-conversation.js https://<site>.azurestaticapps.net https://<bot-app>.azurewebsites.net');
    process.exit(1);
}

const DIRECT_LINE = 'https://directline.botframework.com/v3/directline';
const REPLY_WAIT_MS = 5000;
const SCRIPT = [
    { type: 'event', name: 'webchat/join' },
    'What appointments are available?',
    "I don't have insurance. Can I still be seen?",
    'Book me in at 10am',
    'Book 2pm',
    'forget my appointment',
    'what is the capital of France'
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const tokenResponse = await fetch(`${ bot.replace(/\/+$/, '') }/api/token`, { method: 'POST', headers: { Origin: site } });
    if (!tokenResponse.ok) throw new Error(`Token endpoint returned HTTP ${ tokenResponse.status }`);
    const { token, userId } = await tokenResponse.json();
    const headers = { Authorization: `Bearer ${ token }`, 'Content-Type': 'application/json' };

    const { conversationId } = await (await fetch(`${ DIRECT_LINE }/conversations`, { method: 'POST', headers })).json();
    let watermark = '';
    let replies = 0;

    for (const step of SCRIPT) {
        const activity = typeof step === 'string' ? { type: 'message', text: step } : step;
        console.log(`> ${ activity.text || `(${ activity.name } event)` }`);
        await fetch(`${ DIRECT_LINE }/conversations/${ conversationId }/activities`, {
            method: 'POST', headers, body: JSON.stringify({ ...activity, from: { id: userId } })
        });
        await sleep(REPLY_WAIT_MS);
        const page = await (await fetch(`${ DIRECT_LINE }/conversations/${ conversationId }/activities?watermark=${ watermark }`, { headers })).json();
        watermark = page.watermark;
        for (const reply of page.activities.filter((a) => a.from.id !== userId)) {
            replies += 1;
            const buttons = reply.suggestedActions ? ` [${ reply.suggestedActions.actions.map((a) => a.title).join(' ') }]` : '';
            console.log(`  BOT: ${ (reply.text || '').replace(/\n/g, ' / ') }${ buttons }`);
        }
    }
    if (!replies) throw new Error('The bot did not reply. Check its identity, service principal and App Service logs.');
}

main().catch((error) => {
    console.error(`✗ ${ error.message }`);
    process.exit(1);
});

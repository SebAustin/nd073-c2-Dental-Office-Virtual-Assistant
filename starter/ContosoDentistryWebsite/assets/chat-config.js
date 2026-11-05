// Where the website asks the bot for a short-lived Web Chat token.
// The token endpoint lives on the bot's App Service; no secret is ever shipped to the browser.
window.CONTOSO_CHAT = Object.freeze({
    tokenUrl: ['localhost', '127.0.0.1'].includes(window.location.hostname)
        ? 'http://localhost:3978/api/token'
        : 'https://contoso-dental-bot-app-f80d.azurewebsites.net/api/token'
});

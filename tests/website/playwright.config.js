const { defineConfig } = require('@playwright/test');

const PORT = 4281;

module.exports = defineConfig({
    testDir: '.',
    timeout: 30000,
    use: {
        baseURL: `http://localhost:${ PORT }`,
        channel: 'chrome'
    },
    projects: [
        { name: 'mobile-375', use: { viewport: { width: 375, height: 812 } } },
        { name: 'desktop-1440', use: { viewport: { width: 1440, height: 900 } } }
    ],
    webServer: {
        command: `python3 -m http.server ${ PORT } --directory ../../starter/ContosoDentistryWebsite`,
        port: PORT,
        reuseExistingServer: true
    }
});

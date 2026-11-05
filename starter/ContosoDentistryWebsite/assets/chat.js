// Floating "Ask Denta" chat. Web Chat (4 MB) is only downloaded the first time a patient opens it.
(function () {
    'use strict';

    var WEBCHAT_SRC = 'https://cdn.jsdelivr.net/npm/botframework-webchat@4.18.0/dist/webchat.js';
    var WEBCHAT_SRI = 'sha384-YCF4860lf811lnrrIBL4pfZ+UqiNit+8lXEhSY3R+dSc+C1rg6UnEQR5avdOTbj0';
    var PHONE = '(555) 010-2024';
    var config = window.CONTOSO_CHAT || {};

    var panel = document.getElementById('chat-panel');
    var launcher = document.querySelector('.chat-launcher');
    var status = panel.querySelector('.chat-status');
    var statusText = panel.querySelector('[data-chat-message]');
    var spinner = panel.querySelector('.spinner');
    var started = false;
    var lastOpener = null;

    function showStatus(message, isError) {
        statusText.textContent = message;
        spinner.hidden = Boolean(isError);
        status.hidden = false;
    }

    function loadWebChat() {
        if (window.WebChat) return Promise.resolve(window.WebChat);
        return new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = WEBCHAT_SRC;
            script.integrity = WEBCHAT_SRI;
            script.crossOrigin = 'anonymous';
            script.onload = function () { resolve(window.WebChat); };
            script.onerror = function () { reject(new Error('Web Chat failed to load')); };
            document.head.appendChild(script);
        });
    }

    function fetchToken() {
        return fetch(config.tokenUrl, { method: 'POST' }).then(function (response) {
            if (!response.ok) throw new Error('Token request failed with HTTP ' + response.status);
            return response.json();
        });
    }

    // Tell the bot we've joined so it greets the patient before they type.
    function joinMiddleware() {
        return function (next) {
            return function (action) {
                if (action.type === 'DIRECT_LINE/CONNECT_FULFILLED') {
                    setTimeout(function () {
                        store.dispatch({ type: 'WEB_CHAT/SEND_EVENT', payload: { name: 'webchat/join', value: {} } });
                    }, 0);
                }
                return next(action);
            };
        };
    }

    var store;

    function startChat() {
        started = true;
        showStatus('Connecting you to Denta…', false);
        Promise.all([loadWebChat(), fetchToken()])
            .then(function (results) {
                var WebChat = results[0];
                var session = results[1];
                store = WebChat.createStore({}, joinMiddleware);
                WebChat.renderWebChat({
                    directLine: WebChat.createDirectLine({ token: session.token }),
                    userID: session.userId,
                    username: 'Patient',
                    locale: 'en-US',
                    store: store,
                    styleOptions: {
                        accent: '#0f5f66',
                        primaryFont: "'Inter', system-ui, sans-serif",
                        bubbleBackground: '#e8f4f3',
                        bubbleBorderRadius: 14,
                        bubbleFromUserBackground: '#0f3d45',
                        bubbleFromUserTextColor: '#fbf9f5',
                        bubbleFromUserBorderRadius: 14,
                        suggestedActionBackgroundColor: '#ffffff',
                        suggestedActionBorderColor: '#e2654a',
                        suggestedActionTextColor: '#b2412a',
                        suggestedActionBorderRadius: 999,
                        sendBoxButtonColor: '#e2654a',
                        hideUploadButton: true,
                        botAvatarInitials: 'D',
                        botAvatarBackgroundColor: '#0f3d45',
                        userAvatarInitials: 'You',
                        backgroundColor: '#ffffff'
                    }
                }, document.getElementById('webchat'));
                status.hidden = true;
                var input = panel.querySelector('input[type="text"], textarea');
                if (input) input.focus();
            })
            .catch(function () {
                started = false;
                showStatus('Sorry, chat is unavailable right now. Please call us on ' + PHONE + '.', true);
            });
    }

    function openChat(event) {
        lastOpener = event && event.currentTarget;
        panel.hidden = false;
        launcher.setAttribute('aria-expanded', 'true');
        panel.querySelector('[data-close-chat]').focus();
        if (!started) startChat();
    }

    function closeChat() {
        panel.hidden = true;
        launcher.setAttribute('aria-expanded', 'false');
        (lastOpener || launcher).focus();
    }

    document.querySelectorAll('[data-open-chat]').forEach(function (button) {
        button.addEventListener('click', openChat);
    });
    panel.querySelector('[data-close-chat]').addEventListener('click', closeChat);
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && !panel.hidden) closeChat();
    });

    // Gentle entrance for sections as they scroll into view.
    var revealables = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
        revealables.forEach(function (el) { el.classList.add('is-visible'); });
        return;
    }
    var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { rootMargin: '0px 0px -8% 0px' });
    revealables.forEach(function (el) { observer.observe(el); });
}());

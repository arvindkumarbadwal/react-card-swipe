const cardSwipe = {

    cardSwipe: this,
    settings: {},
    init: function (options){
        return cardSwipe.methods.init(options);
    },

    // Built-in parsers. These include simplistic credit card parsers that
    // recognize various card issuers based on patterns of the account number.
    // There is no guarantee these are correct or complete; they are based
    // on information from Wikipedia.
    // Account numbers are validated by the Luhn checksum algorithm.
    builtinParsers: {

        // Generic parser. Separates raw data into up to three lines.
        generic: function (rawData) {
            let pattern = new RegExp("^(%[^%;\\?]+\\?)?(;[0-9\\:<>\\=]+\\?)?([+;][0-9\\:<>\\=]+\\?)?");

            let match = pattern.exec(rawData);
            if (!match) return null;

            // Extract the three lines
            let cardData = {
                type: "generic",
                line1: match[1] ? match[1].slice(1, -1) : "",
                line2: match[2] ? match[2].slice(1, -1) : "",
                line3: match[3] ? match[3].slice(1, -1) : ""
            };

            return cardData;
        },


        // Visa card parser.
        visa: function (rawData) {
            // Visa issuer number begins with 4 and may vary from 13 to 19 total digits. 16 digits is most common.
            let pattern = new RegExp("^%B(4[0-9]{12,18})\\^([A-Z ]+)/([A-Z ]+)(\\.[A-Z ]+)?\\^([0-9]{2})([0-9]{2})");

            let match = pattern.exec(rawData);
            if (!match) return null;

            let account = match[1];
            if (!cardSwipe.luhnChecksum(account))
                return null;

            let cardData = {
                type: "visa",
                account: account,
                lastName: match[2].trim(),
                firstName: match[3].trim(),
                honorific: match[4] ? match[4].trim().slice(1) : "",
                expYear: match[5],
                expMonth: match[6]
            };

            return cardData;
        },

        // MasterCard parser.
        mastercard: function (rawData) {
            // MasterCard starts with 51-55, and is 16 digits long.
            let pattern = new RegExp("^%B(5[1-5][0-9]{14})\\^([A-Z ]+)/([A-Z ]+)(\\.[A-Z ]+)?\\^([0-9]{2})([0-9]{2})");

            let match = pattern.exec(rawData);
            if (!match) return null;

            let account = match[1];
            if (!cardSwipe.luhnChecksum(account))
                return null;

            let cardData = {
                type: "mastercard",
                account: account,
                lastName: match[2],
                firstName: match[3],
                honorific: match[4] ? match[4].trim().slice(1) : "",
                expYear: match[5],
                expMonth: match[6]
            };

            return cardData;
        },

        // Discover parser.
        discover: function (rawData) {
            // discover starts with 6, and is 16 digits long.
            let pattern = new RegExp("^%B(6[0-9]{15})\\^([A-Z ]+)/([A-Z ]+)(\\.[A-Z ]+)?\\^([0-9]{2})([0-9]{2})");

            let match = pattern.exec(rawData);
            if (!match) return null;

            let account = match[1];
            if (!cardSwipe.luhnChecksum(account))
                return null;

            let cardData = {
                type: "discover",
                account: account,
                lastName: match[2],
                firstName: match[3],
                honorific: match[4] ? match[4].trim().slice(1) : "",
                expYear: match[5],
                expMonth: match[6]
            };

            return cardData;
        },

        // American Express parser
        amex: function (rawData) {
            // American Express starts with 34 or 37, and is 15 digits long.
            let pattern = new RegExp("^%B(3[4|7][0-9]{13})\\^([A-Z ]+)/([A-Z ]+)(\\.[A-Z ]+)?\\^([0-9]{2})([0-9]{2})");

            let match = pattern.exec(rawData);
            if (!match) return null;

            let account = match[1];
            if (!cardSwipe.luhnChecksum(account))
                return null;

            let cardData = {
                type: "amex",
                account: account,
                lastName: match[2],
                firstName: match[3],
                honorific: match[4] ? match[4].trim().slice(1) : "",
                expYear: match[5],
                expMonth: match[6]
            };

            return cardData;
        }
    },

    // State definitions:
    states: { IDLE: 0, PENDING1: 1, PENDING2: 2, READING: 3, DISCARD: 4, PREFIX: 5 },

    // State names used when debugging.
    stateNames: { 0: 'IDLE', 1: 'PENDING1', 2: 'PENDING2', 3: 'READING', 4: 'DISCARD', 5: 'PREFIX' },

    // Holds current state. Update only through state function.
    currentState: 0,

    // Gets or sets the current state.
    state: function () {

        if (arguments.length === 0) {
            return cardSwipe.currentState;
        }

        // Set new state.
        let newState = arguments[0];
        if (newState === cardSwipe.state)
            return;

        if (cardSwipe.settings.debug) { console.log("%s -> %s", cardSwipe.stateNames[cardSwipe.currentState], cardSwipe.stateNames[newState]); }

        // Raise events when entering and leaving the READING state
        if (newState === cardSwipe.states.READING){
            let event = new CustomEvent('scanstart.cardswipe');
            document.dispatchEvent(event);
        };

        if (cardSwipe.currentState === cardSwipe.states.READING){
            let event = new CustomEvent('scanend.cardswipe');
            document.dispatchEvent(event);
        };

        cardSwipe.currentState = newState;
    },

    // Array holding scanned characters
    scanbuffer: [],

    // Interdigit timer
    timerHandle: 0,

    // Keypress listener
    listener: function (e) {
        if (cardSwipe.settings.debug) { console.log(e.which + ': ' + String.fromCharCode(e.which)); }
        switch (cardSwipe.state()) {

            // IDLE: Look for prfix characters or line 1 or line 2 start
            // characters, and jump to PENDING1 or PENDING2.
            case cardSwipe.states.IDLE:
                // Look for prefix characters, and jump to PREFIX.
                if (cardSwipe.isInPrefixCodes(e.which)) {
                    cardSwipe.state(cardSwipe.states.PREFIX);
                    e.preventDefault();
                    e.stopPropagation();
                    cardSwipe.startTimer();
                }

                // Cards with (and readers reading) line 1:
                // look for '%', and jump to PENDING1.
                if (e.which === 37) {
                    cardSwipe.state(cardSwipe.states.PENDING1);
                    cardSwipe.scanbuffer = [];
                    cardSwipe.processCode(e.which);
                    e.preventDefault();
                    e.stopPropagation();
                    cardSwipe.startTimer();
                }

                // Cards without (or readers ignoring) line 1:
                // look for ';', and jump to PENDING_LINE
                if (e.which === 59) {
                    cardSwipe.state(cardSwipe.states.PENDING2);
                    cardSwipe.scanbuffer = [];
                    cardSwipe.processCode(e.which);
                    e.preventDefault();
                    e.stopPropagation();
                    cardSwipe.startTimer();
                }

                break;

            // PENDING1: Look for A-Z then jump to READING.
            // Otherwise, pass the keypress through, reset and jump to IDLE.
            case cardSwipe.states.PENDING1:
                // Look for format code character, A-Z. Almost always B for cards
                // used by the general public. Some reader / OS combinations
                // will issue lowercase characters when the caps lock key is on.
                if ((e.which >= 65 && e.which <= 90) || (e.which >= 97 && e.which <= 122)) {
                    cardSwipe.state(cardSwipe.states.READING);

                    // Leaving focus on a form element wreaks browser-dependent
                    // havoc because of keyup and keydown events.  This is a
                    // cross-browser way to prevent trouble.
                    let el = document.querySelector(':focus');
                    if (el) el.blur();

                    cardSwipe.processCode(e.which);
                    e.preventDefault();
                    e.stopPropagation();
                    cardSwipe.startTimer();
                }
                else {
                    cardSwipe.clearTimer();
                    cardSwipe.scanbuffer = null;
                    cardSwipe.state(cardSwipe.states.IDLE);
                }
                break;

            // PENDING_LINE2: look for 0-9, then jump to READING.
            // Otherwise, pass the keypress through, reset and jump to IDLE.
            case cardSwipe.states.PENDING2:
                // Look for digit.
                if ((e.which >= 48 && e.which <= 57)) {
                    cardSwipe.state(cardSwipe.states.READING);

                    let el = document.querySelector(':focus');
                    if (el) el.blur();

                    cardSwipe.processCode(e.which);
                    e.preventDefault();
                    e.stopPropagation();
                    cardSwipe.startTimer();
                }
                else {
                    cardSwipe.clearTimer();
                    cardSwipe.scanbuffer = null;
                    cardSwipe.state(cardSwipe.states.IDLE);
                }
                break;

            // READING: Copy characters to buffer until newline, then process the scanned characters
            case cardSwipe.states.READING:
                cardSwipe.processCode(e.which);
                cardSwipe.startTimer();
                e.preventDefault();
                e.stopPropagation();

                // Carriage return indicates end of scan
                if (e.which === 13) {
                    cardSwipe.clearTimer();
                    cardSwipe.state(cardSwipe.states.IDLE);
                    cardSwipe.processScan();
                }

                if (cardSwipe.settings.firstLineOnly && e.which === 63) {
                    // End of line 1.  Return early, and eat remaining characters.
                    cardSwipe.state(cardSwipe.states.DISCARD);
                    cardSwipe.processScan();
                }
                break;

            // DISCARD: Eat up characters until newline, then jump to IDLE
            case cardSwipe.states.DISCARD:
                e.preventDefault();
                e.stopPropagation();
                if (e.which === 13) {
                    cardSwipe.clearTimer();
                    cardSwipe.state(cardSwipe.states.IDLE);
                    return;
                }

                cardSwipe.startTimer();
                break;

            // PREFIX: Eat up characters until % is seen, then jump to PENDING1
            case cardSwipe.states.PREFIX:

                // If prefix character again, pass it through and return to IDLE state.
                if (cardSwipe.isInPrefixCodes(e.which)) {
                    cardSwipe.state(cardSwipe.states.IDLE);
                    return;
                }

                // Eat character.
                e.preventDefault();
                e.stopPropagation();
                // Look for '%'
                if (e.which === 37) {
                    cardSwipe.state(cardSwipe.states.PENDING1);
                    cardSwipe.scanbuffer = [];
                    cardSwipe.processCode(e.which);
                }
                // Look for ';'
                if (e.which === 59) {
                    cardSwipe.state(cardSwipe.states.PENDING2);
                    cardSwipe.scanbuffer = [];
                    cardSwipe.processCode(e.which);
                }
                cardSwipe.startTimer();
                break;
            default:
                break;
        }
    },

    // Converts a scancode to a character and appends it to the buffer.
    processCode: function (code) {
        cardSwipe.scanbuffer.push(String.fromCharCode(code));
    },

    startTimer: function () {
        clearTimeout(cardSwipe.timerHandle);
        cardSwipe.timerHandle = setTimeout(cardSwipe.onTimeout, cardSwipe.settings.interdigitTimeout);
    },

    clearTimer: function () {
        clearTimeout(cardSwipe.timerHandle);
        cardSwipe.timerHandle = 0;
    },

    // Invoked when the timer lapses.
    onTimeout: function () {
        if (cardSwipe.settings.debug) { console.log('Timeout!'); }
        if (cardSwipe.state() === cardSwipe.states.READING) {
            cardSwipe.processScan();
        }
        cardSwipe.scanbuffer = null;
        cardSwipe.state(cardSwipe.states.IDLE);
    },

    // Processes the scanned card
    processScan: function () {

        if (cardSwipe.settings.debug) {
            console.log(cardSwipe.scanbuffer);
        }

        let rawData = cardSwipe.scanbuffer.join('');

        // Invoke rawData callback if defined, a testing hook.
        if (cardSwipe.settings.rawDataCallback) { cardSwipe.settings.rawDataCallback.call(this, rawData); }

        let result = cardSwipe.parseData(rawData);

        if (result) {

            // Scan complete. Invoke callback
            if (cardSwipe.settings.success) { cardSwipe.settings.success.call(this, result); }

            // Raise success event.
            let event = new CustomEvent('success.cardswipe', { detail: { result }});
            document.dispatchEvent(event);
        }
        else {
            // All parsers failed.
            if (cardSwipe.settings.failure) { cardSwipe.settings.failure.call(this, rawData); }
            document.dispatchEvent("failure.cardswipe");
        }
    },

    // Invokes parsers until one succeeds, and returns the parsed result,
    // or null if none succeed.
    parseData: function (rawData) {
        for (let i = 0; i < cardSwipe.settings.parsers.length; i++) {
            let ref = cardSwipe.settings.parsers[i];
            let parser;

            // ref is a function or the name of a builtin parser
            if (typeof (ref) === "function") {
                parser = ref;
            }
            else if (typeof (ref) === "string") {
                parser = cardSwipe.builtinParsers[ref];
            }

            if (parser !== null) {
                let parsedData = parser.call(this, rawData);
                if (parsedData === null)
                    continue;

                return parsedData;
            }
        }

        // All parsers failed.
        return null;
    },

    bindOn: function(elm, evtName, handler) {
        evtName.split('.').reduce(function (evtPart, evt) {
            evt = evt ? evt + '.' + evtPart : evtPart;
            elm.addEventListener(evt, handler, true);
            return evt;
        }, '');
    },

    bindOff: function(elm, evtName, handler) {
        evtName.split('.').reduce(function (evtPart, evt) {
            evt = evt ? evt + '.' + evtPart : evtPart;
            elm.removeEventListener(evt, handler, true);
            return evt;
        }, '');
    },

    // Binds the event listener
    bindListener: function () {
        document.addEventListener("keypress", cardSwipe.listener);
    },

    // Unbinds the event listener
    unbindListener: function () {
        document.removeEventListener("keypress", cardSwipe.listener);
    },

    // Default callback used if no other specified. Works with default parser.
    defaultSuccessCallback: function (cardData) {
        let text = ['Line 1: ', cardData.line1, '\nLine 2: ', cardData.line2, '\nLine 3: ', cardData.line3].join('');
        alert(text);
    },

    isInPrefixCodes: function (arg) {
        if (!cardSwipe.settings.prefixCodes) {
            return false;
        }
        return (cardSwipe.settings.prefixCodes.indexOf(arg) !== -1);
        //return $.inArray(arg, cardSwipe.settings.prefixCodes) != -1;
    },

    // Apply the Luhn checksum test.  Returns true on a valid account number.
    // The input is assumed to be a string containing only digits.
    luhnChecksum: function (digits) {
        let map = [0, 2, 4, 6, 8, 1, 3, 5, 7, 9];
        let sum = 0;

        // Proceed right to left. Even and odd digit positions are handled differently.
        let n = digits.length;
        let odd = true;
        while (n--) {
            let d = parseInt(digits.charAt(n), 10);
            if (odd) {
                // Odd digits used as is
                sum += d;
            }
            else {
                // Even digits mapped
                sum += map[d];
            }

            odd = !odd;
        }

        return sum % 10 === 0 && sum > 0;
    },

    // Callable plugin methods
    methods: {
        init: function (options) {
            let defaults = {
                enabled: true,
                interdigitTimeout: 250,
                success: cardSwipe.defaultSuccessCallback,
                failure: null,
                parsers: ["visa", "mastercard", "amex", "discover", "generic"],
                firstLineOnly: false,
                prefixCharacter: null,
                debug: false
            };

            cardSwipe.settings = Object.assign(defaults, options);

            // console.log(cardSwipe.settings);

            // Is a prefix character defined?
            if (cardSwipe.settings.prefixCharacter) {

                // Check if prefix character is an array, if its not, convert
                let isPrefixCharacterArray = Object.prototype.toString.call(cardSwipe.settings.prefixCharacter) === '[object Array]';
                if (!isPrefixCharacterArray) {
                    cardSwipe.settings.prefixCharacter = [cardSwipe.settings.prefixCharacter];
                }

                cardSwipe.settings.prefixCodes = [];
                for (let i in cardSwipe.settings.prefixCharacter){
                    if (cardSwipe.settings.prefixCharacter[i].length !== 1) {
                        throw new Error('prefixCharacter must be a single character');
                    }
                    // convert to character code
                    cardSwipe.settings.prefixCodes.push(this.charCodeAt(0));
                }
            }

            // Reset state
            cardSwipe.clearTimer();
            cardSwipe.state(cardSwipe.states.IDLE);
            cardSwipe.scanbuffer = null;
            cardSwipe.unbindListener();

            if (cardSwipe.settings.enabled)
                cardSwipe.methods.enable();
        },

        disable: function () {
            cardSwipe.unbindListener();
        },

        enable: function () {
            cardSwipe.bindListener();
        }
    }

}

export default cardSwipe;
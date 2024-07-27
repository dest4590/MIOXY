class Logger {
    constructor(debug) {
        this._debug = debug
    }

    static info(msg) {
        console.log(`\x1b[33m[Info]\x1b[0m ${msg}`);    
    }

    static warning(msg) {
        console.log(`\x1b[33m[Warning]\x1b[0m ${msg}`)
    }

    static client(msg) {
        console.log(`\x1b[33m[Client]\x1b[0m ${msg}`)
    }

    static server(msg) {
        console.log(`\x1b[33m[Server]\x1b[0m ${msg}`)
    }

    static error(msg) {
        console.log(`\x1b[31m[Error]\x1b[0m ${msg}`)
    }

    debug(msg) {
        if (this._debug) {
            console.log(`\x1b[34m[Debug]\x1b[0m ${msg}`)
        }
    }
}

module.exports = Logger;
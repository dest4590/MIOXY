class Logger {
    constructor(debug = false) {
        this.debugMode = debug;
    }

    info(message) {
        console.log(`\x1b[32m[INFO]\x1b[0m ${message}`);
    }

    warning(message) {
        console.log(`\x1b[33m[WARNING]\x1b[0m ${message}`);
    }

    error(message) {
        console.log(`\x1b[31m[ERROR]\x1b[0m ${message}`);
    }

    debug(message) {
        if (this.debugMode) {
            console.log(`\x1b[34m[DEBUG]\x1b[0m ${message}`);
        }
    }

    client(message) {
        console.log(`\x1b[36m[CLIENT]\x1b[0m ${message}`);
    }

    server(message) {
        console.log(`\x1b[35m[SERVER]\x1b[0m ${message}`);
    }
}

module.exports = Logger;

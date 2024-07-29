const { createClient, createServer, states } = require("minecraft-protocol");
const fetch = require('node-fetch');

class ProxyServer {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.isPlayed = false;
        this.userClient = null;
        this.proxyClient = null;
        this.packets = [];
    }

    createProxyClient() {
        const client = createClient({
            username: this.config.accountname,
            auth: "offline",
            host: this.config.host,
            port: this.config.port,
            keepAlive: true,
            version: this.config.version,
            hideErrors: true,
        });

        client.on("packet", (data, meta) => {
            if (!["keep_alive", "success", "custom_payload", "encryption_begin", "compress"].includes(meta.name)) {
                this.packets.push([meta, data]);

                if (this.userClient && meta.state === states.PLAY && this.userClient.state === states.PLAY) {
                    this.userClient.write(meta.name, data);
                    if (meta.name === "set_compression") this.userClient.compressionThreshold = data.threshold;
                }
            }
        });

        client.on("end", () => {
            if (this.userClient) this.logger.info("Proxy client ended");
        });

        client.on("error", (error) => {
            if (this.userClient) {
                this.logger.error(`Proxy client error: ${error}`);
                this.userClient.end(error);
            }
        });

        return client;
    }

    findLastPacket(array, searchValue) {
        var index = array.slice().reverse().findIndex(x => x[0].name === searchValue);
        var count = array.length - 1;
        var finalIndex = index >= 0 ? count - index : index;
        return finalIndex;
    }

    async getServerIcon(address) {
        const response = await fetch(`https://api.mcstatus.io/v2/status/java/${address}`);
        const data = await response.json();
        this.logger.server("Fetched server info");
        return data;
    }

    async start() {
        this.proxyClient = this.createProxyClient();
        const serverInfo = await this.getServerIcon(this.config.host);
        try { this.motdFormatted = serverInfo.motd.raw }

        catch (e) {
            this.logger.warning("Failed to read motd")
            this.motdFormatted = ""
        }
        const proxyServer = createServer({
            "online-mode": false,
            host: this.config.proxyhost,
            port: this.config.port,
            keepAlive: false,
            version: this.config.version,
            motd: this.motdFormatted,
            favicon: serverInfo.icon,
            maxPlayers: serverInfo.players.max,
        });

        proxyServer.playerCount = serverInfo.players.online;

        this.logger.server("Server created!");
        this.logger.server(`Version: ${this.config.version}`);
        this.logger.info(`Connect to \x1b[36m${this.config.proxyhost}:${this.config.port}\x1b[0m`);

        proxyServer.on("login", (client) => {
            this.logger.client(`${client.username} has connected`);

            if (!this.isPlayed) this.packets.forEach(([meta, data]) => client.write(meta.name, data));
            else if (this.isPlayed) {
                this.logger.debug('Writing old packets');
                this.packets.forEach(([meta, data]) => {
                    if (!['position'].includes(meta.name)) {
                        client.write(meta.name, data);
                    }
                });
            }

            this.isPlayed = true;
            this.userClient = client;

            client.on("packet", (data, meta) => {
                if (meta.state === states.PLAY && this.proxyClient.state === states.PLAY && !["keep_alive"].includes(meta.name)) {
                    this.proxyClient.write(meta.name, data);
                    this.logger.debug(`${meta.name} packet`);
                }
            });

            client.on("end", () => {
                if (this.proxyClient) {
                    this.logger.client(`${client.username} has disconnected`);
                }
            });
        });
    }
}

module.exports = ProxyServer;
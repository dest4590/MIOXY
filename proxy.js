const { createClient, createServer, states } = require("minecraft-protocol");
const { CONFIG_PATH, DEFAULT_CONFIG } = require("./settings");
const fs = require("fs");
const Logger = require('./logger');

if (!fs.existsSync(CONFIG_PATH)) {
    Logger.warning("Configuration file not found. Creating a new one with default values.");
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
    Logger.info("Please fill in the required values in 'config.json' and restart mioxy.");
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
const logger = new Logger(config.debug);
let userClient;
let proxyClient;
const packets = [];

console.clear();

const banner = `
\x1b[34m
███╗░░░███╗██╗░█████╗░██╗░░██╗██╗░░░██╗
████╗░████║██║██╔══██╗╚██╗██╔╝╚██╗░██╔╝      MinecraftProxyServer
██╔████╔██║██║██║░░██║░╚███╔╝░░╚████╔╝░      By @dest4590
██║╚██╔╝██║██║██║░░██║░██╔██╗░░░╚██╔╝░░      
██║░╚═╝░██║██║╚█████╔╝██╔╝╚██╗░░░██║░░░      
╚═╝░░░░░╚═╝╚═╝░╚════╝░╚═╝░░╚═╝░░░╚═╝░░░      Also try CollapseLoader
\x1b[0m
`;

console.log(banner);
Logger.info(`Player username: \x1b[36m${config.accountname}\x1b[0m`);
Logger.info(`Server to connect: \x1b[36m${config.host}\x1b[0m`);
Logger.client("Creating client...");

const createProxyClient = () => {
    const client = createClient({
        username: config.accountname,
        auth: "offline",
        host: config.host,
        port: config.port,
        keepAlive: true,
        version: config.version,
        hideErrors: true,
    });

    client.on("packet", (data, meta) => {
        if (!["keep_alive", "success", "custom_payload", "encryption_begin", "compress"].includes(meta.name)) {
            packets.push([meta, data]);

            if (userClient && meta.state === states.PLAY && userClient.state === states.PLAY) {
                userClient.write(meta.name, data);
                if (meta.name === "set_compression") userClient.compressionThreshold = data.threshold;
            }
        }
    });

    client.on("raw", (buffer, meta) => {
        if (!(userClient && meta.state === states.PLAY && userClient.state === states.PLAY)) return;
    });

    client.on("end", () => {
        if (userClient) {
            Logger.info("\x1b[37mProxy client ended\x1b[0m");
        }
        packets.length = 0;
    });

    client.on("error", (error) => {
        if (userClient) {
            Logger.error(`Proxy client error: ${error}`);
            userClient.end(error);
        }
        packets.length = 0;
    });

    return client;
};

proxyClient = createProxyClient();

const getServerIcon = async (address) => {
    const response = await fetch(`https://api.mcstatus.io/v2/status/java/${address}`);
    const data = await response.json();
    Logger.server("Fetched server info");
    return data;
};

const startServer = async () => {
    const serverInfo = await getServerIcon(config.host);
    const motdFormatted = serverInfo.motd.raw;

    const proxyServer = createServer({
        "online-mode": false,
        host: config.proxyhost,
        port: config.port,
        keepAlive: false,
        version: config.version,
        motd: motdFormatted,
        favicon: serverInfo.icon,
        maxPlayers: serverInfo.players.max,
    });

    proxyServer.playerCount = serverInfo.players.online;

    Logger.server("Server created!");
    Logger.info("All system working!");
    Logger.info("Waiting for connections!");
    Logger.info(`Connect to \x1b[36m${config.proxyhost}:${config.port}\x1b[0m`);

    proxyServer.on("login", (client) => {
        Logger.client(`${client.username} has connected`);

        packets.forEach(([meta, data]) => client.write(meta.name, data));

        userClient = client;

        client.on("packet", (data, meta) => {
            if (meta.state === states.PLAY && proxyClient.state === states.PLAY && !["keep_alive"].includes(meta.name)) {
                proxyClient.write(meta.name, data);
                logger.debug(`${meta.name} packet`);
            }
        });

        client.on("raw", (buffer, meta) => {
            if (!(meta.state === states.PLAY && proxyClient.state === states.PLAY && !["keep_alive"].includes(meta.name))) return;
        });

        client.on("end", async () => {
            if (proxyClient) {
                Logger.client(`${client.username} has disconnected`);
                packets.length = 0;

                Logger.client("Recreating client and server...");
                proxyClient.end();
                proxyServer.close()
                userClient = null;

                proxyClient = createProxyClient();
                await startServer();
            }
        });

        client.on("error", (error) => {
            if (proxyClient) console.error(error);
        });
    });
};

startServer();

const { createClient, createServer, states } = require("minecraft-protocol");
const { CONFIG_PATH, DEFAULT_CONFIG } = require("./settings");
const fs = require("fs");
const Logger = require('./logger');

if (!fs.existsSync(CONFIG_PATH)) {
    logger.warning("Configuration file not found. Creating a new one with default values.");
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
    logger.info("Please fill in the required values in 'config.json' and restart mioxy.");
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
const logger = new Logger(config.debug);
var isPlayed = false
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
logger.info(`Player username: \x1b[36m${config.accountname}\x1b[0m`);
logger.info(`Server to connect: \x1b[36m${config.host}\x1b[0m`);
logger.client("Creating client...");

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
        if (userClient) logger.info("Proxy client ended")
    });

    client.on("error", (error) => {
        if (userClient) {
            logger.error(`Proxy client error: ${error}`);
            userClient.end(error);
        }
    });

    return client;
};

proxyClient = createProxyClient();

const getServerIcon = async (address) => {
    const response = await fetch(`https://api.mcstatus.io/v2/status/java/${address}`);
    const data = await response.json();
    logger.server("Fetched server info");
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

    logger.server("Server created!");
    logger.server(`Version: ${config.version}`)
    logger.info(`Connect to \x1b[36m${config.proxyhost}:${config.port}\x1b[0m`);

    proxyServer.on("login", (client) => {
        logger.client(`${client.username} has connected`);

        // Copy all old packets
        // TODO: "Fix invalid move player packet recieved" message
        if (!isPlayed) packets.forEach(([meta, data]) => client.write(meta.name, data));
        else if (isPlayed) {
            logger.debug('Writing old packets,  ')
            packets.forEach(([meta, data]) => {
                if (!['position'].includes(meta.name)) {
                    client.write(meta.name, data)
                }
            });
        }

        isPlayed = true

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
                logger.client(`${client.username} has disconnected`);
            }
        });

        client.on("error", (error) => {

        });
    });
};

startServer();

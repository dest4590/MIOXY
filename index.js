const { CONFIG_PATH, DEFAULT_CONFIG } = require("./settings");
const fs = require("fs");
const Logger = require('./logger');
const ProxyServer = require('./proxyServer');

const logger = new Logger();

if (!fs.existsSync(CONFIG_PATH)) {
    logger.warning("Configuration file not found. Creating a new one with default values.");
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
    logger.info("Please fill in the required values in 'config.json' and restart mioxy.");
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

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

console.clear();
console.log(banner);

const proxyServer = new ProxyServer(config, logger);
proxyServer.start();

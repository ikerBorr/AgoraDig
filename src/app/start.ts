import AgoraDigApp from "./AgoraDigApp.js";
import {buildRouters} from "./routers/index.js";


const PORT = Number(process.env.PORT) || 3000;
const TRUST_PROXY =
    process.env.TRUST_PROXY === 'true'
        ? true
        : process.env.TRUST_PROXY === 'false'
            ? false
            : process.env.TRUST_PROXY || 'loopback';

const agoraServer = new AgoraDigApp(buildRouters(), {
    jsonLimit: process.env.JSON_LIMIT || '1mb',
    rateLimit: {
        windowMs: Number(process.env.RATE_WINDOW_MS) || 60_000,
        max: Number(process.env.RATE_MAX) || 100,
    },
    helmet: {
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                "default-src": ["'self'"],
                "img-src": ["'self'", "data:"],
                "object-src": ["'none'"],
                "base-uri": ["'self'"],
                "frame-ancestors": ["'none'"],
            },
        },
    },
    health: { enabled: true, path: '/healthz', readyPath: '/readyz' },
    trustProxy: TRUST_PROXY,
    gracefulShutdownMs: Number(process.env.SHUTDOWN_TIMEOUT_MS) || 10_000,
});

agoraServer.start(PORT).catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

export default agoraServer;
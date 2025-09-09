import http from 'node:http';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import buildRouters from './routes/index.js';

/**
 * @typedef {import('express').Router} Router
 * @typedef {{ basePath: string, router: Router }[]} Routers
 * @typedef {{
 *   jsonLimit?: string;
 *   rateLimit?: { windowMs?: number; max?: number };
 *   helmet?: Parameters<typeof helmet>[0];
 *   health?: { enabled: boolean, path?: string, readyPath?: string };
 *   trustProxy?: boolean | string | number;
 *   gracefulShutdownMs?: number;
 * }} ServerOptions
 */

class AgoraDigServer {
    /** @type {express.Express} */
    #app;
    /** @type {http.Server | null} */
    #server = null;
    /** @type {boolean} */
    #isShuttingDown = false;
    /** @type {boolean} */
    #ready = false;
    /** @type {{ healthPath: string, readyPath: string, gracefulShutdownMs:
     number }} */
    #settings;

    /**
     * @param {Routers} routers
     * @param {ServerOptions} [options]
     */
    constructor(routers, options = {}) {
        this.#app = express();

        this.#settings = {
            healthPath: options.health?.path ?? '/healthz',
            readyPath: options.health?.readyPath ?? '/readyz',
            gracefulShutdownMs: options.gracefulShutdownMs ?? 10_000,
        };

        if (options.trustProxy !== undefined) {
            this.#app.set('trust proxy', options.trustProxy);
        }

        this.#installRequestId();

        this.#setSecurity(options);
        this.#setParsers(options);
        this.#setRateLimit(options);
        this.#setHealthEndpoints(options);

        this.#setRouters(routers);

        this.#app.use((req, res, _next) => {
            res.status(404).json({ error: 'Not Found', path: req.originalUrl });
        });

        this.#setErrorHandler();
    }

    /**
     * Start HTTP server (awaitable). Returns this for chaining.
     * @param {number} port
     * @param {string} [host='0.0.0.0']
     */
    async start(port, host = '0.0.0.0') {
        if (this.#server) throw new Error('Server already started');

        this.#server = http.createServer(this.#app);

        this.#server.keepAliveTimeout = 65_000;
        this.#server.headersTimeout = 66_000;
        this.#server.requestTimeout = 0;

        this.#server.on('clientError', (err, socket) => {
            try {
                if (!socket.destroyed) {
                    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
                }
            } catch (_) {
            }
        });

        await new Promise((resolve, reject) => {
            const onError = (err) => reject(err);
            this.#server.once('error', onError);
            this.#server.listen(port, host, () => {
                this.#server?.off('error', onError);
                this.#ready = true;
                console.log(`🚀 Server listening on http://${host}:${port}`);
                resolve();
            });
        });

        this.#registerProcessHandlers();
        return this;
    }

    /**
     * Gracefully stop HTTP server.
     * @param {string} [reason='manual']
     */
    async stop(reason = 'manual') {
        if (!this.#server || this.#isShuttingDown) return;
        this.#isShuttingDown = true;
        this.#ready = false;

        console.log(`🛑 Shutting down server (${reason})...`);
        await new Promise((resolve) => {
            const t = setTimeout(() => {
                console.error('⏳ Forced shutdown after timeout.');
                resolve();
            }, this.#settings.gracefulShutdownMs);
            t.unref();

            this.#server?.close(() => {
                clearTimeout(t);
                resolve();
            });
        });
    }

    #registerProcessHandlers() {
        const shutdownAndExit = async (reason, code = 0) => {
            try {
                await this.stop(reason);
            } finally {
                setImmediate(() => process.exit(code)).unref();
            }
        };

        process.on('SIGINT', () => shutdownAndExit('SIGINT', 0));
        process.on('SIGTERM', () => shutdownAndExit('SIGTERM', 0));
        process.on('uncaughtException', (err) => {
            console.error('❌ uncaughtException:', err);
            shutdownAndExit('uncaughtException', 1);
        });
        process.on('unhandledRejection', (reason) => {
            console.error('❌ unhandledRejection:', reason);
            shutdownAndExit('unhandledRejection', 1);
        });
    }

    /** @param {ServerOptions} options */
    #setSecurity(options) {
        this.#app.use(
            helmet({
                crossOriginEmbedderPolicy: false,
                ...options.helmet,
            })
        );
        this.#app.disable('x-powered-by');
    }

    /** @param {ServerOptions} options */
    #setParsers(options) {
        const jsonLimit = options.jsonLimit ?? '1mb';
        this.#app.use(express.json({ limit: jsonLimit }));
        this.#app.use(express.urlencoded({ extended: false }));

        this.#app.use((err, _req, res, next) => {
            if (err && err.type === 'entity.parse.failed') {
                return res.status(400).json({ error: 'Invalid JSON payload' });
            }
            return next(err);
        });
    }

    /** @param {ServerOptions} options */
    #setRateLimit(options) {
        const rl = {
            windowMs: 60_000,
            max: 100,
            standardHeaders: true,
            legacyHeaders: false,
            ...options.rateLimit
        };
        this.#app.use(rateLimit(rl));
    }

    /** @param {ServerOptions} options */
    #setHealthEndpoints(options) {
        const enabled = options.health?.enabled ?? true;
        if (!enabled) return;

        const { healthPath, readyPath } = this.#settings;

        this.#app.get(healthPath, (_req, res) => {
            res.json({ status: 'ok', uptime: process.uptime(), pid: process.pid });
        });

        this.#app.get(readyPath, (_req, res) => {
            res.json({ ready: this.#ready });
        });
    }

    /** @param {Routers} routers */
    #setRouters(routers) {
        if (!Array.isArray(routers)) return;
        routers.forEach(({ basePath, router }) => {
            if (!basePath || !router) return;
            const path = basePath.startsWith('/') ? basePath : `/${basePath}`;
            this.#app.use(path, router);
        });
    }

    #setErrorHandler() {
        this.#app.use((err, _req, res, _next) => {
            const status =
                err.statusCode ||
                err.status ||
                (err.name === 'ValidationError' ? 422 : 500);

            const payload = {
                error: err.publicMessage || err.message || 'Internal Server Error',
                ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
            };

            console.error(`[ERROR ${status}]`, err);
            res.status(status).json(payload);
        });
    }

    #installRequestId() {
        this.#app.use((req, res, next) => {
            const existing = req.headers['x-request-id'];
            const id =
                (Array.isArray(existing) ? existing[0] : existing) || randomUUID();
            res.setHeader('x-request-id', id);
            req.id = id;
            next();
        });
    }
}

const PORT = Number(process.env.PORT) || 3000;
const TRUST_PROXY =
    process.env.TRUST_PROXY === 'true'
        ? true
        : process.env.TRUST_PROXY === 'false'
            ? false
            : process.env.TRUST_PROXY || 'loopback';

const agoraServer = new AgoraDigServer(buildRouters(), {
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
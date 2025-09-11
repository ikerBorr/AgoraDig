import http from 'node:http';
import express, {type Express, type ErrorRequestHandler} from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type {BuildRouter} from "./routes/index.ts";

type ServerOptions = {
    jsonLimit?: string;
    rateLimit?: { windowMs?: number; max?: number };
    helmet?: Parameters<typeof helmet>[0];
    health?: { enabled: boolean, path?: string, readyPath?: string };
    trustProxy?: boolean | string | number;
    gracefulShutdownMs?: number;
}

export default class AgoraDigApp {
    private readonly app: Express;
    private server: http.Server | null = null;
    private isShuttingDown: boolean = false;
    private ready: boolean = false;
    private readonly settings: { healthPath: string, readyPath: string, gracefulShutdownMs: number };

    constructor(routers: BuildRouter[], options: ServerOptions = {}) {
        this.app = express();

        this.settings = {
            healthPath: options.health?.path ?? '/healthz',
            readyPath: options.health?.readyPath ?? '/readyz',
            gracefulShutdownMs: options.gracefulShutdownMs ?? 10_000,
        };

        if (options.trustProxy !== undefined) {
            this.app.set('trust proxy', options.trustProxy);
        }

        this.setSecurity(options);
        this.setParsers(options);
        this.setRateLimit(options);
        this.setHealthEndpoints(options);

        this.setRouters(routers);

        this.app.use((req, res, _next) => {
            res.status(404).json({ error: 'Not Found', path: req.originalUrl });
        });

        this.setErrorHandler();
    }

    async start(port: number, host: string = '0.0.0.0') {
        if (this.server) {
            throw new Error('Server already started');
        }

        this.server = http.createServer(this.app);

        this.server.keepAliveTimeout = 65_000;
        this.server.headersTimeout = 66_000;
        this.server.requestTimeout = 0;

        this.server.on('clientError', (_err, socket) => {
            try {
                if (!socket.destroyed) {
                    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
                }
            } catch {}
        });

        await new Promise<void>((resolve, reject) => {
            const onError = (err: unknown) => reject(err);
            this.server!.once('error', onError);
            this.server!.listen(port, host, () => {
                this.server!.off('error', onError);
                this.ready = true;
                console.log(`> Server listening on http://${host}:${port}`);
                resolve();
            });
        });

        this.registerProcessHandlers();
        return this;
    }

    async stop(reason: string = 'manual') {
        if (!this.server || this.isShuttingDown) {
            return;
        }
        this.isShuttingDown = true;
        this.ready = false;

        console.log(`> Shutting down server (${reason})...`);
        await new Promise<void>((resolve) => {
            const t = setTimeout(() => {
                console.error('> Forced shutdown after timeout.');
                resolve();
            }, this.settings.gracefulShutdownMs);
            t.unref();

            this.server?.close(() => {
                clearTimeout(t);
                resolve();
            });
        });
    }

    registerProcessHandlers() {
        const shutdownAndExit = async (reason: string, code = 0) => {
            try {
                await this.stop(reason);
            } finally {
                setImmediate(() => process.exit(code)).unref();
            }
        };

        process.on('SIGINT', () => shutdownAndExit('SIGINT', 0));
        process.on('SIGTERM', () => shutdownAndExit('SIGTERM', 0));
        process.on('uncaughtException', async(err) => {
            console.error('ERROR: uncaughtException:', err);
            await shutdownAndExit('uncaughtException', 1);
        });
        process.on('unhandledRejection', async(reason) => {
            console.error('ERROR: unhandledRejection:', reason);
            await shutdownAndExit('unhandledRejection', 1);
        });
    }

    setSecurity(options: ServerOptions) {
        this.app.use(
            helmet({
                crossOriginEmbedderPolicy: false,
                ...options.helmet,
            })
        );
        this.app.disable('x-powered-by');
    }

    setParsers(options: ServerOptions) {
        const jsonLimit = options.jsonLimit ?? '1mb';
        this.app.use(express.json({ limit: jsonLimit }));
        this.app.use(express.urlencoded({ extended: false }));

        const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
            if (err && err.type === 'entity.parse.failed') {
                return res.status(400).json({ error: 'Invalid JSON payload' });
            }
            return next(err);
        }
        this.app.use(errorHandler);
    }

    setRateLimit(options: ServerOptions) {
        const rl = {
            windowMs: 60_000,
            max: 100,
            standardHeaders: true,
            legacyHeaders: false,
            ...options.rateLimit
        };
        this.app.use(rateLimit(rl));
    }

    setHealthEndpoints(options: ServerOptions) {
        const enabled = options.health?.enabled ?? true;
        if (!enabled) return;

        const { healthPath, readyPath } = this.settings;

        this.app.get(healthPath, (_req, res) => {
            res.json({ status: 'ok', uptime: process.uptime(), pid: process.pid });
        });

        this.app.get(readyPath, (_req, res) => {
            res.json({ ready: this.ready });
        });
    }

    setRouters(routers: BuildRouter[]) {
        if (!Array.isArray(routers)) return;
        routers.forEach(({ basePath, router }) => {
            if (!basePath || !router) return;
            const path = basePath.startsWith('/') ? basePath : `/${basePath}`;
            this.app.use(path, router);
        });
    }

    setErrorHandler() {
        const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
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
        }

        this.app.use(errorHandler);
    }
}
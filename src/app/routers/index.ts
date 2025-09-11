import type {Router} from "express";
import makeUserRouter from "./user.router.js";
import makeAuthRouter from "./auth.router.js";

export type BuildRouter = {
    basePath: string;
    router: Router;
}

export function buildRouters(): BuildRouter[] {
    return [
        { basePath: '/api/auth', router: makeAuthRouter() },
        { basePath: '/api/users', router: makeUserRouter() },
    ];
}
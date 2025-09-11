import makeUsersRouter from "./users.route.js";
import type {Router} from "express";

export type BuildRouter = {
    basePath: string;
    router: Router;
}

export function buildRouters(): BuildRouter[] {
    return [
        { basePath: '/api/users', router: makeUsersRouter() },
    ];
}
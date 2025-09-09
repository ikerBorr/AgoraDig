import makeUsersRouter from "./users.route.js";


function buildRouters() {
    return [
        { basePath: '/api/users', router: makeUsersRouter() },
    ];
}

export default buildRouters;
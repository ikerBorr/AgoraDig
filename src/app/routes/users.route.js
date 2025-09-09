import { Router } from 'express';

function makeUsersRouter() {
    const r = Router();

    r.get('/', async (_req, res, next) => {
        try { res.status(200).json({ response: 'ok', code: 200 }); }
        catch (e) { next(e); }
    });

    r.post('/', async (req, res, next) => {
        try {
            res.status(201).json({ response: 'created', payload: req.body ?? null });
        } catch (e) { next(e); }
    });

    return r;
}
export default makeUsersRouter;
import { Router } from 'express';

function makeAuthRouter() {
    const r = Router();

    r.post('/sign-in', async (_req, res, next) => {
        try { res.status(200).json({ response: 'TODO: sign-in', code: 200 }); }
        catch (e) { next(e); }
    });

    r.post('/sign-up', async (_req, res, next) => {
        try { res.status(201).json({ response: 'TODO: sign-up', code: 201 }); }
        catch (e) { next(e); }
    });

    r.delete('/sign-out', async (req, res, next) => {
        try {
            res.status(204).json({ response: 'TODO: sign-out', code: 204 });
        } catch (e) { next(e); }
    });

    r.post('/reset-password', async (req, res, next) => {
        try {
            res.status(201).json({ response: 'TODO: sign-out', code: 201 });
        } catch (e) { next(e); }
    });

    return r;
}
export default makeAuthRouter;
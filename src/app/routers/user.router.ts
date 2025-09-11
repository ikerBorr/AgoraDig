import { Router } from 'express';

function makeUserRouter() {
    const r = Router();

    r.get('/profile', async (_req, res, next) => {
        try { res.status(200).json({ response: 'ok', code: 200 }); }
        catch (e) { next(e); }
    });

    r.patch('/profile', async (_req, res, next) => {
        try { res.status(201).json({ response: 'ok', code: 201 }); }
        catch (e) { next(e); }
    });

    r.delete('/profile', async (_req, res, next) => {
        try { res.status(204).json({ response: 'ok', code: 204 }); }
        catch (e) { next(e); }
    });

    return r;
}
export default makeUserRouter;
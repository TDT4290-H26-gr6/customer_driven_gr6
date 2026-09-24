import type { NextFunction, Request, Response } from "express";

/**
 * Express 4 doesn't catch a rejected promise from an async route handler, so
 * a failed database call becomes an unhandled rejection that takes the whole
 * process down. This forwards the error to the error handler in server.ts.
 */
export function asyncHandler<Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Req, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

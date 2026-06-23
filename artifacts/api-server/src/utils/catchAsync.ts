import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<any>;

/**
 * Wraps async functions to catch errors and pass them to the global error handler
 * @param fn - Async function to wrap
 */
const catchAsync = (fn: AsyncFunction): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

export default catchAsync;

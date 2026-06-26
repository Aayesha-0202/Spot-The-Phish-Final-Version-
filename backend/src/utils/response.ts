import { Response } from 'express';

/** Standard, readable API envelope. */
export function sendSuccess<T>(res: Response, data: T, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

export function sendCreated<T>(res: Response, data: T, message = 'Created') {
  return sendSuccess(res, data, message, 201);
}

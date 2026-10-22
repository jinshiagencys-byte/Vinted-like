import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const TRACE_ID_HEADER = 'x-trace-id';
const TRACE_ID_PATTERN = /^[a-zA-Z0-9._-]{8,64}$/;

@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const entrant = req.header(TRACE_ID_HEADER);
    const traceId =
      entrant && TRACE_ID_PATTERN.test(entrant) ? entrant : randomUUID().replace(/-/g, '');

    req.traceId = traceId;
    res.setHeader(TRACE_ID_HEADER, traceId);
    next();
  }
}

import type { Prisma } from '@prisma/client';

export interface EvenementOutbox<T extends Record<string, unknown> = Record<string, unknown>> {
  id?: string;
  type: string;
  version?: number;
  agregatType: string;
  agregatId: string;
  payload: T;
  traceId?: string;
}

export interface EnveloppeEvenement {
  id: string;
  type: string;
  version: number;
  occurredAt: string;
  aggregateType: string;
  aggregateId: string;
  traceId?: string;
  payload: Prisma.JsonValue;
}

/**
 * Lightweight typed oRPC-style procedure layer.
 *
 * Each procedure declares a Zod input schema and a handler that receives
 * { input, ctx } and returns typed output. The router aggregates procedures
 * and Hono exposes them under /rpc/:path. This keeps a single source of
 * truth for request/response types shared with the mobile client.
 */
import { z } from 'zod';

export interface RpcContext {
  userId: string;
  /** Added by the upload/stream procedures when needed. */
  signal?: AbortSignal;
}

export type AnyInputSchema = z.ZodTypeAny;
export type ProcedureDef<I extends AnyInputSchema, O> = {
  input: I;
  handler: (args: { input: z.infer<I>; ctx: RpcContext }) => Promise<O> | O;
};

export type AnyProcedure = ProcedureDef<AnyInputSchema, unknown>;

/** Router nodes can be individual procedures or nested sub-routers. */
export type RouterNode = AnyProcedure | { [key: string]: RouterNode };
export type RouterShape = Record<string, RouterNode>;

/** Build a procedure. ``procedure(schema, handler)``. */
export function procedure<I extends AnyInputSchema, O>(
  input: I,
  handler: ProcedureDef<I, O>['handler'],
): ProcedureDef<I, O> {
  return { input, handler };
}

export function router<R extends RouterShape>(routes: R): R {
  return routes;
}

export type InferRouter<R extends RouterShape> = {
  [K in keyof R]: R[K] extends ProcedureDef<any, infer O>
    ? { input: z.infer<R[K]['input']>; output: O }
    : never;
};

/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as crons from "../crons.js";
import type * as edges from "../edges.js";
import type * as nodes from "../nodes.js";
import type * as processors_convertVideo from "../processors/convertVideo.js";
import type * as processors_summarize from "../processors/summarize.js";
import type * as processors_transcribe from "../processors/transcribe.js";
import type * as scheduler from "../scheduler.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  edges: typeof edges;
  nodes: typeof nodes;
  "processors/convertVideo": typeof processors_convertVideo;
  "processors/summarize": typeof processors_summarize;
  "processors/transcribe": typeof processors_transcribe;
  scheduler: typeof scheduler;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

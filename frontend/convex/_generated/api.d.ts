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
import type * as chunks from "../chunks.js";
import type * as db from "../db.js";
import type * as dev from "../dev.js";
import type * as file_relationships from "../file_relationships.js";
import type * as files from "../files.js";
import type * as folders from "../folders.js";
import type * as jobs from "../jobs.js";
import type * as parsers from "../parsers.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  chunks: typeof chunks;
  db: typeof db;
  dev: typeof dev;
  file_relationships: typeof file_relationships;
  files: typeof files;
  folders: typeof folders;
  jobs: typeof jobs;
  parsers: typeof parsers;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

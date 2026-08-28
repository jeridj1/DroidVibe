/**
 * DroidVibe database schema (Turso / libSQL via Drizzle ORM).
 *
 * Tables: sketches, sketch_files, sketch_versions, boards_cache,
 * libraries_cache, builds, captures, devices.
 */
import {
  sqliteTable,
  text,
  integer,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const now = sql`(unixepoch())`;

export const sketches = sqliteTable('sketches', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  fqbn: text('fqbn').notNull().default('arduino:avr:uno'),
  port: text('port'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(now),
});

export const sketchFiles = sqliteTable('sketch_files', {
  id: text('id').primaryKey(),
  sketchId: text('sketch_id')
    .notNull()
    .references(() => sketches.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  content: text('content').notNull().default(''),
  language: text('language').notNull().default('ino'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(now),
});

export const sketchVersions = sqliteTable('sketch_versions', {
  id: text('id').primaryKey(),
  sketchId: text('sketch_id')
    .notNull()
    .references(() => sketches.id, { onDelete: 'cascade' }),
  label: text('label'),
  snapshot: text('snapshot').notNull(), // JSON of files at this version
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
});

export const boardsCache = sqliteTable('boards_cache', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  fqbn: text('fqbn').primaryKey(),
  platform: text('platform').notNull(),
  version: text('version').notNull(),
  installed: integer('installed', { mode: 'boolean' }).notNull().default(false),
  payload: text('payload').notNull(), // JSON of the board/package descriptor
  cachedAt: integer('cached_at', { mode: 'timestamp' }).notNull().default(now),
});

export const librariesCache = sqliteTable('libraries_cache', {
  id: text('id').primaryKey(),
  name: text('name').primaryKey(),
  author: text('author'),
  version: text('version'),
  sentence: text('sentence'),
  paragraph: text('paragraph'),
  installed: integer('installed', { mode: 'boolean' }).notNull().default(false),
  payload: text('payload').notNull(), // JSON of the library index entry
  cachedAt: integer('cached_at', { mode: 'timestamp' }).notNull().default(now),
});

export const builds = sqliteTable('builds', {
  id: text('id').primaryKey(),
  sketchId: text('sketch_id').references(() => sketches.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  fqbn: text('fqbn').notNull(),
  ok: integer('ok', { mode: 'boolean' }).notNull(),
  diagnostics: text('diagnostics').notNull().default('[]'), // JSON
  firmwarePath: text('firmware_path'),
  durationMs: integer('duration_ms').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
});

export const captures = sqliteTable('captures', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  label: text('label'),
  config: text('config').notNull(), // JSON CaptureConfig
  dataPath: text('data_path'), // storage path to packed samples
  durationUs: integer('duration_us').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(now),
});

export const devices = sqliteTable('devices', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  vendorId: text('vendor_id').notNull(),
  productId: text('product_id').notNull(),
  serialNumber: text('serial_number'),
  productName: text('product_name'),
  label: text('label'),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull().default(now),
});

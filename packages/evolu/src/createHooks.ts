import { readonlyArray } from "fp-ts";
import { pipe } from "fp-ts/lib/function.js";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import * as db from "./db.js";
import { kysely } from "./kysely.js";
import {
  DbSchema,
  SQLiteRowRecord,
  sqlQueryToString,
  UseMutation,
  UseQuery,
} from "./types.js";

/**
 * Create `useQuery` and `useMutation` React Hooks for a given DB schema.
 *
 * @example
 * const { useQuery, useMutation } = createHooks({
 *   todo: {
 *     id: TodoId,
 *     title: model.NonEmptyString1000,
 *     isCompleted: model.SqliteBoolean,
 *   },
 * });
 */
export const createHooks = <S extends DbSchema>(
  dbSchema: S
): {
  readonly useQuery: UseQuery<S>;
  readonly useMutation: UseMutation<S>;
} => {
  db.updateDbSchema(dbSchema)();

  const cache = new WeakMap<SQLiteRowRecord, SQLiteRowRecord>();

  // @ts-expect-error IDK but it's internal so we don't care.
  const useQuery: UseQuery<S> = (query, initialFilterMap) => {
    const sqlQueryString = query
      ? pipe(query(kysely as never).compile(), sqlQueryToString)
      : null;

    const rawRows = pipe(
      useSyncExternalStore(
        db.listen,
        () => db.getSubscribedQueryRows(sqlQueryString),
        () => null
      )
    );

    useEffect(() => {
      if (!sqlQueryString) return;
      return db.subscribeQuery(sqlQueryString);
    }, [sqlQueryString]);

    const filterMapRef = useRef(initialFilterMap);

    const getRowFromCache = (rawRow: SQLiteRowRecord): SQLiteRowRecord => {
      if (cache.has(rawRow)) return cache.get(rawRow) as SQLiteRowRecord;
      const row = filterMapRef.current(rawRow as never) as SQLiteRowRecord;
      cache.set(rawRow, row);
      return row;
    };

    const rows = useMemo(() => {
      if (!filterMapRef.current || rawRows == null) return rawRows;
      const rows: Array<SQLiteRowRecord> = [];
      for (let i = 0; i < rawRows.length; i++) {
        const row = getRowFromCache(rawRows[i]);
        if (row != null) rows.push(row);
      }
      return rows;
    }, [rawRows]);

    return useMemo(
      () => ({
        rows: rows || readonlyArray.empty,
        row: (rows && rows[0]) || null,
        isLoaded: rows != null,
      }),
      [rows]
    );
  };

  const mutate = db.createMutate<S>();
  const useMutation: UseMutation<S> = () => ({
    mutate,
  });

  return {
    useQuery,
    useMutation,
  };
};

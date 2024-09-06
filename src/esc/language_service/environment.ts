// Copyright 2024, Pulumi Corporation. All rights reserved.
import * as esc from "../models";

import * as yaml from "./yaml-document";

/**
 * schemaPathForDocumentPath returns the schema path for the given document path.
 *
 * The schema path for an expression describes the path to the element in the environment's schema that
 * corresponds to the expression. An expression's schema path and document path may be different, as
 * arguments to function calls do not appear in the ouptut schema. In that case, the schema path is
 * the path to the outermost function call expression.
 *
 * @param exprs the ESC AST
 * @param path the YAML document path
 * @return The schema path, if any.
 */
export function schemaPathForDocumentPath(
    exprs: Record<string, esc.Expr> | undefined,
    path: yaml.Accessor[],
): yaml.Accessor[] | undefined {
    if (exprs === undefined || path.length < 2 || path[0] !== "values") {
        return undefined;
    }

    const topLevelKey = path[1];
    if (typeof topLevelKey !== "string") {
        return undefined;
    }

    const schemaPath: yaml.Accessor[] = [topLevelKey];
    let cursor = exprs[topLevelKey];
    for (let i = 2; i < path.length && cursor !== undefined; i++) {
        let accessor = path[i];

        if (esc.isList(cursor)) {
            const list = cursor.list;
            if (typeof accessor !== "number" || accessor < 0 || accessor >= list.length) {
                return undefined;
            }
            cursor = list[accessor];
            schemaPath.push(accessor);
        } else if (esc.isObject(cursor)) {
            if (typeof accessor !== "string") {
                return undefined;
            }
            cursor = cursor.object[accessor];
            schemaPath.push(accessor);
        } else if (esc.isBuiltin(cursor)) {
            if (typeof accessor !== "string" || accessor !== cursor.builtin.name) {
                return undefined;
            }
            break;
        }
    }
    return cursor === undefined ? undefined : schemaPath;
}

export interface ExprAtPath {
    expr: esc.Expr;
    builtin?: esc.BuiltinExpr;
    argPath?: yaml.Accessor[];
}

/**
 * exprAtPath returns the expression at the given document path, if any.
 *
 * @param exprs the ESC AST
 * @param path the YAML document path
 * @return The expression at the path, if any.
 */
export function exprAtPath(exprs: Record<string, esc.Expr> | undefined, path: yaml.Accessor[]): ExprAtPath | undefined {
    if (exprs === undefined || path.length < 2 || path[0] !== "values") {
        return undefined;
    }

    const topLevelKey = path[1];
    if (typeof topLevelKey !== "string") {
        return undefined;
    }

    let builtin: esc.BuiltinExpr | undefined;
    let argPath: yaml.Accessor[] | undefined;
    let cursor = exprs[topLevelKey];
    for (let i = 2; i < path.length && cursor !== undefined; i++) {
        let accessor = path[i];

        if (esc.isList(cursor)) {
            const list = cursor.list;
            if (typeof accessor !== "number" || accessor < 0 || accessor >= list.length) {
                return undefined;
            }
            argPath?.push(accessor);
            cursor = list[accessor];
        } else if (esc.isObject(cursor)) {
            if (typeof accessor !== "string") {
                return undefined;
            }
            argPath?.push(accessor);
            cursor = cursor.object[accessor];
        } else if (esc.isBuiltin(cursor)) {
            if (typeof accessor !== "string" || accessor !== cursor.builtin.name) {
                return undefined;
            }
            builtin = cursor;
            argPath = [];
            cursor = cursor.builtin.arg;
        }
    }
    return { expr: cursor, builtin, argPath };
}

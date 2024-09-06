// Copyright 2024, Pulumi Corporation. All rights reserved.
import * as esc from "../models";

import * as document from "./document-schema";
import { exprAtPath } from "./environment";
import { FunctionSchemas } from "./functions";
import { Schema } from "./schema";
import * as yaml from "./yaml-document";
import * as vscode from 'vscode';

/**
 * schemaType generates a type definition for a schema type.
 *
 * Array and object types are simplified to their type names rather than their expanded types.
 *
 * @param schema the schema to prettify
 */
function schemaType(schema: Schema | undefined): string {
    function union(schemas: Schema[]): string {
        return schemas.map((s) => schemaType(s)).join(" | ");
    }

    if (schema === undefined || schema.always) {
        return "any";
    }
    if (schema.never) {
        return "void";
    }
    if (schema.oneOf?.length) {
        return union(schema.oneOf);
    }
    if (schema.anyOf?.length) {
        return union(schema.anyOf);
    }
    if (schema.resolved !== undefined) {
        schema = schema.resolved;
    }
    return schema.type ?? "any";
}

/**
 * schemaHover generates hover text for the given schema.
 *
 * The returned hover text will include the type (unless the type is never) and the schema's description
 * property, if any. Returns undefined if no text is available.
 */
function schemaHover(schema: Schema): vscode.Hover | undefined {
    const contents: vscode.MarkdownString[] = [];
    if (!schema.never) {
        ;
        contents.push(new vscode.MarkdownString("```typescript\n" + schemaType(schema) + "\n```\n"));
    }
    if (schema.description !== undefined) {
        contents.push(new vscode.MarkdownString(schema.description));
    }

    return contents.length !== 0 ? { contents } : undefined;
}

/**
 * subschemaHover generates hover text for a property of the given schema.
 *
 * The returned hover text will include the type (unless the type is never) and the schema's description
 * property, if any. Returns undefined if no text is available.
 *
 * @param accessors the path to the property for which to return hover text
 * @param schema the parent schema
 */
function subschemaHover(accessors: yaml.Accessor[], schema: Schema): vscode.Hover | undefined {
    for (const a of accessors) {
        if (typeof a === "string") {
            schema = schema.property(a);
        } else {
            schema = schema.item(a);
        }
    }
    return schemaHover(schema);
}

/**
 * objectKeyHover returns hover text for a key inside an object expression.
 *
 * If the key is inside an argument to a function, this returns hover text for the function input.
 * Otherwise, this returns no hover text.
 *
 * @param expr the containing object expression
 * @param builtin the builtin function that expr is passed to, if any
 * @param argPath the path to expr within the builtin, if any
 * @param key the key within the object expression, if any
 * @param functions builtin functionschemas
 */
async function objectKeyHover(
    builtin: esc.BuiltinExpr | undefined,
    argPath: yaml.Accessor[] | undefined,
    key: string | undefined,
    functions: FunctionSchemas,
): Promise<vscode.Hover | undefined> {
    if (key === undefined || builtin === undefined) {
        return undefined;
    }
    const accessors = argPath === undefined ? [key] : argPath.concat(key);
    return builtinHover(builtin, accessors, functions);
}

/**
 * builtinHover returns hover text for a builtin function or an arguemnt to a builtin function.
 *
 * @param expr the builtin function expression
 * @param argPath the path to the argument within the builtin function, if any
 * @param functions builtin functionschemas
 */
async function builtinHover(
    expr: esc.BuiltinExpr,
    argPath: yaml.Accessor[],
    functions: FunctionSchemas,
): Promise<vscode.Hover | undefined> {
    const functionSchema = await functions.get(expr.builtin.name);
    if (functionSchema === undefined) {
        return undefined;
    }

    // If we're hovering over the function itself, return the function signature and its docstring.
    if (argPath.length === 0) {
        const name = functionSchema.name;
        const inputType = schemaType(functionSchema.inputs);
        const outputType = schemaType(functionSchema.outputs);

        const signature = `${name}(${inputType}): ${outputType}`;
        let markdown = `\`\`\`typescript
${signature}
\`\`\`

${functionSchema.description}
`;
        return { contents: [new vscode.MarkdownString(markdown)] };
    }

    return subschemaHover(argPath, functionSchema.inputs);
}

/**
 * accessHover returns hover text for a property access.
 *
 * The hover text includes the type and description of the referenced property.
 *
 * @param access the property access
 * @param schema the environment schema
 * @param offset the position of the cursor
 */
function accessHover(
    access: esc.PropertyAccessor[],
    schema: Schema,
    offset: number,
): vscode.Hover | undefined {
    // Determine which accessor we're in.
    let i = 0;
    for (i = 0; i < access.length; i++) {
        const accessor = access[i];
        // TODO: Please replace this equality operator w/ a type safe one (===) if touching this code
        // eslint-disable-next-line eqeqeq
        const inclusive = i == access.length - 1;
        const [begin, end] = [accessor.range.begin.byte, accessor.range.end.byte];
        // TODO: Please replace this equality operator w/ a type safe one (===) if touching this code
        // eslint-disable-next-line eqeqeq
        if (offset >= begin && (offset < end || (inclusive && offset == end))) {
            break;
        }
    }
    if (i === access.length) {
        return undefined;
    }

    for (let j = 0; j <= i; j++) {
        const a = access[j];
        if (esc.isKey(a)) {
            schema = schema.property(a.key);
        } else {
            schema = schema.item(a.index);
        }
    }

    return schemaHover(schema);
}

/**
 * symbolHover returns hover text for a symbol expression.
 *
 * Just calls accessHover.
 */
function symbolHover(expr: esc.SymbolExpr, schema: Schema, offset: number): vscode.Hover | undefined {
    return accessHover(expr.symbol, schema, offset);
}

/**
 * interpolateHover returns hover text for an access within an interpolate expression.
 *
 * Calls accessHover for each part until the containing accessor (if any) is found.
 */
function interpolateHover(
    expr: esc.InterpolateExpr,
    schema: Schema,
    offset: number,
): vscode.Hover | undefined {
    for (const part of expr.interpolate) {
        const hover = accessHover(part.value, schema, offset);
        if (hover !== undefined) {
            return hover;
        }
    }
    return undefined;
}

/**
 * provideHover returns hover text for the entity at the given offset.
 *
 * In general, hover text includes the entity's type and description.
 *
 * @param doc the YAML document
 * @param exprs the ESC AST
 * @param schema the ESC schema
 * @param offset the cursor offset
 * @param functions builtin function schemas
 */
export async function provideHover(
    doc: yaml.Document | undefined,
    exprs: Record<string, esc.Expr> | undefined,
    schema: Schema | undefined,
    offset: number,
    functions: FunctionSchemas,
): Promise<vscode.Hover | undefined> {
    const yamlNode = yaml.findInDocument(doc, offset);
    if (yamlNode === undefined) {
        return undefined;
    }
    const { path } = yamlNode;

    const objectKey = (() => {
        const lastElement = path[path.length - 1];
        if (lastElement.type !== "map-key") {
            return undefined;
        }
        const key = lastElement.entry.key;
        if (key?.type !== "scalar") {
            return undefined;
        }
        return key.source;
    })();

    const pathAccessors = yaml.pathAccessors(path);
    const at = exprAtPath(exprs, pathAccessors);
    if (at !== undefined) {
        const { expr, builtin, argPath } = at;
        if (esc.isObject(expr)) {
            return objectKeyHover(builtin, argPath, objectKey, functions);
        }
        if (esc.isBuiltin(expr)) {
            return builtinHover(expr, [], functions);
        }
        if (schema !== undefined) {
            if (esc.isSymbol(expr)) {
                return symbolHover(expr, schema, offset);
            }
            if (esc.isInterpolate(expr)) {
                return interpolateHover(expr, schema, offset);
            }
        }
    }

    if (objectKey !== undefined) {
        pathAccessors.push(objectKey);
        return subschemaHover(pathAccessors, document.schema);
    }
    return undefined;
}

/**
 * provide returns hover text for the entity at the given offset.
 *
 * In general, hover text includes the entity's type and description.
 *
 * @param doc the YAML document
 * @param exprs the ESC AST
 * @param schema the ESC schema
 * @param offset the cursor offset
 * @param functions builtin function schemas
 * @param cancellationToken cancellation token for the operation.
 */
export async function provide(
    doc: yaml.Document | undefined,
    exprs: Record<string, esc.Expr> | undefined,
    schema: Schema | undefined,
    offset: number,
    functions: FunctionSchemas,
    _: vscode.CancellationToken,
): Promise<vscode.Hover> {
    const hover = await provideHover(doc, exprs, schema, offset, functions);
    return hover ?? new vscode.Hover([]);
}

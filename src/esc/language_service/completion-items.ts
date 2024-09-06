// Copyright 2024, Pulumi Corporation. All rights reserved.

import * as document from "./document-schema";
import { exprAtPath, schemaPathForDocumentPath } from "./environment";
import { FunctionSchemas } from "./functions";
import { Schema } from "./schema";
import * as yaml from "./yaml-document";
import * as esc from "../models";

// We duplicate this here for testing purposes. The tests don't load monaco, so this code can't use
// monaco values in code that executes during unit tests. We could clean this up in the future by
// figuring out how to load monaco during testing.
export enum CompletionItemKind {
    Method = 0,
    Function = 1,
    Constructor = 2,
    Field = 3,
    Variable = 4,
    Class = 5,
    Struct = 6,
    Interface = 7,
    Module = 8,
    Property = 9,
    Event = 10,
    Operator = 11,
    Unit = 12,
    Value = 13,
    Constant = 14,
    Enum = 15,
    EnumMember = 16,
    Keyword = 17,
    Text = 18,
    Color = 19,
    File = 20,
    Reference = 21,
    Customcolor = 22,
    Folder = 23,
    TypeParameter = 24,
    User = 25,
    Issue = 26,
    Snippet = 27,
}

export interface CompletionItem {
    label: string;
    insertText: string;
    documentation: string;
    kind: CompletionItemKind;
}

interface ObjectKey {
    accessors?: yaml.Accessor[];
    object?: yaml.Value;
    isKey: boolean;
}

function isScalarPossibleObjectKey(last: yaml.PathItem, node: yaml.Node, offset: number): ObjectKey {
    // If this value is at the root of the document, treat it as a possible object key.
    if (last.type === "document-value") {
        return { isKey: true };
    }

    // If the last path element is a map key, then we're trivially at an object key.
    //
    // foo:
    // ^
    // TODO: Please replace this equality operator w/ a type safe one (===) if touching this code
    // eslint-disable-next-line eqeqeq
    if (last.type == "map-key") {
        return { object: last.parent, isKey: true };
    }

    // foo:
    //   f
    //   ^
    if (last.type === "map-value") {
        // Special-case root-level trivia.
        const indent = yaml.indent(node, offset);
        if (indent === 0) {
            return { accessors: [], isKey: true };
        }
        return { isKey: indent > last.parent.indent };
    }

    // foo:
    //   - f
    //     ^
    if (last.type === "seq-item") {
        return { isKey: true };
    }

    return { isKey: false };
}

function isStartTriviaPossibleObjectKey(path: yaml.Path, triviaItem: yaml.TriviaItem, offset: number): ObjectKey {
    const pred = path[path.length - 2];

    // If we're in the document's start trivia, then we're at an object key.
    if (pred.parent.type === "document") {
        return { isKey: true };
    }

    // foo:
    //
    //   ^
    // bar: baz
    //
    // NOTE: technically speaking this trivia is attached to `bar`. Ideally we'd recompose this trivia as
    // foo's map value, which would eliminate the need for this case, as the scalar/trivia-item matcher
    // would catch it.
    const mapEntry = path[path.length - 3];
    if (mapEntry.type === "map-key") {
        const indent = yaml.indent(triviaItem, offset);
        
        const parentMap = mapEntry.parent;
        const index = parentMap.entries.findIndex((entry) => yaml.inRange(offset, entry.range, true));
        if (index < 0) {
            return { object: mapEntry.parent, isKey: true };
        }

        let cursor = parentMap.entries[index - 1].value;
        if (cursor === undefined) {
            return { isKey: false };
        }

        const accessors: yaml.Accessor[] = yaml.pathAccessors(path.slice(0, path.length - 3));
        return descendToLastValueWithIndent(accessors, cursor, indent);
    }

    // foo:
    //
    //   ^
    //   bar: baz
    if (mapEntry.type === "map-value") {
        return { object: mapEntry.entry.value, isKey: true };
    }

    return { isKey: false };
}

function descendToLastValueWithIndent(accessors: yaml.Accessor[], cursor: yaml.Value, indent: number): ObjectKey {
    while (cursor !== undefined && cursor.indent !== undefined && cursor.indent <= indent) {
        switch (cursor.type) {
            case "map":
                if (cursor.indent === indent) {
                    return { accessors, object: cursor, isKey: true };
                }
                if (cursor.entries.length === 0) {
                    return { isKey: false };
                }
                const entry = cursor.entries[cursor.entries.length - 1];
                accessors.push(yaml.entryKey(entry));
                cursor = entry.value;
                break;
            case "seq":
                if (cursor.items.length === 0) {
                    return { isKey: false };
                }
                const index = cursor.items.length - 1;
                accessors.push(index);
                cursor = cursor.items[index];
                break;
        }
    }
    
    return { isKey: false };
}

function isEndTriviaPossibleObjectKey(path: yaml.Path, node: yaml.TriviaItem, offset: number): ObjectKey {
    const pred = path[path.length - 2];

    // foo:
    //   f
    //    ^
    //
    // foo:
    //   bar: baz
    //
    // ^
    if (pred.parent.type === "scalar") {
        // Special-case root-level trivia.
        const indent = yaml.indent(node, offset);
        if (indent === 0) {
            return { accessors: [], isKey: true };
        }

        const grandparent = path[path.length - 3];
        const greatIndent = grandparent.parent?.indent || 0;
        return { isKey: indent > greatIndent };
    }

    // The only other possibility here is document end trivia.
    //
    // Unfortunately, this is the trickiest case. Starting at the document, we descend until we hit the
    // last value with an indent level that matches the indent level of the node.

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const doc = pred.parent as yaml.Document;

    const indent = yaml.indent(node, offset);
    const accessors: yaml.Accessor[] = [];
    let cursor = doc.value;
    return descendToLastValueWithIndent(accessors, cursor, indent);
}

function isTriviaPossibleObjectKey(path: yaml.Path, node: yaml.TriviaItem, offset: number): ObjectKey {
    if (node.token.type !== "space" && node.token.type !== "newline") {
        return { isKey: false };
    }

    const pred = path[path.length - 2];
    switch (pred.type) {
        case "start":
            return isStartTriviaPossibleObjectKey(path, node, offset);
        case "end":
            return isEndTriviaPossibleObjectKey(path, node, offset);
        default:
            // Special-case map-value trivia following a key that starts with "fn:" or "fn::"
            //
            // foo:
            //   fn:
            //      ^
            //
            // foo:
            //   fn::
            //       ^
            //
            if (pred.type === "map-value") {
                const key = pred.entry.key;
                if (key?.type === "scalar" && (key?.source === "fn" || key?.source?.startsWith("fn:"))) {
                    return { isKey: true };
                }
            }

            return isScalarPossibleObjectKey(pred, node, offset);
    }
}

export function isPossibleObjectKey(path: yaml.Path, node: yaml.Node, offset: number): ObjectKey {
    // Can't be at an object key if the path is empty.
    if (path.length === 0) {
        return { isKey: false };
    }

    let last = path[path.length - 1];
    switch (last.type) {
        case "map-key":
            // If the last path element is a map key, then we're trivially at an object key.
            return { object: last.parent, isKey: true };
        case "trivia-item":
            // If the last path element is a space or a newline, we may be at an object key.
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            return isTriviaPossibleObjectKey(path, node as yaml.TriviaItem, offset);
        default:
            // If the node is a scalar, we may be at an object key.
            if (node?.type === "scalar") {
                return isScalarPossibleObjectKey(last, node, offset);
            }
            return { isKey: false };
    }
}

function objectKeys(map: yaml.Value): Set<string> {
    const keys = new Set<string>();
    if (map === undefined || map.type !== "map") {
        return keys;
    }

    for (const entry of map.entries) {
        if (entry.key?.type === "scalar") {
            keys.add(entry.key.source);
        }
    }
    return keys;
}

function filterObjectKeySuggestions(
    existingKeys: Set<string>,
    suggestions: Record<string, CompletionItem>,
): CompletionItem[] {
    return Object.entries(suggestions)
        .filter(([k]) => !existingKeys.has(k))
        .map(([_, v]) => v);
}

function schemaSuggestions(
    accessors: yaml.Accessor[],
    object: yaml.Value,
    schema: Schema,
): CompletionItem[] | undefined {
    for (const a of accessors) {
        if (typeof a === "string") {
            schema = schema.property(a);
        } else {
            schema = schema.item(a);
        }
    }

    const suggestions = Object.entries(schema.allProperties()).map(([name, prop]) => [
        name,
        {
            label: name + ":",
            insertText: name + ":",
            documentation: prop.description,
            kind: CompletionItemKind.Property,
        },
    ]);
    if (suggestions.length === 0) {
        return undefined;
    }
    return filterObjectKeySuggestions(objectKeys(object), Object.fromEntries(suggestions));
}

function topLevelKeySuggestions(root: yaml.Value): CompletionItem[] {
    return schemaSuggestions([], root, document.schema) || [];
}

function wellKnownKeySuggestions(values: yaml.Value): CompletionItem[] {
    return schemaSuggestions(["values"], values, document.schema) || [];
}

async function builtinFunctionSuggestions(
    object: yaml.Value,
    key: yaml.Node,
    functions: FunctionSchemas,
): Promise<CompletionItem[]> {
    const keys = objectKeys(object);

    // If this object is not empty, do not add any suggestions.
    if (keys.size >= 2 || (keys.size === 1 && key?.type === "trivia-item")) {
        return [];
    }

    const builtins = await functions.list();

    return Object.values(builtins).filter((schema) => schema !== undefined).map((schema) => ({
        label: schema!.name + ":",
        insertText: schema!.name + ":",
        documentation: schema!.description,
        kind: CompletionItemKind.Function,
    }));
}

async function functionSchemaSuggestions(
    accessors: yaml.Accessor[],
    object: yaml.Value,
    functions: FunctionSchemas,
): Promise<CompletionItem[] | undefined> {
    // Find the nearest builtin function call.
    let functionNameIndex = -1;
    for (let i = accessors.length - 1; i >= 0; i--) {
        const accessor = accessors[i];
        if (typeof accessor === "string" && accessor.startsWith("fn::")) {
            functionNameIndex = i;
            break;
        }
    }
    if (functionNameIndex === -1) {
        return undefined;
    }
    const functionName = accessors[functionNameIndex];

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const functionSchema = await functions.get(functionName as string);
    if (functionSchema === undefined) {
        return [];
    }

    let schema = functionSchema.inputs;
    accessors = accessors.slice(functionNameIndex + 1);

    for (const a of accessors) {
        if (typeof a === "string") {
            schema = schema.property(a);
        } else {
            schema = schema.item(a);
        }
    }

    const suggestions = Object.entries(schema.allProperties()).map(([name, prop]) => [
        name,
        {
            label: name + ":",
            insertText: name + ":",
            documentation: prop.description,
            kind: CompletionItemKind.Property,
        },
    ]);
    if (suggestions.length === 0) {
        return undefined;
    }
    return filterObjectKeySuggestions(objectKeys(object), Object.fromEntries(suggestions));
}

async function objectKeySuggestions(
    doc: yaml.Document | undefined,
    accessors: yaml.Accessor[],
    object: yaml.Value,
    key: yaml.Node,
    offset: number,
    functions: FunctionSchemas,
): Promise<CompletionItem[]> {
    // Is this a top-level key?
    if (accessors.length === 0) {
        return topLevelKeySuggestions(doc?.value);
    }

    // Are we in the values section?
    if (accessors[0] !== "values") {
        return [];
    }

    // Is this a top-level values key?
    if (accessors.length === 1) {
        return wellKnownKeySuggestions(object);
    }

    // Attempt to suggest from schemata.
    const suggestions = await functionSchemaSuggestions(accessors, object, functions);
    if (suggestions !== undefined && suggestions.length > 0) {
        return suggestions;
    }

    return await builtinFunctionSuggestions(object, key, functions);
}

function accessSuggestions(
    schemaPath: yaml.Accessor[],
    access: esc.PropertyAccessor[],
    schema: Schema,
    offset: number,
): CompletionItem[] | undefined {
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

        let index: yaml.Accessor = "";
        if (esc.isKey(a)) {
            index = a.key;
            schema = schema.property(a.key);
        } else {
            index = a.index;
            schema = schema.item(a.index);
        }

        if (schemaPath.length !== 0 && index === schemaPath[0]) {
            schemaPath.shift();
        }
    }

    return Object.entries(schema.allProperties())
        .filter(([name, _]) => {
            return schemaPath.length !== 1 || name !== schemaPath[0];
        })
        .map(([name, prop]) => ({
            label: name,
            insertText: name,
            documentation: prop.description || name,
            kind: CompletionItemKind.Property,
        }));
}

function symbolSuggestions(
    schemaPath: yaml.Accessor[],
    expr: esc.SymbolExpr,
    schema: Schema,
    contextSchema: Schema,
    offset: number,
): CompletionItem[] {
    const suggestions = accessSuggestions(schemaPath, expr.symbol, schema, offset) || [];
    const contextSuggestion = accessSuggestions(schemaPath, expr.symbol, contextSchema, offset) || [];
    return suggestions.concat(contextSuggestion);
}

function interpolateSuggestions(
    schemaPath: yaml.Accessor[],
    expr: esc.InterpolateExpr,
    schema: Schema,
    contextSchema: Schema,
    offset: number,
): CompletionItem[] {
    for (const part of expr.interpolate) {
        const suggestions = accessSuggestions(schemaPath, part.value, schema, offset) || [];
        const contextSuggestion = accessSuggestions(schemaPath, part.value, contextSchema, offset) || [];
        suggestions.concat(...contextSuggestion);
        if (suggestions.length > 0) {
            return suggestions;
        }
    }
    return [];
}

/**
 * We are focusing only on supporting autocompletion of values listed on the schemas. Currently, this only usecase
 * exists for builtins (providers) defining an allowlist for its inputs (ie: subjectAttributes).
 *
 * @param builtin
 * @param argPath
 * @returns CompletionItem[]
 */
function literalSuggestions(builtin: esc.BuiltinExpr, argPath: yaml.Accessor[]): CompletionItem[] {
    let path = argPath;
    let argSchema = Schema.new(builtin.builtin.argSchema);

    for (let a = 0; a < path.length; a++) {
        const part = path[a];

        if (typeof part === "string") {
            argSchema = argSchema.property(part);
        } else {
            argSchema = argSchema.item(part);
        }
    }

    // TODO: Please replace this equality operator w/ a type safe one (===) if touching this code
    // eslint-disable-next-line eqeqeq
    if (argSchema.enum != undefined) {
        return (
            argSchema.enum.map((v) => ({
                label: v,
                insertText: v,
                documentation: "",
                kind: CompletionItemKind.Value,
            })) || []
        );
    }

    // TODO: Please replace this equality operator w/ a type safe one (===) if touching this code
    // eslint-disable-next-line eqeqeq
    if (argSchema.const != undefined) {
        const v = argSchema.const;
        return [
            {
                label: v,
                insertText: v,
                documentation: "",
                kind: CompletionItemKind.Value,
            },
        ];
    }

    return [];
}

export async function provideSuggestions(
    doc: yaml.Document | undefined,
    exprs: Record<string, esc.Expr> | undefined,
    schema: Schema | undefined,
    contextSchema: Schema | undefined,
    offset: number,
    functions: FunctionSchemas,
): Promise<CompletionItem[]> {
    const yamlNode = yaml.findInDocument(doc, offset);
    if (yamlNode === undefined) {
        return [];
    }
    const { path, node } = yamlNode;

    const pathAccessors = yaml.pathAccessors(path);

    const at = exprAtPath(exprs, pathAccessors);

    if (at !== undefined && at.builtin !== undefined && at.argPath !== undefined) {
        const suggestions = literalSuggestions(at.builtin, at.argPath);
        if (suggestions.length > 0) {
            return suggestions;
        }
    }

    // Is this part of an interpolation?
    if (schema !== undefined && contextSchema !== undefined && at !== undefined) {
        const expr = at.expr;
        const schemaPath = schemaPathForDocumentPath(exprs, pathAccessors) || [];
        if (esc.isSymbol(expr)) {
            return symbolSuggestions(schemaPath, expr, schema, contextSchema, offset);
        }
        if (esc.isInterpolate(expr)) {
            return interpolateSuggestions(schemaPath, expr, schema, contextSchema, offset);
        }
    }

    // Is this an object key?
    const key = isPossibleObjectKey(path, node, offset);
    if (key.isKey) {
        const accessors = key.accessors ?? pathAccessors;
        return objectKeySuggestions(doc, accessors, key.object, node, offset, functions);
    }

    return [];
}

// Copyright 2024, Pulumi Corporation. All rights reserved.
import { CST } from "yaml";

/**
 * TriviaTokens are YAML tokens that do not represent values.
 */
export type TriviaToken = CST.SourceToken | CST.ErrorToken | CST.Directive;

/**
 * A Range represents a range of code units in a YAML source document. Can be used to index into
 * source text.
 */
export interface Range {
    start: number;
    end: number;
}

/**
 * A Document represents a parsed YAML document.
 */
export interface Document {
    type: "document";

    /**
     * The range of the document in the source text.
     */
    range: Range;

    /**
     * Any tokens that precede the document's value. Typically whitespace + comments.
     */
    start?: Trivia;

    /**
     * The document's value.
     */
    value: Value;

    /**
     * Any tokens that follow the document's value.
     */
    end?: Trivia;

    /**
     * Always undefined. Here so that indent is a property of all PathItem parents.
     */
    indent?: undefined;
}

/**
 * A Sequence represents a YAML sequence.
 */
export interface Sequence {
    type: "seq";

    /**
     * The style of the sequence.
     */
    style: Style;

    /**
     * The range of the sequence in the source text.
     */
    range: Range;

    /**
     * The indentation level of the sequence.
     */
    indent: number;

    /**
     * Any trivia that precedes the sequence.
     */
    start?: Trivia;

    /**
     * The sequence's items.
     */
    items: Value[];
}

/**
 * A Map represents a YAML map.
 */
export interface Map {
    type: "map";

    /**
     * The style of the map.
     */
    style: Style;

    /**
     * The range of the map in the source text.
     */
    range: Range;

    /**
     * The indentation level of the map.
     */
    indent: number;

    /**
     * Any trivia that precedes the map.
     */
    start?: Trivia;

    /**
     * The map's entries.
     */
    entries: MapEntry[];
}

/**
 * A MapEntry represents a single entry in a YAML map.
 */
export interface MapEntry {
    /**
     * The range of the map entry in the source text.
     */
    range: Range;

    /**
     * The map entry's key.
     */
    key: Value;

    /**
     * The map entry's value.
     */
    value: Value;
}

/**
 * A Scalar represents a YAML scalar.
 */
export interface Scalar {
    type: "scalar";

    /**
     * The style of the scalar.
     */
    style: Style;

    /**
     * The range of the scalar in the source text.
     */
    range: Range;

    /**
     * The indentation level of the scalar.
     */
    indent: number;

    /**
     * Any trivia that precedes the scalar.
     */
    start?: Trivia;

    /**
     * The scalar's source text.
     */
    source: string;

    /**
     * Any trivia that follows the scalar.
     */
    end?: Trivia;
}

/**
 * A Trivia represents a sequence of YAML trivia (whitespace + comments).
 */
export interface Trivia {
    type: "trivia";

    /**
     * The range of the trivia in the source text.
     */
    range: Range;

    /**
     * The trivia items.
     */
    items: TriviaItem[];

    /**
     * Always undefined. Here so that indent is a property of all PathItem parents.
     */
    indent?: undefined;
}

/**
 * A TriviaItem represents a single YAML trivia item (whitespace + comments).
 */
export interface TriviaItem {
    type: "trivia-item";

    /**
     * The range of the trivia item in the source text.
     */
    range: Range;

    /**
     * The indentation level of the trivia item.
     */
    indent: number;

    /**
     * The trivia's source token.
     */
    token: TriviaToken;
}

/**
 * Style indicates the style of a YAML value. All YAML values are block or flow values.
 */
export type Style = "block" | "flow";

/**
 * A Value is a YAML node that may appear in a value postion.
 */
export type Value = Sequence | Map | Scalar | Trivia | undefined;

/**
 * A Node is any part of the YAML syntax tree.
 */
export type Node = Document | Value | TriviaItem;

/**
 * Returns the indentation of the given node or 0 if the node is not inherently indented.
 */
export function indent(node: Node, offset: number): number {
    switch (node?.type) {
        case "document":
        case "trivia":
            return 0;
        case "trivia-item": {
            switch (node.token.type) {
                case "space": {
                    const adjust = offset - node.range.start;
                    return node.indent + adjust;
                }
                case "newline":
                    return offset === node.token.offset ? node.indent : 0;
                default:
                    return node.indent;
            }
        }
        default:
            return node?.indent || 0;
    }
}

/**
 * A PathItem is a single element of a document path.
 *
 * The type of a PathItem indicates where in the tree its child is located:
 *
 * - "document-start" indicates that its child is located in the document's start tokens
 * - "document-value" indicates that its child is located in the document's value
 * - "document-start" indicates that its child is located in the document's end tokens
 * - "start" indicates that its child is located in the parent node's start trivia
 * - "seq-item" indicates that its child is located in the parent sequence at the given index
 * - "map-key" indicates that its child is located in the key position of the given map entry
 * - "map-value" indicates that its child is located in the value position of the given map entry
 * - "trivia-item" indicates that its child is located in the parent trivia sequence at the given index
 */
export type PathItem =
    | { type: "document-value"; parent: Document }
    | { type: "start"; parent: Document | Sequence | Map | Scalar }
    | { type: "end"; parent: Document | Scalar }
    | { type: "seq-item"; parent: Sequence; index: number }
    | { type: "map-key"; parent: Map; entry: MapEntry }
    | { type: "map-value"; parent: Map; entry: MapEntry }
    | { type: "trivia-item"; parent: Trivia; index: number };

/**
 * A Path indicates where in a Document a node is found.
 */
export type Path = PathItem[];

/**
 * An accessor represents an object key or sequence item index.
 */
export type Accessor = string | number;

/**
 * Returns the key for the given map entry as a literal string.
 */
export function entryKey(entry: MapEntry): string {
    return entry.key?.type === "scalar" ? entry.key.source : "";
}

/**
 * Converts a path to a sequence of accessors.
 */
export function pathAccessors(path: Path): Accessor[] {
    const accessors: Accessor[] = [];
    for (let i = 0; i < path.length; i++) {
        const p = path[i];
        switch (p.type) {
            case "seq-item":
                accessors.push(p.index);
                break;
            case "map-value": {
                accessors.push(entryKey(p.entry));
                break;
            }
            case "start": {
                if (i !== 0) {
                    const pred = path[i - 1];
                    if (pred.type === "map-key") {
                        accessors.push(entryKey(pred.entry));
                    }
                }
                break;
            }
        }
    }
    return accessors;
}

/**
 * A FindResult is the result of a call to findInDocument.
 */
export interface FindResult {
    /**
     * The path at which the result was found.
     */
    path: Path;

    /**
     * The found node, if any. Only undefined when path = [{ type: "document-start", .. }].
     */
    node?: Node;
}

export function inRange(offset: number, range: Range, inclusive: boolean): boolean {
    return offset >= range.start && ((inclusive && offset <= range.end) || offset < range.end);
}

function findInValue(value: Value, offset: number, inclusive: boolean, path: Path): FindResult | undefined {
    if (value === undefined || !inRange(offset, value.range, inclusive)) {
        return undefined;
    }

    switch (value.type) {
        case "seq":
            return findInSeq(value, offset, inclusive, path);
        case "map":
            return findInMap(value, offset, inclusive, path);
        case "scalar":
            return findInScalar(value, offset, inclusive, path);
        case "trivia":
            return findInTrivia(value, offset, inclusive, path);
        default:
            return { path, node: value };
    }
}

function findInStart(
    parent: Document | Sequence | Map | Scalar,
    trivia: Trivia | undefined,
    offset: number,
    inclusive: boolean,
    path: Path,
): FindResult | undefined {
    if (trivia === undefined || !inRange(offset, trivia.range, inclusive)) {
        return undefined;
    }
    path.push({ type: "start", parent });
    return findInTrivia(trivia, offset, inclusive, path);
}

function findInEnd(
    parent: Document | Scalar,
    trivia: Trivia | undefined,
    offset: number,
    inclusive: boolean,
    path: Path,
): FindResult | undefined {
    if (trivia === undefined || !inRange(offset, trivia.range, inclusive)) {
        return undefined;
    }
    path.push({ type: "end", parent });
    return findInTrivia(trivia, offset, inclusive, path);
}

function findInTriviaItem(item: TriviaItem, offset: number, inclusive: boolean, path: Path): FindResult | undefined {
    if (!inRange(offset, item.range, inclusive)) {
        return undefined;
    }
    return { path, node: item };
}

function findInTrivia(trivia: Trivia, offset: number, inclusive: boolean, path: Path): FindResult {
    for (let i = 0; i < trivia.items.length; i++) {
        path.push({ type: "trivia-item", parent: trivia, index: i });
        const isLast = i === trivia.items.length - 1;
        const item = findInTriviaItem(trivia.items[i], offset, inclusive && isLast, path);
        if (item !== undefined) {
            return item;
        }
        path.pop();
    }

    return { path, node: trivia };
}

function findInSeq(seq: Sequence, offset: number, inclusive: boolean, path: Path): FindResult {
    const start = findInStart(seq, seq.start, offset, inclusive && seq.items.length === 0, path);
    if (start !== undefined) {
        return start;
    }

    for (let i = 0; i < seq.items.length; i++) {
        path.push({ type: "seq-item", parent: seq, index: i });
        const isLast = i === seq.items.length - 1;
        const item = findInValue(seq.items[i], offset, inclusive && isLast, path);
        if (item !== undefined) {
            return item;
        }
        path.pop();
    }

    return { path, node: seq };
}

function findInMap(map: Map, offset: number, inclusive: boolean, path: Path): FindResult {
    const start = findInStart(map, map.start, offset, inclusive && map.entries.length === 0, path);
    if (start !== undefined) {
        return start;
    }

    for (let i = 0; i < map.entries.length; i++) {
        const entry = map.entries[i];
        const isLast = i === map.entries.length - 1;

        path.push({ type: "map-key", parent: map, entry });
        const key = findInValue(entry.key, offset, inclusive && isLast && entry.value === undefined, path);
        if (key !== undefined) {
            return key;
        }
        path.pop();

        path.push({ type: "map-value", parent: map, entry });
        const value = findInValue(entry.value, offset, inclusive, path);
        if (value !== undefined) {
            return value;
        }
        path.pop();
    }

    return { path, node: map };
}

function findInScalar(scalar: Scalar, offset: number, inclusive: boolean, path: Path): FindResult {
    const startInclusive = inclusive && scalar.source.length === 0 && scalar.end === undefined;
    const start = findInStart(scalar, scalar.start, offset, startInclusive, path);
    if (start !== undefined) {
        return start;
    }

    const end = findInEnd(scalar, scalar.end, offset, inclusive, path);
    if (end !== undefined) {
        return end;
    }

    return { path, node: scalar };
}

/**
 * findInDocument finds the node in doc at the given offset.
 *
 * @param doc The document to search.
 * @param offset The offset to find.
 * @return The node at the offset (if any) and the path to the node.
 */
export function findInDocument(doc: Document | undefined, offset: number): FindResult | undefined {
    if (doc === undefined || !inRange(offset, doc.range, true)) {
        return undefined;
    }

    const startInclusive = doc.value === undefined && doc.end === undefined;
    const start = findInStart(doc, doc.start, offset, startInclusive, []);
    if (start !== undefined) {
        return start;
    }

    const value = findInValue(doc.value, offset, doc.end === undefined, [{ type: "document-value", parent: doc }]);
    if (value !== undefined) {
        return value;
    }

    return findInEnd(doc, doc.end, offset, true, []);
}

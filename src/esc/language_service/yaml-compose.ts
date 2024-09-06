// Copyright 2024, Pulumi Corporation. All rights reserved.
import { CST, Parser } from "yaml";

import {
    Document,
    Map,
    MapEntry,
    Scalar,
    Sequence,
    Style,
    Trivia,
    TriviaItem,
    TriviaToken,
    Value,
} from "./yaml-document";

function isTrivia(t: CST.Token): t is TriviaToken {
    switch (t.type) {
        // Source tokens
        case "byte-order-mark":
        case "doc-mode":
        case "doc-start":
        case "space":
        case "comment":
        case "newline":
        case "directive-line":
        case "anchor":
        case "tag":
        case "seq-item-ind":
        case "explicit-key-ind":
        case "map-value-ind":
        case "flow-map-start":
        case "flow-map-end":
        case "flow-seq-start":
        case "flow-seq-end":
        case "flow-error-end":
        case "comma":
        case "block-scalar-header":
            return true;

        // Errors + directives
        case "error":
        case "directive":
            return true;

        // Everything else
        default:
            return false;
    }
}

function composeDocument(start: TriviaToken[], doc: CST.Document): Document {
    const startTrivia = composeTrivia(start);
    const value = composeValue(doc.start, doc.value);
    const endTrivia = composeTrivia(doc.end || []);
    const range = {
        start: startTrivia?.range?.start ?? doc.offset,
        end: endTrivia?.range?.end ?? value?.range?.end ?? doc.offset,
    };
    return { type: "document", range, start: startTrivia, value, end: endTrivia };
}

function composeValue(start: CST.SourceToken[], token: CST.Token | null | undefined): Value {
    if (token === undefined || token === null) {
        return composeTrivia(start);
    }

    switch (token.type) {
        case "block-seq":
            return composeSequence("block", start, token.offset, token.indent, token.items);
        case "block-map":
            return composeMap("block", start, token.offset, token.indent, token.items);
        case "flow-collection":
            return composeFlowCollection(start, token);
        default:
            return composeScalar(start, token);
    }
}

function composeFlowCollection(start: CST.SourceToken[], collection: CST.FlowCollection): Value {
    switch (collection.start.type) {
        case "flow-seq-start":
            return composeSequence("flow", start, collection.offset, collection.indent, collection.items);
        case "flow-map-start":
            return composeMap("flow", start, collection.offset, collection.indent, collection.items);
        default:
            return undefined;
    }
}

function composeSequence(
    style: Style,
    start: CST.SourceToken[],
    offset: number,
    indent: number,
    collectionItems: CST.CollectionItem[],
): Sequence {
    let end = offset;
    let items: Value[] = [];
    for (const i of collectionItems) {
        const item = composeValue(i.start, i.value);
        end = item?.range?.end ?? end;
        items.push(item!);
    }

    const trivia = composeTrivia(start);
    const range = { start: trivia?.range?.start ?? offset, end };
    return { type: "seq", style, range, indent, start: trivia, items };
}

function composeMapEntry(start: number, end: number, item: CST.CollectionItem): MapEntry {
    const key = composeValue(item.start, item.key);
    end = key?.range?.end ?? end;

    end = triviaEnd(end, item.sep);

    // For map entries we charge all but the first separator to the value.
    //
    // TODO: explain the reasoning here
    const sep = item.sep === undefined || item.sep.length === 0 ? [] : item.sep.slice(1);
    const value = composeValue(sep, item.value);
    end = value?.range?.end ?? end;

    start = key?.range?.start ?? value?.range?.start ?? start;
    const range = { start, end };
    return { range, key, value };
}

function composeMap(
    style: Style,
    start: CST.SourceToken[],
    offset: number,
    indent: number,
    collectionItems: CST.CollectionItem[],
): Map {
    let end = offset;
    let entries: MapEntry[] = [];

    // TODO: special cases for block maps that begin with trivia or end with trivia
    //
    // In the former case, we want to form this text into a map with two entries:
    //
    // ```
    // foo:
    //
    //   bar: baz
    // ```
    //
    // In the latter case, we want to form this text into a map with two entries:
    //
    // ```
    // foo:
    //   bar: baz
    //
    // ```
    //
    // The alternative is a fair bit of special-casing in the completion provider to determine
    // whether or not a cursor in a piece of trivia is in a single-key object.

    for (const i of collectionItems) {
        let entry = composeMapEntry(end, end, i);
        end = entry.range.end;
        entries.push(entry);
    }

    const trivia = composeTrivia(start);
    const range = { start: trivia?.range?.start ?? offset, end };
    return { type: "map", style, range, indent, start: trivia, entries };
}

function composeScalar(start: CST.SourceToken[], token: CST.Token): Scalar {
    if (!CST.isScalar(token)) {
        const trivia = composeTrivia(start);
        const range = { start: trivia?.range?.start ?? token.offset, end: token.offset };
        return { type: "scalar", style: "block", range, indent: 0, start: trivia, source: "" };
    }

    const style = token.type === "block-scalar" ? "block" : "flow";

    const startTrivia = composeTrivia(start);
    const endTrivia = token.type === "block-scalar" ? undefined : composeTrivia(token.end);

    const range = {
        start: startTrivia?.range?.start ?? token.offset,
        end: endTrivia?.range?.end ?? token.offset + token.source.length,
    };
    return {
        type: "scalar",
        style,
        range,
        indent: token.indent,
        start: startTrivia,
        source: token.source,
        end: endTrivia,
    };
}

function composeTrivia(tokens: TriviaToken[] | undefined): Trivia | undefined {
    if (tokens === undefined || tokens.length === 0) {
        return undefined;
    }
    const items = tokens.map((item) => composeTriviaItem(item as CST.SourceToken));
    const start = items[0].range.start;
    const end = items[items.length - 1].range.end;
    return { type: "trivia", range: { start, end }, items };
}

function composeTriviaItem(token: CST.SourceToken): TriviaItem {
    const range = { start: token.offset, end: token.offset + token.source.length };
    return { type: "trivia-item", range, indent: token.indent, token };
}

function triviaEnd(start: number, tokens: TriviaToken[] | undefined): number {
    if (tokens === undefined || tokens.length === 0) {
        return start;
    }
    const last = tokens[tokens.length - 1];
    return last.offset + last.source.length;
}

/**
 * Parses YAML source text and composes a Document.
 *
 * @param source The YAML source text.
 * @return The parsed + composed Document.
 */
export function yaml(source: string): Document {
    let start: TriviaToken[] = [];
    for (const t of new Parser().parse(source)) {
        if (t.type === "document") {
            return composeDocument(start, t);
        } else if (isTrivia(t)) {
            start.push(t);
        }
    }
    return { type: "document", range: { start: 0, end: source.length }, start: composeTrivia(start), value: undefined };
}

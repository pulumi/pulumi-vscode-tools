// Copyright 2024, Pulumi Corporation. All rights reserved.

// Parses text with a cursor annotation into source text and a cursor offset.
//
// Text should be of the form "blank line, source text w/ cursor line, blank line". For example:
//
// ```
//
// foo:
//   bar:
//        ^
//   baz
//
// ```
//
// Where `^` indicates the position of the cursor. The cursor must be on its own line. The cursor's
// line will be removed from the result. The first and last lines of the text will be trimmed and
// must be empty.
export function parseTextWithCursor(text: string): { source: string; offset: number } {
    const re = /^\s*(\^)\s*$/;

    const allLines = text.split("\n");
    if (allLines.length < 4) {
        throw new Error(
            "testcase must be at least four lines: a leading blank line, a line of text, a cursor line, and a trailing blank line",
        );
    }
    // TODO: Please replace this equality operator w/ a type safe one (===) if touching this code
    // eslint-disable-next-line eqeqeq
    if (allLines[0] != "") {
        throw new Error("first line must be empty");
    }
    // TODO: Please replace this equality operator w/ a type safe one (===) if touching this code
    // eslint-disable-next-line eqeqeq
    if (allLines[allLines.length - 1] != "") {
        throw new Error("last line must be empty");
    }
    const lines = allLines.slice(1, allLines.length - 1);

    const cursorLineIndex = lines.findIndex((l) => l.match(re));
    switch (cursorLineIndex) {
        case -1:
            throw new Error("text is missing a cursor line");
        case 0:
            throw new Error("cursor must not be on the first line");
    }

    const cursorIndex = lines[cursorLineIndex].indexOf("^");
    if (cursorIndex > lines[cursorLineIndex - 1].length + 1) {
        throw new Error("cursor's preceding line is not long enough (check the trailing whitespace!)");
    }

    const lineOffset = lines.slice(0, cursorLineIndex - 1).reduce((offset, l) => (offset += l.length + 1), 0);
    const offset = lineOffset + cursorIndex;

    // Remove the cursor from the source and ensure we have a trailing newline.
    lines.splice(cursorLineIndex, 1);
    let source = lines.join("\n");
    if (!source.endsWith("\n")) {
        source += "\n";
    }

    return { source, offset };
}

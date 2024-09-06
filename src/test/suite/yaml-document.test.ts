// Copyright 2024, Pulumi Corporation. All rights reserved.

import * as compose from "../../esc/language_service/yaml-compose";
import * as yaml from "../../esc/language_service/yaml-document";
import * as assert from 'assert';
import * as util from "./util.test";

interface FindInDocumentCase {
    source: string;
    offset: number;
    pathTypes: string[];
    nodeType?: string;
    indent?: number;
}

function newCase(text: string, pathTypes: string[], nodeType?: string, indent?: number): FindInDocumentCase {
    return { pathTypes, nodeType, indent, ...util.parseTextWithCursor(text) };
}

suite("findInDocument", () => {
    let cases = [
        newCase(
            `

^
`,
            ["start", "trivia-item"],
            "trivia-item",
        ),

        newCase(
            `
# here's a comment
^
`,
            ["start", "trivia-item"],
            "trivia-item",
            0,
        ),

        newCase(
            `
values:
       ^
`,
            ["document-value", "map-value", "trivia-item"],
            "trivia-item",
            0,
        ),

        newCase(
            `
values:
  
  ^
`,
            ["document-value", "map-value", "trivia-item"],
            "trivia-item",
            2,
        ),

        newCase(
            `
values:
  aws:
    
    ^
`,
            ["document-value", "map-value", "map-value", "trivia-item"],
            "trivia-item",
            4,
        ),

        newCase(
            `
values:
  
  ^
  aws: foo
`,
            ["document-value", "map-value", "start", "trivia-item"],
            "trivia-item",
            2,
        ),

        newCase(
            `
values:
  aws: foo
  
  ^
`,
            ["end", "trivia-item"],
            "trivia-item",
            2,
        ),

        newCase(
            `
values:
  
  ^
  environmentVariables:
    FOO: bar
`,
            ["document-value", "map-value", "start", "trivia-item"],
            "trivia-item",
            2,
        ),

        newCase(
            `
values:
  aws:
    
    ^
  environmentVariables:
    FOO: bar
`,
            ["document-value", "map-value", "map-value", "trivia-item"],
            "trivia-item",
            4,
        ),

        newCase(
            `
values:
  aws:
    fn::open::aws-login:
      oidc:
        policyArns: arn:aws:iam::aws:policy/AdministratorAccess
        
        ^
  bar: baz
`,
            ["document-value", "map-value", "map-key", "start", "trivia-item"],
            "trivia-item",
            8,
        ),

        newCase(
            `
imports:
  - 
    ^
values:
  foo: bar
`,
            ["document-value", "map-value", "seq-item", "trivia-item"],
            "trivia-item",
        ),

        newCase(
            `
imports:
  - foo
values:
  aws:
    f
     ^
`,
            ["document-value", "map-value", "map-value", "end", "trivia-item"],
            "trivia-item",
        ),

        newCase(
            `
# leading trivia
values:
  aws: foo
# trailing trivia
^
`,
            ["end", "trivia-item"],
            "trivia-item",
        ),
    ];

    function pathTypes(path: yaml.Path): string[] {
        return path.map((p) => p.type);
    }

    for (let i = 0; i < cases.length; i++) {
        const c = cases[i];
        test(`case ${i}`, () => {
            const doc = compose.yaml(c.source);
            const { path, node } = yaml.findInDocument(doc, c.offset) || { path: [], node: undefined };

            const actualPathTypes = pathTypes(path);
            assert.deepEqual(actualPathTypes, c.pathTypes);
            assert.deepEqual(node?.type.toString(), c.nodeType);
            if (c.indent !== undefined) {
              const actualIndent = yaml.indent(node, c.offset);
              assert.deepEqual(actualIndent, c.indent);
            }
        });
    }
});

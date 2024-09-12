// Copyright 2024, Pulumi Corporation. All rights reserved.

import * as completion from "../../esc/language_service/completion-items";
import { FunctionSchemaRepr, FunctionSchemas } from "../../esc/language_service/functions";
import { Schema } from "../../esc/language_service/schema";
import testdata from "../../esc/language_service/test-data.json";
import * as util from "./util.test";
import * as compose from "../../esc/language_service/yaml-compose";
import * as yaml from "../../esc/language_service/yaml-document";
import * as assert from "assert";

interface ObjectKeyCase {
    source: string;
    offset: number;
    accessors: yaml.Accessor[];
}

suite("isPossibleObjectKey", () => {
    function newCase(text: string, accessors: yaml.Accessor[]): ObjectKeyCase {
        return { accessors, ...util.parseTextWithCursor(text) };
    }

    const cases = [
        newCase(
            `

^
`,
            [],
        ),
        newCase(
            `
values:
^
`,
            [],
        ),
        newCase(
            `
values:

^
`,
            [],
        ),
        newCase(
            `

^
values:
`,
            [],
        ),
        newCase(
            `
values:
  
  ^
`,
            ["values"],
        ),
        newCase(
            `
values:
  aws:
    
    ^
`,
            ["values", "aws"],
        ),

        newCase(
            `
values:
  f
  ^
  aws: foo
`,
            ["values"],
        ),

        newCase(
            `
values:
  f
   ^
  aws: foo
`,
            ["values"],
        ),

        newCase(
            `
values:
  aws: foo
  f
  ^
`,
            ["values"],
        ),
        newCase(
            `
values:
  aws: foo
  f
   ^
`,
            ["values"],
        ),

        newCase(
            `
values:
  aws:
    foo:
      bar: baz
  f
  ^
`,
            ["values"],
        ),

        newCase(
            `
values:
  aws:
    foo:
      bar: baz
  f
   ^
`,
            ["values"],
        ),

        newCase(
            `
values:
  aws:
    foo:
      bar: baz
    f
    ^
`,
            ["values", "aws"],
        ),

        newCase(
            `
values:
  aws:
    foo:
      bar: baz
    f
     ^
`,
            ["values", "aws"],
        ),

        newCase(
            `
values:
  
  ^
  aws: foo
`,
            ["values"],
        ),

        newCase(
          `
values:
  aws:
    
    ^
  bar: baz
`,
          ["values", "aws"],
      ),
      newCase(
        `
values:
  aws:
    
    ^
    bar: baz
  
  baz: qux
`,
        ["values", "aws"],
    ),
    newCase(
      `
values:
  aws:
    
    ^
baz: qux
`,
      ["values", "aws"],
  ),
  newCase(
    `
values:
  aws:
    login:
      
      ^
  environmentVariables:
    FOO: bar
`,
    ["values", "aws", "login"],
),

        newCase(
            `
values:
  aws: foo
  
  ^
`,
            ["values"],
        ),

        newCase(
            `
values:
  aws:
    foo:
      bar: baz
  
  ^
`,
            ["values"],
        ),

        newCase(
            `
values:
  aws:
    foo:
      bar: baz
    
    ^
`,
            ["values", "aws"],
        ),

        newCase(
            `
values:
  aws: { 
         ^
`,
            ["values", "aws"],
        ),

        newCase(
            `
values:
  aws: foo

^
`,
            [],
        ),
    ];

    //cases = [cases[14], cases[15], cases[16]];

    for (let i = 0; i < cases.length; i++) {
        const c = cases[i];
        test(`case ${i}`, () => {
            const doc = compose.yaml(c.source);
            const yamlNode = yaml.findInDocument(doc, c.offset);
            assert.ok(yamlNode);
            const { path, node } = yamlNode!;

            const { accessors, isKey } = completion.isPossibleObjectKey(path, node, c.offset);
            assert.deepEqual(isKey,true);
            assert.deepEqual(accessors ?? yaml.pathAccessors(path), c.accessors);
        });
    }
});

interface FindInDocumentCase {
    source: string;
    offset: number;
    labels: string[];
}

suite("provideSuggestions", () => {
    const topLevelLabels = ["imports:", "values:"];
    const wellKnownLabels = ["environmentVariables:", "files:", "pulumiConfig:"];
    const builtinLabels = [
        "fn::fromJSON:",
        "fn::fromBase64:",
        "fn::join:",
        "fn::open:",
        "fn::open::test:",
        "fn::secret:",
        "fn::toBase64:",
        "fn::toJSON:",
        "fn::toString:",
    ];
    const openLabels = ["provider:", "inputs:"];

    function newCase(text: string, labels: string[]): FindInDocumentCase {
        return { labels, ...util.parseTextWithCursor(text) };
    }

    let cases = [
        newCase(
            `

^
`,
            topLevelLabels,
        ),

        newCase(
            `
# here's a comment
^
`,
            [],
        ),

        newCase(
            `
values:
       ^
`,
            ["imports:"],
        ),

        newCase(
            `
values:
  
  ^
`,
            wellKnownLabels,
        ),

        newCase(
            `
values:
  
  ^
  environmentVariables:
    FOO: bar
`,
            ["files:", "pulumiConfig:"],
        ),

        newCase(
            `
values:
  aws:
    login:
      
      ^
  environmentVariables:
    FOO: bar
`,
            builtinLabels,
        ),

        newCase(
            `
imports:
  - 
    ^
values:
  foo: bar
`,
            [],
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
            builtinLabels,
        ),

        newCase(
            `
imports:
  - foo
values:
  aws:
    fn:
       ^
`,
            builtinLabels,
        ),

        newCase(
            `
imports:
  - foo
values:
  aws:
    fn::
        ^
  
  bar: baz
`,
            builtinLabels,
        ),

        newCase(
            `
# leading trivia
values:
  aws: foo
# trailing trivia
^
`,
            [],
        ),

        newCase(
            `
values:
  aws: foo

^
`,
            ["imports:"],
        ),

        newCase(
            `
values:
  aws: f
        ^
`,
            [],
        ),

        newCase(
            `
imports:
  - test
values:
  secrets:
    password:
      fn::secret: hunter2
  
  ^
`,
            wellKnownLabels,
        ),

        newCase(
            `
values:
  aws: { 
         ^
`,
            builtinLabels,
        ),

        newCase(
            `
values:
  aws:
    login:
      fn::open:
        
        ^
`,
            openLabels,
        ),

        newCase(
            `
values:
  test:
    fn::open::test:
      
      ^
`,
            ["string:", "num:", "array:"],
        ),
        newCase(
          `
values:
  test:
    fn::open::test:
      
      ^
  bar: baz
`,
          ["string:", "num:", "array:"],
      ),
      newCase(
          `
values:
  test:
    fn::open::test:
      num: 5
      
      ^
  bar: baz
`,
        ["string:", "array:"],
    ),

        newCase(
            `
values:
  test:
    fn::open::test:
      string: 
              ^
`,
            [],
        ),

        newCase(
            `
values:
  test:
    fn::open::test:
      array:
        - 
          ^
`,
            ["foo:", "bar:"],
        ),

        newCase(
            `
values:
  test:
    fn::open::test:
      array:
        - foo: { 
                 ^
`,
            builtinLabels,
        ),

        newCase(
            `
values:
  test:
    fn::open::test:
      array:
        - foo:
            
            ^
      
      bar: baz
`,
            builtinLabels,
        ),
    ];

    //cases = [cases[18]];

    const functions = new FunctionSchemas({
        listProviders(): Promise<string[]> {
            return Promise.resolve(["test"]);
        },
        getProviderSchema(name: string): Promise<FunctionSchemaRepr | undefined> {
            if (name === "test") {
                return Promise.resolve({
                    name: "test",
                    description: "a test provider",
                    inputs: {
                        type: "object",
                        properties: {
                            string: { type: "string" },
                            num: { type: "number" },
                            array: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        foo: { type: "number" },
                                        bar: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                });
            }
            return Promise.resolve(undefined);
        },
    });

    for (let i = 0; i < cases.length; i++) {
        const c = cases[i];
        test(`case ${i}`, async () => {
            const doc = compose.yaml(c.source);
            const suggestions = await completion.provideSuggestions(
                doc,
                undefined,
                undefined,
                undefined,
                c.offset,
                functions,
            );
            const labels = suggestions.map((item) => item.label).sort();
            assert.deepEqual(labels, (c.labels || []).sort());
        });
    }
});

suite("provideSymbolSuggestions", () => {
    const functions = new FunctionSchemas({
        listProviders(): Promise<string[]> {
            return Promise.resolve(["test-provider"]);
        },
        getProviderSchema(name: string): Promise<FunctionSchemaRepr | undefined> {
            // TODO: Please replace this equality operator w/ a type safe one (===) if touching this code
            // eslint-disable-next-line eqeqeq
            if (name == "test") {
                return Promise.resolve({
                    description: "test provider",
                    name: "test",
                    inputs: {
                        type: "object",
                        properties: {
                            foo: {
                                description: "input property foo",
                                type: "string",
                            },
                            key: {
                                items: {
                                    type: "string",
                                    enum: ["value_1", "value_2", "value_3", "value_4"],
                                },
                                type: "array",
                                description: "input array property key",
                            },
                            key_const: {
                                items: {
                                    type: "string",
                                    const: "const_value",
                                },
                                type: "array",
                                description: "input array property key",
                            },
                        },
                    },
                    outputs: {
                        type: "object",
                        properties: {
                            bar: {
                                type: "string",
                                description: "output property bar",
                            },
                        },
                    },
                });
            }
            return Promise.resolve(undefined);
        },
    });

    for (let i = 0; i < testdata.symbolCompletion.length; i++) {
        const c = testdata.symbolCompletion[i];
        test(`case ${i}`, async () => {
            const doc = compose.yaml(c.text);
            const exprs = c.env.exprs;
            const schema = Schema.new(c.env.schema);
            const contextSchema = Schema.new({
                type: "object",
                additionalProperties: false,
                properties: {
                    context: c.env.executionContext.schema,
                },
            });
            const suggestions = await completion.provideSuggestions(
                doc,
                <any>exprs, // eslint-disable-line @typescript-eslint/consistent-type-assertions
                schema,
                contextSchema,
                c.cursor,
                functions,
            );
            const labels = suggestions.map((item) => item.label).sort();
            assert.deepEqual(labels, (c.labels || []).sort());
        });
    }
});

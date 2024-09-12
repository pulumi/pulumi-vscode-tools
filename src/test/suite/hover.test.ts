// Copyright 2024, Pulumi Corporation. All rights reserved.

import { FunctionSchemaRepr, FunctionSchemas } from "../../esc/language_service/functions";
import * as hover from "../../esc/language_service/hover";
import { Schema } from "../../esc/language_service/schema";
import testdata from "../../esc/language_service/test-data.json";
import * as compose from "../../esc/language_service/yaml-compose";
import { MarkdownString } from "vscode";
import * as assert from "assert";

suite("provideHover", () => {
    const functions = new FunctionSchemas({
        listProviders(): Promise<string[]> {
            return Promise.resolve(["test"]);
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
                        },
                    },
                    outputs: {
                        type: "object",
                        properties: {
                            bar: {
                                description: "output property bar",
                                type: "string",
                            },
                        },
                    },
                });
            }
            return Promise.resolve(undefined);
        },
    });

    for (let i = 0; i < testdata.hover.length; i++) {
        const c = testdata.hover[i];
        test(`case ${i}`, async () => {
            const doc = compose.yaml(c.text);
            const exprs = c.env?.exprs;
            const schema = Schema.new(c.env?.schema || false);
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const result = await hover.provideHover(doc, <any>exprs, schema, c.cursor, functions);
            const text = result?.contents?.map((v) => (v as MarkdownString)?.value)?.join("\n");
            assert.deepEqual(text || "", c.hover);
        });
    }
});

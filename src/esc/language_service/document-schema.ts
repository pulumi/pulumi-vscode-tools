// Copyright 2024, Pulumi Corporation. All rights reserved.

import { Schema } from "./schema";

/**
 * The document schema for ESC environments. Defines top-level keys and well-known properties.
 */
export const schema = Schema.new({
    type: "object",
    properties: {
        imports: {
            description: "Other environments to import into this environment.",
            type: "array",
            items: {
                oneOf: [
                    {
                        description: "The name of an environment to import.",
                        type: "string",
                    },
                    {
                        description: "The name of an environment to import and import-specific options.",
                        type: "object",
                        minProperties: 1,
                        maxProperties: 1,
                        additionalProperties: {
                            type: "object",
                            properties: {
                                merge: {
                                    description: "False to exclude this import from the merged outputs.",
                                    type: "boolean",
                                },
                            },
                            additionalProperties: false,
                        },
                    },
                ],
            },
        },
        values: {
            type: "object",
            description: "The values contained in this environment.",
            properties: {
                environmentVariables: {
                    description:
                        "Environment variables to set when using `esc open --shell`, `esc run`, or `pulumi up/preview/refresh/destroy`.",
                    type: "object",
                    additionalProperties: {
                        type: "string",
                    },
                },
                files: {
                    description:
                        "Values to write to temporary files when using `esc open --shell`, `esc run`, or `pulumi up/preview/refresh/destroy`.",
                    type: "object",
                    additionalProperties: {
                        type: "string",
                    },
                },
                pulumiConfig: {
                    description: "Pulumi stack configuration to set when using `pulumi up/preview/refresh/destroy`.",
                    type: "object",
                    additionalProperties: true,
                },
            },
            additionalProperties: true,
        },
    },
    additionalProperties: false,
});

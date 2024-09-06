// Copyright 2024, Pulumi Corporation. All rights reserved.

import { Schema } from "./schema";

/**
 * A FunctionSchemaRepr is a JSON-compatible representation of a function schema.
 */
export interface FunctionSchemaRepr {
    name: string;
    description: string;
    inputs?: any;
    outputs?: any;
}


/**
 * A FunctionSchema represents a compiled function schema.
 */
export class FunctionSchema {
    readonly name: string;
    readonly description: string;
    readonly inputs: Schema;
    readonly outputs: Schema;

    /**
     * Create a new function schema from its JSON-compatible representation.
     */
    constructor(repr: FunctionSchemaRepr) {
        this.name = repr.name;
        this.description = repr.description;
        this.inputs = Schema.new(repr.inputs ?? true);
        this.outputs = Schema.new(repr.outputs ?? true);
    }
}

/**
 * ProviderSchemas defines methods for fetching provider schemas.
 */
export interface ProviderSchemas {
    /**
     * Lists the available providers.
     */
    listProviders(): Promise<string[]>;

    /**
     * Returns the schema for the given provider or undefined if no such provider exists.
     */
    getProviderSchema(name: string): Promise<FunctionSchemaRepr | undefined>;
}

/**
 * FunctionSchemas provides access to and caching of function schemas.
 */
export class FunctionSchemas {
    // The provider schema fetcher.
    private readonly providers: ProviderSchemas;

    // The available providers.
    private availableProviders?: string[];

    // The function schema cache itself. Includes entries for unknown providers.
    private readonly cache: Map<string, FunctionSchema | undefined>;

    /**
     * Creates a new function schema cache.
     *
     * @param providers The provider schema fetcher to use.
     */
    constructor(providers: ProviderSchemas) {
        this.providers = providers;
        this.cache = new Map();

        for (const [name, schema] of Object.entries(builtins)) {
            this.cache.set(name, schema);
        }
    }

    private async getProviders(): Promise<string[]> {
        if (this.availableProviders === undefined) {
            this.availableProviders = await this.providers.listProviders();
        }

        for (const name of this.availableProviders) {
            await this.get(`fn::open::${name}`);
        }

        return this.availableProviders;
    }

    private async getOpen(): Promise<FunctionSchema> {
        const list = await this.getProviders();

        const inputs: any[] = [];
        const outputs: any[] = [];
        for (const name of list) {
            const schema = await this.get(`fn::open::${name}`);
            if (schema === undefined) {
                continue;
            }
            inputs.push({
                type: "object",
                properties: {
                    provider: { const: name },
                    inputs: schema.inputs,
                },
            });
            outputs.push(schema.outputs);
        }

        return new FunctionSchema({
            name: "fn::open",
            description: "Imports secrets and configuration from an external provider.",
            inputs: { oneOf: inputs },
            outputs: { oneOf: outputs },
        });
    }

    /**
     * Returns the set of available functions.
     */
    async list(): Promise<Record<string, FunctionSchema | undefined>> {
        await this.getProviders();
        await this.get("fn::open");
        return Object.fromEntries(this.cache.entries());
    }

    /**
     * Returns the schema for the given function. Fetches provider schemas on demand if they are not in the
     * cache.
     */
    async get(functionName: string): Promise<FunctionSchema | undefined> {
        if (this.cache.has(functionName)) {
            return this.cache.get(functionName);
        }

        // Is this a call to fn::open?
        if (functionName === "fn::open") {
            const schema = await this.getOpen();
            this.cache.set(functionName, schema);
            return schema;
        }

        // Is this a call to a provider-specific fn::open?
        if (!functionName.startsWith("fn::open::")) {
            return undefined;
        }
        const providerName = functionName.slice("fn::open::".length);

        const repr = await this.providers.getProviderSchema(providerName);
        const schema =
            repr === undefined
                ? undefined
                : new FunctionSchema({
                      ...repr,
                      name: functionName,
                  });
        this.cache.set(functionName, schema);
        return schema;
    }
}

/**
 * The set of statically-known builtin functions.
 */
export const builtins: Record<string, FunctionSchema> = {
    "fn::fromJSON": new FunctionSchema({
        name: "fn::fromJSON",
        description: "Decodes a JSON value from a string.",
        inputs: { type: "string" },
        outputs: true,
    }),
    "fn::fromBase64": new FunctionSchema({
        name: "fn::fromBase64",
        description: "Decodes a base64-encoded string.",
        inputs: { type: "string" },
        outputs: { type: "string" },
    }),
    "fn::join": new FunctionSchema({
        name: "fn::join",
        description: "Joins array elements with the given delimiter.",
        inputs: {
            type: "array",
            prefixItems: [
                { type: "string" },
                {
                    type: "array",
                    items: { type: "string" },
                },
            ],
            items: false,
        },
        outputs: { type: "string" },
    }),
    "fn::secret": new FunctionSchema({
        name: "fn::secret",
        description: "Marks a value as secret.",
        inputs: { type: "string" },
        outputs: { type: "string" },
    }),
    "fn::toBase64": new FunctionSchema({
        name: "fn::toBase64",
        description: "Encodes a string as base64.",
        inputs: { type: "string" },
        outputs: { type: "string" },
    }),
    "fn::toJSON": new FunctionSchema({
        name: "fn::toJSON",
        description: "Encodes a value into a JSON string.",
        inputs: true,
        outputs: { type: "string" },
    }),
    "fn::toString": new FunctionSchema({
        name: "fn::toString",
        description: "Formats a value as a string.",
        inputs: true,
        outputs: { type: "string" },
    }),
};

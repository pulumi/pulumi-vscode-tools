// Copyright 2024, Pulumi Corporation. All rights reserved.

/**
 * parseRef parses and links a $ref to a definition in root.
 */
function parseRef(root: Schema, ref: string | undefined): Schema | undefined {
    if (ref === undefined) {
        return undefined;
    }

    if (!ref.startsWith("#/$defs/")) {
        return undefined;
    }

    const refName = decodeURIComponent(ref.slice("#/$defs/".length));
    return root.defs?.[refName];
}

/**
 * A Schema represents an ESC value schema.
 */
export class Schema {
    // Core vocabulary

    readonly never?: boolean;
    readonly always?: boolean;

    readonly defs?: Record<string, Schema>;

    // Applicator vocabulary

    readonly ref?: string;
    readonly anyOf?: Schema[];
    readonly oneOf?: Schema[];
    readonly prefixItems?: Schema[];
    readonly items?: Schema;
    readonly additionalProperties?: Schema;
    readonly properties?: Record<string, Schema>;

    // Validation vocabulary

    readonly type?: string;
    readonly const?: any;
    readonly enum?: any[];
    readonly multipleOf?: number;
    readonly maximum?: number;
    readonly exclusiveMaximum?: number;
    readonly minimum?: number;
    readonly exclusiveMinimum?: number;
    readonly maxLength?: number;
    readonly minLength?: number;
    readonly pattern?: string;
    readonly maxItems?: number;
    readonly minItems?: number;
    readonly uniqueItems?: boolean;
    readonly maxProperties?: number;
    readonly minProperties?: number;
    readonly required?: string[];
    readonly dependentRequired?: Record<string, string[]>;

    // Metadata vocabulary

    readonly title?: string;
    readonly description?: string;
    readonly default?: any;
    readonly deprecated?: boolean;
    readonly examples?: any[];

    // Environments extensions
    readonly secret?: boolean;

    private linkedRef?: Schema;
    private compiled: boolean = false;

    get resolved(): Schema | undefined {
        return this.linkedRef;
    }

    private constructor(v: any) {
        if (v === true) {
            this.always = true;
            return;
        }
        if (v === false) {
            this.never = true;
            return;
        }

        this.defs = v["$defs"];
        this.ref = v["$ref"];

        this.anyOf = v.anyOf?.map((s) => Schema.create(s));
        this.oneOf = v.oneOf?.map((s) => Schema.create(s));
        this.prefixItems = v.prefixItems?.map((s) => Schema.create(s));
        this.items = v.items === undefined ? undefined : Schema.create(v.items);
        this.additionalProperties =
            v.additionalProperties === undefined ? undefined : Schema.create(v.additionalProperties);
        this.properties =
            v.properties === undefined
                ? undefined
                : Object.fromEntries(Object.entries(v.properties).map(([k, p]) => [k, Schema.create(p)]));

        this.type = v.type;
        this.const = v.const;
        this.enum = v.enum;
        this.multipleOf = v.multipleOf;
        this.maximum = v.maximum;
        this.exclusiveMaximum = v.exclusiveMaximum;
        this.minimum = v.minimum;
        this.exclusiveMinimum = v.exclusiveMinimum;
        this.maxLength = v.maxLength;
        this.minLength = v.minLength;
        this.pattern = v.pattern;
        this.maxItems = v.maxItems;
        this.minItems = v.minItems;
        this.uniqueItems = v.uniqueItems;
        this.maxProperties = v.maxProperties;
        this.minProperties = v.minProperties;
        this.required = v.required;
        this.dependentRequired = v.dependentRequired;

        this.title = v.title;
        this.description = v.description;
        this.default = v.default;
        this.deprecated = v.deprecated;
        this.examples = v.examples;

        this.secret = v.secret;

        this.compiled = false;
    }

    private static create(v: any): Schema {
        return v instanceof Schema ? v : new Schema(v);
    }

    /**
     * Creates a new
     */
    static new(v: any): Schema {
        const s = Schema.create(v);
        s.compile(s);
        return s;
    }

    private compile(root: Schema) {
        if (this.compiled) {
            return;
        }
        this.compiled = true;

        this.linkedRef = parseRef(root, this.ref);
        this.linkedRef?.compile(root);

        for (const s of this.anyOf || []) {
            s.compile(root);
        }
        for (const s of this.oneOf || []) {
            s.compile(root);
        }

        for (const s of this.prefixItems || []) {
            s.compile(root);
        }
        this.items?.compile(root);
        this.additionalProperties?.compile(root);
        for (const s of Object.values(this.properties || {})) {
            s.compile(root);
        }
    }

    private arrayItem(index: number): Schema {
        if (this.type !== "array") {
            return never;
        }
		const length = this.prefixItems?.length ?? 0;
        if (index < length) {
            return this.prefixItems?.[index] || never;
        }
        return this.items ?? always;
    }

    item(index: number): Schema {
        const oneOf: Schema[] = [];
        for (const s of this.anyOf || []) {
            oneOf.push(s.item(index));
        }
        for (const s of this.oneOf || []) {
            oneOf.push(s.item(index));
        }
        oneOf.push(this.arrayItem(index));
        return this.union(oneOf);
    }

    private objectProperty(name: string): Schema {
        if (this.type !== "object") {
            return never;
        }
        const p = this.properties?.[name];
        if (p !== undefined) {
            return p;
        }
        return this.additionalProperties ?? always;
    }

    property(name: string): Schema {
        // TODO: Please replace this equality operator w/ a type safe one (===) if touching this code
        // eslint-disable-next-line eqeqeq
        if (name == "") {
            return this;
        }

        const oneOf: Schema[] = [];
        for (const s of this.anyOf || []) {
            oneOf.push(s.property(name));
        }
        for (const s of this.oneOf || []) {
            oneOf.push(s.property(name));
        }
        oneOf.push(this.objectProperty(name));
        return this.union(oneOf);
    }

    private union(oneOf: Schema[]): Schema {
        // Filter out never schemas.
        oneOf = oneOf.filter((s) => !s.never);

        switch (oneOf.length) {
            case 0:
                // If there are no schemas left, return Never.
                return never;
            case 1:
                // If there is one schema left, return it.
                return oneOf[0];
            default: {
                // Otherwise, return a OneOf.
                const s = Schema.create({ oneOf });
                return s;
            }
        }
    }

    allProperties(): Record<string, Schema> {
        const properties: Record<string, Schema[]> = {};

        function addProperties(props: Record<string, Schema>) {
            for (const [k, v] of Object.entries(props)) {
                const p = properties[k];
                if (p === undefined) {
                    properties[k] = [v];
                } else {
                    p.push(v);
                }
            }
        }

        for (const s of this.oneOf || []) {
            addProperties(s.allProperties());
        }
        for (const s of this.anyOf || []) {
            addProperties(s.allProperties());
        }
        addProperties(this.properties || {});

        return Object.fromEntries(Object.entries(properties).map(([k, v]) => [k, this.union(v)]));
    }
}

export const never = Schema.new(false);
export const always = Schema.new(true);


export interface OrganizationSummary {
    githubLogin: string;
    name: string;
    avatarUrl: string;
}

export interface User {
    id: string;
    name: string;
    email: string;
    githubLogin: string;
    avatarUrl: string;
    hasMFA: boolean;
    organizations: OrganizationSummary[];
}

export interface EnvironmentRevision {
    number: number;
    tags?: Array<string>;
}

export interface Tag {
    name: string;
    revision: number;
}

/**
 * 
 * @export
 * @interface CheckEnvironment
 */
export interface CheckEnvironment {
    /**
     * 
     * @type {{ [key: string]: Expr; }}
     * @memberof CheckEnvironment
     */
    'exprs'?: { [key: string]: Expr; };
    /**
     * 
     * @type {{ [key: string]: Value; }}
     * @memberof CheckEnvironment
     */
    'properties'?: { [key: string]: Value; };
    /**
     * 
     * @type {object}
     * @memberof CheckEnvironment
     */
    'schema'?: object;
    /**
     * 
     * @type {EvaluatedExecutionContext}
     * @memberof CheckEnvironment
     */
    'executionContext'?: EvaluatedExecutionContext;
    /**
     * 
     * @type {Array<EnvironmentDiagnostic>}
     * @memberof CheckEnvironment
     */
    'diagnostics'?: Array<EnvironmentDiagnostic>;
}
/**
 * 
 * @export
 * @interface Environment
 */
export interface Environment {
    /**
     * 
     * @type {{ [key: string]: Expr; }}
     * @memberof Environment
     */
    'exprs'?: { [key: string]: Expr; };
    /**
     * 
     * @type {{ [key: string]: Value; }}
     * @memberof Environment
     */
    'properties'?: { [key: string]: Value; };
    /**
     * 
     * @type {any}
     * @memberof Environment
     */
    'schema'?: any;
    /**
     * 
     * @type {EvaluatedExecutionContext}
     * @memberof Environment
     */
    'executionContext'?: EvaluatedExecutionContext;
}
/**
 * 
 * @export
 * @interface EnvironmentDefinition
 */
export interface EnvironmentDefinition {
    /**
     * 
     * @type {Array<string>}
     * @memberof EnvironmentDefinition
     */
    'imports'?: Array<string>;
    /**
     * 
     * @type {EnvironmentDefinitionValues}
     * @memberof EnvironmentDefinition
     */
    'values'?: EnvironmentDefinitionValues;
}
/**
 * 
 * @export
 * @interface EnvironmentDefinitionValues
 */
export interface EnvironmentDefinitionValues {
    [key: string]: object | any;

    /**
     * 
     * @type {{ [key: string]: any; }}
     * @memberof EnvironmentDefinitionValues
     */
    'pulumiConfig'?: { [key: string]: any; };
    /**
     * 
     * @type {{ [key: string]: string; }}
     * @memberof EnvironmentDefinitionValues
     */
    'environmentVariables'?: { [key: string]: string; };
}
/**
 * @export
 * @interface EnvironmentMetadata
 */
export interface EnvironmentMetadata {
    id: string;
    userPermission: string;
    activeChangeRequest: {
        changeRequestId: string;
    }
    gatedActions: string[];
}
/**
 * 
 * @export
 * @interface EnvironmentDiagnostic
 */
export interface EnvironmentDiagnostic {
    [key: string]: object | any;

    /**
     * 
     * @type {string}
     * @memberof EnvironmentDiagnostic
     */
    'summary': string;
    /**
     * 
     * @type {string}
     * @memberof EnvironmentDiagnostic
     */
    'path'?: string;
    /**
     * 
     * @type {Range}
     * @memberof EnvironmentDiagnostic
     */
    'range'?: Range;
}
/**
 * 
 * @export
 * @interface EnvironmentDiagnostics
 */
export interface EnvironmentDiagnostics {
    /**
     * 
     * @type {Array<EnvironmentDiagnostic>}
     * @memberof EnvironmentDiagnostics
     */
    'diagnostics'?: Array<EnvironmentDiagnostic>;
}

/**
 * 
 * @export
 * @interface ExprBuiltin
 */
export interface ExprBuiltin {
    /**
     * 
     * @type {string}
     * @memberof ExprBuiltin
     */
    'name': string;
    /**
     * 
     * @type {Range}
     * @memberof ExprBuiltin
     */
    'nameRange'?: Range;
    /**
     * 
     * @type {any}
     * @memberof ExprBuiltin
     */
    'argSchema'?: any;
    /**
     * 
     * @type {Expr}
     * @memberof ExprBuiltin
     */
    'arg'?: Expr;
}

/**
 * 
 * @export
 * @interface ModelError
 */
export interface ModelError {
    /**
     * 
     * @type {string}
     * @memberof ModelError
     */
    'message': string;
    /**
     * 
     * @type {number}
     * @memberof ModelError
     */
    'code': number;
}
/**
 * 
 * @export
 * @interface OpenEnvironment
 */
export interface OpenEnvironment {
    /**
     * Open environment session identifier
     * @type {string}
     * @memberof OpenEnvironment
     */
    'id': string;
    /**
     * 
     * @type {EnvironmentDiagnostics}
     * @memberof OpenEnvironment
     */
    'diagnostics'?: EnvironmentDiagnostics;
}
/**
 * 
 * @export
 * @interface OrgEnvironment
 */
export interface OrgEnvironment {
    /**
     * 
     * @type {string}
     * @memberof OrgEnvironment
     */
    'organization'?: string;
    /**
     * 
     * @type {string}
     * @memberof OrgEnvironment
     */
    'name': string;
    /**
     * 
     * @type {string}
     * @memberof OrgEnvironment
     */
    'created': string;
    /**
     * 
     * @type {string}
     * @memberof OrgEnvironment
     */
    'modified': string;
    /**
     * 
     * @type {string}
     * @memberof OrgEnvironment
     */
    'project': string;
    /**
     * 
     * @type {string}
     * @memberof OrgEnvironment
     */

    /**
     * 
     * @type {Array<string>}
     * @memberof OrgEnvironment
     */
    tags?: Array<string>;
}
/**
 * 
 * @export
 * @interface OrgEnvironments
 */
export interface OrgEnvironments {
    /**
     * 
     * @type {Array<OrgEnvironment>}
     * @memberof OrgEnvironments
     */
    'environments'?: Array<OrgEnvironment>;
    /**
     * 
     * @type {string}
     * @memberof OrgEnvironments
     */
    'nextToken'?: string;
}
/**
 * 
 * @export
 * @interface Pos
 */
export interface Pos {
    /**
     * Line is the source code line where this position points. Lines are counted starting at 1 and incremented for each newline character encountered.
     * @type {number}
     * @memberof Pos
     */
    'line': number;
    /**
     * Column is the source code column where this position points. Columns are counted in visual cells starting at 1, and are incremented roughly per grapheme cluster encountered.
     * @type {number}
     * @memberof Pos
     */
    'column': number;
    /**
     * Byte is the byte offset into the file where the indicated position begins.
     * @type {number}
     * @memberof Pos
     */
    'byte': number;
}

export interface EnvironmentImportReferrer {
	'project': string;
	'name': string;
	'revision': number;
}

// An EnvironmentStackReferrer represents a reference from an IaC stack.
export interface EnvironmentStackReferrer {
	'projectName': string;
	'stackName': string;
	'version': number;
}

// An EnvironmentReferrer represents an entity that refers to an environment.
export interface EnvironmentReferrer {
	'environment': EnvironmentImportReferrer;
	'stack': EnvironmentStackReferrer;
}

export interface ListEnvironmentReferrersResponse {
	'referrers': EnvironmentReferrer[];
	'continuationToken': string;
}

export interface ProviderSchema {
    name: string;
    description: string;
    inputs?: any;
    outputs?: any;
}

// Copyright 2016-2024, Pulumi Corporation. All rights reserved.

// A Value is the result of evaluating an expression within an environment definition.
export interface Value {
    value: ValueRepr;
    secret?: boolean;
    unknown?: boolean;
    trace?: Trace;
}

// ValueRepr describes the possible values in a Value.
export type ValueRepr = undefined | null | boolean | string | number | Value[] | Record<string, Value>;

// A Trace holds information about the expression and base of a value.
export interface Trace {
    def: Range;
    base: Value;
}

// A Range defines a range within an environment definition.
export interface Range {
    environment: string;
    begin: Position;
    end: Position;
}

// A Position defines a position within an environment definition.
export interface Position {
    line: number;
    column: number;
    byte: number;
}

export interface Diagnostic {
    range?: Range;
    summary?: string;
    path?: string;
}

export interface EvaluatedExecutionContext {
    properties?: Record<string, Value>;
    schema?: object; // TODO: add a type for schema rather than a raw object.
}

export interface BaseExpr {
    range: Range;
    base?: Expr;
}

// An Expr holds information about an expression in an environment definition.
export type Expr = LiteralExpr | InterpolateExpr | SymbolExpr | AccessExpr | ListExpr | ObjectExpr | BuiltinExpr;

export interface LiteralExpr extends BaseExpr {
    // The literal value.
    literal: null | boolean | number | string;
}

export interface InterpolateExpr extends BaseExpr {
    // The interpolation.
    interpolate: Interpolation[];
}

export interface SymbolExpr extends BaseExpr {
    // The accessors for the accessed symbol.
    symbol: PropertyAccessor[];
}

export interface AccessExpr extends BaseExpr {
    // The property being accessed and the access's receiver.
    access: Access;
}

export interface ListExpr extends BaseExpr {
    // The list elements
    list: Expr[];
}

export interface ObjectExpr extends BaseExpr {
    // Ranges for the object's keys.
    keyRanges: Record<string, Range>;

    // The object's properties.
    object: Record<string, Expr>;
}

export interface BuiltinExpr extends BaseExpr {
    // The builtin being called.
    builtin: Builtin;
}

export function isLiteral(x: Expr): x is LiteralExpr {
    return "literal" in x;
}

export function isInterpolate(x: Expr): x is InterpolateExpr {
    return "interpolate" in x;
}

export function isSymbol(x: Expr): x is SymbolExpr {
    return "symbol" in x;
}

export function isAccess(x: Expr): x is AccessExpr {
    return "access" in x;
}

export function isList(x: Expr): x is ListExpr {
    return "list" in x;
}

export function isObject(x: Expr): x is ObjectExpr {
    return "object" in x;
}

export function isBuiltin(x: Expr): x is BuiltinExpr {
    return "builtin" in x;
}

export function isIndex(x: Accessor): x is IndexAccessor {
    return "index" in x;
}

export function isKey(x: Accessor): x is KeyAccessor {
    return "key" in x;
}

// An Interpolation holds information about a part of an interpolated string expression.
export interface Interpolation {
    // The text of the expression. Precedes the stringified Value in the output.
    text: string;

    // The value to interpolate.
    value: PropertyAccessor[];
}

// An Accessor is an element index or property name.
export type Accessor = IndexAccessor | KeyAccessor;

export interface IndexAccessor {
    // The integer index of the element to access.
    index: number;
}

export interface KeyAccessor {
    // The key of the property to access.
    key: string;
}

// A PropertyAccessor is a single accessor that is associated with a resolved value.
export type PropertyAccessor = Accessor & {
    // The range of the expression that defines the resolved value.
    value: Range;

    // The range of the accessor.
    range: Range;
};

// An Access represents a property access with a receiving value.
export interface Access {
    // The receiver to access.
    receiver: Range;

    // The accessors to evaluate.
    accessors: Accessor[];
}

// A Builtin is a call to a builtin function.
export interface Builtin {
    name: string;
    nameRange: Range;
    arg: Expr;
    argSchema: object;
}

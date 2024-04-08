
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
 * @interface Access
 */
export interface Access {
    /**
     * 
     * @type {Range}
     * @memberof Access
     */
    'receiver'?: Range;
    /**
     * 
     * @type {Array<Accessor>}
     * @memberof Access
     */
    'accessors'?: Array<Accessor>;
}
/**
 * 
 * @export
 * @interface Accessor
 */
export interface Accessor {
    /**
     * 
     * @type {number}
     * @memberof Accessor
     */
    'index'?: number;
    /**
     * 
     * @type {string}
     * @memberof Accessor
     */
    'key': string;
    /**
     * 
     * @type {Range}
     * @memberof Accessor
     */
    'range': Range;
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
 * @interface EvaluatedExecutionContext
 */
export interface EvaluatedExecutionContext {
    /**
     * 
     * @type {{ [key: string]: Value; }}
     * @memberof EvaluatedExecutionContext
     */
    'properties'?: { [key: string]: Value; };
    /**
     * 
     * @type {any}
     * @memberof EvaluatedExecutionContext
     */
    'schema'?: any;
}
/**
 * 
 * @export
 * @interface Expr
 */
export interface Expr {
    /**
     * 
     * @type {Range}
     * @memberof Expr
     */
    'range'?: Range;
    /**
     * 
     * @type {Expr}
     * @memberof Expr
     */
    'base'?: Expr;
    /**
     * 
     * @type {any}
     * @memberof Expr
     */
    'schema'?: any;
    /**
     * 
     * @type {{ [key: string]: Range; }}
     * @memberof Expr
     */
    'keyRanges'?: { [key: string]: Range; };
    /**
     * 
     * @type {any}
     * @memberof Expr
     */
    'literal'?: any;
    /**
     * 
     * @type {Array<Interpolation>}
     * @memberof Expr
     */
    'interpolate'?: Array<Interpolation>;
    /**
     * 
     * @type {Array<PropertyAccessor>}
     * @memberof Expr
     */
    'symbol'?: Array<PropertyAccessor>;
    /**
     * 
     * @type {Array<Access>}
     * @memberof Expr
     */
    'access'?: Array<Access>;
    /**
     * 
     * @type {Array<Expr>}
     * @memberof Expr
     */
    'list'?: Array<Expr>;
    /**
     * 
     * @type {{ [key: string]: Expr; }}
     * @memberof Expr
     */
    'object'?: { [key: string]: Expr; };
    /**
     * 
     * @type {ExprBuiltin}
     * @memberof Expr
     */
    'builtin'?: ExprBuiltin;
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
 * @interface Interpolation
 */
export interface Interpolation {
    /**
     * 
     * @type {string}
     * @memberof Interpolation
     */
    'text': string;
    /**
     * 
     * @type {Array<PropertyAccessor>}
     * @memberof Interpolation
     */
    'value'?: Array<PropertyAccessor>;
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
/**
 * 
 * @export
 * @interface PropertyAccessor
 */
export interface PropertyAccessor {
    /**
     * 
     * @type {number}
     * @memberof PropertyAccessor
     */
    'index'?: number;
    /**
     * 
     * @type {string}
     * @memberof PropertyAccessor
     */
    'key': string;
    /**
     * 
     * @type {Range}
     * @memberof PropertyAccessor
     */
    'range': Range;
    /**
     * 
     * @type {Range}
     * @memberof PropertyAccessor
     */
    'value'?: Range;
}
/**
 * 
 * @export
 * @interface Range
 */
export interface Range {
    /**
     * 
     * @type {string}
     * @memberof Range
     */
    'environment': string;
    /**
     * 
     * @type {Pos}
     * @memberof Range
     */
    'begin': Pos;
    /**
     * 
     * @type {Pos}
     * @memberof Range
     */
    'end': Pos;
}
/**
 * 
 * @export
 * @interface Reference
 */
export interface Reference {
    /**
     * 
     * @type {string}
     * @memberof Reference
     */
    '$ref': string;
}
/**
 * 
 * @export
 * @interface Trace
 */
export interface Trace {
    /**
     * 
     * @type {Range}
     * @memberof Trace
     */
    'def'?: Range;
    /**
     * 
     * @type {Value}
     * @memberof Trace
     */
    'base'?: Value;
}
/**
 * 
 * @export
 * @interface Value
 */
export interface Value {
    /**
     * 
     * @type {any}
     * @memberof Value
     */
    'value': any;
    /**
     * 
     * @type {boolean}
     * @memberof Value
     */
    'secret'?: boolean;
    /**
     * 
     * @type {boolean}
     * @memberof Value
     */
    'unknown'?: boolean;
    /**
     * 
     * @type {Trace}
     * @memberof Value
     */
    'trace': Trace;
}

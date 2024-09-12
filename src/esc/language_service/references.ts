import * as vscode from 'vscode';
import * as esc from '../models';
import * as yaml from './yaml-document';
import { formEnvUri, formEnvUriFromImportRef, parseEnvUri, parseRevision } from '../uriHelper';
import { findExprAtPosition, rangeFromEscRange } from './range_helper';
import { exprAtPath } from './environment';
import { get } from 'axios';

interface getApi {
	listAllReferrers(org: string, project: string, envName: string, version?: string): Promise<esc.EnvironmentImportReferrer[]>;
	checkEnvironment(org: string, project: string, envName: string, version?: string): Promise<esc.CheckEnvironment | undefined>;
}

export interface EnvRef {
    org: string;
    project: string;
    envName: string;
    version: string;
}

export async function provideReferences(
    envRefs: Map<EnvRef, EnvRef[]>,
    envChecks: Map<EnvRef, esc.CheckEnvironment>,
    api: getApi, docYaml: yaml.Document,
    doc: vscode.TextDocument,
    exprs: Record<string, esc.Expr> | undefined,
    position: vscode.Position,
    _: vscode.ReferenceContext,
    token: vscode.CancellationToken
): Promise<vscode.Location[] | undefined> {
	const offset = doc.offsetAt(position);
	const yamlNode = yaml.findInDocument(docYaml, offset);
	if (yamlNode === undefined) {
		return undefined;
	}

	if (token.isCancellationRequested) {
		return undefined;
	}

	const { node, path } = yamlNode;
	if (node === undefined) {
		return undefined;
	}

	const org = parseEnvUri(doc.uri).org;
	let pathAccessors = yaml.pathAccessors(path);
	if (pathAccessors[0] === "imports" && node.type === "scalar") {
		const uri = formEnvUriFromImportRef(org, node.source);
		const importRef = parseEnvUri(uri);
        const version = parseRevision(uri);

		const refs = await api.listAllReferrers(org, importRef.project, importRef.envName, version);
		return refs.map(ref => {
			const refUri = formEnvUri(org, ref.project, ref.name, `/rev/${ref.revision}`);
			return new vscode.Location(refUri, new vscode.Position(0, 0));
		});
	}

    const definition = provideDefinition(doc, exprs, org, pathAccessors, position);
    if (definition !== undefined && definition.uri !== doc.uri) {
        return await loadAllReferences(definition.uri, doc, api, envRefs, envChecks, definition.pathAccessors, token);
    }

    pathAccessors = pathAccessors.slice(1);
    const last = path[path.length - 1];
    if (last.type === "map-key") {
        const key = yaml.entryKey(last.entry);
        pathAccessors.push(key);
    }
    
    return await loadAllReferences(doc.uri, doc, api, envRefs, envChecks, pathAccessors, token);
}

async function loadAllReferences(uri: vscode.Uri, doc: vscode.TextDocument, api: getApi, envRefs: Map<EnvRef, EnvRef[]>, envChecks: Map<EnvRef, esc.CheckEnvironment>, pathAccessors: yaml.Accessor[], token: vscode.CancellationToken) {
    const e = parseEnvUri(uri);
    const currentEnv = { org: e.org, project: e.project, envName: e.envName, version: parseRevision(doc.uri) };
    const envs = await getAllReferences(api, envRefs, currentEnv, token);
    await processEnvironments(api, envChecks, envs, token);
    const results = findAllReferences(api, envChecks, pathAccessors, currentEnv);
    return results;
}

async function getAllReferences(api:getApi, envCache: Map<EnvRef, EnvRef[]>, env: EnvRef, token: vscode.CancellationToken): Promise<EnvRef[]> {
    let results = envCache.get(env);
    if (results !== undefined && env.version !== "latest") {
        return results;
    }

    results = [];
    if (token.isCancellationRequested) {
        return results;
    }

    const refs = await api.listAllReferrers(env.org, env.project, env.envName, env.version);
    for (const ref of refs) {
        results.push({ org: env.org, project: ref.project, envName: ref.name, version: ref.revision.toString() });
    }

    envCache.set(env, results);

    for (const ref of refs) {
        const importRef = { org: env.org, project: ref.project, envName: ref.name, version: ref.revision.toString() };
        const childRefs = await getAllReferences(api, envCache, importRef, token);
        results.push(...childRefs);
    }

    envCache.set(env, results);
    
    return results;
}


async function processEnvironments(api:getApi, cache: Map<EnvRef, esc.CheckEnvironment>, envs: EnvRef[], token: vscode.CancellationToken): Promise<void> {
    for (const key of envs) {
        if (!cache.has(key)) {
            if (token.isCancellationRequested) {
                return;
            }

            const checkResult = await api.checkEnvironment(key.org, key.project, key.envName, key.version);
            if (checkResult === undefined) {
                continue;
            }

            cache.set(key, checkResult);
        }
    }
}



function findAllReferences(
    api: getApi,
    envChecks: Map<EnvRef, esc.CheckEnvironment>,
    pathAccessors: yaml.Accessor[],
    currentEnv: EnvRef): vscode.Location[] {
    const results: vscode.Location[] = [];
    for (const [ref, check] of envChecks) {
        const refUri = formEnvUri(ref.org, ref.project, ref.envName, `/rev/${ref.version}`);
        results.push(new vscode.Location(refUri, new vscode.Position(0, 0)));
        if (check === undefined || check.exprs === undefined) {
            continue;
        }

        const matches = findMatches(Object.values(check.exprs), pathAccessors, `${currentEnv.project}/${currentEnv.envName}`, refUri, 0);
        results.push(...matches);
    }

    return results;
}

function findMatches(exprs: esc.Expr[], pathAccessors: yaml.Accessor[], currentEnv: string, refUri: vscode.Uri, level: number): vscode.Location[] {
    const results: vscode.Location[] = [];
    for (const expr of exprs) {
        
        if (esc.isObject(expr)) {
            const matches = findMatches(Object.values(expr.object), pathAccessors, currentEnv, refUri, level + 1);
            results.push(...matches);
        }

        if (esc.isList(expr)) {
            const matches = findMatches(expr.list, pathAccessors, currentEnv, refUri, level + 1);
            results.push(...matches);
        }

        if (matchesSymbolPath(expr, pathAccessors, currentEnv)) {
            results.push(new vscode.Location(refUri, rangeFromEscRange(expr.range)));
        }

        if (matchesInterpolationPath(expr, pathAccessors, currentEnv)) {
            results.push(new vscode.Location(refUri, rangeFromEscRange(expr.range)));
        }
    }

    return results;
}

function matchesInterpolationPath(expr: esc.Expr, pathAccessors: yaml.Accessor[], currentEnv: string): boolean {
    if (!esc.isInterpolate(expr)) {
        return false;
    }

    for (const interpolation of expr.interpolate) {
        if (interpolation.value === undefined) {
            continue;
        }

        if (matchesAccessors(interpolation.value, pathAccessors, currentEnv)) {
            return true;
        }
    }

    return false;
}

function matchesSymbolPath(expr: esc.Expr, pathAccessors: yaml.Accessor[], currentEnv: string): boolean {
    if (!esc.isSymbol(expr)) {
        return false;
    }

    return matchesAccessors(expr.symbol, pathAccessors, currentEnv);
}

function matchesAccessors(accessors: esc.PropertyAccessor[], pathAccessors: yaml.Accessor[], currentEnv: string): boolean {
    let i = 0;
    for (const subExpr of accessors) {
        const value = getExprValue(subExpr);

        if (value !== pathAccessors[i]) {
            return false;
        }

        if (subExpr.value.environment !== currentEnv) {
            return false;
        }

        i++;
        if (i === pathAccessors.length) {
            return true;
        }
    }

    return false;
}

interface ExprAtPosition {
    uri: vscode.Uri;
    pathAccessors: yaml.Accessor[];
}

export function provideDefinition(
	doc: vscode.TextDocument,
	exprs: Record<string, esc.Expr> | undefined,
	org: string,
	pathAccessors: yaml.Accessor[],
	position: vscode.Position,
): ExprAtPosition | undefined {
	const at = exprAtPath(exprs, pathAccessors);
	if (at === undefined) {
		return undefined;
	}

	const { expr } = at;
	if (esc.isInterpolate(expr)) {
		for (const interpolation of expr.interpolate) {
			for (const subExpr of interpolation.value) {
                const found =  getExpressionPropertyAccessors(interpolation.value, doc, org, position);
                if (found !== undefined) {
                    return found;
                }

			}
		}
	}

	if (esc.isSymbol(expr)) {
        return getExpressionPropertyAccessors(expr.symbol, doc, org, position);
	}

	return undefined;
}

function getExpressionPropertyAccessors(accessors: esc.PropertyAccessor[], doc: vscode.TextDocument, org: string, position: vscode.Position): ExprAtPosition | undefined {
    const resultPath: yaml.Accessor[] = [];
    for (const subExpr of accessors) {
        resultPath.push(getExprValue(subExpr));

        const location = findExprAtPosition(doc, org, subExpr, position);
        if (location !== undefined) {
            const uri = formEnvUriFromImportRef(org, subExpr.value.environment);
            return { uri, pathAccessors: resultPath };
        }
    }

    return undefined;
}

function getExprValue(subExpr: esc.PropertyAccessor): string | number {
    let value: string | number = "";
    if (esc.isKey(subExpr)) {
        value = subExpr.key;
    } else if (esc.isIndex(subExpr)) {
        value = subExpr.index;
    }

    return value;
}

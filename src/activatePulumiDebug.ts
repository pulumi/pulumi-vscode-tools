/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
/*
 * activatePulumiDebug.ts containes the shared extension code that can be executed both in node.js and the browser.
 */

'use strict';

import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { FileAccessor, PulumiDebugSession } from './pulumiDebug';

export function activatePulumiDebug(context: vscode.ExtensionContext) {

	// register configuration providers for 'pulumi' debug type
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('pulumi', new PulumiConfigurationProvider()));
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('pulumi', new PulumiDynamicConfigurationProvider(), 
		vscode.DebugConfigurationProviderTriggerKind.Dynamic));

	// register the debug adapter factory
	const factory = new InlineDebugAdapterFactory();
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('pulumi', factory));
}

class PulumiConfigurationProvider implements vscode.DebugConfigurationProvider {
	/**
	 * Resolve a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
		// if (!config.stackName || config.stackName === '') {
		// 	return vscode.window.showInformationMessage("Stack name must be configured").then(_ => {
		// 		return undefined;	// abort launch
		// 	});
		// }
		if (!config.stack) {
			config.stack = 'dev';
		}
		if (!config.workDir) {
			config.workDir = '${workspaceFolder}';
		}

		return config;
	}
}

class PulumiDynamicConfigurationProvider implements vscode.DebugConfigurationProvider {
	/**
	 * provideDebugConfigurations is called to provide automatic launch configurations without requiring a launch.json.
	 */
	provideDebugConfigurations(folder: WorkspaceFolder | undefined): ProviderResult<DebugConfiguration[]> {
		return vscode.workspace.findFiles('Pulumi.yaml').then((uris) => {
			if (uris.length === 0) {
				return [];
			}
			return [
				{
					"type": "pulumi",
					"request": "launch",
					"name": "Pulumi: preview",
					"command": "preview",
					"workDir": "${workspaceFolder}",
					"stackName": "dev",
					"stopOnEntry": true
				},
				{
					"type": "pulumi",
					"request": "launch",
					"name": "Pulumi: up",
					"command": "up",
					"workDir": "${workspaceFolder}",
					"stackName": "dev",
					"stopOnEntry": true
				},
				{
					"type": "pulumi",
					"request": "launch",
					"name": "Pulumi: destroy",
					"command": "destroy",
					"workDir": "${workspaceFolder}",
					"stackName": "dev",
					"stopOnEntry": true
				}
			];
		});
	}
}

export const workspaceFileAccessor: FileAccessor = {
	isWindows: typeof process !== 'undefined' && process.platform === 'win32',
	async readFile(path: string): Promise<Uint8Array> {
		let uri: vscode.Uri;
		try {
			uri = pathToUri(path);
		} catch (e) {
			return new TextEncoder().encode(`cannot read '${path}'`);
		}

		return await vscode.workspace.fs.readFile(uri);
	},
	async writeFile(path: string, contents: Uint8Array) {
		await vscode.workspace.fs.writeFile(pathToUri(path), contents);
	}
};

function pathToUri(path: string) {
	try {
		return vscode.Uri.file(path);
	} catch (e) {
		return vscode.Uri.parse(path);
	}
}

class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {

	createDebugAdapterDescriptor(_session: vscode.DebugSession): ProviderResult<vscode.DebugAdapterDescriptor> {
		return new vscode.DebugAdapterInlineImplementation(new PulumiDebugSession(_session, workspaceFileAccessor));
	}
}

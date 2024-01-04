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
	const provider = new PulumiConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('pulumi', provider));
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('pulumi', {
		provideDebugConfigurations(folder: WorkspaceFolder | undefined): ProviderResult<DebugConfiguration[]> {
			return vscode.workspace.findFiles('Pulumi.yaml').then((uris) => {
				if (uris.length === 0) {
					return [];
				}
				return [
					{
						"type": "pulumi",
						"request": "launch",
						"name": "pulumi: preview",
						"command": "preview",
						"workDir": "${workspaceFolder}",
						"stackName": "dev",
						"stopOnEntry": true
					}
				];
			});
		}
	}, vscode.DebugConfigurationProviderTriggerKind.Dynamic));

	// register the debug adapter factory
	const factory = new InlineDebugAdapterFactory();
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('pulumi', factory));
}

class PulumiConfigurationProvider implements vscode.DebugConfigurationProvider {

	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {

		// // if launch.json is missing or empty
		// if (!config.type && !config.request && !config.name) {
		// 	const editor = vscode.window.activeTextEditor;
		// 	if (editor && editor.document.languageId === 'markdown') {
		// 		config.type = 'pulumi';
		// 		config.name = 'pulumi: preview';
		// 		config.request = 'launch';
		// 		config.command = 'preview';
		//      config.stackName = 'dev';
		// 		config.workDir = '${workspaceFolder}';
		// 		config.stopOnEntry = true;
		// 	}
		// }

		// if (!config.program) {
		// 	return vscode.window.showInformationMessage("Cannot find a program to debug").then(_ => {
		// 		return undefined;	// abort launch
		// 	});
		// }

		// if (!config.stack) {
		// 	config.stack = 'dev';
		// }

		return config;
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


'use strict';

import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { FileAccessor, PulumiDebugSession } from './pulumiDebug';
import { createWorkspace } from './configuration';

const NEW_STACK_TEXT = 'Create a new stack...';

export function activate(context: vscode.ExtensionContext) {
	// register configuration providers for 'pulumi' debug type
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('pulumi', new PulumiConfigurationProvider()));
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('pulumi', new PulumiDynamicConfigurationProvider(), 
		vscode.DebugConfigurationProviderTriggerKind.Dynamic));

	// register the debug adapter factory
	const factory = new InlineDebugAdapterFactory();
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('pulumi', factory));
}

async function pickStack(workspaceFolder: string, env?: { [key: string]: string; }): Promise<string | undefined> {
	// create (or select if one already exists) a stack that uses our local program
	const ws = await createWorkspace(workspaceFolder, {
		envVars: {
			...env
		},
	});

	const stackSelection = vscode.workspace.getConfiguration().get<string|undefined>('pulumi.debug.stackSelection');
	if (stackSelection === 'automatic') {
		const current = await ws.stack();
		if (current) {
			return current.name;
		}
	}

	// select or create a stack
	const stacks = await ws.listStacks({});
	const picks = stacks.map<vscode.QuickPickItem>(s => {
		return {
			label: s.name,
			description: s.current ? `current` : ``,
			detail: s.url,
		};
	}).concat({label: '', kind: vscode.QuickPickItemKind.Separator}).concat({ label: NEW_STACK_TEXT });

	const picked = await vscode.window.showQuickPick(picks, {
		placeHolder: 'Select a stack'
	});

	if (picked?.label === NEW_STACK_TEXT) {
		const stackName = await vscode.window.showInputBox({
			placeHolder: 'dev',
			prompt: 'Enter a name for the new stack',
			title: 'Create a new stack',
			validateInput: (value) => {
				if (!value) {
					return 'Stack name must not be empty';
				}
				if (stacks.find(s => s.name === value)) {
					return 'A stack with this name already exists';
				}
				return undefined;
			},
		});
		if (!stackName) {
			return;
		}
		await ws.createStack(stackName);
		return stackName;
	}
	if (picked) {
		await ws.selectStack(picked.label);
	}
	return picked?.label;
}

interface PulumiDebugConfiguation extends vscode.DebugConfiguration {
	/** Deployment command (up, preview). */
	command?: string;
	/** The name of the stack to operate on. Defaults to the current stack */
	stackName?: string;
	/** Run pulumi as if it had been started in another directory. */
	workDir?: string;
	/** environment variables */
	env?: { [key: string]: string; };
	/** run without debugging */
	noDebug?: boolean;
}

function isPulumiDebugConfiguration(config: vscode.DebugConfiguration): config is PulumiDebugConfiguation {
	return config.type === 'pulumi';
}

class PulumiConfigurationProvider implements vscode.DebugConfigurationProvider {
	/**
	 * Resolve a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
		if (!config.workDir) {
			config.workDir = '${workspaceFolder}';
		}
		return config;
	}

	resolveDebugConfigurationWithSubstitutedVariables(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
		if (!isPulumiDebugConfiguration(config)) {
			return undefined;
		}
		const workDir = config.workDir;
		if (!workDir) {
			return undefined;
		}
		const stackName = config.stackName;
		if (stackName) {
			return config;
		}
		return pickStack(workDir, config.env).then(stackName => {
			if (!stackName) {
				return undefined;
			}
			config.stackName = stackName;
			return config;
		});
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
					"name": "pulumi preview",
					"command": "preview",
					"workDir": "${workspaceFolder}"
				},
				{
					"type": "pulumi",
					"request": "launch",
					"name": "pulumi up",
					"command": "up",
					"workDir": "${workspaceFolder}"
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
import * as vscode from 'vscode';
import EscApi from './api';
import * as cli from './config';
import { Organization, Environment, Revision } from './env_tree_data_provider';
import { formEnvUri } from './uriHelper';
import { isPulumiEscEditor } from './editorHelper';

function inputError(value: string): vscode.InputBoxValidationMessage {
    return {
        message: value,
        severity: vscode.InputBoxValidationSeverity.Error,
    };
}

export function addEnvironmentCommand(api: EscApi): vscode.Disposable {
    return vscode.commands.registerCommand('pulumi.esc.add-env', async (org: Organization) => {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter the name of the environment',
            placeHolder: 'Environment Name',
            validateInput: async (value) => {
                const validRegex = /^[a-zA-Z][a-zA-Z0-9-_.]*$/;
                if (!validRegex.test(value)) {
                    return inputError('Environment name must start with a letter and contain only letters, numbers, hyphens, and underscores');
                }

                if (value.length < 2) {
                    return inputError('Environment name must be at least 2 characters');
                }
                if (value.length > 100) {
                    return inputError('Environment name must be fewer than 100 characters');
                }
                switch (value) {
                    case ".":
                    case "..":
                    case "open":
                    case "yaml":
                        return inputError('Name is reserved by Pulumi');
                }
                
                if (await api.environmentExists(org.org, value)) {
                    return inputError('An environment with this name already exists');
                }

                return null;
            }
        });

        if (!name) {
            return;
        }

        await api.createEnvironment(org.org, name);
        
        vscode.commands.executeCommand('vscode.open', formEnvUri(org.org, name));
        vscode.commands.executeCommand('pulumi.esc.refresh');
    });
}

export function decryptEnvironmentCommand(): vscode.Disposable {
    return vscode.commands.registerCommand('pulumi.esc.decrypt-env', async (env: Environment) => {
        if (!env) {
            return;
        }

        vscode.commands.executeCommand('vscode.open', formEnvUri(env.org, env.envName, "/decrypt"));
    });
}

export function openEnvironmentCommand(): vscode.Disposable {
    return vscode.commands.registerCommand('pulumi.esc.open-env', async () => {
        const editor = vscode.window.activeTextEditor;

        if (!isPulumiEscEditor(editor)) {
            return;
        }

        const format = await vscode.window.showQuickPick(['yaml', 'json', 'shell', 'dotenv'], {
            placeHolder: 'format',
        });
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(`${editor!.document.uri.toString()}/open/${format}`));
        await vscode.window.showTextDocument(doc, {
            preview: true,
            preserveFocus: true,
            viewColumn: vscode.ViewColumn.Beside,
        });
    });
}

export function deleteEnvironmentCommand(api: EscApi): vscode.Disposable {
    return vscode.commands.registerCommand('pulumi.esc.delete-env', async (env: Environment) => {
        if (!env) {
            return;
        }

        const name = await vscode.window.showInputBox({
            prompt: `Type the environment name ${env.envName} to confirm delete.`,
            placeHolder: 'environment name',
            validateInput: async (value) => {
                if (value !== env.envName) {
                    return inputError(`Environment name does not match ${env.envName}`);
                }
                return null;
            }
        });

        if (!name || name !== env.envName) {
            return;
        }

        await api.deleteEnvironment(env.org, env.envName);
        await vscode.commands.executeCommand('pulumi.esc.refresh');
    });
}

export function tagRevisionCommand(api: EscApi): vscode.Disposable {
    return vscode.commands.registerCommand('pulumi.esc.tagRevision', async (rev: Revision) => {
        if (!rev) {
            return;
        }

        const tagName = await vscode.window.showInputBox({
            prompt: `Type the tag you want to apply to ${rev.envName}:${rev.revision}`,
            placeHolder: 'tag name',
        });

        if (!tagName) {
            return;
        }

        await api.tagRevision(rev.org, rev.envName, tagName, rev.revision);
        await vscode.commands.executeCommand('pulumi.esc.refresh');
    });
}

export function runCommand(): vscode.Disposable {
    return vscode.commands.registerCommand('pulumi.esc.run', async (env: Environment) => {
        const terminal = vscode.window.activeTerminal;
        if (!env || !terminal) {
            return;
        }

        terminal.sendText(`esc run ${env.org}/${env.envName} --- `, false);
        terminal.show();
    });
}

export function compareFilesCommands(): vscode.Disposable {
	let selected: Environment | undefined;
	const selectForCompare = vscode.commands.registerCommand('pulumi.esc.selectForCompare', async (env: Environment) => {
		selected = env;
		vscode.commands.executeCommand('setContext', 'pulumi.esc.compareEnabled', true);
	});

	const compareWithSelected = vscode.commands.registerCommand('pulumi.esc.compareWithSelected', async (env: Environment) => {
		if (selected) {
		vscode.commands.executeCommand('vscode.diff', selected.resourceUri, env.resourceUri);
		vscode.commands.executeCommand('setContext', 'pulumi.esc.compareEnabled', false);
		selected = undefined;
		}
	});

	return vscode.Disposable.from(selectForCompare, compareWithSelected);
}

export function loginCommand(): vscode.Disposable {
    return vscode.commands.registerCommand('pulumi.login', async () => {
        await vscode.authentication.getSession("pulumi", [], { createIfNone: true });
    });
}


export function logoutCommand(): vscode.Disposable {
    return vscode.commands.registerCommand('pulumi.logout', async () => {
        const session = await vscode.authentication.getSession("pulumi", [], {  });
    });
}
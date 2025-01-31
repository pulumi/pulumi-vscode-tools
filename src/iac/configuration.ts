
import * as vscode from 'vscode';
import { LocalWorkspace, LocalWorkspaceOptions, PulumiCommand } from "@pulumi/pulumi/automation";
import { SemVer } from 'semver';
import path from 'path';
import * as os from "os";

const minVersion: SemVer = new SemVer('v3.132.0');

/**
 * Ensures that the Pulumi CLI is installed and has a compatible version.
 * @returns The Pulumi CLI command if it is installed, otherwise undefined.
 */
export async function checkPulumiInstallation(): Promise<PulumiCommand|undefined> {
	let root = vscode.workspace.getConfiguration().get<string|undefined>('pulumi.root');
	try {
		// try the configured location and the PATH
		return await PulumiCommand.get({root: root, version: minVersion, skipVersionCheck: false});
	} catch (err) {
	}
	if (!root) {
		// try the default install location of ~/.pulumi
        root = path.join(os.homedir(), ".pulumi");
		try {
			return await PulumiCommand.get({root: root, version: minVersion, skipVersionCheck: false});
		} catch (err) {
		}
    }
	const selection = await vscode.window.showWarningMessage('Pulumi CLI is not installed.', 'Install', 'Cancel');
		switch (selection) {
			case 'Install':
				return await installPulumi(root, minVersion);
			default:
				return undefined;
		}
}

async function installPulumi(root?: string, minVersion?: SemVer): Promise<PulumiCommand> {
	return await vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: "Installing Pulumi CLI...",
		cancellable: false
	}, async (progress, token) => {
		// note: this installs the CLI version matching the SDK version (not necessarily the latest).
		return await PulumiCommand.install({root: root, skipVersionCheck: false});
	});
}

/**
 * Create a new Pulumi local workspace.
 * @param workdir The working directory of the workspace.
 * @param opts Additional options for the workspace.
 */
export async function createWorkspace(workdir: string, opts?: LocalWorkspaceOptions): Promise<LocalWorkspace> {

	const cli = await checkPulumiInstallation();
	if (!cli) {
		throw new Error('Pulumi CLI is not installed');
	}

	const envs = vscode.workspace.getConfiguration().get<{}>('pulumi.env');
	const ws = await LocalWorkspace.create({
		...opts,
		pulumiCommand: cli,
		workDir: workdir,
		envVars: {...envs, ...opts?.envVars},
	});
	return ws;
}

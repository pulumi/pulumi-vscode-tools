# Visual Studio Code Pulumi Tools

The extension for developers building Pulumi applications.

_Note_: This extension is in a public beta. If you have suggestions for features or find bugs, please open an issue.

Features include:
- Run your Pulumi program from within Visual Studio Code.
- Launch your program under a debugger.
- Automatically generate a launch configuration for a Pulumi project.
- Explorer for Pulumi ESC (Environments, Secrets, and Configuration).

## Getting Started

### Install the software

1. Install Pulumi 3.132.0 (or greater) using [these instructions](https://www.pulumi.com/docs/install/), and restart VS Code.
2. Install the [Pulumi Tools extension](https://marketplace.visualstudio.com/items?itemName=pulumi.pulumi-vscode-tools) using Visual Studio Marketplace.

## Using Pulumi IaC

This extension allows you to launch and debug Pulumi programs within VS Code.

### Open a Project

Open a new or existing Pulumi project as a VS Code workspace. This extension supports both [single-folder workspaces](https://code.visualstudio.com/docs/editor/workspaces#_singlefolder-workspaces)
and [multi-root workspaces](https://code.visualstudio.com/docs/editor/workspaces#_multiroot-workspaces).

### Start Debugging

Pulumi programs are run (with or without debugging) using a [launch configuration](https://code.visualstudio.com/docs/editor/debugging#_launch-configurations). Select the Run and Debug icon in the Activity Bar on the side of VS Code, 
then use an automatic debug configuration or create a launch configuration file for your project.

The extension automatically generates a debug configuration to run `pulumi up` or `pulumi preview`
for the current Pulumi stack. To use an automatic debug configuration, do the following:

1. Select the __Run and Debug__ icon.
2. Choose __Show all automatic debug configurations__.
3. Select "Pulumi..." then "pulumi preview" or "pulumi up".
4. Click the __Start Debugging__ icon on the selected configuration.
5. Select or create a stack when prompted to do so.

Alternatively, you can run your configuration through the Command Palette (⇧⌘P) by filtering on __Debug: Select and Start Debugging__.

### Create a Launch Configuration

To create a customized launch configuration, do one of the following:

1. When selecting an automatic debug configuration, click the gear icon to customize the configuration.
2. Create a launch.json file and use a configuration template.

The extension provides the following configuration templates:
- `pulumi up`
- `pulumi preview`

The following properties are supported:

| `name` | string | The configuration name. |  |
|---|---|---|---|
| `type` | string | Use `pulumi`. |  |
| `request` | string | Use `launch`. |  |
| `command` | string | Deployment command (up, preview). |  |
| `stackName` | string | The name of the stack to operate on. If not specified, user is prompted to select a stack. |  |
| `workDir` | string | Run Pulumi as if it had been started in another directory. |  |
| `env` | object | Environment variables for the Pulumi CLI. |  |
| `noDebug` | boolean | Run without debugging. |  |

### Run without Debugging
To run without debugging, do one of the following:

1. With a launch configuration selected, select __Run Without Debugging__ on the Run menu.
2. Add `"noDebug": "true"` property to your launch configuration.

## Using Pulumi ESC

This extension allows you to manage ESC environments without leaving VS Code.

### Open the ESC Explorer

From the primary sidebar, open the "Pulumi ESC Explorer" view, and click "login" to authenticate to Pulumi Cloud.

Once logged in, you should see a tree of your organizations and, within each organization, your ESC environments.

### Create or Edit an Environment

Click the plus sign on an organization node to create an environment.
By clicking on an environment in the tree or creating a new environment, the extension will open an editor.
Edit the environment definition and save to create a new revision.

### Open an Environment

On the right side of the editor, click the Preview button to open the environment. You will be prompted for an output format.

### Delete an Environment

If you hover over an environment, there is a icon that will delete the environment; you will be asked to enter the environment name to confirm.

### Decrypt an Environment

If you hover over an environment, there is a icon that will decrypt the environment without opening it. This is useful in a clone/move scenario.

### Refresh Environments

If you get out of date, you can always refresh using the icon at the top right of the Pulumi ESC Explorer tree view. 
The extension auto refreshes only after a change.

### Search Environments

Click the search icon in the top right, type in a search term, and see results in the pane that appears.

### Tag a Revision

Click the tag icon on a revision and give it a name.

### Diff/Compare Environments and Revisions

You can compare anything, two revisions, or two environments, or any combination.

Right or Control-click the first node to compare in the tree and click Select for compare.

Then right or control-click on another node and select Compare with Selected

### Logout

Go to the Account icon at the bottom left, select your Pulumi Cloud account, and sign out.

## Releases

See the [Releases](https://github.com/pulumi/pulumi-vscode-tools/releases) section for latest release information.

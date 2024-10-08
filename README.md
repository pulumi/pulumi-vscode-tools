# Visual Studio Code Pulumi Tools

The extension for developers building Pulumi applications.

_Note_: This extension is in a public beta. If you have suggestions for features or find bugs, please open an issue.

IAC Features include:
- Run your Pulumi program from within Visual Studio Code.
- [Launch your program under a debugger.](#start-debugging)
- [Automatically generate a launch configuration for a Pulumi project.](#create-a-launch-configuration)
- [Explorer for Pulumi ESC (Environments, Secrets, and Configuration).](#using-pulumi-esc)

![Demo](images/docs/esc_demo.gif)


## Getting Started

### Install the software

1. Get a free Pulumi account at http://app.pulumi.com/.
2. Install Pulumi 3.132.0 (or greater) using [these instructions](https://www.pulumi.com/docs/install/).
3. Install the [Pulumi Tools extension](https://marketplace.visualstudio.com/items?itemName=pulumi.pulumi-vscode-tools) using Visual Studio Marketplace.

## Using Pulumi IaC

This extension allows you to launch and debug Pulumi programs within VS Code.

### Install Pulumi CLI

When `pulumi` isn't on your PATH, the extension automatically installs the Pulumi CLI using the
Installation Script method, to `~/.pulumi/bin`.

The `pulumi.root` configuration setting allows you to customize
the install location. Do not include the `bin/` folder in the value.

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
3. Select "Pulumi..." then "pulumi preview" or "pulumi up".  Debugging will start automatically.

<figure align="center">
  <img src="images/docs/iac-automatic-1.png" alt="Automatic Debug Configuration" />
</figure>

<figure align="center">
  <img src="images/docs/iac-automatic-2.png" alt="Automatic Debug Configuration" />
</figure>

4. Select or create a stack if prompted to do so.

<figure align="center">
  <img src="images/docs/iac-stack-selection-1.png" alt="Stack Selection" />
</figure>

Alternatively, you can select and launch a configuration through the Command Palette (⇧⌘P) by filtering on __Debug: Select and Start Debugging__.

### Create a Launch Configuration

To create a customized launch configuration, do one of the following:

1. When selecting an automatic debug configuration, click the gear icon to customize the configuration.
2. Create a launch.json file and use a configuration template.

<figure align="center">
  <img src="images/docs/iac-launch-configuration.png" alt="Launch Configuration" />
</figure>

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

### Debug your Program

Set breakpoints in your program code and enjoy the full functionality of the VS Code debugger.
See ["Debugging"](https://code.visualstudio.com/docs/editor/debugging) for more information.

<figure align="center">
  <img src="images/docs/iac-debugging.png" alt="Debugging" />
</figure>

### Pulumi CLI Output

Access the CLI output via the Debug Console view.

<figure align="center">
  <img src="images/docs/iac-debug-console.png" alt="Debug Console" />
</figure>

### Run without Debugging
To run without debugging, do one of the following:

1. With a launch configuration selected, select __Run Without Debugging__ on the Run menu.
2. Add `"noDebug": "true"` property to your launch configuration.

## Using Pulumi ESC

This extension allows you to manage ESC environments without leaving VS Code.

### Open the ESC Explorer

From the primary sidebar, open the "Pulumi ESC Explorer" view, and click "login" to authenticate to Pulumi Cloud.

Once logged in, you should see a tree of your organizations and, within each organization, your ESC environments.

<figure align="center">
  <img src="images/docs/explorer.png" alt="Pulumi ESC Explorer" />
</figure>

### Create or Edit an Environment

Click the plus sign on an organization or project node to create an environment.
By clicking on an environment in the tree or creating a new environment, the extension will open an editor.
Edit the environment definition and save to create a new revision.

<figure align="center">
  <img src="images/docs/add-env.png" alt="Add ESC Environment" />
</figure>

### Open an Environment

On the right side of the editor, click the Preview button to open the environment. You will be prompted for an output format.

<figure align="center">
  <img src="images/docs/open-env.png" alt="Open ESC Environment" />
</figure>

### Delete an Environment

If you hover over an environment, there is a icon that will delete the environment; you will be asked to enter the environment name to confirm.

<figure align="center">
  <img src="images/docs/delete-env.png" alt="Delete ESC Environment" />
</figure>

### Decrypt an Environment

If you hover over an environment, there is a icon that will decrypt the environment without opening it. This is useful in a clone/move scenario.

<figure align="center">
  <img src="images/docs/decrypt-env.png" alt="Decrypt ESC Environment" />
</figure>

### Refresh Environments

If you get out of date, you can always refresh using the icon at the top right of the Pulumi ESC Explorer tree view. 
The extension auto refreshes only after a change.

<figure align="center">
  <img src="images/docs/refresh.png" alt="Refresh ESC Environment" />
</figure>

### Search Environments

Click the search icon in the top right, type in a search term, and see results in the pane that appears.

<figure align="center">
  <img src="images/docs/refresh.png" alt="Refresh ESC Environments" />
</figure>

### Tag a Revision

Click the tag icon on a revision and give it a name.

<figure align="center">
  <img src="images/docs/tag-revision.png" alt="Tag ESC Environment Revision" />
</figure>

### ESC Run in Terminal

You can quickly populate an ESC Run command for an environment in the terminal.

<figure align="center">
  <img src="images/docs/run.png" alt="ESC Run in Terminal" />
</figure>

### Go to Definition/Find all References

Both Go to Definition and Find all References are supported across symbols, interpolations, and values.

### Diff/Compare Environments and Revisions

You can compare anything, two revisions, or two environments, or any combination.

Right or Control-click the first node to compare in the tree and click Select for compare.

Then right or control-click on another node and select Compare with Selected

### Logout

Go to the Account icon at the bottom left, select your Pulumi Cloud account, and sign out.

## Releases

See the [Releases](https://github.com/pulumi/pulumi-vscode-tools/releases) section for latest release information.

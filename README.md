# Visual Studio Code Pulumi Tools

The extension for developers building Pulumi applications.

_Note_: This extension is in a public beta. If you have suggestions for features or find bugs, please open an issue.

Features include:
- Run your Pulumi program from within Visual Studio Code.
- Launch your program under a debugger.
- IntelliSense and linting for Pulumi YAML.
- Automatically generate a launch configuration for a Pulumi project.
  
## Getting Started

_Note_: This is prerelease software requiring a special build of Pulumi, see https://github.com/pulumi/pulumi/pull/14516.

### Install the software

1. Install Pulumi using [these instructions](https://www.pulumi.com/docs/install/).
2. Install the [Pulumi Tools extension](https://marketplace.visualstudio.com/items?itemName=pulumi.pulumi-vscode-tools) using Visual Studio Marketplace.

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
3. Select "Pulumi..." then "Pulumi: preview" or "Pulumi: up".
4. Click the __Start Debugging__ icon on the selected configuration.

Alternatively, you can run your configuration through the Command Palette (⇧⌘P) by filtering on __Debug: Select and Start Debugging__.

### Create a Launch Configuration

To create a customized launch configuration, do one of the following:

1. When selecting an automatic debug configuration, click the gear icon to customize the configuration.
2. Create a launch.json file and use a configuration template.

The extension provides the following configuration templates:
- `Pulumi: up`
- `Pulumi: preview`

The following properties are supported:

| `name` | string | The configuration name. |  |
|---|---|---|---|
| `type` | string | Use `pulumi`. |  |
| `request` | string | Use `launch`. |  |
| `command` | string | Deployment command (up, preview, destroy). |  |
| `stackName` | string | The name of the stack to operate on. Defaults to the ~current stack~ stack named `dev`. |  |
| `workDir` | string | Run Pulumi as if it had been started in another directory. |  |
| `env` | object | Environment variables for the Pulumi CLI. |  |
| `stopOnEntry` | boolean | Automatically stop the program to wait for the debugger to attach. |  |
| `noDebug` | boolean | Run without debugging. |  |

### Run without Debugging
To run without debugging, do one of the following:

1. With a launch configuration selected, select __Run Without Debugging__ on the Run menu.
2. Add `"noDebug": "true"` property to your launch configuration.

## Extension Settings

## Releases

See the [Releases](https://github.com/pulumi/pulumi-vscode-tools/releases) section for latest release information.
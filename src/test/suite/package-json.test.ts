// Copyright 2024, Pulumi Corporation. All rights reserved.

import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";

suite("Package.json Configuration", () => {
    let packageJson: {
        extensionPack?: string[];
        extensionDependencies?: string[];
        categories?: string[];
    };

    suiteSetup(() => {
        const packageJsonPath = path.resolve(__dirname, "..", "..", "..", "package.json");
        const raw = fs.readFileSync(packageJsonPath, "utf-8");
        packageJson = JSON.parse(raw);
    });

    test("extensionPack should not include unsigned extensions that cause signature verification failures", () => {
        // Issue #35: Installing pulumi extensions in VS Code throws
        // "signature verification failed" because the extensionPack references
        // extensions (pulumi.pulumi-lsp-client, pulumi.pulumi-vscode-copilot)
        // that are not signed. VS Code refuses to install unsigned extensions
        // when signature verification is enabled.
        const problematicExtensions = ["pulumi.pulumi-lsp-client", "pulumi.pulumi-vscode-copilot"];
        const extensionPack = packageJson.extensionPack ?? [];

        for (const ext of problematicExtensions) {
            assert.ok(
                !extensionPack.includes(ext),
                `extensionPack should not include '${ext}' as it is unsigned and causes signature verification failures (see issue #35)`,
            );
        }
    });

    test("categories should not include 'Extension Packs' if extensionPack is empty or absent", () => {
        const extensionPack = packageJson.extensionPack ?? [];
        const categories = packageJson.categories ?? [];

        if (extensionPack.length === 0) {
            assert.ok(
                !categories.includes("Extension Packs"),
                "categories should not include 'Extension Packs' when there are no extensions in the pack",
            );
        }
    });
});

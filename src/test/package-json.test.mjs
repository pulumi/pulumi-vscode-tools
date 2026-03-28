// Copyright 2024, Pulumi Corporation. All rights reserved.
//
// Standalone test for package.json configuration.
// Validates fix for issue #35: signature verification failures caused by
// unsigned extensions in extensionPack.
//
// Run with: node src/test/package-json.test.mjs

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = resolve(__dirname, "..", "..", "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  PASS: ${name}`);
        passed++;
    } catch (e) {
        console.error(`  FAIL: ${name}`);
        console.error(`    ${e.message}`);
        failed++;
    }
}

console.log("Package.json Configuration Tests");
console.log("================================");

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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}

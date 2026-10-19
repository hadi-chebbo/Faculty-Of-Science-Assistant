// Loads the app's TypeScript storage code (and the sample PDF writer) into a CommonJS seeder.
// Uses Node's built-in type stripping (native since Node 22.18) and a resolve hook for the
// "@/" alias and extension-less relative imports, like scripts/check-storage.mjs.
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

export async function loadStorage() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 18)) {
    throw new Error("Seeding demo files needs Node 22.18 or newer (built-in TypeScript support).");
  }
  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier.startsWith("@/")) {
        return nextResolve(pathToFileURL(path.join(src, `${specifier.slice(2)}.ts`)).href, context);
      }
      try {
        return nextResolve(specifier, context);
      } catch (error) {
        if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) {
          return nextResolve(`${specifier}.ts`, context);
        }
        throw error;
      }
    },
  });
  const url = (file) => pathToFileURL(path.join(src, file)).href;
  const [config, keys, pdf, constants] = await Promise.all([
    import(url("lib/storage/config.ts")),
    import(url("lib/storage/keys.ts")),
    import(url("lib/storage/sample-pdf.ts")),
    import(url("db/constants.ts")),
  ]);
  return {
    getStorage: config.getStorage,
    newResourceFileKey: keys.newResourceFileKey,
    samplePdf: pdf.samplePdf,
    contentType: constants.UPLOAD_CONTENT_TYPE,
  };
}

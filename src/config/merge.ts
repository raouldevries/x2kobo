import type { ConvertOptions } from "../commands/convert.js";
import type { UserDefaults } from "./store.js";

export function mergeOptions(
  cliOptions: Partial<ConvertOptions>,
  defaults: UserDefaults,
): ConvertOptions {
  return {
    noUpload: cliOptions.noUpload ?? defaults.noUpload,
    useChrome: cliOptions.useChrome ?? defaults.useChrome,
    verbose: cliOptions.verbose ?? defaults.verbose,
    debug: cliOptions.debug ?? defaults.debug,
    output: cliOptions.output ?? defaults.output,
  };
}

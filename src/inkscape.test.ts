import { findInkscapeBinaries, invokeInkscape } from "./module.js";

console.dir(findInkscapeBinaries(), { depth: null });

console.log(
  new TextDecoder().decode(
    await invokeInkscape(["--version"], new Uint8Array()),
  ),
);

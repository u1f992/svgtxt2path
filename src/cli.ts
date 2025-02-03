import fs from "node:fs";

import { Command } from "commander";
import * as xmldom from "@xmldom/xmldom";

import { convertSVGTextToPath } from "./module.js";
import { VERSION } from "./version.js";

const program = new Command();

program
  .name("svgtxt2path")
  .version(VERSION)
  .option("-i, --input <file>")
  .option("-o, --output <file>")
  .option("--inkscape-bin <bin>")
  .parse(process.argv);

const options = program.opts();

const inputStream: NodeJS.ReadableStream = options.input
  ? fs.createReadStream(options.input)
  : process.stdin;
const outputStream: NodeJS.WritableStream = options.output
  ? fs.createWriteStream(options.output)
  : process.stdout;

let svg = "";
for await (const chunk of inputStream) {
  svg += chunk;
}
outputStream.write(
  new xmldom.XMLSerializer().serializeToString(
    await convertSVGTextToPath(
      new xmldom.DOMParser().parseFromString(svg, "image/svg+xml"),
      { inkscape: options.inkscapeBin },
    ),
  ),
);
outputStream.end();

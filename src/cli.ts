#!/usr/bin/env node
/*
 * Copyright (C) 2025  Koutaro Mukai
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

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

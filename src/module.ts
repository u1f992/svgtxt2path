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

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as xmldom from "@xmldom/xmldom";
import xpath from "xpath";

export function findInkscapeBinaries() {
  const paths = Array.from(
    new Set(process.env.PATH?.split(path.delimiter) ?? []),
  );
  const exts =
    os.platform() === "win32"
      ? (process.env.PATHEXT?.split(path.delimiter) ?? [])
      : [""];
  return paths.flatMap((dir) =>
    exts
      .map((ext) => path.join(dir, "inkscape" + ext))
      .filter(
        (fullPath) => fs.existsSync(fullPath) && fs.statSync(fullPath).isFile(),
      ),
  );
}

export async function invokeInkscape(
  args: Iterable<string>,
  stdin: Uint8Array,
  { bin }: { bin?: string } = {},
): Promise<Uint8Array> {
  bin ??= findInkscapeBinaries()[0]!;
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, [...args], { stdio: ["pipe", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    proc.stdout.on("data", (chunk) => stdoutChunks.push(chunk));
    proc.stderr.on("data", (chunk) => stderrChunks.push(chunk));
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdoutChunks));
      } else {
        reject(
          new Error(
            `Process exited with code ${code}: ${Buffer.concat(
              stderrChunks,
            ).toString()}`,
          ),
        );
      }
    });
    proc.stdin.write(stdin);
    proc.stdin.end();
  });
}

async function sanitizeSVG(
  svg: xmldom.Document,
  { inkscape }: { inkscape?: string } = {},
) {
  return new xmldom.DOMParser().parseFromString(
    new TextDecoder().decode(
      await invokeInkscape(
        ["--pipe", "--export-filename", "-"],
        new TextEncoder().encode(
          new xmldom.XMLSerializer().serializeToString(svg.getRootNode({})),
        ),
        { bin: inkscape },
      ),
    ),
    "image/svg+xml",
  );
}

async function exportSVGTextToPath(
  svg: xmldom.Document,
  { inkscape }: { inkscape?: string } = {},
) {
  return new xmldom.DOMParser().parseFromString(
    new TextDecoder().decode(
      await invokeInkscape(
        ["--pipe", "--export-text-to-path", "--export-filename", "-"],
        new TextEncoder().encode(
          new xmldom.XMLSerializer().serializeToString(svg.getRootNode({})),
        ),
        { bin: inkscape },
      ),
    ),
    "image/svg+xml",
  );
}

function setFillOpacity0(elem: xmldom.Element): void {
  let style = elem.getAttribute("style") || "";
  if (style !== "" && !style.endsWith(";")) {
    style += ";";
  }
  style += "fill-opacity: 0;";
  elem.setAttribute("style", style);
}

export async function convertSVGTextToPath(
  svg: xmldom.Document,
  { inkscape }: { inkscape?: string } = {},
) {
  const svgCopy = await sanitizeSVG(svg.cloneNode(true).ownerDocument!);
  const converted = await exportSVGTextToPath(svgCopy, { inkscape });
  const select = xpath.useNamespaces({ svg: "http://www.w3.org/2000/svg" });
  for (const textElem of select(
    ".//svg:text",
    svgCopy as any,
  ) as unknown as xmldom.Element[]) {
    setFillOpacity0(textElem);
    /**
     * Even if the original SVG does not assign IDs to each element,
     * Inkscape should supplement them when loading
     */
    if (!textElem.hasAttribute("id")) {
      console.warn("Warning: Text element is missing an ID");
      continue;
    }
    const id = textElem.getAttribute("id");
    const pathElem = (
      select(
        `.//*[@id='${id}']`,
        converted as any,
      ) as unknown as xmldom.Element[]
    )[0];
    /**
     * The ID should uniquely associate the text element before conversion
     * with the corresponding path element after conversion
     */
    if (typeof pathElem === "undefined") {
      console.warn(
        `Warning: No corresponding path found for text element with ID '${id}'`,
      );
      continue;
    }
    const parent = textElem.parentElement!;
    const gElem = svgCopy.createElement("g");
    gElem.appendChild(textElem.cloneNode(true));
    gElem.appendChild(pathElem);
    parent.replaceChild(gElem, textElem);
  }
  return sanitizeSVG(svgCopy, { inkscape });
}

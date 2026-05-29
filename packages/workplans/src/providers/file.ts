import { readFile } from "node:fs/promises";

export interface FileStepOptions {
  path: string;
  encoding?: BufferEncoding;
}

export async function runFileStep(opts: FileStepOptions): Promise<string> {
  return readFile(opts.path, opts.encoding ?? "utf8");
}

import type { LocalFiles } from "./types";

/** Only app-private JSON files; no gallery images or model files are touched. */
export const deviceFiles: LocalFiles = {
  async list() {
    const { folder } = await location();
    return folder.list().map(item => item.name);
  },
  async read(name) {
    const { File, folder } = await location();
    const file = new File(folder, name);
    return file.exists ? file.text() : null;
  },
  async write(name, text) {
    const { File, folder } = await location();
    const temporary = new File(folder, `pending-${name}`);
    try {
      temporary.write(text);
      await temporary.move(new File(folder, name), { overwrite: true });
    } finally { if (temporary.exists && temporary.name.startsWith("pending-")) temporary.delete(); }
  },
  async delete(name) {
    const { File, folder } = await location();
    const file = new File(folder, name);
    if (file.exists) file.delete();
  },
};
async function location() {
  const { Directory, File, Paths } = await import("expo-file-system");
  const folder = new Directory(Paths.document, "gabai-data");
  folder.create({ idempotent: true, intermediates: true });
  return { File, folder };
}

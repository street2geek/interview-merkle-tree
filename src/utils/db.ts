import levelup, { LevelUp } from "levelup";

import { bufferReviver } from ".";
import { ITree } from "..";

export async function saveTreeSnapshot(
  db: LevelUp,
  tree: ITree
): Promise<void> {
  const data = Buffer.from(JSON.stringify(tree));
  await db.put("treeSnap", data);
}

/** returns tree object buffer from in memory data store */
export async function restoreTree(db: LevelUp): Promise<ITree> {
  let snapshot: ITree = {};
  try {
    const data = await db.get("treeSnap");
    snapshot = JSON.parse(data, bufferReviver);
    // console.log("snapshot", snapshot);
  } catch (e) {
    console.log("error", e);
  }

  return snapshot;
}

export async function saveHashPathSnapshot(
  db: LevelUp,
  hashPathBuffer: Buffer
): Promise<void> {
  await db.put("hashPathSnapshot", hashPathBuffer);
  // await db.batch().put("hashPathSnapshot", hashPathBuffer).write();
}

/** returns hash path buffer from in memory data store */
export async function restoreHashPath(db: LevelUp): Promise<Buffer> {
  let snapshot;
  try {
    snapshot = await db.get("hashPathSnapshot");
    // console.log("snapshot", snapshot);
  } catch (e) {
    console.log("error", e);
  }

  return snapshot;
}

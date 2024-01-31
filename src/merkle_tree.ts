import { LevelUp, LevelUpChain } from "levelup";
import { HashPath } from "./hash_path";
import { Sha256Hasher } from "./sha256_hasher";
import { saveTreeSnapshot, restoreTree } from "./utils/db";

export interface ITree {
  [level: number]: Buffer[];
}

const MAX_DEPTH = 32;
const LEAF_BYTES = 64; // All leaf values are 64 bytes.

/**
 * The merkle tree, in summary, is a data structure with a number of indexable elements, and the property
 * that it is possible to provide a succinct proof (HashPath) that a given piece of data, exists at a certain index,
 * for a given merkle tree root.
 */
export class MerkleTree {
  private hasher = new Sha256Hasher();
  private root = Buffer.alloc(32);
  private leaves: Buffer[] = [];
  private treeObject: ITree = {};
  private zeroHashes: Buffer[] = [];
  // private nodeMap: Map<string, Buffer> = new Map();

  /**
   * Constructs a new MerkleTree instance, either initializing an empty tree, or restoring pre-existing state values.
   * Use the async static `new` function to construct.
   *
   * @param db Underlying leveldb.
   * @param name Name of the tree, to be used when restoring/persisting state.
   * @param depth The depth of the tree, to be no greater than MAX_DEPTH.
   * @param root When restoring, you need to provide the root.
   */
  constructor(
    private db: LevelUp,
    private name: string,
    private depth: number,
    root?: Buffer
  ) {
    if (!(depth >= 1 && depth <= MAX_DEPTH)) {
      throw Error("Bad depth");
    }

    // Implement.
    this.zeroHashes = this.createZeroHashes();

    if (root) {
      this.root = root;
    } else {
      // no leaves exist yet so simply set root as the root zero hash at the given depth.
      this.root = this.zeroHashes[this.depth];
    }
  }

  /**
   * Constructs or restores a new MerkleTree instance with the given `name` and `depth`.
   * The `db` contains the tree data.
   */
  static async new(db: LevelUp, name: string, depth = MAX_DEPTH) {
    const meta: Buffer = await db.get(Buffer.from(name)).catch(() => {});
    if (meta) {
      const root = meta.slice(0, 32);
      const depth = meta.readUInt32LE(32);
      return new MerkleTree(db, name, depth, root);
    } else {
      const tree = new MerkleTree(db, name, depth);
      await tree.writeMetaData();
      return tree;
    }
  }

  private async writeMetaData(batch?: LevelUpChain<string, Buffer>) {
    const data = Buffer.alloc(40);
    this.root.copy(data);
    data.writeUInt32LE(this.depth, 32);
    if (batch) {
      batch.put(this.name, data);
    } else {
      await this.db.put(this.name, data);
    }
  }

  private createZeroHashes(): Buffer[] {
    let currentHash = this.hasher.hash(Buffer.alloc(LEAF_BYTES, 0));
    const hashList = [currentHash];
    for (let i = 0; i < this.depth; i++) {
      currentHash = this.hasher.compress(currentHash, currentHash);
      hashList.push(currentHash);
    }

    return hashList;
  }

  /** Create dictionary of tree, where key is level and value is array of nodes. */
  private createTreeObject(): void {
    const tree: ITree = {};
    const leaves = this.leaves;

    for (let level = 0; level < this.depth; level++) {
      if (level === 0) {
        tree[level] = leaves.map((leaf) => this.hasher.hash(leaf));
      }
      const layerSize = tree[level].length;
      const nextLevel = level + 1;
      // assign empty array to next level
      tree[nextLevel] = [];
      for (let i = 0; i < layerSize; i += 2) {
        const left = tree[level][i];
        const right =
          i + 1 < layerSize ? tree[level][i + 1] : this.zeroHashes[level];
        const node = this.hasher.compress(left, right);
        tree[nextLevel].push(node);
      }
    }

    this.treeObject = tree;
    //console.log("tree", tree);
  }

  /** Updates leaves and rehashes the tree. */
  private async updateTree(index: number, value: Buffer): Promise<void> {
    this.leaves[index] = value;
    // recreate tree
    this.createTreeObject();
    this.root = this.treeObject[this.depth][0];
    // rewrite meta data
    await this.writeMetaData();
    await saveTreeSnapshot(this.db, this.treeObject);
  }

  // Public methods below.

  getRoot() {
    return this.root;
  }

  /**
   * Returns the hash path for `index`.
   * e.g. To return the HashPath for index 2, return the nodes marked `*` at each layer.
   *     d0:                                            [ root ]
   *     d1:                      [*]                                               [*]
   *     d2:         [*]                      [*]                       [ ]                     [ ]
   *     d3:   [ ]         [ ]          [*]         [*]           [ ]         [ ]          [ ]        [ ]
   */
  async getHashPath(index: number): Promise<HashPath> {
    if (!this.treeObject[0]) {
      this.treeObject = await restoreTree(this.db);
    }
    // Implement.
    let currentIndex = index;
    const siblings = [];
    for (let level = 0; level < this.depth; level++) {
      const node = this.treeObject[level][currentIndex];
      // if node is even, then sibling is to the right, else to the left.
      if (currentIndex % 2 === 0) {
        const sibling =
          this.treeObject[level][currentIndex + 1] || this.zeroHashes[level];
        siblings.push([node, sibling]);
      } else {
        siblings.push([this.treeObject[level][currentIndex - 1], node]);
      }
      currentIndex = Math.floor(currentIndex / 2);
    }

    const hashPath = new HashPath(siblings);
    return hashPath;
  }

  /**
   * Updates the tree with `value` at `index`. Returns the new tree root.
   */
  async updateElement(index: number, value: Buffer) {
    // Implement.
    await this.updateTree(index, value);
    return this.root;
  }
}

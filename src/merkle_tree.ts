import { LevelUp, LevelUpChain } from "levelup";
import { HashPath } from "./hash_path";
import { Sha256Hasher } from "./sha256_hasher";

interface ITree {
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
  private treeObject: ITree = {};
  private zeroHashes: Buffer[] = [];

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
    private leaves?: Buffer[],
    root?: Buffer
  ) {
    if (!(depth >= 1 && depth <= MAX_DEPTH)) {
      throw Error("Bad depth");
    }

    // Implement.
    if (root) {
      this.root = root;
    } else {
      this.zeroHashes = this.createZeroHashes();
      this.createTreeObject();
      this.root = this.treeObject[this.depth][0];
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

  private async setTreeFromSnapshot(): Promise<void> {
    const snap = await this.db.get("snapshot");
    this.treeObject = JSON.parse(snap);
  }

  private createZeroHashes(): Buffer[] {
    let currentHash = this.hasher.hash(Buffer.alloc(LEAF_BYTES, 0));
    const hashList = [currentHash];
    for (let i = 0; i < this.depth; i++) {
      currentHash = this.hasher.compress(currentHash, currentHash);
      hashList.push(currentHash);
    }

    console.log(hashList);
    return hashList;
  }

  // create dictionary of tree, where key is level and value is array of nodes
  private async createTreeObject(): Promise<void> {
    const tree: ITree = {};
    const leaves = this.leaves?.length ? this.leaves : [Buffer.alloc(0)];

    for (let level = 0; level < this.depth; level++) {
      if (level === 0) {
        tree[level] = leaves.map((leaf) => this.hasher.hash(leaf));
      }
      const layerSize = tree[level].length;
      tree[level + 1] = [];
      for (let i = 0; i < layerSize; i += 2) {
        const left = tree[level][i];
        const right = i + 1 < layerSize ? tree[level][i + 1] : Buffer.alloc(0);
        const node = this.hasher.compress(left, right);
        tree[level + 1].push(node);
      }
    }

    this.treeObject = tree;
    await this.db.put("snapshot", JSON.stringify(tree));
  }

  private reCreateTree(): void {
    this.createTreeObject();
    this.root = this.treeObject[this.depth][0];
  }

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
  async getHashPath(index: number) {
    // Implement.
    return new HashPath();
  }

  /**
   * Updates the tree with `value` at `index`. Returns the new tree root.
   */
  async updateElement(index: number, value: Buffer) {
    // Implement.
    this.leaves[index] = value;
    this.reCreateTree();
    return this.root;
  }
}

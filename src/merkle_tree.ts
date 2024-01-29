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
    root?: Buffer,
    leaves?: Buffer[]
  ) {
    if (!(depth >= 1 && depth <= MAX_DEPTH)) {
      throw Error("Bad depth");
    }

    // Implement.
    if (root) {
      this.root = root;
    } else {
      if (leaves?.length) {
        this.leaves = leaves;
      }
      this.zeroHashes = this.createZeroHashes();
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

  // create dictionary of tree, where key is level and value is array of nodes
  private async createTreeObject(): Promise<void> {
    const tree: ITree = {};
    const leaves = this.leaves.length ? this.leaves : this.zeroHashes;

    for (let level = 0; level < this.depth; level++) {
      if (level === 0) {
        tree[level] = leaves.map((leaf) => this.hasher.hash(leaf));
      }
      const layerSize = tree[level].length;
      tree[level + 1] = [];
      for (let i = 0; i < layerSize; i += 2) {
        const left = tree[level][i];
        const right =
          i + 1 < layerSize ? tree[level][i + 1] : this.zeroHashes[level];
        const node = this.hasher.compress(left, right);
        tree[level + 1].push(node);
      }
    }

    this.treeObject = tree;
    //console.log("tree", tree);
  }

  private async reCreateTree(): Promise<void> {
    this.createTreeObject();
    this.root = this.treeObject[this.depth][0];
    await this.writeMetaData();
  }

  // update leaf in the tree
  private async appendTreeObject(index: number, value: Buffer): Promise<void> {
    this.leaves[index] = value;
    await this.reCreateTree();
  }

  // sets hashed node in nodeMap
  /*   private appendNodeMap(index: number, value: Buffer): void {
    let currentIndex = index;
    let currentHash = this.hasher.hash(value);
    for (let level = this.depth; level > 0; level--) {
      this.setNode(level, currentIndex, currentHash);
      const altHash = this.zeroHashes[this.depth - level];
      if (index % 2 === 1) {
        const left = this.nodeMap.get(`${level}-${index - 1}`) || altHash;
        currentHash = this.hasher.compress(left, currentHash);
      } else {
        const right = this.nodeMap.get(`${level}-${index + 1}`) || altHash;
        currentHash = this.hasher.compress(currentHash, right);
      }
      currentIndex = Math.floor(currentIndex / 2);
    }
    this.setNode(0, 0, currentHash);
  }

  private setNode(level: number, index: number, value: Buffer): void {
    this.nodeMap.set(`${level}-${index}`, value);
  } */

  async getRootFromSnapshot(): Promise<Buffer> {
    const snapshot = await this.db.get(this.name);
    return snapshot;
  }

  getRoot() {
    // return this.nodeMap.get(`0-0`);
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
    await this.appendTreeObject(index, value);
    // this.appendNodeMap(index, value);
    return this.root;
  }
}

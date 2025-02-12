export const bufferReviver = (
  _: string,
  v: { type: string; data: Array<Buffer> }
) => {
  if (
    v !== null &&
    typeof v === "object" &&
    "type" in v &&
    v.type === "Buffer" &&
    "data" in v &&
    Array.isArray(v.data)
  ) {
    return Buffer.from(v.data);
  }
  return v;
};

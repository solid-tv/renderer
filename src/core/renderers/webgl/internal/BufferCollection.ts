import type { AttributeInfo } from './ShaderUtils.js';

export interface BufferItem {
  buffer: WebGLBuffer;
  attributes: Record<string, AttributeInfo>;
}

/**
 * Represents a collection of WebGL Buffers along with their associated
 * vertex attribute formats.
 */
export class BufferCollection {
  private _lookup = new Map<string, BufferItem>();

  constructor(readonly config: BufferItem[]) {
    for (const item of config) {
      for (const attrName in item.attributes) {
        // We only care about attributes that are actually defined (truthy)
        // and we want the first one found in the config array order
        if (item.attributes[attrName] && !this._lookup.has(attrName)) {
          this._lookup.set(attrName, item);
        }
      }
    }
  }

  /**
   * Get the WebGLBuffer associated with the given attribute name if it exists.
   *
   * @param attributeName
   * @returns
   */
  getBuffer(attributeName: string): WebGLBuffer | undefined {
    return this._lookup.get(attributeName)?.buffer;
  }

  /**
   * Get the AttributeInfo associated with the given attribute name if it exists.
   *
   * @param attributeName
   * @returns
   */
  getAttributeInfo(attributeName: string): AttributeInfo | undefined {
    return this._lookup.get(attributeName)?.attributes[attributeName];
  }
}

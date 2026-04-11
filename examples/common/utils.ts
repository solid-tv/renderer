import type {
  Dimensions,
  NodeTextLoadedPayload,
  INode,
  ITextNode,
  RendererMain,
} from '@lightningjs/renderer';

export async function waitForLoadedDimensions(
  node: INode | ITextNode,
): Promise<Dimensions> {
  return new Promise((resolve) => {
    node.once('loaded', (_node: INode, payload: NodeTextLoadedPayload) => {
      const { w, h } = payload.dimensions;
      resolve({
        w,
        h,
      });
    });
  });
}

export async function waitUntilIdle(renderer: RendererMain): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (renderer === undefined) {
      reject(false);
      return;
    }
    const done = () => {
      renderer.off('idle', onRendererIdle);
    };

    const onRendererIdle = () => {
      done();
      resolve(true);
    };

    renderer.on('idle', onRendererIdle);
  });
}

import {
  Module,
  Export,
  findModuleByExport,
  fakeRenderComponent,
  createModuleMapping,
  modules,
} from '@decky/ui';

type AdaptiveNavGlyphProps = {
  button: number;
  bAllowKeyboard?: boolean;
  bKnockout?: boolean;
  className?: string;
};

// Vite builds of Steam have no glyph module: try the memo components that Steam renders with a button prop, most used first
const viteGlyphCandidates = (viteScope: Module) => {
  const counts = new Map<string, number>();
  for (const e of Object.values(viteScope)) {
    if (typeof e !== 'function') continue;
    for (const match of e.toString().matchAll(/\(0,[\w$]+\.jsxs?\)\(([\w$]+),\{button:/g)) {
      counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1]).map(([name]) => viteScope[name]);
};

let glyphModules = modules.get('vite')
  ? viteGlyphCandidates(modules.get('vite'))
  : findModuleByExport((e) => typeof e === 'function' && e.toString().includes('GamepadUI_KeyboardNavGlyphsDisabled'));
if (!glyphModules) {
  // filter down to modules that only have 2 exports that are memoized components
  // super unstable but all this will never run once steam switches thge current beta to stable
  const glyphModulesOld = createModuleMapping((mod) => {
    if (!mod || typeof mod !== 'object') return false;

    const exports = Object.values(mod);

    return exports.length === 2 &&
    exports.every((e: Export) =>
      e?.$$typeof === Symbol.for('react.memo') &&
      typeof e.type === 'function'
    );
  }).values();

  glyphModules = Array.from(glyphModulesOld).flatMap((mod) => Object.values(mod));
}

const AdaptiveNavGlyph = Object.values(glyphModules).find((mod: Module) => {
  if (typeof mod?.type !== 'function') return false;

  try {
    return fakeRenderComponent(() => {
      const rendered = mod.type({
        button: 2,
        bAllowKeyboard: false,
      });
      const props = rendered?.props;
      return props != null &&
            'controllerType' in props &&
            'controllerStyle' in props &&
            'controllerSource' in props &&
            'controllerModeInput' in props;
    }, { useSyncExternalStore: (_: any, x: () => any) => x?.() });
  } catch {
    return false;
  }
}) as React.ComponentType<AdaptiveNavGlyphProps>;

export default AdaptiveNavGlyph;

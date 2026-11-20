import { Renderer, createHtmlSession as createHtmlSession$1, renderToAnsi as renderToAnsi$1, renderToHtml as renderToHtml$1 } from "./core.js";
import wasmBytes from "./words-no-math.wasm.mjs";
//#region lib/no-math.ts
const state = { renderer: new Renderer(new WebAssembly.Module(wasmBytes)) };
const init = (module) => state.renderer = new Renderer(module);
const renderToHtml = ((input, options) => renderToHtml$1(state, input, options));
const renderToAnsi = (input, options) => renderToAnsi$1(state, input, options);
/**
* Render a growing string to HTML. A session keeps completed HTML and reparses
* only the unfinished end.
*/
const createHtmlSession = () => createHtmlSession$1(state);
//#endregion
export { createHtmlSession, init, renderToAnsi, renderToHtml };


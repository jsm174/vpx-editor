import templateHtml from './template.html?raw';

export {
  parseScriptFunctions,
  generateEventHandler,
  findEventHandler,
  getEventsForItemType,
  ITEM_EVENTS,
  type ParsedFunction,
  type ScriptGameItem,
} from '../shared/core';

export { registerVbsCompletionProvider, parseScriptVariables, type ParsedVariable } from '../shared/vbs-api';

let templateInjected = false;

export function injectScriptEditorTemplate(): void {
  if (templateInjected) return;
  const container = document.createElement('div');
  container.innerHTML = templateHtml;
  while (container.firstChild) {
    document.body.appendChild(container.firstChild);
  }
  templateInjected = true;
}

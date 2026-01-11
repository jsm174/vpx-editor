import {
  handleLockTable,
  handleSave,
  handleSaveAs,
  handleClose,
  openFilePicker,
  loadTemplate,
  isTableLoaded,
} from './vpx-file-operations';
import { getEvents } from './state';

export interface MenuActionContext {
  isBackglassMode: () => boolean;
  showBlueprintModal: () => void;
}

export function createMenuActionHandler(context: MenuActionContext) {
  const events = getEvents();

  return function handleMenuAction(action: string, arg?: string): void {
    switch (action) {
      case 'new-table':
        if (arg) {
          const templateMap: Record<string, string> = {
            'blankTable.vpx': 'new-table',
            'strippedTable.vpx': 'new-blank',
            'exampleTable.vpx': 'new-example',
            'lightSeqTable.vpx': 'new-lightseq',
          };
          loadTemplate(templateMap[arg] || 'new-table');
        }
        break;
      case 'open':
        if (!isTableLoaded()) {
          openFilePicker();
        }
        break;
      case 'close':
        handleClose();
        break;
      case 'save':
        handleSave();
        break;
      case 'save-as':
        handleSaveAs();
        break;
      case 'export-blueprint':
        context.showBlueprintModal();
        break;
      case 'undo':
        events.emit('undo');
        break;
      case 'redo':
        events.emit('redo');
        break;
      case 'toggle-lock':
        events.emit('toggle-lock');
        break;
      case 'copy':
        events.emit('copy');
        break;
      case 'paste':
        events.emit('paste');
        break;
      case 'paste-at':
        events.emit('paste-at-original');
        break;
      case 'delete':
        events.emit('delete-selected');
        break;
      case 'select-element':
        events.emit('show-select-element');
        break;
      case 'drawing-order':
        events.emit('show-drawing-order', arg || 'hit');
        break;
      case 'set-view-solid':
        events.emit('view-settings-changed', { solid: true, outline: false });
        break;
      case 'set-view-outline':
        events.emit('view-settings-changed', { solid: false, outline: true });
        break;
      case 'toggle-grid':
        events.emit('toggle-grid');
        break;
      case 'toggle-backdrop':
        events.emit('toggle-backdrop');
        break;
      case 'open-script-editor':
        events.emit('toggle-script-editor');
        break;
      case 'toggle-backglass':
        events.emit('toggle-backglass-view', !context.isBackglassMode());
        break;
      case 'insert-item':
        if (arg) {
          events.emit('insert-item', arg);
        }
        break;
      case 'play':
        alert('Play is not available in the web version of VPX Editor.');
        break;
      case 'open-table-info':
        events.emit('show-table-info');
        break;
      case 'open-sound-manager':
        events.emit('show-sound-manager');
        break;
      case 'open-image-manager':
        events.emit('show-image-manager');
        break;
      case 'open-material-manager':
        events.emit('show-material-manager');
        break;
      case 'open-dimensions-manager':
        events.emit('show-dimensions');
        break;
      case 'open-collection-manager':
        events.emit('show-collection-manager');
        break;
      case 'open-render-probe-manager':
        events.emit('show-render-probe-manager');
        break;
      case 'toggle-table-lock':
        handleLockTable();
        break;
      case 'toggle-magnify':
        events.emit('toggle-magnify');
        break;
      case 'open-settings':
        events.emit('show-settings');
        break;
      case 'open-about':
        events.emit('show-about');
        break;
      case 'toggle-console':
        events.emit('toggle-console');
        break;
    }
  };
}

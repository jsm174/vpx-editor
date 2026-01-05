import { setupThemeListener, setupKeyboardShortcuts } from '../../shared/window-utils.js';
import type { WorkFolderConfig } from '../../types/ipc.js';

let config: WorkFolderConfig = { type: 'exists' };

setupThemeListener();

window.vpxEditor.onInitWorkFolder?.(data => {
  config = data;

  const title = document.getElementById('wf-title') as HTMLElement;
  const message = document.getElementById('wf-message') as HTMLElement;
  const footer = document.getElementById('wf-footer') as HTMLElement;

  message.textContent = config.message || '';
  footer.innerHTML = '';

  if (config.type === 'resume') {
    title.textContent = 'Previous Session Found';

    const extractBtn = document.createElement('button');
    extractBtn.className = 'win-btn';
    extractBtn.textContent = 'Re-extract';
    extractBtn.addEventListener('click', () => {
      window.vpxEditor.workFolderResult('extract');
    });

    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'win-btn primary';
    resumeBtn.textContent = 'Resume';
    resumeBtn.addEventListener('click', () => {
      window.vpxEditor.workFolderResult('resume');
    });

    footer.appendChild(extractBtn);
    footer.appendChild(resumeBtn);
  } else {
    title.textContent = 'Work Folder Exists';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'win-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      window.vpxEditor.workFolderResult('cancel');
    });

    const extractBtn = document.createElement('button');
    extractBtn.className = 'win-btn';
    extractBtn.textContent = 'Re-extract';
    extractBtn.addEventListener('click', () => {
      window.vpxEditor.workFolderResult('extract');
    });

    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'win-btn primary';
    resumeBtn.textContent = 'Use Work Folder';
    resumeBtn.addEventListener('click', () => {
      window.vpxEditor.workFolderResult('resume');
    });

    footer.appendChild(cancelBtn);
    footer.appendChild(extractBtn);
    footer.appendChild(resumeBtn);
  }
});

setupKeyboardShortcuts({
  onEscape: (): void => {
    if (config.type === 'resume') {
      window.vpxEditor.workFolderResult('extract');
    } else {
      window.vpxEditor.workFolderResult('cancel');
    }
  },
});

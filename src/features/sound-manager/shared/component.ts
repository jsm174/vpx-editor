import {
  SOUND_EXTENSIONS,
  SOUND_MIME_TYPES,
  sortSounds,
  formatDuration,
  formatFileSize,
  volumeToGain,
  getWavInfo,
  type SoundData,
} from './core';

export interface SoundManagerCallbacks {
  readFile: (path: string) => Promise<string>;
  readBinaryFile: (path: string) => Promise<Uint8Array>;
  writeBinaryFile: (path: string, data: Uint8Array) => Promise<void>;
  writeFile: (path: string, content: string) => Promise<void>;
  listDir?: (path: string) => Promise<string[]>;
  renameFile?: (oldPath: string, newPath: string) => Promise<void>;
  deleteFile?: (path: string) => Promise<void>;
  getSoundInfo?: (path: string) => Promise<{
    success: boolean;
    format?: string;
    sampleRate?: number;
    channels?: number;
    duration?: number;
    size?: number;
  }>;
  showConfirm?: (message: string) => Promise<boolean>;
  importSound?: () => Promise<{ success: boolean; name?: string; originalPath?: string }>;
  exportSound?: (srcPath: string, fileName: string) => Promise<void>;
  onSoundsChanged?: () => void;
  openRenamePrompt?: (currentName: string, existingNames: string[]) => void;
  undoBegin?: (description: string) => void;
  undoEnd?: () => void;
  undoMarkSounds?: () => void;
  undoMarkSoundCreate?: (soundName: string) => void;
  undoMarkSoundDelete?: (soundName: string, soundData: unknown, filePath: string) => void;
}

export async function loadSoundManagerData(
  extractedDir: string,
  callbacks: Pick<SoundManagerCallbacks, 'readFile'>
): Promise<{ sounds: SoundData[] }> {
  let sounds: SoundData[] = [];

  try {
    const soundsJson = await callbacks.readFile(`${extractedDir}/sounds.json`);
    sounds = JSON.parse(soundsJson) || [];
  } catch {
    /* empty */
  }

  return { sounds };
}

export interface SoundManagerData {
  extractedDir: string;
  sounds: SoundData[];
  theme?: string;
}

export interface SoundManagerElements {
  listBody: HTMLElement;
  filterInput: HTMLInputElement;
  statusEl: HTMLElement;
  importBtn?: HTMLElement;
  propertiesContainer?: HTMLElement;
  emptyState?: HTMLElement;
  contextMenu?: HTMLElement;
  renameOverlay?: HTMLElement;
  renameInput?: HTMLInputElement;
  renameError?: HTMLElement;
  renameOkBtn?: HTMLElement;
  renameCancelBtn?: HTMLElement;
}

export interface SoundManagerInstance {
  renderList: (filter?: string) => Promise<void>;
  selectSound: (sound: SoundData, row: HTMLElement) => Promise<void>;
  selectSoundByName: (name: string) => Promise<void>;
  playSound: (name?: string) => Promise<void>;
  stopSound: () => void;
  importSounds: (files: FileList) => Promise<void>;
  importSoundNative: () => Promise<void>;
  renameSound: () => Promise<void>;
  performRename: (oldName: string, newName: string) => Promise<void>;
  deleteSound: () => Promise<void>;
  exportSound: () => Promise<void>;
  toggleOutput: () => Promise<void>;
  getSelectedSound: () => SoundData | null;
  setSelectedSound: (sound: SoundData | null) => void;
  getSounds: () => SoundData[];
  setSounds: (newSounds: SoundData[]) => void;
  setData: (data: SoundManagerData) => void;
  setUIDisabled: (disabled: boolean) => void;
  destroy: () => void;
}

interface SoundInfoCacheEntry {
  format: string;
  sampleRate?: number;
  channels?: number;
  duration?: number;
  size?: number;
  data?: Uint8Array;
  ext?: string;
}

export function initSoundManagerComponent(
  elements: SoundManagerElements,
  callbacks: SoundManagerCallbacks,
  initialData?: SoundManagerData
): SoundManagerInstance {
  let sounds: SoundData[] = initialData?.sounds || [];
  let extractedDir = initialData?.extractedDir || '';
  let selectedSound: SoundData | null = null;
  let sortColumn = 'name';
  let sortDirection: 'asc' | 'desc' = 'asc';
  let currentAudio: HTMLAudioElement | null = null;
  const soundInfoCache: Record<string, SoundInfoCacheEntry> = {};

  const {
    listBody,
    filterInput,
    statusEl,
    propertiesContainer,
    emptyState,
    contextMenu,
    renameOverlay,
    renameInput,
    renameError,
    renameOkBtn,
    renameCancelBtn,
  } = elements;

  function setStatus(msg: string): void {
    statusEl.textContent = msg;
  }

  async function findSoundFile(soundName: string): Promise<string | null> {
    if (callbacks.listDir) {
      const files = await callbacks.listDir(`${extractedDir}/sounds`);
      return files.find(f => f.startsWith(soundName + '.')) || null;
    }
    for (const ext of SOUND_EXTENSIONS) {
      try {
        await callbacks.readBinaryFile(`${extractedDir}/sounds/${soundName}${ext}`);
        return `${soundName}${ext}`;
      } catch {
        continue;
      }
    }
    return null;
  }

  async function getSoundInfo(soundName: string): Promise<SoundInfoCacheEntry | null> {
    if (soundInfoCache[soundName]) return soundInfoCache[soundName];

    const soundFile = await findSoundFile(soundName);
    if (!soundFile) return null;

    const soundPath = `${extractedDir}/sounds/${soundFile}`;
    const ext = '.' + soundFile.split('.').pop()?.toLowerCase();

    if (callbacks.getSoundInfo) {
      const result = await callbacks.getSoundInfo(soundPath);
      if (result.success) {
        const info: SoundInfoCacheEntry = {
          format: result.format || ext.slice(1).toUpperCase(),
          sampleRate: result.sampleRate,
          channels: result.channels,
          duration: result.duration,
          size: result.size,
          ext,
        };
        soundInfoCache[soundName] = info;
        return info;
      }
    }

    try {
      const data = await callbacks.readBinaryFile(soundPath);
      const info: SoundInfoCacheEntry = {
        format: ext.slice(1).toUpperCase(),
        size: data.length,
        data,
        ext,
      };
      if (ext === '.wav') {
        const wavInfo = getWavInfo(data);
        if (wavInfo) {
          info.sampleRate = wavInfo.sampleRate;
          info.channels = wavInfo.channels;
          info.duration = wavInfo.duration;
        }
      }
      soundInfoCache[soundName] = info;
      return info;
    } catch {
      return null;
    }
  }

  async function renderList(filter = ''): Promise<void> {
    const filterLower = filter.toLowerCase();
    let filtered = sounds;
    if (filterLower) {
      filtered = sounds.filter(s => s.name.toLowerCase().includes(filterLower));
    }

    const sorted = sortSounds(filtered, sortColumn, sortDirection);

    await Promise.all(sorted.map(sound => getSoundInfo(sound.name)));

    listBody.innerHTML = '';
    for (const sound of sorted) {
      const tr = document.createElement('tr');
      tr.dataset.name = sound.name;
      if (selectedSound?.name === sound.name) tr.classList.add('selected');

      const nameTd = document.createElement('td');
      nameTd.textContent = sound.name;

      const outputTd = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `output-badge ${sound.output_target === 'backglass' ? 'backglass' : 'table'}`;
      const info = soundInfoCache[sound.name];
      const isStereo = info && info.channels && info.channels > 1;
      if (sound.output_target === 'backglass') {
        badge.textContent = 'BG';
      } else {
        badge.textContent = isStereo ? '** Table **' : 'Table';
      }
      outputTd.appendChild(badge);

      const balanceTd = document.createElement('td');
      balanceTd.textContent = String(sound.balance ?? 0);

      const fadeTd = document.createElement('td');
      fadeTd.textContent = String(sound.fade ?? 0);

      const volumeTd = document.createElement('td');
      volumeTd.textContent = String(sound.volume ?? 0);

      tr.append(nameTd, outputTd, balanceTd, fadeTd, volumeTd);
      tr.addEventListener('click', () => selectSound(sound, tr));
      tr.addEventListener('dblclick', () => playSound(sound.name));
      if (contextMenu) {
        tr.addEventListener('contextmenu', e => {
          selectSound(sound, tr);
          showContextMenu(e);
        });
      }
      listBody.appendChild(tr);
    }
  }

  async function selectSound(sound: SoundData, row: HTMLElement): Promise<void> {
    selectedSound = sound;
    listBody.querySelectorAll('tr').forEach(tr => tr.classList.remove('selected'));
    row.classList.add('selected');

    if (propertiesContainer) {
      await renderProperties(sound);
    }
  }

  async function selectSoundByName(name: string): Promise<void> {
    const sound = sounds.find(s => s.name === name);
    if (!sound) return;

    const row = listBody.querySelector(`tr[data-name="${name}"]`) as HTMLElement;
    if (row) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await selectSound(sound, row);
    }
  }

  async function renderProperties(sound: SoundData): Promise<void> {
    if (!propertiesContainer) return;

    if (emptyState) emptyState.style.display = 'none';
    propertiesContainer.style.display = 'block';

    const info = (await getSoundInfo(sound.name)) || {
      format: '?',
      sampleRate: 0,
      channels: 0,
      duration: 0,
      size: 0,
    };

    propertiesContainer.innerHTML = `
      <div class="prop-group">
        <div class="prop-group-title">Sound</div>
        <div class="prop-row">
          <label class="prop-label">Name</label>
          <input type="text" class="prop-input" value="${sound.name}" readonly style="background: transparent; border-color: transparent;">
        </div>
        <div class="prop-row">
          <label class="prop-label">Output</label>
          <select class="prop-select" data-prop="output_target">
            <option value="table" ${sound.output_target === 'table' || !sound.output_target ? 'selected' : ''}>Table</option>
            <option value="backglass" ${sound.output_target === 'backglass' ? 'selected' : ''}>Backglass</option>
          </select>
        </div>
        <div class="prop-row" style="margin-top: 8px; gap: 8px;">
          <button class="prop-btn" id="prop-play-btn">Play</button>
          <button class="prop-btn" id="prop-stop-btn">Stop</button>
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Position / Volume</div>
        <div class="prop-row">
          <label class="prop-label">Balance</label>
          <input type="number" class="prop-input" data-prop="balance" data-type="int" value="${sound.balance ?? 0}" step="1" min="-100" max="100">
        </div>
        <div class="prop-row">
          <label class="prop-label">Fade</label>
          <input type="number" class="prop-input" data-prop="fade" data-type="int" value="${sound.fade ?? 0}" step="1" min="-100" max="100">
        </div>
        <div class="prop-row">
          <label class="prop-label">Volume</label>
          <input type="number" class="prop-input" data-prop="volume" data-type="int" value="${sound.volume ?? 0}" step="1" min="-100" max="100">
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Audio Info</div>
        <div class="prop-row">
          <label class="prop-label">Format</label>
          <span style="font-size: 12px;">${info.format}</span>
        </div>
        <div class="prop-row">
          <label class="prop-label">Sample Rate</label>
          <span style="font-size: 12px;">${info.sampleRate ? info.sampleRate + ' Hz' : '-'}</span>
        </div>
        <div class="prop-row">
          <label class="prop-label">Channels</label>
          <span style="font-size: 12px;">${info.channels ? (info.channels === 1 ? 'Mono' : info.channels === 2 ? 'Stereo' : String(info.channels)) : '-'}</span>
        </div>
        <div class="prop-row">
          <label class="prop-label">Duration</label>
          <span style="font-size: 12px;">${info.duration ? formatDuration(info.duration) : '-'}</span>
        </div>
        <div class="prop-row">
          <label class="prop-label">Size</label>
          <span style="font-size: 12px;">${info.size ? formatFileSize(info.size) : '-'}</span>
        </div>
      </div>

      <div class="prop-group">
        <div class="prop-group-title">Import Path</div>
        <div style="font-size: 11px; color: var(--text-secondary); word-break: break-all;">
          ${sound.path || 'Unknown'}
        </div>
      </div>
    `;

    propertiesContainer.querySelector('#prop-play-btn')?.addEventListener('click', () => playSound());
    propertiesContainer.querySelector('#prop-stop-btn')?.addEventListener('click', () => stopSound());

    propertiesContainer.querySelectorAll('.prop-input, .prop-select').forEach(input => {
      input.addEventListener('change', async e => {
        const target = e.target as HTMLInputElement | HTMLSelectElement;
        const prop = target.dataset.prop;
        if (!prop) return;

        let value: string | number;
        if (target.tagName === 'SELECT') {
          value = target.value;
        } else {
          value = parseInt(target.value, 10);
        }

        (sound as unknown as Record<string, unknown>)[prop] = value;
        await saveSounds();
        await renderList(filterInput.value);
        await selectSoundByName(sound.name);
        setStatus(`Updated ${sound.name}.${prop}`);
        callbacks.onSoundsChanged?.();
      });
    });
  }

  async function playSound(name?: string): Promise<void> {
    const soundName = name || selectedSound?.name;
    if (!soundName) return;

    stopSound();

    const snd = sounds.find(s => s.name === soundName);
    if (!snd) return;

    const soundFile = await findSoundFile(soundName);
    if (!soundFile) {
      setStatus(`Sound file not found: ${soundName}`);
      return;
    }

    try {
      const soundPath = `${extractedDir}/sounds/${soundFile}`;
      const data = await callbacks.readBinaryFile(soundPath);

      const ext = '.' + soundFile.split('.').pop()?.toLowerCase();
      const mime = SOUND_MIME_TYPES[ext];
      if (!mime) return;

      const blob = new Blob([new Uint8Array(data)], { type: mime });
      const url = URL.createObjectURL(blob);
      currentAudio = new Audio(url);
      currentAudio.volume = volumeToGain(snd.volume || 0);
      currentAudio.onended = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        setStatus('Ready');
      };
      currentAudio.play();
      setStatus(`Playing: ${soundName}`);
    } catch (err) {
      setStatus(`Error playing: ${err}`);
    }
  }

  function stopSound(): void {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
      setStatus('Ready');
    }
  }

  async function saveSounds(): Promise<void> {
    await callbacks.writeFile(`${extractedDir}/sounds.json`, JSON.stringify(sounds, null, 2));
  }

  async function importSounds(files: FileList): Promise<void> {
    let imported = 0;
    let lastName: string | null = null;
    const importedNames: string[] = [];

    callbacks.undoBegin?.(`Import ${files.length} sound(s)`);
    callbacks.undoMarkSounds?.();

    for (const file of Array.from(files)) {
      const name = file.name.replace(/\.[^.]+$/, '');
      const ext = file.name.match(/\.[^.]+$/)?.[0]?.toLowerCase() || '.wav';

      const existingSound = sounds.find(s => s.name === name);
      if (existingSound) {
        setStatus(`Sound "${name}" already exists, skipping...`);
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const soundPath = `${extractedDir}/sounds/${name}${ext}`;
        await callbacks.writeBinaryFile(soundPath, data);

        sounds.push({
          name,
          path: file.name,
          fade: 0,
          volume: 0,
          balance: 0,
          output_target: 'table',
        });
        lastName = name;
        imported++;
        importedNames.push(name);
      } catch (err) {
        setStatus(`Failed to import ${file.name}: ${err}`);
      }
    }

    if (imported > 0) {
      for (const name of importedNames) {
        callbacks.undoMarkSoundCreate?.(name);
      }

      await saveSounds();

      const lastSound = lastName ? sounds.find(s => s.name === lastName) : null;
      if (lastSound) selectedSound = lastSound;

      filterInput.value = '';
      await renderList('');
      setStatus(`Imported ${imported} sound(s)`);

      callbacks.onSoundsChanged?.();

      if (lastName) {
        await selectSoundByName(lastName);
      }
    }

    callbacks.undoEnd?.();
  }

  async function importSoundNative(): Promise<void> {
    if (!callbacks.importSound) return;

    const result = await callbacks.importSound();
    if (!result || !result.success || !result.name) return;

    callbacks.undoBegin?.(`Import sound: ${result.name}`);
    callbacks.undoMarkSounds?.();

    const existingIndex = sounds.findIndex(s => s.name === result.name);
    if (existingIndex >= 0) {
      sounds[existingIndex].path = result.originalPath || '';
    } else {
      sounds.push({
        name: result.name,
        path: result.originalPath || '',
        fade: 0,
        volume: 0,
        balance: 0,
        output_target: 'table',
      });
      callbacks.undoMarkSoundCreate?.(result.name);
    }

    await saveSounds();
    selectedSound = sounds.find(s => s.name === result.name) || null;
    await renderList(filterInput.value);
    await selectSoundByName(result.name);
    setStatus(`Imported: ${result.name}`);
    callbacks.onSoundsChanged?.();

    callbacks.undoEnd?.();
  }

  let renameCurrentName = '';

  function validateRename(): boolean {
    if (!renameInput || !renameOkBtn) return false;
    const newName = renameInput.value.trim();
    const okBtn = renameOkBtn as HTMLButtonElement;

    if (!newName) {
      okBtn.disabled = true;
      if (renameError) renameError.textContent = 'Name cannot be empty';
      return false;
    }

    if (newName === renameCurrentName) {
      okBtn.disabled = true;
      if (renameError) renameError.textContent = '';
      return false;
    }

    const exists = sounds.some(s => s.name === newName);
    if (exists) {
      okBtn.disabled = true;
      if (renameError) renameError.textContent = 'Sound already exists';
      return false;
    }

    okBtn.disabled = false;
    if (renameError) renameError.textContent = '';
    return true;
  }

  function openRenameDialog(): void {
    if (!selectedSound || !renameOverlay || !renameInput) return;
    renameCurrentName = selectedSound.name;
    renameInput.value = selectedSound.name;
    if (renameError) renameError.textContent = '';
    renameOverlay.classList.remove('hidden');
    renameInput.focus();
    renameInput.select();
    validateRename();
  }

  function closeRenameDialog(): void {
    if (renameOverlay) renameOverlay.classList.add('hidden');
  }

  async function executeRename(): Promise<void> {
    if (!selectedSound || !renameInput || !validateRename()) return;

    const newName = renameInput.value.trim();
    const oldName = selectedSound.name;
    const soundFile = await findSoundFile(oldName);

    if (soundFile && callbacks.renameFile) {
      const ext = soundFile.split('.').pop();
      const oldPath = `${extractedDir}/sounds/${soundFile}`;
      const newPath = `${extractedDir}/sounds/${newName}.${ext}`;
      await callbacks.renameFile(oldPath, newPath);
    }

    selectedSound.name = newName;
    delete soundInfoCache[oldName];
    await saveSounds();
    closeRenameDialog();
    await renderList(filterInput.value);
    await selectSoundByName(newName);
    setStatus(`Renamed to: ${newName}`);
    callbacks.onSoundsChanged?.();
  }

  async function renameSound(): Promise<void> {
    if (!selectedSound) return;
    if (callbacks.openRenamePrompt) {
      callbacks.openRenamePrompt(
        selectedSound.name,
        sounds.map(s => s.name)
      );
    } else {
      openRenameDialog();
    }
  }

  async function performRename(oldName: string, newName: string): Promise<void> {
    if (!oldName || !newName || oldName === newName) return;

    const sound = sounds.find(s => s.name === oldName);
    if (!sound) return;

    if (sounds.some(s => s.name === newName)) {
      setStatus(`Sound "${newName}" already exists`);
      return;
    }

    callbacks.undoBegin?.(`Rename sound: ${oldName} → ${newName}`);
    callbacks.undoMarkSounds?.();

    const soundFile = await findSoundFile(oldName);
    if (soundFile && callbacks.renameFile) {
      const ext = soundFile.split('.').pop();
      const oldPath = `${extractedDir}/sounds/${soundFile}`;
      const newPath = `${extractedDir}/sounds/${newName}.${ext}`;
      await callbacks.renameFile(oldPath, newPath);
    }

    sound.name = newName;
    delete soundInfoCache[oldName];
    await saveSounds();
    await renderList(filterInput.value);
    await selectSoundByName(newName);
    setStatus(`Renamed to: ${newName}`);
    callbacks.onSoundsChanged?.();

    callbacks.undoEnd?.();
  }

  async function deleteSound(): Promise<void> {
    if (!selectedSound) return;

    if (callbacks.showConfirm) {
      const confirmed = await callbacks.showConfirm(`Delete sound "${selectedSound.name}"?`);
      if (!confirmed) return;
    }

    callbacks.undoBegin?.(`Delete sound: ${selectedSound.name}`);

    const soundFile = await findSoundFile(selectedSound.name);
    const filePath = soundFile ? `sounds/${soundFile}` : '';
    const soundData = JSON.parse(JSON.stringify(selectedSound));
    callbacks.undoMarkSoundDelete?.(selectedSound.name, soundData, filePath);

    if (soundFile && callbacks.deleteFile) {
      await callbacks.deleteFile(`${extractedDir}/sounds/${soundFile}`);
    }

    const deletedName = selectedSound.name;
    sounds = sounds.filter(s => s.name !== deletedName);
    delete soundInfoCache[deletedName];
    await saveSounds();

    selectedSound = null;
    if (emptyState) emptyState.style.display = 'block';
    if (propertiesContainer) propertiesContainer.style.display = 'none';

    await renderList(filterInput.value);
    setStatus(`Deleted: ${deletedName}`);
    callbacks.onSoundsChanged?.();

    callbacks.undoEnd?.();
  }

  async function exportSound(): Promise<void> {
    if (!selectedSound || !callbacks.exportSound) return;

    const soundFile = await findSoundFile(selectedSound.name);
    if (!soundFile) {
      setStatus(`Sound file not found: ${selectedSound.name}`);
      return;
    }

    const srcPath = `${extractedDir}/sounds/${soundFile}`;
    await callbacks.exportSound(srcPath, soundFile);
    setStatus(`Exported: ${selectedSound.name}`);
  }

  async function toggleOutput(): Promise<void> {
    if (!selectedSound) return;

    selectedSound.output_target = selectedSound.output_target === 'backglass' ? 'table' : 'backglass';
    await saveSounds();
    await renderList(filterInput.value);
    await selectSoundByName(selectedSound.name);
    setStatus(`${selectedSound.name} output: ${selectedSound.output_target}`);
    callbacks.onSoundsChanged?.();
  }

  function setUIDisabled(disabled: boolean): void {
    if (elements.importBtn instanceof HTMLButtonElement) elements.importBtn.disabled = disabled;
    if (filterInput instanceof HTMLInputElement) filterInput.disabled = disabled;
  }

  function showContextMenu(e: MouseEvent): void {
    if (!contextMenu) return;
    e.preventDefault();
    contextMenu.classList.remove('hidden');
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;
  }

  function hideContextMenu(): void {
    if (!contextMenu) return;
    contextMenu.classList.add('hidden');
  }

  function handleContextMenuClick(e: Event): void {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    if (!action) return;
    hideContextMenu();
    switch (action) {
      case 'play':
        playSound();
        break;
      case 'stop':
        stopSound();
        break;
      case 'rename':
        renameSound();
        break;
      case 'export':
        exportSound();
        break;
      case 'toggle-output':
        toggleOutput();
        break;
      case 'delete':
        deleteSound();
        break;
    }
  }

  function handleDocumentClick(e: MouseEvent): void {
    if (contextMenu && !(e.target as HTMLElement).closest('.context-menu')) {
      hideContextMenu();
    }
  }

  function handleDocumentKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') hideContextMenu();
  }

  if (contextMenu) {
    contextMenu.addEventListener('click', handleContextMenuClick);
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleDocumentKeydown);
  }

  function setupSortHeaders(): void {
    const headerRow = listBody.closest('table')?.querySelector('thead tr');
    if (!headerRow) return;

    headerRow.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = (th as HTMLElement).dataset.sort!;
        if (sortColumn === col) {
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          sortColumn = col;
          sortDirection = 'asc';
        }
        headerRow.querySelectorAll('th').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
        th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
        renderList(filterInput.value);
      });
    });
  }

  setupSortHeaders();

  filterInput.addEventListener('input', () => {
    renderList(filterInput.value);
  });

  if (renameInput) {
    renameInput.addEventListener('input', validateRename);
    renameInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') executeRename();
      else if (e.key === 'Escape') closeRenameDialog();
    });
  }
  if (renameOkBtn) renameOkBtn.addEventListener('click', executeRename);
  if (renameCancelBtn) renameCancelBtn.addEventListener('click', closeRenameDialog);

  function setData(data: SoundManagerData): void {
    extractedDir = data.extractedDir;
    sounds = data.sounds || [];
    Object.keys(soundInfoCache).forEach(key => delete soundInfoCache[key]);
  }

  function destroy(): void {
    stopSound();
    if (contextMenu) {
      contextMenu.removeEventListener('click', handleContextMenuClick);
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('keydown', handleDocumentKeydown);
    }
  }

  return {
    renderList,
    selectSound,
    selectSoundByName,
    playSound,
    stopSound,
    importSounds,
    importSoundNative,
    renameSound,
    performRename,
    deleteSound,
    exportSound,
    toggleOutput,
    getSelectedSound: () => selectedSound,
    setSelectedSound: (sound: SoundData | null) => {
      selectedSound = sound;
    },
    getSounds: () => sounds,
    setSounds: (newSounds: SoundData[]) => {
      sounds = newSounds;
    },
    setData,
    setUIDisabled,
    destroy,
  };
}

export interface SoundData {
  name: string;
  path?: string;
  internal_name?: string;
  fade: number;
  volume: number;
  balance: number;
  output_target: string;
}

export interface SoundInfo {
  format: string;
  sampleRate: number;
  channels: number;
  duration: number;
  size: number;
}

export const SOUND_EXTENSIONS = ['.wav', '.mp3', '.ogg', '.flac'];

export const SOUND_MIME_TYPES: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
};

export function getSoundFormat(data: Uint8Array): string | null {
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46) {
    return 'WAV';
  }
  if (data[0] === 0xff && (data[1] & 0xe0) === 0xe0) {
    return 'MP3';
  }
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) {
    return 'MP3';
  }
  if (data[0] === 0x4f && data[1] === 0x67 && data[2] === 0x67 && data[3] === 0x53) {
    return 'OGG';
  }
  if (data[0] === 0x66 && data[1] === 0x4c && data[2] === 0x61 && data[3] === 0x43) {
    return 'FLAC';
  }
  return null;
}

export function getWavInfo(data: Uint8Array): SoundInfo | null {
  if (data[0] !== 0x52 || data[1] !== 0x49 || data[2] !== 0x46 || data[3] !== 0x46) {
    return null;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  let offset = 12;
  let channels = 2;
  let sampleRate = 44100;
  let bitsPerSample = 16;
  let dataSize = 0;

  while (offset < data.length - 8) {
    const chunkId = String.fromCharCode(data[offset], data[offset + 1], data[offset + 2], data[offset + 3]);
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === 'fmt ') {
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === 'data') {
      dataSize = chunkSize;
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 === 1) offset++;
  }

  const bytesPerSample = bitsPerSample / 8;
  const duration = dataSize / (sampleRate * channels * bytesPerSample);

  return {
    format: 'WAV',
    sampleRate,
    channels,
    duration,
    size: data.length,
  };
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function volumeToGain(volume: number): number {
  const normalized = (volume + 100) / 200;
  return Math.max(0, Math.min(1, normalized));
}

export function sortSounds<
  T extends { name: string; output_target?: string; balance?: number; fade?: number; volume?: number },
>(list: T[], sortColumn: string, sortDirection: 'asc' | 'desc'): T[] {
  return [...list].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (sortColumn) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'output':
        aVal = (a.output_target || '').toLowerCase();
        bVal = (b.output_target || '').toLowerCase();
        break;
      case 'balance':
        aVal = a.balance || 0;
        bVal = b.balance || 0;
        break;
      case 'fade':
        aVal = a.fade || 0;
        bVal = b.fade || 0;
        break;
      case 'volume':
        aVal = a.volume || 0;
        bVal = b.volume || 0;
        break;
      default:
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
}

export interface MeshCompanions {
  meshContent: string | null;
  animationFrames: string[] | null;
}

export async function readMeshCompanions(basePath: string): Promise<MeshCompanions> {
  const objResult = await window.vpxEditor.readFile(`${basePath}.obj`);
  const meshContent = objResult.success && objResult.content ? objResult.content : null;
  const frames: string[] = [];
  for (let i = 0; ; i++) {
    const r = await window.vpxEditor.readFile(`${basePath}_anim_${i}.obj`);
    if (!r.success || !r.content) break;
    frames.push(r.content);
  }
  return { meshContent, animationFrames: frames.length > 0 ? frames : null };
}

export async function deleteMeshCompanions(basePath: string): Promise<void> {
  await window.vpxEditor.deleteFile(`${basePath}.obj`);
  for (let i = 0; ; i++) {
    const r = await window.vpxEditor.deleteFile(`${basePath}_anim_${i}.obj`);
    if (!r.success) break;
  }
}

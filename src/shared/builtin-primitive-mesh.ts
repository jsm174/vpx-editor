export interface BuiltinMeshData {
  vertices: number[];
  normals: number[];
  indices: number[];
}

export function generateBuiltinMesh(sides: number, drawTexturesInside: boolean): BuiltinMeshData {
  const numSides = Math.max(3, sides);
  const outerRadius = -0.5 / Math.cos(Math.PI / numSides);
  const addAngle = (2.0 * Math.PI) / numSides;
  const offsAngle = Math.PI / numSides;

  const numVerts = 4 * numSides + 2;
  const vx = new Float32Array(numVerts);
  const vy = new Float32Array(numVerts);
  const vz = new Float32Array(numVerts);
  const vnx = new Float32Array(numVerts);
  const vny = new Float32Array(numVerts);
  const vnz = new Float32Array(numVerts);

  vx[0] = 0;
  vy[0] = 0;
  vz[0] = 0.5;
  vnx[0] = 0;
  vny[0] = 0;
  vnz[0] = 1;

  const midBot = numSides + 1;
  vx[midBot] = 0;
  vy[midBot] = 0;
  vz[midBot] = -0.5;
  vnx[midBot] = 0;
  vny[midBot] = 0;
  vnz[midBot] = -1;

  for (let i = 0; i < numSides; i++) {
    const angle = addAngle * i + offsAngle;
    const sx = Math.sin(angle) * outerRadius;
    const sy = Math.cos(angle) * outerRadius;

    const topIdx = i + 1;
    vx[topIdx] = sx;
    vy[topIdx] = sy;
    vz[topIdx] = 0.5;
    vnx[topIdx] = 0;
    vny[topIdx] = 0;
    vnz[topIdx] = 1;

    const botIdx = i + 1 + midBot;
    vx[botIdx] = sx;
    vy[botIdx] = sy;
    vz[botIdx] = -0.5;
    vnx[botIdx] = 0;
    vny[botIdx] = 0;
    vnz[botIdx] = -1;

    const sideTopIdx = numSides * 2 + 2 + i;
    vx[sideTopIdx] = sx;
    vy[sideTopIdx] = sy;
    vz[sideTopIdx] = 0.5;
    vnx[sideTopIdx] = Math.sin(angle);
    vny[sideTopIdx] = Math.cos(angle);
    vnz[sideTopIdx] = 0;

    const sideBotIdx = numSides * 3 + 2 + i;
    vx[sideBotIdx] = sx;
    vy[sideBotIdx] = sy;
    vz[sideBotIdx] = -0.5;
    vnx[sideBotIdx] = vnx[sideTopIdx];
    vny[sideBotIdx] = vny[sideTopIdx];
    vnz[sideBotIdx] = 0;
  }

  const vertices: number[] = [];
  const normals: number[] = [];
  for (let i = 0; i < numVerts; i++) {
    vertices.push(vx[i], vy[i], -vz[i]);
    normals.push(vnx[i], vny[i], -vnz[i]);
  }

  const indices: number[] = [];
  if (drawTexturesInside) {
    for (let i = 0; i < numSides; i++) {
      const next = i === numSides - 1 ? 1 : i + 2;
      indices.push(0, i + 1, next);
      indices.push(0, next, i + 1);

      const next2 = next + 1;
      indices.push(midBot, midBot + next2, midBot + 2 + i);
      indices.push(midBot, midBot + 2 + i, midBot + next2);

      indices.push(numSides * 2 + next2, numSides * 2 + 2 + i, numSides * 3 + 2 + i);
      indices.push(numSides * 2 + next2, numSides * 3 + 2 + i, numSides * 3 + next2);
      indices.push(numSides * 2 + next2, numSides * 3 + 2 + i, numSides * 2 + 2 + i);
      indices.push(numSides * 2 + next2, numSides * 3 + next2, numSides * 3 + 2 + i);
    }
  } else {
    for (let i = 0; i < numSides; i++) {
      const next = i === numSides - 1 ? 1 : i + 2;
      indices.push(0, next, i + 1);

      const next2 = next + 1;
      indices.push(midBot, midBot + 2 + i, midBot + next2);

      indices.push(numSides * 2 + next2, numSides * 3 + 2 + i, numSides * 2 + 2 + i);
      indices.push(numSides * 2 + next2, numSides * 3 + next2, numSides * 3 + 2 + i);
    }
  }

  return { vertices, normals, indices };
}

export function builtinMeshToOBJ(name: string, sides: number, drawTexturesInside: boolean): string {
  const mesh = generateBuiltinMesh(sides, drawTexturesInside);
  const verts = mesh.vertices;
  const norms = mesh.normals;
  const idxs = mesh.indices;
  const lines: string[] = [`o ${name}`];

  for (let i = 0; i < verts.length; i += 3) {
    lines.push(`v ${verts[i]} ${verts[i + 1]} ${-verts[i + 2]}`);
  }
  for (let i = 0; i < norms.length; i += 3) {
    lines.push(`vn ${norms[i]} ${norms[i + 1]} ${-norms[i + 2]}`);
  }
  for (let i = 0; i < idxs.length; i += 3) {
    const a = idxs[i] + 1;
    const b = idxs[i + 1] + 1;
    const c = idxs[i + 2] + 1;
    lines.push(`f ${a}//${a} ${b}//${b} ${c}//${c}`);
  }
  return lines.join('\n') + '\n';
}

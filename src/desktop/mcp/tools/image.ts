import { z } from 'zod';
import { errorResult, jsonResult, type Tool } from '../types.js';
import { confirmable, runEdit, NO_ACTIVE_TABLE } from './edit-util.js';

const imageSource = z.union([
  z.object({ path: z.string().describe('Absolute path to PNG/JPG file') }),
  z.object({ base64: z.string(), mimeType: z.string().default('image/png').optional() }),
  z.object({ libraryRef: z.object({ tablePath: z.string(), imageName: z.string() }) }),
]);

const imageInput = z.object({
  action: z
    .enum(['list', 'add', 'modify', 'delete'])
    .describe(
      '"list": images/textures in the table. "add": create a new image (use `source`). ' +
        '"modify": replace bytes of an existing one (use `source`). "delete": remove it.'
    ),
  name: z
    .string()
    .optional()
    .describe('Image name. Required for add/modify/delete; for "list" omit (filter via nameRegex).'),
  nameRegex: z.string().optional().describe('For action="list": filter image names (case-insensitive regex).'),
  limit: z.number().int().positive().max(2000).default(200).optional().describe('For action="list": max images.'),
  source: imageSource
    .optional()
    .describe('Required for add/modify. One of: {path}, {base64, mimeType?}, {libraryRef:{tablePath, imageName}}.'),
  ...confirmable,
});

const image: Tool<typeof imageInput> = {
  name: 'vpx_image',
  annotations: { destructiveHint: true },
  description:
    'Read or edit images/textures in the active table. Dispatch by `action`: ' +
    '"list" (images, optional nameRegex filter), "add" (new image from `source`), "modify" (replace bytes — ' +
    'use this when iterating on a texture instead of adding name2/name3, which bloats the .vpx), "delete". ' +
    '⚠️ TEXTURE QUADRANT RULE (add/modify): if the image is applied to a Primitive with `use_3d_mesh: false` (n-gon disc/cylinder), ' +
    'vpinball samples only the TOP-LEFT QUADRANT (UV 0,0 → 0.5,0.5). Art must live there — for 1024×1024, center at (256, 256). ' +
    'Call vpx_part(action:"template", type:"Primitive") for the full rule.',
  inputSchema: imageInput,
  async execute(input, ctx) {
    if (input.action === 'list') {
      const state = await ctx.loadActiveState();
      if (!state) return errorResult(NO_ACTIVE_TABLE);
      let images = state.images;
      if (input.nameRegex) {
        try {
          const re = new RegExp(input.nameRegex, 'i');
          images = images.filter(i => re.test(i.name));
        } catch (e) {
          return errorResult(`Invalid nameRegex: ${(e as Error).message}`);
        }
      }
      const limit = input.limit ?? 200;
      return jsonResult({
        total: state.images.length,
        matched: images.length,
        images: images
          .slice(0, limit)
          .map(i => ({ name: i.name, width: i.width, height: i.height, internalName: i.internal_name, path: i.path })),
        truncated: images.length > limit,
      });
    }

    if (!input.name) return errorResult(`action="${input.action}" requires \`name\`.`);

    if (input.action === 'add') {
      if (!input.source) return errorResult('action="add" requires `source` ({path}, {base64}, or {libraryRef}).');
      return runEdit(ctx, {
        kind: 'add-image',
        payload: { name: input.name, source: input.source },
        description: `Add image "${input.name}"`,
        preview: !input.confirm,
      });
    }

    if (input.action === 'modify') {
      if (!input.source) return errorResult('action="modify" requires `source` ({path}, {base64}, or {libraryRef}).');
      return runEdit(ctx, {
        kind: 'modify-image',
        payload: { name: input.name, source: input.source },
        description: `Replace image "${input.name}"`,
        preview: !input.confirm,
      });
    }

    return runEdit(ctx, {
      kind: 'delete-image',
      payload: { name: input.name },
      description: `Delete image "${input.name}"`,
      preview: !input.confirm,
    });
  },
};

export function buildImageTools(): Tool[] {
  return [image];
}

import type { Plugin } from 'vite';

interface HtmlTransformOptions {
  platform: 'web' | 'electron';
}

export function htmlTransformPlugin(options: HtmlTransformOptions): Plugin {
  const { platform } = options;
  const isWeb = platform === 'web';

  function transformHtml(html: string): string {
    if (isWeb) {
      html = html.replace(/<!--\s*@electron-only\s*-->[\s\S]*?<!--\s*@end-electron-only\s*-->/g, '');
      html = html.replace(/<!--\s*@web-only\s*-->/g, '');
      html = html.replace(/<!--\s*@end-web-only\s*-->/g, '');
    } else {
      html = html.replace(/<!--\s*@web-only\s*-->[\s\S]*?<!--\s*@end-web-only\s*-->/g, '');
      html = html.replace(/<!--\s*@electron-only\s*-->/g, '');
      html = html.replace(/<!--\s*@end-electron-only\s*-->/g, '');
    }

    html = html.replace(/\n\s*\n\s*\n/g, '\n\n');

    return html;
  }

  return {
    name: 'html-transform',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return transformHtml(html);
      },
    },
  };
}

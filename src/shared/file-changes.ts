/** Exact file contents for an editor transaction. null means the file is absent. */
export interface FileChange {
  path: string;
  before: string | null;
  after: string | null;
}

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { IS_STATIC, getSavedGithubToken } from '../api.ts';

/**
 * Static-mode warning.
 *
 * On GitHub Pages there is no server to write to, so saving a registry commits
 * the JSON file through the GitHub API and needs a fine-grained token. Without
 * one, pressing Save cannot persist anything — which previously looked like the
 * entry silently vanishing. This states the requirement up front instead of at
 * the moment of failure.
 */
export function StaticModeNotice({ file }: { file: string }) {
  if (!IS_STATIC) return null;
  const hasToken = !!getSavedGithubToken().trim();
  if (hasToken) return null;
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 flex items-start gap-3">
      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs font-extrabold text-amber-900">
          This dashboard is running as a static site — saving needs a GitHub token
        </p>
        <p className="text-[11px] text-amber-700 font-medium mt-0.5 leading-relaxed">
          There is no server here to write <code className="font-mono">{file}</code>, so Save commits it to the
          repository through the GitHub API. Create a fine-grained token with{' '}
          <span className="font-semibold">Contents: Read and write</span> on this repository and paste it when
          prompted — it is stored only in this browser. Until then your edits stay on this device and will not
          appear for anyone else.
        </p>
      </div>
    </div>
  );
}

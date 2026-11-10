import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { updatePreview } from './review-pages.mjs';

const root = resolve('work/pages');
function git(args, cwd = process.cwd()) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
await mkdir('work', { recursive: true });
const existing = git(['ls-remote', '--heads', 'origin', 'refs/heads/gh-pages']);
if (existing) {
  git(['fetch', 'origin', 'gh-pages']);
  git(['worktree', 'add', '--detach', root, 'FETCH_HEAD']);
} else {
  git(['worktree', 'add', '--detach', root, 'HEAD']);
  git(['checkout', '--orphan', 'review-pages-initial'], root);
  git(['rm', '-rf', '.'], root);
}
await updatePreview({
  root,
  artifact: resolve('work/incoming'),
  number: Number(process.env.PREVIEW_NUMBER),
  sha: process.env.PREVIEW_SHA,
  remove: process.env.PREVIEW_REMOVE === 'true',
});
git(['config', 'user.name', 'github-actions[bot]'], root);
git(
  [
    'config',
    'user.email',
    '41898282+github-actions[bot]@users.noreply.github.com',
  ],
  root,
);
git(['add', '--all'], root);
if (git(['status', '--porcelain'], root)) {
  git(
    [
      'commit',
      '-m',
      `Update review pages for PR #${Number(process.env.PREVIEW_NUMBER)}`,
    ],
    root,
  );
  // forceを使わず、競合や想定外の更新を検出する。
  git(['push', 'origin', 'HEAD:refs/heads/gh-pages'], root);
}
// upload-pages-artifactにGit管理情報を渡さない。
await rm(resolve(root, '.git'));

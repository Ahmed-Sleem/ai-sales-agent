#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo '== shell syntax =='
bash -n scripts/verify.sh

echo '== typecheck =='
npm run typecheck

echo '== lint =='
npm run lint

echo '== unit tests =='
npm run test:unit

echo '== secret scan =='
node scripts/scan-secrets.mjs

echo '== dependency audit =='
npm audit

echo '== build =='
npm run build

if [[ "${SKIP_E2E:-0}" != "1" ]]; then
  echo '== e2e smoke =='
  npm run test:e2e
else
  echo '== e2e skipped by SKIP_E2E=1 =='
fi

echo 'VERIFY PASSED'

#!/bin/bash
# Build -> Quality Gate -> push main + gh-pages (serialisiert per flock)
set -e
exec 9>/tmp/einkauf_deploy.lock; flock 9
cd /workspace/einkauf-app
[ -f public/receipts.json ] && { echo "public/receipts.json (echte Bons) liegt vor – wird für den öffentlichen Build ausgelagert"; mv public/receipts.json /tmp/receipts.private.json; trap 'mv /tmp/receipts.private.json public/receipts.json' EXIT; }
npm run build >/tmp/einkauf_build.log 2>&1 || { tail -20 /tmp/einkauf_build.log; exit 1; }
pgrep -f "http.server 8777" >/dev/null || { mkdir -p /tmp/eksrv; ln -sfn /workspace/einkauf-app/dist /tmp/eksrv/einkaufsanalyse; (cd /tmp/eksrv && nohup python3 -m http.server 8777 >/dev/null 2>&1 &); sleep 1; }
node tools/qa.mjs || { echo "QUALITY GATE FAILED – nichts veröffentlicht"; exit 1; }
git add -A && git -c user.name="Martin Hausleitner" -c user.email="Martin-Hausleitner@users.noreply.github.com" commit -qm "${1:-update}" || true
git push -q origin main
cd dist && touch .nojekyll && cp index.html 404.html && rm -rf .git && git init -q -b gh-pages && git add -A && git -c user.name="Martin Hausleitner" -c user.email="Martin-Hausleitner@users.noreply.github.com" commit -qm deploy && git push -q -f https://github.com/servas-ai/einkaufsanalyse.git gh-pages && rm -rf .git
echo deployed

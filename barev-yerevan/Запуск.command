#!/bin/sh
cd "$(dirname "$0")"
printf '\nОткройте в браузере: http://127.0.0.1:4173\nДля остановки нажмите Ctrl+C.\n\n'
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist

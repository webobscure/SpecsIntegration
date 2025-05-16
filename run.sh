#!/bin/bash
cd "$(dirname "$0")"
node index.js >> cron_output.log 2>&1

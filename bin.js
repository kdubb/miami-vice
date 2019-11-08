#! /usr/bin/env node
const miamiVice = require('./')();
const input = process.stdin;
const output = process.stdout;

input
    .pipe(miamiVice)
    .pipe(output);

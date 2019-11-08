#! /usr/bin/env node
const miamiVice = require('./')();
const split = require('split2');

const input = process.stdin;
const output = process.stdout;

input
    .pipe(split(miamiVice))
    .pipe(output);

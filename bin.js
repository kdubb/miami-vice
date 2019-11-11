#! /usr/bin/env node
const miamiVice = require('./')();
const split = require('split2');

function inputFile() {
    const fileArg = process.argv[2];
    if (fileArg && fileArg !== '-') {
        return require('fs').createReadStream(fileArg);
    }
    return process.stdin;
}

const input =  inputFile();
const output = process.stdout;

input
    .pipe(split(miamiVice))
    .pipe(output);

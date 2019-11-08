const prettyBytes = require('prettier-bytes');
const jsonParse = require('fast-json-parse');
const prettyMs = require('pretty-ms');
const padLeft = require('pad-left');
const split = require('split2');
const chalk = require('chalk');
const flat = require('flat');
const yaml = require('js-yaml');
const nl = '\n';

const emojiLog = {
    fatal: '💀',
    error: '🚨',
    warn: '⚠️',
    info: '✨',
    debug: '🐛',
    trace: '🔍'
};

const emojiMark = {
    error: '🧨',
    stack: '💥',
};

function isWideEmoji(character) {
    return character !== '⚠️'
}

module.exports = MiamiVice;

function MiamiVice() {
    return split(parse);

    function extract(obj, ...props) {
        let val = undefined;
        for (const prop of props) {
            val = (val !== undefined) ? val : obj[prop];
            delete obj[prop];
        }
        return val;
    }

    function parse(line) {
        let obj = jsonParse(line);
        if (!obj.value || obj.err) return line + nl;
        obj = obj.value;

        if (!obj.level) return line + nl;
        if (typeof obj.level === 'number') convertLogNumber(obj);

        return output(obj) + nl
    }

    function convertLogNumber(obj) {
        if (obj.level === 10) obj.level = 'trace';
        if (obj.level === 20) obj.level = 'debug';
        if (obj.level === 30) obj.level = 'info';
        if (obj.level === 40) obj.level = 'warn';
        if (obj.level === 50) obj.level = 'error';
        if (obj.level === 60) obj.level = 'fatal'
    }

    function output(obj) {
        const output = [];

        if (!obj.level) obj.level = 'userlvl';
        if (!obj.name) obj.name = '';
        if (!obj.ns) obj.ns = '';

        const level = extract(obj, 'level');
        output.push(formatDate(extract(obj, 'time')));
        output.push(formatLevel(level));
        output.push(formatNs(extract(obj, 'ns')));
        output.push(formatName(extract(obj, 'name')));

        const reqId = extract(obj, 'reqId');
        if (reqId) {
            output.push(chalk.blueBright(`[${reqId}]`));
        }

        output.push(formatMessage(extract(obj, 'message', 'msg'), level));

        /*const pid = */extract(obj, 'pid');
        /*const hostname = */extract(obj, 'hostname');
        /*const v = */extract(obj, 'v');

        const req = extract(obj, 'req');
        const res = extract(obj, 'res');
        const statusCode = (res) ? res.statusCode : extract(obj, 'statusCode');
        const responseTime = extract(obj, 'responseTime', 'elapsed');
        const method = (req) ? req.method : extract(obj, 'method');
        const contentLength = extract(obj, 'contentLength');
        const url = (req) ? req.url : extract(obj, 'url');

        if (method != null) {
            output.push(formatMethod(method))
        }
        if (statusCode != null) {
            output.push(formatStatusCode(statusCode))
        }
        if (url != null) output.push(formatUrl(url));
        if (contentLength != null) output.push(formatBundleSize(contentLength));
        if (responseTime != null) output.push(formatLoadTime(responseTime));

        let err = extract(obj, 'err', 'error');

        if (level === 'fatal' || level === 'error' || level === 'warn') {
            const extra = Object.entries(flat(obj)).map(([key, value]) => `${key}: ${value}`).join(', ');
            output.push(chalk.gray(extra));
        }

        let lines = [output.filter(noEmpty).join(' ')];

        if (err) {
            let stack = err.stack;
            delete err.stack;

            let errLines = yaml.safeDump({err}, {skipInvalid: true}).split(/\r?\n/);
            errLines[0] = `${emojiMark.error} Error:`;

            errLines = errLines
                .filter(errLine => errLine.trim())
                .map(errLine => padLeft('', 9, ' ') + '| ' + errLine);

            lines.push(...errLines);

            if (stack) {
                if (!(stack instanceof Array)) {
                    stack = stack.split(/\r?\n/);
                }
                if (stack[0].startsWith('Error:')) {
                    stack.shift();
                }

                stack.unshift(`${emojiMark.stack} Stack trace:`);
                stack = stack.map(stackLine => padLeft('', 9, ' ') + '| ' + stackLine);

                lines.push(...stack);
            }
        }

        return lines.filter(line => line.trim()).join(nl);
    }

    function formatDate(time) {
        const date = new Date(time);
        const hours = padLeft(date.getHours().toString(), 2, '0');
        const minutes = padLeft(date.getMinutes().toString(), 2, '0');
        const seconds = padLeft(date.getSeconds().toString(), 2, '0');
        const prettyDate = hours + ':' + minutes + ':' + seconds;
        return chalk.gray(prettyDate)
    }

    function formatLevel(level) {
        const emoji = emojiLog[level];
        const padding = isWideEmoji(emoji) ? '' : ' ';
        return emoji + padding
    }

    function formatNs(name) {
        return chalk.cyan(name)
    }

    function formatName(name) {
        return chalk.blue(name)
    }

    function formatMessage(message, level) {
        const msg = formatMessageName(message);
        let pretty;
        if (level === 'error') pretty = chalk.red(msg);
        if (level === 'trace') pretty = chalk.white(msg);
        if (level === 'warn') pretty = chalk.magenta(msg);
        if (level === 'debug') pretty = chalk.yellow(msg);
        if (level === 'info' || level === 'userlvl') pretty = chalk.green(msg);
        if (level === 'fatal') pretty = chalk.white.bgRed(msg);
        return pretty;
    }

    function formatUrl(url) {
        return chalk.white(url)
    }

    function formatMethod(method) {
        return chalk.white(method)
    }

    function formatStatusCode(statusCode) {
        statusCode = statusCode || 'xxx';
        return chalk.white(statusCode)
    }

    function formatLoadTime(elapsedTime) {
        const elapsed = parseInt(elapsedTime, 10);
        const time = prettyMs(elapsed);
        return chalk.gray(time)
    }

    function formatBundleSize(bundle) {
        const bytes = parseInt(bundle, 10);
        const size = prettyBytes(bytes).replace(/ /, '');
        return chalk.gray(size)
    }

    function formatMessageName(message) {
        if (message === 'request' || message === 'incoming request') return '<--';
        if (message === 'response' || message === 'request completed') return '-->';
        return message
    }

    function noEmpty(val) {
        return !!val
    }
}

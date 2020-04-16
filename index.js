const prettyBytes = require('prettier-bytes');
const jsonParse = require('fast-json-parse');
const hasUnicode = require('has-unicode')();
const prettyMs = require('pretty-ms');
const padLeft = require('pad-left');
const chalk = require('chalk');
const flat = require('flat');
const yaml = require('js-yaml');

const nl = process.platform === 'win32' ? '\r\n' : '\n';

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

const indentMark = chalk.gray('|');

const anynl = /\r?\n/;

function isWideEmoji(character) {
    return character !== '⚠️'
}

module.exports = MiamiVice;

function MiamiVice() {
    return parse;

    function parse(lineOrRecord) {

        function unhandled() {
            return lineOrRecord + nl
        }

        let record;
        if (typeof lineOrRecord === 'string') {
            let obj = jsonParse(lineOrRecord);
            if (!obj.value || obj.err) return unhandled();
            record = obj.value;
        }
        else if (typeof lineOrRecord === 'object' && lineOrRecord['v']) {
            record = lineOrRecord;
        }
        else {
            return unhandled();
        }

        if (!record.level) return unhandled();
        if (typeof record.level === 'number') convertLogNumber(record);

        return output(record) + nl
    }

    function extract(obj, ...props) {
        let val = undefined;
        for (const prop of props) {
            val = (val !== undefined) ? val : obj[prop];
            delete obj[prop];
        }
        return val;
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

        const msg = extract(obj, 'message', 'msg');
        output.push(formatMessage(msg, level));

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
        let trace = extract(obj, 'trace', 'stack');

        let detailLines = [];

        if (level !== 'info') {
            const details = Object.entries(flat(obj)).map(([key, value]) => `${key}: ${value}`).join(', ');
            if (details.length < 160) {
                output.push(chalk.gray(details));
            }
            else {
                detailLines = yaml.safeDump(obj, {skipInvalid: true})
                    .split(anynl)
                    .filter(noEmpty)
                    .map(indent)
                    .map((line) => chalk.gray(line));
            }
        }

        let lines = [output.filter(noEmpty).join(' '), ...detailLines];

        if (err) {
            err = Object.assign({}, err);
            trace = extract(err, 'trace', 'stack') || trace;
            lines.push(...formatError(err, trace, msg));
        }

        if (trace) {
            lines.push(...formatTrace(trace, err));
        }

        return lines.filter(line => line.trim()).join(nl);
    }

    function formatError(err, trace, msg) {
        trace = trace instanceof Array ? trace[0] : (trace || '');

        const errNameMatch = trace.match(errorNameRegex);
        let errName = 'Error';
        if (errNameMatch) {
            errName = errNameMatch[1];
            if (errName === err.type) {
                extract(err, 'type');
            }
        }
        
        if (err.name === errName) {
            extract(err, 'name');
        }
        if (msg && msg.includes(err.message)) {
            extract(err, 'message');
        }
        if (msg && msg.includes(err.msg)) {
            extract(err, 'msg');
        }
        
        const errLines = yaml.safeDump(err, { skipInvalid: true })
            .split(anynl).map(errLine => '   ' + errLine);
        errLines.unshift(`${formatMark(emojiMark.error)} ${errName}:`);

        return errLines
            .filter(errLine => errLine.trim())
            .map(indent);
    }

    function formatTrace(trace, err) {
        if (!(trace instanceof Array)) {
            trace = trace.toString().split(anynl);
        }

        let res = [];

        const errNameMatch = trace[0].match(errorNameRegex);
        if (!err) {
            let errName = errNameMatch ? errNameMatch[1] : 'Error';
            res.push(`${formatMark(emojiMark.error)} ${errName}:`);
        }
        if (errNameMatch) {
            trace.shift();
        }

        res.push(`${formatMark(emojiMark.stack)} Stack trace:`);
        res.push(...trace);
        return res.map(indent);
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
        if (!hasUnicode) return formatMessage(level, level);
        const emoji = emojiLog[level];
        const padding = isWideEmoji(emoji) ? '' : ' ';
        return emoji + padding;
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

        const lines = pretty.split(anynl);
        if (lines.length === 1) {
            return pretty;
        }

        return [lines[0], ...lines.slice(1).map(indentPlus)].join(nl);
    }

    function indent(line) {
        return padLeft('', 9, ' ') + indentMark + line;
    }

    function indentPlus(line) {
        return indent(' ' + line);
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

    function formatMark(mark) {
        return hasUnicode ? mark : '';
    }

    function noEmpty(val) {
        return !!val
    }
}

const errorNameRegex = /^((\w*)(Error|Exception)):/;

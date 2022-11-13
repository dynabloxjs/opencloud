"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pathToRegexp = exports.tokensToRegexp = exports.regexpToFunction = exports.match = exports.tokensToFunction = exports.compile = exports.parse = exports.lexer = void 0;
// Note, the `//u` suffix triggers this typescript linting bug:
//
//  https://github.com/buzinas/tslint-eslint-rules/issues/289
//
// This requires disabling the no-empty-character-class lint rule.
const regexIdentifierStart = /[$_\p{ID_Start}]/u;
const regexIdentifierPart = /[$_\u200C\u200D\p{ID_Continue}]/u;
function isASCII(str, extended) {
    return (extended ? /^[\x00-\xFF]*$/ : /^[\x00-\x7F]*$/).test(str);
}
/**
 * Tokenize input string.
 */
function lexer(str, lenient = false) {
    const tokens = [];
    let i = 0;
    while (i < str.length) {
        const char = str[i];
        const ErrorOrInvalid = function (msg) {
            if (!lenient)
                throw new TypeError(msg);
            tokens.push({ type: "INVALID_CHAR", index: i, value: str[i++] });
        };
        if (char === "*") {
            tokens.push({ type: "ASTERISK", index: i, value: str[i++] });
            continue;
        }
        if (char === "+" || char === "?") {
            tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
            continue;
        }
        if (char === "\\") {
            tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
            continue;
        }
        if (char === "{") {
            tokens.push({ type: "OPEN", index: i, value: str[i++] });
            continue;
        }
        if (char === "}") {
            tokens.push({ type: "CLOSE", index: i, value: str[i++] });
            continue;
        }
        if (char === ":") {
            let name = "";
            let j = i + 1;
            while (j < str.length) {
                const code = str.substr(j, 1);
                if ((j === i + 1 && regexIdentifierStart.test(code)) ||
                    (j !== i + 1 && regexIdentifierPart.test(code))) {
                    name += str[j++];
                    continue;
                }
                break;
            }
            if (!name) {
                ErrorOrInvalid(`Missing parameter name at ${i}`);
                continue;
            }
            tokens.push({ type: "NAME", index: i, value: name });
            i = j;
            continue;
        }
        if (char === "(") {
            let count = 1;
            let pattern = "";
            let j = i + 1;
            let error = false;
            if (str[j] === "?") {
                ErrorOrInvalid(`Pattern cannot start with "?" at ${j}`);
                continue;
            }
            while (j < str.length) {
                if (!isASCII(str[j], false)) {
                    ErrorOrInvalid(`Invalid character '${str[j]}' at ${j}.`);
                    error = true;
                    break;
                }
                if (str[j] === "\\") {
                    pattern += str[j++] + str[j++];
                    continue;
                }
                if (str[j] === ")") {
                    count--;
                    if (count === 0) {
                        j++;
                        break;
                    }
                }
                else if (str[j] === "(") {
                    count++;
                    if (str[j + 1] !== "?") {
                        ErrorOrInvalid(`Capturing groups are not allowed at ${j}`);
                        error = true;
                        break;
                    }
                }
                pattern += str[j++];
            }
            if (error) {
                continue;
            }
            if (count) {
                ErrorOrInvalid(`Unbalanced pattern at ${i}`);
                continue;
            }
            if (!pattern) {
                ErrorOrInvalid(`Missing pattern at ${i}`);
                continue;
            }
            tokens.push({ type: "PATTERN", index: i, value: pattern });
            i = j;
            continue;
        }
        tokens.push({ type: "CHAR", index: i, value: str[i++] });
    }
    tokens.push({ type: "END", index: i, value: "" });
    return tokens;
}
exports.lexer = lexer;
/**
 * Parse a string for the raw tokens.
 */
function parse(str, options = {}) {
    const tokens = lexer(str);
    const { prefixes = "./" } = options;
    const defaultPattern = `[^${escapeString(options.delimiter || "/#?")}]+?`;
    const result = [];
    let key = 0;
    let i = 0;
    let path = "";
    let nameSet = new Set();
    const tryConsume = (type) => {
        if (i < tokens.length && tokens[i].type === type) {
            return tokens[i++].value;
        }
    };
    const tryConsumeModifier = () => {
        const r = tryConsume("MODIFIER");
        if (r) {
            return r;
        }
        return tryConsume("ASTERISK");
    };
    const mustConsume = (type) => {
        const value = tryConsume(type);
        if (value !== undefined)
            return value;
        const { type: nextType, index } = tokens[i];
        throw new TypeError(`Unexpected ${nextType} at ${index}, expected ${type}`);
    };
    const consumeText = () => {
        let result = "";
        let value;
        // tslint:disable-next-line
        while ((value = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR"))) {
            result += value;
        }
        return result;
    };
    const DefaultEncodePart = (value) => {
        return value;
    };
    const encodePart = options.encodePart || DefaultEncodePart;
    while (i < tokens.length) {
        const char = tryConsume("CHAR");
        const name = tryConsume("NAME");
        let pattern = tryConsume("PATTERN");
        if (!name && !pattern && tryConsume("ASTERISK")) {
            pattern = ".*";
        }
        if (name || pattern) {
            let prefix = char || "";
            if (prefixes.indexOf(prefix) === -1) {
                path += prefix;
                prefix = "";
            }
            if (path) {
                result.push(encodePart(path));
                path = "";
            }
            const finalName = name || key++;
            if (nameSet.has(finalName)) {
                throw new TypeError(`Duplicate name '${finalName}'.`);
            }
            nameSet.add(finalName);
            result.push({
                name: finalName,
                prefix: encodePart(prefix),
                suffix: "",
                pattern: pattern || defaultPattern,
                modifier: tryConsumeModifier() || "",
            });
            continue;
        }
        const value = char || tryConsume("ESCAPED_CHAR");
        if (value) {
            path += value;
            continue;
        }
        const open = tryConsume("OPEN");
        if (open) {
            const prefix = consumeText();
            const name = tryConsume("NAME") || "";
            let pattern = tryConsume("PATTERN") || "";
            if (!name && !pattern && tryConsume("ASTERISK")) {
                pattern = ".*";
            }
            const suffix = consumeText();
            mustConsume("CLOSE");
            const modifier = tryConsumeModifier() || "";
            if (!name && !pattern && !modifier) {
                path += prefix;
                continue;
            }
            if (!name && !pattern && !prefix) {
                continue;
            }
            if (path) {
                result.push(encodePart(path));
                path = "";
            }
            result.push({
                name: name || (pattern ? key++ : ""),
                pattern: name && !pattern ? defaultPattern : pattern,
                prefix: encodePart(prefix),
                suffix: encodePart(suffix),
                modifier: modifier,
            });
            continue;
        }
        if (path) {
            result.push(encodePart(path));
            path = "";
        }
        mustConsume("END");
    }
    return result;
}
exports.parse = parse;
/**
 * Compile a string to a template function for the path.
 */
function compile(str, options) {
    return tokensToFunction(parse(str, options), options);
}
exports.compile = compile;
/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction(tokens, options = {}) {
    const reFlags = flags(options);
    const { encode = (x) => x, validate = true } = options;
    // Compile all the tokens into regexps.
    const matches = tokens.map((token) => {
        if (typeof token === "object") {
            return new RegExp(`^(?:${token.pattern})$`, reFlags);
        }
    });
    return (data) => {
        let path = "";
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (typeof token === "string") {
                path += token;
                continue;
            }
            const value = data ? data[token.name] : undefined;
            const optional = token.modifier === "?" || token.modifier === "*";
            const repeat = token.modifier === "*" || token.modifier === "+";
            if (Array.isArray(value)) {
                if (!repeat) {
                    throw new TypeError(`Expected "${token.name}" to not repeat, but got an array`);
                }
                if (value.length === 0) {
                    if (optional)
                        continue;
                    throw new TypeError(`Expected "${token.name}" to not be empty`);
                }
                for (let j = 0; j < value.length; j++) {
                    const segment = encode(value[j], token);
                    if (validate && !matches[i].test(segment)) {
                        throw new TypeError(`Expected all "${token.name}" to match "${token.pattern}", but got "${segment}"`);
                    }
                    path += token.prefix + segment + token.suffix;
                }
                continue;
            }
            if (typeof value === "string" || typeof value === "number") {
                const segment = encode(String(value), token);
                if (validate && !matches[i].test(segment)) {
                    throw new TypeError(`Expected "${token.name}" to match "${token.pattern}", but got "${segment}"`);
                }
                path += token.prefix + segment + token.suffix;
                continue;
            }
            if (optional)
                continue;
            const typeOfMessage = repeat ? "an array" : "a string";
            throw new TypeError(`Expected "${token.name}" to be ${typeOfMessage}`);
        }
        return path;
    };
}
exports.tokensToFunction = tokensToFunction;
/**
 * Create path match function from `path-to-regexp` spec.
 */
function match(str, options) {
    const keys = [];
    const re = pathToRegexp(str, keys, options);
    return regexpToFunction(re, keys, options);
}
exports.match = match;
/**
 * Create a path match function from `path-to-regexp` output.
 */
function regexpToFunction(re, keys, options = {}) {
    const { decode = (x) => x } = options;
    return function (pathname) {
        const m = re.exec(pathname);
        if (!m)
            return false;
        const { 0: path, index } = m;
        const params = Object.create(null);
        for (let i = 1; i < m.length; i++) {
            // tslint:disable-next-line
            if (m[i] === undefined)
                continue;
            const key = keys[i - 1];
            if (key.modifier === "*" || key.modifier === "+") {
                params[key.name] = m[i].split(key.prefix + key.suffix).map((value) => {
                    return decode(value, key);
                });
            }
            else {
                params[key.name] = decode(m[i], key);
            }
        }
        return { path, index, params };
    };
}
exports.regexpToFunction = regexpToFunction;
/**
 * Escape a regular expression string.
 */
function escapeString(str) {
    return str.replace(/([.+*?^${}()[\]|/\\])/g, "\\$1");
}
/**
 * Get the flags for a regexp from the options.
 */
function flags(options) {
    return options && options.sensitive ? "u" : "ui";
}
/**
 * Pull out keys from a regexp.
 */
function regexpToRegexp(path, keys) {
    if (!keys)
        return path;
    const groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
    let index = 0;
    let execResult = groupsRegex.exec(path.source);
    while (execResult) {
        keys.push({
            // Use parenthesized substring match if available, index otherwise
            name: execResult[1] || index++,
            prefix: "",
            suffix: "",
            modifier: "",
            pattern: "",
        });
        execResult = groupsRegex.exec(path.source);
    }
    return path;
}
/**
 * Transform an array into a regexp.
 */
function arrayToRegexp(paths, keys, options) {
    const parts = paths.map((path) => pathToRegexp(path, keys, options).source);
    return new RegExp(`(?:${parts.join("|")})`, flags(options));
}
/**
 * Create a path regexp from string input.
 */
function stringToRegexp(path, keys, options) {
    return tokensToRegexp(parse(path, options), keys, options);
}
/**
 * Expose a function for taking tokens and returning a RegExp.
 */
function tokensToRegexp(tokens, keys, options = {}) {
    const { strict = false, start = true, end = true, encode = (x) => x, } = options;
    const endsWith = `[${escapeString(options.endsWith || "")}]|$`;
    const delimiter = `[${escapeString(options.delimiter || "/#?")}]`;
    let route = start ? "^" : "";
    // Iterate over the tokens and create our regexp string.
    for (const token of tokens) {
        if (typeof token === "string") {
            route += escapeString(encode(token));
        }
        else {
            const prefix = escapeString(encode(token.prefix));
            const suffix = escapeString(encode(token.suffix));
            if (token.pattern) {
                if (keys)
                    keys.push(token);
                if (prefix || suffix) {
                    if (token.modifier === "+" || token.modifier === "*") {
                        const mod = token.modifier === "*" ? "?" : "";
                        route +=
                            `(?:${prefix}((?:${token.pattern})(?:${suffix}${prefix}(?:${token.pattern}))*)${suffix})${mod}`;
                    }
                    else {
                        route +=
                            `(?:${prefix}(${token.pattern})${suffix})${token.modifier}`;
                    }
                }
                else {
                    if (token.modifier === "+" || token.modifier === "*") {
                        route += `((?:${token.pattern})${token.modifier})`;
                    }
                    else {
                        route += `(${token.pattern})${token.modifier}`;
                    }
                }
            }
            else {
                route += `(?:${prefix}${suffix})${token.modifier}`;
            }
        }
    }
    if (end) {
        if (!strict)
            route += `${delimiter}?`;
        route += !options.endsWith ? "$" : `(?=${endsWith})`;
    }
    else {
        const endToken = tokens[tokens.length - 1];
        const isEndDelimited = typeof endToken === "string"
            ? delimiter.indexOf(endToken[endToken.length - 1]) > -1
            // tslint:disable-next-line
            : endToken === undefined;
        if (!strict) {
            route += `(?:${delimiter}(?=${endsWith}))?`;
        }
        if (!isEndDelimited) {
            route += `(?=${delimiter}|${endsWith})`;
        }
    }
    return new RegExp(route, flags(options));
}
exports.tokensToRegexp = tokensToRegexp;
/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 */
function pathToRegexp(path, keys, options) {
    if (path instanceof RegExp)
        return regexpToRegexp(path, keys);
    if (Array.isArray(path))
        return arrayToRegexp(path, keys, options);
    return stringToRegexp(path, keys, options);
}
exports.pathToRegexp = pathToRegexp;

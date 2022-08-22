/**
 * FireMacro is a markup syntax for merging data into strings and objects
 *
 * Data can be an object with a variety of types. Basic attributes are mapped
 * as {myAttribute} or {anObject.anAttribute}. Objects or arrays referenced by
 * macro strings are rendered in query string format. Functions can be referenced
 * as well as passed through the data object along with macro context, for
 * example {doSomething.client.name}
 *
 * If target is an object, the object will be traversed and each value processed
 * into a new object
 *
 * FireMacro is designed to work with json objects as well as plain text
 */
export default class FireMacro {
    constructor(model, options) {
        this._model = model;
        this.options = options || {};
        this.dataStack = [];
        this.counters = {};
        this.moment = moment; // defined in the browser or imported dynamically during parse()
        if (!this.options.noHelpers) this.dataStack.unshift(this.helpers);
    }

    get data() {
        return this.dataStack[0];
    }

    set model(newModel) {
        this._model = newModel;
    }
    get model() {
        return this._model;
    }
    get log() {
        let logger = (data)=>console.log({[data.level]:data.message});
        if (this.options.dataSource && this.options.dataSource.log) {
            logger = this.options.dataSource.log.bind(this.options.dataSource);
        }
        return {
            error:(msg)=>logger({level:"error",message:msg}),
            warning:(msg)=>logger({level:"warning",message:msg}),
            info:(msg)=>logger({level:"info",message:msg}),
            success:(msg)=>logger({level:"success",message:msg}),
            debug:(msg)=>logger({level:"debug",message:msg})
        }
    }

    async parse() {
        if (!this.moment) this.moment = await import('moment');
        for (let a of arguments) if (a) this.dataStack.unshift(a);
        this.result = await this.traverseAsync(this.model);
        this.result = await Macro.wash(this.result);

        return this.result;
    }

    async traverseAsync(o) {
        if (typeof o === 'string') {
            let i = await Macro.identify(this,o);
            let r = await i.resolve();
            if (r.type === 'string') return r.value;
            else return await this.traverseAsync(r);
        } else if (typeof o === "boolean" || typeof o === 'number' || o instanceof Date || o === null) {
            return o;
        } else if (o instanceof Macro) {
            let r = await o.resolve();
            if (r.protect) return r.value;
            else return await this.traverseAsync(r.value);
        } else if (Array.isArray(o)) {
            let r = [];
            for (let i = 0; i < o.length; i++) r.push(await this.traverseAsync(o[i]));
            return r;
        } else if (typeof o === 'object' && o.constructor.name.toLowerCase() !== 'objectid') {
            let r = {};
            let popData = 0;
            for (let k in o) {
                if (this.writer.hasOwnProperty(k)) {
                    let result = await this.writer[k](o[k]);
                    if (Array.isArray(result)) r = result;
                    else if (typeof result === 'object') r = Object.assign(r,result);
                    else r = result;
                } else if (this.connector.hasOwnProperty(k)) {
                    this.dataStack.unshift(await this.connector[k](o[k]));
                    popData++;
                } else if (this.monitor.hasOwnProperty(k)) {
                    await this.monitor[k](o[k]);
                } else {
                    let pk = await this.traverseAsync(k);
                    r[pk] = await this.traverseAsync(o[k]);
                }
            }
            for (let i = 0;i<popData;i++) this.dataStack.shift();
            return r
        } else {
            return o
        }
    }

    /**
     * Connectors pull data on to the datastack
     */
    get connector() {
        return {
            $DATA:async (val)=>{
                let data = await this.traverseAsync(val);
                data = await Macro.wash(data);
                if (Array.isArray(data)) data = {_: data};
                let sources = (typeof data === "object") ? data : {_: data};
                let d = {};
                for (const p of Object.keys(sources)) {
                    if (typeof sources[p] === 'string') {
                        if (!this.options.dataSource) continue;
                        if (sources[p].length === 0) continue;
                        d[p] = await this.options.dataSource.get(sources[p]);
                    } else {
                        d[p] = sources[p];
                    }
                    if (p === "_") d = d[p];
                }
                return d;
            },
            $GET:async (val)=>{
                return await this.connector.$DATA(val);
            },
            $TRYGET:async (val)=>{
                try {
                    return await this.connector.$DATA(val);
                } catch(e) {
                    await this.monitor.$LOG({level:"warning",message:e.message})
                }
            }
        }
    }

    /**
     * monitors inform the the calling context
     */
    get monitor() {
        return {
            $LOG:async (val)=>{
                let data = await this.traverseAsync(val);
                data = await Macro.wash(data);
                if (typeof data === "string") data = {level:"info",message:data};
                let logger = this.dataStack.find(e=>!!e.$log);
                await logger.$log(data.level,data.message);
            },
            $COUNT:async(val)=>{
                let id = (typeof val==='object')?JSON.stringify(val):val;
                id = encodeURIComponent(id);
                let counter = this.counters[id];
                if (!counter) {
                    if (typeof val === 'string') {
                        let parts = val.split(':');
                        val = {threshold:parseInt(parts[0]),log:parts[1]}
                    }
                    val.count = 0;
                    this.counters[id] = val;
                } else {
                    if ((++counter.count)%counter.threshold === 0) {
                        this.dataStack.unshift({count:counter.count});
                        let result = {};
                        if (counter.log) {
                            let message = await this.traverseAsync(counter.log);
                            await this.options.dataSource.log({level:"info",message:message});
                        } else if (counter.do) {
                            result = await this.traverseAsync(counter.do);
                        }
                        this.dataStack.shift();
                        return result;
                    }
                }
            },
            $SLEEP:async (val)=>{
                await timeout(parseInt(val));
            }
        }
    }

    /**
     * writers manipulate the result data
     */
    get writer() {
        return {
            $EACH:async (val)=>{
                let result = [];
                let iterable = this.data;
                let template = val;
                if (val.data && val.template) {
                    try {
                        iterable = await this.connector.$DATA(val.data);
                    } catch(e) {
                        iterable = null;
                    }
                    template = val.template;
                }
                if (Array.isArray(iterable)) {
                    this.dataStack.unshift({}); // push a dummy at the top to swap with series results
                    for (let i of iterable) {
                        this.dataStack[0] = (i.json || i);
                        let item = await this.traverseAsync(template);
                        item = await Macro.wash(item);
                        // If the template is not an array, but returns an array, flatten it.
                        // This is the case when the template is itself an $EACH block
                        if (Array.isArray(item) && !Array.isArray(template)) {
                            for (i of item) result.push(i);
                        } else {
                            result.push(item);
                        }
                    }
                    this.dataStack.shift();
                }
                return result;
            },
            $PIPE:async (val)=>{
                let result = {};
                if (Array.isArray(val) && val.length > 0) {
                    let i = 0;
                    for (let block of val) {
                        result = await this.traverseAsync(block);
                        result = await Macro.wash(result);
                        // remove last block results if not the first block
                        if (i++ > 0) this.dataStack.shift();
                        // push new block results
                        this.dataStack.unshift(result);
                    }
                    this.dataStack.shift();
                }
                return result;
            },
            $JSON:async (val)=>{
                try {
                    let i = await Macro.identify(this,val);
                    val = await i.resolve();
                    val = JSON.parse(val.value);
                    let result = await this.traverseAsync(val);
                    result = await Macro.wash(result);
                    return result;
                } catch (e) {
                    return {error: e};
                }
            },
            $ASSIGN:async (val)=>{
                let result = await this.traverseAsync(val);
                result = await Macro.wash(result);
                if (Array.isArray(result)) {
                    result = result.reduce((o,i)=>{
                        return Object.assign(o,i);
                    },{})
                }
                return result;
            },
            $IF:async (val)=>{
                let result = false;
                // If every value in an array is equal, or the condition is not false/undefined
                let eq = await this.traverseAsync(val.eq);
                eq = await Macro.wash(eq);
                if (Array.isArray(eq)) result = eq.every(e=>e===eq[0]);
                else result = !!eq;
                return result?await this.traverseAsync(val.then):await this.traverseAsync(val.else);
            },
            $REDUCE:async (val)=>{
                let result = "";
                let iterable = this.data;
                let template = val;
                if (val.data && val.template) {
                    iterable = await this.connector.$DATA(val.data);
                    template = val.template;
                    result = val.result || result;
                }
                if (Array.isArray(iterable)) {
                    let resultObj = {result:result};
                    this.dataStack.unshift(resultObj); // push result accumulator to top of stack
                    for (let i of iterable) {
                        this.dataStack.unshift(i.json || i);
                        resultObj.result = await this.traverseAsync(template);
                        resultObj.result = await Macro.wash(resultObj.result);
                        this.dataStack.shift();
                    }
                    this.dataStack.shift();
                    return resultObj.result;
                }
            },
            $MAP:async (val)=>{
                let result = [];
                let iterable = this.data;
                let template = val;
                if (val.data && val.template) {
                    iterable = await this.connector.$DATA(val.data);
                    template = val.template;
                    result = val.result || result;
                }
                if (Array.isArray(iterable)) {
                    for (let i of iterable) {
                        this.dataStack.unshift(i.json || i);
                        let x = await this.traverseAsync(template);
                        result.push(await Macro.wash(x));
                        this.dataStack.shift();
                    }
                }
                return result;
            },
            $CONCAT:async (val)=>{
                let result = [];
                if (Array.isArray(val) && val.length > 0) {
                    let i = 0;
                    for (let block of val) {
                        let blockResult = await this.traverseAsync(block);
                        blockResult = await Macro.wash(blockResult);
                        if (!blockResult) continue;
                        else result = result.concat(blockResult);
                    }
                }
                return result;
            },
            $SORT:async (val)=>{
                if (typeof val !== 'string') this.log.error("$SORT expects one or more fields, comma separated");
                else if (!Array.isArray(this.data)) this.log.error("$SORT expects the data set to be an array");
                else {
                    let result = this.data;
                    let sorter = {};
                    let p = val.split(",");
                    for (let i=0;i<p.length;i++) {
                        let nv=p[i].split(':');
                        sorter[nv[0]] = parseInt(nv[1]) || 1;
                    }
                    result.sort((a,b)=>{
                        for (let k in sorter) {
                            let ak = a[k] || 0;
                            let bk = b[k] || 0;
                            if (ak !== bk) return (ak > bk)?sorter[k]:-sorter[k];
                        }
                        return 0;
                    });
                    return result;
                }
            },
            $VALUE:async(val)=>{
                let v = new MacroObject(this);
                v.fixedPath = val;
                v.protect = true;
                let x = await v.resolve();
                return x.value;
            },
            $PUT:async (val)=>{
                let result = {};
                if (this.options.dataSource.put) {
                    if (typeof val === 'string') val = {url:val,data:'{$value.}'};
                    val = await this.traverseAsync(val);
                    val = await Macro.wash(val);
                    return await this.options.dataSource.put(val.url,val.data);
                }
                else this.log.error("Datasource doesn't define 'put'");
            },
            $POST:async (val)=>{
                let result = {};
                if (this.options.dataSource.post) {
                    if (typeof val === 'string') val = {url:val,data:'{$value.}'};
                    val = await this.traverseAsync(val);
                    val = await Macro.wash(val);
                    return await this.options.dataSource.post(val.url,val.data);
                }
                else this.log.error("Datasource doesn't define 'put'");
            }

        }
    }

    recursiveReference(attr, str) {
        let matchSelf = new RegExp("{" + attr + "}");
        return matchSelf.test(str);
    }

    get helpers() {
        let self = this;
        return {
            /**
             * Helper that enables $math.function to resolve with the
             * provided arguments.
             *
             * @returns {*}
             */
            $math: function() {
                let args = Array.from(arguments);
                let method = args.shift();

                class methods {
                    static as(cast,a,b,c) {
                        if (cast==="string") {
                            return a.toString();
                        }
                        if (typeof a === "string") a = a.replace(/[^0-9.]/g,"");
                        if (cast==="integer") {
                            a = parseInt(a);
                            if (b === "pretty") a = a.toLocaleString("US");
                            return a;
                        }
                        if (cast==="float") {
                            a = parseFloat(a); // remove currency character
                            if (parseInt(b)) {
                                let exp = Math.pow(10,parseInt(b));
                                a = Math.round(a*exp)/exp;
                            }
                            if (c === "pretty" || b === "pretty") a = a.toLocaleString("US");
                            return a;
                        }
                        if (cast==="currency") {
                            return parseFloat(a).toLocaleString("US", {style:"currency",currency:(b||"USD")});
                        }
                        if (cast==="percent") {
                            let d = (typeof b !== "undefined")?parseInt(b):2;
                            return parseFloat(a).toLocaleString("US", {style:"percent",minimumFractionDigits:d});
                        }
                        return a;
                    }
                    static add() {
                        let values = Array.from(arguments);
                        let begin = Number(values.shift());
                        return values.reduce((r,v)=>r+Number(v),begin);
                    }
                    static subtract() {
                        let values = Array.from(arguments);
                        let begin = Number(values.shift());
                        return values.reduce((r,v)=>r-Number(v),begin);
                    }
                    static multiply() {
                        let values = Array.from(arguments);
                        let begin = Number(values.shift());
                        return values.reduce((r,v)=>r*Number(v),begin);
                    }
                    static divide() {
                        let values = Array.from(arguments);
                        if (values.every(e=>!!Number(e))) {
                            let begin = Number(values.shift());
                            return values.reduce((r,v)=>r/Number(v),begin);
                        } else {
                            return 0;
                        }
                    }
                    static precision(p,x) {
                        return Number.parseFloat(x).toFixed(p);
                    }
                    static diff(a,b,p) {
                        a = Number(a);
                        b = Number(b);
                        p = p?Number(p):0;
                        let diff = Number((Math.abs(a-b)/((a+b)/2))*100).toFixed(p);
                        return a>b?-diff:diff;
                    }
                }
                if (methods[method]) return methods[method](...args);
                else return Math[method](...args);
            },
            /**
             * Helper for formatting dates.
             * @param value, the source value, or "now"
             * @param method, "from" interprets date from pattern, "to" writes as pattern. "Add"
             * and "subtract" take shortened moment syntax
             * @param value, for "from" and "to" this is pattern: i.e. YYYY-MM-DD
             * @param format, result pattern. Not applicable to "to" method
             * @returns {string|Date}
             */
            $date: (source,method,value,format)=>{
                if (source === 'now') source = undefined;
                if (!method) return this.moment(source).toDate();
                if (method === "to") format = value;
                let input;
                switch(method) {
                    case "to":
                        input = this.moment(source);
                        break;
                    case "from":
                        input = this.moment(source, value);
                        break;
                    case "add":
                    case "subtract":
                        let parts = value.match(/^(\d+)([yQMwdhms])$/);
                        if (!parts) return null;
                        input = this.moment(source)[method](parts[1], parts[2]);
                        break;
                    default:
                        return "NA";
                }
                if (format) return input.format(format);
                else return input.toDate();
            },

            /**
             * Helper that will treat the given attribute as a macro name,
             * If no attribute it is given, the top of the data stack is returned as is.
             */
            $value: (attribute)=>{
                let macro = new MacroObject(this);
                if (typeof attribute !== 'undefined' && attribute !== "") macro.add(attribute);
                else macro.add(this.data);
                return macro;
            },

            /**
             * Sends a message to the log handler. Returns null. By default this
             * will invoke the log handler define in datasource, if any. Overwrite
             * the default handler either in datasource or by defining a different
             * $log function in the parse() datastack
             *
             * See also $LOG. It is synonymous.
             *
             * @param severity
             * @param message
             */
            $log: async (severity,message)=>{
                await this.log[severity](message);
            },

            /**
             * Generate ID's.
             *
             * @param len
             * @returns {string}
             */
            $id: (len=12)=>{
                len = parseInt(len);
                const com="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
                let res="";
                if( typeof(len) !== 'number' || len<4) len = 4; // ensure len is 4 or greater
                const now = new Date();
                const minutes = now.getMinutes();
                const seconds = now.getSeconds();
                res += com.charAt(minutes) + com.charAt(seconds); // add base time factors
                for (let i=0;i<2;i++) res += com.charAt(Math.round(Math.random()*(com.length-1))) // add base random
                const addedComplexity = len - 4; // anything greater than 4
                const timeFactors = {
                    hour : now.getHours(),
                    day : now.getDay(),
                    month : now.getMonth(),
                    year : now.getFullYear() % 2000 % 100,
                };
                const addedTime = Math.floor(addedComplexity/2); // how many extra elements of time to prepend
                const timeFactorKeys = Object.keys(timeFactors);
                for(let i = 0; i<addedTime && i <= timeFactorKeys.length - 1; i++){
                    res = com.charAt(timeFactors[timeFactorKeys[i]]) + res
                }
                const addedRandom = addedComplexity - addedTime; // how many extra elements of random to append
                for (let i=0;i<addedRandom;i++) res += com.charAt(Math.round(Math.random()*(com.length-1)))
                return res;
            }
        }
    }
};

/**
 * THe Macro class handles the parsing process where strings are
 * merged with data through a syntax of curly braces.
 *
 * Every string is in fact considered a macro and supports resolve()
 * and value. Resolve matches the identified macros if any to the
 * data source. Value returns the result.
 *
 * A Macro object is intended to persist through the parsing process
 * until it's value is actually needed. This allows for parsing and
 * handling values that may not resolve to strings.
 *
 * The Macro class supports a simple string with no macro syntax.
 * Identify() will cast the Macro to a MacroObject if it finds
 * syntax that does need handling.
 *
 * @type {Macro}
 */
class Macro {
    constructor(host,value) {
        this.host = host;       // firemacro host object
        this.type = 'string';
        this.value = value || "";
        this.protect = false;
    }
    add(item) {
        if (typeof item !== 'string' && this.value.length === 0) {
            if (item instanceof Macro) {
                this.value = item.value;
                this.type = item.type;
                this.protect = item.protect;
            } else {
                this.value = item;
                if (Array.isArray(this.value)) this.type = "array";
                else if (this.value instanceof Date) this.type = "date";
                else this.type = typeof this.value;
            }
        } else this.value += item;
    }
    toString() {
        return this.value.toString();
    }
    resolve() {
        return this;
    }

    /**
     * Step through the given string character by character, starting
     * a match when "{" is found and processing it on "}". Macros
     * can be recursive, so open and closing brackets are tested to
     * be at the same level
     *
     * We explicitly ignore double brackets, {{macro}}, rather than treat
     * it as unnecessary recursion. Many networks use the double bracket
     * notation
     *
     * @param host the fireMacro host object
     * @param str is the string to parse
     */
    static async identify(host,str) {
        let macStack = [];
        macStack.push(new Macro());
        for (let i = 0; i < str.length; i++) {
            if (str[i] === '{') {
                let foreignMacro = str.substring(i).match(/^\{{[\w-.]*?}}/);
                if (foreignMacro) {
                    i += foreignMacro[0].length;
                    macStack[0].add(foreignMacro[0]);
                } else {
                    macStack.unshift(new MacroObject(host));
                }
            } else if (str[i] === '}') {
                let top = macStack.shift();
                if (!(top instanceof MacroObject)) {
                    // unmatched closing bracket. not a macro
                    return new Macro(host,str);
                } else {
                    let r = await top.resolve();
                    if (r.type === 'string' && !r.protect) {
                        str = r.value+str.substring(i+1);
                        i=-1;
                    }
                    else macStack[0].add(r);
                }
            }
            else macStack[0].add(str[i]);
        }
        if (macStack.length > 1) {
            // unmatched opening bracket. not a macro
            return new Macro(host,str);
        } else {
            return await macStack[0].resolve();
        }
    }

    static async wash(o) {
        if (o === null) {
        } else if (typeof o === "boolean" || typeof o === 'number') {
        } else if (o instanceof Macro) {
            let x = await o.resolve();
            o = x.value;
            return await Macro.wash(o);
        } else if (Array.isArray(o)) {
            for (let i=0;i<o.length;i++) o[i] = await Macro.wash(o[i]);
        } else if (typeof o === 'object') {
            if (o.constructor.name.toLowerCase() !== 'objectid') {
                for (let a in o) o[a] = await Macro.wash(o[a]);
            }
        }
        return o;
    }
};

class MacroObject extends Macro {
    constructor(host) {
        super(host);
        this.ignore = false;
        this.protect = false;
        this.type = 'string';
        this.path=[""];
        this.parentheses = []; // tracks parentheses which protect "."
    }
    set fixedPath(str) {
        this.path = this.split(str,'.');
    }
    add(item) {
        if (!this.ignore) {
            if (typeof item === "string") {
                if (!/[A-Za-z0-9/|\(\)\!$%.,@#&~:_-]+/.test(item)) this.ignore = true;
                else if (item === '(') return this.parentheses.push(true);
                else if (item === ')') return this.parentheses.pop();
                else if (item === '.' && this.parentheses.length===0) return this.path.push("");
                else if (item === '!' && this.path.length === 1 && this.path[0].length === 0) {
                    this.protect = true;
                    return;
                }
            } else {
                if (this.path[this.path.length-1].length === 0) return this.path[this.path.length-1] = item;
            }
        }
        this.path[this.path.length-1] += item;
    }
    async resolve() {
        if (this.ignore) return '{'+this.path.join('.')+'}';
        // slice off the default value if present
        let meta = (typeof this.path[this.path.length-1] === "string")?this.path[this.path.length-1].split('|'):[];
        if (meta.length > 1) {
            this.default = meta[1];
            this.path[this.path.length-1] = meta[0];
        } else {
            this.default = null;
        }
        // drill the data stack to resolve the path. If the first item is not a string it is the result
        this.value = await this.drill();
        // if we have nothing, restore original path or remove if "clear" option is true
        if (this.value === null) {
            if (this.default !== null && typeof this.default !== "undefined") {
                if (this.default === "null") {
                    // force an actual null with the string "null"
                    this.value = null;
                    this.type = 'object';
                } else this.value = this.default;
            } else {
                if (this.host.options.clear) this.value = '';
                else this.value = '{'+this.path.join('.')+'}';
                this.protect = true;
            }
        } else if (this.value === "" && this.default !== null && typeof this.default !== "undefined") {
            // empty string is valid, but replaced by the default if specified
            if (this.default === "null") {
                // force an actual null with the string "null"
                this.value = null;
                this.type = 'object';
            } else this.value = this.default;
        }
        else if (Array.isArray(this.value)) this.type = "array";
        else if (this.value instanceof Date) this.type = "date";
        else if (typeof this.value === "object" && this.value.constructor.name.toLowerCase() === 'objectid') {
            // special processing to protect ObjectId's from further parsing
            this.type = "object";
            this.protect = true;
        }
        else this.type = typeof this.value;
        return this;
    }

    toString() {
        if (typeof this.value === 'string') return this.value;
        else if (typeof this.value === 'number') return this.value.toString();
        else if (typeof this.value === 'boolean') return this.value.toString();
        else if (typeof this.value === 'undefined') return "";
        else if (this.value instanceof Date) return this.value.toISOString();
        else if (this.value === null) return "";
        else if (this.value.constructor.name.toLowerCase() === 'objectid') {
            // special case mongo ObjectId's
            return this.value.toString();
        }
        if (Array.isArray(this.value)) return this.value.toString();
        else {
            let str = "";
            for (let d in this.value) str += '&' + d + '=' + this.value[d];
            return str;
        }
    }
    /**
     * Split a string, ignoring sections in parentheses
     * @param str
     * @param separator defaults to "."
     */
    split(str,separator=".") {
        let result = [];
        let val = "";
        let protect = false;
        for (let i=0;i<str.length;i++) {
            if (str[i] === "." && !protect) {
                result.push(val);
                val = "";
                continue;
            }
            if (str[i] === "(") protect = true;
            if (str[i] === ")") protect = false;
            val += str[i];
        }
        result.push(val);
        return result;
    }
    recursiveReference(attr, str) {
        let matchSelf = new RegExp("{" + attr + "}");
        return matchSelf.test(str);
    }
    async drill() {
        if (typeof this.path[0] !== 'string') {
            if (!(this.path[0] instanceof Macro && this.path[0].type === 'string')) return this.path[0];
        }
        let dataField = null;
        for (let i = 0; i < this.host.dataStack.length; i++) {
            if (dataField !== null) break; // data found
            dataField = this.host.dataStack[i]; // else try the next item on the stack
            for (let j = 0; j < this.path.length; j++) {
                if (this.path[j] instanceof Macro) this.path[j] = this.path[j].toString();
                if (Array.isArray(dataField)) {
                    let a;
                    for (a = 0; a < dataField.length; a++) {
                        if (dataField[a].name === this.path[j]) break;
                    }
                    if (a < dataField.length) dataField = dataField[a].value;
                    else dataField = null;
                } else if (dataField instanceof Date || (typeof dataField === 'string' &&
                    /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)$/.test(dataField))) {
                    // it's a date. We match ISO string dates as many datasets will have loaded as such
                    // we then check if a format is requested, otherwise return as is
                    let args = await Macro.wash(this.path.slice(j));
                    if (args.length === 1) dataField = this.host.moment(dataField).format(args[0]);
                } else if (typeof dataField === 'object') {
                    if (dataField[this.path[j]] !== undefined) dataField = dataField[this.path[j]];
                    else dataField = null;
                } else if (typeof dataField === "function") {
                    let args = await Macro.wash(this.path.slice(j));
                    dataField = await dataField.apply(this.host,args);
                    break;
                } else {
                    dataField = null;
                }
                if (dataField === null) break;
            }
        }
        return dataField;
    }
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
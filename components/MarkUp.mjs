import {marked} from "/lib/marked";
import WikiWord from "./WikiWord.mjs";
import API from './API.mjs';
import FireMacro from "/lib/firemacro";
import IdForge from "./IdForge.mjs";

export default class MarkUp {
    constructor() {
        this.wikiWord = new WikiWord('/#Wiki');
        this.marked = marked;
        // set to '/uml' to use local server
        this.umlServer = 'https://metric.im/uml';
    }
    async render(body,options={}) {
        body = await this.replaceExtensionBlocks(body,options);
        let wordified = this.wikiWord.process(body,options._pid);
        let result = await this.marked.parse(wordified);
        return result+"\n<style>\n.doclet-render h1{margin-top:0}\n</style>";
    }

    /**
     * Manually replace macro, uml and frame blocks. Marked is
     * supposed to support async token swaps, but it doesn't work
     * @param options
     * @returns {Promise<void>}
     */
    async replaceExtensionBlocks(body,options) {
        // replace macro elements from query string
        let args = Object.assign({},options);
        delete args._pid;
        if (Object.keys(args).length>0) {
            let fm = new FireMacro(body);
            body = await fm.parse(args);
        }
        // search for extension blocks
        let asyncBlocks = [];
        body = body.replace(/^~{3,4}(macro|plantuml|frame)(\(.*?\))?\n(.*?)\n~{3,4}/gsm,replace.bind(this));
        body = body.replace(/^`{3,4}(macro|plantuml|frame)(\(.*?\))?\n(.*?)\n`{3,4}/gsm,replace.bind(this));
        function replace(match,lang,args,text) {
            args = args?args.slice(1,-1).split(','):[];
            if (lang === 'plantuml') {
                let target = `${this.umlServer}/draw/${encodeURIComponent(text)}`;
                return `<img src="${target}" alt="UML Diagram"></img>`
            } else if (lang === 'frame') {
                let frames = text.replace(/^(.*?)(?:\[(.*?)\])?(\/(?:pull|analysis|metric|render)?\/.*?$)/gm, (match,title,style, path) => {
                    return `<div class='frame-container ${title?'titled':''}' ${style?'style="'+style+'"':''}>`
                      + `<div class='frame-title'>${title}</div>`
                      + `<iframe src="${path.replace(/"/g,'%22')}"></iframe></div>`
                });
                return `<div class='frame-set'>\n${frames}\n</div>`
            } else if (lang === 'macro') {
                let key = IdForge.randomId(12);
                asyncBlocks.push({key: key, lang: lang, args: args, text: text});
                return key;
            } else return text;
        }
        for (let block of asyncBlocks) {
            if (block.lang === 'macro') {
                let result = "";
                if (block.args[0]) {
                    let data = await API.get(block.args[0]);
                    if (data) {
                        if (!Array.isArray(data)) data = [data];
                        let fm = new FireMacro(block.text,{clear:true});
                        for (let record of data) {
                            result += await fm.parse({_account:this.prop},record);
                        }
                    } else {
                        result += "no data";
                    }
                }
                body = body.replace(block.key,result);
            }
        }
        return body;
    }
}

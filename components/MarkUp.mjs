import {marked} from "/lib/marked";
import WikiWord from "./WikiWord.mjs";

export default class MarkUp {
    constructor() {
        this.wikiWord = new WikiWord('/#Wiki');
        const extensions = {
            code(code,language) {
                if (language === 'plantuml') {
                    let target = "/uml?txt="+encodeURIComponent(code);
                    return `<img src=${target} alt="UML Diagram"></img>`
                } else if (language === 'frame') {
                    let frames = code.replace(/^(?:\[(.*?)\])?(\/(?:json|table|chart)(?:\.[a-z]+)?\/.*?$)/gm, (match,style, path) => {
                        return `<iframe ${style?'style="'+style+'"':''} src="/pull${path.replace(/"/g,'%22')}"></iframe>`;
                    });
                    return `<div class='frame-set'>\n${frames}\n</div>`
                } else return false;
            }
        };
        marked.use({gfm:true,renderer:extensions});
        this.marked = marked;
    }
    render(body,pid) {
        let wordified = this.wikiWord.process(body,pid);
        return marked(wordified)+"\n<style>\n.doclet-render h1{margin-top:0}\n</style>";
    }
}

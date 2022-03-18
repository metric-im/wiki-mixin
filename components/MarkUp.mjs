import {marked} from "/_wiki/lib/marked";
import WikiWord from "/_wiki/components/WikiWord.js";

export default class MarkUp {
    constructor() {
        this.wikiWord = new WikiWord('/');
        const plantuml = {
            code(code,language) {
                if (language === 'plantuml') {
                    let target = "/uml?txt="+encodeURIComponent(code);
                    return `<img src=${target} alt="UML Diagram"></img>`
                } else return false;
            }
        };
        marked.use({gfm:true,renderer:plantuml});
        this.marked = marked;
    }
    render(body) {
        let wordified = this.wikiWord.process(body);
        return marked(wordified)+"\n<style>\n.doclet-container h1{margin-top:0}\n</style>";
    }
}
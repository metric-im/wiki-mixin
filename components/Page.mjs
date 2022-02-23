import API from "/_wiki/components/API.js";
import {marked} from "/_wiki/lib/marked";
import WikiWord from "/_wiki/components/WikiWord.js";

export default class Page {
    constructor(docId,path) {
        this.docId = docId || "";
        this.doclet = {};
        this.path = path || "/";
    }
    async render(element) {
        this.doclet = await API.get('/wiki/'+this.docId);
        this.element = element;
        this.element.classList.add('wiki');
        this.element.innerHTML = `
            <div id="doclet-controls"></div>
            <div id="doclet-container">
                <div id="doclet-render" class="rendering"></div>
                <textarea id="doclet-editor" class="editing"></textarea>
            </div>`;
        this.html = this.element.querySelector('#doclet-render');
        this.editor = this.element.querySelector('#doclet-editor');
        this.addControls();
        this.wikiWord = new WikiWord(this.path);
        this.prepareMarked();
        this.editing(false);
        this.renderHtml();
    }
    addControls() {
        let element = this.element.querySelector("#doclet-controls");
        for (let b of [
            {icon:'edit',action:this.edit.bind(this),mode:'rendering'},
            {icon:'save',action:this.save.bind(this),mode:'rendering'},
            {icon:'trash',action:this.remove.bind(this),mode:'rendering'},
            {icon:'check',action:this.doneEditing.bind(this),mode:'editing'},
            {icon:'cross',action:this.cancelEditing.bind(this),mode:'editing'}
        ]) {
            let button = document.createElement('button');
            button.innerHTML=`<span class="icon icon-${b.icon}"/>`;
            button.classList.add(b.mode);
            button.addEventListener('click',b.action);
            element.appendChild(button);
        }
    }
    prepareMarked() {
        const plantuml = {
            code(code,language) {
                if (language === 'plantuml') {
                    let target = API.base+"/uml?txt="+encodeURIComponent(code);
                    return `<img src=${target} alt="UML Diagram"></img>`
                } else return false;
            }
        };
        marked.use({gfm:true,renderer:plantuml});
    }
    renderHtml() {
        let wordified = this.wikiWord.process(this.doclet.body);
        this.html.innerHTML = marked(wordified)+"\n<style>\n.doclet-container h1{margin-top:0}\n</style>";
    }
    async save() {
        let updated = await API.put('/wiki/'+this.doclet._id,this.doclet);
        if (updated) this.doclet = updated;
    }
    async remove() {
    }
    edit() {
        this.editor.innerHTML = this.doclet.body;
        this.editing(true);
    }
    doneEditing() {
        this.doclet.body = this.editText;
        this.renderHtml();
        this.editing(false);
    }
    cancelEditing() {
        this.editing(false);
    }
    editing(yes) {
        this.element.querySelectorAll('.editing').forEach((item)=>{
            item.style.display=yes?'block':'none';
        })
        this.element.querySelectorAll('.rendering').forEach((item)=>{
            item.style.display=yes?'none':'block';
        })
    }
}
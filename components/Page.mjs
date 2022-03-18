import API from "/_wiki/components/API.js";
import {marked} from "/_wiki/lib/marked";
import WikiWord from "/_wiki/components/WikiWord.js";
import {InputID,InputText} from "./InputText.mjs";
import {InputSelect} from "./InputSelect.mjs";
import {InputToggle} from "./InputToggle.mjs";

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
                <div id="render-container" class="rendering">
                    <div id="doclet-menu">menu</div>
                    <div id="doclet-render"></div>                
                </div>
                <div id="editor-container" class="editing">
                    <div id="doclet-properties"></div>
                    <textarea id="doclet-editor"></textarea>
                </div>
            </div>`;
        this.container = this.element.querySelector('#doclet-container');
        this.html = this.element.querySelector('#doclet-render');
        this.editor = this.element.querySelector('#doclet-editor');
        await this.addControls();
        await this.addProperties();
        this.wikiWord = new WikiWord(this.path);
        this.prepareMarked();
        this.editing(false);
        this.renderHtml();
    }
    async addProperties() {
        this.docletProperties = this.element.querySelector('#doclet-properties');
        this.elementID = this.new(InputID,{data:this.doclet});

    }
    async addControls() {
        this.controls = this.element.querySelector("#doclet-controls");
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
            this.controls.appendChild(button);
        }
    }
    prepareMarked() {
        const plantuml = {
            code(code,language) {
                if (language === 'plantuml') {
                    let target = "/uml?txt="+encodeURIComponent(code);
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
        let result = await API.put('/wiki/'+this.doclet._id,this.doclet);
        if (result.ok) {
            this.doclet = result.value;
            //TODO: remove explicit dependency on metric app-server
            if (window.metric) window.metric.toast.success('saved');
        } else {
            if (window.metric) window.metric.toast.error('there was an error saving the doclet. See console.');
            console.log(result.lastErrorObject);
        }
    }
    async remove() {
    }
    edit() {
        this.editor.value = this.doclet.body;
        this.editing(true);
    }
    doneEditing() {
        this.doclet.body = this.editor.value;
        this.renderHtml();
        this.editing(false);
    }
    cancelEditing() {
        this.editing(false);
    }
    editing(yes) {
        if (yes) {
            this.container.classList.add('editing');
            this.controls.classList.add('editing');
        } else {
            this.container.classList.remove('editing');
            this.controls.classList.remove('editing');
        }
        // this.element.querySelectorAll('.editing').forEach((item)=>{
        //     item.style.display=yes?'block':'none';
        // })
        // this.element.querySelectorAll('.rendering').forEach((item)=>{
        //     item.style.display=yes?'none':'block';
        // })
    }
}
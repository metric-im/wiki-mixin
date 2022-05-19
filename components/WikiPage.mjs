import Component from './Component.mjs';
import API from "./API.mjs";
import {marked} from "/lib/marked";
import {InputID,InputText,InputNumber} from "./InputText.mjs";
import MarkUp from "./MarkUp.mjs";
import {InputModifiedDate} from "./InputDate.mjs";
import {InputToggle} from "./InputToggle.mjs";
import WikiBlock from "./WikiBlock.mjs";


export default class WikiPage extends Component {
    constructor(props) {
        super(props);
        this.docId = this.props.docId || "";
        this.doclet = {};
        this.path = this.props.path || "/";
        this.markUp = new MarkUp();
    }
    async render(element) {
        await super.render(element);
        this.doclet = await API.get('/wiki/'+this.docId);
        // this.element.classList.add('wiki');
        this.element.innerHTML = `
            <div id="doclet-controls"></div>
            <div id="doclet-container">
                <div id="render-container" class="rendering">
                    <div id="doclet-menu" class="menu"></div>
                    <div id="doclet-render" class="Wiki">
                        <div id="doclet-content" class="doclet-render"></div>
                    </div>                
                </div>
                <div id="editor-container" class="editing">
                    <div id="doclet-properties"></div>
                    <textarea id="doclet-editor" wrap="soft"></textarea>
                </div>
            </div>`;
        this.container = this.element.querySelector('#doclet-container');
        this.html = this.element.querySelector('#doclet-content');
        this.editor = this.element.querySelector('#doclet-editor');
        await this.addControls();
        await this.addProperties();
        await this.addMenu();
        this.editing(false);
        this.html.innerHTML = this.markUp.render(this.doclet.body,this.doclet._id);
    }
    async addMenu() {
        this.docletMenu = this.element.querySelector('#doclet-menu');
        this.docletMenu.innerHTML = "";
        let toc = await API.get('/wikitoc/');
        let rootMenu = draw.call(this,this.docletMenu,toc[0]||[]);
        rootMenu.classList.add('root-menu')
        function draw(elem,doc) {
            let me = this.div('menuitem',elem);
            let label = this.div('label',me);
            label.innerHTML = doc.title || doc._id;
            label.addEventListener('click',(e)=>{document.location.href = '#Wiki/'+doc._id;})
            if (doc.children && doc.children.length > 0) {
                let tray = this.div('tray',me);
                for (let d of doc.children||[]) draw.call(this,tray,d);
            }
            return me;
        }
    }
    async addProperties() {
        this.docletProperties = this.element.querySelector('#doclet-properties');
        this.elementID = this.new(InputID,{title:"Doclet ID",data:this.doclet});
        await this.elementID.render(this.docletProperties);
        this.parentID = this.new(InputText,{name:"_pid",title:"Parent ID",data:this.doclet});
        await this.parentID.render(this.docletProperties);
        this.elementTitle = this.new(InputText,{name:"title",title:"Title",data:this.doclet});
        await this.elementTitle.render(this.docletProperties);
        let modDate = this.new(InputModifiedDate,{data:this.doclet});
        await modDate.render(this.docletProperties);
        let list = this.new(InputNumber,{name:"listed",title:"List Order",data:this.doclet});
        await list.render(this.docletProperties);
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
    async save() {
        let result = await API.put('/wiki/'+this.doclet._id,this.doclet);
        if (result.ok) {
            if (window.metric) window.metric.toast.success('saved');
            await this.addMenu();
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
        this.html.innerHTML = this.markUp.render(this.doclet.body,this.doclet._id);
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
    }
}
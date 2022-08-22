import Component from './Component.mjs';
import API from "./API.mjs";
import {marked} from "/lib/marked";
import {InputID,InputText,InputNumber} from "./InputText.mjs";
import MarkUp from "./MarkUp.mjs";
import {InputModifiedDate} from "./InputDate.mjs";
import {InputSelect} from "./InputSelect.mjs";
import {InputToggle} from "./InputToggle.mjs";

export default class WikiPage extends Component {
    constructor(props) {
        super(props);
        this.docId = this.props.docId || "";
        this.doclet = {};
        this.path = this.props.path || "/";
        this.markUp = new MarkUp();
        this.menu = new WikiMenu(this);
    }
    async render(element,options={}) {
        await super.render(element);
        this.options = options;
        await this.load();
        if (!this.doclet) return;
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
        await this.menu.render(this.element,this.doclet);
        this.editing(false);
        options._pid = this.doclet._id;
        this.html.innerHTML = await this.markUp.render(this.doclet.body,options);
    }
    async load() {
        try {
            this.index = await API.get('/wiki/index');
            this.doclet = await API.get('/wiki/'+this.docId);
        } catch(e) {
            this.element.innerHTML='<div id="unavailable">Page unavailable. Return to <a href="/#Wiki/WikiHome">Wiki Home</a>.</div>'
        }
    }
    async addProperties() {
        this.docletProperties = this.element.querySelector('#doclet-properties');
        if (!this.doclet._id) this.doclet._id = {a:this.props.context.userId};
        if (!this.doclet._pid) this.doclet._pid = {};
        this.elementID = this.new(InputID,{name:"d",title:"Doclet ID",data:this.doclet._id,allowEdit:true});
        await this.elementID.render(this.docletProperties);
        this.elementTitle = this.new(InputText,{name:"title",title:"Title",data:this.doclet});
        await this.elementTitle.render(this.docletProperties);
        if (this.docId!=="Home" || this.props.context.super) {
            this.visibility = this.new(InputSelect,
                {name:"visibility",title:"Visibility",data:this.doclet,options:[
                        this.props.context.userId,this.props.context.id,'public'
                    ]}
            );
            await this.visibility.render(this.docletProperties);
        } else {
            this.doclet.visibility = this.props.context.id;
        }
        await this.elementID.render(this.docletProperties);
        this.parentID = this.new(InputSelect,{name:"_pid",data:this.doclet,title:"Parent Doc",
            options:[''].concat(this.index.map(r=>({name:r._id.a+"/"+r._id.d,value:r._id})))});
        await this.parentID.render(this.docletProperties);
        this.rootmenu = this.new(InputToggle,{name:"rootmenu",data:this.doclet,title:"Root"});
        await this.rootmenu.render(this.docletProperties);
        let list = this.new(InputNumber,{name:"listed",title:"List Order",data:this.doclet});
        await list.render(this.docletProperties);
        let modDate = this.new(InputModifiedDate,{data:this.doclet});
        await modDate.render(this.docletProperties);
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
    async save() {
        let result = await API.put('/wiki/'+this.doclet._id.d,this.doclet);
        if (result) {
            window.toast.success('saved');
            await this.menu.render(this.element,this.doclet);
        } else {
            window.toast.error('there was an error saving the doclet. See console.');
            console.log(result.lastErrorObject);
        }
    }
    async remove() {
        await window.toast.prompt(`Delete ${this.doclet._id.a}/${this.doclet._id.d}?`);
    }
    edit() {
        this.editor.value = this.doclet.body;
        this.editing(true);
    }
    async doneEditing() {
        this.doclet.body = this.editor.value;
        this.html.innerHTML = await this.markUp.render(this.doclet.body,this.options);
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

class WikiMenu {
    constructor(wikiPage) {
        this.page = wikiPage;
    }
    async render(elem,doc) {
        this.docletMenu = this.page.element.querySelector('#doclet-menu');
        this.docletMenu.innerHTML = "";
        this.root = this.findRoot(doc);
        if (!this.root) return;
        let rootMenu = this.draw.call(this,this.docletMenu,this.root);
        rootMenu.classList.add('root-menu');
    }
    draw(elem,doc) {
        let me = this.page.div('menuitem',elem);
        let label = this.page.div('label',me);
        label.innerHTML = doc.title || doc._id.d;
        label.addEventListener('click',(e)=>{document.location.href = '#Wiki/'+doc._id.d;})
        let children = this.page.index.filter(r=>(r._pid&&r._pid.a===doc._id.a&&r._pid.d===doc._id.d));
        if (children && children.length > 0) {
            let tray = this.page.div('tray',me);
            for (let d of children||[]) this.draw(tray,d);
        }
        return me;
    }
    findRoot(doc) {
        if (!doc) return null;
        if (doc.rootmenu) return doc;
        if (!doc._pid) return null;
        else return this.findRoot(this.page.index.find(r=>(
            r._id.a===doc._pid.a&&r._id.d===doc._pid.d
        )))
    }
}
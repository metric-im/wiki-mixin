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
        this.originalBody = this.doclet.body;
        this.element.innerHTML = `
            <div id="doclet-controls"></div>
            <div id="mobile-doclet-menu">
                <div id="mobile-menu-content"></div>
            </div>
            <span id="menu-toggle" class="icon icon-menu"/></span>
            <div id="doclet-container">
                <div id="render-container" class="rendering">
                    <div id="doclet-menu" class="menu">
                        <div id="menu-content"></div>
                    </div>
                    <div id="doclet-render" class="Wiki">
                        <div id="doclet-content" class="doclet-render"></div>
                    </div>
                </div>
                <div id="editor-container" class="editing">
                    <div id="doclet-properties"></div>
                    <textarea id="doclet-editor" wrap="soft"></textarea>
                </div>
            </div>`;
        let body = document.querySelector(".Main");
        this.container = this.element.querySelector('#doclet-container');
        this.html = this.element.querySelector('#doclet-content');
        this.editor = this.element.querySelector('#doclet-editor');
        this.controls = this.element.querySelector("#doclet-controls");
        if (!this.props.readOnly) {
            await this.addControls();
            await this.addProperties();
        }
        await this.menu.render(this.element,this.doclet);
        this.editing(false);
        options._pid = this.doclet._id.d;
        this.html.innerHTML = await this.markUp.render(this.doclet.body,options);
        let renderContainer = this.element.querySelector('#render-container');
        let menu = this.element.querySelector('#doclet-menu');
        let mobileTray = this.element.querySelector('#mobile-doclet-menu');
        let menuToggle = this.element.querySelector('#menu-toggle');
        let mobile = matchMedia('(max-width:600px)');
        menuPosition();
        mobile.addEventListener('change',menuPosition);
        menuToggle.addEventListener('click',(event)=>{
            mobileTray.classList.toggle('active');
            this.controls.classList.toggle('hidden');
        })
        function menuPosition() {
            if (mobile.matches) mobileTray.appendChild(menu);
            else renderContainer.prepend(menu);
        }
    }
    async load() {
        try {
            this.index = await API.get('/wiki/index');
            let qs = Object.keys(this.options||{}).reduce((r,key)=>{
                r += `&${key}=${this.options[key]}`
                return r;
            },'');
            if (qs.length > 0) qs = '?'+qs.slice(1);
            this.doclet = await API.get('/wiki/'+this.docId+qs);
        } catch(e) {
            this.element.innerHTML='<div id="unavailable">Page unavailable. Return to <a href="/#Wiki/WikiHome">Wiki Home</a>.</div>'
        }
    }
    async addProperties() {
        this.docletProperties = this.element.querySelector('#doclet-properties');
        if (!this.doclet._id) this.doclet._id = {a:this.props.context.id};
        if (!this.doclet._pid) this.doclet._pid = "";
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
            this.visibility.value = this.doclet._id.a
        } else {
            this.doclet.visibility = this.props.context.id;
        }
        await this.elementID.render(this.docletProperties);
        this.parentID = this.new(InputSelect,{name:"_pid",data:this.doclet,title:"Parent Doc",
            options:[''].concat(this.index.map(r=>(r._id.d)))});
        await this.parentID.render(this.docletProperties);
        this.rootmenu = this.new(InputToggle,{name:"rootmenu",data:this.doclet,title:"Root"});
        await this.rootmenu.render(this.docletProperties);
        let list = this.new(InputNumber,{name:"listed",title:"List Order",data:this.doclet});
        await list.render(this.docletProperties);
        let modDate = this.new(InputModifiedDate,{data:this.doclet});
        await modDate.render(this.docletProperties);
    }
    async addControls() {
        for (let b of [
            {icon:'edit',action:this.edit.bind(this),mode:'rendering'},
            {icon:'save',action:this.save.bind(this),mode:'rendering',class:"important-if-modified"},
            {icon:'trash',action:this.remove.bind(this),mode:'rendering'},
            {icon:'check',action:this.doneEditing.bind(this),mode:'editing'},
            {icon:'cross',action:this.cancelEditing.bind(this),mode:'editing'}
        ]) {
            let button = document.createElement('button');
            button.innerHTML=`<span class="icon icon-${b.icon}"/>`;
            button.classList.add(b.mode);
            if (b.class) button.classList.add(b.class);
            button.addEventListener('click',b.action);
            this.controls.appendChild(button);
        }
    }
    async save() {
        this.element.classList.remove('modified')
        let result = await API.put('/wiki/'+this.doclet._id.d,this.doclet);
        if (result) {
            window.toast.success('saved');
            window.removeEventListener("beforeunload",(event)=>{});
            await this.render(null,this.options); // null because this.element already attached to parent
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
        if (this.editor.value !== this.originalBody) {
            window.addEventListener("beforeunload", (event)=>{
                event.preventDefault();
                event.returnValue = true;
            });
            this.element.classList.add('modified')
        } else {
            window.removeEventListener("beforeunload",(event)=>{});
            this.element.classList.remove('modified')
        }
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
        this.docletMenu = this.page.element.querySelector('#menu-content');
        let docId = doc._created?doc._id.d:doc._pid;
        let indexDoc = this.page.index.find(r=>r._id.d===docId);
        this.root = this.findRoot(indexDoc);
        if (!this.root) return;
        this.docletMenu.innerHTML = "";
        let rootMenu = this.draw.call(this,this.docletMenu,this.root);
        rootMenu.classList.add('root-menu');
    }
    draw(elem,doc) {
        let me = this.page.div('menuitem',elem);
        let label = this.page.div('label',me);
        let toggle = this.page.div('toggle',label);
        let labelText = this.page.div('label-text',label);
        toggle.innerHTML = "<span class='icon icon-chevron-with-circle-right'></span> ";
        labelText.innerHTML = doc.title || doc._id.d;
        toggle.addEventListener('click',(e)=>{me.classList.toggle('open')});
        labelText.addEventListener('click',(e)=>{document.location.href = '#Wiki/'+doc._id.d});
        if (doc._id.d === this.page.props.context.path.slice(1)) {
            this.openTree(me);
        }
        let children = this.page.index.filter(r=>(r._pid===doc._id.d));
        if (children && children.length > 0) {
            let tray = this.page.div('tray',me);
            for (let d of children||[]) this.draw(tray,d);
        } else {
            toggle.style.opacity = 0;
            toggle.style.cursor = 'default';
        }
        return me;
    }
    openTree(me) {
        me.classList.add('open');
        let parent = me.parentElement.closest('.menuitem');
        if (parent) this.openTree(parent);
        else return;
    }
    findRoot(doc) {
        if (!doc) return null;
        if (doc.rootmenu) return doc;
        if (!doc._pid || doc._id.d === doc._pid) return null;
        else return this.findRoot(this.page.index.find(r=>r._id.d===doc._pid));
    }
}

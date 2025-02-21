import Component from './Component.mjs';
import MarkUp from './MarkUp.mjs';
import XipperMonitor from './XipperMonitor.mjs';

export default class WikiBlock extends Component {
    constructor(props) {
        super(props);
        this.markUp = new MarkUp();
    }
    async render(element) {
        await super.render(element);
        this.element.classList.add('Wiki');
        let html = `<div class="content">`;
        if (this.props.title) html += `<div class="form-element-title">${this.props.title}</div>`;
        html += `<div class="doclet-render rendering"></div>`;
        html += `<textarea class="doclet-editor editing ${this.props.title?'titled':''}" wrap="soft"></textarea>`;
        html += '</div>';
        html += `<div class="control"></div>`;
        this.element.innerHTML = html;
        if (!this.props.readOnly) {
            this.addControls();
        }
        this.docHtml = this.element.querySelector('.doclet-render');
        this.docEdit = this.element.querySelector('.doclet-editor');
        this.docHtml.innerHTML = await this.markUp.render(this.props.data[this.props.name]||"");
        this.docEdit.value = this.props.data[this.props.name]||"";
        this.xipperMonitor = new XipperMonitor(this.docEdit);
        this.editing(false);
    }
    addControls() {
        let element = this.element.querySelector(".control");
        for (let b of [
            {icon:'edit',action:this.edit.bind(this),mode:'rendering'},
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
    edit() {
        this.docEdit.innerText = this.props.data[this.props.name];
        this.docEdit.focus();
        this.editing(true);
    }
    async doneEditing() {
        this.props.data[this.props.name] = this.docEdit.value;
        this.docHtml.innerHTML = await this.markUp.render(this.props.data[this.props.name]||"");
        this.editing(false);
        await this.announceUpdate(this.props.name);
        this.lock.add('exit');
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
        if (yes) this.lock.add('save');
        else this.lock.remove('save');
    }

    /**
     * Copied from app-server/components/Component
     * @param attributeName
     * @returns {Promise<void>}
     */
    async announceUpdate(attributeName) {
        let hubComponent = this;
        while (hubComponent && !hubComponent.hub) {
            if (hubComponent.parent && hubComponent.parent === hubComponent) hubComponent = null;
            hubComponent = hubComponent.parent;
        }
        if (hubComponent) await hubComponent.handleUpdate(attributeName);
    }
}

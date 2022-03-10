import MarkUp from './MarkUp.mjs';

export default class Block {
    constructor(props) {
        this.props = props;
        this.element = document.createElement("div");
        this.markUp = new MarkUp();
    }
    async render(element) {
        element.appendChild(this.element);
        this.element.classList.add('wiki-block')
        this.element.innerHTML=`
            <div class="content">
                <div class="doclet-render rendering"></div>
                <textarea class="doclet-editor editing"></textarea>
            </div>
            <div class="control"></div>`;
        this.addControls();
        this.docHtml = this.element.querySelector('.doclet-render');
        this.docEdit = this.element.querySelector('.doclet-editor');
        this.docHtml.innerHTML = this.markUp.render(this.props.data[this.props.name]||"");
        this.docEdit.value = this.props.data[this.props.name]||"";
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
        this.docHtml.innerHTML = this.markUp.render(this.props.data[this.props.name]||"");
        this.editing(false);
        await this.announceUpdate(this.props.name);
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
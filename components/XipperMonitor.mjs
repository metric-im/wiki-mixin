/**
 * XipperMonitor can be added to a text input field. It applies xipper
 * encoding and pass phrase handling
 */
import Xipper from '/lib/xipper/Xipper.mjs';
export default class XipperMonitor {
    constructor(element) {
        this.xipper = new Xipper();
        this.element = element;
        this.renderTag = document.createElement("div");
        this.element.parentElement.append(this.renderTag);
        this.renderTag.innerText='@@';
        this.renderTag.title = '[xipper] enter pass phrase'
        this.renderTag.addEventListener('click',this.activate.bind(this));
    }
    async activate(element) {
        console.log('clickety')
    }
};
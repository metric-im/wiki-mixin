import Component from "./Component.mjs";
import {InputTextArea} from "./InputText.mjs";
export default class UmlEditor extends Component {
  constructor(props) {
    super(props);
  }
  async render(element) {
    await this.super(element);
    this.design = await this.draw(InputTextArea,{},this.element);
    this.design.element.classList.add('uml-design');
    this.design.value = "a -> b\nb -> c"
    this.display = this.div('uml-display',this.element);
    this.display.value = "hello"
  }
}

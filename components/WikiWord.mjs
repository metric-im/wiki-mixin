/**
 * WikiWords are camel case strings found in a doclet.
 * They are automatically rendered into doclet links.
 * This assists in a structured definition of formal
 * names.
 */
export default class WikiWord {
    constructor(path) {
        this.path = path;
        if (path.slice(-1)==='/') this.path.slice(0,-1);
    }
    /**
     * Replace standalone wikiwords with links. The processor
     * attempts to ignore text that is not meant to be linked.
     * A link can be forced by surrounding it in brackets. A link
     * can be ignored by prefacing it with a bang (exclamation)
     * @returns {string}
     */
    process(text,_pid) {
        let lines = text.split('\n');
        let newLines = [];
        let skipping = false;
        for (let line of lines) {
            if (line.match(/^(```|~~~)/)) skipping = !skipping;
            if (!skipping) {
                line = line.replace(/(^|[^a-zA-Z0-9:_\-=.["'}{\\/])([!A-Z][A-Z0-9]*[a-z][a-z0-9_]*[A-Z][A-Za-z0-9_]*)/g,(match,pre,word)=>{
                    if (word.charAt(0) === '!') return pre+(word.slice(1));
                    else if (pre === "W:") return `[${word}](wikipedia.org?s=${word})`;
                    else if (pre === "G:") return `[${word}](google.com?s=${word})`;
                    else return `${pre}[${word}](${this.path}/${word}${_pid?`?_pid=${_pid}`:""})`;
                });
            }
            newLines.push(line);
        }
        return newLines.join('\n');
    }
}

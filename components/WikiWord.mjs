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
            if (line.match(/^[`~]{3,4}/)) {
                skipping = !skipping;
                if (!skipping) {  // skip a close block line
                    newLines.push(line);
                    continue;
                }
            }
            if (!skipping) {
                // To force a link not in camel case surround the word in brackets
                line = line.replace(/\[([A-Za-z0-9]+)\]/g,(match,word)=>{
                    return `[${word}](${this.path}/${word})`;
                });
                line = line.replace(/(^|[^a-zA-Z0-9:_\-=.["'}{\\/])([!A-Z][A-Z0-9]*[a-z][a-z0-9_]*[A-Z][A-Za-z0-9_]*)/g,(match,pre,word)=>{
                    if (word.charAt(0) === '!') return pre+(word.slice(1));
                    else if (pre === "W:") return `[${word}](wikipedia.org?s=${word})`;
                    else if (pre === "G:") return `[${word}](google.com?s=${word})`;
                    else return `${pre}[${word}](${this.path}/${word})`;
                });
            }
            newLines.push(line);
        }
        return newLines.join('\n');
    }
}

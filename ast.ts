import { Event } from "./event.js";
import { EventParser } from "./block.js";

// Types for the AST

type Attributes = Record<string, string>;

interface HasAttributes {
  attributes?: Attributes;
}

interface HasChildren {
  children: any[];
}

interface HasInlineChildren {
  children: Inline[];
}

interface HasBlockChildren {
  children: Block[];
}

type Block = Para
           | Heading
           | ThematicBreak
           | Div
           | BlockQuote
           | List
           | Table ;

interface Para extends HasAttributes, HasInlineChildren {
  tag: "para";
}

interface Heading extends HasAttributes, HasInlineChildren {
  tag: "heading";
  level: number;
}

interface ThematicBreak extends HasAttributes {
  tag: "thematic_break";
}

interface Div extends HasAttributes, HasBlockChildren {
  tag: "div";
  children: Block[];
}

interface BlockQuote extends HasAttributes, HasBlockChildren {
  tag: "blockquote";
  children: Block[];
}

interface List extends HasAttributes {
  tag: "list";
  children: ListItem[];
  // TODO
}

interface Table extends HasAttributes {
  tag: "table";
  children: TableRow[];
  // TODO
}

type Inline = Str
            | SoftBreak
            | HardBreak
            | Emoji
            | Verbatim
            | RightSingleQuote
            | Emph
            | Strong
            | Link
            | Image
            | Span
            | Mark
            | Insert
            | Delete
            | DoubleQuoted
            | SingleQuoted
            ;

interface Str extends HasAttributes {
  tag: "str";
  text: string;
}

interface RightSingleQuote extends HasAttributes {
  tag: "right_single_quote";
  text: string;
}

interface SoftBreak extends HasAttributes {
  tag: "softbreak";
}

interface HardBreak extends HasAttributes {
  tag: "hardbreak";
}

interface Emoji extends HasAttributes {
  tag: "emoji";
  alias: string;
}

interface Verbatim extends HasAttributes {
  tag: "verbatim";
  text: string;
}

interface Link extends HasAttributes, HasInlineChildren {
  tag: "link";
  destination: string;
}

interface Image extends HasAttributes, HasInlineChildren {
  tag: "image";
  destination: string;
}

interface Emph extends HasAttributes, HasInlineChildren {
  tag: "emph";
}

interface Strong extends HasAttributes, HasInlineChildren {
  tag: "strong";
}

interface Span extends HasAttributes, HasInlineChildren {
  tag: "span";
}

interface Mark extends HasAttributes, HasInlineChildren {
  tag: "mark";
}

interface Delete extends HasAttributes, HasInlineChildren {
  tag: "delete";
}

interface Insert extends HasAttributes, HasInlineChildren {
  tag: "insert";
}

interface DoubleQuoted extends HasAttributes, HasInlineChildren {
  tag: "double_quoted";
}

interface SingleQuoted extends HasAttributes, HasInlineChildren {
  tag: "single_quoted";
}

interface ListItem extends HasAttributes, HasBlockChildren {
  tag: "list_item";
  // TODO
}

interface TableRow extends HasAttributes {
  tag: "table_row";
  children: TableCell[];
  // TODO
}

interface TableCell extends HasAttributes, HasBlockChildren {
  tag: "table_cell";
  // TODO
}

type Node = Doc | Block | Inline | ListItem | TableRow | TableCell ;

interface Reference {

}

interface Footnote {

}

interface Doc extends HasBlockChildren, HasAttributes {
  tag: "doc";
  references: Record<string, Reference>;
  footnotes: Record<string, Footnote>;
}

interface Container {
  children: any[];
  attributes?: Attributes;
  data?: any;
}

const addStringContent = function(node : Inline, buffer : string[]) : void {
  if ("text" in node) {
    buffer.push(node.text);
  } else if (node.tag === "softbreak") {
    buffer.push("\n");
  } else if ("children" in node) {
    node.children.forEach(child => {
      addStringContent(child, buffer);
    });
  }
}

const getStringContent = function(node : Inline) : string {
  let buffer : string[] = [];
  addStringContent(node, buffer);
  return buffer.join('');
}

const romanDigits : Record<string, number> = {
  i: 1,
  v: 5,
  x: 10,
  l: 50,
  c: 100,
  d: 500,
  m: 1000,
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000
};

const romanToNumber = function(s : string) : number {
  // go backwards through the digits
  let total = 0;
  let prevdigit = 0;
  let i = s.length - 1;
  while (i >= 0) {
    let c = s.charAt(i);
    let n = romanDigits[c];
    if (!n) {
      throw("Encountered bad character in roman numeral " + s);
    }
    if (n < prevdigit) { // e.g. ix
      total = total - n;
    } else {
      total = total + n;
    }
    prevdigit = n;
    i = i - 1;
  }
  return total;
}


const getListStart = function(marker : string, style : string) : number | null {
  let numtype = style.replace(/[().]/g, "");
  let s = marker.replace(/[().]/g, "");
  switch (numtype) {
    case "1": return parseInt(s,10);
    case "A": return ((s.codePointAt(0) || 65) - 65 + 1); // 65 = "A"
    case "a": return ((s.codePointAt(0) || 97) - 97 + 1); // 97 = "a"
    case "I": return romanToNumber(s);
    case "i": return romanToNumber(s);
  }
  return null;
}

const addChildToTip = function(containers : Container[], child : Node) : void {
  /*
  if containers[#containers].t == "list" and
      not (child.t == "list_item" or child.t == "definition_list_item") then
    -- close list
    local oldlist = table.remove(containers)
    add_child_to_tip(containers, oldlist)
  end
  if child.t == "list" then
    if child.pos then
      child.pos[2] = child.c[#child.c].pos[2]
    end
    -- calculate tightness (TODO not quite right)
    local tight = true
    for i=1,#child.c do
      tight = tight and is_tight(child.c[i].startidx,
                                   child.c[i].endidx, i == #child.c)
      child.c[i].startidx = nil
      child.c[i].endidx = nil
    end
    child.tight = tight

    -- resolve style if still ambiguous
    resolve_style(child)
  end
  */
  let tip = containers[containers.length - 1];
  if (!tip) {
    throw("Container stack is empty!");
  }
  tip.children.push(child);
}

interface ParseOptions {
  sourcePositions?: boolean;
  warn?: (message : string, pos : number) => void;
}

// Parsing ocntext:
enum Context {
  Normal = 0,    // add str nodes as children of tip
  Verbatim = 1,  // gather str, escape, softbreak, hardbreak in accumulatedText
  Literal = 2    // gather str, softbreak, hardbreak in accumulatedText
}

const parse = function(input : string, options : ParseOptions) : Doc {
  let context = Context.Normal;
  let accumulatedText : string[] = [];
  const references : Record<string, Reference> = {};
  const footnotes : Record<string, Footnote> = {};
  const identifiers : Record<string, boolean> = {}; // identifiers used
  const attributes : Attributes = {}; // accumulated block attributes
  const defaultWarnings = function(message : string, pos : number) {
    process.stderr.write(message + (pos ? " at " + pos : "") + "\n");
  }
  const warn = options.warn || defaultWarnings;
  const parser = new EventParser(input, warn);

  const pushContainer = function(data ?: any) {
      let container = {children: [], data: data};
      containers.push(container);
  };
  const popContainer = function() {
      let node = containers.pop();
      if (!node) {
        throw("Container stack is empty");
      }
      return node;
  };
  const topContainer = function() {
    if (containers.length > 0) {
      return containers[containers.length - 1];
    } else {
      throw("Container stack is empty");
    }
  }
  // points to last child of top container, or top container if
  // it doesn't have children
  const getTip = function() : Container {
    let top = topContainer();
    if (top.children.length > 0) {
      return top.children[top.children.length - 1];
    } else {
      return top;
    }
  }

  const handleEvent = function(containers : Container[], event : Event) : void {
    let node;
    switch (event.annot) {
      case "str":
        let txt = input.substring(event.startpos, event.endpos + 1);
        if (context === Context.Normal) {
          addChildToTip(containers, {tag: "str", text: txt});
        } else {
          accumulatedText.push(txt);
        }
        break;
      case "softbreak":
        if (context === Context.Normal) {
          addChildToTip(containers, {tag: "softbreak"});
        } else {
          accumulatedText.push("\n");
        }
        break;
      case "escape":
        if (context === Context.Verbatim) {
          accumulatedText.push("\\");
        }
        break;
      case "hardbreak":
        if (context === Context.Normal) {
          addChildToTip(containers, {tag: "hardbreak"});
        } else {
          accumulatedText.push("\n");
        }
        break;
      case "emoji":
        if (context === Context.Normal) {
          let alias = input.substring(event.startpos + 1, event.endpos);
          addChildToTip(containers, {tag: "emoji", alias: alias});
        } else {
          let txt = input.substring(event.startpos, event.endpos + 1);
          accumulatedText.push(txt);
        }
        break;
      case "+emph":
        pushContainer();
        break;
      case "-emph":
        node = popContainer();
        addChildToTip(containers, {tag: "emph", children: node.children});
        break;
      case "+strong":
        pushContainer();
        break;
      case "-strong":
        node = popContainer();
        addChildToTip(containers, {tag: "strong", children: node.children});
        break;
      case "+span":
        pushContainer();
        break;
      case "-span":
        node = popContainer();
        addChildToTip(containers, {tag: "span", children: node.children});
        break;
      case "+mark":
        pushContainer();
        break;
      case "-mark":
        node = popContainer();
        addChildToTip(containers, {tag: "mark", children: node.children});
        break;
      case "+delete":
        pushContainer();
        break;
      case "-delete":
        node = popContainer();
        addChildToTip(containers, {tag: "delete", children: node.children});
        break;
      case "+insert":
        pushContainer();
        break;
      case "-insert":
        node = popContainer();
        addChildToTip(containers, {tag: "insert", children: node.children});
        break;
      case "+double_quoted":
        pushContainer();
        break;
      case "-double_quoted":
        node = popContainer();
        addChildToTip(containers, {tag: "double_quoted", children: node.children});
        break;
      case "+single_quoted":
        pushContainer();
        break;
      case "-single_quoted":
        node = popContainer();
        addChildToTip(containers, {tag: "single_quoted", children: node.children});
        break;
      case "+attributes":
        pushContainer();
        break;
      case "-attributes":
        node = popContainer();
          console.log(node);
        if (node.attributes && containers.length > 0) {
          let tip = getTip();
          if (!tip.attributes) {
            tip.attributes = {};
          }
          for (const k in node.attributes) {
            if (k === "class") {
              if (tip.attributes[k]) {
                tip.attributes[k] = tip.attributes[k] +
                                      " " + node.attributes[k];
              } else {
                tip.attributes[k] = node.attributes[k];
              }
            } else {
              tip.attributes[k] = node.attributes[k];
            }
          }
        }
        break;
      case "class":
        let top = topContainer();
        let cl = input.substring(event.startpos, event.endpos + 1);
        if (!top.attributes) {
          top.attributes = {};
        }
        if (top.attributes.class) {
          top.attributes.class = top.attributes.class + " " + cl;
        } else {
          top.attributes.class = cl;
        }
        break;
      case "+linktext":
        pushContainer();
        break;
      case "-linktext":
        // we don't pop yet, but wait for -destination
        break;
      case "+destination":
        context = Context.Literal;
        break;
      case "-destination":
        node = popContainer();  // the container added by +linktext
        addChildToTip(containers, {tag: "link", destination: accumulatedText.join(""), children: node.children});
        context = Context.Normal;
        accumulatedText = [];
        break;
      case "+verbatim":
        context = Context.Verbatim;
        break;
      case "-verbatim":
        addChildToTip(containers, {tag: "verbatim",
                                   text: accumulatedText.join("")});
        context = Context.Normal;
        accumulatedText = [];
        break;
      case "+para":
        pushContainer();
        break;
      case "-para":
        node = popContainer();
        addChildToTip(containers, {tag: "para", children: node.children});
        break;
      case "+heading":
        pushContainer({ level: 1 + event.endpos - event.startpos });
        break;
      case "-heading":
        node = popContainer();
        addChildToTip(containers, {tag: "heading",
                                   level: node.data.level,
                                   children: node.children });
        break;
      case "+blockquote":
        pushContainer();
        break;
      case "-blockquote":
        node = popContainer();
        addChildToTip(containers, {tag: "blockquote", children: node.children});
        break;
      case "+div":
        pushContainer();
        break;
      case "-div":
        node = popContainer();
        addChildToTip(containers, {tag: "div", children: node.children});
        break;
      case "thematic_break":
        addChildToTip(containers, {tag: "thematic_break"});
        break;
      case "right_single_quote":
        addChildToTip(containers, {tag: "right_single_quote", text: "'"});
        break;
      case "blankline":
        break;
      default:
        throw("Unknown event " + event.annot);
    }
  }

  const doc : Doc =
              { tag: "doc",
                references: references,
                footnotes: footnotes,
                attributes: {},
                children: []
              };

  let containers : Container[] = [doc];

  for (const event of parser) {
    handleEvent(containers, event);
  }

  // close any open containers
  while (containers.length > 1) {
    let node = containers.pop();
    // addChildToTip(containers, node);
    // note: doc container doesn't have pos, so we check: // TODO
    // if (sourceposmap && containers[containers.length - 1].pos) {
    //   containers[#containers].pos[2] = node.pos[2]
    // }
  }
  // doc = addSections(doc); // TODO

  return doc;
}

export {
  parse,
  ParseOptions,
  Doc
}

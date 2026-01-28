// _scripts/content-metadata-view.js

// Guard: make sure dv is there and current file is available
if (!dv || !dv.current || !dv.current() || !dv.current().file) {
    dv.paragraph("⚠️ Dataview current file context not ready.");
    console.log("content-metadata-view: dv.current() not ready", { dvCurrent: dv.current && dv.current() });
    return;
}

// ===== CONFIG =====
const HIDE_KEYS = ["stuffff"];
const METADATA_EXCLUDE_KEYS = [
    "symbol", "link", "text", "outlinks", "tags", "section",
    "children", "task", "checked", "annotated", "header",
    "path", "line", "lineCount", "position", "list",
    "subtasks", "real", "image", "parent", "file"
];

// ===== HELPERS =====
const isLink = (value) => value?.constructor?.name === "Link";

const normalizeToID = (value) => {
    let path = "";
    if (isLink(value)) path = value.path;
    else {
        let raw = String(value);
        if (raw.startsWith("[[") && raw.endsWith("]]")) {
            raw = raw.slice(2, -2).split("|")[0];
        }
        path = raw;
    }
    return path.replace(/\.md$/i, "").trim().toLowerCase();
};

const appendTags = (value) => {
    const raw = String(value);
    if (/^\[.*\]\(.*\)$/.test(raw)) return raw;

    const path = isLink(value) ? value.path : raw.replace(/^[[|\]]$/g, "").split("|")[0];
    const page = dv.page(path);

    if (page?.file?.tags?.length > 0) {
        const tagString = Array.from(page.file.tags).join(" ");
        return `${value} <span style="font-size: 0.8em; opacity: 0.7;">${tagString}</span>`;
    }
    return value;
};

// const cleanContent = (text) => {
//     const lines = (text || "").split("\n");
//     let result = [];

//     for (let line of lines) {
//         line = line.trim();
//         if (!/^\s*(\w|-)+\s*::/.test(line) && !line.startsWith("%%")) {
//             result.push(line.replace(/\s{2,}/g, " "));
//         }
//     }

//     return result.join(" ") || "";
// };


const cleanContent = (text) => {
    const lines = (text || "").split("\n");
    let result = [];

    for (let line of lines) {
        line = line.trim();

        // Skip lines that start with metadata or comments
        if (/^\s*(\w|-)+\s*::/.test(line) || line.startsWith("%%")) {
            continue;
        }

        // Remove inline metadata (key:: value or [key:: value])
        // Pattern 1: [key:: [[value]]] - bracketed key with wikilink value
        line = line.replace(/\[[\w-]+::\s*\[\[([^\]]+)\]\]\]/g, '');

        // Pattern 2: (key:: [[value]]) - parenthesized key with wikilink value
        line = line.replace(/\([\w-]+::\s*\[\[([^\]]+)\]\]\)/g, '');

        // Pattern 3: [key:: value] where value contains markdown link [text](url)
        line = line.replace(/\[[\w-]+::\s*[^\]]*\[[^\]]+\]\([^)]+\)[^\]]*\]/g, '');

        // Pattern 4: [key:: value] - general bracketed metadata
        line = line.replace(/\[[\w-]+::[^\]]*\]/g, '');

        // Pattern 5: (key::value) - parenthesized without spaces
        line = line.replace(/\([\w-]+::[\w\d]+\)/g, '');

        // Pattern 6: key:: value - unbracketed metadata (word-boundary aware)
        line = line.replace(/\b[\w-]+::\s*[^\s\[]+/g, '');


        // // Remove wiki-style links [[link]] or [[link|alias]]
        // line = line.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '');

        // // Remove markdown links [text](url)
        // line = line.replace(/\[([^\]]+)\]\([^)]+\)/g, '');

        // // Clean up extra whitespace
        // line = line.replace(/\s{2,}/g, " ").trim();

        if (line) {
            result.push(line);
        }
    }

    return result.join(" ") || "";
};

const collectMetadata = (listItem) => {
    const metadata = {};
    const excludeKeys = [...METADATA_EXCLUDE_KEYS, ...HIDE_KEYS].map((k) =>
        k.toLowerCase()
    );

    for (const [key, value] of Object.entries(listItem)) {
        const lowerKey = key.toLowerCase();
        if (!excludeKeys.includes(lowerKey) && value !== undefined && value !== null && value !== "") {
            const values = Array.isArray(value) ? dv.array(value) : [value];
            metadata[key] = new Set(values.map((v) => String(v).trim()).filter(Boolean));
        }
    }

    Object.entries(metadata).forEach(([key, values]) => {
        if (values.size === 0) delete metadata[key];
    });

    return metadata;
};

const isVisibleInCurrentFile = (listItem, currentFileID) => {
    if (listItem.outlinks?.some((link) => normalizeToID(link) === currentFileID)) return true;
    return normalizeToID(listItem.text).includes(currentFileID);
};

const getFilteredInternalLinks = (listItem, metadata, currentFileID) => {
    if (!listItem.outlinks) return [];

    const excludeIDs = new Set([currentFileID]);
    Object.values(metadata).forEach((values) => {
        values.forEach((value) => excludeIDs.add(normalizeToID(value)));
    });

    return listItem.outlinks.filter((link) => !excludeIDs.has(normalizeToID(link)));
};

const buildRelatedColumn = (internalLinks, metadata) => {
    const sections = [];

    if (internalLinks.length > 0) {
        sections.push(internalLinks.map(appendTags).join("<br>"));
    }

    Object.entries(metadata)
        .filter(([, values]) => values.size > 0)
        .sort(([a]) => a)
        .forEach(([key, values]) => {
            const label = key.charAt(0).toUpperCase() + key.slice(1);
            sections.push(`**${label}**: ${Array.from(values).map(appendTags).join(", ")}`);
        });

    return sections.join("<br>");
};

// ===== MAIN TABLE =====
const currentFileID = normalizeToID(dv.current().file.name);

const rows = dv.pages()
    .flatMap((page) => page.file.lists)
    .map((listItem) => {
        const metadata = collectMetadata(listItem);

        if (!isVisibleInCurrentFile(listItem, currentFileID)) return null;

        const content = cleanContent(listItem.text);
        const internalLinks = getFilteredInternalLinks(listItem, metadata, currentFileID);
        const relatedColumn = buildRelatedColumn(internalLinks, metadata);
        const whereColumn = listItem.link;

        const filePage = listItem.file?.link ? dv.page(listItem.file.link.path) : null;
        const sortKey = filePage?.file?.mtime || filePage?.file?.ctime;

        return {
            row: [content, relatedColumn, whereColumn],
            sortKey
        };
    })
    .filter((item) => item !== null)
    .sort((a, b) => (b.sortKey < a.sortKey ? -1 : 1))
    .map((item) => item.row);

if (!rows.length) {
    dv.paragraph("⚠️ No matching list items found for this file.");
} else {
    dv.table(["Content", "Links & Metadata", "Where"], rows);
}
